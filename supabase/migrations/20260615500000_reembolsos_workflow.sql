-- Agregar columna status a reembolsos
ALTER TABLE reembolsos
ADD COLUMN status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_auth', 'approved', 'closed'));

-- Índice para queries por status
CREATE INDEX idx_reembolsos_status ON reembolsos(company_id, status);

-- Actualizar pólizas existentes a 'closed' para compatibilidad hacia atrás
UPDATE reembolsos SET status = 'closed' WHERE status IS NULL;
