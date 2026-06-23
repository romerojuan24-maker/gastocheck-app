import { redirect } from 'next/navigation'

// Esta ruta está obsoleta. El módulo vive en app/(dashboard)/flujocheck/
export default function FlujoCheckRedirect() {
  redirect('/flujocheck')
}
