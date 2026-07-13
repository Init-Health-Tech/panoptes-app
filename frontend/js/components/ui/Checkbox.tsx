import type { InputHTMLAttributes } from 'react';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function Checkbox({ className = '', ...props }: CheckboxProps) {
  return (
    <input
      className={`h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary/20 ${className}`.trim()}
      type="checkbox"
      {...props}
    />
  );
}
