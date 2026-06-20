# 📅 CHECK SUITE — Sprint Plan (Próximos 7 días)

**Período:** Viernes 20 de junio - Viernes 27 de junio  
**Objetivo:** GastoCheck OTA 1.0 en producción, CobraCheck OTA 1.1 listo, iniciar refactor

---

## 🎯 Prioridades

1. **🔴 CRÍTICA:** GastoCheck 100% funcional (OTA 1.0)
2. **🟠 ALTA:** CobraCheck sólido (OTA 1.1)
3. **🟡 MEDIA:** Iniciar refactor arquitectura (paralelo)
4. **🟢 BAJA:** Documentación (continuidad)

---

## 📅 Desglose Diario

### VIERNES 20 (HOY) — Setup + Testing Interno GastoCheck

**Objetivo:** GastoCheck listo para deploy

**Tareas:**

#### Testing Interno (Equipo A)
- [ ] Ejecutar todos los test suites existentes
- [ ] Capturar 20 tickets variados:
  - 5 tickets borrosos (validar OCR robustez)
  - 5 tickets claros (monto, fecha, RFC)
  - 5 tickets sin RFC (validar manejo)
  - 5 tickets duplicados (validar detección)
- [ ] Validar exportación (Excel + CSV)
- [ ] Probar multi-empresa (cambio rápido)
- [ ] Performance: Todas las screens < 3 segundos
- [ ] Mobile vs Web (responsive)
- [ ] Búsqueda y filtros (todos funcionan)

#### Preparación Deploy (DevOps/Daniel)
- [ ] Verificar ANTHROPIC_API_KEY en secrets
- [ ] Verificar STRIPE_SECRET_KEY en secrets
- [ ] Revisar migrations (Supabase)
- [ ] Dry run deploy (staging vs producción)
- [ ] Rollback plan documentado
- [ ] Monitoring/alertas configuradas

#### Documentación Usuarios (PM)
- [ ] Manual GastoCheck (PDF 5 páginas):
  - Cómo capturar gasto (3 pasos)
  - Cómo exportar (Excel/CSV)
  - FAQ: "¿Qué pasa si el OCR falla?"
  - Contacto soporte (WhatsApp)
  
- [ ] Video tutorial (30 segundos):
  - "Toma foto → Sistema lee → Listo"
  
- [ ] Checklist de operario:
  - Items del ticket a revisar antes de "confirmar"

**Cierre de día:**
- ✅ Bugs críticos encontrados: 0 o hotfixed
- ✅ Testing interno: PASADO
- ✅ Deploy: LISTO

---

### SÁBADO 21 — Deploy OTA 1.0 GastoCheck

**Objetivo:** GastoCheck en producción, usuarios iniciales empezando

**Timeline:**

```
09:00 - 09:30: Confirmación final
  ├─ Revisar logs de staging
  ├─ Validar data: zero corruption
  └─ Team standup (5 min)

09:30 - 10:00: Deploy Vercel
  ├─ Push main → Vercel auto-deploy
  ├─ Testing URL en vivo
  ├─ Sanity check (homepage, login, básicos)
  └─ Slack notification: "OTA 1.0 en vivo ✅"

10:00 - 12:00: Deploy EAS (iOS + Android)
  ├─ eas build --platform ios (30 min)
  ├─ eas build --platform android (30 min)
  ├─ Submit TestFlight + Play Store Internal
  ├─ QA testing en device real
  └─ Release cuando pasa QA

12:00+: Rollout a usuarios
  ├─ Operario 1: Setup cuenta
  ├─ Operario 2: Setup cuenta
  ├─ Operario 3: Setup cuenta
  ├─ Enviar manual + video
  ├─ WhatsApp grupo para soporte
  └─ Confirmar "Estoy dentro"

17:00: Revisión de día
  ├─ ¿Todos logueados?
  ├─ ¿Alguien capturó gasto?
  ├─ ¿Hay bugs?
  └─ Log de incidencias
```

**Tareas Paralelas:**

#### Equipo A (GastoCheck Ops)
- [ ] Deploy + sanity check
- [ ] Monitoreo 24/7 (turno)
- [ ] Responder a operarios si hay issues
- [ ] Hotfix cualquier bug CRÍTICO (SLA: 30 min)

#### Equipo B (CobraCheck Setup)
- [ ] Finalizar CobraCheck OTA 1.1
- [ ] Validar integración con GastoCheck
- [ ] Testing interno (similar a Viernes)

---

### LUNES 23 — Usuarios Reales Usando GastoCheck

**Objetivo:** Recopilar feedback de campo, identificar mejoras

**Equipo A (Soporte + Bugfixes):**
- [ ] Morning standup (9:00)
  - ¿Qué pasó fin de semana?
  - ¿Bugs reportados?
  
- [ ] WhatsApp check-in con operarios (9:30)
  - "¿Cómo va GastoCheck?"
  - "¿Algún problema?"
  
- [ ] Logging y recopilación:
  - Cantidad de gastos capturados
  - Errores de OCR (cuáles tickets fallaron)
  - Feedback usuario
  - Bugs encontrados
  
- [ ] Bugfixes diarios:
  - CRÍTICO: < 30 min
  - ALTO: < 4 horas
  - MEDIO: Log para después
  
- [ ] Deploy hotfixes (si hay):
  - Commit mensaje claro
  - Test antes de push
  - Monitoreo post-deploy

**Equipo B (CobraCheck Deploy):**
- [ ] Deploy OTA 1.1 CobraCheck
- [ ] Sanity check igual a Sábado
- [ ] Preparar para usuarios martes

**PM (Recopilación Datos):**
- [ ] Crear spreadsheet: Feedback log
  - Fecha, usuario, feedback, severidad, acción
- [ ] Daily summary para el equipo

---

### MARTES 24 — CobraCheck Usuarios Iniciales

**Objetivo:** Validar integración GastoCheck + CobraCheck, recopilar feedback

**Equipo A (GastoCheck Monitoring):**
- [ ] Continuar soporte a operarios GastoCheck
- [ ] Recopilar feedback diario
- [ ] Hotfixes si hay
- [ ] Análisis: Uso vs Errores

**Equipo B (CobraCheck Ops):**
- [ ] Deploy OTA 1.1 (si no fue ayer)
- [ ] Usuarios reales: 1-2 administradores
- [ ] Entrenar en 15 min (muy simple)
- [ ] Monitoreo 24/7 (turno)

**PM:**
- [ ] Actualizar feedback log
- [ ] Análisis: ¿GastoCheck + CobraCheck funcionan juntos?
- [ ] Identificar integraciones que faltan

---

### MIÉRCOLES 25 — Depuración y Análisis

**Objetivo:** Estabilizar ambos módulos, preparar para week 2

**Equipo A (GastoCheck):**
- [ ] Análisis semanal:
  - Gastos totales capturados
  - OCR accuracy %
  - Errores principales
  - User feedback NPS
  
- [ ] Propuesta de mejoras:
  - "Debemos optimizar X porque..."
  - Priorizar por impacto
  
- [ ] Bugfixes high-priority

**Equipo B (CobraCheck):**
- [ ] Análisis semanal:
  - Facturas creadas
  - Clientes agregados
  - Pagos registrados
  - Pólizas generadas
  
- [ ] Validar integración:
  - ¿Gasto en GastoCheck vincula con pago en CobraCheck?
  - ¿Póliza se crea automáticamente?
  
- [ ] Propuesta de mejoras

**Arquitectura (Equipo C - New):**
- [ ] Iniciar refactor paralelo
  - [ ] Revisar ARCHITECTURE_INTEGRAL_DATABASE.md
  - [ ] Crear tabla movimientos_financieros (schema)
  - [ ] Plan de backfill (gastos → movimientos)
  - [ ] Testing strategy
  
- [ ] Meta: Tener schema + plan listo, no implementación aún

**PM:**
- [ ] Compilar feedback semanal
- [ ] Reportar: "Listos para Week 2?" o "Hay blockers?"
- [ ] Decisión: Expandir usuarios o hotfix más?

---

### JUEVES 26 — Estabilización y Planning Week 2

**Objetivo:** Asegurar que GastoCheck + CobraCheck están estables, plan Week 2

**Equipo A + B (Standup combinado):**
- [ ] Review semanal (1 hora):
  - GastoCheck: Status, bugs, feedback
  - CobraCheck: Status, bugs, feedback
  - Integración: ¿Funciona todo junto?
  
- [ ] Decisiones:
  - ¿Expandir usuarios GastoCheck? (de 3 a 5-10)
  - ¿Más feedback CobraCheck?
  - ¿Hotfixes antes de Week 2?

**Equipo C (Arquitectura):**
- [ ] Schema movimientos_financieros: REVIEW
- [ ] Plan de backfill: REVIEW
- [ ] Testing plan: DETAIL
- [ ] Estimación: "¿Cuántos días para implementar?"

**PM + Team:**
- [ ] Planning Week 2:
  - Si GastoCheck está bien: "Week 2 = más usuarios, depuración continua"
  - Si hay blockers: "Week 2 = hotfixes prioritarios"
  
- [ ] Comunicación usuarios:
  - Resumen semanal
  - Agradecimiento por feedback
  - Preview Week 2 improvements

---

### VIERNES 27 — Cierre Semana + Planning OTA 1.2

**Objetivo:** Cierre limpio, planificación siguientes semanas

**Equipo A + B + C (Standup final):**
- [ ] Retrospectiva (1.5 horas):
  - ¿Qué salió bien?
  - ¿Qué falló?
  - ¿Qué aprendimos?
  
- [ ] Métricas finales:
  ```
  GastoCheck:
  - Gastos capturados: X
  - Usuarios activos: 3
  - OCR accuracy: Y%
  - Bugs CRÍTICOS: 0
  - NPS: Z
  
  CobraCheck:
  - Facturas creadas: X
  - Usuarios activos: 1-2
  - Pólizas generadas: X
  - Bugs CRÍTICOS: 0
  - NPS: Z
  
  Arquitectura:
  - Schema 100% diseñado
  - Backfill plan ready
  - Estimación: X días
  ```

**PM:**
- [ ] Reporte ejecutivo:
  - GastoCheck OTA 1.0: ✅ Exitoso
  - CobraCheck OTA 1.1: ✅ Exitoso
  - Próximos pasos claro
  - Timeline Week 2-4

- [ ] Comunicación stakeholders:
  - "GastoCheck en producción, 100% funcional"
  - "Usuarios reales usando, feedback positivo"
  - "Next: Más usuarios, BancoCheck próximo"

**Planning Week 2:**
- [ ] Si todo va bien:
  - Expandir usuarios GastoCheck (5-10 personas)
  - Depuración continua CobraCheck
  - Arquitectura refactor: 50% implementada
  
- [ ] Si hay issues:
  - Hotfixes prioritarios
  - Ajustes basados en feedback
  - Timeline: +1 semana para refactor

---

## 🎯 Success Criteria

### End of Week 1 (Viernes 27)

**GASTOCHECK:**
- ✅ OTA 1.0 en producción (Sábado 21)
- ✅ 3+ usuarios reales usando diariamente
- ✅ 0 bugs CRÍTICOS (máximo 2 ALTOS en log)
- ✅ OCR accuracy > 90%
- ✅ Exportación funcionando (Excel + CSV)
- ✅ NPS > 50

**COBRACHECK:**
- ✅ OTA 1.1 deployado (Martes 24)
- ✅ 1-2 usuarios reales usando
- ✅ 0 bugs CRÍTICOS
- ✅ Integración con GastoCheck funcionando
- ✅ Pólizas creadas automáticamente

**ARQUITECTURA:**
- ✅ Schema movimientos_financieros diseñado
- ✅ Plan de backfill claro
- ✅ Testing strategy defined
- ✅ Equipo C iniciado (no bloqueando Week 1)

**EQUIPO:**
- ✅ Comunicación clara (Slack + WhatsApp)
- ✅ Bugfixes < 4 horas SLA
- ✅ Usuarios satisfechos

---

## 📋 Roles por Día

### Equipo A (GastoCheck)
- Viernes 20: Testing interno
- Sábado 21: Deploy + monitoring
- Lunes-Viernes: Soporte, bugfixes, análisis

### Equipo B (CobraCheck)
- Viernes 20: Testing interno
- Lunes 23: Deploy prep + monitor GastoCheck
- Martes 24: Deploy + usuarios
- Lunes-Viernes: Soporte, bugfixes, análisis

### Equipo C (Arquitectura) - NEW
- Miércoles 25: Inicio
- Jueves-Viernes: Schema + plan
- Week 2: Implementación paralela

### PM
- Daily: Recopilación feedback, coordination
- Weekly: Reporte ejecutivo, planning

---

## 🚨 Escalation Plan

**Si OCR falla en producción:**
1. Hotfix: Mejorar prompt o parseo
2. User-facing: Mostrar preview, permitir edición
3. Rollback: Si es crítico (< 1 hora)

**Si CobraCheck no integra con GastoCheck:**
1. Hotfix: Revisar foreign keys, reconciliación
2. Análisis: ¿Data model issue?
3. Plan: Refactor esquema (puede esperar Week 2)

**Si Equipo C bloquea:**
1. Alternar: Dev help desde Equipo A/B
2. Extensión: Refactor puede tomar + tiempo
3. Plan: Activar en OTA 1.2 (no OTA 1.1)

---

## ✅ Checklist Diario

**Morning Standup (9:00):**
- [ ] ¿Qué pasó ayer?
- [ ] ¿Bugs nuevos?
- [ ] ¿Plan hoy?
- [ ] ¿Blockers?

**Evening Standup (17:00):**
- [ ] ¿Qué se hizo?
- [ ] ¿Bugs resueltos?
- [ ] ¿Feedback usuarios?
- [ ] ¿Ready para mañana?

**Friday Retrospective (16:00):**
- [ ] ¿Qué salió bien?
- [ ] ¿Qué no?
- [ ] ¿Qué aprendimos?
- [ ] ¿Plan Week 2?

---

**Esto es el plan de batalla. Ejecutable, predecible, ágil.**
