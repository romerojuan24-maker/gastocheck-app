import { ReactNode } from 'react'

export default function PolizasLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      {children}
    </div>
  )
}
