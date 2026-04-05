import { useCallback, useEffect, useLayoutEffect, useRef, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
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
import type { LayoutElement, LayoutStateV2 } from '../types/layout';
import { DEFAULT_NEW_TEXT } from '../types/layout';
import { applyTemplate } from '../lib/template';
import { useImageElement } from './useImageElement';
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
      />,
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
      />,
    );
  }
  return <>{lines}</>;
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
        stroke={selected ? '#38bdf8' : '#555'}
        strokeWidth={selected ? 2 : 1}
      />
    );
  }
  return (
    <KonvaImage
      ref={(r) => setNodeRef(el.id, r)}
      {...common}
      image={img}
      stroke={selected ? '#38bdf8' : undefined}
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
  const dragEnd =
    (id: string) => (e: KonvaEventObject<DragEvent>) => {
      const x = e.target.x();
      const y = e.target.y();
      onChange(updateNodeInState(state, id, (n) => ({ ...n, x, y } as LayoutElement)));
    };
  const transformEnd =
    (id: string) => (e: KonvaEventObject<Event>) => {
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
          }),
        );
      } else if (n.type === 'text') {
        onChange(
          updateNodeInState(state, id, (node) => {
            if (node.type !== 'text') return node;
            const w = Math.round(Math.max(24, (node.width ?? 100) * sx) * 100) / 100;
            const fs = Math.round(Math.max(8, (node.fontSize ?? 16) * sy) * 100) / 100;
            return { ...node, x, y, width: w, fontSize: fs, rotation };
          }),
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
    const preview = applyTemplate(node.text, sampleRow);
    /** Transformer on raw Text jumps (bounds vs align). Attach to a Group at x,y instead. */
    const dragEndGroup =
      (id: string) => (e: KonvaEventObject<DragEvent>) => {
        const g = e.target as Konva.Group;
        onChange(
          updateNodeInState(state, id, (n) => ({ ...n, x: g.x(), y: g.y() } as LayoutElement)),
        );
      };
    const transformEndGroup =
      (id: string) => (e: KonvaEventObject<Event>) => {
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
          }),
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
        />
      </KonvaGroup>
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

export function LayoutEditor({
  state,
  onChange,
  assetUrls,
  sampleRow,
}: {
  state: LayoutStateV2;
  onChange: (next: LayoutStateV2) => void;
  assetUrls: Record<string, string>;
  sampleRow: Record<string, string>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const historyPast = useRef<LayoutStateV2[]>([]);
  const historyFuture = useRef<LayoutStateV2[]>([]);
  const canvasFillRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
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
    [state, onChange],
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const meta = e.metaKey || e.ctrlKey;
      if (!meta || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

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

  const setNodeRef = useCallback((id: string, node: Konva.Node | null) => {
    if (node) nodeRefs.current.set(id, node);
    else nodeRefs.current.delete(id);
  }, []);

  const selected = useMemo(
    () => (selectedId ? findNode(state.root, selectedId)?.node ?? null : null),
    [state.root, selectedId],
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
      commit(
        updateNodeInState(state, selectedId, (n) => ({ ...n, ...patch } as LayoutElement)),
      );
    },
    [selectedId, state, commit],
  );

  const bg = state.background ?? '#1e1e24';
  const pad = 8;
  const scale =
    viewport.w > 0 && viewport.h > 0
      ? Math.min(
          (viewport.w - pad * 2) / state.width,
          (viewport.h - pad * 2) / state.height,
        )
      : Math.min(1, 480 / state.width);
  const stageW = state.width * scale;
  const stageH = state.height * scale;
  const showGrid = state.showGrid !== false;

  const toggleVisible = (id: string) => {
    commit(
      updateNodeInState(state, id, (n) => ({
        ...n,
        visible: isVisible(n) ? false : true,
      })),
    );
  };
  const toggleLock = (id: string) => {
    commit(
      updateNodeInState(state, id, (n) => ({
        ...n,
        locked: isLocked(n) ? false : true,
      })),
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
    [
      state,
      selectedId,
      commit,
      undo,
      redo,
      canUndo,
      canRedo,
      showGrid,
    ],
  );

  return (
    <div className="layout-editor">
      <div className="layout-editor-shell">
        <aside className="layout-editor-props layout-editor-props-left">
          <h3>Properties</h3>
          {!selected && (
            <p className="muted">
              Select a zone on the canvas or in the hierarchy. Text supports {'{{Column}}'} tokens.
            </p>
          )}
          {selected?.type === 'text' && (
            <>
              <label>
                Text template
                <textarea
                  rows={4}
                  placeholder="Card Name or {{ColumnHeader}}"
                  value={selected.text}
                  onChange={(e) => updateSelected({ text: e.target.value })}
                />
              </label>
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
            </>
          )}
          {selected?.type === 'image' && (
            <>
              <label>
                Art key
                <input
                  type="text"
                  value={selected.artKey}
                  onChange={(e) =>
                    updateSelected({ artKey: e.target.value.trim() || 'art' })
                  }
                />
              </label>
              <label>
                Width
                <input
                  type="number"
                  min={8}
                  value={Math.round(selected.width)}
                  onChange={(e) =>
                    updateSelected({ width: Number(e.target.value) || 8 })
                  }
                />
              </label>
              <label>
                Height
                <input
                  type="number"
                  min={8}
                  value={Math.round(selected.height)}
                  onChange={(e) =>
                    updateSelected({ height: Number(e.target.value) || 8 })
                  }
                />
              </label>
            </>
          )}
          {selected?.type === 'rect' && (
            <>
              <label>
                Fill
                <input
                  type="text"
                  value={selected.fill ?? ''}
                  onChange={(e) => updateSelected({ fill: e.target.value })}
                />
              </label>
              <label>
                Width
                <input
                  type="number"
                  min={1}
                  value={Math.round(selected.width)}
                  onChange={(e) =>
                    updateSelected({ width: Number(e.target.value) || 1 })
                  }
                />
              </label>
              <label>
                Height
                <input
                  type="number"
                  min={1}
                  value={Math.round(selected.height)}
                  onChange={(e) =>
                    updateSelected({ height: Number(e.target.value) || 1 })
                  }
                />
              </label>
            </>
          )}
          <h3>Card</h3>
          <label>
            Width (px)
            <input
              type="number"
              min={100}
              max={2000}
              value={state.width}
              onChange={(e) =>
                commit({ ...state, width: Number(e.target.value) || state.width })
              }
            />
          </label>
          <label>
            Height (px)
            <input
              type="number"
              min={100}
              max={3000}
              value={state.height}
              onChange={(e) =>
                commit({ ...state, height: Number(e.target.value) || state.height })
              }
            />
          </label>
          <label>
            Background
            <input
              type="text"
              value={state.background ?? ''}
              onChange={(e) => commit({ ...state, background: e.target.value })}
            />
          </label>
        </aside>

        <div className="layout-editor-canvas-column">
          <div className="layout-editor-canvas">
            <div ref={canvasFillRef} className="layout-editor-canvas-fill">
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
                          sampleRow={sampleRow}
                          setNodeRef={setNodeRef}
                          onSelect={setSelectedId}
                          onChange={commit}
                          state={state}
                        />
                      ))}
                      <Transformer
                        ref={trRef}
                        rotateEnabled
                        borderStroke="#38bdf8"
                        borderDash={[4, 4]}
                        anchorStroke="#f8fafc"
                        anchorFill="#0ea5e9"
                        anchorSize={8}
                        boundBoxFunc={(oldBox, newBox) => newBox}
                      />
                    </Layer>
                  </Stage>
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
    </div>
  );
}
