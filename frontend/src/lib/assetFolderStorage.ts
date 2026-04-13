export type AssetFolderScope = 'project' | 'global';

export type StoredAssetFolder = {
  id: string;
  parentId: string | null;
  name: string;
  scope: AssetFolderScope;
};

export type AssetFolderStore = {
  folders: StoredAssetFolder[];
  /** Key `project:${assetId}` or `global:${assetId}` → folder id */
  assignments: Record<string, string>;
};

const STORE_VER = 'v1';

function key(projectId: string) {
  return `cardgoose.assetFolders.${STORE_VER}.${projectId}`;
}

export function loadAssetFolderStore(projectId: string): AssetFolderStore {
  try {
    const raw = localStorage.getItem(key(projectId));
    if (!raw) return { folders: [], assignments: {} };
    const p = JSON.parse(raw) as Partial<AssetFolderStore>;
    const folders = Array.isArray(p.folders) ? p.folders : [];
    const assignments = p.assignments && typeof p.assignments === 'object' ? p.assignments : {};
    return { folders, assignments };
  } catch {
    return { folders: [], assignments: {} };
  }
}

export function saveAssetFolderStore(projectId: string, state: AssetFolderStore): void {
  try {
    localStorage.setItem(key(projectId), JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export function newFolderId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
