import { type FormEvent, useState } from 'react';

export type LayoutListItem = { id: string; name: string; lastUpdated: string };

function formatUpdated(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function LayoutsListPanel(props: {
  layouts: LayoutListItem[];
  busy: boolean;
  onError: (msg: string | null) => void;
  onOpenLayout: (layoutId: string) => void;
  onCreateLayout: (name: string) => Promise<void>;
  onDeleteLayout: (layoutId: string) => Promise<void>;
}) {
  const { layouts, busy, onError, onOpenLayout, onCreateLayout, onDeleteLayout } = props;
  const [name, setName] = useState('');

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    onError(null);
    try {
      await onCreateLayout(trimmed);
      setName('');
    } catch {
      /* parent sets error */
    }
  }

  return (
    <div className="layouts-list-panel">
      <header className="page-header layouts-list-head">
        <h1>Layouts</h1>
        <form onSubmit={(e) => void onCreate(e)} className="inline-form layouts-list-create">
          <input
            placeholder="New layout name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            aria-label="New layout name"
          />
          <button type="submit" disabled={busy || !name.trim()}>
            Add
          </button>
        </form>
      </header>

      <ul className="project-list layout-project-list">
        {layouts.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              className="layout-list-row-hit"
              disabled={busy}
              onClick={() => onOpenLayout(l.id)}
            >
              <span className="layout-list-name">{l.name}</span>
              <span className="muted layout-list-updated">
                Updated {formatUpdated(l.lastUpdated)}
              </span>
            </button>
            <button
              type="button"
              className="link-danger"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                void onDeleteLayout(l.id);
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      {layouts.length === 0 && (
        <p className="muted">No layouts yet. Add one to design a card template.</p>
      )}
    </div>
  );
}
