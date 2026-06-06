import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GastoCheck — Tus gastos claros. Tus saldos bajo control.',
  description: 'Control de anticipos, comprobaciones, gastos y saldos por persona.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
