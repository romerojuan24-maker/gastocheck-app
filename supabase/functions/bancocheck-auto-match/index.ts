// BancoCheck — motor de sugerencias de conciliación cruzada. SOLO propone
// (inserta en bank_match_suggestions con status='pending'); nunca aplica
// nada — la aplicación real pasa siempre por bancocheck_approve_suggestion
// (RPC), que exige rol de contador/admin. Ver regla del usuario: "el
// contador debe SIEMPRE tener el VoBo de la aplicación".
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

interface BankTransaction {
  id: string;
  company_id: string;
  bank_account_id: string;
  amount: number;
  transaction_date: string;
  description: string;
  status: string;
}

interface MatchSuggestion {
  transaction_id: string;
  match_type: string;
  match_id: string;
  confidence: number;
  reason: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const AMOUNT_EQ = (a: number, b: number) => Math.abs(a - b) < 0.01;

async function alreadyLinkedIds(column: 'related_receipt_id' | 'related_advance_id', companyId: string): Promise<string[]> {
  const { data } = await supabase
    .from('bank_transactions')
    .select(column)
    .eq('company_id', companyId)
    .not(column, 'is', null);
  return (data ?? []).map((r: any) => r[column]).filter(Boolean);
}

async function autoMatch(txn: BankTransaction, allCompanyTxns: BankTransaction[]): Promise<MatchSuggestion[]> {
  const suggestions: MatchSuggestion[] = [];

  // ── Transferencias entre cuentas propias (cualquier signo) ───────────────
  // Cargo en cuenta A + depósito en cuenta B, mismo monto, fecha cercana.
  const txnDate = new Date(txn.transaction_date).getTime();
  for (const other of allCompanyTxns) {
    if (other.id === txn.id) continue;
    if (other.bank_account_id === txn.bank_account_id) continue; // misma cuenta no es transferencia
    if (Math.sign(other.amount) === Math.sign(txn.amount)) continue; // deben tener signos opuestos
    if (!AMOUNT_EQ(Math.abs(other.amount), Math.abs(txn.amount))) continue;
    const otherDate = new Date(other.transaction_date).getTime();
    const daysApart = Math.abs(otherDate - txnDate) / DAY_MS;
    if (daysApart > 3) continue;

    suggestions.push({
      transaction_id: txn.id,
      match_type: 'transfer',
      match_id: other.id,
      confidence: daysApart === 0 ? 0.9 : 0.7,
      reason: `Monto igual (${Math.abs(txn.amount)}) en otra cuenta propia, ${daysApart === 0 ? 'mismo día' : `${Math.round(daysApart)} día(s) de diferencia`}`,
    });
  }

  // Si ya hay una sugerencia de transferencia fuerte, no seguir buscando
  // facturas/gastos para este movimiento — evita proponer dos explicaciones
  // contradictorias para el mismo dinero.
  if (suggestions.some(s => s.confidence >= 0.85)) return suggestions;

  // ── Depósitos → facturas por cobrar / anticipos ──────────────────────────
  if (txn.amount > 0) {
    const { data: invoices } = await supabase
      .from('cobra_invoices')
      .select('id, folio, client_id')
      .eq('company_id', txn.company_id)
      .eq('amount', txn.amount)
      .in('status', ['pending', 'partial', 'overdue']);

    for (const inv of invoices ?? []) {
      suggestions.push({
        transaction_id: txn.id, match_type: 'invoice', match_id: inv.id,
        confidence: 0.95, reason: `Monto exacto con factura ${inv.folio ?? inv.id}`,
      });
    }

    const linkedAdvances = await alreadyLinkedIds('related_advance_id', txn.company_id);
    const { data: advances } = await supabase
      .from('advances')
      .select('id')
      .eq('company_id', txn.company_id)
      .eq('amount', txn.amount);

    for (const adv of (advances ?? []).filter(a => !linkedAdvances.includes(a.id))) {
      suggestions.push({
        transaction_id: txn.id, match_type: 'advance', match_id: adv.id,
        confidence: 0.75, reason: 'Monto exacto con anticipo sin conciliar',
      });
    }
  }

  // ── Cargos → comprobantes de gasto ───────────────────────────────────────
  if (txn.amount < 0) {
    const absAmount = Math.abs(txn.amount);
    const linkedReceipts = await alreadyLinkedIds('related_receipt_id', txn.company_id);

    const { data: receipts } = await supabase
      .from('receipts')
      .select('id, provider_name')
      .eq('company_id', txn.company_id)
      .eq('total_amount', absAmount)
      .neq('status', 'cancelled');

    for (const r of (receipts ?? []).filter(r => !linkedReceipts.includes(r.id))) {
      suggestions.push({
        transaction_id: txn.id, match_type: 'receipt', match_id: r.id,
        confidence: 0.85, reason: `Monto exacto con comprobante de ${r.provider_name ?? 'proveedor'}`,
      });
    }
  }

  return suggestions;
}

async function processCompanyTransactions(companyId: string, singleTransactionId?: string) {
  let query = supabase
    .from('bank_transactions')
    .select('id, company_id, bank_account_id, amount, transaction_date, description, status')
    .eq('company_id', companyId);

  if (singleTransactionId) query = query.eq('id', singleTransactionId);
  else query = query.in('status', ['new', 'unidentified']);

  const { data: targets } = await query;
  if (!targets || targets.length === 0) return { processed: 0, suggested: 0 };

  // Universo de movimientos de la empresa (para detectar transferencias
  // entre cuentas) — solo se necesita una vez por lote.
  const { data: allTxns } = await supabase
    .from('bank_transactions')
    .select('id, company_id, bank_account_id, amount, transaction_date, description, status')
    .eq('company_id', companyId)
    .neq('status', 'ignored');

  let suggestedCount = 0;
  for (const txn of targets as BankTransaction[]) {
    const suggestions = await autoMatch(txn, (allTxns ?? []) as BankTransaction[]);
    if (suggestions.length === 0) continue;

    // No duplicar sugerencias ya pendientes para el mismo movimiento.
    const { data: existing } = await supabase
      .from('bank_match_suggestions')
      .select('match_type, match_id')
      .eq('transaction_id', txn.id)
      .eq('status', 'pending');
    const existingKeys = new Set((existing ?? []).map(e => `${e.match_type}:${e.match_id}`));
    const fresh = suggestions.filter(s => !existingKeys.has(`${s.match_type}:${s.match_id}`));
    if (fresh.length === 0) continue;

    const { error: saveErr } = await supabase.from('bank_match_suggestions').insert(
      fresh.map(s => ({
        company_id: txn.company_id, transaction_id: s.transaction_id, match_type: s.match_type,
        match_id: s.match_id, confidence: s.confidence, reason: s.reason, status: 'pending',
      })),
    );
    if (saveErr) console.error('Error saving suggestions for', txn.id, saveErr);
    else {
      suggestedCount += fresh.length;
      // Movimiento con sugerencia(s) pendiente(s) — visible en la UI como
      // "Sugerencia" hasta que el contador apruebe o rechace.
      if (txn.status === 'new') {
        await supabase.from('bank_transactions').update({ status: 'matched' }).eq('id', txn.id);
      }
    }
  }

  return { processed: targets.length, suggested: suggestedCount };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { transaction_id, company_id } = await req.json();
    if (!transaction_id && !company_id) {
      return new Response(JSON.stringify({ error: 'Se requiere transaction_id o company_id' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    let resolvedCompanyId = company_id;
    if (transaction_id && !company_id) {
      const { data: txn } = await supabase.from('bank_transactions').select('company_id').eq('id', transaction_id).single();
      if (!txn) {
        return new Response(JSON.stringify({ error: 'Transacción no encontrada' }), {
          status: 404, headers: { 'Content-Type': 'application/json' },
        });
      }
      resolvedCompanyId = txn.company_id;
    }

    const result = await processCompanyTransactions(resolvedCompanyId, transaction_id);

    return new Response(JSON.stringify({ status: 'ok', ...result }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
