# CobraCheck — Gestión de Cobranza

## Estado: MVP Estructurado (Listo para Análisis)

### Arquitectura Implementada

**apps/cobra-mobile/** — Expo SDK 54
- ✅ Login screen
- ✅ 4 tab screens: clientes, ruta, pagos, historial
- ✅ Cliente detail + invoices list (cliente/[id].tsx)
- ✅ Invoice detail (factura/[id].tsx)
- ✅ Pago registration con método (cash, transfer, check, card)
- ✅ Hooks: useCobraClients, useCobraInvoices, useCobrador

**apps/cobra-web/** — Next.js 14
- ✅ Dashboard con 4 KPIs (cartera, vencida, esperado, pagado)
- ✅ Reportes: cartera por antigüedad (0-30, 30-60, 60-90, 90+ días) + tasa pago
- ✅ Campañas WhatsApp: crear, enviar, ver respuestas
- ✅ Cobradores: ranking con KPIs (cartera, cobrado hoy/mes, tasa cobranza)
- ✅ Clientes: búsqueda filtrada (todos, riesgo alto, bloqueados)
- ✅ Settings: placeholder para configuración

**Database (Supabase)** — 20260618200000_cobra_check_schema.sql
- ✅ 8 tablas: cobra_clients, cobra_invoices, cobra_payments, cobra_reminders, cobra_payment_attempts, cobra_campaigns, cobra_campaign_responses, cobra_risk_scores
- ✅ Views: cobra_aging_view, cobra_dashboard_summary, cobra_cobrador_stats
- ✅ RLS policies (auth_role based)
- ✅ Indexes en company_id, client_id, status

**Tipos TypeScript** — @gastocheck/shared
- ✅ CobraClient, CobraInvoice, CobraPayment, CobraReminder, CobraAgingRow
- ✅ Constants: COBRA_STATUS_META, COBRA_CLIENT_STATUS_META, COBRA_PAYMENT_METHODS

---

## Qué Falta (Próximo Ciclo)

### 1. Edge Functions (Pedir al otro chat)
```
- cobra-risk-scoring: cálculo diario de risk_score (0-100)
  Entrada: cobra_clients x cobrado_mes / cartera_asignada, vencidos %
  Salida: update cobra_risk_scores
  
- cobra-whatsapp-webhook: procesamiento de respuestas WhatsApp Business API
  Entrada: webhooks de respuestas WhatsApp
  Salida: update cobra_campaign_responses, cobra_reminders
  
- cobra-sat-validator: OCR + validación CFDI vs SAT
  Entrada: factura, UUID, XML
  Salida: validación + flags en cobra_invoices
```

### 2. Integración Real (Mobile)
- [ ] Cámara para fotos de comprobantes
- [ ] Geolocalización en tiempo real (ruta)
- [ ] Sincronización offline → online
- [ ] Push notifications para recordatorios

### 3. Reportes Avanzados (Web)
- [ ] Proyección 14 días (AI/ML forecast)
- [ ] Performance por cobrador (individual detail)
- [ ] Evolución de cartera (histórico gráfico)
- [ ] Exportar reportes (PDF/Excel)

### 4. Campañas WhatsApp (Web)
- [ ] Integración real con API
- [ ] Scheduling automático
- [ ] Templates de mensajes
- [ ] Analytics por campaña

### 5. Tests
- [ ] Unit tests (hooks, utils)
- [ ] E2E tests (login → dashboard)
- [ ] RLS policies validation

### 6. Deployment
- [ ] Build Expo APK/IPA
- [ ] Deploy cobra-web a Vercel
- [ ] Setup CI/CD

---

## Cómo Montar Localmente

### Setup

```bash
cd apps/cobra-mobile
pnpm install
EXPO_PUBLIC_SUPABASE_URL=... EXPO_PUBLIC_SUPABASE_ANON_KEY=... pnpm start
```

```bash
cd apps/cobra-web
pnpm install
npm run dev  # http://localhost:3001
```

### Demo Credentials
- Email: cobrador@test.com / admin@test.com
- Password: Test1234!

### API Status
- Supabase: ✅ migrations ejecutadas
- Auth: ✅ JWT via getSession()
- RLS: ✅ policies setup
- Tipos: ✅ importables desde @gastocheck/shared

---

## Decisiones de Diseño

**Mobile-First Approach**
- Cobrador en campo tiene cobrador-mobile app
- Admin ve todo en cobra-web dashboard
- Datos sync bidireccional

**Risk Scoring Algorithm** (0-100)
- 40% = recovery rate últimos 90d (cobrado / vencido)
- 30% = cartera vencida % (vencida > 60d)
- 20% = payment consistency (no. promesas vs. cobrado)
- 10% = SAT validation (facturas con problemas)

**WhatsApp Campaigns**
- Fire-and-forget: Edge Function webhook
- Async responses: collected in cobra_campaign_responses
- User can view agregado en Web dashboard

**RLS Pattern**
- Todos los datos: company_id + auth_role filtering
- Roles: owner, admin, supervisor, cobrador, operator
- company_members tabla mapea users → companies → roles

---

## Next Steps for Analysis

1. **Arma un GastoCheck test company** con datos reales de cobranza
2. **Sincroniza CobraCheck** a la misma company
3. **Test flows**:
   - Cobrador registra pago en mobile
   - Aparece en Web dashboard instantáneamente
   - Risk score se actualiza cada hora (batch Edge Function)
   - Campaña WhatsApp se envía a clientes automáticamente

4. **Mide KPIs**:
   - Tasa de penetración (% clientes con facturas)
   - Response rate (WhatsApp)
   - Time to collect (avg días de pago)
   - Cobrador efficiency (cobrado/day)

---

Generated: 2026-06-18
Status: Ready for UAT with sample data
