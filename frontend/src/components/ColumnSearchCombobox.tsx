import { Braces, ChevronsUpDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

type Props = {
  label: string;
  options: string[];
  value: string;
  onChange: (column: string) => void;
  placeholder?: string;
};

export function ColumnSearchCombobox({
  label,
  options,
  value,
  onChange,
  placeholder = 'Search columns…',
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const qLower = q.trim().toLowerCase();
  const filtered = qLower
    ? options.filter((o) => o.toLowerCase().includes(qLower))
    : options;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="layout-col-combo" ref={rootRef}>
      <span className="layout-col-combo-label">{label}</span>
      <button
        type="button"
        className="layout-col-combo-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="layout-col-combo-trigger-inner">
          {value ? (
            <>
              <Braces size={14} className="layout-col-combo-token-icon" aria-hidden />
              <span className="layout-col-combo-token">{`{{${value}}}`}</span>
            </>
          ) : (
            <span className="layout-col-combo-placeholder">Select a column…</span>
          )}
        </span>
        <ChevronsUpDown size={14} className="layout-col-combo-chev" aria-hidden />
      </button>
      {open && (
        <div id={listId} className="layout-col-combo-panel" role="listbox">
          <input
            type="search"
            className="layout-col-combo-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            autoFocus
          />
          <div className="layout-col-combo-actions">
            <button
              type="button"
              className="layout-col-combo-clear"
              onClick={() => {
                onChange('');
                setOpen(false);
                setQ('');
              }}
            >
              Clear
            </button>
          </div>
          <ul className="layout-col-combo-list">
            {filtered.length === 0 ? (
              <li className="layout-col-combo-empty">No matching columns.</li>
            ) : (
              filtered.map((o) => (
                <li key={o}>
                  <button
                    type="button"
                    className="layout-col-combo-option"
                    role="option"
                    aria-selected={value === o}
                    onClick={() => {
                      onChange(o);
                      setOpen(false);
                      setQ('');
                    }}
                  >
                    <Braces size={12} className="layout-col-combo-option-ico" aria-hidden />
                    <span>{o}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
