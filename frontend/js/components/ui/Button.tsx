import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: string;
  children: ReactNode;
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'panoptes-btn-primary',
  secondary: 'panoptes-btn-secondary',
  ghost: 'panoptes-btn-secondary border-transparent bg-transparent',
};

export function Button({
  variant = 'primary',
  icon,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button className={`${VARIANT_CLASS[variant]} ${className}`.trim()} type={type} {...props}>
      {children}
      {icon && <span className="material-symbols-outlined text-base">{icon}</span>}
    </button>
  );
}
