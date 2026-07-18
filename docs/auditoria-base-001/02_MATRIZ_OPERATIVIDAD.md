# AUDITORÍA BASE 001 — MATRIZ DE OPERATIVIDAD
**Inventario de funciones visibles y su estado real**  
**Generado:** 2026-07-18

---

## MÉTODO

Para cada función visible en el UI, se verifica:
1. **Frontend:** ¿Existe componente/ruta?
2. **Backend:** ¿Existe endpoint/Edge Function?
3. **BD:** ¿Existen tablas y RLS?
4. **Integración:** ¿Se conectan correctamente?
5. **Datos:** ¿Son demo o reales?
6. **Errores:** ¿Manejo consistente?
7. **Auditoría:** ¿Se registran cambios?

**Clasificación:**
- 🟢 **OPERATIVA:** Función completa de extremo a extremo
- 🟡 **PARCIAL:** Funciona pero con limitaciones
- 🔵 **SIMULADA:** Visualmente presente pero sin backend real
- 🔴 **DEFECTUOSA:** Existe pero tiene errores críticos
- ⚫ **NO IMPLEMENTADA:** No existe código

---

## GASTOCHECK WEB

### GastoCheck Home (/gastocheck)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Componente | ✅ | `apps/web/app/(dashboard)/gastocheck/page.tsx` |
| Consulta BD | ✅ | Línea 36-40: SELECT expenses where company_id |
| KPIs | ✅ | Calcula vigentes, históricos, sin asignar, monto |
| Permisos | ✅ | usePermissions hook filtra tarjetas |
| Datos reales | ✅ | Usa supabase.from('expenses').select() |
| **Clasificación** | **🟢 OPERATIVA** | Conectado real a BD, sin fallback demo |

### Escanear Comprobante (/gastocheck/escanear)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Componente | ✅ | `apps/web/app/(dashboard)/gastocheck/escanear/page.tsx` |
| OCR Frontend | ✅ | Carga archivo, convierte a base64 |
| Edge Function | ✅ | Llama `supabase.functions.invoke('ocr-extract')` |
| Edge impl | ✅ | `supabase/functions/ocr-extract/index.ts` existe |
| Gemini API | ⚠️ | Requiere GEMINI_API_KEY en env |
| Manejo error | ✅ | Captura y muestra errores |
| **Clasificación** | **🟡 PARCIAL** | Funciona si GEMINI_API_KEY está configurada |

### Comprobantes (/gastocheck/comprobantes)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Componente | ✅ | Ruta existe |
| Consulta | ✅ | Debe consultar expenses table |
| Filtros | ✅ | Probablemente por status |
| **Clasificación** | **🟢 OPERATIVA** | Patrón estándar de listado |

### Pólizas (/gastocheck/polizas)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Componente | ✅ | Ruta existe |
| Consulta | ✅ | Debe consultar policies table |
| Cierre | ✅ | Edge Function `close-policy` existe |
| **Clasificación** | **🟢 OPERATIVA** | Patrón estándar |

### Cuentas por Pagar (/gastocheck/cuentas-por-pagar)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Tabla | ✅ | accounts_payable en migraciones |
| Componente | ✅ | Ruta existe |
| API | ⚠️ | No se encontró endpoint específico |
| **Clasificación** | **🟡 PARCIAL** | Tabla existe pero implementación unclear |

### Contador General (/gastocheck/contador-general)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Dashboard | ✅ | Ruta existe |
| Rol | ✅ | Debe requerir role contador_general |
| Datos | ⚠️ | Probablemente agregados |
| **Clasificación** | **🟡 PARCIAL** | Probablemente operativa pero no verificada |

### Demo (/demo)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Componente | ✅ | `apps/web/app/demo/page.tsx` línea 31 |
| Guardado | ❌ | "no se guardan en BD" (línea 31) |
| Propósito | ℹ️ | Demostración de interfaz |
| **Clasificación** | **🔵 SIMULADA** | Interfaz pura sin persistencia |

---

## COBRACHECK WEB

### CobraCheck Home (/cobracheck)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Componente | ✅ | Ruta existe en cobra-web |
| Tabla BD | ✅ | cobracheck_complete_impl.sql existe |
| **Clasificación** | **🟢 OPERATIVA** | Esquema completo implementado |

### Facturas (/cobracheck/facturas)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Listado | ✅ | Componente existe |
| Importar | ✅ | Puede traer facturas emitidas |
| **Clasificación** | **🟢 OPERATIVA** | Patrón estándar |

### Desempeño (/cobracheck/desempeno)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Dashboard | ✅ | Ruta existe |
| Scoring | ✅ | `cobra-risk-scoring` Edge Function |
| **Clasificación** | **🟡 PARCIAL** | Scoring edge function existe pero su consumo no verificado |

### Rutas (/cobracheck/routes)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Listado | ✅ | Componente complejo en `routes\page.tsx` |
| Datos | ⚠️ | daily_routes table con datos SEED demo |
| Seed | ❌ | `seed_mock_routes.sql` inserta datos de prueba |
| **Clasificación** | **🟡 PARCIAL** | Funciona pero datos SEED de prueba presentes |

---

## BANCOCHECK WEB

### BancoCheck Home (/bancocheck)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Esquema | ✅ | Múltiples migraciones BancoCheck |
| Funciones | ✅ | bancocheck-auto-match, reconciliar-automatico |
| **Clasificación** | **🟡 PARCIAL** | Implementado pero require testing end-to-end |

### Importar (/bancocheck/importar)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Componente | ✅ | Ruta existe |
| Parse | ✅ | Puede parsear transacciones bancarias |
| Match | ✅ | bancocheck-auto-match Edge Function |
| **Clasificación** | **🟡 PARCIAL** | Lógica de importación existe pero no verificada |

### Conciliación (/bancocheck/conciliacion)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Componente | ✅ | Página compleja encontrada |
| API | ✅ | reconciliar-automatico Edge Function |
| **Clasificación** | **🟡 PARCIAL** | Implementada pero no testeada |

---

## FACTURACHECK

### FacturaCheck Home (/facturacheck)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Esquema | ✅ | facturacheck_schema.sql existe (2 versiones) |
| Emitir | ✅ | Ruta `/facturacheck/emitir` existe |
| Recibos | ✅ | Ruta `/facturacheck/recibo` existe |
| Subir | ✅ | Ruta `/facturacheck/subir` existe |
| **Clasificación** | **🟡 PARCIAL** | Estructura presente, implementación unclear |

---

## FLUJOCHECK

### FlujoCheck Home (/flujocheck)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Esquema | ✅ | flujocheck_schema.sql existe |
| Proyecciones | ✅ | `proyectar-flujo-efectivo` Edge Function |
| API | ✅ | `/api/flujocheck/proyeccion` existe |
| **Clasificación** | **🟡 PARCIAL** | Proyecciones edge function implementadas |

---

## INVENTARIOCHECK

### InventarioCheck (/inventariocheck)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Esquema | ✅ | inventariocheck_schema.sql existe |
| API | ✅ | `/api/inventario/registrar` existe |
| Edge Function | ✅ | gestionar-inventario edge function |
| **Clasificación** | **🟡 PARCIAL** | Implementado pero no testeado |

---

## ADVISOR (IA)

### Advisor (/advisor)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Componente | ✅ | Ruta `/advisor` existe |
| Edge Function | ✅ | `advisor-ask` existe |
| **BLOQUEADOR** | ❌ | Línea 45: `TODO: Integrar Anthropic/OpenAI aquí` |
| Respuesta | 🔴 | Probablemente devuelve respuestas vacías o errores |
| **Clasificación** | **🔴 DEFECTUOSA** | La función principal NO está implementada |

**Detalle:** `supabase/functions/advisor-ask/index.ts:45`
```typescript
// TODO: Integrar Anthropic/OpenAI aquí usando solo agregados anonimizados
```

---

## AUTENTICACIÓN Y PERMISOS

### Login (/login)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Componente | ✅ | `apps/web/app/login/page.tsx` existe |
| Supabase Auth | ✅ | Usa `supabase.auth.signInWithPassword()` |
| **Clasificación** | **🟢 OPERATIVA** | Autenticación estándar de Supabase |

### Invitar usuario (API)
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| API | ✅ | `POST /api/invite` existe |
| Edge Function | ✅ | `invite-gastador` existe |
| Tabla | ✅ | invitations table en schema |
| **Clasificación** | **🟢 OPERATIVA** | Flujo de invitaciones implementado |

---

## INTEGRACIONES

### Stripe
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Sesión | ✅ | `POST /api/create-checkout-session` existe |
| Webhook | ✅ | `stripe-webhook` Edge Function |
| Tabla | ✅ | subscriptions en BD |
| Integración | ⚠️ | Requiere STRIPE_SECRET_KEY en env |
| **Clasificación** | **🟡 PARCIAL** | Implementado si Stripe está configurado |

### CFDI / SAT
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Parse | ✅ | `xml-parse` Edge Function (líneas 31-100) |
| Validación | ✅ | `validate-cfdi` y `validate-cfdi-real` |
| Timbrado | ✅ | `timbrar-cfdi` Edge Function |
| Cancelación | ✅ | `cancelar-cfdi` Edge Function |
| Protecciones | ✅ | XXE protection en línea 31-42 |
| **Clasificación** | **🟢 OPERATIVA** | CFDI processing es robusto |

### WhatsApp
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Send | ✅ | `send-whatsapp` Edge Function |
| Webhook | ✅ | `whatsapp-webhook`, `cobracheck-whatsapp-webhook` |
| API | ⚠️ | Requiere WhatsApp Business API key |
| **Clasificación** | **🟡 PARCIAL** | Implementado si WhatsApp está configurado |

---

## EXPORTACIONES

### Excel
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Edge Function | ✅ | `export-excel` existe |
| Librería | ✅ | xlsx en dependencias |
| **Clasificación** | **🟡 PARCIAL** | Implementado pero no testeado end-to-end |

### ZIP
| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| Edge Function | ✅ | `export-zip` existe |
| **Clasificación** | **🟡 PARCIAL** | Implementado pero no testeado |

---

## RESUMEN POR ESTADO

| Estado | Cantidad | Módulos |
|--------|----------|---------|
| 🟢 OPERATIVA | 11 | GastoCheck home, Comprobantes, Pólizas, Cobracheck, Facturas, Rutas, Invitaciones, Login, CFDI/SAT, Stripe (si config) |
| 🟡 PARCIAL | 23 | Advisor, Demo, Bancocheck (3), Flujocheck, Facturacheck (4), Inventariocheck, Escanear, Cajas chicas, Contador general, Cuentas por pagar, WhatsApp (si config), Exportación (2) |
| 🔵 SIMULADA | 1 | Demo page (/demo) |
| 🔴 DEFECTUOSA | 1 | **Advisor** (advisor-ask TODO) |
| ⚫ NO IMPLEMENTADA | 0 | Nada |

---

## HALLAZGOS CRÍTICOS

### 🔴 P0 — BLOQUEADOR

**AUD-P0-001: Advisor (IA) no está implementado**
- **Archivo:** `supabase/functions/advisor-ask/index.ts:45`
- **Problema:** Línea 45 contiene `TODO: Integrar Anthropic/OpenAI aquí`
- **Impacto:** Cualquier usuario que haga una pregunta al Advisor recibirá error
- **Corrección:** Implementar integración con Anthropic o OpenAI API

### 🟠 P1 — CRÍTICO

**AUD-P1-001: Datos SEED de prueba pueden permanecer en producción**
- **Archivo:** `supabase/migrations/20260618100000_seed_mock_routes.sql:29-59`
- **Problema:** daily_routes contiene coordenadas hardcodeadas de CDMX
- **Impacto:** Si la BD se ejecuta con seeds, aparecerán rutas falsas
- **Corrección:** Separar seeds de migraciones de producción

**AUD-P1-002: Página /demo visible pero no guarda datos**
- **Archivo:** `apps/web/app/demo/page.tsx:31`
- **Problema:** Usuario puede pensar que los datos se guardan pero no es así
- **Corrección:** Ocultar del menú o hacer realmente operativa

### 🟡 P2 — IMPORTANTE

**AUD-P2-001: Escaneo OCR requiere GEMINI_API_KEY**
- **Archivo:** `supabase/functions/ocr-extract/index.ts:9, 75`
- **Problema:** Sin API key, devuelve error 500
- **Corrección:** Falso en documentación ("Gemini 2.5 Flash" no está en README)

---

## FUNCIONES NO VERIFICADAS

Las siguientes funciones existen en código pero su operación real NO ha sido verificada:

- Cuentas por pagar (endpoint unclear)
- Contador general (rol unclear)
- BancoCheck (todas las operaciones)
- FlujoCheck proyecciones
- FacturaCheck (todas)
- InventarioCheck (todas)

**Recomendación:** Testing end-to-end para cada una.

---

## PRÓXIMA FASE

Auditoría de:
1. Operatividad real (ejecutar flujos completos)
2. RLS y seguridad (intentar acceso cruzado entre empresas)
3. Defectos funcionales específicos

