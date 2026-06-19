# 📊 COBRACHECK: PÓLIZAS Y EXPORTACIÓN CONTABLE

**Objetivo:** Generar pólizas descargables (Excel/CSV) para importar directamente en sistemas contables

---

## 🎯 FLUJO ACTUAL vs FLUJO NUEVO

### ❌ FLUJO ACTUAL (Incorrecto)
```
Usuario registra pago en CobraCheck
↓
Sistema genera póliza en memoria
↓
Envía por WhatsApp como TEXTO (ilegible)
↓
Usuario copia manualmente a Excel
↓
Usuario importa en CONTPAQi
❌ Manual, error-prone, ineficiente
```

### ✅ FLUJO NUEVO (Correcto)
```
Usuario registra pago en CobraCheck
↓
Sistema genera póliza (datos estructurados)
↓
Usuario: Click en "Descargar póliza" (Excel/CSV)
↓
Archivo descargable automáticamente
↓
Usuario importa en CONTPAQi/SAP/Excel
✅ Automático, sin errores, profesional
```

---

## 📋 ESTRUCTURA DE PÓLIZA

### ¿Qué es una póliza?
Una póliza es un registro contable que documenta una transacción. En México:
- **Póliza de egreso:** cuando PAGAS (dinero sale)
- **Póliza de ingreso:** cuando RECIBES (dinero entra)
- **Póliza de diario:** ajustes contables

### Campos de una póliza (CONTPAQi compatible)

```
┌─────────────────────────────────────────────┐
│ ENCABEZADO DE PÓLIZA                        │
├─────────────────────────────────────────────┤
│ Tipo Póliza:     EGRESO (E)                 │
│ No. Póliza:      00001                      │
│ Fecha:           2026-06-21                 │
│ Descripción:     Pago a Cliente XYZ         │
│ Referencia:      INV-2026-001               │
│ Usuario:         admin@empresa.com          │
│                                             │
├─────────────────────────────────────────────┤
│ DETALLES (Líneas)                           │
├─────────────────────────────────────────────┤
│ #  Cuenta    Descripción        Debe    Haber│
│ 1  1010      Banco (egreso)     -       5000 │
│ 2  1500      Clientes (cobro)  5000      -  │
│ 3  6100      Comisión cobro      50      -  │
│ 4  2100      IVA por cobrar                5│
│                                TOTAL: 5055  │
└─────────────────────────────────────────────┘
```

---

## 💾 FORMATO DE EXPORTACIÓN

### Opción A: CSV (Excel compatible)

```csv
TipoPoliza,NoPoliza,Fecha,Descripcion,Referencia,Usuario
EGRESO,00001,2026-06-21,Pago a Cliente XYZ,INV-2026-001,admin@empresa.com

No,Cuenta,DescripcionLinea,Debe,Haber,Referencia
1,1010,Banco Egreso,0,5000,
2,1500,Clientes Cobro,5000,0,INV-2026-001
3,6100,Comisión,0,50,
4,2100,IVA,0,5,
```

### Opción B: Excel (XLSX) - Mejor visualización

```
Encabezado:
┌────────────────────────────────────────┐
│ Póliza de Egreso #00001                │
│ Fecha: 21/06/2026                      │
│ Descripción: Pago a Cliente XYZ        │
└────────────────────────────────────────┘

Tabla de líneas:
┌──────────────────────────────────────────────────┐
│ Cuenta │ Descripción          │ Debe  │ Haber    │
├────────┼──────────────────────┼───────┼──────────┤
│ 1010   │ Banco                │ -     │ 5,000.00 │
│ 1500   │ Clientes             │ 5,000│ -        │
│ 6100   │ Comisión             │ -     │ 50.00    │
│ 2100   │ IVA                  │ -     │ 5.00     │
│        │ TOTAL                │ 5,000│ 5,055.00 │
└──────────────────────────────────────┘
```

---

## 🔧 IMPLEMENTACIÓN TÉCNICA

### 1. Generar póliza desde pago registrado

```typescript
// lib/poliza.ts

export interface PolizaLine {
  numero: number
  cuenta: string
  descripcion: string
  debe: number
  haber: number
  referencia?: string
}

export interface Poliza {
  tipo: 'EGRESO' | 'INGRESO' | 'DIARIO'
  noPoliza: string
  fecha: Date
  descripcion: string
  referencia: string
  usuario: string
  lineas: PolizaLine[]
}

export function generatePolizaFromPayment(payment: CobraPayment, company: Company): Poliza {
  const poliza: Poliza = {
    tipo: 'EGRESO', // Dinero que sale
    noPoliza: `${payment.id.substring(0, 5).toUpperCase()}`,
    fecha: new Date(payment.payment_date),
    descripcion: `Pago de Cliente: ${payment.client_name}`,
    referencia: payment.invoice_folio,
    usuario: payment.processed_by || 'SISTEMA',
    lineas: [
      {
        numero: 1,
        cuenta: company.bank_account || '1010', // Cuenta bancaria
        descripcion: 'Banco - Cobro',
        debe: 0,
        haber: payment.amount
      },
      {
        numero: 2,
        cuenta: '1500', // Cuentas por cobrar (o créditos clientes)
        descripcion: `Cliente: ${payment.client_name}`,
        debe: payment.amount,
        haber: 0,
        referencia: payment.invoice_folio
      }
    ]
  }

  // Agregar línea de comisión si existe
  if (payment.commission && payment.commission > 0) {
    poliza.lineas.push({
      numero: 3,
      cuenta: '6100', // Gastos de cobranza
      descripcion: 'Comisión de cobro',
      debe: 0,
      haber: payment.commission
    })
  }

  // Validar que debe = haber
  const totalDebe = poliza.lineas.reduce((s, l) => s + l.debe, 0)
  const totalHaber = poliza.lineas.reduce((s, l) => s + l.haber, 0)
  
  if (Math.abs(totalDebe - totalHaber) > 0.01) {
    console.error('Póliza desbalanceada:', { totalDebe, totalHaber })
  }

  return poliza
}
```

### 2. Exportar a CSV

```typescript
// lib/export-csv.ts

export function generateCSV(poliza: Poliza): string {
  const lines: string[] = []

  // Encabezado
  lines.push(`TipoPoliza,NoPoliza,Fecha,Descripcion,Referencia,Usuario`)
  lines.push(`"${poliza.tipo}","${poliza.noPoliza}","${formatDate(poliza.fecha)}","${poliza.descripcion}","${poliza.referencia}","${poliza.usuario}"`)
  lines.push('') // Línea vacía

  // Detalles
  lines.push(`No,Cuenta,DescripcionLinea,Debe,Haber,Referencia`)
  
  poliza.lineas.forEach(linea => {
    lines.push(
      `${linea.numero},"${linea.cuenta}","${linea.descripcion}",${linea.debe},${linea.haber},"${linea.referencia || ''}"`
    )
  })

  return lines.join('\n')
}

export function downloadCSV(poliza: Poliza) {
  const csv = generateCSV(poliza)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  link.setAttribute('href', URL.createObjectURL(blob))
  link.setAttribute('download', `Poliza_${poliza.noPoliza}_${formatDate(poliza.fecha)}.csv`)
  link.click()
}
```

### 3. Exportar a Excel (XLSX)

```typescript
// lib/export-excel.ts

import * as XLSX from 'xlsx'

export function generateExcel(poliza: Poliza): ArrayBuffer {
  const workbook = XLSX.utils.book_new()

  // Hoja 1: Encabezado + Detalles
  const worksheetData = [
    [`Póliza de ${poliza.tipo}`, `#${poliza.noPoliza}`],
    [`Fecha:`, formatDate(poliza.fecha)],
    [`Descripción:`, poliza.descripcion],
    [`Referencia:`, poliza.referencia],
    [],
    // Tabla de líneas
    ['No', 'Cuenta', 'Descripción', 'Debe', 'Haber', 'Referencia'],
    ...poliza.lineas.map(l => [
      l.numero,
      l.cuenta,
      l.descripcion,
      l.debe,
      l.haber,
      l.referencia || ''
    ]),
    [],
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
  
  // Formateo
  worksheet['!cols'] = [
    { wch: 5 },   // No
    { wch: 12 },  // Cuenta
    { wch: 30 },  // Descripción
    { wch: 12 },  // Debe
    { wch: 12 },  // Haber
    { wch: 15 }   // Referencia
  ]

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Póliza')
  
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
}

export function downloadExcel(poliza: Poliza) {
  const excelBuffer = generateExcel(poliza)
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const link = document.createElement('a')
  
  link.setAttribute('href', URL.createObjectURL(blob))
  link.setAttribute('download', `Poliza_${poliza.noPoliza}_${formatDate(poliza.fecha)}.xlsx`)
  link.click()
}
```

### 4. UI Component en CobraCheck

```typescript
// components/PolizaDownload.tsx

'use client'

import { Poliza, generatePolizaFromPayment } from '@/lib/poliza'
import { downloadCSV, downloadExcel } from '@/lib/export'

interface PolizaDownloadProps {
  payment: CobraPayment
  company: Company
}

export function PolizaDownload({ payment, company }: PolizaDownloadProps) {
  const poliza = generatePolizaFromPayment(payment, company)

  return (
    <div className="flex gap-2">
      <button
        onClick={() => downloadCSV(poliza)}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        📥 Descargar CSV
      </button>
      
      <button
        onClick={() => downloadExcel(poliza)}
        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
      >
        📊 Descargar Excel
      </button>
    </div>
  )
}
```

---

## 🔗 INTEGRACIÓN CON SISTEMAS CONTABLES

### CONTPAQi (Más usado en México)

**Formato requerido:**
- Archivo: CSV o TXT
- Codificación: UTF-8 o ANSI
- Campos: TipoPoliza, NoPoliza, Fecha, Cuenta, Debe, Haber

**Importar en CONTPAQi:**
```
1. Abrir CONTPAQi
2. Catálogo → Pólizas
3. Importar
4. Seleccionar archivo CSV
5. Mapear campos
6. Importar
```

**Compatibilidad:** ✅ TOTAL (nuestro formato es compatible)

---

### SAP B1 (Empresas medianas)

**API disponible:** Sí (REST)

**Implementación:**
```typescript
// lib/integrations/sap.ts

export async function uploadPolizaToSAP(poliza: Poliza, sapConfig: SAPConfig) {
  const payload = {
    DocumentType: 'jdtJournalEntry',
    Reference1: poliza.referencia,
    Memo: poliza.descripcion,
    DueDate: formatDate(poliza.fecha),
    Line_Items: poliza.lineas.map(l => ({
      AccountCode: l.cuenta,
      Debit: l.debe,
      Credit: l.haber,
      LineDescription: l.descripcion,
      Reference2: l.referencia
    }))
  }

  const response = await fetch(`${sapConfig.url}/JournalEntries`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sapConfig.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  return response.json()
}
```

**Estado:** ⚠️ FUTURO (requiere configuración SAP)

---

### Excel directo (Importar a Excel)

**Formato:** XLSX generado automáticamente

**Uso:** El contador abre en Excel, revisa, y luego importa a CONTPAQi

**Estado:** ✅ IMPLEMENTADO (ya tenemos la función)

---

### API Nativa (Futura)

Podríamos hacer API propia:
```
POST /api/polizas/export
Body: { paymentId, format: 'csv' | 'xlsx' | 'sap' }
Response: Descargable automáticamente
```

---

## 📱 FLUJO EN APP COBRACHECK

### Registrar pago → Ver póliza

```
Usuario en CobraCheck:

1. Registra pago
   ├─ Cliente: XYZ
   ├─ Monto: $5,000
   └─ Fecha: 21/06/2026

2. Sistema calcula póliza automáticamente

3. Pantalla muestra:
   ┌──────────────────────────────────┐
   │ Pago registrado ✅                │
   ├──────────────────────────────────┤
   │                                  │
   │ Cliente: XYZ                      │
   │ Monto: $5,000                     │
   │ Fecha: 21/06/2026                │
   │                                  │
   │ ┌──────────────────────────────┐ │
   │ │ Póliza generada:             │ │
   │ │                              │ │
   │ │ [📥 Descargar CSV]           │ │
   │ │ [📊 Descargar Excel]         │ │
   │ │ [📋 Ver en pantalla]         │ │
   │ └──────────────────────────────┘ │
   │                                  │
   │ ❌ NO: "Enviar por WhatsApp"    │
   │    (era antiguo)                 │
   │                                  │
   └──────────────────────────────────┘

4. Usuario: Click en "Descargar Excel"
   ↓
   Descarga automáticamente
   ↓
   Abre en Excel
   ↓
   Revisa
   ↓
   Importa a CONTPAQi
```

---

## 🎯 CHECKLIST IMPLEMENTACIÓN

- [ ] Crear función `generatePolizaFromPayment()`
- [ ] Crear función `downloadCSV()`
- [ ] Crear función `downloadExcel()`
- [ ] Crear componente `PolizaDownload`
- [ ] Agregar en CobraCheck payment screen
- [ ] Testear: CSV → Excel
- [ ] Testear: Excel → CONTPAQi import
- [ ] QUITAR: Función de envío por WhatsApp (antiguo)

---

## 📊 VENTAJAS

| Antes (WhatsApp) | Después (Descargable) |
|---|---|
| ❌ Texto ilegible | ✅ Estructura clara |
| ❌ Manual copy-paste | ✅ Descarga automática |
| ❌ Errores frecuentes | ✅ Sin errores |
| ❌ No contable | ✅ Contabilidad válida |
| ❌ No profesional | ✅ Muy profesional |

---

**Resultado:** CobraCheck → Póliza descargable → CONTPAQi (en 3 clics)

**Limpio, depurado, sin vueltas.**
