import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

export function Table({ className = '', ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full text-sm ${className}`} {...props} />
    </div>
  );
}

export function TableHeader({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={className} {...props} />;
}

export function TableBody({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export function TableRow({ className = '', ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`border-b border-slate-200 ${className}`} {...props} />;
}

export function TableHead({ className = '', ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`px-3 py-2 text-left text-xs font-bold uppercase text-slate-500 ${className}`}
      {...props}
    />
  );
}

export function TableCell({ className = '', ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-3 py-2 ${className}`} {...props} />;
}
