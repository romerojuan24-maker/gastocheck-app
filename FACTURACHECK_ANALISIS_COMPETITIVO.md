# 📊 FacturaCheck — Análisis Competitivo

**Objetivo**: Mapear qué es obligatorio vs distintivo comparando plataformas mexicanas  
**Status**: ESPERANDO INVESTIGACIÓN (agente en progreso)  
**Responsable**: Juan + Investigación

---

## 🔍 PROGRAMAS ANALIZADOS

> **NOTA**: Este documento se completará cuando la investigación termine.
> Agente buscando: Facturama, Nominaplus, Kontafacil, Siigo, Aspel-COI, Contpaqi

---

## MATRIZ COMPARATIVA (Por completar)

### OBLIGATORIOS — TODOS tienen:

| Feature | Descripción | Criticidad |
|---------|------------|-----------|
| Timbre Digital (PAC) | Integración con PAC para firmar CFDIs | CRÍTICA |
| RFC Validation | Validar RFC emisor/receptor | CRÍTICA |
| Folio Secuencial | Sin gaps (auditoría SAT) | CRÍTICA |
| XML + PDF | Generar ambos formatos | CRÍTICA |
| 5-Year Retention | Guardar originales | CRÍTICA |
| Auditoría Fiscal | Quién, qué, cuándo | CRÍTICA |
| Cancelación Digital | Acta de cancelación | ALTA |

**CONCLUSIÓN ESPERADA**: Todos los competidores cumplen con obligatorios. Diferencial está en **distintivos**.

---

## DISTINTIVOS — DIFERENCIAL NUESTRO

### Candidatos a investigar:

| Feature | Facturama | Nominaplus | Kontafacil | Siigo | Aspel-COI | Nuestro |
|---------|----------|-----------|-----------|-------|-----------|---------|
| **Crédito/Saldo** | ❓ | ❓ | ❓ | ❓ | ❓ | ✅ Integrado |
| **WhatsApp** | ❓ | ❓ | ❓ | ❓ | ❓ | ✅ Automático |
| **Integración CobraCheck** | ❓ | ❌ No existe | ❓ | ❓ | ❌ No existe | ✅ NATIVE |
| **Plan Fijo + Destajo** | ❓ | ❓ | ❓ | ❓ | ❓ | ✅ Híbrido |
| **Línea Sobregiro** | ❓ | ❓ | ❓ | ❓ | ❓ | ✅ Configurable |
| **Multi-módulo Sync** | ❌ No | ❓ | ❌ No | ❓ | ❌ No | ✅ (GC+BC+BanC) |
| **Reportes por Empresa** | ❓ | ❓ | ❓ | ❓ | ❓ | ✅ Granular |

---

## 🎯 DECISIONES A TOMAR (Por competencia)

### Pregunta 1: ¿Facturama vs otros PACs?
- **Si Facturama es el único con X feature**: adoptamos FacturaCheck + Facturama
- **Si todos son similares**: aprovechamos Facturama por costo/integración

### Pregunta 2: ¿Quién maneja la compra de timbres?
- **Opción A**: Usuario compra timbres directamente en Facturama (fuera de nuestro sistema)
  - Ventaja: No manejamos crédito
  - Desventaja: Experiencia fragmentada
  
- **Opción B**: Usuario compra timbres EN nuestro dashboard (nosotros cobramos)
  - Ventaja: UX integrada, oportunidad de monetización
  - Desventaja: Manejo de crédito + reconciliación con Facturama

**RECOMENDACIÓN**: Opción B (tu requisito ya lo dice)

### Pregunta 3: ¿Qué distribuyen los competidores?
- Email: ¿solo vendedor o vendedor+comprador?
- WhatsApp: ¿disponible? ¿costo extra?
- PDF: ¿firmado digitalmente? ¿incluye QR de validación SAT?

---

## 💡 HIPÓTESIS NUESTRO

### OBLIGATORIOS (como todos)
✅ Timbre con Facturama  
✅ RFC validation SAT  
✅ Folio secuencial  
✅ XML + PDF  
✅ 5-year bucket  
✅ Auditoría fiscal  
✅ Cancelación digital

### DISTINTIVOS (probablemente mejor que competencia)
✅ **Sistema de crédito integrado** (prepago + destajo + sobregiro)  
✅ **WhatsApp automático** (no solo email)  
✅ **Integración CobraCheck native** (no la tiene nadie)  
✅ **Multi-módulo sync** (CFDI conectada a cobro/gasto/banco)  
✅ **Reportes granulares por empresa** (útil para supervisor)  
✅ **Línea de sobregiro flexible** (apoyo en urgencias)  
✅ **Modelo de precios híbrido** (plan+destajo, no solo uno)

---

## 📋 RESULTADOS DE INVESTIGACIÓN (Por llenar)

### Facturama
- **Características**: [esperando]
- **Pricing**: [esperando]
- **Integraciones**: [esperando]
- **Diferenciales**: [esperando]

### Nominaplus
- **Características**: [esperando]
- **Pricing**: [esperando]

### Kontafacil
- **Características**: [esperando]
- **Pricing**: [esperando]

### Siigo
- **Características**: [esperando]
- **Pricing**: [esperando]

### Aspel-COI
- **Características**: [esperando]
- **Pricing**: [esperando]

### Contpaqi
- **Características**: [esperando]
- **Pricing**: [esperando]

---

## 🎬 PLAN PRÓXIMO (Después de investigación)

1. **Mapear Obligatorios vs Distintivos** (matriz)
2. **Validar Hipótesis** (¿realmente somos diferentes?)
3. **Ajustar Arquitectura** (si investigación revela gaps)
4. **Confirmar Facturama** (vs alternativas PAC)
5. **Definir Modelo Precios** (basado en competencia)
6. **Crear Roadmap** (con requerimientos confirmados)

---

## 📌 NOTAS

- Agente de investigación en progreso: `a68b66d71aa57b4b7`
- Output esperado: matriz de features, precios, diferenciales
- Tiempo estimado: 15-20 min búsqueda
- Referencias: Google, Capterra, sitios oficiales

**Actualizar este doc cuando investig termine.**

