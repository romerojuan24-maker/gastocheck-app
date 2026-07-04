import { useEffect, useState, useCallback } from 'react'
import type { ScannerResult } from '../types'

export function useScanner(imageUri: string | null) {
  const [result, setResult] = useState<ScannerResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scanImage = useCallback(async (uri: string) => {
    try {
      setLoading(true)
      setError(null)

      // TODO: Implementar llamada real a Gemini Vision API
      // POST /api/cobra/vision/scan con imagen
      // Por ahora simular respuesta
      await new Promise(resolve => setTimeout(resolve, 1500))

      setResult({
        amount: 1500,
        date: new Date().toISOString(),
        provider: 'PROVEEDOR EJEMPLO',
        confidence: 0.95,
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (imageUri) scanImage(imageUri)
  }, [imageUri, scanImage])

  return { result, loading, error }
}
