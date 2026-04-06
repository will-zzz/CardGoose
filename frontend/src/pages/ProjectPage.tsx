import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiBase, apiJson } from '../lib/api';
import { useAuth } from '../contexts/useAuth';
import { parseCsvText } from '../lib/csv';
import { CF_LAYOUT_ID_KEY, ensureLayoutIdColumn } from '../lib/cardLayout';
import { CardsGallery } from '../components/CardsGallery';
import { LayoutEditor, type LayoutEditorHandle } from '../components/LayoutEditor';
import {
  defaultLayoutState,
  ensureLayoutState,
  type LayoutStateV2,
} from '../types/layout';
import type { ProjectTab } from '../contexts/studioChromeTypes';
import { useStudioChrome } from '../contexts/StudioChrome';

function cloneLayoutState(s: LayoutStateV2): LayoutStateV2 {
  return JSON.parse(JSON.stringify(s)) as LayoutStateV2;
}

type Asset = { id: string; artKey: string; s3Key: string; createdAt: string; url?: string };
type ExportRow = { key: string; url: string };
type CsvData = { headers: string[]; rows: Record<string, string>[] };
type ProjectDetail = {
  id: string;
  name: string;
  csvData: CsvData | null;
  csvSourceUrl: string | null;
  layouts: { id: string; name: string; lastUpdated: string }[];
};
type LayoutFull = { id: string; name: string; lastUpdated: string; state: unknown };

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setLayoutEditorChrome, setProjectViewNav } = useStudioChrome();
  const { token } = useAuth();
  const [tab, setTab] = useState<ProjectTab>('cards');
  const layoutEditorRef = useRef<LayoutEditorHandle>(null);
  const [editorCaps, setEditorCaps] = useState({ canUndo: false, canRedo: false });
  const [layoutMountNonce, setLayoutMountNonce] = useState(0);
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
  const [csvUrlDraft, setCsvUrlDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Last known persisted snapshot for dirty detection */
  const [savedBaseline, setSavedBaseline] = useState<{
    name: string;
    state: LayoutStateV2;
  } | null>(null);
  /** Set when a save completes in this session (for “Saved at …”) */
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

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
    setCsvUrlDraft(proj.project.csvSourceUrl ?? '');
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
    const loadedState = ensureLayoutState(first.state);
    setActiveLayoutId(first.id);
    setLayoutName(first.name);
    setEditorState(loadedState);
    setSavedBaseline({ name: first.name.trim(), state: cloneLayoutState(loadedState) });
    setLastSavedAt(null);
    await loadPipeline();
  }, [token, id, loadPipeline]);

  useEffect(() => {
    void loadCore().catch((err) => setError(err instanceof Error ? err.message : 'Load failed'));
  }, [loadCore]);

  useEffect(() => {
    if (tab === 'layout') {
      document.body.classList.add('layout-editor-open');
      return () => document.body.classList.remove('layout-editor-open');
    }
    return undefined;
  }, [tab]);

  const saveLayout = useCallback(async (): Promise<boolean> => {
    if (!token || !id || !activeLayoutId) return false;
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
      setSavedBaseline({
        name: layout.name.trim(),
        state: cloneLayoutState(editorState),
      });
      setLayoutName(layout.name);
      setLastSavedAt(new Date());
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      return false;
    } finally {
      setBusy(false);
    }
  }, [token, id, activeLayoutId, layoutName, editorState, project]);

  const layoutIsDirty = useMemo(() => {
    if (!savedBaseline) return false;
    if (layoutName.trim() !== savedBaseline.name) return true;
    return JSON.stringify(editorState) !== JSON.stringify(savedBaseline.state);
  }, [savedBaseline, layoutName, editorState]);

  /** BrowserRouter does not support useBlocker; guard navigation manually. */
  const onNavigateHomeClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!layoutIsDirty) return;
      e.preventDefault();
      if (window.confirm('You have unsaved changes. Leave without saving?')) {
        navigate('/');
      }
    },
    [layoutIsDirty, navigate],
  );

  useEffect(() => {
    if (tab !== 'layout' || !layoutIsDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [tab, layoutIsDirty]);

  useEffect(() => {
    if (tab !== 'layout') return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 's') return;
      e.preventDefault();
      void saveLayout();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, saveLayout]);

  const navigateTab = useCallback(
    (next: ProjectTab) => {
      if (tab === 'layout' && layoutIsDirty && next !== 'layout') {
        if (!window.confirm('You have unsaved changes. Leave the layout editor?')) return;
      }
      setTab(next);
      setSearchParams({ tab: next }, { replace: true });
    },
    [tab, layoutIsDirty, setSearchParams],
  );

  const openLayoutInEditor = useCallback(
    (layoutId: string) => {
      const L = layoutsFull.find((l) => l.id === layoutId);
      if (!L) return;
      if (layoutIsDirty) {
        if (
          !window.confirm('Discard unsaved changes and open this layout in the editor?')
        ) {
          return;
        }
      }
      const nextState = ensureLayoutState(L.state);
      setActiveLayoutId(layoutId);
      setLayoutName(L.name);
      setEditorState(nextState);
      setSavedBaseline({ name: L.name.trim(), state: cloneLayoutState(nextState) });
      setLastSavedAt(null);
      setLayoutMountNonce((n) => n + 1);
      navigateTab('layout');
    },
    [layoutsFull, layoutIsDirty, navigateTab],
  );

  const addDataRowForLayout = useCallback(
    async (layoutId: string) => {
      if (!token || !id || !csvData?.headers.length) return;
      setBusy(true);
      setError(null);
      try {
        const headers = ensureLayoutIdColumn([...csvData.headers]);
        const newRow: Record<string, string> = {};
        for (const h of headers) {
          newRow[h] = h === CF_LAYOUT_ID_KEY ? layoutId : '';
        }
        const res = await apiJson<{ csvData: CsvData }>(`/api/projects/${id}/data`, {
          method: 'PUT',
          token,
          body: JSON.stringify({ headers, rows: [...csvData.rows, newRow] }),
        });
        if (project) setProject({ ...project, csvData: res.csvData });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add row');
      } finally {
        setBusy(false);
      }
    },
    [token, id, csvData, project],
  );

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'cards' || t === 'layout' || t === 'data' || t === 'pipeline') {
      setTab(t);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!id || !project || tab === 'layout') {
      setProjectViewNav(null);
      return;
    }
    setProjectViewNav({
      projectId: id,
      projectName: project.name,
      tab,
      hasPublishedSheet: Boolean(project.csvSourceUrl?.trim()),
      navigateTab,
      onNavigateHomeClick,
    });
    return () => setProjectViewNav(null);
  }, [id, project, tab, navigateTab, onNavigateHomeClick, setProjectViewNav]);

  const onNavigateToProjectCardsClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      if (layoutIsDirty) {
        if (!window.confirm('You have unsaved changes. Leave the layout editor?')) return;
      }
      navigateTab('cards');
    },
    [layoutIsDirty, navigateTab],
  );

  const resetToLastSync = useCallback(() => {
    if (!savedBaseline) return;
    if (
      layoutIsDirty &&
      !window.confirm('Discard unsaved changes and revert to the last saved version?')
    ) {
      return;
    }
    setEditorState(cloneLayoutState(savedBaseline.state));
    setLayoutName(savedBaseline.name);
    setLayoutMountNonce((n) => n + 1);
  }, [savedBaseline, layoutIsDirty]);

  const saveLayoutAs = useCallback(async () => {
    if (!token || !id) return;
    const suggested = `${layoutName.trim() || 'Layout'} copy`;
    const name = window.prompt('New layout name', suggested);
    if (!name?.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { layout } = await apiJson<{ layout: LayoutFull }>(`/api/projects/${id}/layouts`, {
        method: 'POST',
        token,
        body: JSON.stringify({ name: name.trim(), state: editorState }),
      });
      const nextState = ensureLayoutState(layout.state);
      setLayoutsFull((prev) => [...prev, layout]);
      setActiveLayoutId(layout.id);
      setLayoutName(layout.name);
      setEditorState(nextState);
      setSavedBaseline({ name: layout.name.trim(), state: cloneLayoutState(nextState) });
      setLastSavedAt(new Date());
      if (project) {
        setProject({
          ...project,
          layouts: [
            ...project.layouts,
            { id: layout.id, name: layout.name, lastUpdated: layout.lastUpdated },
          ],
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save as failed');
    } finally {
      setBusy(false);
    }
  }, [token, id, layoutName, editorState, project]);

  const exitLayoutEditor = useCallback(() => {
    if (layoutIsDirty) {
      const ok = window.confirm(
        'You have unsaved changes. Leave the editor without saving?',
      );
      if (!ok) return;
    }
    navigateTab('cards');
  }, [layoutIsDirty, navigateTab]);

  const saveLayoutAndExit = useCallback(async () => {
    if (!layoutIsDirty) {
      navigateTab('cards');
      return;
    }
    const ok = await saveLayout();
    if (ok) navigateTab('cards');
  }, [layoutIsDirty, saveLayout, navigateTab]);

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
      const res = await apiJson<{ csvData: CsvData; csvSourceUrl?: string | null }>(
        `/api/projects/${id}/data`,
        {
          method: 'PUT',
          token,
          body: JSON.stringify({ ...parsed, sourceUrl: null }),
        },
      );
      if (project) {
        setProject({
          ...project,
          csvData: res.csvData,
          csvSourceUrl: res.csvSourceUrl ?? null,
        });
        setCsvUrlDraft(res.csvSourceUrl ?? '');
      }
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

  async function saveCsvLink() {
    if (!token || !id) return;
    setBusy(true);
    setError(null);
    try {
      const trimmed = csvUrlDraft.trim();
      const { csvSourceUrl } = await apiJson<{ csvSourceUrl: string | null }>(
        `/api/projects/${id}/csv-link`,
        {
          method: 'PUT',
          token,
          body: JSON.stringify({ url: trimmed || null }),
        },
      );
      if (project) setProject({ ...project, csvSourceUrl });
      setCsvUrlDraft(csvSourceUrl ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save link failed');
    } finally {
      setBusy(false);
    }
  }

  async function refreshCsvFromUrl() {
    if (!token || !id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiJson<{ csvData: CsvData; csvSourceUrl: string }>(
        `/api/projects/${id}/csv/refresh`,
        {
          method: 'POST',
          token,
          body: JSON.stringify({
            url: csvUrlDraft.trim() || undefined,
          }),
        },
      );
      if (project) {
        setProject({
          ...project,
          csvData: res.csvData,
          csvSourceUrl: res.csvSourceUrl,
        });
      }
      setCsvUrlDraft(res.csvSourceUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setBusy(false);
    }
  }

  const onExport = useCallback(async () => {
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
  }, [token, id, loadPipeline]);

  useEffect(() => {
    if (!id || tab !== 'layout') {
      setLayoutEditorChrome(null);
      return;
    }
    setLayoutEditorChrome({
      projectId: id,
      projectName: project?.name ?? 'Project',
      layoutName,
      onLayoutNameChange: setLayoutName,
      onNavigateHomeClick,
      onNavigateToProjectCardsClick,
      onSave: () => {
        void saveLayout();
      },
      onSaveAs: () => {
        void saveLayoutAs();
      },
      onResetToLastSync: resetToLastSync,
      onCloseEditor: exitLayoutEditor,
      onEditUndo: () => layoutEditorRef.current?.undo(),
      onEditRedo: () => layoutEditorRef.current?.redo(),
      onEditSelectAll: () => layoutEditorRef.current?.selectAll(),
      onEditClearCanvas: () => layoutEditorRef.current?.clearCanvas(),
      onViewZoomToFit: () => layoutEditorRef.current?.zoomToFit(),
      onViewZoomIn: () => layoutEditorRef.current?.zoomIn(),
      onViewZoomOut: () => layoutEditorRef.current?.zoomOut(),
      onViewZoomTo100Percent: () => layoutEditorRef.current?.zoomTo100Percent(),
      canUndo: editorCaps.canUndo,
      canRedo: editorCaps.canRedo,
      onSaveAndExit: () => {
        void saveLayoutAndExit();
      },
      busy,
      layoutIsDirty,
      lastSavedAt,
      saveDisabled: !activeLayoutId,
    });
    return () => setLayoutEditorChrome(null);
  }, [
    id,
    tab,
    layoutName,
    project?.name,
    busy,
    layoutIsDirty,
    lastSavedAt,
    activeLayoutId,
    setLayoutEditorChrome,
    saveLayout,
    saveLayoutAndExit,
    saveLayoutAs,
    resetToLastSync,
    exitLayoutEditor,
    onNavigateHomeClick,
    onNavigateToProjectCardsClick,
    editorCaps.canUndo,
    editorCaps.canRedo,
  ]);

  if (!id) return <p>Invalid project</p>;

  const activeLayout = layoutsFull.find((l) => l.id === activeLayoutId) ?? null;

  return (
    <div
      className={`page project-dashboard${tab === 'layout' ? ' project-dashboard--layout-tab' : ''}`}
    >
      {error && <p className="error">{error}</p>}

      {tab === 'cards' && (
        <section className="section cards-tab-section">
          <CardsGallery
            projectId={id}
            token={token}
            layoutsFull={layoutsFull}
            csvData={csvData ?? { headers: [], rows: [] }}
            assetUrls={assetUrls}
            busy={busy}
            onBusy={setBusy}
            onError={setError}
            onCsvUpdated={(next) => {
              if (project) setProject({ ...project, csvData: next });
            }}
            onOpenLayoutInEditor={openLayoutInEditor}
            onAddDataRowForLayout={addDataRowForLayout}
          />
        </section>
      )}

      {tab === 'layout' && (
        <section className="layout-fullscreen" aria-label="Card layout editor">
          {activeLayout && (
            <LayoutEditor
              ref={layoutEditorRef}
              key={`${activeLayoutId ?? 'x'}-${layoutMountNonce}`}
              state={editorState}
              onChange={setEditorState}
              assetUrls={assetUrls}
              sampleRow={sampleRow}
              deckRows={csvData?.rows ?? []}
              onCapabilitiesChange={setEditorCaps}
            />
          )}
        </section>
      )}

      {tab === 'data' && (
        <section className="section">
          <h2>CSV data</h2>
          <p className="muted" style={{ maxWidth: 560 }}>
            Paste a <strong>published CSV link</strong> from Google Sheets (File → Share → Publish to web →
            CSV). The API fetches it server-side so browser CORS is not an issue. Save the link, then use
            Refresh to pull the latest rows.
          </p>
          <div className="stack" style={{ maxWidth: 560 }}>
            <label>
              Published CSV URL (https only)
              <input
                type="url"
                autoComplete="off"
                placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=..."
                value={csvUrlDraft}
                onChange={(e) => setCsvUrlDraft(e.target.value)}
              />
            </label>
            <div className="inline-form">
              <button type="button" disabled={busy} onClick={() => void saveCsvLink()}>
                Save link
              </button>
              <button type="button" disabled={busy} onClick={() => void refreshCsvFromUrl()}>
                Refresh data
              </button>
            </div>
          </div>
          <h3>Or upload a file</h3>
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
