import { useState, useCallback } from 'react'
import { Share, Linking } from 'react-native'
import { supabase } from '../../../lib/supabase'
import type { CobraPaymentLink } from '../types'

const BASE_URL = 'https://checksuite.mx/pago'

export function usePaymentLink() {
  const [loading, setLoading] = useState(false)

  const createLink = useCallback(async (params: {
    company_id: string
    client_id: string
    invoice_id?: string
    amount: number
    interest?: number
    description?: string
    created_by: string
  }): Promise<CobraPaymentLink | null> => {
    setLoading(true)
    const { data, error } = await supabase
      .from('cobra_payment_links')
      .insert([{ ...params, interest: params.interest ?? 0 }])
      .select()
      .single()
    setLoading(false)
    if (error) return null
    return data as CobraPaymentLink
  }, [])

  const buildMessage = (
    clientName: string,
    amount: number,
    interest: number,
    token: string,
    folio?: string
  ): string => {
    const total = amount + interest
    const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2 })
    const link = `${BASE_URL}/${token}`
    let msg = `Estimado(a) *${clientName}*,\n\n`
    if (folio) msg += `Factura: *${folio}*\n`
    msg += `• Saldo: $${fmt(amount)}\n`
    if (interest > 0) msg += `• Intereses moratorios: $${fmt(interest)}\n`
    msg += `• *Total a pagar: $${fmt(total)}*\n\n`
    msg += `Pague en línea (SPEI / tarjeta):\n${link}\n\n`
    msg += `Válido 7 días. Gracias por su preferencia.`
    return msg
  }

  const shareViaWhatsApp = useCallback(async (
    clientName: string,
    phone: string | undefined,
    amount: number,
    interest: number,
    token: string,
    folio?: string
  ) => {
    const message = buildMessage(clientName, amount, interest, token, folio)
    if (phone) {
      const clean = phone.replace(/\D/g, '')
      const waUrl = `https://wa.me/52${clean}?text=${encodeURIComponent(message)}`
      await Linking.openURL(waUrl).catch(() => Share.share({ message }))
    } else {
      await Share.share({ message })
    }
  }, [])

  return { loading, createLink, buildMessage, shareViaWhatsApp }
}
