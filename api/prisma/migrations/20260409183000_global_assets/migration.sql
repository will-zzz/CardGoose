-- CreateTable
CREATE TABLE "global_assets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "art_key" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "global_assets_user_id_art_key_key" ON "global_assets"("user_id", "art_key");

-- CreateIndex
CREATE INDEX "global_assets_user_id_idx" ON "global_assets"("user_id");

-- AddForeignKey
ALTER TABLE "global_assets" ADD CONSTRAINT "global_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
