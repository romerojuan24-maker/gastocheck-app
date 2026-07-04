import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { CobraInvoice } from '../types'

export function calculateInterest(invoice: CobraInvoice): number {
  if (invoice.days_overdue <= 0 || !invoice.interest_rate) return 0
  const monthsOverdue = invoice.days_overdue / 30
  return Math.round(invoice.amount * invoice.interest_rate * monthsOverdue * 100) / 100
}

export function useClientInvoices(clientId: string, companyId: string) {
  const [invoices, setInvoices] = useState<CobraInvoice[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clientId || !companyId) return
    setLoading(true)
    supabase
      .from('cobra_invoices')
      .select('id, company_id, client_id, folio, amount, subtotal, tax, issue_date, due_date, payment_date, status, days_overdue, interest_rate, uuid_sat')
      .eq('client_id', clientId)
      .eq('company_id', companyId)
      .in('status', ['pending', 'overdue'])
      .order('due_date', { ascending: true })
      .then(({ data }) => {
        setInvoices((data as CobraInvoice[]) || [])
        setLoading(false)
      })
  }, [clientId, companyId])

  const totalDue = invoices.reduce((s, i) => s + i.amount, 0)
  const totalInterest = invoices.reduce((s, i) => s + calculateInterest(i), 0)
  const totalWithInterest = totalDue + totalInterest

  return { invoices, loading, totalDue, totalInterest, totalWithInterest }
}
