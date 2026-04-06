import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { LayoutEditorChrome, ProjectViewNavState } from './studioChromeTypes';

type StudioChromeValue = {
  layoutEditor: LayoutEditorChrome | null;
  setLayoutEditorChrome: (next: LayoutEditorChrome | null) => void;
  projectViewNav: ProjectViewNavState | null;
  setProjectViewNav: (next: ProjectViewNavState | null) => void;
};

const StudioChromeContext = createContext<StudioChromeValue | null>(null);

export function StudioChromeProvider({ children }: { children: ReactNode }) {
  const [layoutEditor, setLayoutEditor] = useState<LayoutEditorChrome | null>(null);
  const [projectViewNav, setProjectViewNav] = useState<ProjectViewNavState | null>(null);

  const setLayoutEditorChrome = useCallback((next: LayoutEditorChrome | null) => {
    setLayoutEditor(next);
  }, []);

  const setProjectViewNavStable = useCallback((next: ProjectViewNavState | null) => {
    setProjectViewNav(next);
  }, []);

  const value = useMemo(
    () => ({
      layoutEditor,
      setLayoutEditorChrome,
      projectViewNav,
      setProjectViewNav: setProjectViewNavStable,
    }),
    [layoutEditor, setLayoutEditorChrome, projectViewNav, setProjectViewNavStable]
  );

  return <StudioChromeContext.Provider value={value}>{children}</StudioChromeContext.Provider>;
}

/** Colocated hook; Fast Refresh expects components-only in some setups. */
// eslint-disable-next-line react-refresh/only-export-components -- context hook
export function useStudioChrome() {
  const ctx = useContext(StudioChromeContext);
  if (!ctx) {
    throw new Error('useStudioChrome must be used within StudioChromeProvider');
  }
  return ctx;
}
