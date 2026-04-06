import type { LayoutElement, LayoutStateV2 } from '../types/layout';

export function updateNodeInState(
  state: LayoutStateV2,
  id: string,
  fn: (n: LayoutElement) => LayoutElement
): LayoutStateV2 {
  return { ...state, root: state.root.map((n) => (n.id === id ? fn(n) : n)) };
}

export function findNode(
  root: LayoutElement[],
  id: string
): { node: LayoutElement; index: number } | null {
  const index = root.findIndex((n) => n.id === id);
  if (index < 0) return null;
  return { node: root[index], index };
}

export function removeNodeById(root: LayoutElement[], id: string): LayoutElement[] {
  return root.filter((n) => n.id !== id);
}

export function insertAfterSiblingDeep(
  root: LayoutElement[],
  siblingId: string,
  node: LayoutElement
): LayoutElement[] {
  const idx = root.findIndex((n) => n.id === siblingId);
  if (idx >= 0) {
    return [...root.slice(0, idx + 1), node, ...root.slice(idx + 1)];
  }
  return [...root, node];
}

export function insertBeforeDeep(
  root: LayoutElement[],
  targetId: string,
  node: LayoutElement
): LayoutElement[] {
  const idx = root.findIndex((n) => n.id === targetId);
  if (idx >= 0) {
    return [...root.slice(0, idx), node, ...root.slice(idx)];
  }
  return [...root, node];
}

/** Reorder a flat root list (no nesting). */
export function moveNodeInFlatList(
  root: LayoutElement[],
  dragId: string,
  targetId: string,
  placement: 'before' | 'after'
): LayoutElement[] {
  if (dragId === targetId) return root;
  const extracted = root.find((n) => n.id === dragId);
  if (!extracted) return root;
  const without = root.filter((n) => n.id !== dragId);
  const ti = without.findIndex((n) => n.id === targetId);
  if (ti < 0) return root;
  const insertAt = placement === 'before' ? ti : ti + 1;
  return [...without.slice(0, insertAt), extracted, ...without.slice(insertAt)];
}

export function cloneWithNewIds(node: LayoutElement): LayoutElement {
  return { ...node, id: crypto.randomUUID() };
}

export function isVisible(n: LayoutElement): boolean {
  return n.visible !== false;
}

export function isLocked(n: LayoutElement): boolean {
  return n.locked === true;
}

export function applyInsert(
  state: LayoutStateV2,
  child: LayoutElement,
  selectedId: string | null
): LayoutStateV2 {
  if (!selectedId) {
    return { ...state, root: [...state.root, child] };
  }
  const found = findNode(state.root, selectedId);
  if (!found) {
    return { ...state, root: [...state.root, child] };
  }
  return { ...state, root: insertAfterSiblingDeep(state.root, selectedId, child) };
}
