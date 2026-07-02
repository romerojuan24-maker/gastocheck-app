import { HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

const VARIANT_CLASSES: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-green-100 text-green-800',
  secondary: 'bg-yellow-100 text-yellow-800',
  destructive: 'bg-red-100 text-red-800',
  outline: 'border border-slate-300 text-slate-700',
};

export function Badge({ variant = 'default', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
