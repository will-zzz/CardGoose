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

function Row({
  node,
  depth,
  selectedId,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onToggleCollapse,
  onMoveUp,
  onMoveDown,
}: {
  node: LayoutNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}) {
  const sel = node.id === selectedId;
  const vis = isVisible(node);
  const lock = isLocked(node);
  const kind = kindLabel(node);
  const text = contentLabel(node);

  return (
    <div
      className={`zone-row${sel ? ' zone-row-selected' : ''}`}
      style={{ paddingLeft: Math.min(depth, 8) * 12 }}
    >
      <div className="zone-row-tools">
        <span className="zone-grip" aria-hidden title="Layer (drag reorder coming soon)">
          ⋮⋮
        </span>
        {node.type === 'group' ? (
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
      <div className="zone-order">
        <button type="button" className="link-btn" onClick={() => onMoveUp(node.id)} title="Move up">
          ↑
        </button>
        <button type="button" className="link-btn" onClick={() => onMoveDown(node.id)} title="Move down">
          ↓
        </button>
      </div>
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
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
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
  onMoveUp,
  onMoveDown,
}: {
  root: LayoutNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}) {
  return (
    <aside className="zone-hierarchy">
      <h3>Zone hierarchy</h3>
      <p className="muted zone-hierarchy-hint">
        Layers stack top → bottom. Groups nest children. Icons: show/hide, lock.
      </p>
      <div className="zone-tree">
        {root.length === 0 && <p className="muted">No zones yet.</p>}
        <HierarchyList
          nodes={root}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          onToggleVisible={onToggleVisible}
          onToggleLock={onToggleLock}
          onToggleCollapse={onToggleCollapse}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
      </div>
    </aside>
  );
}
