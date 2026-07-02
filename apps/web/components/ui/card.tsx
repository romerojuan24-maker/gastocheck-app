import { HTMLAttributes } from 'react';

type DivProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = '', ...props }: DivProps) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
      {...props}
    />
  );
}

export function CardHeader({ className = '', ...props }: DivProps) {
  return <div className={`p-6 pb-3 ${className}`} {...props} />;
}

export function CardTitle({ className = '', ...props }: DivProps) {
  return <div className={`text-lg font-bold text-slate-900 ${className}`} {...props} />;
}

export function CardContent({ className = '', ...props }: DivProps) {
  return <div className={`p-6 pt-0 ${className}`} {...props} />;
}
