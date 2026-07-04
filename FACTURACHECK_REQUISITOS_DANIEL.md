# 📋 FacturaCheck — Requisitos para Daniel

**Responsable**: Daniel (codificación MVP)  
**Timeline**: 6 semanas  
**Inicio**: Cuando cumpla todos estos requisitos ✓

---

## ✅ REQUISITOS PREVIOS (Daniel debe confirmar)

### 1. DOCUMENTACIÓN LEÍDA (2 horas)

- [ ] Leer `FACTURACHECK_PUNTO_DE_PARTIDA.md` (10 min)
  - Entender visión en 60 segundos
  - Conocer 4 diferenciales (WhatsApp, CobraCheck, crédito, precio)

- [ ] Leer `FACTURACHECK_ARQUITECTURA_COMPLETA.md` (30 min)
  - Entender 7 tablas core
  - Entender 3 flujos principales
  - Entender integraciones (Facturama, CobraCheck, GastoCheck, BancoCheck)

- [ ] Leer `FACTURACHECK_VOICE_OF_CUSTOMER.md` (15 min)
  - Entender pain points que resolvemos
  - Entender fortalezas que mantenemos

- [ ] Leer `FACTURACHECK_APROBADO_INICIO_DESARROLLO.md` (20 min)
  - Entender checklist semana 1
  - Entender roadmap 6 semanas

### 2. STACK TÉCNICO CONFIRMADO (Daniel)

- [ ] ¿Disponible full-time semanas 1-6?
- [ ] ¿Familiar con Supabase (PostgreSQL + RLS + Edge Functions)?
- [ ] ¿Familiar con React Native (Expo)?
- [ ] ¿Familiar con Next.js (web)?
- [ ] ¿Puede trabajar con Git/GitHub sin issues?
- [ ] ¿Tiene acceso a repositorio gastocheck-app?

### 3. CREDENCIALES & ACCESO (Juan debe proporcionar)

**Daniel necesita antes de Semana 1**:

```
SUPABASE:
  - URL Supabase proyecto
  - Anon key
  - Service role key
  - Acceso dashboard

GITHUB:
  - Acceso repo gastocheck-app
  - Permisos push a main

FACTURAMA (cuando legal lo apruebe):
  - API key sandbox
  - API key production
  - Webhook credentials
  - Documentación API

TESTING:
  - Datos de prueba (RFC ficticio, empresa test)
  - RFC real de prueba (opcional, depende SAT)
```

### 4. AMBIENTE SETUP (Daniel)

**Antes de codificar, Daniel debe tener**:

```bash
# Verificar Node.js
node --version  # v18+

# Clonar repo
git clone https://github.com/romerojuan24-maker/gastocheck-app.git
cd gastocheck-app

# Instalar dependencias
npm install  # o pnpm install

# Verificar Supabase CLI
supabase --version

# Verificar Expo
expo --version  # v50+

# Verificar estructura
ls apps/mobile/app/  # debe existir

# Crear .env.local con credenciales
# (Juan proporciona valores)
```

### 5. ARQUITECTURA CONFIRMADA (Daniel)

**Antes de crear primera tabla, Daniel confirma**:

- [ ] ¿Entendemos que usaremos Facturama como PAC (no SAT directo)?
- [ ] ¿Entendemos 7 tablas core y relaciones (1:1, 1:N)?
- [ ] ¿Entendemos RLS policies (company_id based)?
- [ ] ¿Entendemos soft delete (is_active = false)?
- [ ] ¿Entendemos triggers y Edge Functions?
- [ ] ¿Entendemos integración CobraCheck (listen cobro → auto-CFDI)?

---

## 🎯 SEMANA 1 — TAREAS ESPECÍFICAS (Daniel)

**LUNES - Miércoles: Database Schema**

```sql
-- Crear migrations/ para 7 tablas:

1. cfdi_documents (CFDI emitidas)
   - Campos: id, company_id, uuid_cfdi, folio, serie, 
     rfc_emisor, rfc_receptor, subtotal, iva, total,
     status, xml_storage_path, source_module, source_id,
     created_by, updated_at, is_active
   - Índices: folio único por empresa, status, rfc
   - RLS: user puede ver solo su company_id

2. cfdi_credits (Saldo + crédito)
   - Campos: id, company_id, saldo_disponible, 
     saldo_congelado, limite_sobregiro, plan_type,
     timbres_mensuales, timbres_usados_mes
   - RLS: user solo ve su empresa

3. cfdi_distributions (Email/WhatsApp/descarga)
   - Campos: id, company_id, cfdi_id, 
     enviado_email, enviado_whatsapp, descargado,
     email_receptor, whatsapp_numero, creado_por

4. cfdi_cobracheck_links (1:1 cobro ↔ CFDI)
   - Campos: id, company_id, cobra_movement_id (unique),
     cfdi_id (unique), status_sync, ultima_sync

5. accounting_vouchers (Pólizas contables auto)
   - Campos: id, company_id, voucher_number (unique),
     voucher_type, total_debit, total_credit,
     entries (JSONB), status, created_by

6. audit_log (Auditoría SAT 5 años)
   - Campos: id, company_id, table_name, record_id,
     action (INSERT|UPDATE|DELETE), changed_fields (JSONB),
     changed_by, changed_at, user_ip, user_agent

7. cfdi_credit_transactions (Historial consumo)
   - Campos: id, company_id, credit_id, tipo
     (recarga|consumo|sobregiro), monto, 
     saldo_anterior, saldo_posterior, cfdi_id

✓ Verificar: Sin errores de foreign keys
✓ Verificar: RLS policies aplicadas
✓ Verificar: Índices creados
✓ Verificar: Soft delete habilitado
```

**MIÉRCOLES - VIERNES: Facturama Integration**

```typescript
// supabase/functions/stamp-cfdi/index.ts

export async function stampCfdi(xml: string, companyId: string) {
  // 1. Conectar a Facturama API (sandbox)
  // 2. Validar XML antes de enviar
  // 3. POST XML a Facturama
  // 4. Recibir UUID + XML timbrado
  // 5. Guardar XML en bucket
  // 6. Actualizar cfdi_documents (status='timbrado')
  // 7. Retornar resultado

  ✓ Tests: Puede timbrar sin errores
  ✓ Tests: Retorna UUID válido
  ✓ Tests: XML guardado en bucket
}
```

**VIERNES: UI Base Components**

```typescript
// apps/mobile/app/facturacheck/
//   ├── index.tsx (main screen)
//   ├── components/
//   │   ├── KpiCard.tsx (reutilizable)
//   │   ├── CfdiForm.tsx (NEW)
//   │   ├── CreditModal.tsx (NEW)
//   │   ├── DistributionModal.tsx (NEW)
//   │   ├── TransactionList.tsx (NEW)
//   ├── hooks/
//   │   ├── useCfdi.ts (NEW)
//   │   ├── useCredit.ts (NEW)
//   ├── types.ts (NEW)

✓ Compilar sin errores TypeScript
✓ Navegar entre pantallas
✓ Formularios responden a input
```

---

## 📋 CHECKLIST PRE-CODIFICACIÓN (Daniel marca)

**ANTES DE ESCRIBIR 1 LÍNEA DE CÓDIGO**:

- [ ] Leí PUNTO_DE_PARTIDA.md
- [ ] Leí ARQUITECTURA_COMPLETA.md
- [ ] Leí VOICE_OF_CUSTOMER.md
- [ ] Leí APROBADO_INICIO_DESARROLLO.md
- [ ] Entiendo 7 tablas y relaciones
- [ ] Entiendo 3 flujos principales
- [ ] Entiendo que NO es solo CFDI, es CFDI + crédito + CobraCheck
- [ ] Tengo acceso a Supabase
- [ ] Tengo acceso a GitHub repo
- [ ] Tengo ambiente setup (Node, npm, supabase CLI)
- [ ] Entiendo RLS y soft delete
- [ ] Tengo credenciales Facturama (cuando Juan provea)

**SI NO TODOS ESTÁN MARCADOS**: Daniel no comienza.

---

## 🚫 QUÉ NO HACER (Daniel evita)

❌ NO iniciar sin contrato Facturama (Juan consigue)  
❌ NO cambiar arquitectura sin consultarme  
❌ NO usar SAT API directo (usamos Facturama PAC)  
❌ NO borrar registros (soft delete siempre)  
❌ NO perder diferenciales (WhatsApp, CobraCheck, crédito)  
❌ NO hacer en paralelo con otros módulos si conflictúa con Git

---

## 📞 COMUNICACIÓN (Daniel ↔ Juan)

**Daily Standup**:
- Qué hizo ayer
- Qué hace hoy
- Bloqueantes

**Weekly Sync (Viernes)**:
- Status contra roadmap
- Cualquier pivote

**Escalation**:
- Bloqueante SAT/legal → contactar Juan
- Bloqueante técnico → contactar Juan
- Bloqueante Facturama → contactar Juan

---

## 🏁 ÉXITO SEMANA 1 = CUANDO

✅ 7 tablas creadas sin errores  
✅ RLS policies aplicadas  
✅ Facturama sandbox funcionando  
✅ Puedo timbrar CFDI de prueba  
✅ UI base compila sin TypeScript errors  
✅ 0 bloqueantes pendientes  

Si TODO está ✓, Daniel continúa Semana 2.

---

## 📊 RESUMEN: QUÉ REQUIERO DE DANIEL

| Categoría | Requisito | Status |
|-----------|-----------|--------|
| **Documentación** | Leer 4 docs (2h) | ⏳ Pendiente |
| **Stack** | Confirmar disponibilidad + competencias | ⏳ Pendiente |
| **Acceso** | Supabase + GitHub | ⏳ Juan proporciona |
| **Credenciales** | Facturama API | ⏳ Juan consigue |
| **Ambiente** | Setup local (Node, npm, CLI) | ⏳ Daniel verifica |
| **Confirmación** | Marcar 12 checklist items | ⏳ Daniel confirma |
| **Semana 1** | 7 tablas + Facturama + UI base | ⏳ Daniel entrega |

---

## 📝 PASOS INMEDIATOS

1. **Juan**: Proporcionar a Daniel
   - [ ] Credenciales Supabase
   - [ ] Acceso GitHub repo
   - [ ] Link a 4 documentos

2. **Daniel**: Completar antes de Semana 1
   - [ ] Leer 4 docs
   - [ ] Setup ambiente
   - [ ] Marcar 12 checklist items
   - [ ] Confirmar a Juan "LISTO"

3. **Juan**: Cuando Daniel confirme
   - [ ] Contratar Facturama API
   - [ ] Proporcionar credenciales Facturama
   - [ ] Dar "GO" para que Daniel comience

4. **Daniel**: Semana 1 (6 días)
   - [ ] Lunes-Miércoles: 7 tablas SQL
   - [ ] Miércoles-Viernes: Facturama + UI
   - [ ] Viernes: Entregar Semana 1 completa

---

**Documento preparado**: 2026-07-04  
**Estado**: Requisitos listos para Daniel  
**Próximo paso**: Juan proporciona credenciales + Daniel confirma preparación

