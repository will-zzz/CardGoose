import { useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Loader2,
  LogOut,
  User,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { useStudioChrome } from '../contexts/StudioChrome';

function MenuDropdown({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      className="studio-menubar-item"
      ref={ref}
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="studio-menubar-trigger"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <ChevronDown size={14} strokeWidth={2} aria-hidden className="studio-menubar-chevron" />
      </button>
      {open && (
        <div className="studio-menubar-panel" role="menu">
          {children}
        </div>
      )}
    </div>
  );
}

export function StudioAppBar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { layoutEditor, projectHint } = useStudioChrome();
  const projectRoute = location.pathname.match(/^\/projects\/([^/]+)/);
  const projectId = projectRoute?.[1];

  return (
    <header className="studio-app-bar" role="banner">
      <div className="studio-app-bar-row studio-app-bar-row--primary">
        <Link to="/" className="studio-brand" onClick={(e) => layoutEditor?.onNavigateHomeClick(e)}>
          CardboardForge Studio
        </Link>

        <nav className="studio-menubar" aria-label="Application menu">
          <MenuDropdown label="File">
            <button type="button" className="studio-menubar-option" disabled role="menuitem">
              New layout…
            </button>
            <Link
              to="/"
              className="studio-menubar-option studio-menubar-option--link"
              role="menuitem"
              onClick={(e) => layoutEditor?.onNavigateHomeClick(e)}
            >
              All projects
            </Link>
          </MenuDropdown>
          <MenuDropdown label="Edit">
            <span className="studio-menubar-hint">Use ⌘Z / ⌘⇧Z in the layout canvas</span>
          </MenuDropdown>
          <Link
            to="/"
            className={`studio-menubar-link${location.pathname === '/' ? ' studio-menubar-link--active' : ''}`}
            onClick={(e) => layoutEditor?.onNavigateHomeClick(e)}
          >
            Projects
          </Link>
          {projectId && (
            <Link to={`/projects/${projectId}?tab=data`} className="studio-menubar-link">
              Data sources
            </Link>
          )}
        </nav>

        <div className="studio-app-bar-spacer" aria-hidden />

        {layoutEditor && (
          <div className="studio-layout-chrome" role="group" aria-label="Layout editor">
            <label className="studio-layout-name-wrap">
              <span className="studio-layout-name-label">Layout</span>
              <input
                type="text"
                className="studio-layout-name-input"
                value={layoutEditor.layoutName}
                onChange={(e) => layoutEditor.onLayoutNameChange(e.target.value)}
                disabled={layoutEditor.busy}
                placeholder="Name"
                aria-label="Layout name"
              />
            </label>
            <div
              className={`studio-save-pill${layoutEditor.layoutIsDirty ? ' studio-save-pill--dirty' : ''}`}
              role="status"
              aria-live="polite"
            >
              {layoutEditor.busy ? (
                <>
                  <Loader2 className="studio-save-icon studio-save-icon--spin" aria-hidden />
                  Saving…
                </>
              ) : layoutEditor.layoutIsDirty ? (
                <>
                  <CircleAlert className="studio-save-icon" aria-hidden />
                  Unsaved
                </>
              ) : (
                <>
                  <CheckCircle2 className="studio-save-icon" aria-hidden />
                  Saved
                  {layoutEditor.lastSavedAt && (
                    <span className="studio-save-time">
                      {layoutEditor.lastSavedAt.toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </>
              )}
            </div>
            <button
              type="button"
              className="studio-btn studio-btn--ghost"
              onClick={layoutEditor.onExit}
              disabled={layoutEditor.busy}
            >
              Exit editor
            </button>
            <button
              type="button"
              className="studio-btn studio-btn--accent"
              onClick={() => void layoutEditor.onSave()}
              disabled={layoutEditor.busy || layoutEditor.saveDisabled}
              title="Save (⌘S / Ctrl+S)"
            >
              Save
            </button>
            <button
              type="button"
              className="studio-btn studio-btn--ghost"
              onClick={() => void layoutEditor.onSaveAndExit()}
              disabled={layoutEditor.busy || layoutEditor.saveDisabled}
            >
              Save &amp; exit
            </button>
            <button
              type="button"
              className="studio-btn studio-btn--ghost"
              onClick={() => void layoutEditor.onExport()}
              disabled={layoutEditor.busy}
            >
              Export
            </button>
            <button
              type="button"
              className="studio-btn studio-btn--prototype"
              onClick={() => {
                window.alert('Physical prototype ordering will be available in a future release.');
              }}
            >
              Order physical prototype
            </button>
          </div>
        )}

        <div className="studio-app-bar-account">
          {projectId && (
            <Link
              to={`/projects/${projectId}?tab=data`}
              className={`studio-sync-badge${
                projectHint?.projectId === projectId && projectHint.hasPublishedSheet
                  ? ' studio-sync-badge--ok'
                  : ''
              }`}
              title="Open Data tab to manage Google Sheets link"
            >
              Sheets{' '}
              {projectHint?.projectId === projectId && projectHint.hasPublishedSheet
                ? 'linked'
                : 'not set'}
            </Link>
          )}
          <span className="studio-user">
            <User size={14} strokeWidth={2} aria-hidden />
            {user?.username}
          </span>
          <button type="button" className="studio-btn studio-btn--ghost studio-btn--icon-text" onClick={logout}>
            <LogOut size={16} strokeWidth={2} aria-hidden />
            Log out
          </button>
        </div>
      </div>

    </header>
  );
}
