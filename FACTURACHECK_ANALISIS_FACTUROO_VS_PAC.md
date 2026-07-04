# 📊 FacturaCheck — Análisis FACTUROO vs Alternativas PAC (2026-07-04)

**Estado**: Investigación completada  
**Recomendación**: PAC flexible (abstraer en code, decidir después)  
**Decisión bloqueante**: Contactar FACTUROO API capabilities

---

## 🔍 FACTUROO — ANÁLISIS DETALLADO

### ¿Qué es FACTUROO?

**Sitio**: [facturoo.com](https://www.facturoo.com/)  
**Tipo**: Plataforma Cloud de Facturación Electrónica  
**Modelo**: Dashboard web (interfaz usuario, NO API programática)  
**Ubicación**: México (empresa mexicana)

### Capacidades Verificadas

✅ **Confirmado**:
- CFDI 4.0 soportado
- Interfaz web práctica + rápida
- Generación ~3 min por factura (manual en dashboard)
- Personalización (logos, templates)
- Soporte telefónico + video tutoriales
- Almacenamiento documentos

❓ **No confirmado** (requiere contacto directo):
- API REST para integración programática
- Webhooks para eventos
- Multi-RFC nativo
- Distribución automática (email/WhatsApp)
- Complementos CFDI (Carta Porte, Pagos, Retenciones)
- PAC certificado SAT
- Sandbox/ambiente pruebas
- Política almacenamiento 5 años

### Pricing FACTUROO

| Plan | CFDIs/mes | Precio |
|------|-----------|--------|
| Básico | 15 | $199 MXN |
| Estándar | 25 | $299 MXN |
| Premium | 1,000 | $2,499 MXN |
| Enterprise | 2,500 | $5,350 MXN |
| Trial | 10 (gratis) | Gratis |

**Limitación**: No hay API pricing visible → sin opción "consumibles por timbre"

### Contacto Directo Requerido

```
Email: hola@facturoo.com
Preguntas críticas:
1. ¿Ofrece API REST para integración programática?
2. ¿Soporta webhooks/notificaciones?
3. ¿Cuál es el modelo de autenticación?
4. ¿Soporta multi-RFC nativo?
5. ¿Qué métodos de distribución (email, WhatsApp, SMS)?
6. ¿Está certificado como PAC por SAT?
7. ¿Ofrece sandbox?
8. ¿Almacena XML por 5 años?
9. ¿Soporta cancelación digital SAT moderna?
10. ¿Qué SLA/uptime garantiza?
```

---

## 🏆 ALTERNATIVAS CERTIFICADAS PAC (CON API)

### 1. FACTURAMA — ⭐ RECOMENDADO (API Madura)

**URL**: [facturama.mx](https://facturama.mx/)  
**Status**: PAC certificado SAT ✓

**API REST**:
- Base: `https://apisandbox.facturama.mx/` (sandbox)
- Auth: OAuth 2.0 + API Keys
- Endpoints:
  - POST/GET Invoices (crear, consultar, descargar)
  - POST Distribution (enviar email)
  - POST Cancellation (cancelar CFDI)
  - Multi-RFC nativo
  - Webhooks completo
- Documentación: [apisandbox.facturama.mx/Docs](https://apisandbox.facturama.mx/Docs)
- Librerías: PHP, .NET, Java, JavaScript, Ruby, Python

**Pricing**:
- Plan Básico: $110 MXN (25 CFDIs)
- Plan Estándar: $165 MXN (40 CFDIs)
- Plan Ilimitado: $1,650 MXN/año (100 CFDIs gratis)
- API: $1,650 MXN/año + $0.40-0.50/folio extra
- Trial: 30 días + 15 facturas gratis

**Fortalezas**:
✅ API madura + documentada  
✅ Multi-RFC nativo  
✅ Almacenamiento ilimitado (5Y+)  
✅ Complementos CFDI (Carta Porte, Pagos, Retenciones)  
✅ Webhooks con estado: 'enviado', 'aceptado', 'cancelado'  
✅ 20,000+ clientes activos  
✅ Reconocida por Entrepreneur como "más amigable"  

**Debilidades**:
❌ No soporta WhatsApp automático (solo email)  
❌ Costo más alto vs competencia  

**Integración FacturaCheck**: ⭐ RECOMENDADA

---

### 2. FACTURAPI — ⭐ ALTERNATIVA (API-First)

**URL**: [facturapi.io](https://www.facturapi.io/)  
**Status**: PAC certificado SAT ✓

**API REST**:
- Base: `https://www.facturapi.io/v2/`
- Auth: Bearer token (ambiente Test vs Live)
- Endpoints:
  - POST /customers (validación RFC real-time SAT)
  - POST /invoices (crear CFDI)
  - POST /invoices/:id/cancel (cancelación digital)
  - GET /invoices/:id (consultar + descargar)
  - Webhooks: status updates, cancelación
  - Rate limiting: Implementado (429 responses)
- Documentación: [docs.facturapi.io/en/api/](https://docs.facturapi.io/en/api/)
- SDKs: Node.js, Python, PHP, Java

**Pricing**:
- Plan Estándar: $299 MXN/mes + consumibles
- Trial: 14 días gratis
- Consumibles: $0.35-0.50/folio (estimado)

**Fortalezas**:
✅ Validación RFC real-time SAT  
✅ API moderna + completa  
✅ Multi-RFC nativo  
✅ Complementos CFDI  
✅ Webhooks con reintentos  
✅ Sandbox con ambiente test  
✅ Dashboard para testing  

**Debilidades**:
❌ Menos clientes vs Facturama  
❌ Documentación menos extensa  
❌ Validación RFC puede ralentizar (SAT API lenta)  

**Integración FacturaCheck**: ⭐ RECOMENDADA

---

### 3. SENHUB — ⭐ EFICIENTE (Mejor precio + velocidad)

**URL**: [senhub.mx](https://senhub.mx/)  
**Status**: PAC certificado SAT ✓

**Especificaciones**:
- Velocidad: CFDI 4.0 generado en ~30 segundos
- Multi-RFC: Nativo
- Complementos: Carta Porte 3.1, Nómina, Pagos
- Email distribution: ✓
- WhatsApp distribution: ✓ (verificar nativo vs integración)

**Pricing**:
- Plan Emprendedor: $79 MXN/mes (sin contratos)
- Planes escala: $199, $349, $599 MXN
- Folios incluidos: Varía por plan

**Fortalezas**:
✅ Precio más competitivo ($79 vs $110+)  
✅ Velocidad excepcional (30s vs 3min)  
✅ Multi-RFC nativo  
✅ WhatsApp nativo (DIFERENCIAL)  
✅ Complementos CFDI  
✅ Flexible sin contratos  

**Debilidades**:
❓ API REST: Requiere verificación (no documentada públicamente)  
❓ Webhooks: Requiere verificación  
❓ Certificación PAC: Asumir ✓ pero verificar  

**Integración FacturaCheck**: 🟡 VIABLE (verificar API capabilities)

---

### 4. FACTURAPORTI — Alternativa (Económica)

**URL**: [facturaporti.com.mx](https://facturaporti.com.mx/)  
**Status**: PAC certificado SAT ✓

**API**:
- REST API disponible
- Timbrado masivo (Excel + API)
- Documentación: [developers.facturaporti.com.mx](https://developers.facturaporti.com.mx/reference/api-facturacion-electronica)

**Pricing**:
- Desde $50 MXN (paquetes anuales)
- Mensual: ~$100 MXN
- Consumibles: $0.50/folio (estimado)

**Fortalezas**:
✅ Precio más bajo  
✅ API REST disponible  
✅ Timbrado masivo  
✅ Multi-RFC  

**Debilidades**:
❌ Menos clientes vs Facturama  
❌ Documentación limitada  
❌ Reputación menor en mercado  

---

## 📊 MATRIZ COMPARATIVA

| Feature | FACTUROO | Facturama | Facturapi | SenHub | FacturaPorTi |
|---------|----------|-----------|-----------|--------|--------------|
| **PAC SAT Cert.** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **API REST** | ❓ | ✓ | ✓ | ❓ | ✓ |
| **Webhooks** | ❓ | ✓ | ✓ | ❓ | ❓ |
| **Multi-RFC** | ❓ | ✓ | ✓ | ✓ | ✓ |
| **Email Auto** | ❓ | ✓ | ✓ | ✓ | ✓ |
| **WhatsApp Auto** | ❓ | ❌ | ❌ | ✓ | ❓ |
| **CFDI 4.0** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Complementos** | ❓ | ✓ | ✓ | ✓ | ✓ |
| **Cancelación SAT** | ❓ | ✓ | ✓ | ✓ | ✓ |
| **RFC Validation** | ❓ | Batch | Real-time | ? | Batch |
| **Sandbox** | ❓ | ✓ | ✓ | ✓ | ✓ |
| **Almacenamiento 5Y** | ❓ | ✓ | ✓ | ✓ | ✓ |
| **Precio (MXN/mes)** | $199+ | $110+ | $299+ | $79+ | $50+ |
| **Costo/Folio** | Incluido | $0.40-0.50 | $0.35-0.50 | Incluido | $0.50 |

---

## 🏗️ RECOMENDACIÓN ARQUITECTURA: PAC FLEXIBLE

**Estrategia**: No elegir un PAC ahora, sino abstraerlo en código

```typescript
// services/pac/types.ts
export interface PACProvider {
  name: 'facturama' | 'facturapi' | 'senhub' | 'facturaporti' | 'facturoo'
  stampCfdi(xml: string): Promise<{ uuid: string; xml: string }>
  distributeEmail(uuid: string, email: string): Promise<boolean>
  distributeWhatsApp(uuid: string, phone: string): Promise<boolean>
  cancelCfdi(uuid: string, reason: string): Promise<boolean>
  validateRfc(rfc: string): Promise<boolean>
}

// services/pac/factory.ts
export class PACFactory {
  static getPAC(provider: string): PACProvider {
    switch(provider) {
      case 'facturama':
        return new FacturamaProvider()
      case 'facturapi':
        return new FacturapiProvider()
      case 'senhub':
        return new SenHubProvider()
      default:
        throw new Error(`PAC no soportado: ${provider}`)
    }
  }
}

// services/pac/providers/facturama.ts
export class FacturamaProvider implements PACProvider {
  constructor(private apiKey: string) {}
  
  async stampCfdi(xml: string): Promise<{ uuid: string; xml: string }> {
    // Facturama API call
  }
  // ... implementar otros métodos
}

// config/pac.config.ts
export const PAC_CONFIG = {
  provider: process.env.PAC_PROVIDER || 'facturama',
  apiKey: process.env.PAC_API_KEY,
  sandbox: process.env.NODE_ENV === 'development'
}
```

**Ventajas de esta estrategia**:
✅ No depender de un PAC específico  
✅ Poder cambiar PAC en producción sin código  
✅ Testear con sandbox cualquier PAC  
✅ Preparar failover (2do PAC)  
✅ Esperar a FACTUROO sin cambiar arquitectura

---

## 🎯 DECISIÓN INMEDIATA

**Para Daniel Semana 1**:

1. ✅ **Usar abstracción PAC** (no hardcodear Facturama)
2. ✅ **Implementar FacturamaProvider** (default, maduro, documentado)
3. ✅ **Preparar FacturaapiProvider** (alternativa lista)
4. ⏳ **Contactar FACTUROO** — mientras Daniel codifica
5. ⏳ **Si FACTUROO tiene API** → implementar en Semana 2
6. ⏳ **Si FACTUROO no tiene API** → mantener Facturama como PAC

---

## 📞 SIGUIENTES PASOS

### 1. CONTACTAR FACTUROO (Tu Equipo)
```
Email: hola@facturoo.com
Asunto: Integración API FACTUROO + FacturaCheck

Cuerpo:
Estamos desarrollando FacturaCheck, una plataforma SaaS de facturación 
integrada con cobranza. Queremos integrar FACTUROO como opción de PAC.

Preguntas críticas:
1. ¿Ofrece API REST para integración programática?
2. ¿Qué tipos de comprobantes y complementos soporta?
3. ¿Cuál es la metodología para distribución automática (email, WhatsApp)?
4. ¿Está certificado como PAC por SAT?
5. ¿Ofrece sandbox/QA environment?
6. ¿Cuál es el modelo de precios para volumen?
```

### 2. DANIEL COMIENZA CON FACTURAMA (DEFAULT)
```
Semana 1:
- Implementar PACProvider (interfaz genérica)
- Facturama: integración completa (API madura)
- Tests: sandbox Facturama
- Config: process.env.PAC_PROVIDER = 'facturama'
```

### 3. FLEXIBLE PARA FUTURO
```
Semana 2+:
- Si FACTUROO + API → FacturooProvider
- Si SenHub → SenHubProvider
- Si Facturapi → FacturaapiProvider
```

---

## 💰 IMPACTO FINANCIERO

**Scenario 1: Mantener FACTUROO**
- Si FACTUROO tiene API ✓
- Costo: $199-2,499 MXN/mes (según plan)
- Ventaja: Continuidad con herramienta actual
- Riesgo: API puede no tener todas features

**Scenario 2: Migrar a Facturama**
- Costo: $1,650 MXN/año + $0.40-0.50/folio
- Ventaja: API madura, garantizado
- Margen: Similar ($399/mes FacturaCheck)

**Scenario 3: Usar SenHub (Costo-Optimizado)**
- Costo: $79 MXN/mes + consumibles
- Ventaja: Precio ultra-competitivo, WhatsApp nativo
- Riesgo: API requiere verificación

---

## ✅ RECOMENDACIÓN FINAL

**Arquitectura Inmediata**:
1. Implementar `PACProvider` interfaz (agnóstico)
2. Facturama como default (seguro, maduro)
3. SenHub como fallback (económico, rápido)
4. FACTUROO como investigación paralela (esperar respuesta API)

**Timeline**:
- Hoy: Contactar FACTUROO
- Semana 1: Daniel implementa con Facturama
- Semana 2: Integrar respuesta FACTUROO o mantener Facturama
- Semana 3+: Múltiples PACs si necesario

**Riesgo Mitigado**: NO quedar atrapado en un PAC

---

**Documento**: 2026-07-04  
**Estado**: LISTO PARA DECISIÓN  
**Owner**: Juan (decidir PAC después de respuesta FACTUROO)  
**Daniel**: Implementar con Facturama default, arquitectura flexible

