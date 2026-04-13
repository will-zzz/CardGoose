import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useMemo,
  useState,
} from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import {
  Group as KonvaGroup,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from 'react-konva';
import { ChevronDown, Layers, Minus, Plus, Table2 } from 'lucide-react';
import type { LayoutElement, LayoutStateV2 } from '../types/layout';
import { DEFAULT_NEW_TEXT } from '../types/layout';
import { applyTemplate } from '../lib/template';
import { CardFace } from './CardFace';
import { useImageElement } from './useImageElement';
import { LayoutEditorFooterButton, LayoutEditorFooterValueStrip } from './LayoutEditorFooterButton';
import { ZoneHierarchy, type ZoneHierarchyToolbarProps } from './ZoneHierarchy';
import {
  applyInsert,
  cloneWithNewIds,
  findNode,
  insertAfterSiblingDeep,
  isLocked,
  isVisible,
  moveNodeInFlatList,
  removeNodeById,
  updateNodeInState,
} from '../lib/layoutTree';

function GridOverlay({ w, h, step }: { w: number; h: number; step: number }) {
  const lines: ReactNode[] = [];
  for (let x = 0; x <= w; x += step) {
    lines.push(
      <Line
        key={`v${x}`}
        points={[x, 0, x, h]}
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={1}
        listening={false}
      />
    );
  }
  for (let y = 0; y <= h; y += step) {
    lines.push(
      <Line
        key={`h${y}`}
        points={[0, y, w, y]}
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={1}
        listening={false}
      />
    );
  }
  return <>{lines}</>;
}

function TextEditorBlock({
  node,
  sampleRow,
  sel,
  setNodeRef,
  onSelect,
  onChange,
  state,
}: {
  node: Extract<LayoutElement, { type: 'text' }>;
  sampleRow: Record<string, string>;
  sel: boolean;
  setNodeRef: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string) => void;
  onChange: (s: LayoutStateV2) => void;
  state: LayoutStateV2;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!sel) return;
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, [sel]);
  const preview = applyTemplate(node.text, sampleRow);
  const shadowBlur = sel ? 8 + Math.sin(tick * 0.35) * 6 : 0;

  const dragEndGroup = (id: string) => (e: KonvaEventObject<DragEvent>) => {
    const g = e.target as Konva.Group;
    onChange(updateNodeInState(state, id, (n) => ({ ...n, x: g.x(), y: g.y() }) as LayoutElement));
  };
  const transformEndGroup = (id: string) => (e: KonvaEventObject<Event>) => {
    const g = e.target as Konva.Group;
    const sx = g.scaleX();
    const sy = g.scaleY();
    const rotation = g.rotation();
    const x = g.x();
    const y = g.y();
    g.scaleX(1);
    g.scaleY(1);
    const found = findNode(state.root, id);
    if (!found || found.node.type !== 'text') return;
    onChange(
      updateNodeInState(state, id, (el) => {
        if (el.type !== 'text') return el;
        const w = Math.round(Math.max(24, (el.width ?? 100) * sx) * 100) / 100;
        const fs = Math.round(Math.max(8, (el.fontSize ?? 16) * sy) * 100) / 100;
        return { ...el, x, y, width: w, fontSize: fs, rotation };
      })
    );
  };

  return (
    <KonvaGroup
      ref={(r) => setNodeRef(node.id, r)}
      id={node.id}
      x={node.x}
      y={node.y}
      rotation={node.rotation ?? 0}
      draggable={!isLocked(node)}
      onClick={() => onSelect(node.id)}
      onTap={() => onSelect(node.id)}
      onDragEnd={dragEndGroup(node.id)}
      onTransformEnd={transformEndGroup(node.id)}
    >
      <Text
        x={0}
        y={0}
        width={node.width}
        text={preview}
        fontSize={node.fontSize ?? 16}
        fill={node.fill ?? '#f3f4f6'}
        align={node.align ?? 'left'}
        wrap="word"
        listening
        shadowBlur={shadowBlur}
        shadowColor="#10b981"
        shadowOpacity={sel ? 0.72 : 0}
      />
    </KonvaGroup>
  );
}

function ImageShape({
  el,
  assetUrls,
  selected,
  setNodeRef,
  onSelect,
  onDragEnd,
  onTransformEnd,
}: {
  el: Extract<LayoutElement, { type: 'image' }>;
  assetUrls: Record<string, string>;
  selected: boolean;
  setNodeRef: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string) => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
  onTransformEnd: (e: KonvaEventObject<Event>) => void;
}) {
  const url = assetUrls[el.artKey];
  const img = useImageElement(url);
  const common = {
    id: el.id,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    rotation: el.rotation ?? 0,
    draggable: !isLocked(el),
    onClick: () => onSelect(el.id),
    onTap: () => onSelect(el.id),
    onDragEnd,
    onTransformEnd,
  };
  if (!img) {
    return (
      <Rect
        ref={(r) => setNodeRef(el.id, r)}
        {...common}
        fill="#2a2a32"
        stroke={selected ? '#10b981' : '#555'}
        strokeWidth={selected ? 2 : 1}
      />
    );
  }
  return (
    <KonvaImage
      ref={(r) => setNodeRef(el.id, r)}
      {...common}
      image={img}
      stroke={selected ? '#10b981' : undefined}
      strokeWidth={selected ? 2 : 0}
    />
  );
}

function EditorNode({
  node,
  selectedId,
  assetUrls,
  sampleRow,
  setNodeRef,
  onSelect,
  onChange,
  state,
}: {
  node: LayoutElement;
  selectedId: string | null;
  assetUrls: Record<string, string>;
  sampleRow: Record<string, string>;
  setNodeRef: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string) => void;
  onChange: (s: LayoutStateV2) => void;
  state: LayoutStateV2;
}) {
  if (!isVisible(node)) return null;

  const sel = node.id === selectedId;
  const dragEnd = (id: string) => (e: KonvaEventObject<DragEvent>) => {
    const x = e.target.x();
    const y = e.target.y();
    onChange(updateNodeInState(state, id, (n) => ({ ...n, x, y }) as LayoutElement));
  };
  const transformEnd = (id: string) => (e: KonvaEventObject<Event>) => {
    const t = e.target;
    const sx = t.scaleX();
    const sy = t.scaleY();
    const rotation = t.rotation();
    const x = t.x();
    const y = t.y();
    t.scaleX(1);
    t.scaleY(1);
    const found = findNode(state.root, id);
    if (!found) return;
    const n = found.node;
    if (n.type === 'rect' || n.type === 'image') {
      onChange(
        updateNodeInState(state, id, (node) => {
          if (node.type !== 'rect' && node.type !== 'image') return node;
          return {
            ...node,
            x,
            y,
            width: Math.round(Math.max(4, node.width * sx) * 100) / 100,
            height: Math.round(Math.max(4, node.height * sy) * 100) / 100,
            rotation,
          };
        })
      );
    } else if (n.type === 'text') {
      onChange(
        updateNodeInState(state, id, (node) => {
          if (node.type !== 'text') return node;
          const w = Math.round(Math.max(24, (node.width ?? 100) * sx) * 100) / 100;
          const fs = Math.round(Math.max(8, (node.fontSize ?? 16) * sy) * 100) / 100;
          return { ...node, x, y, width: w, fontSize: fs, rotation };
        })
      );
    }
  };

  if (node.type === 'rect') {
    return (
      <Rect
        ref={(r) => setNodeRef(node.id, r)}
        id={node.id}
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        fill={node.fill}
        stroke={node.stroke}
        strokeWidth={node.strokeWidth ?? 0}
        rotation={node.rotation ?? 0}
        draggable={!isLocked(node)}
        onClick={() => onSelect(node.id)}
        onTap={() => onSelect(node.id)}
        onDragEnd={dragEnd(node.id)}
        onTransformEnd={transformEnd(node.id)}
      />
    );
  }

  if (node.type === 'text') {
    return (
      <TextEditorBlock
        node={node}
        sampleRow={sampleRow}
        sel={sel}
        setNodeRef={setNodeRef}
        onSelect={onSelect}
        onChange={onChange}
        state={state}
      />
    );
  }

  return (
    <ImageShape
      el={node}
      assetUrls={assetUrls}
      selected={sel}
      setNodeRef={setNodeRef}
      onSelect={onSelect}
      onDragEnd={dragEnd(node.id)}
      onTransformEnd={transformEnd(node.id)}
    />
  );
}

const HISTORY_CAP = 50;

/** Allow typed values like 21%; wheel/buttons still clamp to this range. */
const ZOOM_MIN_PCT = 10;
const ZOOM_MAX_PCT = 400;
/** Step for +/- buttons (10% fine steps; hold Shift for 25% coarse steps). */
const ZOOM_STEP_FINE = 10;
const ZOOM_STEP_COARSE = 25;

function clampZoomPercent(n: number): number {
  return Math.min(ZOOM_MAX_PCT, Math.max(ZOOM_MIN_PCT, n));
}

/** Normalize any CSS color to #rrggbb for `<input type="color">`. */
function cssColorToHex(color: string | undefined): string {
  if (!color?.trim()) return '#1e1e24';
  const c = color.trim();
  if (c.startsWith('#')) {
    if (c.length === 4) {
      return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
    }
    return c.length >= 7 ? c.slice(0, 7) : '#1e1e24';
  }
  if (typeof document !== 'undefined') {
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx) {
      ctx.fillStyle = c;
      const s = ctx.fillStyle as string;
      if (s.startsWith('#') && s.length >= 7) return s.slice(0, 7);
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s);
      if (m) {
        const r = +m[1];
        const g = +m[2];
        const b = +m[3];
        return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
      }
    }
  }
  return '#1e1e24';
}

function propsInspectorTitle(node: LayoutElement | null): string {
  if (!node) return 'Nothing selected';
  if (node.type === 'text') {
    const t = node.text ?? '';
    return t.length > 36 ? `${t.slice(0, 36)}…` : t || 'Text';
  }
  if (node.type === 'image') return node.artKey || 'Image';
  return 'Shape';
}

export type LayoutEditorHandle = {
  undo: () => void;
  redo: () => void;
  selectAll: () => void;
  clearCanvas: () => void;
  zoomToFit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo100Percent: () => void;
};

export type DeckPreviewOption = {
  id: string;
  label: string;
  rows: Record<string, string>[];
  /** Card group’s linked layout id, or null for project dataset / sample. */
  layoutId: string | null;
};

function defaultPreviewSourceId(
  activeLayoutId: string | undefined,
  options: DeckPreviewOption[]
): string {
  if (options.length === 0) return '__sample__';
  if (activeLayoutId) {
    const linked = options.find((o) => o.layoutId === activeLayoutId);
    if (linked) return linked.id;
  }
  const withRows = options.find((o) => o.rows.length > 0);
  if (withRows) return withRows.id;
  return options[0].id;
}

type LayoutEditorProps = {
  state: LayoutStateV2;
  onChange: (next: LayoutStateV2) => void;
  assetUrls: Record<string, string>;
  sampleRow: Record<string, string>;
  deckPreviewOptions: DeckPreviewOption[];
  activeLayoutId?: string | null;
  onCapabilitiesChange?: (c: { canUndo: boolean; canRedo: boolean }) => void;
};

export const LayoutEditor = forwardRef<LayoutEditorHandle, LayoutEditorProps>(function LayoutEditor(
  {
    state,
    onChange,
    assetUrls,
    sampleRow,
    deckPreviewOptions,
    activeLayoutId,
    onCapabilitiesChange,
  },
  ref
) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewSourceId, setPreviewSourceId] = useState<string>(() =>
    defaultPreviewSourceId(activeLayoutId ?? undefined, deckPreviewOptions)
  );
  const [previewSourceMenuOpen, setPreviewSourceMenuOpen] = useState(false);
  const previewSourceMenuRef = useRef<HTMLDivElement>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const historyPast = useRef<LayoutStateV2[]>([]);
  const historyFuture = useRef<LayoutStateV2[]>([]);
  const canvasFillRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  /** 100 = fit-to-viewport; wheel/buttons adjust relative to that baseline. */
  const [zoomPercent, setZoomPercent] = useState(100);
  /** Pan offset (px) after flex centering; two-finger scroll without ⌘/Ctrl. */
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map());

  const commit = useCallback(
    (next: LayoutStateV2) => {
      historyPast.current.push(JSON.parse(JSON.stringify(state)) as LayoutStateV2);
      if (historyPast.current.length > HISTORY_CAP) historyPast.current.shift();
      historyFuture.current = [];
      setCanUndo(true);
      setCanRedo(false);
      onChange(next);
    },
    [state, onChange]
  );

  const undo = useCallback(() => {
    const prev = historyPast.current.pop();
    if (!prev) return;
    historyFuture.current.push(JSON.parse(JSON.stringify(state)) as LayoutStateV2);
    setCanUndo(historyPast.current.length > 0);
    setCanRedo(true);
    onChange(prev);
  }, [state, onChange]);

  const redo = useCallback(() => {
    const next = historyFuture.current.pop();
    if (!next) return;
    historyPast.current.push(JSON.parse(JSON.stringify(state)) as LayoutStateV2);
    setCanRedo(historyFuture.current.length > 0);
    setCanUndo(true);
    onChange(next);
  }, [state, onChange]);

  const zoomToFit = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoomPercent(100);
  }, []);

  const zoomTo100Percent = useCallback(() => {
    setZoomPercent(100);
  }, []);

  const zoomInFromMenu = useCallback(() => {
    setZoomPercent((p) => clampZoomPercent(p + ZOOM_STEP_FINE));
  }, []);

  const zoomOutFromMenu = useCallback(() => {
    setZoomPercent((p) => clampZoomPercent(p - ZOOM_STEP_FINE));
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      undo: () => undo(),
      redo: () => redo(),
      selectAll: () => {
        const last = state.root[state.root.length - 1];
        setSelectedId(last?.id ?? null);
      },
      clearCanvas: () => {
        if (!window.confirm('Remove all elements from the canvas?')) return;
        commit({ ...state, root: [] });
        setSelectedId(null);
      },
      zoomToFit,
      zoomIn: zoomInFromMenu,
      zoomOut: zoomOutFromMenu,
      zoomTo100Percent,
    }),
    [undo, redo, state, commit, zoomToFit, zoomInFromMenu, zoomOutFromMenu, zoomTo100Percent]
  );

  useEffect(() => {
    onCapabilitiesChange?.({ canUndo, canRedo });
  }, [canUndo, canRedo, onCapabilitiesChange]);

  useEffect(() => {
    setPreviewSourceId((prev) =>
      deckPreviewOptions.some((o) => o.id === prev)
        ? prev
        : defaultPreviewSourceId(activeLayoutId ?? undefined, deckPreviewOptions)
    );
  }, [deckPreviewOptions, activeLayoutId]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      if (e.code === 'Digit0' || e.code === 'Numpad0') {
        e.preventDefault();
        zoomToFit();
        return;
      }
      if ((e.code === 'Digit1' || e.code === 'Numpad1') && !e.shiftKey) {
        e.preventDefault();
        zoomTo100Percent();
        return;
      }
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        zoomOutFromMenu();
        return;
      }
      if (e.code === 'Equal' || e.code === 'NumpadAdd' || e.key === '+') {
        e.preventDefault();
        zoomInFromMenu();
        return;
      }

      if (e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, zoomToFit, zoomTo100Percent, zoomInFromMenu, zoomOutFromMenu]);

  useLayoutEffect(() => {
    const el = canvasFillRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewport({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setViewport({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = canvasFillRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY;
        setZoomPercent((p) => clampZoomPercent(p * Math.exp(delta * 0.0018)));
        return;
      }
      e.preventDefault();
      setPan((p) => ({
        x: p.x - e.deltaX,
        y: p.y - e.deltaY,
      }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const setNodeRef = useCallback((id: string, node: Konva.Node | null) => {
    if (node) nodeRefs.current.set(id, node);
    else nodeRefs.current.delete(id);
  }, []);

  const selected = useMemo(
    () => (selectedId ? (findNode(state.root, selectedId)?.node ?? null) : null),
    [state.root, selectedId]
  );

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const n = selectedId ? nodeRefs.current.get(selectedId) : null;
    const found = selectedId ? findNode(state.root, selectedId) : null;
    if (n && found && !isLocked(found.node)) {
      tr.nodes([n]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedId, state]);

  const updateSelected = useCallback(
    (patch: Partial<LayoutElement>) => {
      if (!selectedId) return;
      commit(updateNodeInState(state, selectedId, (n) => ({ ...n, ...patch }) as LayoutElement));
    },
    [selectedId, state, commit]
  );

  const bg = state.background ?? '#1e1e24';
  const pad = 8;
  const fitScale = useMemo(() => {
    if (viewport.w > 0 && viewport.h > 0) {
      return Math.min((viewport.w - pad * 2) / state.width, (viewport.h - pad * 2) / state.height);
    }
    return Math.min(1, 480 / state.width);
  }, [viewport.w, viewport.h, state.width, state.height]);

  const scale = fitScale * (zoomPercent / 100);
  const stageW = state.width * scale;
  const stageH = state.height * scale;
  const showGrid = state.showGrid ?? false;

  const toggleVisible = (id: string) => {
    commit(
      updateNodeInState(state, id, (n) => ({
        ...n,
        visible: isVisible(n) ? false : true,
      }))
    );
  };
  const toggleLock = (id: string) => {
    commit(
      updateNodeInState(state, id, (n) => ({
        ...n,
        locked: isLocked(n) ? false : true,
      }))
    );
  };

  const hierarchyToolbar: ZoneHierarchyToolbarProps = useMemo(
    () => ({
      onAddText: () => {
        const id = crypto.randomUUID();
        const node: LayoutElement = {
          type: 'text',
          id,
          x: 16,
          y: 40,
          width: state.width - 32,
          text: DEFAULT_NEW_TEXT,
          fontSize: 16,
          fill: '#f3f4f6',
          align: 'center',
          visible: true,
          locked: false,
        };
        commit(applyInsert(state, node, selectedId));
        setSelectedId(id);
      },
      onAddBar: () => {
        const id = crypto.randomUUID();
        const node: LayoutElement = {
          type: 'rect',
          id,
          x: 24,
          y: 80,
          width: state.width - 48,
          height: 4,
          fill: '#4b5563',
          visible: true,
          locked: false,
        };
        commit(applyInsert(state, node, selectedId));
        setSelectedId(id);
      },
      onAddImage: () => {
        const id = crypto.randomUUID();
        const node: LayoutElement = {
          type: 'image',
          id,
          x: 40,
          y: 100,
          width: Math.min(120, state.width - 80),
          height: 120,
          artKey: 'art',
          visible: true,
          locked: false,
        };
        commit(applyInsert(state, node, selectedId));
        setSelectedId(id);
      },
      onDuplicate: () => {
        if (!selectedId) return;
        const found = findNode(state.root, selectedId);
        if (!found) return;
        const dup = cloneWithNewIds(found.node);
        commit({ ...state, root: insertAfterSiblingDeep(state.root, selectedId, dup) });
        setSelectedId(dup.id);
      },
      onRemove: () => {
        if (!selectedId) return;
        commit({ ...state, root: removeNodeById(state.root, selectedId) });
        setSelectedId(null);
      },
      onUndo: () => undo(),
      onRedo: () => redo(),
      onToggleGrid: () => commit({ ...state, showGrid: !showGrid }),
      canUndo,
      canRedo,
      showGrid,
      hasSelection: !!selectedId,
    }),
    [state, selectedId, commit, undo, redo, canUndo, canRedo, showGrid]
  );

  const activePreviewOption = useMemo(() => {
    if (deckPreviewOptions.length === 0) return undefined;
    return deckPreviewOptions.find((o) => o.id === previewSourceId) ?? deckPreviewOptions[0];
  }, [deckPreviewOptions, previewSourceId]);
  const effectiveRows = activePreviewOption?.rows ?? [];
  const effectiveSampleRow = effectiveRows[0] ?? {};
  const filmstripRows = effectiveRows.length > 0 ? effectiveRows : [{}];
  const [deckPreviewOpen, setDeckPreviewOpen] = useState(false);
  const deckDrawerId = useId();

  const zoomOut = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? ZOOM_STEP_COARSE : ZOOM_STEP_FINE;
    setZoomPercent((p) => clampZoomPercent(p - step));
  }, []);
  const zoomIn = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? ZOOM_STEP_COARSE : ZOOM_STEP_FINE;
    setZoomPercent((p) => clampZoomPercent(p + step));
  }, []);
  const zoomDisplayPct = Math.round(zoomPercent);
  const [zoomInputEditing, setZoomInputEditing] = useState(false);
  const [zoomInputDraft, setZoomInputDraft] = useState('');
  const zoomInputId = useId();

  const bgColorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!previewSourceMenuOpen) return;
    const onClick = (e: Event) => {
      if (
        previewSourceMenuRef.current &&
        !previewSourceMenuRef.current.contains(e.target as Node)
      ) {
        setPreviewSourceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [previewSourceMenuOpen]);

  const commitZoomInput = useCallback(() => {
    const raw = zoomInputDraft.trim();
    if (raw !== '') {
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n)) setZoomPercent(clampZoomPercent(n));
    }
    setZoomInputEditing(false);
  }, [zoomInputDraft, setZoomInputEditing, setZoomPercent]);

  const onZoomInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.currentTarget.blur();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setZoomInputDraft(String(Math.round(zoomPercent)));
        setZoomInputEditing(false);
        e.currentTarget.blur();
      }
    },
    [zoomPercent, setZoomInputDraft, setZoomInputEditing]
  );

  return (
    <div className="layout-editor">
      <div
        className={`layout-editor-grid-bg${showGrid ? '' : ' layout-editor-grid-bg--hidden'}`}
        aria-hidden
      />
      <div className="layout-editor-shell">
        <aside className="layout-editor-props layout-editor-props-left">
          <p className="props-panel-title">
            Properties:{' '}
            <span className="props-panel-title-strong">{propsInspectorTitle(selected)}</span>
          </p>
          {!selected && (
            <p className="muted props-panel-intro">
              Select a zone on the canvas or in the hierarchy. Text supports {'{{Column}}'} tokens.
            </p>
          )}
          {selected?.type === 'text' && (
            <>
              <details className="props-accordion" open>
                <summary>Text</summary>
                <div className="props-accordion-body">
                  <label>
                    Template
                    <textarea
                      rows={4}
                      placeholder="Card Name or {{ColumnHeader}}"
                      value={selected.text}
                      onChange={(e) => updateSelected({ text: e.target.value })}
                    />
                  </label>
                </div>
              </details>
              <details className="props-accordion" open>
                <summary>Typography</summary>
                <div className="props-accordion-body">
                  <label>
                    Font size
                    <input
                      type="number"
                      min={8}
                      max={72}
                      step={1}
                      value={Math.round(selected.fontSize ?? 16)}
                      onChange={(e) =>
                        updateSelected({ fontSize: Math.round(Number(e.target.value) || 16) })
                      }
                    />
                  </label>
                  <label>
                    Color
                    <input
                      type="text"
                      value={selected.fill ?? '#f3f4f6'}
                      onChange={(e) => updateSelected({ fill: e.target.value })}
                    />
                  </label>
                  <label>
                    Align
                    <select
                      value={selected.align ?? 'left'}
                      onChange={(e) =>
                        updateSelected({
                          align: e.target.value as 'left' | 'center' | 'right',
                        })
                      }
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </label>
                </div>
              </details>
            </>
          )}
          {selected?.type === 'image' && (
            <>
              <details className="props-accordion" open>
                <summary>Image</summary>
                <div className="props-accordion-body">
                  <label>
                    Art key
                    <input
                      type="text"
                      value={selected.artKey}
                      onChange={(e) => updateSelected({ artKey: e.target.value.trim() || 'art' })}
                    />
                  </label>
                </div>
              </details>
              <details className="props-accordion" open>
                <summary>Geometry</summary>
                <div className="props-accordion-body">
                  <label>
                    Width
                    <input
                      type="number"
                      min={8}
                      value={Math.round(selected.width)}
                      onChange={(e) => updateSelected({ width: Number(e.target.value) || 8 })}
                    />
                  </label>
                  <label>
                    Height
                    <input
                      type="number"
                      min={8}
                      value={Math.round(selected.height)}
                      onChange={(e) => updateSelected({ height: Number(e.target.value) || 8 })}
                    />
                  </label>
                </div>
              </details>
            </>
          )}
          {selected?.type === 'rect' && (
            <>
              <details className="props-accordion" open>
                <summary>Fill</summary>
                <div className="props-accordion-body">
                  <label>
                    Color
                    <input
                      type="text"
                      value={selected.fill ?? ''}
                      onChange={(e) => updateSelected({ fill: e.target.value })}
                    />
                  </label>
                </div>
              </details>
              <details className="props-accordion" open>
                <summary>Geometry</summary>
                <div className="props-accordion-body">
                  <label>
                    Width
                    <input
                      type="number"
                      min={1}
                      value={Math.round(selected.width)}
                      onChange={(e) => updateSelected({ width: Number(e.target.value) || 1 })}
                    />
                  </label>
                  <label>
                    Height
                    <input
                      type="number"
                      min={1}
                      value={Math.round(selected.height)}
                      onChange={(e) => updateSelected({ height: Number(e.target.value) || 1 })}
                    />
                  </label>
                </div>
              </details>
            </>
          )}
        </aside>

        <div className="layout-editor-canvas-column">
          <div className="layout-editor-canvas">
            <div ref={canvasFillRef} className="layout-editor-canvas-fill">
              <div
                className="layout-editor-pan-layer"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px)`,
                }}
              >
                <div
                  className="layout-editor-stage-wrap"
                  style={{
                    width: stageW,
                    height: stageH,
                    position: 'relative',
                  }}
                >
                  {/*
                  Scale via CSS, not a scaled Konva Group — nested drags use wrong deltas
                  when an ancestor has scaleX/scaleY.
                */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: state.width,
                      height: state.height,
                      transform: `scale(${scale})`,
                      transformOrigin: 'top left',
                    }}
                  >
                    <Stage
                      width={state.width}
                      height={state.height}
                      style={{ background: bg, display: 'block' }}
                      onMouseDown={(e) => {
                        const st = e.target.getStage();
                        if (e.target === st) setSelectedId(null);
                      }}
                    >
                      <Layer>
                        <Rect
                          width={state.width}
                          height={state.height}
                          fill={bg}
                          onMouseDown={() => setSelectedId(null)}
                        />
                        {showGrid && <GridOverlay w={state.width} h={state.height} step={10} />}
                        {state.root.map((node) => (
                          <EditorNode
                            key={node.id}
                            node={node}
                            selectedId={selectedId}
                            assetUrls={assetUrls}
                            sampleRow={effectiveSampleRow}
                            setNodeRef={setNodeRef}
                            onSelect={setSelectedId}
                            onChange={commit}
                            state={state}
                          />
                        ))}
                        <Transformer
                          ref={trRef}
                          rotateEnabled
                          borderStroke="#10b981"
                          borderDash={[4, 4]}
                          anchorStroke="#ecfdf5"
                          anchorFill="#059669"
                          anchorSize={8}
                          boundBoxFunc={(_oldBox, newBox) => newBox}
                        />
                      </Layer>
                    </Stage>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ZoneHierarchy
          root={state.root}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onToggleVisible={toggleVisible}
          onToggleLock={toggleLock}
          toolbar={hierarchyToolbar}
          onMoveNode={(dragId, targetId, placement) =>
            commit({ ...state, root: moveNodeInFlatList(state.root, dragId, targetId, placement) })
          }
        />
      </div>

      <div
        id={deckDrawerId}
        className={`deck-preview-drawer${deckPreviewOpen ? ' deck-preview-drawer--open' : ''}`}
        role="region"
        aria-label="Deck preview using this layout"
        aria-hidden={!deckPreviewOpen}
      >
        <div className="deck-filmstrip deck-filmstrip--overlay">
          <div className="deck-filmstrip-scroll deck-filmstrip-scroll--full">
            {filmstripRows.slice(0, 48).map((row, i) => {
              const label =
                row.Name ||
                row.name ||
                row.Title ||
                row.title ||
                Object.values(row)[0] ||
                `Card ${i + 1}`;
              return (
                <div key={i} className="deck-filmstrip-item" title={String(label)}>
                  <div className="deck-filmstrip-thumb">
                    <CardFace state={state} row={row} assetUrls={assetUrls} pixelWidth={72} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <footer className="layout-editor-status-bar">
        <div className="layout-editor-footer-start-cluster">
          <LayoutEditorFooterButton
            edge="start"
            aria-expanded={deckPreviewOpen}
            aria-controls={deckDrawerId}
            onClick={() => setDeckPreviewOpen((o) => !o)}
          >
            <Layers className="layout-editor-footer-icon" size={14} aria-hidden />
            Deck preview
          </LayoutEditorFooterButton>
          <div className="layout-editor-footer-popover" ref={previewSourceMenuRef}>
            <LayoutEditorFooterButton
              className="layout-editor-footer-preview-source-btn"
              aria-haspopup="listbox"
              aria-expanded={previewSourceMenuOpen}
              title="Choose dataset for deck preview"
              onClick={() => setPreviewSourceMenuOpen((o) => !o)}
            >
              <Table2 className="layout-editor-footer-icon" size={14} strokeWidth={2} aria-hidden />
              <span className="layout-editor-footer-preview-source-label">
                {activePreviewOption?.label ?? 'Preview'}
              </span>
              <ChevronDown
                size={12}
                strokeWidth={2}
                aria-hidden
                className={`layout-editor-footer-preview-chevron${previewSourceMenuOpen ? ' layout-editor-footer-preview-chevron--open' : ''}`}
              />
            </LayoutEditorFooterButton>
            {previewSourceMenuOpen && (
              <ul className="deck-preview-source-popover" role="listbox">
                {deckPreviewOptions.map((opt) => (
                  <li
                    key={opt.id}
                    role="option"
                    aria-selected={previewSourceId === opt.id}
                    className={`deck-filmstrip-source-option${previewSourceId === opt.id ? ' deck-filmstrip-source-option--active' : ''}`}
                    onClick={() => {
                      setPreviewSourceId(opt.id);
                      setPreviewSourceMenuOpen(false);
                    }}
                  >
                    {opt.label}
                    <span className="deck-filmstrip-source-option-count">
                      {opt.rows.length === 0 ? '—' : `${opt.rows.length} cards`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="layout-editor-status-bar-card" aria-label="Card size and background">
          <LayoutEditorFooterValueStrip prefix="W">
            <input
              type="number"
              className="layout-editor-footer-value-input layout-editor-footer-value-input--dim"
              min={100}
              max={2000}
              value={state.width}
              onChange={(e) => commit({ ...state, width: Number(e.target.value) || state.width })}
              aria-label="Card width in pixels"
            />
          </LayoutEditorFooterValueStrip>
          <span className="layout-editor-footer-value-sep" aria-hidden>
            ×
          </span>
          <LayoutEditorFooterValueStrip prefix="H">
            <input
              type="number"
              className="layout-editor-footer-value-input layout-editor-footer-value-input--dim"
              min={100}
              max={3000}
              value={state.height}
              onChange={(e) => commit({ ...state, height: Number(e.target.value) || state.height })}
              aria-label="Card height in pixels"
            />
          </LayoutEditorFooterValueStrip>
          <input
            ref={bgColorInputRef}
            type="color"
            className="layout-editor-bg-color-input-hidden"
            value={cssColorToHex(state.background)}
            onChange={(e) => commit({ ...state, background: e.target.value })}
            tabIndex={-1}
            aria-hidden
          />
          <LayoutEditorFooterButton
            variant="icon"
            className="layout-editor-bg-swatch-btn"
            onClick={() => bgColorInputRef.current?.click()}
            aria-label="Card background color"
            title="Choose card background color"
          >
            <span
              className="layout-editor-bg-swatch-chip"
              style={{ backgroundColor: state.background ?? '#1e1e24' }}
              aria-hidden
            />
          </LayoutEditorFooterButton>
        </div>
        <div
          className="layout-editor-zoom"
          role="group"
          aria-label="Canvas zoom"
          title="⌘/Ctrl + scroll on canvas to zoom"
        >
          <LayoutEditorFooterButton
            variant="icon"
            aria-label="Zoom out"
            title="Zoom out — Shift for 25% steps"
            disabled={zoomPercent <= ZOOM_MIN_PCT + 1e-3}
            onClick={zoomOut}
          >
            <Minus className="layout-editor-footer-icon" size={14} strokeWidth={2} aria-hidden />
          </LayoutEditorFooterButton>
          <LayoutEditorFooterValueStrip
            suffix="%"
            htmlFor={zoomInputId}
            title="Type zoom % — Enter to apply"
          >
            <input
              id={zoomInputId}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              className="layout-editor-footer-value-input layout-editor-footer-value-input--zoom"
              aria-label="Zoom percent"
              value={zoomInputEditing ? zoomInputDraft : String(zoomDisplayPct)}
              onFocus={(e) => {
                setZoomInputEditing(true);
                setZoomInputDraft(String(zoomDisplayPct));
                e.target.select();
              }}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 3);
                setZoomInputDraft(v);
              }}
              onBlur={commitZoomInput}
              onKeyDown={onZoomInputKeyDown}
            />
          </LayoutEditorFooterValueStrip>
          <LayoutEditorFooterButton
            variant="icon"
            aria-label="Zoom in"
            title="Zoom in — Shift for 25% steps"
            disabled={zoomPercent >= ZOOM_MAX_PCT - 1e-3}
            onClick={zoomIn}
          >
            <Plus className="layout-editor-footer-icon" size={14} strokeWidth={2} aria-hidden />
          </LayoutEditorFooterButton>
        </div>
      </footer>
    </div>
  );
});
