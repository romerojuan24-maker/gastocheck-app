import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { FileText, CheckCircle, AlertCircle, Clock } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Comprobante {
  comprobante_id: string
  provider_name: string
  monto: number
  estado_trazable: string
  comprobante_status: string
  poliza_name: string | null
  poliza_id: string | null
  fecha_gasto: string
  cfdi_uuid: string | null
  spender_name: string
}

export default async function ComprobantesPage() {
  // Obtener comprobantes del usuario actual
  const { data: comprobantes, error } = await supabase
    .from('v_expenses_with_traceability')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching comprobantes:', error)
  }

  const vigentes = (comprobantes || []).filter((c) => c.comprobante_status === 'captured')
  const enRevision = (comprobantes || []).filter((c) => c.comprobante_status === 'pending_auth')
  const historicos = (comprobantes || []).filter((c) =>
    ['invoice_applied', 'closed_in_policy'].includes(c.comprobante_status)
  )

  const statusColor = (status: string) => {
    switch (status) {
      case 'captured':
        return 'bg-blue-100 text-blue-800'
      case 'pending_auth':
        return 'bg-yellow-100 text-yellow-800'
      case 'invoice_applied':
        return 'bg-green-100 text-green-800'
      case 'closed_in_policy':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-slate-100 text-slate-800'
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'captured':
        return 'Capturado'
      case 'pending_auth':
        return 'En revisión'
      case 'invoice_applied':
        return 'Facturado'
      case 'closed_in_policy':
        return 'Cerrado'
      default:
        return status
    }
  }

  const ComprobantesCard = ({ items, empty }: { items: any[]; empty: string }) => {
    if (items.length === 0) {
      return (
        <div className="p-8 text-center text-slate-500">
          <FileText className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <p>{empty}</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {items.map((item) => (
          <Link
            key={item.comprobante_id}
            href={`/gastocheck/comprobantes/${item.comprobante_id}`}
          >
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{item.provider_name || 'Sin proveedor'}</h3>
                    <p className="text-sm text-slate-500">
                      Fecha: {new Date(item.fecha_gasto).toLocaleDateString('es-MX')}
                    </p>
                    {item.poliza_name && (
                      <p className="text-sm text-slate-600 mt-1">
                        📋 Póliza: <span className="font-medium">{item.poliza_name}</span>
                      </p>
                    )}
                    {item.cfdi_uuid && (
                      <p className="text-sm text-green-600 mt-1">
                        ✓ Con CFDI ({item.cfdi_uuid.slice(0, 8)}...)
                      </p>
                    )}
                    {!item.cfdi_uuid && (
                      <p className="text-sm text-orange-600 mt-1">
                        ⚠ Sin CFDI timbrado
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">
                      ${item.monto?.toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                    </p>
                    <Badge className={`mt-2 ${statusColor(item.comprobante_status)}`}>
                      {statusLabel(item.comprobante_status)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Mis Comprobantes</h1>
        <p className="text-slate-600 mt-2">
          Visualiza, gestiona y da seguimiento a tus gastos y comprobantes
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Vigentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{vigentes.length}</p>
            <p className="text-xs text-slate-500 mt-1">Capturados y sin autorizar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">En revisión</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">{enRevision.length}</p>
            <p className="text-xs text-slate-500 mt-1">Pendiente de autorización</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Históricos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{historicos.length}</p>
            <p className="text-xs text-slate-500 mt-1">Facturados o cerrados</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="vigentes" className="w-full">
        <TabsList>
          <TabsTrigger value="vigentes">
            <Clock className="w-4 h-4 mr-2" />
            Vigentes ({vigentes.length})
          </TabsTrigger>
          <TabsTrigger value="revision">
            <AlertCircle className="w-4 h-4 mr-2" />
            En revisión ({enRevision.length})
          </TabsTrigger>
          <TabsTrigger value="historicos">
            <CheckCircle className="w-4 h-4 mr-2" />
            Históricos ({historicos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vigentes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Comprobantes Vigentes</CardTitle>
              <CardDescription>
                Gastos capturados que aún no han sido autorizados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ComprobantesCard
                items={vigentes}
                empty="No hay comprobantes vigentes. ¡Captura uno nuevo!"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revision" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>En Revisión</CardTitle>
              <CardDescription>
                Comprobantes pendientes de autorización de tu supervisor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ComprobantesCard
                items={enRevision}
                empty="No hay comprobantes en revisión"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historicos" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Históricos</CardTitle>
              <CardDescription>
                Comprobantes que ya fueron facturados y cerrados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ComprobantesCard
                items={historicos}
                empty="No hay comprobantes históricos"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
