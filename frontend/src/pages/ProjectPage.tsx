import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiBase, apiJson } from '../lib/api';
import { useAuth } from '../contexts/useAuth';

type Asset = { id: string; artKey: string; s3Key: string; createdAt: string };
type ExportRow = { key: string; url: string };

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [exports, setExports] = useState<ExportRow[]>([]);
  const [artKey, setArtKey] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setError(null);
    const [a, e] = await Promise.all([
      apiJson<{ assets: Asset[] }>(`/api/projects/${id}/assets`, { token }),
      apiJson<{ exports: ExportRow[] }>(`/api/projects/${id}/exports`, { token }),
    ]);
    setAssets(a.assets);
    setExports(e.exports);
  }, [token, id]);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Load failed'));
  }, [load]);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!token || !id || !file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (artKey.trim()) fd.append('artKey', artKey.trim());
      const full = `${apiBase()}/api/projects/${id}/assets`;
      const res = await fetch(full, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error((data as { error?: string })?.error ?? res.statusText);
      setFile(null);
      setArtKey('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function onExport() {
    if (!token || !id) return;
    setBusy(true);
    setError(null);
    try {
      await apiJson(`/api/projects/${id}/export`, { method: 'POST', token });
      await new Promise((r) => setTimeout(r, 500));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  if (!id) return <p>Invalid project</p>;

  return (
    <div className="page">
      <p>
        <Link to="/">← Projects</Link>
      </p>
      <h1>Project</h1>
      <p className="muted">ID: {id}</p>
      {error && <p className="error">{error}</p>}

      <section className="section">
        <h2>Upload asset</h2>
        <form onSubmit={onUpload} className="stack">
          <label>
            Optional art key
            <input value={artKey} onChange={(e) => setArtKey(e.target.value)} placeholder="e.g. card-back" />
          </label>
          <label>
            File
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            Upload to S3
          </button>
        </form>
      </section>

      <section className="section">
        <h2>Assets</h2>
        <ul>
          {assets.map((a) => (
            <li key={a.id}>
              <code>{a.artKey}</code> — <small>{a.s3Key}</small>
            </li>
          ))}
        </ul>
        {assets.length === 0 && <p className="muted">No assets yet.</p>}
      </section>

      <section className="section">
        <h2>Export (SQS → worker)</h2>
        <button type="button" onClick={() => void onExport()} disabled={busy}>
          Trigger export job
        </button>
        <h3>Exports</h3>
        <ul>
          {exports.map((ex) => (
            <li key={ex.key}>
              <a href={ex.url} target="_blank" rel="noreferrer">
                {ex.key}
              </a>
            </li>
          ))}
        </ul>
        {exports.length === 0 && <p className="muted">No exports yet — run worker locally or on ECS.</p>}
      </section>
    </div>
  );
}
