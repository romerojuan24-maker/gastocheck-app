# ✅ COBRACHECK: CHECKLIST DE DEPURACIÓN

**Objetivo:** Asegurar que CobraCheck esté 100% limpio ANTES de lanzar (sin iteraciones como GastoCheck)

---

## 🎯 MÓDULOS DE COBRACHECK

```
├─ Dashboard (KPIs)
├─ Clientes (CRUD)
├─ Facturas (Listar + crear)
├─ Registrar Pagos (formulario)
├─ Risk Scoring (automático)
├─ Promesas de Pago (registrar)
├─ Bitácora de Actividad (historial)
└─ Pólizas (generar + descargar) ← NUEVO
```

---

## 📋 CHECKLIST FUNCIONALIDAD

### Dashboard

- [ ] KPIs se cargan correctamente
  - [ ] Total por cobrar (suma correcta)
  - [ ] Clientes en riesgo (cuenta correcta)
  - [ ] Facturas vencidas (filtro correcto)
  - [ ] Risk score promedio (cálculo correcto)
- [ ] Responsive (mobile + desktop)
- [ ] Carga < 2 segundos
- [ ] Sin errores en consola

---

### Clientes (List)

- [ ] Listar clientes de empresa
- [ ] Búsqueda funciona (por nombre, RFC)
- [ ] Filtros:
  - [ ] Por status (activo, inactivo)
  - [ ] Por risk score (bajo, medio, alto)
  - [ ] Por último contacto
- [ ] Ordenar por:
  - [ ] Nombre A-Z
  - [ ] Risk score (alto → bajo)
  - [ ] Monto adeudado (mayor → menor)
- [ ] Click en cliente → Ver detalles
- [ ] Responsive (mobile + desktop)

---

### Cliente (Detalle + Editar)

- [ ] Mostrar todos los datos
  - [ ] Nombre, RFC, email, teléfono
  - [ ] Saldo actual, límite de crédito
  - [ ] Risk score + razón
  - [ ] Última transacción
- [ ] Editar campos:
  - [ ] Nombre
  - [ ] Email
  - [ ] Teléfono
  - [ ] Límite de crédito
- [ ] Validaciones:
  - [ ] RFC válido (13 caracteres)
  - [ ] Email válido
  - [ ] Teléfono válido
  - [ ] Límite > 0
- [ ] Guardar sin errores
- [ ] Mostrar confirmación ("Guardado ✅")
- [ ] Botón de cancelar funciona

---

### Crear Cliente

- [ ] Formulario abre correctamente
- [ ] Validaciones en tiempo real:
  - [ ] Nombre (mínimo 3 caracteres)
  - [ ] RFC (exacto 13 caracteres)
  - [ ] Email (formato válido)
  - [ ] Teléfono (opcional, si ingresa debe ser válido)
- [ ] Campos requeridos marcados (*)
- [ ] Límite de crédito (numérico, > 0)
- [ ] Botón "Crear" deshabilitado si hay errores
- [ ] Crear cliente exitoso:
  - [ ] Aparece en lista
  - [ ] Recibe risk_score = 0 (inicial)
  - [ ] Status = 'active'
- [ ] Mostrar confirmación ("Cliente creado ✅")
- [ ] Limpia formulario después

---

### Facturas (List)

- [ ] Listar facturas de la empresa
- [ ] Filtros por status:
  - [ ] Vigentes (pending, partial)
  - [ ] Vencidas (overdue)
  - [ ] Pagadas (paid)
- [ ] Mostrar para cada factura:
  - [ ] Folio
  - [ ] Cliente
  - [ ] Monto
  - [ ] Días vencido (si aplica)
  - [ ] Fecha vencimiento
- [ ] Click en factura → Ver detalles
- [ ] Ordenar por:
  - [ ] Fecha vencimiento (más próximas)
  - [ ] Días vencido (más vencidas primero)
  - [ ] Monto (mayor → menor)

---

### Crear Factura

- [ ] Formulario carga correctamente
- [ ] Campos:
  - [ ] Cliente (selector, con búsqueda)
  - [ ] Folio (texto, validar único por empresa)
  - [ ] Monto (numérico, > 0)
  - [ ] Fecha emisión (date picker)
  - [ ] Fecha vencimiento (date picker, > emisión)
- [ ] Validaciones:
  - [ ] Folio no duplicado (en BD)
  - [ ] Monto > 0
  - [ ] Fecha vencimiento > fecha emisión
  - [ ] Cliente seleccionado
- [ ] Crear factura:
  - [ ] Inserta en BD
  - [ ] Aparece en lista inmediatamente
  - [ ] Status = 'pending'
  - [ ] days_overdue = NULL
- [ ] Mostrar confirmación

---

### Registrar Pago

- [ ] Formulario abre sin errores
- [ ] Campos:
  - [ ] Cliente (selector)
  - [ ] Factura (selector, filtra por cliente)
  - [ ] Monto pagado (numérico)
  - [ ] Fecha de pago (date picker)
  - [ ] Método (efectivo, banco, cheque, transferencia)
- [ ] Validaciones:
  - [ ] Monto <= monto factura
  - [ ] Monto > 0
  - [ ] Fecha pago <= hoy
- [ ] Al registrar:
  - [ ] Actualiza saldo cliente
  - [ ] Actualiza status factura:
    - [ ] Si pago total → 'paid'
    - [ ] Si pago parcial → 'partial'
  - [ ] Crea entrada en historial
  - [ ] GENERA PÓLIZA automáticamente
- [ ] Muestra póliza:
  - [ ] Botón "Descargar CSV"
  - [ ] Botón "Descargar Excel"
  - [ ] Preview de póliza en pantalla
- [ ] No enviá por WhatsApp (QUITAR)

---

### Póliza (Nueva)

- [ ] Se genera automáticamente al pagar
- [ ] Contiene:
  - [ ] Tipo: EGRESO
  - [ ] Número único
  - [ ] Fecha del pago
  - [ ] Descripción: "Pago de Cliente XYZ"
  - [ ] Líneas contables:
    - [ ] Banco (Haber)
    - [ ] Clientes (Debe)
    - [ ] Comisión (si existe)
- [ ] Descarga CSV:
  - [ ] Formato correcto
  - [ ] Campos: No, Cuenta, Descripción, Debe, Haber
  - [ ] Números con decimales correctos
  - [ ] Debe = Haber (validación)
- [ ] Descarga Excel:
  - [ ] Formato profesional
  - [ ] Estilos y colores
  - [ ] Tabla clara
  - [ ] Compatible CONTPAQi
- [ ] Preview en pantalla:
  - [ ] Tabla legible
  - [ ] Todos los datos visibles

---

### Risk Scoring

- [ ] Se calcula automáticamente al crear cliente
- [ ] Se actualiza al:
  - [ ] Registrar pago
  - [ ] Vencer factura
  - [ ] Crear nueva factura
- [ ] Fórmula correcta:
  - [ ] Basado en: días vencido, saldo, historial pagos
  - [ ] Resultado: 0-100
  - [ ] Color badge:
    - [ ] 0-30: Verde (bajo riesgo)
    - [ ] 31-70: Amarillo (riesgo medio)
    - [ ] 71+: Rojo (alto riesgo)
- [ ] Mostrado en:
  - [ ] Dashboard (promedio)
  - [ ] Lista clientes (badge)
  - [ ] Detalle cliente (valor + justificación)

---

### Promesas de Pago

- [ ] Formulario para registrar promesa:
  - [ ] Cliente
  - [ ] Factura(s)
  - [ ] Monto prometido
  - [ ] Fecha promesa
- [ ] Al registrar:
  - [ ] Crea registro en promesas tabla
  - [ ] Status factura = 'promised'
  - [ ] Historial se actualiza
- [ ] Vista de promesas:
  - [ ] Listar promesas pendientes
  - [ ] Mostrar: Cliente, monto, fecha, estado
  - [ ] Marcar como cumplida
  - [ ] Si no se cumple → aumentar risk score

---

### Bitácora de Actividad

- [ ] Mostrar todas las acciones:
  - [ ] Cliente creado
  - [ ] Factura creada
  - [ ] Pago registrado
  - [ ] Promesa registrada
  - [ ] Cliente editado
- [ ] Para cada acción:
  - [ ] Usuario que la hizo
  - [ ] Fecha y hora
  - [ ] Descripción clara
  - [ ] Datos antes/después (si es edición)
- [ ] Filtros:
  - [ ] Por tipo de acción
  - [ ] Por usuario
  - [ ] Por rango de fecha
- [ ] Exportar bitácora (CSV/Excel)

---

## 🧪 TESTING

### Flujos críticos

- [ ] **Flujo 1: Crear cliente → Crear factura → Pagar → Generar póliza**
  - [ ] Paso a paso sin errores
  - [ ] Datos correctos en cada etapa
  - [ ] Póliza contable correcta
  - [ ] Descargable y importable

- [ ] **Flujo 2: Múltiples facturas, un pago parcial**
  - [ ] Usuario selecciona factura correcta
  - [ ] Monto pagado < monto factura
  - [ ] Status = 'partial'
  - [ ] Saldo se actualiza correctamente

- [ ] **Flujo 3: Risk score automático**
  - [ ] Crear cliente → score = 0
  - [ ] Crear factura con vencimiento mañana → score sube
  - [ ] Crear factura vencida hace 30 días → score más alto
  - [ ] Pagar a tiempo → score baja

### Performance

- [ ] Dashboard carga < 2 segundos
- [ ] Lista clientes (100 registros) < 1 segundo
- [ ] Crear cliente < 500ms
- [ ] Registrar pago < 800ms (incluye generación póliza)
- [ ] Sin lentitud observable en mobile

### Mobile responsivo

- [ ] Formularios legibles
- [ ] Botones tapables (mínimo 44x44px)
- [ ] Tabla de facturas scrolleable horizontalmente
- [ ] Modales centrados
- [ ] Teclado no oculta inputs importantes

### Seguridad

- [ ] Usuario NO puede ver clientes de otra empresa
- [ ] Usuario NO puede editar factura de otro
- [ ] Supervisor NO puede cambiar risk score manualmente
- [ ] Operador NO ve módulos que no tiene autorizados
- [ ] Póliza incluye usuario que la creó (auditoría)

---

## 🐛 BUGS COMUNES A REVISAR

- [ ] Validación de RFC (13 caracteres, formato correcto)
- [ ] Cálculo de días vencido (si fecha > hoy)
- [ ] Risk score recalcula en tiempo real
- [ ] Póliza balancea (debe = haber)
- [ ] Decimal handling (2 decimales, sin redondeos)
- [ ] Timezone (fechas en zona horaria correcta)
- [ ] Multi-empresa (usuario solo ve su empresa)
- [ ] Concurrencia (2 usuarios pagan al mismo tiempo)

---

## 📋 ANTES DE LANZAR

- [ ] Ejecutar todos los tests
- [ ] Revisar logs (sin errores)
- [ ] Testear en mobile (iOS + Android)
- [ ] Testear en web (Chrome, Safari, Firefox)
- [ ] Performance audit (Lighthouse)
- [ ] Security audit (sin SQL injection, XSS, etc)
- [ ] Datos sensibles protegidos (no en logs)
- [ ] Funcionalidad depurada 100%
- [ ] Documentación actualizada
- [ ] README.md de CobraCheck listo

---

## ✅ DIFERENCIA: GastoCheck vs CobraCheck

```
GastoCheck (Iteraciones):
├─ Lanzar
├─ Bug: OCR falla en fotos oscuras
├─ Fix + OTA 1
├─ Bug: Categorización incorrecta
├─ Fix + OTA 2
├─ Bug: Exportación Excel rota
├─ Fix + OTA 3
└─ Frustración

CobraCheck (Depurado):
├─ Auditar TODO antes de lanzar
├─ Fijar bugs encontrados
├─ Testear exhaustivamente
├─ Lanzar LIMPIO
└─ Satisfacción ✅
```

---

**Meta:** CobraCheck sale al mercado SIN bugs conocidos.

**Tiempo inversión:** 2-3 horas de QA riguroso = 0 iteraciones futuras.

**Vale mucho la pena.**
