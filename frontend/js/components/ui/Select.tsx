import type { ReactNode, SelectHTMLAttributes } from 'react';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
};

export function Select({ className = '', children, ...props }: SelectProps) {
  return (
    <select className={`panoptes-input ${className}`.trim()} {...props}>
      {children}
    </select>
  );
}
