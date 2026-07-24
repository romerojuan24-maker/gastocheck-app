# ContaCheck · C3A.2 — Evidencia de Respaldo y PITR (§6)

> **Estado: PENDIENTE de confirmación por Juan** (Dashboard de Supabase). No fabricado. No se restauró nada.

## No verificable programáticamente
Backups/PITR/última restauración viven en la capa de plataforma (Dashboard → Database → Backups / Management API
con token del owner). No son visibles por SQL read-only ni PostgREST. **No inventé estos datos.**

## Checklist a confirmar (Juan)
| Ítem | Estado |
|---|---|
| Plan de Supabase | Pro (conocido) — **confirmar** |
| Respaldo automático | diario (Pro) — **confirmar** |
| Frecuencia | diaria — confirmar |
| Retención (días) | **PENDIENTE** |
| **PITR habilitado** | **PENDIENTE** (add-on Pro) |
| Ventana PITR | PENDIENTE |
| Última copia disponible | **PENDIENTE** |
| Procedimiento de recuperación | PENDIENTE (documentar) |
| Responsables / permisos | Juan (owner) |
| **RPO** | sin PITR: hasta 24 h; con PITR: minutos — **confirmar** |
| **RTO** | según restore de snapshot — **confirmar** |

## §6.1 — Backup previo a C3B (obligatorio)
**No asumir que el respaldo diario basta.** Antes de C3B:
1. Tomar un **snapshot/backup manual** inmediatamente antes de aplicar.
2. Confirmar que quedó **restaurable**.

## §6.2 — Última restauración probada
**Desconocida / probablemente nunca.** No hay evidencia de una restauración probada. Recomendación: **probar una
restauración en un proyecto aislado** (no en producción) para validar RTO real. **No fingir evidencia:** hasta que
exista una restauración probada, la estrategia de recuperación **no está verificada**.

## Impacto en el veredicto
El §9 exige "respaldo confirmado" y "PITR confirmado o mitigación explícita aprobada". Ambos **PENDIENTES** →
condición **no cumplida** → contribuye al **NO-GO** actual.

## Mitigación propia de C2B (no sustituye el backup)
C2B es aditivo, trae `CONTACHECK_C2B_ROLLBACK.sql` probado (49/49) y prod tiene **0 pólizas** → el rollback lógico
es primera línea. El backup/PITR es la segunda línea y sigue siendo requisito de GO.
