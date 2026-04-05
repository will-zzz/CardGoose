export type LayoutEditorChrome = {
  projectId: string;
  layoutName: string;
  onLayoutNameChange: (name: string) => void;
  onSave: () => void;
  onSaveAndExit: () => void;
  onExit: () => void;
  onExport: () => void;
  onNavigateHomeClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  dataTabHref: string;
  hasPublishedSheet: boolean;
  busy: boolean;
  layoutIsDirty: boolean;
  lastSavedAt: Date | null;
  saveDisabled: boolean;
};

export type ProjectChromeHint = {
  projectId: string;
  hasPublishedSheet: boolean;
};
