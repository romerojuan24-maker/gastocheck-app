import { useState } from 'react';
import type { OcrResult } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

export function useOcr() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function extractFromImage(
    base64: string,
    mimeType: string = 'image/jpeg',
  ): Promise<OcrResult | null> {
    setLoading(true);
    setError(null);
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

      const url = `${supabaseUrl}/functions/v1/ocr-extract`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image_base64: base64, mime_type: mimeType }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'OCR falló');
      }

      const { data } = await res.json();
      return data as OcrResult;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { extractFromImage, loading, error };
}
