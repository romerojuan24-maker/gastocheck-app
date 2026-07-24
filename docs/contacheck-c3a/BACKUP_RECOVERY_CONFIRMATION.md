# ContaCheck · C3A.1 — Confirmación de Respaldo y Recuperación (§6)

> No se ejecutó ninguna restauración. La estrategia de recuperación **verificable** es condición de GO definitivo.

## Lo confirmable programáticamente: NADA (por diseño de la plataforma)
Backups/PITR/última restauración **no** son visibles por SQL read-only ni por PostgREST — viven en la capa de
plataforma (Dashboard de Supabase / Management API con token del owner). No los inventé.

## Checklist que Juan debe confirmar (Dashboard → Database → Backups)
| Ítem | Cómo | Estado |
|---|---|---|
| Plan y **backups automáticos** | Supabase Pro = diarios (conocido de F1A) | **Probable PASS — confirmar** |
| **Frecuencia** | diaria | Confirmar |
| **Retención** exacta (días) | plan | **PENDIENTE** |
| **PITR** habilitado (add-on) | Dashboard → Backups → PITR | **PENDIENTE** |
| Ventana de PITR disponible | Dashboard | PENDIENTE |
| **Último backup** (fecha/hora) | Dashboard | **PENDIENTE** |
| **Última restauración probada** | registro del equipo | **PENDIENTE (probable: nunca)** |
| Procedimiento de restauración documentado | runbook | PENDIENTE |
| Roles autorizados a restaurar | owner (Juan) | Juan |
| Dependencias externas | — | — |
| **RTO** estimado | según plan (restore de snapshot) | PENDIENTE |
| **RPO** máximo | sin PITR: hasta 24 h; con PITR: minutos | **PENDIENTE** |

## Requisito mínimo para GO definitivo
1. **Tomar un snapshot/backup manual inmediatamente antes** de aplicar C2B.
2. Confirmar que existe **al menos un backup reciente restaurable**.
3. Idealmente **activar PITR** antes del despliegue.
4. Documentar el procedimiento de restauración (aunque no se ejecute).

## Mitigación propia de C2B (no sustituye el backup)
- C2B es **aditivo** y trae `CONTACHECK_C2B_ROLLBACK.sql` **probado** (apply→rollback→reapply, 49/49). Con **0
  pólizas** en prod, el rollback lógico es la primera línea de recuperación.
- El backup/PITR es la **segunda línea** (ante lo que el rollback lógico no cubra).

## Estado del control
**WARNING — no confirmado.** No hay evidencia de una recuperación **probada**. El gate **no** puede pasar a GO
definitivo hasta que Juan confirme un backup reciente restaurable (y, deseablemente, PITR).
