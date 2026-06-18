'use client';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

type Semaforo = 'green' | 'yellow' | 'red' | 'gray' | 'blue';

const SEMAFORO_COLORS: Record<Semaforo, string> = {
  green:  'border-l-emerald-500 bg-emerald-50',
  yellow: 'border-l-amber-500  bg-amber-50',
  red:    'border-l-red-500    bg-red-50',
  gray:   'border-l-slate-300  bg-white',
  blue:   'border-l-blue-500   bg-blue-50',
};

const SEMAFORO_TEXT: Record<Semaforo, string> = {
  green:  'text-emerald-700',
  yellow: 'text-amber-700',
  red:    'text-red-700',
  gray:   'text-slate-600',
  blue:   'text-blue-700',
};

interface Props {
  icon:       string;
  label:      string;
  value:      number | string;
  isMoney?:   boolean;
  semaforo?:  Semaforo;
  hint?:      string;
  action?:    { label: string; onClick: () => void };
  href?:      string;
}

export default function KpiCard({
  icon, label, value, isMoney = false, semaforo = 'gray', hint, action, href,
}: Props) {
  const displayValue = isMoney && typeof value === 'number' ? money(value) : String(value);
  const borderClass  = SEMAFORO_COLORS[semaforo];
  const textClass    = SEMAFORO_TEXT[semaforo];

  return (
    <div className={`rounded-xl border-l-4 p-4 shadow-sm ${borderClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">{icon}</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        </div>
      </div>
      <p className={`text-2xl font-black ${textClass} leading-none`}>{displayValue}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
        >
          {action.label} →
        </button>
      )}
    </div>
  );
}
