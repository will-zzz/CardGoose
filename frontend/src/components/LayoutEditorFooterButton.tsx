import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type LayoutEditorFooterButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'type'
> & {
  /** Text + optional leading icon (e.g. Deck preview). */
  variant?: 'default' | 'icon';
  /** Aligns with the bar’s left inset (Deck preview). */
  edge?: 'start' | 'none';
  children: ReactNode;
};

/**
 * Layout editor status bar control: full-height hover/active strip, no global accent button styling.
 */
export const LayoutEditorFooterButton = forwardRef<HTMLButtonElement, LayoutEditorFooterButtonProps>(
  function LayoutEditorFooterButton(
    { variant = 'default', edge = 'none', className, children, ...rest },
    ref,
  ) {
    const cls = [
      'layout-editor-footer-btn',
      variant === 'icon' && 'layout-editor-footer-btn--icon',
      edge === 'start' && 'layout-editor-footer-btn--edge-start',
      className,
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <button ref={ref} type="button" className={cls} {...rest}>
        {children}
      </button>
    );
  },
);

export type LayoutEditorFooterValueStripProps = {
  /** Shown before the input (e.g. `W`, `H`). */
  prefix?: ReactNode;
  /** Shown after the input (e.g. `%`). */
  suffix?: ReactNode;
  /** If set, the strip is a `<label htmlFor="…">` (e.g. zoom). Otherwise a `<span>`. */
  htmlFor?: string;
  title?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Editable value strip in the layout footer: optional prefix/suffix + input (zoom %, card W/H, etc.).
 */
export function LayoutEditorFooterValueStrip({
  prefix,
  suffix,
  htmlFor,
  title,
  className,
  children,
}: LayoutEditorFooterValueStripProps) {
  const cls = ['layout-editor-footer-value-strip', className].filter(Boolean).join(' ');
  const affix = (
    <>
      {prefix != null && prefix !== '' && (
        <span className="layout-editor-footer-value-strip-affix">{prefix}</span>
      )}
      {children}
      {suffix != null && suffix !== '' && (
        <span className="layout-editor-footer-value-strip-affix">{suffix}</span>
      )}
    </>
  );

  if (htmlFor !== undefined) {
    return (
      <label className={cls} htmlFor={htmlFor} title={title}>
        {affix}
      </label>
    );
  }

  return (
    <span className={cls} title={title}>
      {affix}
    </span>
  );
}
