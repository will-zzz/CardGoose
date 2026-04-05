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
export function LayoutEditorFooterButton({
  variant = 'default',
  edge = 'none',
  className,
  children,
  ...rest
}: LayoutEditorFooterButtonProps) {
  const cls = [
    'layout-editor-footer-btn',
    variant === 'icon' && 'layout-editor-footer-btn--icon',
    edge === 'start' && 'layout-editor-footer-btn--edge-start',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}
