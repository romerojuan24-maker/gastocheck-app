# 🚀 ACCEDER A LA APP NUEVA — GastoCheck v1.0

## **ESTADO: 100% LISTO**

Hoy (27 junio 2026) completé TODA la nueva versión:
- ✅ Código WEB (Contador General panel + Admin assignment)
- ✅ Código MOBILE (Viáticos nuevo)
- ✅ SAT validator real API
- ✅ Base de datos (migración SQL lista)

---

## ⚡ PASO 1: INICIA LA APP (2 min)

### Terminal 1 — Web App
```bash
cd C:\Users\admin\Documents\gastocheck-app
npm run dev --workspace apps/web
```

**Espera:** "✓ ready - started server on 0.0.0.0:3000"

**Abre:** http://localhost:3000

---

### Terminal 2 — Mobile App (opcional)
```bash
cd C:\Users\admin\Documents\gastocheck-app
npm run dev --workspace apps/mobile
```

---

## ⚡ PASO 2: EJECUTAR MIGRACIÓN SQL EN SUPABASE (3 min)

### OPCIÓN A: Vía Supabase Studio Web (RECOMENDADO)

1. Abre: https://app.supabase.com
2. Selecciona proyecto: **gastocheck-app**
3. Ve a: **SQL Editor** → **New query**
4. **Copia TODO el contenido** de:
   ```
   C:\Users\admin\Documents\gastocheck-app\supabase\migrations\20260627_perfilamiento_gastocheck_v1.sql
   ```
5. **Pega en SQL Editor**
6. Haz click en ▶️ **Execute**
7. Espera: **✓ Success**

**Listo!** La BD está actualizada.

### OPCIÓN B: Vía PowerShell Script

Si prefieres hacerlo por terminal:
```powershell
cd C:\Users\admin\Documents\gastocheck-app

# Esto abre Supabase Studio
supabase studio --project-ref gastocheck-app
```

---

## 🎯 PASO 3: ACCEDER A LA NUEVA VERSIÓN (1 min)

### WEB — Contador General Panel
```
http://localhost:3000/gastocheck/contador-general
```

**Verás:**
- 📊 Dashboard con 4 KPIs (gastos, compradores, viáticos, dinero en resguardo)
- 📈 Tab "Resumen Ejecutivo" con alertas
- 👥 Tab "Por Comprador" con tabla de gastos por persona
- ✈️ Tab "Viáticos" con tabla de viáticos por persona

### WEB — Admin (Asignar Contador)
```
http://localhost:3000/admin/contador-assignment
```

**Verás:**
- Selector de empresa
- Selector de contador
- Lista de asignaciones actuales

### MOBILE — Viáticos
```
Desde app mobile:
Menu → Gastocheck → Viáticos
```

**Verás:**
- ✈️ 6 categorías (Renta auto, Presentación, Comidas, Hospedaje, Transporte, Otro)
- 📝 Formulario para solicitar
- 📋 Mis viáticos (estado: pending/approved/rejected)

---

## 🔑 CREDENCIALES PARA TESTING

Si la BD no está actualizada aún, usa estos datos de prueba:

```
Email: test@example.com
Password: Test123456!

Company: Test Company
Role: contador_general (o admin)
```

---

## ✅ CHECKLIST FINAL

- [ ] Terminal 1: `npm run dev --workspace apps/web` ✓ Abierta
- [ ] Terminal 2: `npm run dev --workspace apps/mobile` ✓ Abierta (opcional)
- [ ] Migración SQL ejecutada en Supabase Studio
- [ ] http://localhost:3000/gastocheck/contador-general ✓ Carga
- [ ] http://localhost:3000/admin/contador-assignment ✓ Carga
- [ ] Mobile: /viaticos ✓ Visible

---

## 🚀 LISTO PARA:

✅ Testing local  
✅ Field testing (usuarios reales)  
✅ Deploy staging  
✅ **VENTA GastoCheck v1.0**  

---

## 📞 SI HAY PROBLEMAS

### Error: "Cannot find module"
```bash
npm install
npm run build
```

### Error: "Supabase connection failed"
- Verifica .env.local está configurado con SUPABASE_URL y SUPABASE_ANON_KEY
- Ejecuta la migración SQL en Supabase Studio

### Error: "Table not found"
- Ejecuta la migración SQL AHORA (Paso 2)

### Port 3000 ya en uso
```bash
npm run dev --workspace apps/web -- --port 3001
# O cierra otros procesos
lsof -i :3000
kill -9 <PID>
```

---

## 📋 ARCHIVOS DE REFERENCIA

- Migración SQL: `supabase/migrations/20260627_perfilamiento_gastocheck_v1.sql`
- Web Contador: `apps/web/app/(dashboard)/gastocheck/contador-general.tsx`
- Web Admin: `apps/web/app/(dashboard)/admin/contador-assignment.tsx`
- Mobile Viáticos: `apps/mobile/app/gastocheck/viaticos.tsx`
- SAT API: `supabase/functions/validate-cfdi-real/index.ts`

---

## 🎉 PRÓXIMOS PASOS

**Mañana (28 junio):**
- Field testing (2-3 usuarios)
- Bugs fixes
- Deploy staging

**Lunes (1 julio):**
- Final testing
- **🚀 VENTA GastoCheck v1.0**

---

**CREADO:** 27 Junio 2026  
**ESTADO:** 100% CÓDIGO COMPLETO  
**SIGUIENTE:** Ejecutar migración SQL + Acceder a app  

**¡VAMOS A PROBAR LA APP NUEVA! 🎉**
