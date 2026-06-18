import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Check Suite — Controla tu negocio',
  description: 'Plataforma de control operativo y financiero para PyMEs mexicanas.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
