# ContaCheck · C3A.2 — Remediación del historial de Git (§1.5)

> **Plan; no ejecutado.** Reescribir el historial remoto requiere **autorización explícita** de Juan y coordinación
> con cualquier colaborador. **Prioridad: rotar primero** (invalida la llave); la purga es higiene posterior.

## Impacto de reescribir el historial
- Cambia los SHA de **todos** los commits desde el primero afectado (`a5d4bb7`, 2026-06-23) en adelante.
- **Todos los clones/forks** quedan desincronizados y deben re-clonar o re-basar.
- Tags y ramas que apunten a commits reescritos deben re-crearse.
- PRs abiertos pueden romperse.

## Pre-requisitos
1. **Rotación completada** (`SECRET_ROTATION_PLAN.md`) — así, aunque el secreto persista en algún fork, ya está
   invalidado.
2. **Respaldo del repo** (clon espejo): `git clone --mirror <url> repo-backup.git`.
3. Inventario de **ramas, tags y colaboradores**; avisar a todos (ventana de congelación de merges).
4. Verificar que no haya trabajo sin pushear que se pierda.

## Procedimiento (git filter-repo)
```bash
# 1) Clonar limpio
git clone --mirror git@github.com:romerojuan24-maker/gastocheck-app.git gc-clean.git
cd gc-clean.git

# 2) Definir reemplazos (archivo replacements.txt con patrones → sin pegar el secreto real; usar regex del token)
#    Ejemplo de regla (una por línea):  regex:eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+==>REDACTED
git filter-repo --replace-text replacements.txt

# 3) Revisar que el token ya no aparece en NINGÚN commit
git grep -IE 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' $(git rev-list --all) | head

# 4) Force-push del historial reescrito (CON AUTORIZACIÓN EXPLÍCITA)
git push --force --mirror
```
Alternativa: **BFG Repo-Cleaner** (`bfg --replace-text replacements.txt`).

## Después del force-push
- Todos los colaboradores: `git fetch --all && git reset --hard origin/main` (o re-clonar).
- Re-crear tags si aplica. Cerrar/re-abrir PRs afectados.
- Confirmar en GitHub que el "secret scanning" (si está activo) ya no marca el token.

## Estado
**PENDIENTE — requiere autorización explícita de Juan.** No se reescribió nada. La limpieza del **árbol actual**
(HEAD) ya está hecha; esto es para el **historial**.
