# 📱 UX SIMPLE PARA LA CALLE

**Principio:** Si la persona NO es tech-savvy, debe funcionar en 2 clics

---

## 🎯 USUÁRIOS EN LA CALLE (Realidad)

### TIPO 1: Capturista de gastos (el que anda comprando)
```
- Abre app
- Ve GRAN BOTÓN "Capturar gasto"
- Toma foto
- LISTO

Eso es TODO lo que necesita ver.
```

### TIPO 2: Jefe de cobranza (el que supervisa)
```
- Abre app
- Ve dashboard con:
  • Cuánto se debe cobrar
  • Clientes en riesgo
  • Acción rápida: "Recordar a cliente"
- Eso es TODO.
```

### TIPO 3: Admin/CFO (raro, usa web)
```
- Usa en PC
- Web sí puede tener menús complejos
```

---

## 🎨 DISEÑO ACTUAL (MALA UX)

```
┌─────────────────────────────────────────┐
│ [=] LOGO              [👤] [📞]         │
├─────────────────────────────────────────┤
│ MENÚ LATERAL:                           │
│ ├─ 📊 Dashboard                         │
│ ├─ 💰 GastoCheck                        │  ← Usuario confundido
│ ├─ 📞 CobraCheck                        │  ← ¿Cuál debo usar?
│ ├─ 🏦 BancoCheck                        │
│ ├─ 📈 FlujoCheck                        │
│ ├─ 📋 FacturaCheck                      │
│ └─ 📦 Inventario                        │
│                                         │
│ [CONTENIDO - confuso, muchas opciones] │
└─────────────────────────────────────────┘

PROBLEMA: 7 opciones = parálisis
```

---

## ✅ DISEÑO SIMPLE (BUENA UX)

### VERSIÓN MOBILE (lo que ve en la CALLE)

```
┌──────────────────────────────┐
│  Check Suite          [👤]   │
├──────────────────────────────┤
│                              │
│   ┌────────────────────┐    │
│   │                    │    │
│   │  📸 CAPTURAR GASTO │    │ ← GRAN BOTÓN
│   │                    │    │ Solo eso. Nada más.
│   └────────────────────┘    │
│                              │
│   ┌────────────────────┐    │
│   │ Por cobrar: $150k  │    │
│   │ Clientes en riesgo │    │
│   │ Recordar:  2       │    │
│   └────────────────────┘    │
│                              │
│   [Historial de gastos...]  │
│                              │
└──────────────────────────────┘

FLUJO USUARIO EN CALLE:
1. Abre app (home aparece automático)
2. Toma foto con botón GIGANTE
3. LISTO

TIEMPO: 10 segundos.
```

---

## 🖥️ DISEÑO WEB (para jefe en oficina)

```
┌────────────────────────────────────────────────────────┐
│ Check Suite             [👤] [⚙️]                      │
├────────────────────────────────────────────────────────┤
│                                                        │
│  DASHBOARD PRINCIPAL (home del jefe):                  │
│                                                        │
│  ┌─────────────────┬──────────────────┬─────────────┐ │
│  │ 💰 Por cobrar   │ 📞 Recordar      │ 📊 Riesgo   │ │
│  │ $150,000        │ 2 clientes       │ 35% (alto)  │ │
│  └─────────────────┴──────────────────┴─────────────┘ │
│                                                        │
│  ┌────────────────────────────────────────────────────┐│
│  │ CLIENTES CON RIESGO (últimos 7 días):             ││
│  │                                                    ││
│  │ 🔴 JUANITO IMPORTS        $50k    90 días vencido││
│  │    [Recordar] [Llamar]                            ││
│  │                                                    ││
│  │ 🟡 TALLER GARCÍA          $35k    45 días        ││
│  │    [Recordar] [Llamar]                            ││
│  │                                                    ││
│  │ 🟡 DISTRIBUIDORA XYZ       $65k    30 días        ││
│  │    [Recordar] [Llamar]                            ││
│  └────────────────────────────────────────────────────┘│
│                                                        │
│  SECUNDARIO (expandible):                              │
│  [Gastos] [Transacciones] [Reportes]                  │
│                                                        │
└────────────────────────────────────────────────────────┘

FLUJO JEFE:
1. Abre web
2. Ve resumen en 5 segundos
3. Click en cliente en riesgo
4. Envía recordatorio
5. LISTO
```

---

## 🎯 ARQUITECTURA DE NAVEGACIÓN SIMPLE

### MOBILE (Capturista - En la calle):

```
HOME = Botón GIGANTE "Capturar"

┌─────────────────────────────────────────┐
│ 📸 CAPTURAR GASTO                       │
│                                         │
│ ┌──────────────────────────────────┐  │
│ │                                  │  │
│ │         [CÁMARA GRANDE]          │  │
│ │                                  │  │
│ └──────────────────────────────────┘  │
│                                         │
│ [Últimos 5 gastos capturados...]       │
│                                         │
│ ├─ Café ☕ - $25 - Hoy                │
│ ├─ Gasolina ⛽ - $450 - Hoy           │
│ └─ Almuerzo 🍽️ - $180 - Ayer         │
│                                         │
│ ────────────────────────────────────   │
│ [Menú] [Perfil]                       │
└─────────────────────────────────────────┘

MENÚ (colapsado, secundario):
├─ 📊 Mi resumen (mis gastos)
├─ 👤 Perfil
└─ ⚙️ Más

SOLO ESO. Nada de CobraCheck en mobile.
```

### WEB (Jefe - En oficina):

```
HOME = Dashboard ejecutivo

LEFT SIDEBAR (pequeño, opcional):
├─ 📊 Dashboard (ACTIVO)
├─ 💰 GastoCheck
├─ 📞 CobraCheck
├─ ⚙️ Configuración
└─ 👤 Perfil

MAIN = Lo que VE el usuario

SI ES JEFE DE COBRANZA:
→ Dashboard muestra CobraCheck primary
  (clientes, riesgo, recordatorios)

SI ES CONTADOR:
→ Dashboard muestra GastoCheck primary
  (gastos, categorías, exportación)

SI ES ADMIN:
→ Dashboard muestra TODO
```

---

## 📱 OPCIÓN: APP MOBILE ULTRA-SIMPLE (Sin menú)

Para capturistas que NO quieren pensar:

```
┌──────────────────────────────────────┐
│ Check Suite  [Saldo: $5,200] [👤]   │
├──────────────────────────────────────┤
│                                      │
│                                      │
│      ┌──────────────────────┐       │
│      │                      │       │
│      │    📸 CAPTURAR       │       │
│      │                      │       │
│      │   (TAP PARA FOTO)    │       │
│      │                      │       │
│      └──────────────────────┘       │
│                                      │
│                                      │
│  ────────────────────────────────    │
│                                      │
│  Últimos gastos (scroll):            │
│  ├─ ☕ Café                    $25   │
│  ├─ ⛽ Gasolina               $450   │
│  ├─ 🍽️ Almuerzo              $180   │
│  ├─ 🛒 Supermercado          $890   │
│  └─ ...                             │
│                                      │
│  ────────────────────────────────    │
│  [≡] [Más] [👤]                     │
│                                      │
└──────────────────────────────────────┘

TOTALMENTE SIMPLE:
- Botón gigante
- Último gasto en la cara
- Menú colapsado (no interrumpe)
```

---

## 🎯 COMPARACIÓN: ANTES vs DESPUÉS

### ANTES (Confuso):
```
Usuario abre app
↓
Ve menú lateral con 7 opciones
↓
"¿Cuál uso?"
↓
Confundido
↓
Se va a otra app ❌
```

### DESPUÉS (Simple):
```
Usuario abre app
↓
Ve botón GIGANTE "Capturar gasto"
↓
Toma foto
↓
Listo ✅
```

---

## 🏗️ ARQUITECTURA POR ROL

### CAPTURISTA (en la calle - Mobile)
```
Lo que VE:
├─ Botón capturar (95% de la pantalla)
├─ Últimos gastos (historial rápido)
└─ Menú colapsado (raro lo usa)

Lo que NO ve:
✘ CobraCheck
✘ BancoCheck
✘ FlujoCheck
✘ Menú lateral

APP = Simple, rápida, focused
```

### JEFE DE COBRANZA (oficina - Web)
```
Lo que VE:
├─ Dashboard: clientes en riesgo
├─ Botones rápidos: recordar, llamar
├─ Histórico de pagos
├─ Sidebar con modules
└─ Reportes

Lo que NO ve inmediatamente:
- Gastos (en sidebar si quiere)
- Transacciones (en sidebar)

WEB = Completa, profesional
```

### ADMIN/CFO (oficina - Web)
```
Lo que VE:
├─ Dashboard ejecutivo
├─ Todos los módulos
├─ Reportes globales
├─ Configuración de empresa

PODER COMPLETO en web.
```

---

## ✅ SOLUCIÓN FINAL RECOMENDADA

### MOBILE = Ultra-simple
```
Un pantalla:
- Botón gigante "Capturar"
- Últimos gastos
- Menú colapsado

TIEMPO: 5 segundos de aprendizaje
ÉXITO: 95% de usuarios lo entienden
```

### WEB = Completa y profesional
```
Dashboard inteligente:
- Muestra lo relevante por rol
- Menú lateral con opciones
- Reportes y configuración

PODER: Todo disponible
USABILIDAD: Profesional
```

---

## 🎯 IMPLEMENTACIÓN

### MOBILE (/hoy path en mobile):
```
IF (user.device === 'mobile') {
  return <MobileSimpleHome />
}

MobileSimpleHome = Botón capturar + últimos gastos + menú
```

### WEB (/hoy path en web):
```
IF (user.device === 'desktop') {
  return <DashboardCompleto />
}

DashboardCompleto = Dashboard ejecutivo + sidebar completo
```

---

## 📋 CHECKLIST UX

- [x] Mobile: 1 botón, 1 pantalla
- [x] Web: Dashboard ejecutivo
- [x] Menú: colapsado en mobile, lateral en web
- [x] Roles: diferente UX por rol
- [x] Aprendizaje: < 10 segundos

---

**Resultado:** GastoCheck + CobraCheck, pero con UX SIMPLE

✅ Capturista en la calle = FACIL
✅ Jefe en oficina = PROFESIONAL  
✅ Admin = PODER COMPLETO

**Mejor de ambos mundos.**
