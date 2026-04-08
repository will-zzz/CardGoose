import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Loader2, User } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { useStudioChrome } from '../contexts/StudioChrome';
import { isMacLike } from '../lib/platform';
import type { ProjectTab } from '../contexts/studioChromeTypes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { BrandLogo } from './BrandLogo';

function AppMenu({
  label,
  children,
}: {
  label: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  return (
    <div
      className="app-menu-item"
      ref={ref}
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="app-menu-trigger"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && (
        <div className="app-menu-panel" role="menu">
          {children(close)}
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="account-menu-trigger" aria-label="Account menu">
          <User size={16} strokeWidth={2} aria-hidden />
          <span className="account-menu-email">{user?.username ?? 'Account'}</span>
          <ChevronDown size={14} strokeWidth={2} aria-hidden className="account-menu-chevron" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="dropdown-menu-label-muted">
          Signed in as {user?.username}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="dropdown-menu-item-row" onSelect={() => navigate('/')}>
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="dropdown-menu-item-row dropdown-menu-item-danger"
          onSelect={() => logout()}
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Account on project route — includes sheets status */
function AccountMenuProject({
  projectId,
  hasPublishedSheet,
}: {
  projectId: string;
  hasPublishedSheet: boolean;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="account-menu-trigger" aria-label="Account menu">
          <User size={16} strokeWidth={2} aria-hidden />
          <span className="account-menu-email">{user?.username ?? 'Account'}</span>
          <ChevronDown size={14} strokeWidth={2} aria-hidden className="account-menu-chevron" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="dropdown-menu-label-muted">
          Signed in as {user?.username}
        </DropdownMenuLabel>
        <p className="dropdown-menu-info">
          Sheets:{' '}
          <span className={hasPublishedSheet ? 'dropdown-menu-sheets-ok' : ''}>
            {hasPublishedSheet ? 'Linked' : 'Not set'}
          </span>
        </p>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="dropdown-menu-item-row" onSelect={() => navigate('/')}>
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          className="dropdown-menu-item-row"
          onSelect={() => navigate(`/projects/${projectId}?tab=pipeline`)}
        >
          Project settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="dropdown-menu-item-row dropdown-menu-item-danger"
          onSelect={() => logout()}
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DashboardBar() {
  const { layoutEditor } = useStudioChrome();

  return (
    <header className="studio-shell-header studio-shell-header--dash" role="banner">
      <div className="studio-shell-row">
        <Link
          to="/"
          className="studio-shell-brand"
          onClick={(e) => layoutEditor?.onNavigateHomeClick(e)}
        >
          <span className="studio-shell-logo" aria-hidden>
            <BrandLogo heightPx={20} />
          </span>
          <span className="studio-shell-brand-text">CardGoose</span>
        </Link>
        <div className="studio-shell-fill" aria-hidden />
        <AccountMenu />
      </div>
    </header>
  );
}

function ProjectTabsBar() {
  const { projectViewNav } = useStudioChrome();
  const projectId = projectViewNav?.projectId;
  if (!projectId) return null;

  const tab = projectViewNav.tab;
  const navigateTab = projectViewNav.navigateTab;
  const projectName = projectViewNav.projectName;
  const hasSheet = projectViewNav.hasPublishedSheet;
  const onNavigateHomeClick = projectViewNav.onNavigateHomeClick;

  const items: { id: ProjectTab; label: string }[] = [
    { id: 'cards', label: 'Cards' },
    { id: 'layouts', label: 'Layouts' },
    { id: 'data', label: 'Data' },
    { id: 'pipeline', label: 'Assets & export' },
  ];

  return (
    <header className="studio-shell-header studio-shell-header--project" role="banner">
      <div className="studio-shell-row studio-shell-row--project">
        <div className="studio-shell-left">
          <Link
            to="/"
            className="studio-shell-brand studio-shell-brand--compact"
            onClick={(e) => onNavigateHomeClick(e)}
            aria-label="Home"
          >
            <span className="studio-shell-logo" aria-hidden>
              <BrandLogo heightPx={20} />
            </span>
          </Link>
          <span className="studio-shell-project-name">{projectName}</span>
        </div>

        <nav className="project-tabs-nav" aria-label="Project sections">
          {items.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`project-tab${tab === id ? ' project-tab--active' : ''}`}
              onClick={() => navigateTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="studio-shell-right">
          <AccountMenuProject projectId={projectId} hasPublishedSheet={hasSheet} />
        </div>
      </div>
    </header>
  );
}

function ProjectLoadingBar() {
  return (
    <header className="studio-shell-header studio-shell-header--project" role="banner">
      <div className="studio-shell-row studio-shell-row--project">
        <div className="studio-shell-left">
          <Link to="/" className="studio-shell-brand studio-shell-brand--compact" aria-label="Home">
            <span className="studio-shell-logo" aria-hidden>
              <BrandLogo heightPx={20} />
            </span>
          </Link>
          <span className="studio-shell-project-name studio-shell-project-name--muted">
            Loading…
          </span>
        </div>
        <div className="studio-shell-fill" aria-hidden />
        <AccountMenu />
      </div>
    </header>
  );
}

function viewShortcutHints() {
  const mac = isMacLike();
  return {
    fit: mac ? '⌘0' : 'Ctrl+0',
    z100: mac ? '⌘1' : 'Ctrl+1',
    in: mac ? '⌘+' : 'Ctrl+Plus',
    out: mac ? '⌘−' : 'Ctrl+Minus',
  };
}

function EditorBar() {
  const { layoutEditor } = useStudioChrome();
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const syncFs = () => {
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
      };
      setFullscreen(!!(document.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', syncFs);
    document.addEventListener('webkitfullscreenchange', syncFs);
    syncFs();
    return () => {
      document.removeEventListener('fullscreenchange', syncFs);
      document.removeEventListener('webkitfullscreenchange', syncFs);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      const doc = document as Document & {
        webkitExitFullscreen?: () => Promise<void>;
        webkitFullscreenElement?: Element | null;
      };
      if (document.fullscreenElement || doc.webkitFullscreenElement) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
        return;
      }
      const el = document.documentElement;
      const hel = el as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (hel.webkitRequestFullscreen) await hel.webkitRequestFullscreen();
    } catch {
      /* user gesture or API unsupported */
    }
  }, []);

  if (!layoutEditor) return null;

  const le = layoutEditor;
  const vs = viewShortcutHints();

  return (
    <header className="studio-shell-header studio-shell-header--editor" role="banner">
      <div className="studio-shell-row studio-shell-row--editor-main">
        <div className="editor-breadcrumb">
          <Link
            to="/"
            className="studio-shell-brand studio-shell-brand--compact"
            onClick={(e) => le.onNavigateHomeClick(e)}
            aria-label="Home"
          >
            <span className="studio-shell-logo" aria-hidden>
              <BrandLogo heightPx={18} />
            </span>
          </Link>
          <ChevronRight size={14} className="editor-bc-sep" aria-hidden />
          <Link
            to={`/projects/${le.projectId}?tab=cards`}
            className="editor-bc-link"
            onClick={(e) => le.onNavigateToProjectCardsClick(e)}
          >
            {le.projectName}
          </Link>
          <ChevronRight size={14} className="editor-bc-sep" aria-hidden />
          <input
            type="text"
            className="editor-bc-input"
            value={le.layoutName}
            onChange={(e) => le.onLayoutNameChange(e.target.value)}
            disabled={le.busy}
            aria-label="Layout name"
          />
        </div>

        <div className="editor-bar-status-save">
          <div className="editor-save-status" role="status" aria-live="polite">
            {le.busy ? (
              <>
                <Loader2
                  className="editor-save-icon-spin editor-save-loader"
                  size={14}
                  aria-hidden
                />
                Saving…
              </>
            ) : le.layoutIsDirty ? (
              <>Unsaved changes</>
            ) : (
              <>All changes saved</>
            )}
          </div>
          <button
            type="button"
            className="editor-btn-secondary"
            onClick={() => void le.onSaveAndExit()}
            disabled={le.busy || le.saveDisabled}
          >
            Save &amp; exit
          </button>
        </div>
      </div>

      <div className="studio-shell-row studio-shell-row--editor-menus">
        <div className="editor-menus">
          <AppMenu label="File">
            {(close) => (
              <>
                <button
                  type="button"
                  className="app-menu-option"
                  role="menuitem"
                  onClick={() => {
                    close();
                    le.onSave();
                  }}
                  disabled={le.busy || le.saveDisabled}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="app-menu-option"
                  role="menuitem"
                  onClick={() => {
                    close();
                    void le.onSaveAs();
                  }}
                  disabled={le.busy}
                >
                  Save as…
                </button>
                <button
                  type="button"
                  className="app-menu-option"
                  role="menuitem"
                  onClick={() => {
                    close();
                    le.onResetToLastSync();
                  }}
                  disabled={le.busy}
                >
                  Reset to last sync
                </button>
                <button
                  type="button"
                  className="app-menu-option"
                  role="menuitem"
                  onClick={() => {
                    close();
                    le.onCloseEditor();
                  }}
                  disabled={le.busy}
                >
                  Close editor
                </button>
              </>
            )}
          </AppMenu>
          <AppMenu label="Edit">
            {(close) => (
              <>
                <button
                  type="button"
                  className="app-menu-option"
                  role="menuitem"
                  onClick={() => {
                    close();
                    le.onEditUndo();
                  }}
                  disabled={!le.canUndo}
                >
                  Undo
                </button>
                <button
                  type="button"
                  className="app-menu-option"
                  role="menuitem"
                  onClick={() => {
                    close();
                    le.onEditRedo();
                  }}
                  disabled={!le.canRedo}
                >
                  Redo
                </button>
                <button
                  type="button"
                  className="app-menu-option"
                  role="menuitem"
                  onClick={() => {
                    close();
                    le.onEditSelectAll();
                  }}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="app-menu-option"
                  role="menuitem"
                  onClick={() => {
                    close();
                    le.onEditClearCanvas();
                  }}
                  disabled={le.busy}
                >
                  Clear canvas
                </button>
              </>
            )}
          </AppMenu>
          <AppMenu label="View">
            {(close) => (
              <>
                <button
                  type="button"
                  className="app-menu-option"
                  role="menuitem"
                  onClick={() => {
                    close();
                    le.onViewZoomToFit();
                  }}
                >
                  <span className="app-menu-option-label">Zoom to Fit</span>
                  <span className="app-menu-option-shortcut">{vs.fit}</span>
                </button>
                <button
                  type="button"
                  className="app-menu-option"
                  role="menuitem"
                  onClick={() => {
                    close();
                    le.onViewZoomIn();
                  }}
                >
                  <span className="app-menu-option-label">Zoom In</span>
                  <span className="app-menu-option-shortcut">{vs.in}</span>
                </button>
                <button
                  type="button"
                  className="app-menu-option"
                  role="menuitem"
                  onClick={() => {
                    close();
                    le.onViewZoomOut();
                  }}
                >
                  <span className="app-menu-option-label">Zoom Out</span>
                  <span className="app-menu-option-shortcut">{vs.out}</span>
                </button>
                <button
                  type="button"
                  className="app-menu-option"
                  role="menuitem"
                  onClick={() => {
                    close();
                    le.onViewZoomTo100Percent();
                  }}
                >
                  <span className="app-menu-option-label">Zoom to 100%</span>
                  <span className="app-menu-option-shortcut">{vs.z100}</span>
                </button>
                <div className="app-menu-sep" role="separator" aria-hidden />
                <button
                  type="button"
                  className="app-menu-option"
                  role="menuitem"
                  title={fullscreen ? 'Press Esc to exit fullscreen' : undefined}
                  onClick={() => {
                    close();
                    void toggleFullscreen();
                  }}
                >
                  <span className="app-menu-option-label">
                    {fullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                  </span>
                  <span className="app-menu-option-shortcut">
                    {fullscreen ? 'Esc' : isMacLike() ? '⌃⌘F' : 'F11'}
                  </span>
                </button>
              </>
            )}
          </AppMenu>
        </div>
      </div>
    </header>
  );
}

export function StudioAppBar() {
  const location = useLocation();
  const { layoutEditor, projectViewNav } = useStudioChrome();
  const projectRoute = location.pathname.match(/^\/projects\/([^/]+)/);
  const projectId = projectRoute?.[1];
  const tabParam = new URLSearchParams(location.search).get('tab') || 'cards';
  const isLayoutRoute = projectId && tabParam === 'layout' && layoutEditor;

  if (isLayoutRoute) {
    return <EditorBar />;
  }

  if (projectId) {
    if (projectViewNav) {
      return <ProjectTabsBar />;
    }
    return <ProjectLoadingBar />;
  }

  return <DashboardBar />;
}
