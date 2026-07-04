import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import type { CfdiDocument } from '../types'

export function useFacturaDocuments(companyId: string) {
  const [documents, setDocuments] = useState<CfdiDocument[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('cfdi_documents')
        .select('*')
        .eq('company_id', companyId)
        .order('fecha_emision', { ascending: false })
        .limit(200)
      setDocuments((data ?? []) as CfdiDocument[])
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    load()
  }, [load])

  return { documents, loading, refetch: load }
}
