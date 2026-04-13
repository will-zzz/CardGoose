import { Loader2 } from 'lucide-react';

type ExportRow = { key: string; url: string };

type ExportTabPanelProps = {
  busy: boolean;
  exportPdfLoading: boolean;
  exportPdfStatus: string | null;
  exportPdfDpi: number;
  onExportPdfDpiChange: (dpi: number) => void;
  onExportPdf: () => void;
  exports: ExportRow[];
};

export function ExportTabPanel({
  busy,
  exportPdfLoading,
  exportPdfStatus,
  exportPdfDpi,
  onExportPdfDpiChange,
  onExportPdf,
  exports,
}: ExportTabPanelProps) {
  return (
    <div className="export-tab">
      <section className="section">
        <h2>Export PDF</h2>
        <p className="muted" style={{ maxWidth: 560 }}>
          Enqueues on SQS — the request finishes quickly while a worker renders the PDF. Run{' '}
          <code>python -m baker.main</code> (or your ECS worker) with <code>RENDER_URL</code> set
          to this dev server.
        </p>
        <label className="stack" style={{ maxWidth: 360, marginBottom: 12 }}>
          <span>
            Export DPI: <strong>{exportPdfDpi}</strong> (higher = sharper, slower)
          </span>
          <input
            type="range"
            min={150}
            max={300}
            step={1}
            value={exportPdfDpi}
            onChange={(e) => onExportPdfDpiChange(Number(e.target.value))}
            disabled={busy || exportPdfLoading}
            aria-valuemin={150}
            aria-valuemax={300}
            aria-valuenow={exportPdfDpi}
          />
        </label>
        <div className="inline-form" style={{ alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={onExportPdf} disabled={busy || exportPdfLoading}>
            {exportPdfLoading ? (
              <>
                <Loader2
                  className="editor-save-icon-spin editor-save-loader"
                  size={16}
                  aria-hidden
                  style={{ verticalAlign: 'middle', marginRight: 6 }}
                />
                Queueing…
              </>
            ) : (
              'Export PDF'
            )}
          </button>
          {exportPdfLoading && (
            <span className="muted" aria-live="polite">
              Sending to queue…
            </span>
          )}
        </div>
        {exportPdfStatus && !exportPdfLoading && (
          <p className="muted" style={{ marginTop: 8 }} aria-live="polite">
            {exportPdfStatus}
          </p>
        )}
      </section>

      <section className="section">
        <h2>Completed exports</h2>
        <ul>
          {exports.map((ex) => (
            <li key={ex.key}>
              <a href={ex.url} target="_blank" rel="noreferrer">
                {ex.key}
              </a>
            </li>
          ))}
        </ul>
        {exports.length === 0 && (
          <p className="muted">
            No exports yet — run the worker with <code>RENDER_URL</code> set, or deploy to ECS.
          </p>
        )}
      </section>
    </div>
  );
}
