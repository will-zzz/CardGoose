import { forwardRef, type ComponentPropsWithoutRef } from 'react';

export const Input = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<'input'>>(function Input(
  { className, type = 'text', ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      className={`cf-input${className ? ` ${className}` : ''}`}
      {...props}
    />
  );
});
