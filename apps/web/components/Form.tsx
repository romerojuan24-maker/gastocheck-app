import React from 'react';

interface FormProps {
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
  className?: string;
}

export function Form({ onSubmit, children, className }: FormProps) {
  return (
    <form onSubmit={onSubmit} className={`space-y-4 ${className || ''}`}>
      {children}
    </form>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, ...props }: InputProps) {
  return (
    <div>
      {label && <label className="block text-sm font-bold text-slate-900 mb-1">{label}</label>}
      <input
        {...props}
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
          error ? 'border-red-500' : 'border-slate-200'
        }`}
      />
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, ...props }: SelectProps) {
  return (
    <div>
      {label && <label className="block text-sm font-bold text-slate-900 mb-1">{label}</label>}
      <select {...props} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
          error ? 'border-red-500' : 'border-slate-200'
        }`}>
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}
