// Edge Function: advisor-correlate
// EL MOTOR DE CORRELACIÓN — determinístico, sin IA. Lee señales ACTIVAS
// del tenant, aplica reglas versionadas, produce/actualiza insights con
// evidencia estructurada. La capa de IA (explicación en lenguaje natural)
// es un paso POSTERIOR y opcional que nunca sustituye este cálculo.
//
// Body: { company_id: uuid }
// Auth: requiere JWT del usuario (Authorization: Bearer ...)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

interface Signal {
  id: string
  signal_type: string
  severity: string
  value_decimal: number | null
  value_text: string | null
  title: string
  effective_date: string
  evidence_json: any
}

const money = (n: number) => `$${Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

async function upsertInsight(
  admin: any, companyId: string,
  params: {
    ruleCode: string; insightType: string; title: string; body: string; severity: string;
    module: string; roleScope: string[]; relatedSignalIds: string[]; evidence: any;
    actions: { action_type: string; label: string; route: string }[];
  },
) {
  const dedupKey = `rule:${params.ruleCode}`
  const { data: existing } = await admin.from('advisor_insights')
    .select('id').eq('company_id', companyId).eq('deduplication_key', dedupKey)
    .not('status', 'in', '(RESOLVED,DISMISSED,EXPIRED)').maybeSingle()

  let insightId: string
  let created = false

  if (existing) {
    await admin.from('advisor_insights').update({
      title: params.title, body: params.body, severity: params.severity,
      related_ids: { signal_ids: params.relatedSignalIds }, related_signal_ids: params.relatedSignalIds,
      correlation_rule_id: params.ruleCode, status: 'ACTIVE', is_dismissed: false,
      role_scope: params.roleScope, generated_by: 'RULE_ENGINE',
    }).eq('id', existing.id)
    insightId = existing.id
    await admin.from('advisor_actions').delete().eq('insight_id', insightId)
  } else {
    const { data: inserted } = await admin.from('advisor_insights').insert({
      company_id: companyId, insight_type: params.insightType, title: params.title, body: params.body,
      severity: params.severity, module: params.module, related_ids: { signal_ids: params.relatedSignalIds },
      related_signal_ids: params.relatedSignalIds, correlation_rule_id: params.ruleCode,
      deduplication_key: dedupKey, role_scope: params.roleScope, generated_by: 'RULE_ENGINE',
      status: 'NEW', confidence: 95,
    }).select('id').single()
    insightId = inserted.id
    created = true
  }

  if (params.actions.length > 0) {
    await admin.from('advisor_actions').insert(
      params.actions.map((a, i) => ({ insight_id: insightId, action_type: a.action_type, label: a.label, route: a.route, priority: i })),
    )
  }

  return created
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: authErr } = await supabaseUser.auth.getUser()
    if (authErr || !caller) return Response.json({ error: 'No autenticado' }, { status: 401, headers: CORS })

    const { company_id } = await req.json()
    if (!company_id) return Response.json({ error: 'company_id requerido' }, { status: 400, headers: CORS })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: member } = await admin.from('company_members').select('role')
      .eq('company_id', company_id).eq('user_id', caller.id).eq('status', 'active').maybeSingle()
    if (!member) return Response.json({ error: 'Sin acceso a esta empresa' }, { status: 403, headers: CORS })

    const { data: run } = await admin.from('advisor_runs')
      .insert({ company_id, status: 'running' }).select('id').single()

    let insightsCreated = 0
    let insightsUpdated = 0

    const { data: signalRows } = await admin.from('business_signals')
      .select('*').eq('company_id', company_id).eq('status', 'ACTIVE')
    const signals = (signalRows ?? []) as Signal[]
    const byType = new Map<string, Signal[]>()
    for (const s of signals) {
      if (!byType.has(s.signal_type)) byType.set(s.signal_type, [])
      byType.get(s.signal_type)!.push(s)
    }
    const first = (type: string) => byType.get(type)?.[0] ?? null

    // ── RULE: PAYROLL_AT_RISK ──────────────────────────────────────────────
    const payrollDue = first('PAYROLL_DUE')
    const cashDeficit = first('PROJECTED_CASH_DEFICIT')
    if (payrollDue && cashDeficit) {
      const overdue = first('OVERDUE_RECEIVABLES_HIGH')
      const invPurchase = first('PLANNED_INVENTORY_PURCHASE')
      const deficitAmt = Math.abs(cashDeficit.value_decimal ?? 0)
      const payrollDate = payrollDue.value_text ?? payrollDue.effective_date

      let body = `Con la información disponible, el flujo proyectado muestra un faltante aproximado de ${money(deficitAmt)} para cubrir la nómina del ${payrollDate}.`
      if (overdue) body += ` La principal presión parece estar relacionada con la cobranza vencida (${money(overdue.value_decimal ?? 0)}).`
      if (invPurchase) body += ` Existe además una compra de inventario propuesta por ${money(invPurchase.value_decimal ?? 0)}.`

      const relatedIds = [payrollDue.id, cashDeficit.id, overdue?.id, invPurchase?.id].filter(Boolean) as string[]
      const actions = [
        ...(overdue ? [{ action_type: 'navigate', label: 'Ver clientes a cobrar', route: '/cobracheck/cartera-total' }] : []),
        { action_type: 'navigate', label: 'Ver flujo', route: '/flujocheck' },
        ...(invPurchase ? [{ action_type: 'navigate', label: 'Revisar compra', route: '/inventariocheck/compras' }] : []),
      ]

      const created = await upsertInsight(admin, company_id, {
        ruleCode: 'PAYROLL_AT_RISK', insightType: 'cash_flow_risk',
        title: 'Tu nómina puede estar en riesgo', body, severity: 'critical', module: 'flujocheck',
        roleScope: ['owner', 'admin'], relatedSignalIds: relatedIds,
        evidence: { payrollDue: payrollDue.value_decimal, payrollDate, projectedDeficit: deficitAmt, overdueReceivables: overdue?.value_decimal ?? null, plannedInventoryPurchases: invPurchase?.value_decimal ?? null },
        actions,
      })
      created ? insightsCreated++ : insightsUpdated++
    }

    // ── RULE: COLLECTION_CAUSING_CASH_PRESSURE ─────────────────────────────
    const cashRisk = first('CASH_FLOW_RISK')
    const overdueHigh = first('OVERDUE_RECEIVABLES_HIGH')
    if (cashRisk && overdueHigh) {
      const body = `Detectamos presión de flujo de efectivo. La cobranza vencida (${money(overdueHigh.value_decimal ?? 0)}) parece estar relacionada con esta presión — no es la única causa posible, pero contribuye de forma significativa.`
      const created = await upsertInsight(admin, company_id, {
        ruleCode: 'COLLECTION_CAUSING_CASH_PRESSURE', insightType: 'collections_priority',
        title: 'La cobranza vencida está presionando tu flujo', body, severity: 'warning', module: 'cobracheck',
        roleScope: ['owner', 'admin', 'accountant', 'supervisor', 'contador_general'],
        relatedSignalIds: [cashRisk.id, overdueHigh.id],
        evidence: { projectedCash: cashRisk.value_decimal, overdueReceivables: overdueHigh.value_decimal },
        actions: [
          { action_type: 'navigate', label: 'Ver clientes a cobrar', route: '/cobracheck/cartera-total' },
          { action_type: 'navigate', label: 'Ver flujo', route: '/flujocheck' },
        ],
      })
      created ? insightsCreated++ : insightsUpdated++
    }

    // ── RULE: INVENTORY_PURCHASE_CASH_CONFLICT ─────────────────────────────
    const plannedPurchase = first('PLANNED_INVENTORY_PURCHASE')
    if (plannedPurchase && cashRisk) {
      const body = `InventarioCheck recomienda comprar ${money(plannedPurchase.value_decimal ?? 0)}. Esta compra puede aumentar la presión de efectivo detectada por FlujoCheck.`
      const created = await upsertInsight(admin, company_id, {
        ruleCode: 'INVENTORY_PURCHASE_CASH_CONFLICT', insightType: 'action_item',
        title: 'Puedes retrasar parte de una compra', body, severity: 'warning', module: 'inventariocheck',
        roleScope: ['owner', 'admin'], relatedSignalIds: [plannedPurchase.id, cashRisk.id],
        evidence: { plannedPurchase: plannedPurchase.value_decimal, projectedCash: cashRisk.value_decimal },
        actions: [
          { action_type: 'navigate', label: 'Revisar compra', route: '/inventariocheck/compras' },
          { action_type: 'navigate', label: 'Ver inventario', route: '/inventariocheck' },
        ],
      })
      created ? insightsCreated++ : insightsUpdated++
    }

    await admin.from('advisor_runs').update({
      completed_at: new Date().toISOString(), status: 'completed',
      signals_evaluated: signals.length, insights_created: insightsCreated, insights_updated: insightsUpdated,
    }).eq('id', run.id)

    return Response.json({
      ok: true, run_id: run.id, signals_evaluated: signals.length,
      insights_created: insightsCreated, insights_updated: insightsUpdated,
    }, { headers: CORS })
  } catch (err: any) {
    console.error('advisor-correlate error:', err)
    return Response.json({ error: String(err?.message ?? err) }, { status: 500, headers: CORS })
  }
})
