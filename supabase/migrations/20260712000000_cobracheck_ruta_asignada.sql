-- CobraCheck — datos que el diagrama final (COBRACHECK.docx) especifica
-- para la ruta asignada: "dirección, quién paga, horario, lista de
-- facturas del cliente a cobrar, link GPS". Dirección/GPS ya existían
-- (20260711000000); faltan quién paga y horario.
alter table cobra_clients
  add column if not exists payer_name    text,
  add column if not exists visit_schedule text;

comment on column cobra_clients.payer_name is 'Quién paga en sitio, si es distinto al nombre del cliente/razón social.';
comment on column cobra_clients.visit_schedule is 'Horario preferido de visita (ej. "9:00-11:00"), para armar la ruta del día.';
