// Exportación de pólizas a Excel (XLSX)

import { Poliza, formatDateForPoliza, formatMoney } from './poliza'

/**
 * Genera un XLSX a partir de una póliza
 * Requiere: npm install xlsx
 */
export async function generateExcel(poliza: Poliza): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx')

  const workbook = XLSX.utils.book_new()

  // Datos para la hoja
  const worksheetData: (string | number)[][] = [
    [`Póliza de ${poliza.tipo}`, `#${poliza.noPoliza}`],
    [`Fecha:`, formatDateForPoliza(poliza.fecha)],
    [`Descripción:`, poliza.descripcion],
    [`Referencia:`, poliza.referencia],
    [`Usuario:`, poliza.usuario],
    [],
    // Encabezado de tabla
    ['No', 'Cuenta', 'Descripción', 'Debe', 'Haber', 'Referencia'],
    // Líneas
    ...poliza.lineas.map((l) => [
      l.numero,
      l.cuenta,
      l.descripcion,
      l.debe,
      l.haber,
      l.referencia || ''
    ]),
    [],
    // Totales
    [
      'TOTAL',
      '',
      '',
      poliza.lineas.reduce((s, l) => s + l.debe, 0),
      poliza.lineas.reduce((s, l) => s + l.haber, 0),
      ''
    ]
  ]

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

  // Formateo de columnas
  worksheet['!cols'] = [
    { wch: 5 }, // No
    { wch: 12 }, // Cuenta
    { wch: 35 }, // Descripción
    { wch: 12 }, // Debe
    { wch: 12 }, // Haber
    { wch: 15 } // Referencia
  ]

  // Formateo de celdas (opcional: aplicar estilos)
  // Por ahora, estructura básica funcional

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Póliza')

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
}

/**
 * Descarga una póliza como Excel
 */
export async function downloadExcel(poliza: Poliza): Promise<void> {
  try {
    const excelBuffer = await generateExcel(poliza)
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const link = document.createElement('a')

    const fecha = formatDateForPoliza(poliza.fecha).replace(/\//g, '-')
    const filename = `Poliza_${poliza.noPoliza}_${fecha}.xlsx`

    link.setAttribute('href', URL.createObjectURL(blob))
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Error descargando Excel:', error)
    throw new Error('Error al descargar póliza Excel')
  }
}
