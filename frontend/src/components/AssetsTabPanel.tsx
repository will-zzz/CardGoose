import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiBase } from '../lib/api';
import { normalizeArtLookupKey } from '../lib/assetResolve';
import { collectArtKeysFromLayoutState } from '../lib/layoutArtKeys';

export type StudioAssetRow = {
  id: string;
  artKey: string;
  s3Key: string;
  url?: string;
};

type LayoutLite = { id: string; name: string; state: unknown };

type Props = {
  projectId: string;
  token: string | null;
  busy: boolean;
  projectAssets: StudioAssetRow[];
  globalAssets: StudioAssetRow[];
  layoutsFull: LayoutLite[];
  onRefresh: () => void;
  onError: (msg: string) => void;
};

type Scope = 'project' | 'global';

const GLOBAL_VISIBILITY_KEY = 'cardgoose.assets.showGlobal';

export function AssetsTabPanel({
  projectId,
  token,
  busy,
  projectAssets,
  globalAssets,
  layoutsFull,
  onRefresh,
  onError,
}: Props) {
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<Scope>('project');
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [lastClicked, setLastClicked] = useState<string | null>(null);
  const [thumbRatio, setThumbRatio] = useState<'square' | 'card'>('square');
  const [showGlobal, setShowGlobal] = useState(() => {
    try {
      return localStorage.getItem(GLOBAL_VISIBILITY_KEY) !== '0';
    } catch {
      return true;
    }
  });

  const setShowGlobalPersist = useCallback((v: boolean) => {
    setShowGlobal(v);
    try {
      localStorage.setItem(GLOBAL_VISIBILITY_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!showGlobal && scope === 'global') setScope('project');
  }, [showGlobal, scope]);

  const filter = useCallback(
    (rows: StudioAssetRow[]) => {
      const q = search.trim().toLowerCase();
      if (!q) return rows;
      return rows.filter(
        (r) =>
          r.artKey.toLowerCase().includes(q) ||
          r.s3Key.toLowerCase().includes(q) ||
          normalizeArtLookupKey(r.artKey).includes(q)
      );
    },
    [search]
  );

  const visibleProject = useMemo(() => filter(projectAssets), [filter, projectAssets]);
  const visibleGlobal = useMemo(() => filter(globalAssets), [filter, globalAssets]);

  const usedNormalizedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const L of layoutsFull) {
      for (const k of collectArtKeysFromLayoutState(L.state)) {
        s.add(normalizeArtLookupKey(k));
      }
    }
    return s;
  }, [layoutsFull]);

  const unusedProject = useMemo(
    () => visibleProject.filter((a) => !usedNormalizedKeys.has(normalizeArtLookupKey(a.artKey))),
    [visibleProject, usedNormalizedKeys]
  );

  const [projectFolder, setProjectFolder] = useState<'all' | 'unused'>('all');

  const gridItems =
    scope === 'project'
      ? projectFolder === 'unused'
        ? unusedProject
        : visibleProject
      : visibleGlobal;

  const toggleSelect = (asset: StudioAssetRow, e: React.MouseEvent, list: StudioAssetRow[]) => {
    e.preventDefault();
    const prefix = scope === 'project' ? 'p' : 'g';
    const idKey = `${prefix}:${asset.id}`;
    if (e.shiftKey && lastClicked) {
      const i0 = list.findIndex((x) => `${prefix}:${x.id}` === lastClicked);
      const i1 = list.findIndex((x) => x.id === asset.id);
      if (i0 >= 0 && i1 >= 0) {
        const [lo, hi] = i0 < i1 ? [i0, i1] : [i1, i0];
        const next = new Set(selection);
        for (let i = lo; i <= hi; i++) next.add(`${prefix}:${list[i].id}`);
        setSelection(next);
        setLastClicked(idKey);
        return;
      }
    }
    setLastClicked(idKey);
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(idKey)) next.delete(idKey);
      else next.add(idKey);
      return next;
    });
  };

  const selectedProjectAsset = useMemo(() => {
    for (const id of selection) {
      if (!id.startsWith('p:')) continue;
      const rid = id.slice(2);
      const a = projectAssets.find((x) => x.id === rid);
      if (a) return a;
    }
    return null;
  }, [selection, projectAssets]);

  const selectedGlobalAsset = useMemo(() => {
    for (const id of selection) {
      if (!id.startsWith('g:')) continue;
      const rid = id.slice(2);
      const a = globalAssets.find((x) => x.id === rid);
      if (a) return a;
    }
    return null;
  }, [selection, globalAssets]);

  const usageLayouts = useMemo(() => {
    const sel = selectedProjectAsset ?? selectedGlobalAsset;
    if (!sel) return [];
    const nk = normalizeArtLookupKey(sel.artKey);
    const out: { id: string; name: string }[] = [];
    for (const L of layoutsFull) {
      const keys = collectArtKeysFromLayoutState(L.state);
      if (keys.some((k) => normalizeArtLookupKey(k) === nk)) {
        out.push({ id: L.id, name: L.name });
      }
    }
    return out;
  }, [selectedProjectAsset, selectedGlobalAsset, layoutsFull]);

  async function uploadFiles(files: FileList | null, target: Scope) {
    if (!token || !files?.length) return;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      const path =
        target === 'project'
          ? `${apiBase()}/api/projects/${projectId}/assets`
          : `${apiBase()}/api/user/global-assets`;
      const res = await fetch(path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (!res.ok) {
        onError((data as { error?: string })?.error ?? res.statusText);
        return;
      }
    }
    onRefresh();
  }

  async function promoteSelected() {
    if (!token || !selectedProjectAsset) return;
    const res = await fetch(
      `${apiBase()}/api/projects/${projectId}/assets/${selectedProjectAsset.id}/promote-global`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
    );
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      onError((data as { error?: string })?.error ?? res.statusText);
      return;
    }
    setSelection(new Set());
    onRefresh();
  }

  async function deleteSelected() {
    if (!token || selection.size === 0) return;
    if (!window.confirm(`Delete ${selection.size} asset(s)?`)) return;
    for (const id of selection) {
      if (id.startsWith('p:')) {
        const res = await fetch(`${apiBase()}/api/projects/${projectId}/assets/${id.slice(2)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const t = await res.text();
          let err = res.statusText;
          try {
            err = JSON.parse(t).error ?? err;
          } catch {
            /* */
          }
          onError(err);
          return;
        }
      } else if (id.startsWith('g:')) {
        const res = await fetch(`${apiBase()}/api/user/global-assets/${id.slice(2)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          onError('Delete global asset failed');
          return;
        }
      }
    }
    setSelection(new Set());
    onRefresh();
  }

  const onGridDrop = (e: React.DragEvent) => {
    e.preventDefault();
    void uploadFiles(e.dataTransfer.files, scope);
  };

  const thumbClass =
    thumbRatio === 'square' ? 'assets-dam-thumb assets-dam-thumb--square' : 'assets-dam-thumb assets-dam-thumb--card';

  return (
    <div className="assets-dam">
      <aside className="assets-dam-sidebar" aria-label="Asset folders">
        <div className="assets-dam-sidebar-head">Library</div>
        <button
          type="button"
          className={`assets-dam-tree-item${scope === 'project' ? ' assets-dam-tree-item--active' : ''}`}
          onClick={() => setScope('project')}
        >
          Project assets
        </button>
        {showGlobal && (
          <button
            type="button"
            className={`assets-dam-tree-item${scope === 'global' ? ' assets-dam-tree-item--active' : ''}`}
            onClick={() => setScope('global')}
          >
            Global library
          </button>
        )}
        {scope === 'project' && (
          <>
            <button
              type="button"
              className={`assets-dam-tree-item${projectFolder === 'all' ? ' assets-dam-tree-item--active' : ''}`}
              onClick={() => setProjectFolder('all')}
            >
              All assets
            </button>
            <button
              type="button"
              className={`assets-dam-tree-item${projectFolder === 'unused' ? ' assets-dam-tree-item--active' : ''}`}
              onClick={() => setProjectFolder('unused')}
            >
              Unused ({unusedProject.length})
            </button>
          </>
        )}
        <div className="assets-dam-sidebar-actions">
          <button type="button" className="link-btn" disabled title="Folders coming soon">
            New folder
          </button>
          <label className="assets-dam-toggle">
            <input
              type="checkbox"
              checked={showGlobal}
              onChange={(e) => setShowGlobalPersist(e.target.checked)}
            />
            Show global library
          </label>
        </div>
      </aside>

      <section
        className="assets-dam-gallery"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onGridDrop}
        aria-label="Asset gallery"
      >
        <div className="assets-dam-toolbar">
          <input
            type="search"
            className="assets-dam-search"
            placeholder="Search by art key, filename, or path…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="assets-dam-toolbar-right">
            <span className="muted">Thumbnails</span>
            <button
              type="button"
              className={thumbRatio === 'square' ? 'assets-dam-chip assets-dam-chip--on' : 'assets-dam-chip'}
              onClick={() => setThumbRatio('square')}
            >
              Square
            </button>
            <button
              type="button"
              className={thumbRatio === 'card' ? 'assets-dam-chip assets-dam-chip--on' : 'assets-dam-chip'}
              onClick={() => setThumbRatio('card')}
            >
              Card ratio
            </button>
            <button type="button" disabled={selection.size === 0 || busy} onClick={() => void deleteSelected()}>
              Delete selected
            </button>
          </div>
        </div>
        <p className="muted assets-dam-drop-hint">Drop files here to upload to the {scope} library.</p>
        <div className="assets-dam-grid">
          {gridItems.map((a) => {
            const idKey = `${scope === 'project' ? 'p' : 'g'}:${a.id}`;
            const selected = selection.has(idKey);
            return (
              <button
                key={idKey}
                type="button"
                className={`assets-dam-cell${selected ? ' assets-dam-cell--selected' : ''}`}
                onClick={(e) => toggleSelect(a, e, gridItems)}
              >
                <div className={thumbClass}>
                  {a.url ? (
                    <img src={a.url} alt="" loading="lazy" />
                  ) : (
                    <span className="muted">No preview</span>
                  )}
                </div>
                <div className="assets-dam-cell-label" title={a.artKey}>
                  {a.artKey}
                </div>
              </button>
            );
          })}
        </div>
        {gridItems.length === 0 && <p className="muted">No assets match this filter.</p>}
      </section>

      <aside className="assets-dam-inspector" aria-label="Asset details">
        <div className="assets-dam-inspector-head">Inspector</div>
        {!selectedProjectAsset && !selectedGlobalAsset && (
          <p className="muted">Select an asset to preview and manage.</p>
        )}
        {(selectedProjectAsset || selectedGlobalAsset) && (
          <>
            <div className="assets-dam-preview">
              {(selectedProjectAsset ?? selectedGlobalAsset)?.url ? (
                <img
                  src={(selectedProjectAsset ?? selectedGlobalAsset)!.url}
                  alt=""
                  className="assets-dam-preview-img"
                />
              ) : (
                <p className="muted">No signed URL</p>
              )}
            </div>
            <p>
              <strong>{(selectedProjectAsset ?? selectedGlobalAsset)!.artKey}</strong>
            </p>
            <p className="muted mono small">{(selectedProjectAsset ?? selectedGlobalAsset)!.s3Key}</p>
            {selectedProjectAsset && (
              <button type="button" className="assets-dam-promote" disabled={busy} onClick={() => void promoteSelected()}>
                Make global
              </button>
            )}
            <h4 className="assets-dam-usage-title">Used in layouts</h4>
            {usageLayouts.length === 0 ? (
              <p className="muted">No layout image zones reference this key.</p>
            ) : (
              <ul className="assets-dam-usage-list">
                {usageLayouts.map((L) => (
                  <li key={L.id}>
                    <span title={L.name}>{L.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
