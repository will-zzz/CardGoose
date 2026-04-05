import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
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
import type { LayoutNode, LayoutStateV2 } from '../types/layout';
import { DEFAULT_NEW_TEXT } from '../types/layout';
import { applyTemplate } from '../lib/template';
import { useImageElement } from './useImageElement';
import { ZoneHierarchy } from './ZoneHierarchy';
import {
  applyInsert,
  cloneWithNewIds,
  findNode,
  insertAfterSiblingDeep,
  isLocked,
  isVisible,
  moveSibling,
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
  el: Extract<LayoutNode, { type: 'image' }>;
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
  node: LayoutNode;
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
      onChange(updateNodeInState(state, id, (n) => ({ ...n, x, y } as LayoutNode)));
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
              width: Math.max(4, node.width * sx),
              height: Math.max(4, node.height * sy),
              rotation,
            };
          }),
        );
      } else if (n.type === 'text') {
        onChange(
          updateNodeInState(state, id, (node) => {
            if (node.type !== 'text') return node;
            const w = Math.max(24, (node.width ?? 100) * sx);
            const fs = Math.max(8, (node.fontSize ?? 16) * sy);
            return { ...node, x, y, width: w, fontSize: fs, rotation };
          }),
        );
      }
    };

  if (node.type === 'group') {
    return (
      <KonvaGroup
        id={node.id}
        x={node.x}
        y={node.y}
        rotation={node.rotation ?? 0}
        draggable={!isLocked(node)}
        onClick={() => onSelect(node.id)}
        onTap={() => onSelect(node.id)}
        onDragEnd={dragEnd(node.id)}
      >
        {node.children.map((c) => (
          <EditorNode
            key={c.id}
            node={c}
            selectedId={selectedId}
            assetUrls={assetUrls}
            sampleRow={sampleRow}
            setNodeRef={setNodeRef}
            onSelect={onSelect}
            onChange={onChange}
            state={state}
          />
        ))}
      </KonvaGroup>
    );
  }

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
    return (
      <Text
        ref={(r) => setNodeRef(node.id, r)}
        id={node.id}
        x={node.x}
        y={node.y}
        width={node.width}
        text={preview}
        fontSize={node.fontSize ?? 16}
        fill={node.fill ?? '#f3f4f6'}
        align={node.align ?? 'left'}
        wrap="word"
        rotation={node.rotation ?? 0}
        draggable={!isLocked(node)}
        onClick={() => onSelect(node.id)}
        onTap={() => onSelect(node.id)}
        onDragEnd={dragEnd(node.id)}
        onTransformEnd={transformEnd(node.id)}
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
  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map());

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
    if (n && found && found.node.type !== 'group' && !isLocked(found.node)) {
      tr.nodes([n]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedId, state]);

  const updateSelected = useCallback(
    (patch: Partial<LayoutNode>) => {
      if (!selectedId) return;
      onChange(
        updateNodeInState(state, selectedId, (n) => ({ ...n, ...patch } as LayoutNode)),
      );
    },
    [selectedId, state, onChange],
  );

  const bg = state.background ?? '#1e1e24';
  const maxCanvas = 560;
  const scale = Math.min(1, maxCanvas / state.width);
  const stageW = state.width * scale;
  const stageH = state.height * scale;
  const showGrid = state.showGrid !== false;

  const toggleVisible = (id: string) => {
    onChange(
      updateNodeInState(state, id, (n) => ({
        ...n,
        visible: isVisible(n) ? false : true,
      })),
    );
  };
  const toggleLock = (id: string) => {
    onChange(
      updateNodeInState(state, id, (n) => ({
        ...n,
        locked: isLocked(n) ? false : true,
      })),
    );
  };
  const toggleCollapse = (id: string) => {
    onChange(
      updateNodeInState(state, id, (n) => {
        if (n.type !== 'group') return n;
        return { ...n, collapsed: !n.collapsed };
      }),
    );
  };

  return (
    <div className="layout-editor">
      <div className="layout-editor-toolbar">
        <button
          type="button"
          onClick={() => {
            const id = crypto.randomUUID();
            const node: LayoutNode = {
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
            onChange(applyInsert(state, node, selectedId));
            setSelectedId(id);
          }}
        >
          Add text
        </button>
        <button
          type="button"
          onClick={() => {
            const id = crypto.randomUUID();
            const node: LayoutNode = {
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
            onChange(applyInsert(state, node, selectedId));
            setSelectedId(id);
          }}
        >
          Add bar
        </button>
        <button
          type="button"
          onClick={() => {
            const id = crypto.randomUUID();
            const node: LayoutNode = {
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
            onChange(applyInsert(state, node, selectedId));
            setSelectedId(id);
          }}
        >
          Add image
        </button>
        <button
          type="button"
          onClick={() => {
            const id = crypto.randomUUID();
            const node: LayoutNode = {
              type: 'group',
              id,
              name: 'Group',
              x: 20,
              y: 60,
              visible: true,
              locked: false,
              collapsed: false,
              children: [],
            };
            onChange(applyInsert(state, node, selectedId));
            setSelectedId(id);
          }}
        >
          Add group
        </button>
        <button
          type="button"
          onClick={() => {
            if (!selectedId) return;
            const found = findNode(state.root, selectedId);
            if (!found) return;
            const dup = cloneWithNewIds(found.node);
            onChange({ ...state, root: insertAfterSiblingDeep(state.root, selectedId, dup) });
            setSelectedId(dup.id);
          }}
          disabled={!selectedId}
        >
          Duplicate
        </button>
        <button
          type="button"
          className="link-danger"
          disabled={!selectedId}
          onClick={() => {
            if (!selectedId) return;
            onChange({ ...state, root: removeNodeById(state.root, selectedId) });
            setSelectedId(null);
          }}
        >
          Remove
        </button>
        <label className="layout-grid-toggle">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={() => onChange({ ...state, showGrid: !showGrid })}
          />
          Grid
        </label>
      </div>

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
                  value={selected.fontSize ?? 16}
                  onChange={(e) =>
                    updateSelected({ fontSize: Number(e.target.value) || 16 })
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
          {selected?.type === 'group' && (
            <>
              <label>
                Group name
                <input
                  type="text"
                  value={selected.name}
                  onChange={(e) => updateSelected({ name: e.target.value })}
                />
              </label>
              <label>
                X
                <input
                  type="number"
                  value={Math.round(selected.x)}
                  onChange={(e) =>
                    updateSelected({ x: Number(e.target.value) || 0 })
                  }
                />
              </label>
              <label>
                Y
                <input
                  type="number"
                  value={Math.round(selected.y)}
                  onChange={(e) =>
                    updateSelected({ y: Number(e.target.value) || 0 })
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
                onChange({ ...state, width: Number(e.target.value) || state.width })
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
                onChange({ ...state, height: Number(e.target.value) || state.height })
              }
            />
          </label>
          <label>
            Background
            <input
              type="text"
              value={state.background ?? ''}
              onChange={(e) => onChange({ ...state, background: e.target.value })}
            />
          </label>
        </aside>

        <div className="layout-editor-canvas">
          <div
            className="layout-editor-stage-wrap"
            style={{ width: stageW, height: stageH }}
          >
            <Stage
              width={stageW}
              height={stageH}
              style={{ background: bg, display: 'block' }}
              onMouseDown={(e) => {
                if (e.target === e.target.getStage()) setSelectedId(null);
              }}
            >
            <Layer>
              <KonvaGroup scaleX={scale} scaleY={scale}>
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
                    onChange={onChange}
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
              </KonvaGroup>
            </Layer>
          </Stage>
          </div>
        </div>

        <ZoneHierarchy
          root={state.root}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onToggleVisible={toggleVisible}
          onToggleLock={toggleLock}
          onToggleCollapse={toggleCollapse}
          onMoveUp={(id) => onChange({ ...state, root: moveSibling(state.root, id, -1) })}
          onMoveDown={(id) => onChange({ ...state, root: moveSibling(state.root, id, 1) })}
        />
      </div>
    </div>
  );
}
