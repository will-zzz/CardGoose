import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Layers, MoreVertical, Search } from 'lucide-react';
import { apiJson } from '../lib/api';
import {
  CF_LAYOUT_ID_KEY,
  ensureLayoutIdColumn,
  getRowLayoutId,
  layoutNameForId,
  rowSearchBlob,
} from '../lib/cardLayout';
import { CardFace } from './CardFace';
import { Input } from './ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { defaultLayoutState, ensureLayoutState, type LayoutStateV2 } from '../types/layout';

type CsvData = { headers: string[]; rows: Record<string, string>[] };
type LayoutFull = { id: string; name: string; lastUpdated: string; state: unknown };

type RowIndexed = { row: Record<string, string>; index: number };

function cardLabel(row: Record<string, string>, i: number): string {
  const named = row.Name || row.name || row.Title || row.title;
  if (named?.trim()) return named.trim();
  for (const [k, v] of Object.entries(row)) {
    if (k === CF_LAYOUT_ID_KEY) continue;
    if (v?.trim()) return v.trim();
  }
  return `Card ${i + 1}`;
}

export function CardsGallery(props: {
  projectId: string;
  token: string | null;
  layoutsFull: LayoutFull[];
  csvData: CsvData;
  assetUrls: Record<string, string>;
  busy: boolean;
  onBusy: (b: boolean) => void;
  onError: (msg: string | null) => void;
  onCsvUpdated: (csv: CsvData) => void;
  onOpenLayoutInEditor: (layoutId: string) => void;
  onAddDataRowForLayout: (layoutId: string) => void | Promise<void>;
}) {
  const {
    projectId,
    token,
    layoutsFull,
    csvData,
    assetUrls,
    busy,
    onBusy,
    onError,
    onCsvUpdated,
    onOpenLayoutInEditor,
    onAddDataRowForLayout,
  } = props;

  const [search, setSearch] = useState('');
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const defaultLayoutId = layoutsFull[0]?.id ?? '';

  const layoutStateById = useMemo(() => {
    const m = new Map<string, LayoutStateV2>();
    for (const l of layoutsFull) {
      m.set(l.id, ensureLayoutState(l.state));
    }
    return m;
  }, [layoutsFull]);

  const fullIndexed: RowIndexed[] = useMemo(
    () => csvData.rows.map((row, index) => ({ row, index })),
    [csvData.rows],
  );

  const rowsByLayoutId = useMemo(() => {
    const m = new Map<string, RowIndexed[]>();
    for (const item of fullIndexed) {
      const lid = getRowLayoutId(item.row, defaultLayoutId);
      if (!m.has(lid)) m.set(lid, []);
      m.get(lid)!.push(item);
    }
    return m;
  }, [fullIndexed, defaultLayoutId]);

  /** Every project layout gets a section; data-only orphan ids (e.g. deleted layout) still appear. */
  const sectionsBase = useMemo(() => {
    const seen = new Set<string>();
    const list: { layoutId: string; layoutName: string; items: RowIndexed[] }[] = [];
    for (const l of layoutsFull) {
      seen.add(l.id);
      list.push({
        layoutId: l.id,
        layoutName: l.name,
        items: rowsByLayoutId.get(l.id) ?? [],
      });
    }
    for (const [lid, items] of rowsByLayoutId) {
      if (!seen.has(lid)) {
        list.push({
          layoutId: lid,
          layoutName: layoutNameForId(layoutsFull, lid),
          items,
        });
      }
    }
    list.sort((a, b) => a.layoutName.localeCompare(b.layoutName));
    return list;
  }, [layoutsFull, rowsByLayoutId]);

  useEffect(() => {
    setOpenMap((prev) => {
      const next = { ...prev };
      for (const g of sectionsBase) {
        if (next[g.layoutId] === undefined) next[g.layoutId] = true;
      }
      return next;
    });
  }, [sectionsBase]);

  const query = search.trim().toLowerCase();

  const groupsFiltered = useMemo(() => {
    return sectionsBase.map((g) => {
      const filtered = query
        ? g.items.filter(({ row }) => rowSearchBlob(row, g.layoutName).includes(query))
        : g.items;
      return { ...g, filtered };
    });
  }, [sectionsBase, query]);

  const totalMatches = useMemo(
    () => groupsFiltered.reduce((n, g) => n + g.filtered.length, 0),
    [groupsFiltered],
  );

  const applyLayoutToGroup = useCallback(
    async (fromLayoutId: string, toLayoutId: string) => {
      if (!token || toLayoutId === fromLayoutId) return;
      onError(null);
      onBusy(true);
      try {
        const headers = ensureLayoutIdColumn([...csvData.headers]);
        const nextRows = csvData.rows.map((row) => {
          const rid = getRowLayoutId(row, defaultLayoutId);
          if (rid !== fromLayoutId) return row;
          return { ...row, [CF_LAYOUT_ID_KEY]: toLayoutId };
        });
        const res = await apiJson<{ csvData: CsvData }>(`/api/projects/${projectId}/data`, {
          method: 'PUT',
          token,
          body: JSON.stringify({ headers, rows: nextRows }),
        });
        onCsvUpdated(res.csvData);
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Update failed');
      } finally {
        onBusy(false);
      }
    },
    [token, projectId, csvData, defaultLayoutId, onBusy, onError, onCsvUpdated],
  );

  const toggleSection = useCallback((layoutId: string) => {
    setOpenMap((m) => ({ ...m, [layoutId]: !m[layoutId] }));
  }, []);

  const hasDataset = csvData.rows.length > 0;

  return (
    <div className="cards-gallery">
      <div className="cards-tab-head">
        <div className="cards-tab-head-left">
          <h2 className="cards-tab-head-title">Card previews</h2>
        </div>
        {hasDataset && (
          <div className="cards-gallery-search-wrap">
            <Search className="cards-gallery-search-icon" aria-hidden size={16} strokeWidth={2} />
            <Input
              type="search"
              className="cards-gallery-search-input"
              placeholder="Search cards, stats, or layouts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
              aria-label="Search cards and layouts"
            />
          </div>
        )}
      </div>

      {!hasDataset ? (
        <p className="muted cards-tab-import-hint">Import a CSV on the Data tab to see cards.</p>
      ) : query && totalMatches === 0 ? (
        <p className="cards-gallery-empty">No cards match your search.</p>
      ) : (
        <div className="cards-gallery-sections">
          {groupsFiltered.map((g) => {
            const open = openMap[g.layoutId] !== false;
            const previewState =
              layoutStateById.get(g.layoutId) ?? ensureLayoutState(defaultLayoutState());
            const peekLabels = g.items.slice(0, 4).map((x) => cardLabel(x.row, x.index));
            const peekExtra = g.items.length > 4 ? g.items.length - 4 : 0;
            const isEmptyLayout = g.items.length === 0;

            return (
              <section key={g.layoutId} className="cards-layout-section">
                <div className="cards-layout-section-toolbar">
                  <button
                    type="button"
                    className="cards-layout-section-toggle"
                    onClick={() => toggleSection(g.layoutId)}
                    aria-expanded={open}
                    aria-controls={`cards-grid-${g.layoutId}`}
                  >
                    <ChevronDown
                      className={`cards-layout-chevron${open ? ' cards-layout-chevron--open' : ''}`}
                      size={18}
                      aria-hidden
                    />
                    <span className="cards-layout-section-title">{g.layoutName}</span>
                    <span className="cards-layout-count-pill">
                      {g.items.length} {g.items.length === 1 ? 'card' : 'cards'}
                    </span>
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="cards-layout-change-btn"
                      disabled={busy}
                      onPointerDown={(e) => e.preventDefault()}
                      aria-label="Change layout for cards in this group"
                    >
                      <Layers size={16} strokeWidth={2} aria-hidden />
                      <span className="cards-layout-change-label">Change layout</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="cards-layout-dropdown">
                      {layoutsFull.map((l) => (
                        <DropdownMenuItem
                          key={l.id}
                          disabled={l.id === g.layoutId}
                          onSelect={() => void applyLayoutToGroup(g.layoutId, l.id)}
                        >
                          {l.name}
                          {l.id === g.layoutId ? ' (current)' : ''}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {!open && (
                  <div className="cards-layout-peek" aria-hidden>
                    {peekLabels.length > 0 ? (
                      <span className="cards-layout-peek-inner">
                        {peekLabels.join(' · ')}
                        {peekExtra > 0 ? ` · +${peekExtra} more` : ''}
                      </span>
                    ) : (
                      <span className="muted">No cards in this layout</span>
                    )}
                  </div>
                )}

                {open && (
                  <div
                    id={`cards-grid-${g.layoutId}`}
                    className="cards-layout-grid"
                    role="region"
                    aria-label={`${g.layoutName} cards`}
                  >
                    {isEmptyLayout ? (
                      <div className="cards-layout-empty-panel">
                        <p className="cards-layout-empty-title">No cards in this layout</p>
                        <button
                          type="button"
                          className="cards-tab-add-row-btn"
                          disabled={busy}
                          onClick={() => void onAddDataRowForLayout(g.layoutId)}
                        >
                          Add Data Row
                        </button>
                      </div>
                    ) : g.filtered.length === 0 ? (
                      <p className="cards-layout-group-empty muted">
                        No cards in this layout match your search.
                      </p>
                    ) : (
                      g.filtered.map(({ row, index }) => (
                        <div key={index} className="cards-thumb-tile">
                          <div className="cards-thumb-canvas">
                            <CardFace
                              state={previewState}
                              row={row}
                              assetUrls={assetUrls}
                              pixelWidth={112}
                            />
                          </div>
                          <div className="cards-thumb-menu">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className="cards-thumb-menu-btn"
                                aria-label="Quick actions"
                                onPointerDown={(e) => e.preventDefault()}
                              >
                                <MoreVertical size={15} strokeWidth={2} />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="cards-thumb-menu-dropdown">
                                <DropdownMenuItem
                                  onSelect={() => onOpenLayoutInEditor(g.layoutId)}
                                >
                                  Open in Editor
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
