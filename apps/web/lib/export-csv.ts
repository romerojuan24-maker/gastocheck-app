// Exportación de pólizas a CSV (Excel compatible)

import { Poliza, formatDateForPoliza, formatMoney } from './poliza'

/**
 * Genera un CSV a partir de una póliza
 * Formato compatible con CONTPAQi y Excel
 */
export function generateCSV(poliza: Poliza): string {
  const lines: string[] = []

  // Encabezado de póliza
  lines.push('TipoPoliza,NoPoliza,Fecha,Descripcion,Referencia,Usuario')
  lines.push(
    `"${poliza.tipo}","${poliza.noPoliza}","${formatDateForPoliza(poliza.fecha)}","${poliza.descripcion}","${poliza.referencia}","${poliza.usuario}"`
  )
  lines.push('')

  // Detalles (líneas contables)
  lines.push('No,Cuenta,DescripcionLinea,Debe,Haber,Referencia')

  poliza.lineas.forEach((linea) => {
    lines.push(
      `${linea.numero},"${linea.cuenta}","${linea.descripcion}",${formatMoney(linea.debe)},${formatMoney(linea.haber)},"${linea.referencia || ''}"`
    )
  })

  // Totales
  const totalDebe = poliza.lineas.reduce((s, l) => s + l.debe, 0)
  const totalHaber = poliza.lineas.reduce((s, l) => s + l.haber, 0)

  lines.push('')
  lines.push(`TOTAL,"","",${formatMoney(totalDebe)},${formatMoney(totalHaber)},""`)

  return lines.join('\n')
}

/**
 * Descarga una póliza como CSV
 */
export function downloadCSV(poliza: Poliza): void {
  try {
    const csv = generateCSV(poliza)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')

    const fecha = formatDateForPoliza(poliza.fecha).replace(/\//g, '-')
    const filename = `Poliza_${poliza.noPoliza}_${fecha}.csv`

    link.setAttribute('href', URL.createObjectURL(blob))
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Error descargando CSV:', error)
    throw new Error('Error al descargar póliza CSV')
  }
}
