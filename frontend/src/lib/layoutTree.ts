import type { LayoutNode, LayoutStateV2 } from '../types/layout';

export function updateNodeInState(
  state: LayoutStateV2,
  id: string,
  fn: (n: LayoutNode) => LayoutNode,
): LayoutStateV2 {
  return { ...state, root: mapNodeById(state.root, id, fn) };
}

export function mapNodeById(
  nodes: LayoutNode[],
  id: string,
  fn: (n: LayoutNode) => LayoutNode,
): LayoutNode[] {
  return nodes.map((n) => {
    if (n.id === id) return fn(n);
    if (n.type === 'group') {
      return { ...n, children: mapNodeById(n.children, id, fn) };
    }
    return n;
  });
}

export function removeNodeById(nodes: LayoutNode[], id: string): LayoutNode[] {
  const out: LayoutNode[] = [];
  for (const n of nodes) {
    if (n.id === id) continue;
    if (n.type === 'group') {
      out.push({ ...n, children: removeNodeById(n.children, id) });
    } else {
      out.push(n);
    }
  }
  return out;
}

export function findNode(
  nodes: LayoutNode[],
  id: string,
): { node: LayoutNode; parentList: LayoutNode[]; index: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.id === id) return { node: n, parentList: nodes, index: i };
    if (n.type === 'group') {
      const inner = findNode(n.children, id);
      if (inner) return inner;
    }
  }
  return null;
}

/** Parent list is `nodes` whose direct child has `id`. */
export function findParentContext(
  nodes: LayoutNode[],
  id: string,
  parentGroupId: 'root' | string = 'root',
): { parentId: 'root' | string; siblings: LayoutNode[]; index: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) {
      return { parentId: parentGroupId, siblings: nodes, index: i };
    }
  }
  for (const n of nodes) {
    if (n.type === 'group') {
      const deeper = findParentContext(n.children, id, n.id);
      if (deeper) return deeper;
    }
  }
  return null;
}

export function appendNode(
  root: LayoutNode[],
  parentId: 'root' | string,
  child: LayoutNode,
): LayoutNode[] {
  if (parentId === 'root') return [...root, child];
  return mapNodeById(root, parentId, (n) => {
    if (n.type !== 'group') return n;
    return { ...n, children: [...n.children, child] };
  });
}

/** Insert immediately after `siblingId` within the same sibling array (any depth). */
export function insertAfterSiblingDeep(
  root: LayoutNode[],
  siblingId: string,
  node: LayoutNode,
): LayoutNode[] {
  function rec(list: LayoutNode[]): LayoutNode[] {
    const idx = list.findIndex((n) => n.id === siblingId);
    if (idx >= 0) {
      return [...list.slice(0, idx + 1), node, ...list.slice(idx + 1)];
    }
    return list.map((n) =>
      n.type === 'group' ? { ...n, children: rec(n.children) } : n,
    );
  }
  return rec(root);
}

export function moveSibling(root: LayoutNode[], id: string, dir: -1 | 1): LayoutNode[] {
  function rec(list: LayoutNode[]): LayoutNode[] {
    const i = list.findIndex((n) => n.id === id);
    if (i >= 0) {
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    }
    return list.map((n) =>
      n.type === 'group' ? { ...n, children: rec(n.children) } : n,
    );
  }
  return rec(root);
}

export function cloneWithNewIds(node: LayoutNode): LayoutNode {
  if (node.type === 'group') {
    return {
      ...node,
      id: crypto.randomUUID(),
      children: node.children.map(cloneWithNewIds),
    };
  }
  return { ...node, id: crypto.randomUUID() };
}

export function isVisible(n: LayoutNode): boolean {
  return n.visible !== false;
}

export function isLocked(n: LayoutNode): boolean {
  return n.locked === true;
}

/** Add node: into selected group, or after selected leaf, or root. */
export function applyInsert(
  state: LayoutStateV2,
  child: LayoutNode,
  selectedId: string | null,
): LayoutStateV2 {
  if (!selectedId) {
    return { ...state, root: appendNode(state.root, 'root', child) };
  }
  const found = findNode(state.root, selectedId);
  if (!found) {
    return { ...state, root: appendNode(state.root, 'root', child) };
  }
  if (found.node.type === 'group') {
    return { ...state, root: appendNode(state.root, found.node.id, child) };
  }
  return { ...state, root: insertAfterSiblingDeep(state.root, selectedId, child) };
}
