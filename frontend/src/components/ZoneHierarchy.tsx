import { useCallback, useState } from 'react';
import type { LayoutNode } from '../types/layout';
import { isLocked, isVisible } from '../lib/layoutTree';

function kindLabel(node: LayoutNode): string {
  if (node.type === 'group') return 'Group';
  if (node.type === 'text') return 'Text';
  if (node.type === 'image') return 'Image';
  return 'Shape';
}

function contentLabel(node: LayoutNode): string {
  if (node.type === 'group') return node.name?.trim() || 'Group';
  if (node.type === 'text') {
    const t = node.text ?? '';
    return t.length > 40 ? `${t.slice(0, 40)}…` : t;
  }
  if (node.type === 'image') return node.artKey || 'image';
  return 'Bar';
}

const ZONE_MIME = 'application/x-cardboard-zone';

function findNodeInTree(nodes: LayoutNode[], id: string): LayoutNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.type === 'group') {
      const c = findNodeInTree(n.children, id);
      if (c) return c;
    }
  }
  return undefined;
}

function placementFromEvent(
  e: React.DragEvent,
  isGroup: boolean,
): 'before' | 'after' | 'into' {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const y = e.clientY - rect.top;
  const r = rect.height > 0 ? y / rect.height : 0.5;
  if (isGroup) {
    if (r < 0.28) return 'before';
    if (r > 0.72) return 'after';
    return 'into';
  }
  return r < 0.5 ? 'before' : 'after';
}

function Row({
  node,
  depth,
  selectedId,
  dragOver,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onToggleCollapse,
  onDragEnd,
  onDragOverRow,
  onDragLeaveRow,
  onDropOnRow,
}: {
  node: LayoutNode;
  depth: number;
  selectedId: string | null;
  dragOver: { targetId: string; place: 'before' | 'after' | 'into' } | null;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onDragEnd: () => void;
  onDragOverRow: (targetId: string, e: React.DragEvent) => void;
  onDragLeaveRow: (targetId: string) => void;
  onDropOnRow: (dragId: string, targetId: string, e: React.DragEvent) => void;
}) {
  const sel = node.id === selectedId;
  const vis = isVisible(node);
  const lock = isLocked(node);
  const kind = kindLabel(node);
  const text = contentLabel(node);
  const isGroup = node.type === 'group';
  const hint = dragOver?.targetId === node.id ? dragOver.place : null;
  const rowClass = [
    'zone-row',
    sel ? 'zone-row-selected' : '',
    hint === 'before' ? 'zone-row--hint-before' : '',
    hint === 'after' ? 'zone-row--hint-after' : '',
    hint === 'into' ? 'zone-row--hint-into' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rowClass}
      style={{ paddingLeft: Math.min(depth, 8) * 12 }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOverRow(node.id, e);
      }}
      onDragLeave={() => onDragLeaveRow(node.id)}
      onDrop={(e) => {
        e.preventDefault();
        const dragId = e.dataTransfer.getData(ZONE_MIME);
        if (dragId) onDropOnRow(dragId, node.id, e);
      }}
    >
      <div className="zone-row-tools">
        <span
          className="zone-grip"
          draggable
          role="button"
          tabIndex={0}
          title="Drag to reorder or drop on a group (middle) to nest"
          aria-grabbed={undefined}
          onDragStart={(e) => {
            e.dataTransfer.setData(ZONE_MIME, node.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={() => onDragEnd()}
        >
          ⋮⋮
        </span>
        {isGroup ? (
          <button
            type="button"
            className="zone-tool"
            onClick={() => onToggleCollapse(node.id)}
            aria-label={node.collapsed ? 'Expand group' : 'Collapse group'}
            title={node.collapsed ? 'Expand' : 'Collapse'}
          >
            {node.collapsed ? '▸' : '▾'}
          </button>
        ) : (
          <span className="zone-collapse-spacer" aria-hidden />
        )}
        <button
          type="button"
          className="zone-tool zone-tool--narrow"
          onClick={() => onToggleVisible(node.id)}
          aria-label={vis ? 'Hide layer' : 'Show layer'}
          title={vis ? 'Click to hide this layer' : 'Click to show this layer'}
        >
          {vis ? 'Hide' : 'Show'}
        </button>
        <button
          type="button"
          className={`zone-tool zone-tool--narrow${lock ? ' zone-tool-locked' : ''}`}
          onClick={() => onToggleLock(node.id)}
          aria-label={lock ? 'Unlock' : 'Lock'}
          title={lock ? 'Click to unlock (allow edits)' : 'Click to lock (prevent edits)'}
        >
          {lock ? 'Unlock' : 'Lock'}
        </button>
      </div>
      <button type="button" className="zone-row-body" onClick={() => onSelect(node.id)}>
        <span className="zone-kind">{kind}</span>
        <span className="zone-text" title={text}>
          {text}
        </span>
      </button>
    </div>
  );
}

function HierarchyList({
  nodes,
  depth,
  ...rest
}: {
  nodes: LayoutNode[];
  depth: number;
  selectedId: string | null;
  dragOver: { targetId: string; place: 'before' | 'after' | 'into' } | null;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onDragEnd: () => void;
  onDragOverRow: (targetId: string, e: React.DragEvent) => void;
  onDragLeaveRow: (targetId: string) => void;
  onDropOnRow: (dragId: string, targetId: string, e: React.DragEvent) => void;
}) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.id}>
          <Row node={node} depth={depth} {...rest} />
          {node.type === 'group' && !node.collapsed && (
            <HierarchyList nodes={node.children} depth={depth + 1} {...rest} />
          )}
        </div>
      ))}
    </>
  );
}

export function ZoneHierarchy({
  root,
  selectedId,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onToggleCollapse,
  onMoveNode,
}: {
  root: LayoutNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onMoveNode: (
    dragId: string,
    targetId: string,
    placement: 'before' | 'after' | 'into',
  ) => void;
}) {
  const [dragOver, setDragOver] = useState<{
    targetId: string;
    place: 'before' | 'after' | 'into';
  } | null>(null);

  const onDragOverRow = useCallback((targetId: string, e: React.DragEvent) => {
    const found = findNodeInTree(root, targetId);
    const place = placementFromEvent(e, found?.type === 'group');
    setDragOver({ targetId, place });
  }, [root]);

  const onDragLeaveRow = useCallback((targetId: string) => {
    setDragOver((prev) => (prev?.targetId === targetId ? null : prev));
  }, []);

  const onDropOnRow = useCallback(
    (dragId: string, targetId: string, e: React.DragEvent) => {
      const foundNode = findNodeInTree(root, targetId);
      const place = placementFromEvent(e, foundNode?.type === 'group');
      setDragOver(null);
      if (dragId === targetId) return;
      if (place === 'into' && foundNode?.type !== 'group') return;
      onMoveNode(dragId, targetId, place);
    },
    [root, onMoveNode],
  );

  const handleDragEnd = useCallback(() => {
    setDragOver(null);
  }, []);

  return (
    <aside className="zone-hierarchy">
      <h3>Zone hierarchy</h3>
      <p className="muted zone-hierarchy-hint">
        Drag <strong>⋮⋮</strong> to reorder. On a <strong>group</strong>, drop on the <strong>middle</strong> of the row
        to nest inside. Top/bottom = reorder above/below.
      </p>
      <div className="zone-tree">
        {root.length === 0 && <p className="muted">No zones yet.</p>}
        <HierarchyList
          nodes={root}
          depth={0}
          selectedId={selectedId}
          dragOver={dragOver}
          onSelect={onSelect}
          onToggleVisible={onToggleVisible}
          onToggleLock={onToggleLock}
          onToggleCollapse={onToggleCollapse}
          onDragEnd={handleDragEnd}
          onDragOverRow={onDragOverRow}
          onDragLeaveRow={onDragLeaveRow}
          onDropOnRow={onDropOnRow}
        />
      </div>
    </aside>
  );
}
