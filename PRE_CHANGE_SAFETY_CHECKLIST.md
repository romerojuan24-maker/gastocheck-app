# 🛑 PRE-CHANGE SAFETY CHECKLIST

**LEER ESTO ANTES DE HACER CUALQUIER CAMBIO — NO SALTARSE PASOS**

---

## ⚠️ ANTES DE TOCAR CÓDIGO/CONFIG/MIGRATION:

### PASO 1: Sincronizar (2 min)
```bash
git pull origin main
git log --oneline -10        # Ver qué hizo Chat 1
git status                    # Verificar cambios sin committed
```

### PASO 2: Verificar Estado App (3 min)
```
☐ ¿App abre en este momento?
☐ ¿GastoCheck funciona?
☐ ¿CobraCheck funciona?
☐ ¿Puedo entrar a la app?
  (Si NO → STOP. No toques nada. Contacta Chat 1)
```

### PASO 3: Revisar Cambios Recientes Chat 1 (5 min)
```bash
git log --oneline -20 | head -20
```
Buscar:
- ¿feat(ota137/138/etc)?
- ¿fix()?
- ¿cambios a apps/mobile/app/*?
- ¿cambios a package.json?

Si ves cambio RECIENTE (últimas 2 horas):
```
→ PREGUNTA CHAT 1 en SLACK:
"Acabo de ver tu commit X. ¿Estás en medio de 
algo relacionado con [archivo que quiero tocar]?
Quiero cambiar Y. ¿Es seguro?"

→ ESPERA confirmación
→ SOLO DESPUÉS: haz tu cambio
```

### PASO 4: Clasificar tu Cambio (1 min)
¿Qué vas a cambiar?

**TIPO A — SEGURO (bajo riesgo)**
- ✅ Documentación (.md archivos)
- ✅ Nueva carpeta flujocheck/bancocheck/facturacheck/* (propia)
- ✅ Tipos TypeScript en carpeta types/
- ✅ Constantes en constants/ (sin tocar BRAND, SPACING existentes)

**TIPO B — MODERADO (revisar primero)**
- 🟡 DESIGN_SYSTEM_CHECK_SUITE_NAVIGATION.md
- 🟡 package.json (cambios versiones)
- 🟡 .env o settings
- 🟡 migrations Supabase nuevas

**TIPO C — PELIGROSO (preguntar Chat 1 siempre)**
- 🔴 apps/mobile/app/index.tsx (rutas)
- 🔴 apps/mobile/app/gastocheck/* (código activo)
- 🔴 apps/mobile/app/cobracheck/* (código activo)
- 🔴 apps/mobile/app/(tabs)/* (rutas)
- 🔴 migrations que tocan tablas existentes
- 🔴 package.json (peerDependencies, main dependencias)

---

## ✅ SI ES TIPO A:
```
☐ git pull origin main
☐ Revisar git log -5 (¿cambio reciente?)
☐ Hacer cambio
☐ git commit + git push
☐ LISTO (no necesita OK Chat 1)
```

## ✅ SI ES TIPO B:
```
☐ git pull origin main
☐ Revisar git log -10
☐ SLACK Chat 1: "Voy a cambiar X. ¿OK?"
☐ ESPERAR: "OK" o "espera, estoy en Y"
☐ Si OK → git commit + git push
☐ SLACK Chat 1: "Cambio pusheado, por favor testa"
☐ ESPERAR: "App OK" (al menos status)
```

## 🔴 SI ES TIPO C:
```
☐ git pull origin main
☐ Revisar git log -20 (últimos cambios significativos)
☐ SLACK Chat 1: "Necesito tocar X. ¿Estás trabajando ahí? ¿Es seguro?"
☐ ESPERAR: respuesta clara (puede ser 15+ minutos)
☐ Si Chat 1 dice "NO" → revisar alternativa
☐ Si Chat 1 dice "OK" → hacer cambio
☐ git commit + git push
☐ SCREENSHOT: app abriendo después de cambio
☐ SLACK Chat 1: "Cambio X pusheado. Screenshot attached. Puedes entrar?"
☐ ESPERAR confirmación: "App OK" antes de dar por terminado
```

---

## 🚨 DESPUÉS DE GIT PUSH — SIEMPRE:

```
1. SLACK Chat 1: "Cambio X pusheado a main"
2. Esperar respuesta
3. Si respuesta = "App no abre":
   → git revert -n HEAD
   → git push origin main
   → SLACK: "Reverted. Investigando"
4. Si respuesta = "App OK":
   → Continuar tranquilo
```

---

## 🚫 NUNCA HAGAS ESTO:

```
❌ Cambiar código sin git pull primero
❌ Tocar apps/mobile/app/index.tsx sin preguntar
❌ Ignorar "espera, estoy en eso" de Chat 1
❌ Push sin avisar Chat 1
❌ git push -f (forzar push) NUNCA
❌ Continuar si Chat 1 dice "NO hace, rompemos integración"
❌ Cambiar migrations sin testear primero en sandbox
```

---

## 📞 SI ALGO SE ROMPE:

**IMMEDIATO (sin esperar)**:
```bash
git revert -n HEAD
git push origin main
SLACK Chat 1: "ROMPÍ la app. Revirtiendo NOW. Disculpas"
```

**Investigar DESPUÉS, no ANTES de revert.**

---

## ✨ RESULTADO SI SIGUES ESTO

✅ Cero downtime para Chat 1  
✅ Ambos chats colaboran sin conflictos  
✅ App SIEMPRE está en estado "entra y funciona"  
✅ Cambios coordinados, sin sorpresas  

**Cost of NOT following**: 2+ horas de downtime, equipo enojado, clientes sin acceso.

---

**IMPRIMIR/SCREENSHOT ESTO. REVISAR ANTES DE TOCAR CÓDIGO.**

**Última actualización**: 2026-07-05  
**Criticidad**: 🔴 MÁXIMA
