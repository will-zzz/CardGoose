import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiJson } from '../lib/api';
import { useAuth } from '../contexts/useAuth';
import { useToast } from '../contexts/useToast';
import { buildMergedAssetUrlRecord, normalizeArtLookupKey } from '../lib/assetResolve';
import { AssetsTabPanel } from '../components/AssetsTabPanel';
import { CardGroupsPanel } from '../components/CardGroupsPanel';
import { ExportTabPanel } from '../components/ExportTabPanel';
import { LayoutsListPanel } from '../components/LayoutsListPanel';
import {
  LayoutEditor,
  type DeckPreviewOption,
  type LayoutEditorHandle,
} from '../components/LayoutEditor';
import { defaultLayoutState, ensureLayoutState, type LayoutStateV2 } from '../types/layout';
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
type CardGroupSummary = {
  id: string;
  name: string;
  csvData: CsvData | null;
  layoutId: string | null;
};

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setLayoutEditorChrome, setProjectViewNav } = useStudioChrome();
  const { token } = useAuth();
  const { showError } = useToast();
  const [tab, setTab] = useState<ProjectTab>('cards');
  const layoutEditorRef = useRef<LayoutEditorHandle>(null);
  /** Refresh exports list while a queued PDF may still be processing */
  const exportPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [editorCaps, setEditorCaps] = useState({ canUndo: false, canRedo: false });
  const [layoutMountNonce, setLayoutMountNonce] = useState(0);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [layoutsFull, setLayoutsFull] = useState<LayoutFull[]>([]);
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<LayoutStateV2>(defaultLayoutState());
  const [layoutName, setLayoutName] = useState('Default');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [globalAssets, setGlobalAssets] = useState<Asset[]>([]);
  const [exports, setExports] = useState<ExportRow[]>([]);
  const [busy, setBusy] = useState(false);
  /** Export tab: PDF export bypasses SQS and can take a while */
  const [exportPdfLoading, setExportPdfLoading] = useState(false);
  const [exportPdfStatus, setExportPdfStatus] = useState<string | null>(null);
  /** Raster DPI for PDF cards (API clamps 150–300) */
  const [exportPdfDpi, setExportPdfDpi] = useState(150);
  /** Last known persisted snapshot for dirty detection */
  const [savedBaseline, setSavedBaseline] = useState<{
    name: string;
    state: LayoutStateV2;
  } | null>(null);
  /** Set when a save completes in this session (for “Saved at …”) */
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [cardGroups, setCardGroups] = useState<CardGroupSummary[]>([]);
  /** Kept in sync from CardGroupsPanel so app bar “Linked” reflects group URLs, not only project.csvSourceUrl */
  const [anyCardGroupPublishedUrl, setAnyCardGroupPublishedUrl] = useState(false);

  const csvData = project?.csvData ?? null;

  const mergedAssetUrls = useMemo(
    () => buildMergedAssetUrlRecord(assets, globalAssets),
    [assets, globalAssets]
  );

  const assetResolveOrder = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const a of assets) {
      const n = normalizeArtLookupKey(a.artKey);
      if (seen.has(n)) continue;
      seen.add(n);
      out.push(a.artKey);
    }
    for (const a of globalAssets) {
      const n = normalizeArtLookupKey(a.artKey);
      if (seen.has(n)) continue;
      seen.add(n);
      out.push(a.artKey);
    }
    return out;
  }, [assets, globalAssets]);

  const deckPreviewOptions = useMemo((): DeckPreviewOption[] => {
    const out: DeckPreviewOption[] = [];
    if (csvData && csvData.rows.length > 0) {
      out.push({
        id: '__project__',
        label: 'Project dataset',
        rows: csvData.rows,
        headers: csvData.headers,
        layoutId: null,
      });
    }
    for (const g of cardGroups) {
      const csv = g.csvData;
      out.push({
        id: g.id,
        label: g.name,
        rows: csv?.rows ?? [],
        headers: csv?.headers,
        layoutId: g.layoutId,
      });
    }
    if (out.length === 0) {
      out.push({ id: '__sample__', label: 'Sample', rows: [], layoutId: null });
    }
    return out;
  }, [csvData, cardGroups]);

  const loadPipeline = useCallback(async () => {
    if (!token || !id) return;
    const [a, e] = await Promise.all([
      apiJson<{ assets: Asset[]; globalAssets: Asset[] }>(`/api/projects/${id}/assets?includeUrls=1`, {
        token,
      }),
      apiJson<{ exports: ExportRow[] }>(`/api/projects/${id}/exports`, { token }),
    ]);
    setAssets(a.assets);
    setGlobalAssets(a.globalAssets ?? []);
    setExports(e.exports);
  }, [token, id]);

  const loadCardGroups = useCallback(async () => {
    if (!token || !id) return;
    try {
      const res = await apiJson<{
        cardGroups: {
          id: string;
          name: string;
          csvData: CsvData | null;
          layoutId: string | null;
          csvSourceUrl?: string | null;
        }[];
      }>(`/api/projects/${id}/card-groups`, { token });
      setCardGroups(
        res.cardGroups.map((g) => ({
          id: g.id,
          name: g.name,
          csvData: g.csvData,
          layoutId: g.layoutId ?? null,
        }))
      );
      setAnyCardGroupPublishedUrl(
        res.cardGroups.some((g) => Boolean(g.csvSourceUrl?.trim()))
      );
    } catch {
      // non-critical for layout editor; card groups just won't appear as data sources
    }
  }, [token, id]);

  const loadCore = useCallback(async () => {
    if (!token || !id) return;
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
    const loadedState = ensureLayoutState(first.state);
    setActiveLayoutId(first.id);
    setLayoutName(first.name);
    setEditorState(loadedState);
    setSavedBaseline({ name: first.name.trim(), state: cloneLayoutState(loadedState) });
    setLastSavedAt(null);
    await Promise.all([loadPipeline(), loadCardGroups()]);
  }, [token, id, loadPipeline, loadCardGroups]);

  useEffect(() => {
    void loadCore().catch((err) => showError(err instanceof Error ? err.message : 'Load failed'));
  }, [loadCore, showError]);

  useEffect(() => {
    setAnyCardGroupPublishedUrl(false);
  }, [id]);

  useEffect(() => {
    if (tab === 'layout') {
      document.body.classList.add('layout-editor-open');
      return () => document.body.classList.remove('layout-editor-open');
    }
    return undefined;
  }, [tab]);

  useEffect(() => {
    if (tab === 'assets') {
      document.body.classList.add('assets-tab-open');
      return () => document.body.classList.remove('assets-tab-open');
    }
    return undefined;
  }, [tab]);

  /** Card groups are edited on the Cards tab; keep layout editor preview options in sync. */
  useEffect(() => {
    if (tab !== 'layout' || !token || !id) return;
    void loadCardGroups();
  }, [tab, token, id, loadCardGroups]);

  const saveLayout = useCallback(async (): Promise<boolean> => {
    if (!token || !id || !activeLayoutId) return false;
    setBusy(true);
    try {
      const { layout } = await apiJson<{ layout: LayoutFull }>(
        `/api/projects/${id}/layouts/${activeLayoutId}`,
        {
          method: 'PUT',
          token,
          body: JSON.stringify({ name: layoutName.trim() || 'Layout', state: editorState }),
        }
      );
      setLayoutsFull((prev) => prev.map((l) => (l.id === layout.id ? layout : l)));
      if (project) {
        setProject({
          ...project,
          layouts: project.layouts.map((x) =>
            x.id === layout.id ? { ...x, name: layout.name, lastUpdated: layout.lastUpdated } : x
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
      showError(err instanceof Error ? err.message : 'Save failed');
      return false;
    } finally {
      setBusy(false);
    }
  }, [token, id, activeLayoutId, layoutName, editorState, project, showError]);

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
    [layoutIsDirty, navigate]
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
    [tab, layoutIsDirty, setSearchParams]
  );

  const openLayoutInEditor = useCallback(
    (layoutId: string) => {
      const L = layoutsFull.find((l) => l.id === layoutId);
      if (!L) return;
      if (layoutIsDirty) {
        if (!window.confirm('Discard unsaved changes and open this layout in the editor?')) {
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
    [layoutsFull, layoutIsDirty, navigateTab]
  );

  const createLayoutFromList = useCallback(
    async (layoutName: string) => {
      if (!token || !id) return;
      setBusy(true);
      try {
        const { layout } = await apiJson<{ layout: LayoutFull }>(`/api/projects/${id}/layouts`, {
          method: 'POST',
          token,
          body: JSON.stringify({ name: layoutName.trim(), state: defaultLayoutState() }),
        });
        setLayoutsFull((prev) => [...prev, layout]);
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
        showError(err instanceof Error ? err.message : 'Create failed');
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [token, id, project, showError]
  );

  const deleteLayout = useCallback(
    async (layoutId: string) => {
      if (!token || !id) return;
      if (
        !window.confirm(
          'Delete this layout? Card groups that use it will no longer be linked to a layout.'
        )
      ) {
        return;
      }
      setBusy(true);
      try {
        await apiJson(`/api/projects/${id}/layouts/${layoutId}`, { method: 'DELETE', token });
        const nextList = layoutsFull.filter((l) => l.id !== layoutId);
        if (nextList.length === 0) {
          const { layout } = await apiJson<{ layout: LayoutFull }>(`/api/projects/${id}/layouts`, {
            method: 'POST',
            token,
            body: JSON.stringify({ name: 'Default', state: defaultLayoutState() }),
          });
          setLayoutsFull([layout]);
          setActiveLayoutId(layout.id);
          setLayoutName(layout.name);
          const st = ensureLayoutState(layout.state);
          setEditorState(st);
          setSavedBaseline({ name: layout.name.trim(), state: cloneLayoutState(st) });
          setLastSavedAt(null);
          if (project) {
            setProject({
              ...project,
              layouts: [{ id: layout.id, name: layout.name, lastUpdated: layout.lastUpdated }],
            });
          }
        } else {
          setLayoutsFull(nextList);
          if (project) {
            setProject({
              ...project,
              layouts: project.layouts.filter((x) => x.id !== layoutId),
            });
          }
          if (activeLayoutId === layoutId) {
            const pick = nextList[0];
            setActiveLayoutId(pick.id);
            setLayoutName(pick.name);
            const st = ensureLayoutState(pick.state);
            setEditorState(st);
            setSavedBaseline({ name: pick.name.trim(), state: cloneLayoutState(st) });
            setLastSavedAt(null);
          }
        }
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Delete failed');
      } finally {
        setBusy(false);
      }
    },
    [token, id, layoutsFull, activeLayoutId, project, showError]
  );

  useEffect(() => {
    let t = searchParams.get('tab');
    if (t === 'pipeline') t = 'export';
    if (t === 'data') t = 'cards';
    if (t === 'cards' || t === 'layout' || t === 'layouts' || t === 'assets' || t === 'export') {
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
      hasPublishedSheet:
        Boolean(project.csvSourceUrl?.trim()) || anyCardGroupPublishedUrl,
      navigateTab,
      onNavigateHomeClick,
    });
    return () => setProjectViewNav(null);
  }, [
    id,
    project,
    anyCardGroupPublishedUrl,
    tab,
    navigateTab,
    onNavigateHomeClick,
    setProjectViewNav,
  ]);

  const onNavigateToProjectCardsClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      if (layoutIsDirty) {
        if (!window.confirm('You have unsaved changes. Leave the layout editor?')) return;
      }
      navigateTab('cards');
    },
    [layoutIsDirty, navigateTab]
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
      showError(err instanceof Error ? err.message : 'Save as failed');
    } finally {
      setBusy(false);
    }
  }, [token, id, layoutName, editorState, project, showError]);

  const exitLayoutEditor = useCallback(() => {
    if (layoutIsDirty) {
      const ok = window.confirm('You have unsaved changes. Leave the editor without saving?');
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

  const onExport = useCallback(async () => {
    if (!token || !id) return;
    setExportPdfLoading(true);
    setExportPdfStatus(null);
    try {
      await apiJson<{ queued: boolean; projectId: string; timestamp: string }>(
        `/api/projects/${id}/export-pdf`,
        { method: 'POST', token, body: JSON.stringify({ dpi: exportPdfDpi }) }
      );
      setExportPdfStatus(
        'Export queued — the PDF will show in the list below when the worker finishes (you can keep working).'
      );
      await loadPipeline();
      if (exportPollRef.current) {
        clearInterval(exportPollRef.current);
        exportPollRef.current = null;
      }
      let ticks = 0;
      exportPollRef.current = window.setInterval(() => {
        ticks += 1;
        void loadPipeline();
        if (ticks >= 15) {
          if (exportPollRef.current) clearInterval(exportPollRef.current);
          exportPollRef.current = null;
        }
      }, 8000);
      window.setTimeout(() => setExportPdfStatus(null), 12_000);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportPdfLoading(false);
    }
  }, [token, id, loadPipeline, exportPdfDpi, showError]);

  useEffect(() => {
    return () => {
      if (exportPollRef.current) {
        clearInterval(exportPollRef.current);
        exportPollRef.current = null;
      }
    };
  }, []);

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
      className={`page project-dashboard${tab === 'layout' ? ' project-dashboard--layout-tab' : ''}${tab === 'assets' ? ' project-dashboard--assets-tab' : ''}`}
    >
      {tab === 'cards' && (
        <>
          <section className="section cards-tab-section">
            <CardGroupsPanel
              projectId={id}
              token={token}
              layoutsFull={layoutsFull}
              assetUrls={mergedAssetUrls}
              assetResolveOrder={assetResolveOrder}
              busy={busy}
              onAnyPublishedUrlChange={setAnyCardGroupPublishedUrl}
              onError={(msg) => msg && showError(msg)}
              onOpenLayoutInEditor={openLayoutInEditor}
            />
          </section>
        </>
      )}

      {tab === 'layouts' && (
        <section className="section layouts-tab-section">
          <LayoutsListPanel
            layouts={layoutsFull.map((l) => ({
              id: l.id,
              name: l.name,
              lastUpdated: l.lastUpdated,
            }))}
            busy={busy}
            onError={(msg) => msg && showError(msg)}
            onOpenLayout={openLayoutInEditor}
            onCreateLayout={createLayoutFromList}
            onDeleteLayout={deleteLayout}
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
              assetUrls={mergedAssetUrls}
              deckPreviewOptions={deckPreviewOptions}
              activeLayoutId={activeLayoutId ?? undefined}
              onCapabilitiesChange={setEditorCaps}
              projectAssetArtKeys={assets.map((a) => a.artKey)}
              globalAssetArtKeys={globalAssets.map((a) => a.artKey)}
              projectId={id}
              token={token}
              layoutsFull={layoutsFull}
              projectAssets={assets}
              globalAssets={globalAssets}
              onStudioAssetsRefresh={() => void loadPipeline()}
            />
          )}
        </section>
      )}

      {tab === 'assets' && id && (
        <AssetsTabPanel
          projectId={id}
          token={token}
          busy={busy}
          projectAssets={assets}
          globalAssets={globalAssets}
          layoutsFull={layoutsFull}
          onRefresh={() => void loadPipeline()}
          onError={(msg) => showError(msg)}
        />
      )}

      {tab === 'export' && (
        <ExportTabPanel
          busy={busy}
          exportPdfLoading={exportPdfLoading}
          exportPdfStatus={exportPdfStatus}
          exportPdfDpi={exportPdfDpi}
          onExportPdfDpiChange={setExportPdfDpi}
          onExportPdf={() => void onExport()}
          exports={exports}
        />
      )}
    </div>
  );
}
