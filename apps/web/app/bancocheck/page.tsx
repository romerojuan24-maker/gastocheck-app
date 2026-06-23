import { redirect } from 'next/navigation'

// Esta ruta está obsoleta. El módulo vive en app/(dashboard)/bancocheck/
export default function BancoCheckRedirect() {
  redirect('/bancocheck')
}
