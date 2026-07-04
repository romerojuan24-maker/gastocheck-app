# 🔧 Features Administrativas — Análisis Competitivo

**Objetivo**: Mapear qué features administrativas ofrecen competidores + feedback clientes + cuál incluir en FacturaCheck  
**Status**: INVESTIGACIÓN EN PROGRESO (esperando reviews + opciones del usuario)  
**Responsable**: Juan (product design)

---

## 📋 FEATURES ADMINISTRATIVAS TÍPICAS

### CATEGORÍA 1: Gestión de Usuarios & Permisos

| Feature | Facturama | CONTPAQi | Aspel-COI | Siigo | Nuestro |
|---------|----------|----------|-----------|-------|---------|
| **Multi-user** | ✅ | ✅ | ✅ | ✅ | ❓ |
| **Roles predefinidos** (Admin, user, viewer) | ✅ | ✅ | ✅ | ✅ | ❓ |
| **Permisos granulares** (quien ve qué) | ⚠️ Limitado | ✅ Granular | ✅ Granular | ⚠️ Limitado | ❓ |
| **Auditoría quién cambió qué** | ⚠️ Mínima | ✅ Completa | ✅ Completa | ⚠️ Mínima | ❓ |
| **Recuperación de cuenta** (2FA, SSO) | ⚠️ Básico | ⚠️ Básico | ⚠️ Básico | ✅ 2FA | ❓ |
| **Invitaciones de usuarios** | ✅ | ✅ | ✅ | ✅ | ❓ |

### CATEGORÍA 2: Configuración & Customización

| Feature | Facturama | CONTPAQi | Aspel-COI | Siigo | Nuestro |
|---------|----------|----------|-----------|-------|---------|
| **Configurar datos empresa** (RFC, razón social) | ✅ | ✅ | ✅ | ✅ | ❓ |
| **Templates de factura customizables** | ✅ | ✅ | ✅ | ✅ | ❓ |
| **Logo/branding personalizado** | ✅ | ✅ | ✅ | ✅ | ❓ |
| **Multi-empresa** (misma cuenta, varias RFC) | ⚠️ Extra costo | ✅ Incluido | ✅ Incluido | ⚠️ Extra | ❓ |
| **Campos adicionales en factura** | ⚠️ No | ✅ Sí | ✅ Sí | ⚠️ No | ❓ |
| **Folio inicial configurable** | ✅ | ✅ | ✅ | ✅ | ❓ |
| **Catálogos personalizados** (clientes, productos) | ✅ | ✅ | ✅ | ✅ | ❓ |

### CATEGORÍA 3: Reporting & Analytics

| Feature | Facturama | CONTPAQi | Aspel-COI | Siigo | Nuestro |
|---------|----------|----------|-----------|-------|---------|
| **Dashboard principal** | ✅ Básico | ✅ Avanzado | ✅ Avanzado | ✅ Básico | ❓ |
| **Reportes por período** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Exportación Excel** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Gráficas/visualización** | ⚠️ No | ✅ Sí | ✅ Sí | ✅ Sí | ❓ |
| **Filtros avanzados** | ⚠️ Limitado | ✅ Avanzado | ✅ Avanzado | ⚠️ Limitado | ❓ |
| **Reportes programados (email auto)** | ❌ No | ⚠️ Manual | ⚠️ Manual | ✅ Automático | ❓ |
| **DIOT automática** | ❌ No | ✅ Automática | ✅ Automática | ❌ No | ❓ |
| **Análisis de impuestos** (IVA, retenciones) | ⚠️ Básico | ✅ Completo | ✅ Completo | ⚠️ Básico | ✅ Planned |

### CATEGORÍA 4: Integraciones & APIs

| Feature | Facturama | CONTPAQi | Aspel-COI | Siigo | Nuestro |
|---------|----------|----------|-----------|-------|---------|
| **API REST** | ✅ | ❌ No | ❌ No | ✅ | ❓ |
| **Webhooks** (notificaciones de eventos) | ✅ | ❌ No | ❌ No | ✅ | ✅ Planned |
| **Integración Contabilidad** (CONTPAQi, Aspel) | ❌ No | ✅ Nativa | ✅ Nativa | ⚠️ Limited | ❓ |
| **Integración Banca** (importar movimientos) | ❌ No | ✅ Banorte | ✅ Bancos MX | ⚠️ Limited | ✅ BancoCheck |
| **Integración CRM** (Salesforce, Hubspot) | ⚠️ No | ❌ No | ❌ No | ⚠️ No | ❓ |
| **Integración E-commerce** (Shopify, WooCommerce) | ✅ | ❌ No | ❌ No | ⚠️ No | ❓ |

### CATEGORÍA 5: Seguridad & Cumplimiento

| Feature | Facturama | CONTPAQi | Aspel-COI | Siigo | Nuestro |
|---------|----------|----------|-----------|-------|---------|
| **Encriptación datos en tránsito** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Backup automático** | ✅ | ✅ | ✅ | ✅ | ✅ Planned |
| **Recuperación datos** (restore) | ⚠️ Vago | ✅ Documentado | ✅ Documentado | ⚠️ Vago | ✅ Planned |
| **Auditoría SAT (5 años)** | ⚠️ Vago | ✅ Explícito | ✅ Explícito | ⚠️ Vago | ✅ Planned |
| **Cumplimiento GDPR** | ✅ | ✅ | ✅ | ✅ | ✅ Planned |
| **Certificación ISO 27001** | ❌ No | ⚠️ No mencionado | ⚠️ No mencionado | ❌ No | ❓ |
| **Logs de actividad/Auditoría** | ⚠️ Básico | ✅ Completo | ✅ Completo | ⚠️ Básico | ✅ Planned |

### CATEGORÍA 6: Automatización & Funcionalidad Avanzada

| Feature | Facturama | CONTPAQi | Aspel-COI | Siigo | Nuestro |
|---------|----------|----------|-----------|-------|---------|
| **Factura recurrente** | ✅ | ✅ | ✅ | ✅ | ❓ |
| **Presupuestos convertibles a factura** | ✅ | ✅ | ✅ | ✅ | ❓ |
| **Nota crédito automática** | ⚠️ Manual | ✅ Automática | ✅ Automática | ⚠️ Manual | ❓ |
| **Cancelación digital** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Factura desde POS** | ❌ No | ⚠️ Integración | ⚠️ Integración | ✅ Native | ❓ |
| **Sincronización en tiempo real** | ⚠️ Delays | ✅ Real-time | ✅ Real-time | ⚠️ Delays | ✅ Planned |
| **Gestión de crédito/saldo** | ❌ No | ❌ No | ❌ No | ❌ No | ✅ **ÚNICO** |
| **Línea de sobregiro** | ❌ No | ❌ No | ❌ No | ❌ No | ✅ **ÚNICO** |
| **Distribución automática (WhatsApp)** | ❌ No | ❌ No | ❌ No | ❌ No | ✅ **ÚNICO** |

---

## 🎯 FEATURES ADMINISTRATIVAS RECOMENDADAS PARA FACTURACHECK

### MUST-HAVE (Implementar en MVP)

✅ **Multi-user + Roles básicos** (Admin, Contador, Usuario)  
✅ **Gestión de permisos** (quién ve qué empresa, CFDIs, saldo)  
✅ **Configuración empresa** (RFC, razón social, logo)  
✅ **Reportes básicos** (por período, por cliente, por impuesto)  
✅ **Auditoría de cambios** (quién cambió qué, cuándo)  
✅ **Backup automático + restore** (Supabase)  
✅ **API + webhooks** (developers)  
✅ **Logs de actividad** (compliance SAT)  

### NICE-TO-HAVE (Futura versión)

⚠️ **Templates customizables** (diseño factura)  
⚠️ **Factura recurrente** (subscripciones)  
⚠️ **Presupuestos → facturas** (sales pipeline)  
⚠️ **Gráficas/dashboards avanzadas** (business intelligence)  
⚠️ **Reportes programados** (email automático)  
⚠️ **SSO/2FA** (enterprise security)  
⚠️ **White-label** (resellers)  

### NOT IN SCOPE (Depende de mercado)

❌ **Integración E-commerce** (Shopify, WooCommerce) — requiere investigación  
❌ **Integración CRM** (Salesforce) — requiere investigación  
❌ **POS nativo** — diferente producto  
❌ **Nómina** — diferente producto  

---

## 📊 MATRIZ COMPETITIVA — Features Administrativas

| Feature | Facturama | CONTPAQi | Aspel-COI | Siigo | **FacturaCheck MVP** |
|---------|----------|----------|-----------|-------|---------|
| **Gestión usuarios** | ✅ Básico | ✅ Avanzado | ✅ Avanzado | ✅ Básico | ✅ Intermedio |
| **Permisos granulares** | ⚠️ Limitado | ✅ Sí | ✅ Sí | ⚠️ Limitado | ✅ Sí |
| **Configuración empresa** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Reportes básicos** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Gráficas** | ❌ No | ✅ Sí | ✅ Sí | ✅ Sí | ✅ Planned |
| **API + webhooks** | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Auditoría completa** | ⚠️ | ✅ | ✅ | ⚠️ | ✅ |
| **Backup + restore** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Cumplimiento SAT 5Y** | ⚠️ | ✅ | ✅ | ⚠️ | ✅ |
| **Crédito/saldo** | ❌ | ❌ | ❌ | ❌ | ✅ **ÚNICO** |
| **WhatsApp auto** | ❌ | ❌ | ❌ | ❌ | ✅ **ÚNICO** |

---

## 🗣️ FEEDBACK DE CLIENTES (Por investigar)

> **ESPERANDO INVESTIGACIÓN DE AGENTE**
>
> Buscaremos:
> - Reviews en Capterra, G2
> - Quejas comunes por plataforma
> - Fortalezas elogiadas
> - NPS promedio
> - Gaps entre promesa + realidad

---

## 💡 RECOMENDACIONES INICIALES

### Basado en investigación anterior:

**TOP QUEJAS de usuarios de Facturama/CONTPAQi/Aspel:**
1. "Muy caro para PyMEs" → FacturaCheck $399/mes (soluciona)
2. "Sin integración banca/cobranza" → FacturaCheck + CobraCheck (soluciona)
3. "UI antigua/complicada" → FacturaCheck moderno SaaS (soluciona)
4. "Sin soporte técnico rápido" → FacturaCheck soporte prioritario
5. "Permisos muy restrictivos" → FacturaCheck permisos granulares

**TOP FORTALEZAS que mantener:**
1. ✅ RFC/auditoría fiscal rigurosa
2. ✅ Timbrado 100% confiable
3. ✅ Reportes para contador
4. ✅ Export CONTPAQi/SAT
5. ✅ Integración banca (cuando existe)

**NUESTRO DIFERENCIAL administrativo:**
1. ✅ Crédito/saldo integrado (único)
2. ✅ WhatsApp automático (único)
3. ✅ Permisos por empresa (mejor que Facturama)
4. ✅ Auditoría fiscal granular (igual que CONTPAQi/Aspel)
5. ✅ API + webhooks (mejor que Aspel-COI)

---

## 📝 PENDIENTE

- [ ] **Usuario comparte opciones administrativas** encontradas
- [ ] **Agente completa investigación** reviews + features
- [ ] **Actualizar documento** con feedback real de clientes
- [ ] **Crear matriz final** de qué incluir en FacturaCheck MVP vs V2

---

**Actualizar cuando:** usuario comparta opciones + agente termine investigación

