#!/bin/bash
# LocalStack runs this after services are up (see docker-compose volume mount).
set -euo pipefail

export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# Prefer awslocal (bundled in LocalStack image); fall back to aws CLI.
if command -v awslocal >/dev/null 2>&1; then
  AWS=(awslocal)
elif command -v aws >/dev/null 2>&1; then
  AWS=(aws --endpoint-url="http://localhost:4566")
else
  echo "No awslocal or aws CLI; skipping LocalStack bootstrap"
  exit 0
fi

"${AWS[@]}" s3 mb "s3://cardgoose-assets" 2>/dev/null || true
"${AWS[@]}" s3 mb "s3://cardgoose-exports" 2>/dev/null || true
"${AWS[@]}" sqs create-queue --queue-name cardgoose-pdf-generation 2>/dev/null || true

# Browser (Vite) loads presigned URLs with crossOrigin=anonymous → needs ACAO on GET.
CORS_JSON="$(mktemp)"
trap 'rm -f "$CORS_JSON"' EXIT
cat >"$CORS_JSON" <<'EOF'
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "HEAD", "PUT", "POST"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF
for b in cardgoose-assets cardgoose-exports; do
  "${AWS[@]}" s3api put-bucket-cors --bucket "$b" --cors-configuration "file://$CORS_JSON" 2>/dev/null || true
done

echo "LocalStack bootstrap: S3 buckets + SQS queue ready"
