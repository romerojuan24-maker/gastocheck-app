'use client';

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

export function Checkbox({ checked, onCheckedChange, className = '' }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      className={`h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 ${className}`}
    />
  );
}
