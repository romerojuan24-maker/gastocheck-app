'use client';

import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';

interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error('Select subcomponents must be used inside <Select>');
  return ctx;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}

export function Select({ value, onValueChange, children }: SelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div ref={rootRef} className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { open, setOpen } = useSelectContext();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={`flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ${className}`}
    >
      {children}
      <span className="ml-2 text-slate-400">▾</span>
    </button>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value } = useSelectContext();
  return <span className={value ? '' : 'text-slate-400'}>{value || placeholder}</span>;
}

export function SelectContent({ children }: { children: ReactNode }) {
  const { open } = useSelectContext();
  if (!open) return null;
  return (
    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
      {children}
    </div>
  );
}

export function SelectItem({ value, children }: { value: string; children: ReactNode }) {
  const { value: selected, onValueChange, setOpen } = useSelectContext();
  return (
    <div
      onClick={() => {
        onValueChange(value);
        setOpen(false);
      }}
      className={`cursor-pointer px-3 py-2 text-sm hover:bg-slate-100 ${
        selected === value ? 'bg-slate-50 font-medium' : ''
      }`}
    >
      {children}
    </div>
  );
}
