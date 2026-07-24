# ContaCheck · C2B — Resultados de Concurrencia (2+ conexiones)

> Ejecutado con procesos `docker exec … psql` en paralelo (`&` + `wait`). Script:
> `<scratch>/c2b_concurrency.sh`. **3/3 PASS.**

## CC1 — Idempotencia bajo 2 conexiones simultáneas
Dos conexiones llaman `accounting_generate_voucher` con la **misma** `idempotency_key` (K_CONC) y mismo payload
a la vez. Mecanismo: la 2ª conexión **bloquea** en el `INSERT` sobre `UNIQUE(company_id, idempotency_key)` de
`accounting_idempotency_requests` hasta el commit de la 1ª, luego captura `unique_violation` y **devuelve el
voucher existente**.
- Resultado: **vouchers con K_CONC = 1** (esperado 1). **PASS.**
- Demuestra idempotencia a nivel BD, no solo deduplicación en aplicación.

## CC2 — Numeración concurrente (20 asignaciones simultáneas)
20 conexiones llaman `accounting_next_voucher_number(A, 2026, 'CC')` en paralelo (row-lock por
`UPDATE … RETURNING` sobre `accounting_voucher_sequences`).
- Resultado: **20 folios generados, 20 distintos** (esperado 20/20). **PASS.**
- Sin duplicados ni bajo carga. Folios consecutivos por `(empresa, ejercicio, tipo)`.

## CC3 — Contabilización simultánea de la misma póliza
Una póliza `approved` (version=2); dos conexiones llaman `accounting_post_voucher(A, v, 2)` a la vez.
- Resultado: **post OK = 1, rechazos = 1 (`VERSION_CONFLICT`/`ALREADY_POSTED`), posted = 1** (esperado 1/1/1).
  **PASS.**
- El bloqueo optimista (`version`) + `SELECT … FOR UPDATE` garantiza que solo una contabilización gana.

## Observaciones
- El bloqueo de folio y de idempotencia ocurre a **nivel de base de datos** (índices únicos + row locks), no en
  la aplicación → seguro ante doble clic, reintentos de API, webhooks duplicados, jobs repetidos y dos
  servidores simultáneos.
- Durante CC3 se observó también (correctamente) que reintentar una póliza de **origen** ya contabilizada para el
  mismo `(source_id, source_version)` es bloqueado por `uq_source_links_origin` (anti doble contabilización).
