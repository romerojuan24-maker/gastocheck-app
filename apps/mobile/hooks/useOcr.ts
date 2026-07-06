import { useState } from 'react'
import type { OcrResult } from '@gastocheck/shared'
import { supabase } from '../lib/supabase'

export function useOcr() {
  const [loading, setLoading] = useState(false)

  async function extractFromImage(
    base64: string,
    mimeType: string = 'image/jpeg',
    skipCrop: boolean = false,
  ): Promise<{ data: OcrResult | null; error: string | null; croppedImageBase64: string | null }> {
    setLoading(true)
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''

      const url = `${supabaseUrl}/functions/v1/ocr-extract`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image_base64: base64, mime_type: mimeType, skip_crop: skipCrop }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return { data: null, error: err.error || err.detail || err.message || `Error ${res.status}`, croppedImageBase64: null }
      }

      const body = await res.json()
      return {
        data: body.data as OcrResult,
        error: null,
        croppedImageBase64: body.croppedImageBase64 ?? null,
      }
    } catch (e) {
      return { data: null, error: String(e), croppedImageBase64: null }
    } finally {
      setLoading(false)
    }
  }

  return { extractFromImage, loading }
}
