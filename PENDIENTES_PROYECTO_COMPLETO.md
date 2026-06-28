# 📋 CHECK SUITE — PENDIENTES TOTALES DEL PROYECTO
**Fecha:** 28 de Junio 2026  
**Estado General:** 85% COMPLETO  
**Próximo hito:** Publicar en Google Play (29 de Junio)

---

## 🎯 HITO 1: GOOGLE PLAY (MAÑANA - 29 JUN)
**Responsable:** Daniel

- [ ] Descargar Service Account JSON de Google Play
- [ ] Ejecutar `eas build --platform android --profile production`
- [ ] Configurar suscripción: 30 días gratis → $299 MXN/mes
- [ ] Verificar descripción y screenshots en Play Console
- [ ] Enviar a revisión de Google
- [ ] Esperar aprobación (24-48h)

**Instrucciones:** Ver archivo `INSTRUCCIONES_DANIEL_GOOGLE_PLAY.md`

---

## 🟡 BLOQUEANTES TÉCNICOS (Resolver antes de siguiente release)

### 1. Versión Mobile Desincronizada (CRÍTICO)
**Problema:** La app en teléfono muestra OTA 71, pero publicamos 0.1.72
**Causa:** EAS Updates vs Build desincronizados (problema de runtime/fingerprint)
**Solución:**
- [ ] Una vez publique en Google Play, los usuarios descargarán versión fresca (0.1.72)
- [ ] Para testing local: reinstalar APK completamente (no vale "update")
- [ ] **Futuro:** Estandarizar versioning (no más 0.1.x, usar semver: 1.0.0, 1.0.1, etc.)

### 2. SQL Migration No Ejecutada (IMPORTANTE)
**Pendiente:** Ejecutar en Supabase Studio
```sql
-- Archivo: supabase/migrations/20260627_perfilamiento_gastocheck_v1.sql
-- Incluye: viaticos table, contador_general_assignments, RLS policies, vistas
```

**Quién:** Puede hacerlo Juan o Daniel
**Cuándo:** ANTES de que usuarios accedan a viáticos
**Cómo:**
1. Abre: https://app.supabase.com → gastocheck-app
2. SQL Editor → New query
3. Copia TODO de `supabase/migrations/20260627_perfilamiento_gastocheck_v1.sql`
4. Ejecuta (▶️)

**Status después:** ✅ Viáticos disponibles

---

## 🔴 BUGS/ISSUES REPORTADOS (No urgentes, pero rastrear)

### Mobile
- ✅ Viáticos module: IMPLEMENTADO (OTA 72)
- ⚠️ Multi-comprador tracking: IMPLEMENTADO (created_by field)
- ⚠️ Contador General assignment: IMPLEMENTADO (admin panel)

### Web
- ✅ Contador General Panel: FUNCIONANDO
- ✅ Admin Assignment: FUNCIONANDO
- ⚠️ **Routing:** Verificar que `/gastocheck/contador-general` esté accesible

### Database
- ⚠️ Migration no ejecutada (ver arriba)
- ✅ Views creados (expenses_by_buyer, viaticos_by_person, executive_summary_daily)
- ✅ RLS policies actualizados

---

## 📊 MÉTRICAS POST-PUBLICACIÓN (Monitorear)

Una vez publique en Google Play:

1. **Descargas por día**
   - Dónde: Google Play Console → Analytics
   - Meta: ≥5 descargas en primera semana

2. **Churn/Retention**
   - Quién abre la app después del primer día
   - Meta: ≥30% retention en día 1

3. **Crash Rate**
   - Android Vitals → Crashes
   - Meta: <1% crash rate

4. **Trial Conversión**
   - Quién convierte del trial de 30 días a paid
   - Meta: ≥10% conversion

5. **User Feedback**
   - Google Play reviews
   - In-app feedback (si implementas)
   - Emails a soporte

---

## 🚀 ROADMAP SIGUIENTE (Julio-Agosto)

### Semana 1-2 (Post-publicación)
- [ ] Monitorear primeras descargas
- [ ] Recolectar feedback de usuarios
- [ ] Bugs fixes si hay crashes
- [ ] Ejecutar SQL migration si no se hizo

### Semana 3-4
- [ ] CobraCheck v1.0 (módulo de cobranza)
- [ ] Integración CHECK SUITE web (backoffice)
- [ ] Reportes mejorados

### Agosto (Fase 2)
- [ ] CajaCheck (módulo caja chica)
- [ ] InventarioCheck (módulo inventario)
- [ ] Convergencia total de módulos

---

## 💰 MONETIZACIÓN (Ya implementado)

**Modelo:**
- Freemium: 30 días gratis
- Pago: $299 MXN/mes (o ajustar por región)
- Incluye: GastoCheck + viáticos + reportes

**Stripe (CONFIG PENDIENTE):**
- [ ] Productos creados en Stripe: ✅ HECHO
- [ ] Webhook configurado: ✅ HECHO
- [ ] STRIPE_SECRET_KEY: ⚠️ FALTA (Juan tiene)
- [ ] Price IDs en env vars: ⚠️ FALTA

**Next step:** Juan pasa STRIPE_SECRET_KEY → Daniel configura

---

## 📱 WEB APP STATUS

**URL:** http://localhost:3000/gastocheck/contador-general (local)

**Módulos operativos:**
- ✅ Contador General Panel (4 KPIs)
- ✅ Admin Assignment (asignar contador)
- ✅ Viáticos view (tabla por persona)
- ✅ Gastos por comprador (tabla)

**Pendiente deploy:**
- [ ] No hay deploy a staging aún
- [ ] No hay deploy a producción
- [ ] Next: Juan + Daniel definen hosting (Vercel, AWS, etc.)

---

## 🔐 SEGURIDAD & COMPLIANCE

**Implementado:**
- ✅ RLS policies en Supabase
- ✅ Auth roles (comprador, contador_general, encargado_cxp, admin)
- ✅ Data isolation por company_id

**Pendiente:**
- [ ] GDPR compliance (si mercado internacional)
- [ ] Terms of Service (para Google Play)
- [ ] Privacy Policy (para Google Play)
- [ ] Encryption at rest (Supabase ya lo hace)

---

## 📞 CONTACTOS & RESPONSABILIDADES

| Tarea | Responsable | Deadline |
|-------|-------------|----------|
| Google Play publish | Daniel | Mañana 29 Jun |
| SQL migration | Juan/Daniel | ASAP |
| Stripe config | Juan | ASAP |
| Monitoreo apps | Juan | Ongoing |
| Bug fixes | Daniel | As-needed |
| New features | Juan | After v1.0 |

---

## ✅ CHECKLIST ANTES DE "READY FOR SALE"

- [x] Código GastoCheck v0.1.72 completo
- [x] Mobile app compilada
- [x] Web panel funcionando
- [ ] **Google Play publicada** (mañana)
- [ ] SQL migration ejecutada
- [ ] Stripe configurado
- [ ] TOS + Privacy Policy listos
- [ ] Primeras métricas recolectadas

---

## 🎉 ESTADO GENERAL

```
Código:       ✅ 100% LISTO
Testing:      ✅ LOCAL FUNCIONANDO
Mobile:       ✅ COMPILADA (0.1.72)
Web:          ✅ FUNCIONANDO
DB:           🟡 MIGRATION PENDIENTE
Google Play:  🟡 PUBLICAR MAÑANA
Stripe:       🟡 CONFIG PENDIENTE
Production:   ⚠️ NO DEPLOYADO AÚN
```

---

## 📝 NOTAS IMPORTANTES

1. **Versioning:** Después de publicar, usar semver (1.0.0, 1.0.1, etc.) no 0.1.x
2. **EAS Updates vs Builds:** Entender la diferencia (runtime fingerprint)
3. **Monitoreo:** Revisar Google Play Analytics diariamente primer mes
4. **User Feedback:** Critical para bugs y features
5. **Escalabilidad:** Supabase scale automático, verificar límites

---

**DOCUMENTO ACTUALIZADO:** 28 Junio 2026, 5:30 PM  
**RESPONSABLE:** Juan (architecture) + Daniel (implementation)
