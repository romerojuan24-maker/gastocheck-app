# GastoCheck

**Tus gastos claros. Tus saldos bajo control.** · _Toma foto. Autoriza. Controla._

SaaS para controlar anticipos, comprobaciones, gastos operativos, saldos por persona y pólizas de gastos. Pensado para empresas con personal que gasta fuera de la oficina (choferes, residentes, técnicos, compradores).

> No es un ERP contable. Resuelve una sola cosa muy bien: _"Le entregué dinero a una persona — ¿cuánto gastó, qué comprobó, qué falta autorizar, qué saldo queda y cómo le entrego un reporte ordenado al contador?"_

## Estructura del monorepo

```
gastocheck-app/
├── docs/DISENO.md            # Diseño técnico completo (arquitectura, BD, roles, flujos, API, roadmap)
├── supabase/
│   ├── migrations/0001_init.sql   # Esquema multi-tenant + RLS + triggers de saldo
│   └── functions/                 # Edge Functions (xml-parse, authorize-expense, ...)
├── packages/shared/          # Lógica compartida: tipos, saldos, máquina de estados, CFDI
└── apps/
    ├── web/                  # Dashboard Next.js 15 (dueño/supervisor/oficina)
    └── mobile/               # App Expo / React Native (usuario que gasta)
```

## Stack
Expo (móvil) · Next.js 15 (web) · Supabase (Postgres + Auth + Storage + Edge Functions) · TypeScript en todo.

## Puesta en marcha

```bash
# 1. Dependencias (workspaces)
npm install

# 2. Variables de entorno
cp .env.example .env        # rellena las claves de Supabase

# 3. Base de datos (con Supabase CLI)
supabase start              # local, o usa un proyecto en la nube
supabase db push            # aplica migrations/0001_init.sql

# 4. Web dashboard
npm run web                 # http://localhost:3000

# 5. App móvil
npm run mobile              # Expo
```

El dashboard web arranca con **datos demo** aunque no tengas Supabase configurado, para verlo de inmediato.

## Núcleo de valor (flujo)
1. Empresa entrega dinero → `advances`
2. Empleado sube comprobante (foto/XML/PDF) → `expense`
3. IA/XML extrae datos → sugiere categoría y centro de costo
4. Usuario confirma → `pending_auth`
5. Supervisor autoriza ✅ → descuenta del saldo
6. Oficina liga factura después · Dueño cierra póliza cuando quiera
7. Excel + ZIP + reporte por WhatsApp para el contador

Ver detalle completo en [`docs/DISENO.md`](docs/DISENO.md).

## Estado
MVP scaffold — Fase 0/1. Pendiente: OCR real, exportación Excel/ZIP, WhatsApp, planes/Stripe (ver roadmap en el diseño).
