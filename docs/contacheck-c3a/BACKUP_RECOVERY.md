# ContaCheck · C3A — Backup & Recovery (§13)

> Documentado sin ejecutar cambios. **Regla:** no asumir que existe recuperación solo porque exista un backup.

## Lo conocido (de sesiones previas y plan del proyecto)
- Proyecto **checksuite** en plan **Supabase Pro** con **backups diarios automáticos** (retención estándar del
  plan). Referencia: `NOMICHECK_1A_PRODUCTION_DEPLOYMENT.md:C` ("Supabase Pro con backups diarios automáticos
  como red de seguridad").

## Lo que DEBE confirmarse antes del GO definitivo (dashboard, no vía SQL read-only)
Estos datos **no** son verificables por PostgREST ni por los scripts SQL; requieren el **Dashboard de Supabase**
(Database → Backups) o la Management API con permisos del owner (Juan):

| Ítem | Cómo confirmar | Estado |
|---|---|---|
| Backups disponibles y **fecha del último** | Dashboard → Database → Backups | **PENDIENTE (Juan)** |
| Frecuencia y **retención** exacta | Dashboard / plan | PENDIENTE |
| **PITR** habilitado (Point-in-Time Recovery) | Dashboard → Backups → PITR (add-on Pro) | **PENDIENTE** |
| **Última restauración probada** | Registro del equipo | PENDIENTE (probable: nunca) |
| Procedimiento de recuperación documentado | Runbook | PENDIENTE |
| Permisos/responsables de restaurar | Owner del proyecto (Juan) | PENDIENTE |
| RTO estimado según config | Backup diario ⇒ RPO hasta 24 h sin PITR | PENDIENTE |

## Recomendación (condición de GO)
1. **Tomar un backup/snapshot manual inmediatamente antes** de aplicar C2B (aunque el cambio sea aditivo y de
   bajo riesgo con 0 pólizas).
2. Confirmar en dashboard que hay al menos **un backup reciente restaurable** y, si el plan lo incluye, **activar
   PITR** antes del despliegue.
3. Como C2B es **aditivo** y trae `CONTACHECK_C2B_ROLLBACK.sql` probado (revierte solo objetos C2B), el rollback
   lógico es la primera línea; el backup es la red de seguridad de segundo nivel.

## Nota de riesgo
No se pudo verificar programáticamente la existencia de una recuperación **probada**. Hasta que Juan confirme un
backup reciente restaurable (y, deseablemente, PITR), este control queda **WARNING**, no PASS.
