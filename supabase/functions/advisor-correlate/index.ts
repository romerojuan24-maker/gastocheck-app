// Edge Function: advisor-correlate
// EL MOTOR DE INTELIGENCIA — 3 pasos, cada uno determinístico y separado:
//   1) SEÑALES: calcula hechos reales desde los módulos (CobraCheck,
//      BancoCheck, GastoCheck...) — nunca inventa datos que no existen.
//   2) CORRELACIÓN: 10 reglas versionadas (ver Sección 7 del spec).
//   3) PRIORIDAD: priorityScore determinístico y documentado (v1, abajo).
// La explicación con IA (advisor-explain) es un paso POSTERIOR y opcional
// que nunca sustituye este cálculo — si falla, el texto aquí generado ya
// es correcto y completo por sí mismo.
//
// Body: { company_id: uuid }
// Auth: requiere JWT del usuario (Authorization: Bearer ...)
// Rate limit: máx. 1 corrida real por empresa cada 60s (evita abuso).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }
const RATE_LIMIT_SECONDS = 60

interface Signal {
  id: string
  signal_type: string
  severity: string
  value_decimal: number | null
  value_text: string | null
  title: string
  effective_date: string
  evidence_json: any
  source_module: string
}

const money = (n: number) => `$${Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

// ============================================================================
// PASO 1 — SEÑALES: cada función consulta datos REALES. Si no hay datos
// (ej. FlujoCheck/InventarioCheck sin nada capturado todavía), NO publica
// nada — nunca se inventa una señal para forzar una correlación.
// ============================================================================

async function publishSignal(admin: any, companyId: string, params: {
  sourceModule: string; signalType: string; severity: string; title: string;
  valueDecimal?: number; valueText?: string; evidence?: any; dedupKey: string;
}) {
  const { data: existing } = await admin.from('business_signals')
    .select('id').eq('company_id', companyId).eq('deduplication_key', params.dedupKey).eq('status', 'ACTIVE').maybeSingle()

  if (existing) {
    const { data } = await admin.from('business_signals').update({
      title: params.title, severity: params.severity, value_decimal: params.valueDecimal ?? null,
      value_text: params.valueText ?? null, evidence_json: params.evidence ?? null, updated_at: new Date().toISOString(),
    }).eq('id', existing.id).select().single()
    return data
  }
  const { data } = await admin.from('business_signals').insert({
    company_id: companyId, source_module: params.sourceModule, signal_type: params.signalType,
    severity: params.severity, title: params.title, value_decimal: params.valueDecimal ?? null,
    value_text: params.valueText ?? null, evidence_json: params.evidence ?? null, deduplication_key: params.dedupKey,
  }).select().single()
  return data
}

async function computeRealSignals(admin: any, companyId: string) {
  // ── CobraCheck: cartera vencida ──────────────────────────────────────────
  const { data: overdueInvoices } = await admin.from('cobra_invoices')
    .select('amount, client_id').eq('company_id', companyId).eq('status', 'overdue')
  if (overdueInvoices?.length) {
    const total = overdueInvoices.reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0)
    if (total > 0) {
      await publishSignal(admin, companyId, {
        sourceModule: 'cobracheck', signalType: 'OVERDUE_RECEIVABLES_HIGH',
        severity: total > 100000 ? 'HIGH' : 'MEDIUM', title: 'Cartera vencida',
        valueDecimal: total, evidence: { count: overdueInvoices.length }, dedupKey: 'real:cobracheck:overdue_receivables',
      })
    }
  }

  // ── CobraCheck: facturas por cobrar en los próximos 7 días (para cruzar
  // con depósitos bancarios sin explicar) ──────────────────────────────────
  const soon = new Date(); soon.setDate(soon.getDate() + 7)
  const { data: dueInvoices } = await admin.from('cobra_invoices')
    .select('amount').eq('company_id', companyId).in('status', ['pending', 'partial'])
    .lte('due_date', soon.toISOString().slice(0, 10))
  if (dueInvoices?.length) {
    const total = dueInvoices.reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0)
    if (total > 0) {
      await publishSignal(admin, companyId, {
        sourceModule: 'cobracheck', signalType: 'COLLECTION_EXPECTED', severity: 'INFO',
        title: 'Cobranza esperada esta semana', valueDecimal: total,
        evidence: { count: dueInvoices.length }, dedupKey: 'real:cobracheck:collection_expected',
      })
    }
  }

  // ── CobraCheck: promesas de pago incumplidas recientes ───────────────────
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30)
  const { data: broken } = await admin.from('cobra_promises')
    .select('amount').eq('company_id', companyId).eq('status', 'broken').gte('promise_date', monthAgo.toISOString().slice(0, 10))
  if (broken?.length) {
    const total = broken.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0)
    await publishSignal(admin, companyId, {
      sourceModule: 'cobracheck', signalType: 'BROKEN_PAYMENT_PROMISE', severity: 'MEDIUM',
      title: 'Promesas de pago incumplidas', valueDecimal: total,
      evidence: { count: broken.length }, dedupKey: 'real:cobracheck:broken_promises',
    })
  }

  // ── BancoCheck: movimientos sin explicar (cargos y depósitos) ────────────
  const { data: unexplained } = await admin.from('bank_transactions')
    .select('amount').eq('company_id', companyId).in('status', ['new', 'unidentified', 'matched'])
  if (unexplained?.length) {
    const charges = unexplained.filter((t: any) => Number(t.amount) < 0)
    const deposits = unexplained.filter((t: any) => Number(t.amount) > 0)
    const chargeTotal = charges.reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0)
    const maxCharge = charges.reduce((m: number, t: any) => Math.max(m, Math.abs(Number(t.amount))), 0)
    if (chargeTotal > 0) {
      await publishSignal(admin, companyId, {
        sourceModule: 'bancocheck',
        signalType: maxCharge > 10000 ? 'HIGH_VALUE_UNEXPLAINED_TRANSACTION' : 'UNEXPLAINED_BANK_TRANSACTION',
        severity: maxCharge > 10000 ? 'HIGH' : 'MEDIUM', title: 'Cargos bancarios sin explicar',
        valueDecimal: chargeTotal, evidence: { count: charges.length, maxCharge }, dedupKey: 'real:bancocheck:unexplained_charges',
      })
    }
    const depositTotal = deposits.reduce((s: number, t: any) => s + Number(t.amount), 0)
    if (depositTotal > 0) {
      await publishSignal(admin, companyId, {
        sourceModule: 'bancocheck', signalType: 'UNMATCHED_BANK_CREDIT', severity: 'INFO',
        title: 'Depósitos sin relacionar', valueDecimal: depositTotal,
        evidence: { count: deposits.length }, dedupKey: 'real:bancocheck:unmatched_credits',
      })
    }
  }

  // ── GastoCheck: gastos sin comprobante ────────────────────────────────────
  const { data: missingReceipts } = await admin.from('expenses')
    .select('total').eq('company_id', companyId).is('receipt_id', null).eq('status', 'pending_auth')
  if (missingReceipts?.length) {
    const total = missingReceipts.reduce((s: number, e: any) => s + Number(e.total ?? 0), 0)
    await publishSignal(admin, companyId, {
      sourceModule: 'gastocheck', signalType: 'MISSING_RECEIPT', severity: 'MEDIUM',
      title: 'Gastos sin comprobante', valueDecimal: total,
      evidence: { count: missingReceipts.length }, dedupKey: 'real:gastocheck:missing_receipt',
    })
  }

  // ── GastoCheck: incremento reciente de gasto (mes actual vs anterior) ────
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
  const [{ data: thisMonth }, { data: prevMonth }] = await Promise.all([
    admin.from('expenses').select('total').eq('company_id', companyId).gte('expense_date', monthStart),
    admin.from('expenses').select('total').eq('company_id', companyId).gte('expense_date', prevMonthStart).lt('expense_date', monthStart),
  ])
  const thisSum = (thisMonth ?? []).reduce((s: number, e: any) => s + Number(e.total ?? 0), 0)
  const prevSum = (prevMonth ?? []).reduce((s: number, e: any) => s + Number(e.total ?? 0), 0)
  if (prevSum > 0 && thisSum > prevSum * 1.3) {
    await publishSignal(admin, companyId, {
      sourceModule: 'gastocheck', signalType: 'EXPENSE_SPIKE', severity: 'MEDIUM',
      title: 'Incremento de gastos este mes', valueDecimal: thisSum - prevSum,
      evidence: { thisMonth: thisSum, prevMonth: prevSum }, dedupKey: 'real:gastocheck:expense_spike',
    })
  }

  // ── FacturaCheck: CFDI de gasto sin relacionar a un movimiento bancario ──
  const { data: cfdiUnmatched } = await admin.from('cfdi_documents')
    .select('total').eq('company_id', companyId).eq('direction', 'received').is('related_bank_txn_id', null)
  if (cfdiUnmatched?.length) {
    const total = cfdiUnmatched.reduce((s: number, c: any) => s + Number(c.total ?? 0), 0)
    await publishSignal(admin, companyId, {
      sourceModule: 'facturacheck', signalType: 'EXPENSE_CFDI_WITHOUT_BANK_MATCH', severity: 'LOW',
      title: 'CFDI de gasto sin movimiento bancario relacionado', valueDecimal: total,
      evidence: { count: cfdiUnmatched.length }, dedupKey: 'real:facturacheck:cfdi_unmatched',
    })
  }

  // ── InventarioCheck: riesgo de quiebre de stock / inventario muerto ──────
  const { data: products } = await admin.from('inventory_products')
    .select('id, name, stock_current, stock_minimum, cost').eq('company_id', companyId).eq('is_active', true)
  if (products?.length) {
    const atRisk = products.filter((p: any) => Number(p.stock_current) <= Number(p.stock_minimum))
    if (atRisk.length > 0) {
      await publishSignal(admin, companyId, {
        sourceModule: 'inventariocheck', signalType: 'STOCKOUT_RISK', severity: atRisk.length > 5 ? 'HIGH' : 'MEDIUM',
        title: 'Productos en riesgo de agotarse', valueText: `${atRisk.length} producto(s)`,
        evidence: { products: atRisk.slice(0, 5).map((p: any) => p.name) }, dedupKey: 'real:inventariocheck:stockout_risk',
      })
    }

    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90)
    const { data: recentMoves } = await admin.from('inventory_movements')
      .select('product_id').eq('company_id', companyId).gte('created_at', cutoff.toISOString())
    const movedIds = new Set((recentMoves ?? []).map((m: any) => m.product_id))
    const dead = products.filter((p: any) => !movedIds.has(p.id) && Number(p.stock_current) > 0)
    if (dead.length > 0) {
      const deadValue = dead.reduce((s: number, p: any) => s + Number(p.stock_current) * Number(p.cost ?? 0), 0)
      if (deadValue > 0) {
        await publishSignal(admin, companyId, {
          sourceModule: 'inventariocheck', signalType: 'DEAD_STOCK', severity: 'LOW',
          title: 'Inventario sin movimiento (90+ días)', valueDecimal: deadValue,
          evidence: { count: dead.length }, dedupKey: 'real:inventariocheck:dead_stock',
        })
      }
    }
  }

  // ── FlujoCheck: riesgo de flujo, solo si hay datos de proyección reales
  // capturados (cash_flow_items) — si el módulo está vacío, no se inventa
  // una señal de riesgo de la nada. ────────────────────────────────────────
  const { data: bankAccounts } = await admin.from('bank_accounts').select('current_balance').eq('company_id', companyId).eq('is_active', true)
  const cashOnHand = (bankAccounts ?? []).reduce((s: number, a: any) => s + Number(a.current_balance ?? 0), 0)

  const horizon = new Date(); horizon.setDate(horizon.getDate() + 14)
  const { data: cashItems } = await admin.from('cash_flow_items')
    .select('amount, direction, expected_date').eq('company_id', companyId).eq('status', 'pending')
    .lte('expected_date', horizon.toISOString().slice(0, 10))
  if (cashItems?.length) {
    const inflow = cashItems.filter((c: any) => c.direction === 'in').reduce((s: number, c: any) => s + Number(c.amount), 0)
    const outflow = cashItems.filter((c: any) => c.direction === 'out').reduce((s: number, c: any) => s + Number(c.amount), 0)
    const projected = cashOnHand + inflow - outflow
    if (projected < cashOnHand * 0.3 || projected < 0) {
      await publishSignal(admin, companyId, {
        sourceModule: 'flujocheck', signalType: 'CASH_FLOW_RISK', severity: projected < 0 ? 'CRITICAL' : 'HIGH',
        title: 'Riesgo de flujo de efectivo (14 días)', valueDecimal: projected,
        evidence: { cashOnHand, inflow, outflow }, dedupKey: 'real:flujocheck:cash_flow_risk',
      })
      if (projected < 0) {
        await publishSignal(admin, companyId, {
          sourceModule: 'flujocheck', signalType: 'PROJECTED_CASH_DEFICIT', severity: 'CRITICAL',
          title: 'Déficit de flujo proyectado', valueDecimal: Math.abs(projected),
          evidence: { cashOnHand, inflow, outflow }, dedupKey: 'real:flujocheck:cash_deficit',
        })
      }
    }
  }
  // Nota: PAYROLL_DUE / OVERTIME_SPIKE / PAYROLL_COST_INCREASE no se calculan
  // — NóminaCheck no existe todavía como módulo, no hay datos reales de
  // los que partir. Las reglas que los usan (PAYROLL_AT_RISK,
  // CUSTOMER_PROMISE_AND_PAYROLL, OVERTIME_PAYROLL_INCREASE) están escritas
  // y funcionan si alguna vez se publican esas señales manualmente o desde
  // un futuro NóminaCheck — hoy simplemente no encuentran con qué activarse.
}

// ============================================================================
// PASO 3 — PRIORIDAD: fórmula v1, documentada y determinística.
// priorityScore = severityWeight + urgencyWeight + impactWeight + crossModuleWeight + confidenceWeight
// Rango 0-100. Ver Sección 9 del spec.
// ============================================================================

function computePriority(params: {
  severity: string; relatedModules: Set<string>; maxAmount: number; cashOnHand: number; confidence: number;
}): number {
  const severityWeight: Record<string, number> = { critical: 40, warning: 25, info: 10 }
  const sw = severityWeight[params.severity] ?? 10

  // Impacto relativo: comparar contra el efectivo disponible, no un monto absoluto.
  const base = params.cashOnHand > 0 ? params.cashOnHand : Math.max(params.maxAmount, 1)
  const ratio = Math.min(1, params.maxAmount / base)
  const impactWeight = Math.round(ratio * 20)

  const crossModuleWeight = params.relatedModules.size >= 2 ? 15 : params.relatedModules.size === 1 ? 5 : 0
  const confidenceWeight = Math.round((params.confidence / 100) * 10)
  // urgencyWeight simplificado v1: las reglas CRITICAL ya reflejan urgencia
  // vía severidad; se documenta como pendiente de refinar con fechas reales
  // por regla (Wave 4+).
  const urgencyWeight = params.severity === 'critical' ? 15 : params.severity === 'warning' ? 8 : 0

  return Math.min(100, sw + impactWeight + crossModuleWeight + confidenceWeight + urgencyWeight)
}

async function upsertInsight(
  admin: any, companyId: string,
  params: {
    ruleCode: string; insightType: string; title: string; body: string; severity: string;
    module: string; roleScope: string[]; relatedSignalIds: string[]; relatedModules: Set<string>;
    maxAmount: number; cashOnHand: number; evidence: any;
    actions: { action_type: string; label: string; route: string }[];
  },
) {
  const dedupKey = `rule:${params.ruleCode}`
  const priorityScore = computePriority({
    severity: params.severity, relatedModules: params.relatedModules, maxAmount: params.maxAmount,
    cashOnHand: params.cashOnHand, confidence: 95,
  })

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
      role_scope: params.roleScope, generated_by: 'RULE_ENGINE', priority_score: priorityScore,
      evidence_json: params.evidence,
    }).eq('id', existing.id)
    insightId = existing.id
    await admin.from('advisor_actions').delete().eq('insight_id', insightId)
  } else {
    const { data: inserted } = await admin.from('advisor_insights').insert({
      company_id: companyId, insight_type: params.insightType, title: params.title, body: params.body,
      severity: params.severity, module: params.module, related_ids: { signal_ids: params.relatedSignalIds },
      related_signal_ids: params.relatedSignalIds, correlation_rule_id: params.ruleCode,
      deduplication_key: dedupKey, role_scope: params.roleScope, generated_by: 'RULE_ENGINE',
      status: 'NEW', confidence: 95, priority_score: priorityScore, evidence_json: params.evidence,
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

    const body = await req.json()
    const { company_id, manual = false, force = false } = body
    if (!company_id) return Response.json({ error: 'company_id requerido' }, { status: 400, headers: CORS })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // For automated calls (manual=false), verify user is member
    if (!manual) {
      const { data: member } = await admin.from('company_members').select('role')
        .eq('company_id', company_id).eq('user_id', caller.id).eq('status', 'active').maybeSingle()
      if (!member) return Response.json({ error: 'Sin acceso a esta empresa' }, { status: 403, headers: CORS })
    }

    // ── Rate limit: máx. 1 corrida por minuto por empresa ──────────────────
    // Skip rate limit if manual=true (user override) or force=true (system trigger)
    if (!manual && !force) {
      const { data: cooldown } = await admin.from('advisor_correlate_cooldown')
        .select('next_allowed_at').eq('company_id', company_id).maybeSingle()
      if (cooldown?.next_allowed_at && new Date() < new Date(cooldown.next_allowed_at)) {
        return Response.json(
          { error: `Espera ${RATE_LIMIT_SECONDS}s entre recálculos.`, retry_after: 60 },
          { status: 429, headers: CORS }
        )
      }
    }

    const { data: run } = await admin.from('advisor_runs').insert({ company_id, status: 'running' }).select('id').single()

    let insightsCreated = 0
    let insightsUpdated = 0

    try {
      await computeRealSignals(admin, company_id)
    } catch (sigErr) {
      console.error('computeRealSignals error:', sigErr)
      // Un error calculando señales no debe tumbar toda la corrida —
      // se sigue con lo que ya exista en business_signals.
    }

    const { data: signalRows } = await admin.from('business_signals')
      .select('*').eq('company_id', company_id).eq('status', 'ACTIVE')
    const signals = (signalRows ?? []) as Signal[]
    const byType = new Map<string, Signal[]>()
    for (const s of signals) {
      if (!byType.has(s.signal_type)) byType.set(s.signal_type, [])
      byType.get(s.signal_type)!.push(s)
    }
    const first = (type: string) => byType.get(type)?.[0] ?? null

    const { data: bankAccounts } = await admin.from('bank_accounts').select('current_balance').eq('company_id', company_id).eq('is_active', true)
    const cashOnHand = (bankAccounts ?? []).reduce((s: number, a: any) => s + Number(a.current_balance ?? 0), 0)

    // ── RULE 1: PAYROLL_AT_RISK ─────────────────────────────────────────────
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
      const modules = new Set([payrollDue.source_module, cashDeficit.source_module, overdue?.source_module, invPurchase?.source_module].filter(Boolean) as string[])
      const actions = [
        ...(overdue ? [{ action_type: 'navigate', label: 'Ver clientes a cobrar', route: '/cobracheck/cartera-total' }] : []),
        { action_type: 'navigate', label: 'Ver flujo', route: '/flujocheck' },
        ...(invPurchase ? [{ action_type: 'navigate', label: 'Ver inventario', route: '/inventariocheck' }] : []),
      ]
      const created = await upsertInsight(admin, company_id, {
        ruleCode: 'PAYROLL_AT_RISK', insightType: 'cash_flow_risk', title: 'Tu nómina puede estar en riesgo',
        body, severity: 'critical', module: 'flujocheck', roleScope: ['owner', 'admin'],
        relatedSignalIds: relatedIds, relatedModules: modules, maxAmount: deficitAmt, cashOnHand,
        evidence: { payrollDue: payrollDue.value_decimal, payrollDate, projectedDeficit: deficitAmt, overdueReceivables: overdue?.value_decimal ?? null, plannedInventoryPurchases: invPurchase?.value_decimal ?? null },
        actions,
      })
      created ? insightsCreated++ : insightsUpdated++
    }

    // ── RULE 2: COLLECTION_CAUSING_CASH_PRESSURE ────────────────────────────
    const cashRisk = first('CASH_FLOW_RISK')
    const overdueHigh = first('OVERDUE_RECEIVABLES_HIGH')
    if (cashRisk && overdueHigh) {
      const body = `Detectamos presión de flujo de efectivo. La cobranza vencida (${money(overdueHigh.value_decimal ?? 0)}) parece estar relacionada con esta presión — no es la única causa posible, pero contribuye de forma significativa.`
      const created = await upsertInsight(admin, company_id, {
        ruleCode: 'COLLECTION_CAUSING_CASH_PRESSURE', insightType: 'collections_priority',
        title: 'La cobranza vencida está presionando tu flujo', body, severity: 'warning', module: 'cobracheck',
        roleScope: ['owner', 'admin', 'accountant', 'supervisor', 'contador_general'],
        relatedSignalIds: [cashRisk.id, overdueHigh.id], relatedModules: new Set([cashRisk.source_module, overdueHigh.source_module]),
        maxAmount: overdueHigh.value_decimal ?? 0, cashOnHand,
        evidence: { projectedCash: cashRisk.value_decimal, overdueReceivables: overdueHigh.value_decimal },
        actions: [
          { action_type: 'navigate', label: 'Ver clientes a cobrar', route: '/cobracheck/cartera-total' },
          { action_type: 'navigate', label: 'Ver flujo', route: '/flujocheck' },
        ],
      })
      created ? insightsCreated++ : insightsUpdated++
    }

    // ── RULE 3: INVENTORY_PURCHASE_CASH_CONFLICT ────────────────────────────
    const plannedPurchase = first('PLANNED_INVENTORY_PURCHASE')
    if (plannedPurchase && cashRisk) {
      const body = `InventarioCheck recomienda comprar ${money(plannedPurchase.value_decimal ?? 0)}. Esta compra puede aumentar la presión de efectivo detectada por FlujoCheck.`
      const created = await upsertInsight(admin, company_id, {
        ruleCode: 'INVENTORY_PURCHASE_CASH_CONFLICT', insightType: 'action_item', title: 'Puedes retrasar parte de una compra',
        body, severity: 'warning', module: 'inventariocheck', roleScope: ['owner', 'admin'],
        relatedSignalIds: [plannedPurchase.id, cashRisk.id], relatedModules: new Set([plannedPurchase.source_module, cashRisk.source_module]),
        maxAmount: plannedPurchase.value_decimal ?? 0, cashOnHand,
        evidence: { plannedPurchase: plannedPurchase.value_decimal, projectedCash: cashRisk.value_decimal },
        actions: [
          { action_type: 'navigate', label: 'Ver inventario', route: '/inventariocheck' },
          { action_type: 'navigate', label: 'Ver flujo', route: '/flujocheck' },
        ],
      })
      created ? insightsCreated++ : insightsUpdated++
    }

    // ── RULE 4: CRITICAL_STOCK_AND_LOW_CASH ─────────────────────────────────
    const stockoutRisk = first('STOCKOUT_RISK')
    const lowCash = cashRisk // reutiliza CASH_FLOW_RISK como proxy de "low cash buffer"
    if (stockoutRisk && lowCash) {
      const body = `Hay ${stockoutRisk.value_text ?? 'productos'} en riesgo de agotarse, y al mismo tiempo tu efectivo disponible está bajo. Reponer inventario ahora puede ser difícil sin afectar tu flujo.`
      const created = await upsertInsight(admin, company_id, {
        ruleCode: 'CRITICAL_STOCK_AND_LOW_CASH', insightType: 'action_item', title: 'Necesitas reponer, pero el efectivo está limitado',
        body, severity: 'warning', module: 'inventariocheck', roleScope: ['owner', 'admin'],
        relatedSignalIds: [stockoutRisk.id, lowCash.id], relatedModules: new Set([stockoutRisk.source_module, lowCash.source_module]),
        maxAmount: lowCash.value_decimal ? Math.abs(lowCash.value_decimal) : 0, cashOnHand,
        evidence: { stockoutProducts: stockoutRisk.value_text, projectedCash: lowCash.value_decimal },
        actions: [{ action_type: 'navigate', label: 'Ver inventario', route: '/inventariocheck' }],
      })
      created ? insightsCreated++ : insightsUpdated++
    }

    // ── RULE 5: CUSTOMER_PROMISE_AND_PAYROLL ────────────────────────────────
    const brokenPromise = first('BROKEN_PAYMENT_PROMISE')
    if (brokenPromise && payrollDue && cashRisk) {
      const body = `Una promesa de pago incumplida (${money(brokenPromise.value_decimal ?? 0)}) puede afectar el flujo esperado antes de la nómina del ${payrollDue.value_text ?? payrollDue.effective_date}.`
      const created = await upsertInsight(admin, company_id, {
        ruleCode: 'CUSTOMER_PROMISE_AND_PAYROLL', insightType: 'collections_priority', title: 'Una promesa incumplida puede afectar tu flujo antes de nómina',
        body, severity: 'warning', module: 'cobracheck', roleScope: ['owner', 'admin'],
        relatedSignalIds: [brokenPromise.id, payrollDue.id, cashRisk.id],
        relatedModules: new Set([brokenPromise.source_module, payrollDue.source_module, cashRisk.source_module]),
        maxAmount: brokenPromise.value_decimal ?? 0, cashOnHand,
        evidence: { brokenPromiseAmount: brokenPromise.value_decimal, payrollDate: payrollDue.value_text },
        actions: [{ action_type: 'navigate', label: 'Ver clientes a cobrar', route: '/cobracheck/cartera-total' }],
      })
      created ? insightsCreated++ : insightsUpdated++
    }

    // ── RULE 6: BANK_CREDIT_POSSIBLE_COLLECTION ─────────────────────────────
    const unmatchedCredit = first('UNMATCHED_BANK_CREDIT')
    const collectionExpected = first('COLLECTION_EXPECTED')
    if (unmatchedCredit && collectionExpected) {
      const body = `Existe un depósito sin relacionar (${money(unmatchedCredit.value_decimal ?? 0)}) que puede corresponder a la cobranza esperada esta semana (${money(collectionExpected.value_decimal ?? 0)}).`
      const created = await upsertInsight(admin, company_id, {
        ruleCode: 'BANK_CREDIT_POSSIBLE_COLLECTION', insightType: 'unmatched_bank', title: 'Un depósito puede ser una cobranza esperada',
        body, severity: 'info', module: 'bancocheck', roleScope: ['owner', 'admin', 'accountant', 'supervisor', 'contador_general'],
        relatedSignalIds: [unmatchedCredit.id, collectionExpected.id], relatedModules: new Set([unmatchedCredit.source_module, collectionExpected.source_module]),
        maxAmount: unmatchedCredit.value_decimal ?? 0, cashOnHand,
        evidence: { unmatchedCredit: unmatchedCredit.value_decimal, collectionExpected: collectionExpected.value_decimal },
        actions: [{ action_type: 'navigate', label: 'Revisar coincidencia', route: '/bancocheck/conciliacion' }],
      })
      created ? insightsCreated++ : insightsUpdated++
    }

    // ── RULE 7: BANK_DEBIT_WITHOUT_EXPENSE ──────────────────────────────────
    const highValueUnexplained = first('HIGH_VALUE_UNEXPLAINED_TRANSACTION')
    const missingReceipt = first('MISSING_RECEIPT')
    if (highValueUnexplained && missingReceipt) {
      const body = `Existe una salida bancaria relevante (${money(highValueUnexplained.value_decimal ?? 0)}) sin explicación, y además ${missingReceipt.value_text ?? 'hay gastos'} sin comprobante completo.`
      const created = await upsertInsight(admin, company_id, {
        ruleCode: 'BANK_DEBIT_WITHOUT_EXPENSE', insightType: 'unmatched_bank', title: 'Hay salidas de banco sin comprobante',
        body, severity: 'warning', module: 'bancocheck', roleScope: ['owner', 'admin', 'accountant', 'supervisor', 'contador_general'],
        relatedSignalIds: [highValueUnexplained.id, missingReceipt.id], relatedModules: new Set([highValueUnexplained.source_module, missingReceipt.source_module]),
        maxAmount: highValueUnexplained.value_decimal ?? 0, cashOnHand,
        evidence: { unexplainedAmount: highValueUnexplained.value_decimal, missingReceiptAmount: missingReceipt.value_decimal },
        actions: [
          { action_type: 'navigate', label: 'Explicar movimientos', route: '/bancocheck/movimientos' },
          { action_type: 'navigate', label: 'Ver comprobantes', route: '/receipts' },
        ],
      })
      created ? insightsCreated++ : insightsUpdated++
    }

    // ── RULE 8: CFDI_BANK_MISMATCH ───────────────────────────────────────────
    const cfdiUnmatched = first('EXPENSE_CFDI_WITHOUT_BANK_MATCH')
    const unexplainedBank = first('UNEXPLAINED_BANK_TRANSACTION') ?? highValueUnexplained
    if (cfdiUnmatched && unexplainedBank) {
      const body = `Puede existir un CFDI relacionado con un movimiento bancario pendiente de explicar (${money(cfdiUnmatched.value_decimal ?? 0)} en CFDI sin relacionar).`
      const created = await upsertInsight(admin, company_id, {
        ruleCode: 'CFDI_BANK_MISMATCH', insightType: 'cfdi_problem', title: 'CFDI de gasto sin relacionar con el banco',
        body, severity: 'info', module: 'facturacheck', roleScope: ['owner', 'admin', 'accountant', 'supervisor', 'contador_general'],
        relatedSignalIds: [cfdiUnmatched.id, unexplainedBank.id], relatedModules: new Set([cfdiUnmatched.source_module, unexplainedBank.source_module]),
        maxAmount: cfdiUnmatched.value_decimal ?? 0, cashOnHand,
        evidence: { cfdiAmount: cfdiUnmatched.value_decimal },
        actions: [{ action_type: 'navigate', label: 'Explicar movimientos', route: '/bancocheck/movimientos' }],
      })
      created ? insightsCreated++ : insightsUpdated++
    }

    // ── RULE 9: DEAD_STOCK_AND_CASH_PRESSURE ────────────────────────────────
    const deadStock = first('DEAD_STOCK')
    if (deadStock && cashRisk) {
      const body = `Tienes ${money(deadStock.value_decimal ?? 0)} inmovilizados en inventario sin movimiento reciente, justo cuando tu efectivo está bajo presión.`
      const created = await upsertInsight(admin, company_id, {
        ruleCode: 'DEAD_STOCK_AND_CASH_PRESSURE', insightType: 'low_stock', title: 'Tienes capital inmovilizado en inventario',
        body, severity: 'warning', module: 'inventariocheck', roleScope: ['owner', 'admin'],
        relatedSignalIds: [deadStock.id, cashRisk.id], relatedModules: new Set([deadStock.source_module, cashRisk.source_module]),
        maxAmount: deadStock.value_decimal ?? 0, cashOnHand,
        evidence: { deadStockValue: deadStock.value_decimal, projectedCash: cashRisk.value_decimal },
        actions: [{ action_type: 'navigate', label: 'Ver inventario', route: '/inventariocheck' }],
      })
      created ? insightsCreated++ : insightsUpdated++
    }

    // ── RULE 10: OVERTIME_PAYROLL_INCREASE (requiere NóminaCheck — no existe
    // todavía; la regla queda escrita y lista para cuando publique señales) ─
    const overtimeSpike = first('OVERTIME_SPIKE')
    const payrollCostIncrease = first('PAYROLL_COST_INCREASE')
    if (overtimeSpike && payrollCostIncrease) {
      const body = `El incremento de horas extra (${money(overtimeSpike.value_decimal ?? 0)}) contribuye al aumento estimado de nómina de ${money(payrollCostIncrease.value_decimal ?? 0)}.`
      const created = await upsertInsight(admin, company_id, {
        ruleCode: 'OVERTIME_PAYROLL_INCREASE', insightType: 'action_item', title: 'Las horas extra están subiendo tu costo de nómina',
        body, severity: 'warning', module: 'nominacheck', roleScope: ['owner', 'admin'],
        relatedSignalIds: [overtimeSpike.id, payrollCostIncrease.id], relatedModules: new Set([overtimeSpike.source_module, payrollCostIncrease.source_module]),
        maxAmount: payrollCostIncrease.value_decimal ?? 0, cashOnHand,
        evidence: { overtimeAmount: overtimeSpike.value_decimal, payrollIncrease: payrollCostIncrease.value_decimal },
        actions: [],
      })
      created ? insightsCreated++ : insightsUpdated++
    }

    // ── RULE 11: EXPENSE_SPIKE_AND_CASH_PRESSURE ────────────────────────────
    const expenseSpike = first('EXPENSE_SPIKE')
    if (expenseSpike && cashRisk) {
      const body = `El incremento reciente de gastos (${money(expenseSpike.value_decimal ?? 0)}) coincide con mayor presión de efectivo.`
      const created = await upsertInsight(admin, company_id, {
        ruleCode: 'EXPENSE_SPIKE_AND_CASH_PRESSURE', insightType: 'unusual_expense', title: 'Tus gastos subieron justo cuando el efectivo está apretado',
        body, severity: 'warning', module: 'gastocheck', roleScope: ['owner', 'admin', 'accountant', 'contador_general'],
        relatedSignalIds: [expenseSpike.id, cashRisk.id], relatedModules: new Set([expenseSpike.source_module, cashRisk.source_module]),
        maxAmount: expenseSpike.value_decimal ?? 0, cashOnHand,
        evidence: { expenseIncrease: expenseSpike.value_decimal, projectedCash: cashRisk.value_decimal },
        actions: [{ action_type: 'navigate', label: 'Ver gastos', route: '/gastocheck' }],
      })
      created ? insightsCreated++ : insightsUpdated++
    }

    // ── Create advisor_tasks for newly created insights (Wave 6) ─────────────
    if (!manual) {
      const { data: newInsights } = await admin.from('advisor_insights')
        .select('id, role_scope')
        .eq('company_id', company_id)
        .eq('status', 'NEW')
        .limit(100)

      for (const insight of newInsights ?? []) {
        try {
          // Determine assignment: if role_scope contains specific roles, assign to that role
          // Otherwise, assign to 'owner'/'admin' (default)
          let assignedRole = 'owner'
          if (insight.role_scope?.length > 0) {
            // If scope is supervisor-focused, assign to supervisors
            if (insight.role_scope.includes('supervisor') && !insight.role_scope.includes('owner')) {
              assignedRole = 'supervisor'
            }
            // If scope is operator-focused, assign to operators
            else if (insight.role_scope.includes('comprador') || insight.role_scope.includes('spender')) {
              assignedRole = 'operator'
            }
          }

          const { error: taskErr } = await admin
            .rpc('create_advisor_task', {
              p_company_id: company_id,
              p_insight_id: insight.id,
              p_assigned_to_role: assignedRole,
            })

          if (taskErr) {
            console.warn(`Failed to create task for insight ${insight.id}:`, taskErr)
          }
        } catch (taskErr: any) {
          console.warn(`Exception creating task for insight ${insight.id}:`, taskErr)
        }
      }

      // Mark new insights as ACTIVE (no longer NEW)
      await admin.from('advisor_insights')
        .update({ status: 'ACTIVE' })
        .eq('company_id', company_id)
        .eq('status', 'NEW')
    }

    // ── Update rate limit cooldown (60 seconds) ──────────────────────────────
    if (!manual) {
      const nextAllowed = new Date()
      nextAllowed.setSeconds(nextAllowed.getSeconds() + 60)

      await admin
        .from('advisor_correlate_cooldown')
        .upsert({
          company_id,
          last_run_at: new Date().toISOString(),
          next_allowed_at: nextAllowed.toISOString(),
          updated_at: new Date().toISOString(),
        })
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
