-- Check Advisor: columna evidence_json que faltaba — "explanation" (texto,
-- ya existe) es para la explicación en lenguaje natural (Wave 7, IA);
-- evidence_json es la evidencia estructurada que respalda cada insight
-- (Sección 19 del spec: "cada conclusión debe conservar evidenceJson").
alter table advisor_insights
  add column if not exists evidence_json jsonb;
