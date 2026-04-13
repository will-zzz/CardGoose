import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  FileSpreadsheet,
  FolderPlus,
  LayoutTemplate,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { apiJson } from '../lib/api';
import { CardFace } from './CardFace';
import { Input } from './ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { defaultLayoutState, ensureLayoutState, type LayoutStateV2 } from '../types/layout';

type CsvData = { headers: string[]; rows: Record<string, string>[] };
type LayoutFull = { id: string; name: string; lastUpdated: string; state: unknown };

export type CardGroupDto = {
  id: string;
  name: string;
  layoutId: string | null;
  sortOrder: number;
  csvSourceUrl: string | null;
  /** Tab name etc., from export filename when server could parse Content-Disposition */
  dataSourceLabel?: string | null;
  csvData: CsvData | null;
  updatedAt?: string;
};

function hasCsvReady(g: CardGroupDto): boolean {
  return Boolean(g.csvData && Array.isArray(g.csvData.headers) && g.csvData.headers.length > 0);
}

function canPreview(g: CardGroupDto): boolean {
  return Boolean(
    g.layoutId && g.csvData && Array.isArray(g.csvData.headers) && g.csvData.headers.length > 0
  );
}

function isGroupReady(g: CardGroupDto): boolean {
  return Boolean(g.layoutId && hasCsvReady(g));
}

function formatSyncedShort(iso: string): string {
  const t = Date.now() - new Date(iso).getTime();
  const s = Math.floor(t / 1000);
  if (s < 15) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function sheetConnectionLabel(g: CardGroupDto, hasCsv: boolean): string {
  if (!g.csvSourceUrl) return 'Not connected';
  if (!hasCsv) return 'Pending sync…';
  const label = g.dataSourceLabel?.trim();
  if (label) return label;
  try {
    const u = new URL(g.csvSourceUrl);
    const host = u.hostname.replace(/^www\./, '');
    if (host.length > 28) return `${host.slice(0, 25)}…`;
    return host;
  } catch {
    return 'Connected';
  }
}

function layoutName(layouts: LayoutFull[], id: string | null): string {
  if (!id) return 'Choose layout';
  return layouts.find((l) => l.id === id)?.name ?? 'Layout';
}

export function CardGroupsPanel(props: {
  projectId: string;
  token: string | null;
  layoutsFull: LayoutFull[];
  assetUrls: Record<string, string>;
  /** Project art keys first, then global — for layout image fuzzy matching in previews. */
  assetResolveOrder?: string[];
  /** Project-wide busy (e.g. layout save); card-group mutations use internal state so previews don’t thrash. */
  busy: boolean;
  /** Fired when group list implies at least one published CSV URL (for studio chrome). */
  onAnyPublishedUrlChange?: (hasAny: boolean) => void;
  onError: (msg: string | null) => void;
  onOpenLayoutInEditor: (layoutId: string) => void;
}) {
  const {
    projectId,
    token,
    layoutsFull,
    assetUrls,
    assetResolveOrder = [],
    busy,
    onAnyPublishedUrlChange,
    onError,
    onOpenLayoutInEditor,
  } = props;

  const [groups, setGroups] = useState<CardGroupDto[]>([]);
  /** Mutations inside this panel only — avoids lifting `setBusy` to ProjectPage and re-rendering the whole page. */
  const [panelBusy, setPanelBusy] = useState(false);
  const opsBusy = busy || panelBusy;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  /** Which card group has the data source URL popover open (same pattern as layout dropdown). */
  const [dataSourceMenuGroupId, setDataSourceMenuGroupId] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState('');
  /** Group ids whose gallery is collapsed (default: expanded) */
  const [collapsedGalleryIds, setCollapsedGalleryIds] = useState<Set<string>>(() => new Set());
  const titleInputRef = useRef<HTMLInputElement>(null);

  const loadGroups = useCallback(async () => {
    if (!token || !projectId) return;
    setLoading(true);
    onError(null);
    try {
      const res = await apiJson<{ cardGroups: CardGroupDto[] }>(
        `/api/projects/${projectId}/card-groups`,
        { token }
      );
      setGroups(res.cardGroups);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load card groups');
    } finally {
      setLoading(false);
    }
  }, [token, projectId, onError]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    onAnyPublishedUrlChange?.(groups.some((g) => Boolean(g.csvSourceUrl?.trim())));
  }, [groups, onAnyPublishedUrlChange]);

  useEffect(() => {
    if (editingTitleId && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitleId]);

  const createGroup = useCallback(async () => {
    if (!token) return;
    setPanelBusy(true);
    onError(null);
    try {
      const res = await apiJson<{ cardGroup: CardGroupDto }>(
        `/api/projects/${projectId}/card-groups`,
        { method: 'POST', token, body: JSON.stringify({ name: 'New group' }) }
      );
      setGroups((prev) => [...prev, res.cardGroup].sort((a, b) => a.sortOrder - b.sortOrder));
      setEditingTitleId(res.cardGroup.id);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to create group');
    } finally {
      setPanelBusy(false);
    }
  }, [token, projectId, onError]);

  const updateGroup = useCallback(
    async (groupId: string, body: Record<string, unknown>) => {
      if (!token) return;
      setPanelBusy(true);
      onError(null);
      try {
        const res = await apiJson<{ cardGroup: CardGroupDto }>(
          `/api/projects/${projectId}/card-groups/${groupId}`,
          { method: 'PUT', token, body: JSON.stringify(body) }
        );
        setGroups((prev) => prev.map((g) => (g.id === groupId ? res.cardGroup : g)));
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Update failed');
      } finally {
        setPanelBusy(false);
      }
    },
    [token, projectId, onError]
  );

  const deleteGroup = useCallback(
    async (groupId: string) => {
      if (!token) return;
      if (!window.confirm('Delete this card group?')) return;
      setPanelBusy(true);
      onError(null);
      try {
        await apiJson(`/api/projects/${projectId}/card-groups/${groupId}`, {
          method: 'DELETE',
          token,
        });
        setGroups((prev) => prev.filter((g) => g.id !== groupId));
        if (dataSourceMenuGroupId === groupId) setDataSourceMenuGroupId(null);
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Delete failed');
      } finally {
        setPanelBusy(false);
      }
    },
    [token, projectId, onError, dataSourceMenuGroupId]
  );

  const duplicateGroup = useCallback(
    async (groupId: string) => {
      if (!token) return;
      setPanelBusy(true);
      onError(null);
      try {
        const res = await apiJson<{ cardGroup: CardGroupDto }>(
          `/api/projects/${projectId}/card-groups/${groupId}/duplicate`,
          { method: 'POST', token }
        );
        setGroups((prev) => [...prev, res.cardGroup].sort((a, b) => a.sortOrder - b.sortOrder));
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Duplicate failed');
      } finally {
        setPanelBusy(false);
      }
    },
    [token, projectId, onError]
  );

  const refreshGroupCsv = useCallback(
    async (groupId: string, url: string | null) => {
      if (!token || !url?.trim()) return;
      setPanelBusy(true);
      onError(null);
      try {
        const res = await apiJson<{ cardGroup: CardGroupDto }>(
          `/api/projects/${projectId}/card-groups/${groupId}/csv/refresh`,
          { method: 'POST', token, body: JSON.stringify({ url: url.trim() }) }
        );
        setGroups((prev) => prev.map((g) => (g.id === groupId ? res.cardGroup : g)));
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Refresh failed');
      } finally {
        setPanelBusy(false);
      }
    },
    [token, projectId, onError]
  );

  const saveDataSourceUrl = useCallback(
    async (groupId: string) => {
      const trimmed = urlDraft.trim();
      await updateGroup(groupId, { csvSourceUrl: trimmed || null });
      setDataSourceMenuGroupId(null);
    },
    [urlDraft, updateGroup]
  );

  const cancelDataSourceUrl = useCallback(() => {
    setDataSourceMenuGroupId(null);
    void loadGroups();
  }, [loadGroups]);

  const toggleGallery = useCallback((groupId: string) => {
    setCollapsedGalleryIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const layoutStateById = useMemo(() => {
    const m = new Map<string, LayoutStateV2>();
    for (const l of layoutsFull) {
      m.set(l.id, ensureLayoutState(l.state));
    }
    return m;
  }, [layoutsFull]);

  const query = search.trim().toLowerCase();

  const filteredRowsForGroup = useCallback(
    (g: CardGroupDto) => {
      const rows = g.csvData?.rows ?? [];
      if (!query) return rows.map((row, i) => ({ row, i }));
      return rows
        .map((row, i) => ({ row, i }))
        .filter(({ row }) => {
          const blob = Object.values(row).join(' ').toLowerCase();
          return blob.includes(query);
        });
    },
    [query]
  );

  const renderAddSlot = (className?: string) => (
    <button
      type="button"
      className={`card-group-add-slot${className ? ` ${className}` : ''}`}
      disabled={opsBusy}
      onClick={() => void createGroup()}
    >
      <Plus className="card-group-add-slot-plus" size={18} strokeWidth={2} aria-hidden />
      Add new card group
    </button>
  );

  if (loading) {
    return <p className="muted">Loading card groups…</p>;
  }

  if (groups.length === 0) {
    return (
      <div className="card-groups-empty">
        <div className="card-groups-empty-inner">
          <FolderPlus className="card-groups-empty-icon" size={40} strokeWidth={1.25} aria-hidden />
          <p className="card-groups-empty-text">
            No card groups yet. Create one to start rendering your deck.
          </p>
          {renderAddSlot('card-group-add-slot--solo')}
        </div>
      </div>
    );
  }

  return (
    <div className="card-groups-panel">
      <div className="cards-tab-head">
        <div className="cards-tab-head-left">
          <h2 className="cards-tab-head-title">Card previews</h2>
        </div>
        <div className="cards-gallery-search-wrap cards-tab-head-search-only">
          <Search className="cards-gallery-search-icon" aria-hidden size={16} strokeWidth={2} />
          <Input
            type="search"
            className="cards-gallery-search-input"
            placeholder="Search cards in groups…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            aria-label="Search cards"
          />
        </div>
      </div>

      <div className="card-groups-list">
        {groups.map((g) => {
          const filtered = filteredRowsForGroup(g);
          const ready = isGroupReady(g);
          const hasCsv = hasCsvReady(g);
          const layoutNm = layoutName(layoutsFull, g.layoutId);
          const dataLabel = sheetConnectionLabel(g, hasCsv);

          const galleryExpanded = !collapsedGalleryIds.has(g.id);
          const galleryPanelId = `card-group-gallery-${g.id}`;

          return (
            <article key={g.id} className="card-group-shell">
              <header className={`card-group-header${ready ? ' card-group-header--ready' : ''}`}>
                <button
                  type="button"
                  className={`card-group-chevron${galleryExpanded ? ' card-group-chevron--open' : ''}`}
                  aria-expanded={galleryExpanded}
                  aria-controls={galleryPanelId}
                  onClick={() => toggleGallery(g.id)}
                  title={galleryExpanded ? 'Collapse gallery' : 'Expand gallery'}
                >
                  <ChevronDown size={18} strokeWidth={2} aria-hidden />
                </button>

                <div className="card-group-title-block">
                  {editingTitleId === g.id ? (
                    <input
                      ref={titleInputRef}
                      type="text"
                      className="card-group-title-input"
                      value={g.name}
                      disabled={opsBusy}
                      aria-label="Group name"
                      onChange={(e) =>
                        setGroups((prev) =>
                          prev.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x))
                        )
                      }
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        setEditingTitleId(null);
                        if (!v) {
                          void loadGroups();
                          return;
                        }
                        // Always persist on blur: g.name is updated on every keystroke, so it would
                        // always equal v here and we'd skip the API call if we compared them.
                        void updateGroup(g.id, { name: v });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') {
                          setEditingTitleId(null);
                          void loadGroups();
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="card-group-title-hit"
                      disabled={opsBusy}
                      onClick={() => setEditingTitleId(g.id)}
                    >
                      {g.name}
                    </button>
                  )}
                </div>

                <div className="card-group-meta">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className={`card-group-meta-chip${!g.layoutId ? ' card-group-meta-chip--muted' : ''}`}
                      disabled={opsBusy || layoutsFull.length === 0}
                    >
                      <LayoutTemplate size={14} strokeWidth={2} aria-hidden />
                      <span className="card-group-meta-chip-text">{layoutNm}</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="card-group-menu">
                      {layoutsFull.map((l) => (
                        <DropdownMenuItem
                          key={l.id}
                          disabled={l.id === g.layoutId}
                          onSelect={() => void updateGroup(g.id, { layoutId: l.id })}
                        >
                          {l.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu
                    open={dataSourceMenuGroupId === g.id}
                    onOpenChange={(open) => {
                      if (open) {
                        setDataSourceMenuGroupId(g.id);
                        setUrlDraft(g.csvSourceUrl ?? '');
                      } else {
                        setDataSourceMenuGroupId((prev) => (prev === g.id ? null : prev));
                      }
                    }}
                  >
                    <DropdownMenuTrigger
                      className={`card-group-meta-chip${!g.csvSourceUrl ? ' card-group-meta-chip--muted' : ''}`}
                      disabled={opsBusy}
                      title={g.csvSourceUrl ?? 'Set data source (published CSV URL)'}
                    >
                      <FileSpreadsheet size={14} strokeWidth={2} aria-hidden />
                      <span className="card-group-meta-chip-text">{dataLabel}</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="card-group-menu card-group-menu--data-source"
                      onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                      <div
                        className="card-group-url-drawer card-group-url-drawer--popover"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <label className="card-group-url-drawer-label">
                          Published CSV URL (https)
                          <Input
                            type="url"
                            className="card-group-url-drawer-input"
                            placeholder="https://docs.google.com/.../export?format=csv&..."
                            value={urlDraft}
                            onChange={(e) => setUrlDraft(e.target.value)}
                            disabled={opsBusy}
                            autoComplete="off"
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.stopPropagation();
                                cancelDataSourceUrl();
                              }
                            }}
                          />
                        </label>
                        <div className="card-group-url-drawer-actions">
                          <button
                            type="button"
                            className="card-group-url-drawer-save"
                            disabled={opsBusy}
                            onClick={() => void saveDataSourceUrl(g.id)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="card-group-url-drawer-cancel"
                            disabled={opsBusy}
                            onClick={() => cancelDataSourceUrl()}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="card-group-header-actions">
                    {ready && g.updatedAt ? (
                      <span className="card-group-synced" title={g.updatedAt}>
                        Synced {formatSyncedShort(g.updatedAt)}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="card-group-icon-btn"
                      disabled={opsBusy || !g.csvSourceUrl?.trim()}
                      aria-label="Refresh data"
                      onClick={() => void refreshGroupCsv(g.id, g.csvSourceUrl)}
                    >
                      <RefreshCw size={16} strokeWidth={2} />
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="card-group-icon-btn card-group-icon-btn--menu"
                        disabled={opsBusy}
                        aria-label="Group actions"
                      >
                        <MoreVertical size={16} strokeWidth={2} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="card-group-menu">
                        <DropdownMenuItem
                          disabled={!g.csvSourceUrl?.trim()}
                          onSelect={() => void refreshGroupCsv(g.id, g.csvSourceUrl)}
                        >
                          Refresh data
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void duplicateGroup(g.id)}>
                          Duplicate group
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="dropdown-menu-item-danger"
                          onSelect={() => void deleteGroup(g.id)}
                        >
                          Delete group
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </header>

              <div
                id={galleryPanelId}
                className="card-group-body"
                hidden={!galleryExpanded}
                role="region"
                aria-label={`${g.name} gallery`}
              >
                {!canPreview(g) ? (
                  <p className="card-group-ghost muted">
                    Select a Layout and Data Source to preview cards.
                  </p>
                ) : (
                  <>
                    {filtered.length === 0 && query ? (
                      <p className="muted card-group-no-match">No cards match your search.</p>
                    ) : filtered.length === 0 ? (
                      <p className="muted card-group-no-match">No rows in this dataset yet.</p>
                    ) : (
                      <div className="cards-layout-grid card-group-grid">
                        {filtered.map(({ row, i }) => {
                          const previewState =
                            layoutStateById.get(g.layoutId!) ??
                            ensureLayoutState(defaultLayoutState());
                          return (
                            <div key={`${g.id}-${i}`} className="cards-thumb-tile">
                              <div className="cards-thumb-canvas">
                                <CardFace
                                  state={previewState}
                                  row={row}
                                  assetUrls={assetUrls}
                                  assetResolveOrder={assetResolveOrder}
                                  pixelWidth={112}
                                />
                              </div>
                              <div className="cards-thumb-menu">
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    className="cards-thumb-menu-btn"
                                    aria-label="Quick actions"
                                  >
                                    <MoreVertical size={15} strokeWidth={2} />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="cards-thumb-menu-dropdown"
                                  >
                                    <DropdownMenuItem
                                      onSelect={() =>
                                        g.layoutId && onOpenLayoutInEditor(g.layoutId)
                                      }
                                    >
                                      Open in Editor
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {renderAddSlot()}
    </div>
  );
}
