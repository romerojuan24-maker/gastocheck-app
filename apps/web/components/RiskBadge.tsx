interface Props {
  level: 'green' | 'yellow' | 'red' | 'gray';
  label?: string;
}

const META = {
  green:  { bg: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  yellow: { bg: 'bg-amber-100   text-amber-700',   dot: 'bg-amber-500'   },
  red:    { bg: 'bg-red-100     text-red-700',      dot: 'bg-red-500'     },
  gray:   { bg: 'bg-slate-100   text-slate-600',    dot: 'bg-slate-400'   },
};

export default function RiskBadge({ level, label }: Props) {
  const { bg, dot } = META[level];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label ?? level}
    </span>
  );
}
