import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
const get = (k) => {
  const m = env.split('\n').find((l) => l.startsWith(k + '='))
  return m ? m.slice(k.length + 1).trim() : null
}
const admin = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

console.log('\n🔍 DIAGNÓSTICO: Recibos Huérfanos en GastoCheck\n')
console.log('==========================================\n')

// 1. Recibos sin expense relacionado
const { data: orphanedReceipts, error: err1 } = await admin
  .from('receipts')
  .select('id, name, monto, supplier_id, created_at')
  .not('id', 'is', null)

const orphans = orphanedReceipts || []
console.log(`📊 Total recibos en BD: ${orphans.length}`)

// 2. Contar recibos con expense válido
const { data: linkedReceipts } = await admin
  .from('expenses')
  .select('receipt_id')
  .neq('receipt_id', null)

const linkedIds = new Set((linkedReceipts || []).map(e => e.receipt_id))
const orphanedCount = orphans.filter(r => !linkedIds.has(r.id)).length

console.log(`🔗 Recibos CON expense relacionado: ${linkedIds.size}`)
console.log(`❌ Recibos HUÉRFANOS (sin expense): ${orphanedCount}`)

if (orphanedCount > 0) {
  console.log('\n📋 Listado de recibos huérfanos:\n')
  const orphanedList = orphans.filter(r => !linkedIds.has(r.id))
  orphanedList.slice(0, 20).forEach((r, i) => {
    const date = new Date(r.created_at).toLocaleDateString()
    console.log(`  ${i + 1}. ${r.name} | $${r.monto} | Creado: ${date} | ID: ${r.id.slice(0, 8)}...`)
  })
  if (orphanedCount > 20) console.log(`  ... y ${orphanedCount - 20} más`)

  console.log('\n💡 SOLUCIÓN:')
  console.log('  1. Para cada recibo huérfano, crear un expense vacío:')
  console.log('     INSERT INTO expenses (company_id, receipt_id, holder_id, status, ...)')
  console.log('  2. Luego asignar a una póliza existente o crear póliza nueva')
  console.log('  3. O implementar UI "Resolver comprobantes sin póliza" en dashboard')
} else {
  console.log('\n✅ No hay recibos huérfanos - todos están vinculados correctamente')
}

// 3. Detalles de políz as sin gastos
const { data: emptyPolicies } = await admin
  .from('policies')
  .select('id, number, status, created_at')

const { data: policyExpenses } = await admin
  .from('expenses')
  .select('policy_id')

const policyIds = new Set((policyExpenses || []).map(e => e.policy_id))
const emptyPolicies_ = (emptyPolicies || []).filter(p => !policyIds.has(p.id))

console.log(`\n📂 Pólizas vacías (sin gastos): ${emptyPolicies_.length}`)
if (emptyPolicies_.length > 0) {
  console.log('  (Estas se pueden consolidar o eliminar)')
}

console.log('\n==========================================\n')
