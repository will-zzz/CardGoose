import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  Globe,
  GripVertical,
  ImageOff,
  LayoutTemplate,
  Library,
  Loader2,
  Ratio,
  Search,
  Square,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { apiBase } from '../lib/api';
import {
  loadAssetFolderStore,
  newFolderId,
  saveAssetFolderStore,
  type AssetFolderScope,
  type AssetFolderStore,
  type StoredAssetFolder,
} from '../lib/assetFolderStorage';
import { normalizeArtLookupKey } from '../lib/assetResolve';
import { collectArtKeysFromLayoutState } from '../lib/layoutArtKeys';
import { Input } from './ui/input';

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
  /** When set, clicking an asset in the grid picks it (e.g. layout editor fallback modal). */
  artPickerMode?: boolean;
  onArtKeyPicked?: (artKey: string) => void;
};

type ViewKind =
  | { kind: 'all' }
  | { kind: 'unused' }
  | { kind: 'folder'; folderId: string };

type TreeNav = {
  scope: AssetFolderScope;
  view: ViewKind;
};

const ASSET_DRAG_MIME = 'application/x-cardgoose-asset';
const FOLDER_DRAG_MIME = 'application/x-cardgoose-folder';

function assignKey(scope: AssetFolderScope, assetId: string) {
  return `${scope}:${assetId}`;
}

function foldersByScope(store: AssetFolderStore, scope: AssetFolderScope): StoredAssetFolder[] {
  return store.folders.filter((f) => f.scope === scope);
}

function folderAncestorChainNames(
  store: AssetFolderStore,
  scope: AssetFolderScope,
  folderId: string
): string[] {
  const byId = new Map(foldersByScope(store, scope).map((f) => [f.id, f]));
  const names: string[] = [];
  let cur: string | null = folderId;
  while (cur) {
    const f = byId.get(cur);
    if (!f) break;
    names.push(f.name);
    cur = f.parentId;
  }
  names.reverse();
  return names;
}

/** Virtual path from folder hierarchy + art key, e.g. `/test_folder/will.png` */
function virtualAssetPath(asset: StudioAssetRow, scope: AssetFolderScope, store: AssetFolderStore): string {
  const fid = store.assignments[assignKey(scope, asset.id)];
  const segs = fid ? folderAncestorChainNames(store, scope, fid) : [];
  const leaf = asset.artKey.replace(/^\/+/, '');
  if (segs.length === 0) return `/${leaf}`;
  return `/${segs.join('/')}/${leaf}`;
}

/** True if `ancestorId` appears on the parent chain above `folderId` (cannot reparent `ancestorId` into `folderId`). */
function folderHasAncestor(
  store: AssetFolderStore,
  scope: AssetFolderScope,
  folderId: string,
  ancestorId: string
): boolean {
  const byId = new Map(foldersByScope(store, scope).map((f) => [f.id, f]));
  let cur = byId.get(folderId)?.parentId ?? null;
  while (cur) {
    if (cur === ancestorId) return true;
    cur = byId.get(cur)?.parentId ?? null;
  }
  return false;
}

type TreeDropTarget =
  | { kind: 'folder'; scope: AssetFolderScope; folderId: string }
  | { kind: 'library-root'; scope: AssetFolderScope };

export function AssetsTabPanel({
  projectId,
  token,
  busy,
  projectAssets,
  globalAssets,
  layoutsFull,
  onRefresh,
  onError,
  artPickerMode = false,
  onArtKeyPicked,
}: Props) {
  const [search, setSearch] = useState('');
  const [nav, setNav] = useState<TreeNav>({ scope: 'project', view: { kind: 'all' } });
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [thumbRatio, setThumbRatio] = useState<'square' | 'card'>('square');
  const [dropHover, setDropHover] = useState<string | null>(null);
  const [folderStore, setFolderStore] = useState<AssetFolderStore>(() =>
    loadAssetFolderStore(projectId)
  );
  const [expandedLibrary, setExpandedLibrary] = useState<Set<AssetFolderScope>>(
    () => new Set(['project', 'global'])
  );
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());
  const [dragDepth, setDragDepth] = useState(0);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  useEffect(() => {
    setFolderStore(loadAssetFolderStore(projectId));
  }, [projectId]);

  useEffect(() => {
    saveAssetFolderStore(projectId, folderStore);
  }, [projectId, folderStore]);

  const persistFolderStore = useCallback((updater: (prev: AssetFolderStore) => AssetFolderStore) => {
    setFolderStore(updater);
  }, []);

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

  const gridItems = useMemo((): StudioAssetRow[] => {
    const base = nav.scope === 'project' ? visibleProject : visibleGlobal;
    if (nav.view.kind === 'all') return base;
    if (nav.view.kind === 'unused') {
      return nav.scope === 'project' ? unusedProject : [];
    }
    const fid = nav.view.folderId;
    return base.filter((a) => folderStore.assignments[assignKey(nav.scope, a.id)] === fid);
  }, [nav, visibleProject, visibleGlobal, unusedProject, folderStore.assignments]);

  const selectAsset = (asset: StudioAssetRow) => {
    const prefix = nav.scope === 'project' ? 'p' : 'g';
    const idKey = `${prefix}:${asset.id}`;
    setSelection((prev) => {
      if (prev.size === 1 && prev.has(idKey)) return new Set();
      return new Set([idKey]);
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

  const selectedAsset = selectedProjectAsset ?? selectedGlobalAsset;

  const usageLayouts = useMemo(() => {
    const sel = selectedAsset;
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
  }, [selectedAsset, layoutsFull]);

  const childFolders = useCallback(
    (scope: AssetFolderScope, parentId: string | null) =>
      folderStore.folders.filter((f) => f.scope === scope && f.parentId === parentId),
    [folderStore.folders]
  );

  const setAssetFolderAssignment = useCallback(
    (scope: AssetFolderScope, assetId: string, folderId: string | '') => {
      const k = assignKey(scope, assetId);
      persistFolderStore((prev) => {
        const assignments = { ...prev.assignments };
        if (!folderId) delete assignments[k];
        else assignments[k] = folderId;
        return { ...prev, assignments };
      });
    },
    [persistFolderStore]
  );

  const selectedAssetScope: AssetFolderScope | null = selectedProjectAsset
    ? 'project'
    : selectedGlobalAsset
      ? 'global'
      : null;

  const selectedVirtualPath = useMemo(() => {
    if (!selectedAsset || !selectedAssetScope) return '';
    return virtualAssetPath(selectedAsset, selectedAssetScope, folderStore);
  }, [selectedAsset, selectedAssetScope, folderStore]);

  const treeAcceptsInternalDrag = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(ASSET_DRAG_MIME) || e.dataTransfer.types.includes(FOLDER_DRAG_MIME);

  const leaveDropHost = (e: React.DragEvent) => {
    const cur = e.currentTarget as HTMLElement;
    const rel = e.relatedTarget as Node | null;
    if (rel && cur.contains(rel)) return;
    setDropHover(null);
  };

  const handleTreeDrop = useCallback(
    (e: React.DragEvent, target: TreeDropTarget) => {
      e.preventDefault();
      e.stopPropagation();
      setDropHover(null);
      let raw = e.dataTransfer.getData(ASSET_DRAG_MIME);
      if (raw) {
        try {
          const { scope, assetId } = JSON.parse(raw) as { scope: AssetFolderScope; assetId: string };
          if (target.scope !== scope) return;
          if (target.kind === 'folder') {
            setAssetFolderAssignment(scope, assetId, target.folderId);
          } else {
            setAssetFolderAssignment(scope, assetId, '');
          }
        } catch {
          /* */
        }
        return;
      }
      raw = e.dataTransfer.getData(FOLDER_DRAG_MIME);
      if (!raw) return;
      try {
        const { scope, folderId } = JSON.parse(raw) as { scope: AssetFolderScope; folderId: string };
        if (target.scope !== scope) return;
        if (target.kind === 'folder') {
          if (folderId === target.folderId) return;
          persistFolderStore((prev) => {
            if (folderHasAncestor(prev, scope, target.folderId, folderId)) return prev;
            return {
              ...prev,
              folders: prev.folders.map((f) =>
                f.id === folderId && f.scope === scope ? { ...f, parentId: target.folderId } : f
              ),
            };
          });
        } else {
          persistFolderStore((prev) => ({
            ...prev,
            folders: prev.folders.map((f) =>
              f.id === folderId && f.scope === scope ? { ...f, parentId: null } : f
            ),
          }));
        }
      } catch {
        /* */
      }
    },
    [setAssetFolderAssignment, persistFolderStore]
  );

  const onAssetDragStart = (e: React.DragEvent, scope: AssetFolderScope, assetId: string) => {
    e.dataTransfer.setData(ASSET_DRAG_MIME, JSON.stringify({ scope, assetId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onFolderDragStart = (e: React.DragEvent, scope: AssetFolderScope, folderId: string) => {
    e.dataTransfer.setData(FOLDER_DRAG_MIME, JSON.stringify({ scope, folderId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  async function uploadFiles(files: FileList | null, target: AssetFolderScope) {
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

  const onGridDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes('Files')) return;
    setDragDepth((d) => d + 1);
    setIsDraggingFiles(true);
  };

  const onGridDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragDepth((d) => {
      const next = Math.max(0, d - 1);
      if (next === 0) setIsDraggingFiles(false);
      return next;
    });
  };

  const onGridDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const onGridDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragDepth(0);
    setIsDraggingFiles(false);
    void uploadFiles(e.dataTransfer.files, nav.scope);
  };

  const toggleLibrary = (scope: AssetFolderScope) => {
    setExpandedLibrary((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  };

  const toggleFolderExpand = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const newFolderUnderActive = () => {
    const name = window.prompt('Folder name', 'New folder')?.trim();
    if (!name) return;
    const scope = nav.scope;
    let parentId: string | null = null;
    if (nav.view.kind === 'folder') parentId = nav.view.folderId;
    const id = newFolderId();
    persistFolderStore((prev) => ({
      ...prev,
      folders: [...prev.folders, { id, parentId, name, scope }],
    }));
    setExpandedLibrary((s) => new Set(s).add(scope));
    if (parentId) {
      setExpandedFolders((s) => new Set(s).add(parentId));
    }
    setNav({ scope, view: { kind: 'folder', folderId: id } });
  };

  const dropKeyFolder = (scope: AssetFolderScope, folderId: string) => `folder:${scope}:${folderId}`;

  const renderFolderSubtree = (scope: AssetFolderScope, parentId: string | null, depth: number) => {
    const rows = childFolders(scope, parentId)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return rows.map((f) => {
      const isOpen = expandedFolders.has(f.id);
      const hasChildren = childFolders(scope, f.id).length > 0;
      const active =
        nav.scope === scope && nav.view.kind === 'folder' && nav.view.folderId === f.id;
      const dk = dropKeyFolder(scope, f.id);
      return (
        <div key={f.id}>
          <div
            className={`assets-shell-tree-folder-drop${dropHover === dk ? ' assets-shell-tree-drop-host--hover' : ''}`}
            onDragEnter={() => setDropHover(dk)}
            onDragOver={(e) => {
              if (treeAcceptsInternalDrag(e)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }
            }}
            onDragLeave={leaveDropHost}
            onDrop={(e) => handleTreeDrop(e, { kind: 'folder', scope, folderId: f.id })}
          >
            <div
              className={`assets-shell-tree-row${active ? ' assets-shell-tree-row--active' : ''}`}
              style={{ paddingLeft: 8 + depth * 14 }}
            >
              <span
                className="assets-shell-folder-grip assets-shell-ctrl"
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  onFolderDragStart(e, scope, f.id);
                }}
                title="Drag to move folder"
                role="presentation"
              >
                <GripVertical size={14} aria-hidden />
              </span>
              {hasChildren ? (
                <button
                  type="button"
                  className="assets-shell-tree-chev assets-shell-ctrl"
                  aria-expanded={isOpen}
                  aria-label={isOpen ? 'Collapse' : 'Expand'}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    toggleFolderExpand(f.id);
                  }}
                >
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <span className="assets-shell-tree-chev-spacer" aria-hidden />
              )}
              <button
                type="button"
                className="assets-shell-tree-label assets-shell-ctrl"
                onClick={() => setNav({ scope, view: { kind: 'folder', folderId: f.id } })}
              >
                <Folder size={14} className="assets-shell-tree-ico" aria-hidden />
                <span className="assets-shell-tree-text">{f.name}</span>
              </button>
            </div>
          </div>
          {isOpen && hasChildren && (
            <div>{renderFolderSubtree(scope, f.id, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  const thumbClass =
    thumbRatio === 'square'
      ? 'assets-shell-thumb assets-shell-thumb--square'
      : 'assets-shell-thumb assets-shell-thumb--card';

  return (
    <div className="assets-shell">
      <aside className="assets-shell-sidebar" aria-label="Libraries and folders">
        <div className="assets-shell-sidebar-brand">
          <Library size={16} aria-hidden />
          <span>Library</span>
        </div>

        <nav className="assets-shell-tree" aria-label="Folder hierarchy">
          <div className="assets-shell-tree-block">
            <div
              className={`assets-shell-tree-root-drop${dropHover === 'libroot:project' ? ' assets-shell-tree-drop-host--hover' : ''}`}
              onDragEnter={() => setDropHover('libroot:project')}
              onDragOver={(e) => {
                if (treeAcceptsInternalDrag(e)) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }
              }}
              onDragLeave={leaveDropHost}
              onDrop={(e) => handleTreeDrop(e, { kind: 'library-root', scope: 'project' })}
            >
              <div
                className={`assets-shell-tree-row assets-shell-tree-row--root${nav.scope === 'project' ? ' assets-shell-tree-row--scope-on' : ''}`}
              >
                <button
                  type="button"
                  className="assets-shell-tree-chev assets-shell-ctrl"
                  aria-expanded={expandedLibrary.has('project')}
                  aria-label={expandedLibrary.has('project') ? 'Collapse' : 'Expand'}
                  onClick={() => toggleLibrary('project')}
                >
                  {expandedLibrary.has('project') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <button
                  type="button"
                  className="assets-shell-tree-label assets-shell-ctrl"
                  onClick={() => {
                    setNav({ scope: 'project', view: { kind: 'all' } });
                    setExpandedLibrary((s) => new Set(s).add('project'));
                  }}
                >
                  <Box size={14} className="assets-shell-tree-ico" aria-hidden />
                  <span className="assets-shell-tree-text">Project assets</span>
                </button>
              </div>
            </div>
            {expandedLibrary.has('project') && (
              <div className="assets-shell-tree-nested">
                <div
                  className={`assets-shell-tree-leaf-drop${dropHover === 'all:project' ? ' assets-shell-tree-drop-host--hover' : ''}`}
                  onDragEnter={() => setDropHover('all:project')}
                  onDragOver={(e) => {
                    if (treeAcceptsInternalDrag(e)) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }
                  }}
                  onDragLeave={leaveDropHost}
                  onDrop={(e) => handleTreeDrop(e, { kind: 'library-root', scope: 'project' })}
                >
                  <button
                    type="button"
                    className={`assets-shell-tree-leaf assets-shell-ctrl${nav.scope === 'project' && nav.view.kind === 'all' ? ' assets-shell-tree-row--active' : ''}`}
                    style={{ paddingLeft: 36 }}
                    onClick={() => setNav({ scope: 'project', view: { kind: 'all' } })}
                  >
                    <Folder size={14} className="assets-shell-tree-ico" aria-hidden />
                    All assets
                  </button>
                </div>
                <div
                  className={`assets-shell-tree-leaf-drop${dropHover === 'unused:project' ? ' assets-shell-tree-drop-host--hover' : ''}`}
                  onDragEnter={() => setDropHover('unused:project')}
                  onDragOver={(e) => {
                    if (treeAcceptsInternalDrag(e)) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }
                  }}
                  onDragLeave={leaveDropHost}
                  onDrop={(e) => handleTreeDrop(e, { kind: 'library-root', scope: 'project' })}
                >
                  <button
                    type="button"
                    className={`assets-shell-tree-leaf assets-shell-ctrl${nav.scope === 'project' && nav.view.kind === 'unused' ? ' assets-shell-tree-row--active' : ''}`}
                    style={{ paddingLeft: 36 }}
                    onClick={() => setNav({ scope: 'project', view: { kind: 'unused' } })}
                  >
                    <ImageOff size={14} className="assets-shell-tree-ico" aria-hidden />
                    Unused
                    <span className="assets-shell-tree-count">{unusedProject.length}</span>
                  </button>
                </div>
                {renderFolderSubtree('project', null, 1)}
              </div>
            )}
          </div>

          <div className="assets-shell-tree-block">
            <div
              className={`assets-shell-tree-root-drop${dropHover === 'libroot:global' ? ' assets-shell-tree-drop-host--hover' : ''}`}
              onDragEnter={() => setDropHover('libroot:global')}
              onDragOver={(e) => {
                if (treeAcceptsInternalDrag(e)) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }
              }}
              onDragLeave={leaveDropHost}
              onDrop={(e) => handleTreeDrop(e, { kind: 'library-root', scope: 'global' })}
            >
              <div
                className={`assets-shell-tree-row assets-shell-tree-row--root${nav.scope === 'global' ? ' assets-shell-tree-row--scope-on' : ''}`}
              >
                <button
                  type="button"
                  className="assets-shell-tree-chev assets-shell-ctrl"
                  aria-expanded={expandedLibrary.has('global')}
                  aria-label={expandedLibrary.has('global') ? 'Collapse' : 'Expand'}
                  onClick={() => toggleLibrary('global')}
                >
                  {expandedLibrary.has('global') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <button
                  type="button"
                  className="assets-shell-tree-label assets-shell-ctrl"
                  onClick={() => {
                    setNav({ scope: 'global', view: { kind: 'all' } });
                    setExpandedLibrary((s) => new Set(s).add('global'));
                  }}
                >
                  <Globe size={14} className="assets-shell-tree-ico" aria-hidden />
                  <span className="assets-shell-tree-text">Global library</span>
                </button>
              </div>
            </div>
            {expandedLibrary.has('global') && (
              <div className="assets-shell-tree-nested">
                <div
                  className={`assets-shell-tree-leaf-drop${dropHover === 'all:global' ? ' assets-shell-tree-drop-host--hover' : ''}`}
                  onDragEnter={() => setDropHover('all:global')}
                  onDragOver={(e) => {
                    if (treeAcceptsInternalDrag(e)) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }
                  }}
                  onDragLeave={leaveDropHost}
                  onDrop={(e) => handleTreeDrop(e, { kind: 'library-root', scope: 'global' })}
                >
                  <button
                    type="button"
                    className={`assets-shell-tree-leaf assets-shell-ctrl${nav.scope === 'global' && nav.view.kind === 'all' ? ' assets-shell-tree-row--active' : ''}`}
                    style={{ paddingLeft: 36 }}
                    onClick={() => setNav({ scope: 'global', view: { kind: 'all' } })}
                  >
                    <Folder size={14} className="assets-shell-tree-ico" aria-hidden />
                    All assets
                  </button>
                </div>
                {renderFolderSubtree('global', null, 1)}
              </div>
            )}
          </div>
        </nav>

        <div className="assets-shell-sidebar-foot">
          <button
            type="button"
            className="assets-shell-foot-btn assets-shell-ctrl"
            onClick={newFolderUnderActive}
          >
            <FolderPlus size={14} aria-hidden />
            New folder
          </button>
        </div>
      </aside>

      <div className="assets-shell-center">
        <header className="assets-shell-toolbar">
          <div className="assets-shell-toolbar-search">
            <Search size={15} className="assets-shell-toolbar-search-ico" aria-hidden />
            <Input
              type="search"
              className="assets-shell-search-input"
              placeholder="Search art key, filename, path…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="assets-shell-toolbar-tools">
            <span className="assets-shell-toolbar-label">Thumbnails</span>
            <button
              type="button"
              title="Square thumbnails"
              className={`assets-shell-tool-ico assets-shell-ctrl${thumbRatio === 'square' ? ' assets-shell-tool-ico--on' : ''}`}
              onClick={() => setThumbRatio('square')}
            >
              <Square size={18} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              title="Card aspect ratio"
              className={`assets-shell-tool-ico assets-shell-ctrl${thumbRatio === 'card' ? ' assets-shell-tool-ico--on' : ''}`}
              onClick={() => setThumbRatio('card')}
            >
              <Ratio size={18} strokeWidth={1.75} />
            </button>
            <span className="assets-shell-toolbar-divider" aria-hidden />
            <button
              type="button"
              title="Delete selected"
              className="assets-shell-tool-ico assets-shell-tool-ico--danger assets-shell-ctrl"
              disabled={selection.size === 0 || busy}
              onClick={() => void deleteSelected()}
            >
              <Trash2 size={18} strokeWidth={1.75} />
            </button>
          </div>
        </header>

        <div
          className={`assets-shell-gallery${isDraggingFiles ? ' assets-shell-gallery--drag-active' : ''}`}
          onDragEnter={onGridDragEnter}
          onDragLeave={onGridDragLeave}
          onDragOver={onGridDragOver}
          onDrop={onGridDrop}
          role="region"
          aria-label="Asset grid and upload drop zone"
        >
          {!isDraggingFiles && (
            <p className="assets-shell-drop-ghost">
              Drag files here to upload to the {nav.scope === 'project' ? 'project' : 'global'} library.
            </p>
          )}
          {isDraggingFiles && (
            <div className="assets-shell-drop-overlay" aria-live="polite">
              <UploadCloud size={28} strokeWidth={1.5} aria-hidden />
              <span>Drop to upload</span>
            </div>
          )}
          <div className="assets-shell-grid">
            {gridItems.map((a) => {
              const idKey = `${nav.scope === 'project' ? 'p' : 'g'}:${a.id}`;
              const selected = selection.has(idKey);
              return (
                <button
                  key={idKey}
                  type="button"
                  draggable={!artPickerMode}
                  className={`assets-shell-cell assets-shell-ctrl${selected ? ' assets-shell-cell--selected' : ''}`}
                  onClick={() => {
                    if (artPickerMode && onArtKeyPicked) {
                      onArtKeyPicked(a.artKey);
                      return;
                    }
                    selectAsset(a);
                  }}
                  onDragStart={
                    artPickerMode
                      ? undefined
                      : (e) => onAssetDragStart(e, nav.scope, a.id)
                  }
                >
                  <div className={thumbClass}>
                    {a.url ? <img src={a.url} alt="" loading="lazy" /> : <span className="assets-shell-no-prev">No preview</span>}
                  </div>
                  <div className="assets-shell-cell-label" title={a.artKey}>
                    {a.artKey}
                  </div>
                </button>
              );
            })}
          </div>
          {gridItems.length === 0 && !isDraggingFiles && (
            <p className="assets-shell-empty">
              {nav.view.kind === 'folder'
                ? 'This folder is empty. Drag assets here from the gallery, or choose another folder.'
                : 'No assets match this view.'}
            </p>
          )}
        </div>
      </div>

      <aside className="assets-shell-inspector" aria-label="Asset details">
        <div className="assets-shell-inspector-head">
          <LayoutTemplate size={14} aria-hidden />
          Inspector
        </div>
        {!selectedAsset && (
          <p className="assets-shell-inspector-empty">Select an asset to inspect metadata and usage.</p>
        )}
        {selectedAsset && (
          <>
            <div className="assets-shell-preview">
              {selectedAsset.url ? (
                <img src={selectedAsset.url} alt="" className="assets-shell-preview-img" />
              ) : (
                <span className="assets-shell-no-prev">No signed URL</span>
              )}
            </div>
            <div className="assets-shell-inspector-title">{selectedAsset.artKey}</div>
            <div className="assets-shell-resource-path" title={selectedVirtualPath}>
              {selectedVirtualPath}
            </div>

            {selectedProjectAsset && (
              <button
                type="button"
                className="assets-shell-promote assets-shell-ctrl"
                disabled={busy}
                onClick={() => void promoteSelected()}
              >
                {busy ? <Loader2 size={16} className="assets-shell-spin" /> : <Globe size={16} aria-hidden />}
                Make global
              </button>
            )}

            <div className="assets-shell-usage-block">
              <div className="assets-shell-usage-head">
                <LayoutTemplate size={14} aria-hidden />
                Used in layouts
              </div>
              {usageLayouts.length === 0 ? (
                <p className="assets-shell-usage-empty">No layout image zones reference this art key.</p>
              ) : (
                <ul className="assets-shell-usage-list">
                  {usageLayouts.map((L) => (
                    <li key={L.id}>
                      <LayoutTemplate size={12} className="assets-shell-usage-li-ico" aria-hidden />
                      <span title={L.name}>{L.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
