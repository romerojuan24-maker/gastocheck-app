# AUDITORÍA BASE 001 — CRITERIOS DE LANZAMIENTO
**Checklist verificable para salida a producción**

---

## ANTES DE LANZAR

### ✅ FASE CRÍTICA — BLOQUEADORES (P0/P1)

- [ ] **AUD-001:** Advisor IA implementado y funcional
  - [ ] Edge Function `advisor-ask` integra Anthropic/OpenAI
  - [ ] Responde consultas sin error
  - [ ] Testing: pregunta → respuesta válida
  
- [ ] **AUD-002:** Página /demo oculta o funcional
  - [ ] /demo no visible en menú principal
  - [ ] URL directa redirige o retorna 404
  
- [ ] **AUD-003:** Datos SEED de rutas eliminados
  - [ ] Migración `20260618100000` limpiada
  - [ ] Archivo separado `seeds/sample-routes.sql` para dev
  - [ ] BD producción sin rutas falsas
  
- [ ] **AUD-004:** Rol 'admin' en enum
  - [ ] Migración nueva agrega 'admin' a member_role enum
  - [ ] Asignación de 'admin' no produce error
  
- [ ] **AUD-005:** Datos demo de categorías limpiados
  - [ ] expense_categories solo contiene reales
  - [ ] Semillas en archivo separado
  
- [ ] **AUD-006:** Migraciones consolidadas
  - [ ] Duplicados removidos (expense_budgets, daily_routes, viaticos)
  - [ ] Migration script idempotente

### ✅ FASE IMPORTANTE — P2

- [ ] **AUD-007:** Documentación OCR
  - [ ] README documenta requisito GEMINI_API_KEY
  - [ ] Error handling si key ausente
  
- [ ] **AUD-008:** BancoCheck auto-match
  - [ ] Revisión visual antes de confirmar matching
  - [ ] Usuarios pueden rechazar matches
  
- [ ] **AUD-009:** FlujoCheck documentado
  - [ ] Supuestos de cálculo documentados
  - [ ] Rango de confianza mostrado
  
- [ ] **AUD-010/011:** Exportación testeada
  - [ ] Excel exports generan archivo válido
  - [ ] ZIP exports contienen archivos correctos
  - [ ] Manejo de errores funcionando

### ✅ FASE OPERACIONAL

- [ ] **Seguridad:**
  - [ ] GEMINI_API_KEY en env variables (no en código)
  - [ ] STRIPE_SECRET_KEY en env variables
  - [ ] ANTHROPIC_API_KEY en env variables
  - [ ] Ninguna API key en repositorio público
  
- [ ] **Auditoría:**
  - [ ] expense_audit registra todas las acciones
  - [ ] Trigger recompute_policy_closing funcional
  - [ ] Cada transacción tiene actorId
  
- [ ] **Permisos:**
  - [ ] RLS habilitado en todas las tablas
  - [ ] Test: spender no ve otros gastos
  - [ ] Test: disabled user no puede acceder
  - [ ] Test: company_id aislado entre empresas
  
- [ ] **Base de datos:**
  - [ ] Todas las migraciones ejecutan sin error
  - [ ] Schema matches init + all subsequent migrations
  - [ ] Índices creados correctamente
  - [ ] No hay orphaned/unused tables

### ✅ OPERATIVO

- [ ] **Datos iniciales:**
  - [ ] Plan de empresa configurado (basico/equipo/empresa/corporativo)
  - [ ] Al menos 1 usuario por plan creado para testing
  - [ ] Categorías por defecto para cada plan
  
- [ ] **Flujos críticos operativos:**
  - [ ] Crear empresa → usuario owner asignado
  - [ ] Invitar usuario → token genera correctamente
  - [ ] Crear anticipo → saldo recalculado
  - [ ] Crear gasto → aparece en póliza
  - [ ] Autorizar gasto → audit registra
  - [ ] Importar XML → CFDI validado
  
- [ ] **Integraciones verificadas:**
  - [ ] Stripe webhook funciona
  - [ ] WhatsApp webhook configurado (si aplica)
  - [ ] Supabase Storage RLS funcional
  - [ ] Supabase Auth SSO (si aplica)

### ✅ TESTING

- [ ] **Funcional:**
  - [ ] GastoCheck: flujo completo anticipo → reembolso
  - [ ] CobraCheck: flujo completo factura → cobro
  - [ ] BancoCheck: importación y reconciliación
  - [ ] FlujoCheck: proyección genera datos
  
- [ ] **Seguridad:**
  - [ ] Test: intentar acceso a company_id ajena → 0 rows
  - [ ] Test: disabled user + token antiguo → error
  - [ ] Test: spender intentar autorizar → error 403
  - [ ] Test: XXE attack rechazado
  
- [ ] **Error handling:**
  - [ ] GEMINI_API_KEY faltante → error 500 con mensaje claro
  - [ ] Migraciones rerun idempotentes
  - [ ] Edge Functions devuelven JSON válido
  - [ ] Errores no exponen stack traces

### ✅ OPERACIÓN

- [ ] **Monitoring:**
  - [ ] Logs habilitados en Edge Functions
  - [ ] Alertas configuradas para errores
  - [ ] Dashboard de uso disponible
  
- [ ] **Backups:**
  - [ ] Backup strategy definida
  - [ ] Restore tested (no solo backup programado)
  
- [ ] **Documentación:**
  - [ ] README actualizado
  - [ ] API documentation
  - [ ] Troubleshooting guide
  - [ ] Operación manual de datos

---

## NO DESPLEGAR SI

### 🔴 Bloqueadores

```
- [ ] Advisor no funciona (AUD-001)
- [ ] Página demo no oculta (AUD-002)
- [ ] Datos SEED en producción (AUD-003)
- [ ] Rol admin no en enum (AUD-004)
- [ ] API keys en repositorio público
- [ ] Migraciones fallan en rerun
- [ ] RLS no habilitado en alguna tabla
- [ ] Multi-tenant fuga detectada (test fallido)
```

### 🟠 Críticos

```
- [ ] Flujos críticos no testeados
- [ ] Datos seed visibles para usuarios
- [ ] Integraciones Stripe/WhatsApp no funcionales (si prometidas)
- [ ] Advisor/BancoCheck/FlujoCheck sin testing mínimo
```

---

## CHECKLIST PRE-DEPLOY

**Responsable:** DevOps / Tech Lead

```
- [ ] Verificar 10 criterios "ANTES DE LANZAR" — TODOS deben ser ✅
- [ ] Ejecutar test suite de seguridad
- [ ] Ejecutar flujos E2E para cada módulo
- [ ] Revisar logs de últimas 24 horas
- [ ] Confirmar backups recientes
- [ ] Notificar equipo de soporte
- [ ] Tener rollback plan listo
```

**Tiempo estimado:** 2-4 horas

---

## ROLLBACK PLAN

**Si algo falla:**

1. **DB:** Restaurar último backup conocido bueno (max 24h)
2. **App:** Revert a último tag conocido bueno en git
3. **Notificación:** Comunicar estado en 15min
4. **RCA:** Análisis de raíz dentro de 24h

---

## DEFINICIÓN DE "LISTO"

✅ **Listo si:**
- Todos los P0 resueltos
- Todos los P1 resueltos
- P2 documentados pero puede ser post-launch
- Multi-tenant isolation verificado
- Flujos críticos funcionan

❌ **NO listo si:**
- Advisor IA no funciona
- Datos demo en BD
- API keys expuestas
- Migraciones fallan
- RLS not enabled

