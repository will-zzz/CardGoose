import type { MouseEvent } from 'react';

export type LayoutEditorChrome = {
  projectId: string;
  projectName: string;
  layoutName: string;
  onLayoutNameChange: (name: string) => void;
  onNavigateHomeClick: (e: MouseEvent<HTMLAnchorElement>) => void;
  onNavigateToProjectCardsClick: (e: MouseEvent<HTMLAnchorElement>) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onResetToLastSync: () => void;
  onCloseEditor: () => void;
  onEditUndo: () => void;
  onEditRedo: () => void;
  onEditSelectAll: () => void;
  onEditClearCanvas: () => void;
  onViewZoomToFit: () => void;
  onViewZoomIn: () => void;
  onViewZoomOut: () => void;
  onViewZoomTo100Percent: () => void;
  canUndo: boolean;
  canRedo: boolean;
  busy: boolean;
  layoutIsDirty: boolean;
  lastSavedAt: Date | null;
  saveDisabled: boolean;
  onSaveAndExit: () => void;
};

export type ProjectTab = 'data' | 'layout' | 'cards' | 'pipeline';

/** Navbar for /projects/:id when not in layout editor */
export type ProjectViewNavState = {
  projectId: string;
  projectName: string;
  tab: ProjectTab;
  hasPublishedSheet: boolean;
  navigateTab: (t: ProjectTab) => void;
  /** Confirm if layout has unsaved changes (even when viewing another tab). */
  onNavigateHomeClick: (e: MouseEvent<HTMLAnchorElement>) => void;
};
