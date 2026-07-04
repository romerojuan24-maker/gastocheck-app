export interface CfdiDocument {
  id: string
  company_id: string
  uuid_cfdi: string
  rfc_emisor: string
  rfc_receptor: string
  direction: 'received' | 'issued'
  total: number
  fecha_emision: string
  status: 'valid' | 'cancelado' | 'not_found' | 'duplicate'
  xml_content: string | null
  created_at: string
}
