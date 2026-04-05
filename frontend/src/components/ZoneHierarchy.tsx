import { useCallback, useState } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  LayoutGrid,
  Layers,
  Lock,
  Minus,
  Redo2,
  Trash2,
  Type,
  Undo2,
  Unlock,
} from 'lucide-react';
import type { LayoutElement } from '../types/layout';
import { isLocked, isVisible } from '../lib/layoutTree';

export type ZoneHierarchyToolbarProps = {
  onAddText: () => void;
  onAddBar: () => void;
  onAddImage: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleGrid: () => void;
  canUndo: boolean;
  canRedo: boolean;
  showGrid: boolean;
  hasSelection: boolean;
};

function kindLabel(node: LayoutElement): string {
  if (node.type === 'text') return 'Text';
  if (node.type === 'image') return 'Image';
  return 'Shape';
}

function contentLabel(node: LayoutElement): string {
  if (node.type === 'text') {
    const t = node.text ?? '';
    return t.length > 40 ? `${t.slice(0, 40)}…` : t;
  }
  if (node.type === 'image') return node.artKey || 'image';
  return 'Bar';
}

const ZONE_MIME = 'application/x-cardboard-zone';

function placementFromEvent(e: React.DragEvent): 'before' | 'after' {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const y = e.clientY - rect.top;
  const r = rect.height > 0 ? y / rect.height : 0.5;
  return r < 0.5 ? 'before' : 'after';
}

function ZoneToolbar({
  onAddText,
  onAddBar,
  onAddImage,
  onDuplicate,
  onRemove,
  onUndo,
  onRedo,
  onToggleGrid,
  canUndo,
  canRedo,
  showGrid,
  hasSelection,
}: ZoneHierarchyToolbarProps) {
  return (
    <div className="zone-hierarchy-toolbar" role="toolbar" aria-label="Layout tools">
      <button
        type="button"
        className="zone-icon-btn"
        onClick={onAddText}
        title="Add text"
        aria-label="Add text"
      >
        <Type size={18} strokeWidth={2} />
      </button>
      <button
        type="button"
        className="zone-icon-btn"
        onClick={onAddBar}
        title="Add bar"
        aria-label="Add bar"
      >
        <Minus size={18} strokeWidth={2} />
      </button>
      <button
        type="button"
        className="zone-icon-btn"
        onClick={onAddImage}
        title="Add image"
        aria-label="Add image"
      >
        <ImageIcon size={18} strokeWidth={2} />
      </button>
      <span className="zone-hierarchy-toolbar-sep" aria-hidden />
      <button
        type="button"
        className="zone-icon-btn"
        onClick={onDuplicate}
        disabled={!hasSelection}
        title="Duplicate"
        aria-label="Duplicate"
      >
        <Copy size={18} strokeWidth={2} />
      </button>
      <button
        type="button"
        className="zone-icon-btn zone-icon-btn--danger"
        onClick={onRemove}
        disabled={!hasSelection}
        title="Remove"
        aria-label="Remove"
      >
        <Trash2 size={18} strokeWidth={2} />
      </button>
      <button
        type="button"
        className="zone-icon-btn"
        disabled
        title="Group (coming soon)"
        aria-label="Group"
      >
        <Layers size={18} strokeWidth={2} />
      </button>
      <span className="zone-hierarchy-toolbar-sep" aria-hidden />
      <button
        type="button"
        className="zone-icon-btn"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (⌘Z)"
        aria-label="Undo"
      >
        <Undo2 size={18} strokeWidth={2} />
      </button>
      <button
        type="button"
        className="zone-icon-btn"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (⌘⇧Z)"
        aria-label="Redo"
      >
        <Redo2 size={18} strokeWidth={2} />
      </button>
      <button
        type="button"
        className={`zone-icon-btn${showGrid ? ' zone-icon-btn--active' : ''}`}
        onClick={onToggleGrid}
        title={showGrid ? 'Hide grid' : 'Show grid'}
        aria-label="Toggle grid"
        aria-pressed={showGrid}
      >
        <LayoutGrid size={18} strokeWidth={2} />
      </button>
    </div>
  );
}

function Row({
  node,
  selectedId,
  dragOver,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onDragEnd,
  onDragOverRow,
  onDragLeaveRow,
  onDropOnRow,
}: {
  node: LayoutElement;
  selectedId: string | null;
  dragOver: { targetId: string; place: 'before' | 'after' } | null;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
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
  const hint = dragOver?.targetId === node.id ? dragOver.place : null;
  const rowClass = [
    'zone-row',
    sel ? 'zone-row-selected' : '',
    hint === 'before' ? 'zone-row--hint-before' : '',
    hint === 'after' ? 'zone-row--hint-after' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rowClass}
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
          title="Drag to reorder layers"
          aria-grabbed={undefined}
          onDragStart={(e) => {
            e.dataTransfer.setData(ZONE_MIME, node.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={() => onDragEnd()}
        >
          ⋮⋮
        </span>
        <span className="zone-collapse-spacer" aria-hidden />
        <button
          type="button"
          className="zone-tool zone-tool--icon"
          onClick={() => onToggleVisible(node.id)}
          aria-label={vis ? 'Hide layer' : 'Show layer'}
          title={vis ? 'Hide layer' : 'Show layer'}
        >
          {vis ? <Eye size={16} strokeWidth={2} /> : <EyeOff size={16} strokeWidth={2} />}
        </button>
        <button
          type="button"
          className={`zone-tool zone-tool--icon${lock ? ' zone-tool-locked' : ''}`}
          onClick={() => onToggleLock(node.id)}
          aria-label={lock ? 'Unlock' : 'Lock'}
          title={lock ? 'Unlock (allow edits)' : 'Lock (prevent edits)'}
        >
          {lock ? <Lock size={16} strokeWidth={2} /> : <Unlock size={16} strokeWidth={2} />}
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

export function ZoneHierarchy({
  root,
  selectedId,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onMoveNode,
  toolbar,
}: {
  root: LayoutElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onMoveNode: (dragId: string, targetId: string, placement: 'before' | 'after') => void;
  toolbar: ZoneHierarchyToolbarProps;
}) {
  const [dragOver, setDragOver] = useState<{
    targetId: string;
    place: 'before' | 'after';
  } | null>(null);

  const onDragOverRow = useCallback((targetId: string, e: React.DragEvent) => {
    const place = placementFromEvent(e);
    setDragOver({ targetId, place });
  }, []);

  const onDragLeaveRow = useCallback((targetId: string) => {
    setDragOver((prev) => (prev?.targetId === targetId ? null : prev));
  }, []);

  const onDropOnRow = useCallback(
    (dragId: string, targetId: string, e: React.DragEvent) => {
      const place = placementFromEvent(e);
      setDragOver(null);
      if (dragId === targetId) return;
      onMoveNode(dragId, targetId, place);
    },
    [onMoveNode],
  );

  const handleDragEnd = useCallback(() => {
    setDragOver(null);
  }, []);

  return (
    <aside className="zone-hierarchy">
      <ZoneToolbar {...toolbar} />
      <h3 className="zone-hierarchy-heading">Layers</h3>
      <p className="muted zone-hierarchy-hint">
        Drag <strong>⋮⋮</strong> to reorder. Drop on the top or bottom half of a row to place above or below.
      </p>
      <div className="zone-tree">
        {root.length === 0 && <p className="muted">No zones yet.</p>}
        {root.map((node) => (
          <Row
            key={node.id}
            node={node}
            selectedId={selectedId}
            dragOver={dragOver}
            onSelect={onSelect}
            onToggleVisible={onToggleVisible}
            onToggleLock={onToggleLock}
            onDragEnd={handleDragEnd}
            onDragOverRow={onDragOverRow}
            onDragLeaveRow={onDragLeaveRow}
            onDropOnRow={onDropOnRow}
          />
        ))}
      </div>
    </aside>
  );
}
