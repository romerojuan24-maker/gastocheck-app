import { useEffect, useState, useCallback } from 'react'
import * as FileSystem from 'expo-file-system/legacy'
import { useOcr } from '../../../hooks/useOcr'
import type { ScannerResult } from '../types'

export function useScanner(imageUri: string | null) {
  const [result, setResult] = useState<ScannerResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { extractFromImage, loading: ocrLoading } = useOcr()

  const scanImage = useCallback(async (uri: string) => {
    try {
      setLoading(true)
      setError(null)

      // Leer imagen como base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      // Llamar a OCR real (Gemini 1.5 Flash via Edge Function)
      const { data: ocrData, error: ocrError } = await extractFromImage(base64, 'image/jpeg')

      if (ocrError || !ocrData) {
        setError(ocrError || 'No se pudo analizar la imagen')
        return
      }

      // Mapear OcrResult → ScannerResult
      setResult({
        amount: ocrData.total ?? undefined,
        date: ocrData.receiptDate ?? undefined,
        provider: ocrData.providerName ?? undefined,
        confidence: confidenceToNumber(ocrData.confidence),
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [extractFromImage])

  useEffect(() => {
    if (imageUri) scanImage(imageUri)
  }, [imageUri, scanImage])

  return { result, loading: loading || ocrLoading, error }
}

// Convertir confidence string a número (0-1)
function confidenceToNumber(confidence: string | undefined): number {
  if (!confidence) return 0
  if (confidence === 'high') return 0.95
  if (confidence === 'medium') return 0.70
  if (confidence === 'low') return 0.40
  return 0
}
