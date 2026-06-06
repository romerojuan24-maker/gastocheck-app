export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-label="GastoCheck">
      <circle cx="32" cy="32" r="30" fill="#1565C0" />
      <path
        d="M20 33 l8 9 16-20"
        fill="none"
        stroke="#43A047"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
