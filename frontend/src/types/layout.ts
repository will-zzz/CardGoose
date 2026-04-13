/** Card template JSON (Layout.state). v2 = flat list of zones (no groups). */

export type LayoutLeafFlags = {
  visible?: boolean;
  locked?: boolean;
  rotation?: number;
};

export type LayoutText = LayoutLeafFlags & {
  type: 'text';
  id: string;
  x: number;
  y: number;
  width?: number;
  text: string;
  fontSize?: number;
  fill?: string;
  align?: 'left' | 'center' | 'right';
};

export type LayoutImage = LayoutLeafFlags & {
  type: 'image';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Legacy template (e.g. {{Column}}); used when dynamicSourceColumn is not set. */
  artKey: string;
  /** CSV column header: cell value is resolved to an asset (project, then global, fuzzy). */
  dynamicSourceColumn?: string | null;
  /** Static art key when the dynamic cell is empty or resolution fails. */
  fallbackArtKey?: string | null;
};

export type LayoutRect = LayoutLeafFlags & {
  type: 'rect';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
};

/** @deprecated Loaded from old saves only; flattened to leaves on read. */
export type LayoutGroup = {
  type: 'group';
  id: string;
  name: string;
  x: number;
  y: number;
  visible?: boolean;
  locked?: boolean;
  rotation?: number;
  collapsed?: boolean;
  children: LayoutNode[];
};

export type LayoutNode = LayoutGroup | LayoutText | LayoutImage | LayoutRect;

export type LayoutElement = LayoutText | LayoutImage | LayoutRect;

export type LayoutStateV1 = {
  version: 1;
  width: number;
  height: number;
  background?: string;
  elements: LayoutElement[];
};

export type LayoutStateV2 = {
  version: 2;
  width: number;
  height: number;
  background?: string;
  /** Editor-only preference; stored for convenience */
  showGrid?: boolean;
  root: LayoutElement[];
};

function flattenNodes(nodes: LayoutNode[], ox = 0, oy = 0): LayoutElement[] {
  const out: LayoutElement[] = [];
  for (const n of nodes) {
    if (n.type === 'group') {
      out.push(...flattenNodes(n.children, ox + n.x, oy + n.y));
    } else {
      out.push({ ...n, x: n.x + ox, y: n.y + oy });
    }
  }
  return out;
}

export const DEFAULT_NEW_TEXT = 'Card Name';

export function defaultLayoutState(): LayoutStateV2 {
  return {
    version: 2,
    width: 250,
    height: 350,
    background: '#1e1e24',
    showGrid: false,
    root: [
      {
        type: 'text',
        id: crypto.randomUUID(),
        x: 12,
        y: 140,
        width: 226,
        text: DEFAULT_NEW_TEXT,
        fontSize: 18,
        fill: '#f3f4f6',
        align: 'center',
        visible: true,
        locked: false,
      },
    ],
  };
}

function migrateV1ToV2(v1: LayoutStateV1): LayoutStateV2 {
  const root: LayoutElement[] = v1.elements.map((el) => ({
    ...el,
    visible: true,
    locked: false,
  }));
  return {
    version: 2,
    width: v1.width,
    height: v1.height,
    background: v1.background,
    showGrid: false,
    root,
  };
}

export function isLayoutStateV1(v: unknown): v is LayoutStateV1 {
  if (!v || typeof v !== 'object') return false;
  const o = v as LayoutStateV1;
  return (
    o.version === 1 &&
    typeof o.width === 'number' &&
    typeof o.height === 'number' &&
    Array.isArray(o.elements)
  );
}

export function isLayoutStateV2(v: unknown): v is LayoutStateV2 {
  if (!v || typeof v !== 'object') return false;
  const o = v as LayoutStateV2;
  return (
    o.version === 2 &&
    typeof o.width === 'number' &&
    typeof o.height === 'number' &&
    Array.isArray(o.root)
  );
}

export function ensureLayoutState(raw: unknown): LayoutStateV2 {
  if (isLayoutStateV2(raw)) {
    const flat = flattenNodes(raw.root as LayoutNode[]);
    return { ...raw, root: flat };
  }
  if (isLayoutStateV1(raw)) return migrateV1ToV2(raw);
  return defaultLayoutState();
}
