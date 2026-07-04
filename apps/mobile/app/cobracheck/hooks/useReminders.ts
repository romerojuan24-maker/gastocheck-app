import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import type { CobraReminder } from '../types'

export function useReminders(companyId: string) {
  const [reminders, setReminders] = useState<CobraReminder[]>([])
  const [loading, setLoading] = useState(false)

  const fetchReminders = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    const { data } = await supabase
      .from('cobra_reminders')
      .select('*')
      .eq('company_id', companyId)
      .in('status', ['scheduled'])
      .order('next_reminder_date', { ascending: true })
    setReminders((data as CobraReminder[]) || [])
    setLoading(false)
  }, [companyId])

  useEffect(() => { fetchReminders() }, [fetchReminders])

  const createReminder = useCallback(async (
    reminder: Omit<CobraReminder, 'id' | 'created_at' | 'sent_at'>
  ) => {
    const { data, error } = await supabase
      .from('cobra_reminders')
      .insert([reminder])
      .select()
      .single()
    if (!error && data) setReminders(prev => [...prev, data as CobraReminder])
    return { data, error }
  }, [])

  const cancelReminder = useCallback(async (id: string) => {
    await supabase.from('cobra_reminders').update({ status: 'cancelled' }).eq('id', id)
    setReminders(prev => prev.filter(r => r.id !== id))
  }, [])

  return { reminders, loading, fetchReminders, createReminder, cancelReminder }
}
