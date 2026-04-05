import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiBase, apiJson } from '../lib/api';
import { useAuth } from '../contexts/useAuth';
import { parseCsvText } from '../lib/csv';
import { CardFace } from '../components/CardFace';
import { LayoutEditor } from '../components/LayoutEditor';
import { defaultLayoutState, ensureLayoutState, type LayoutStateV2 } from '../types/layout';

type Asset = { id: string; artKey: string; s3Key: string; createdAt: string; url?: string };
type ExportRow = { key: string; url: string };
type CsvData = { headers: string[]; rows: Record<string, string>[] };
type ProjectDetail = {
  id: string;
  name: string;
  csvData: CsvData | null;
  layouts: { id: string; name: string; lastUpdated: string }[];
};
type LayoutFull = { id: string; name: string; lastUpdated: string; state: unknown };

type Tab = 'data' | 'layout' | 'cards' | 'pipeline';

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>('cards');
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [layoutsFull, setLayoutsFull] = useState<LayoutFull[]>([]);
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<LayoutStateV2>(defaultLayoutState());
  const [layoutName, setLayoutName] = useState('Default');
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [assets, setAssets] = useState<Asset[]>([]);
  const [exports, setExports] = useState<ExportRow[]>([]);
  const [artKey, setArtKey] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const csvData = project?.csvData ?? null;
  const sampleRow = useMemo(() => csvData?.rows[0] ?? {}, [csvData]);

  const loadPipeline = useCallback(async () => {
    if (!token || !id) return;
    const [a, e] = await Promise.all([
      apiJson<{ assets: Asset[] }>(`/api/projects/${id}/assets?includeUrls=1`, { token }),
      apiJson<{ exports: ExportRow[] }>(`/api/projects/${id}/exports`, { token }),
    ]);
    setAssets(a.assets);
    const map: Record<string, string> = {};
    for (const x of a.assets) {
      if (x.url) map[x.artKey] = x.url;
    }
    setAssetUrls(map);
    setExports(e.exports);
  }, [token, id]);

  const loadCore = useCallback(async () => {
    if (!token || !id) return;
    setError(null);
    const [proj, lays] = await Promise.all([
      apiJson<{ project: ProjectDetail }>(`/api/projects/${id}`, { token }),
      apiJson<{ layouts: LayoutFull[] }>(`/api/projects/${id}/layouts`, { token }),
    ]);
    setProject(proj.project);
    let list = lays.layouts;
    if (list.length === 0) {
      const created = await apiJson<{ layout: LayoutFull }>(`/api/projects/${id}/layouts`, {
        method: 'POST',
        token,
        body: JSON.stringify({ name: 'Default', state: defaultLayoutState() }),
      });
      list = [created.layout];
    }
    setLayoutsFull(list);
    const first = list[0];
    setActiveLayoutId(first.id);
    setLayoutName(first.name);
    setEditorState(ensureLayoutState(first.state));
    await loadPipeline();
  }, [token, id, loadPipeline]);

  useEffect(() => {
    void loadCore().catch((err) => setError(err instanceof Error ? err.message : 'Load failed'));
  }, [loadCore]);

  function selectLayout(nextId: string) {
    const L = layoutsFull.find((l) => l.id === nextId);
    if (!L) return;
    setActiveLayoutId(nextId);
    setLayoutName(L.name);
    setEditorState(ensureLayoutState(L.state));
  }

  async function saveLayout() {
    if (!token || !id || !activeLayoutId) return;
    setBusy(true);
    setError(null);
    try {
      const { layout } = await apiJson<{ layout: LayoutFull }>(
        `/api/projects/${id}/layouts/${activeLayoutId}`,
        {
          method: 'PUT',
          token,
          body: JSON.stringify({ name: layoutName.trim() || 'Layout', state: editorState }),
        },
      );
      setLayoutsFull((prev) => prev.map((l) => (l.id === layout.id ? layout : l)));
      if (project) {
        setProject({
          ...project,
          layouts: project.layouts.map((x) =>
            x.id === layout.id ? { ...x, name: layout.name, lastUpdated: layout.lastUpdated } : x,
          ),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function importCsv(e: FormEvent) {
    e.preventDefault();
    if (!token || !id || !csvFile) return;
    setBusy(true);
    setError(null);
    try {
      const text = await csvFile.text();
      const parsed = parseCsvText(text);
      if (parsed.headers.length === 0) {
        throw new Error('CSV must include a header row');
      }
      const { csvData: next } = await apiJson<{ csvData: CsvData }>(`/api/projects/${id}/data`, {
        method: 'PUT',
        token,
        body: JSON.stringify(parsed),
      });
      if (project) setProject({ ...project, csvData: next });
      setCsvFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

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
      await loadPipeline();
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
      await loadPipeline();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  if (!id) return <p>Invalid project</p>;

  const activeLayout = layoutsFull.find((l) => l.id === activeLayoutId) ?? null;
  const previewState = activeLayout ? editorState : defaultLayoutState();

  return (
    <div className="page project-dashboard">
      <div className="page-header">
        <p style={{ margin: 0, width: '100%' }}>
          <Link to="/">← Projects</Link>
        </p>
      </div>
      <h1>{project?.name ?? 'Project'}</h1>
      <p className="muted">ID: {id}</p>
      {error && <p className="error">{error}</p>}

      <div className="tabs" role="tablist" aria-label="Project sections">
        <button type="button" className={tab === 'cards' ? 'active' : ''} onClick={() => setTab('cards')}>
          Cards
        </button>
        <button type="button" className={tab === 'layout' ? 'active' : ''} onClick={() => setTab('layout')}>
          Layout
        </button>
        <button type="button" className={tab === 'data' ? 'active' : ''} onClick={() => setTab('data')}>
          Data
        </button>
        <button type="button" className={tab === 'pipeline' ? 'active' : ''} onClick={() => setTab('pipeline')}>
          Assets & export
        </button>
      </div>

      {tab === 'cards' && (
        <section className="section">
          <h2>Card previews</h2>
          <p className="muted">
            Renders use the layout from the Layout tab and your imported CSV. Placeholders like{' '}
            <code>{'{{Name}}'}</code> map to column headers.
          </p>
          {layoutsFull.length > 0 && (
            <label>
              Layout
              <select
                value={activeLayoutId ?? ''}
                onChange={(e) => selectLayout(e.target.value)}
                disabled={busy}
              >
                {layoutsFull.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!csvData || csvData.rows.length === 0 ? (
            <p className="muted">Import a CSV on the Data tab to see cards.</p>
          ) : (
            <div className="card-grid">
              {csvData.rows.map((row, i) => {
                const label =
                  row.Name ||
                  row.name ||
                  row.Title ||
                  row.title ||
                  Object.values(row)[0] ||
                  `Card ${i + 1}`;
                return (
                  <figure key={i} className="card-grid-item">
                    <CardFace
                      state={previewState}
                      row={row}
                      assetUrls={assetUrls}
                      pixelWidth={200}
                    />
                    <figcaption title={label}>{label}</figcaption>
                  </figure>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'layout' && (
        <section className="section">
          <h2>Card layout</h2>
          <p className="muted">
            Drag elements, edit properties, and use <code>{'{{Column}}'}</code> in text layers. Save to persist.
          </p>
          {layoutsFull.length > 0 && (
            <div className="inline-form" style={{ marginBottom: 12 }}>
              <label>
                Layout
                <select
                  value={activeLayoutId ?? ''}
                  onChange={(e) => selectLayout(e.target.value)}
                  disabled={busy}
                >
                  {layoutsFull.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Name
                <input
                  type="text"
                  value={layoutName}
                  onChange={(e) => setLayoutName(e.target.value)}
                  placeholder="Layout name"
                />
              </label>
              <button type="button" onClick={() => void saveLayout()} disabled={busy}>
                Save layout
              </button>
            </div>
          )}
          {activeLayout && (
            <LayoutEditor
              state={editorState}
              onChange={setEditorState}
              assetUrls={assetUrls}
              sampleRow={sampleRow}
            />
          )}
        </section>
      )}

      {tab === 'data' && (
        <section className="section">
          <h2>CSV data</h2>
          <form onSubmit={importCsv} className="stack" style={{ maxWidth: 480 }}>
            <label>
              CSV file
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button type="submit" disabled={busy || !csvFile}>
              Import and replace dataset
            </button>
          </form>
          {csvData && csvData.headers.length > 0 && (
            <>
              <h3>Preview ({csvData.rows.length} rows)</h3>
              <div className="csv-preview">
                <table>
                  <thead>
                    <tr>
                      {csvData.headers.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.rows.slice(0, 12).map((row, ri) => (
                      <tr key={ri}>
                        {csvData.headers.map((h) => (
                          <td key={h}>{row[h] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvData.rows.length > 12 && (
                <p className="muted">Showing first 12 rows. All rows are stored for card rendering.</p>
              )}
            </>
          )}
        </section>
      )}

      {tab === 'pipeline' && (
        <>
          <section className="section">
            <h2>Upload asset</h2>
            <form onSubmit={onUpload} className="stack">
              <label>
                Optional art key
                <input value={artKey} onChange={(e) => setArtKey(e.target.value)} placeholder="e.g. card-back" />
              </label>
              <label>
                File
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
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
            {exports.length === 0 && (
              <p className="muted">No exports yet — run worker locally or on ECS.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
