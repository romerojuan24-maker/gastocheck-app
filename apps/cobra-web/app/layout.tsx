import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "CobraCheck Dashboard",
  description: "Gestión de cobranza - Controla lo que te debes",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
