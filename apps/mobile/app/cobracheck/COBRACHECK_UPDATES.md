# CobraCheck - Actualización Completa

## 📋 Resumen de Cambios

Se han implementado todos los cambios solicitados en el módulo CobraCheck según el diagrama proporcionado. El módulo ahora tiene una estructura con 4 botones principales y funcionalidades mejoradas de captura, validación y integración.

---

## 🎯 Nuevas Características

### 1. **Dashboard Reestructurado con 4 Botones Principales**

#### CARTERA TOTAL 💰
- Muestra el saldo total a cobrar
- Acceso a lista de facturas pendientes, parciales y vencidas
- Código de colores por estado de la factura
- Botón CFDI Check para cada factura

#### COMPROBANTES 📄
- Relación de todas las facturas
- Filtros por estado (Pendientes, Parciales, Pagadas, Vencidas, Canceladas)
- Indicador visual de facturas con comprobante fotográfico
- Alertas para facturas pagadas sin foto

#### TAREAS DE HOY 📋
- Mi Ruta de Cobranza del día
- Prioridad de la ruta
- Lista ordenada de clientes a visitar
- Saldos y riesgos por cliente
- Status de avance (Planeada, En Progreso, Completada)

#### PAGOS 💳
- Registro de pagos con captura obligatoria de fotos
- Validación: Si el monto pagado ≠ saldo esperado → FOTO REQUERIDA
- Relación de clientes con movimientos y saldos
- Notificaciones en ROJO para saldos vencidos
- Métodos de pago: Efectivo, Transferencia, Cheque, Tarjeta

---

## 📸 Captura Obligatoria de Comprobantes

### Lógica Implementada:

```
SI (monto_cobrado ≠ saldo_esperado) ENTONCES
  - Mostrar advertencia en ROJO
  - Exigir captura de foto del comprobante
  - Guardar foto como evidencia
  - Registrar en tabla cobra_movements con photo_uri
FIN SI
```

### Tipos de Captura:
- 📷 Tomar foto con cámara
- 🖼️ Seleccionar de galería

---

## 🔴 Notificaciones en Rojo para Clientes en Riesgo

### En el Dashboard:
- Sección dedicada a clientes con risk_score ≥ 70
- Cards con fondo rojo indicando estado crítico
- Saldo pendiente resaltado en rojo
- Acceso rápido para seleccionar cliente

### En Pagos:
- Vista de clientes en riesgo en scroll horizontal al tope
- Selección rápida de clientes problemáticos
- Visualización de monto vencido

### Criterios de Riesgo:
- 🔴 Riesgo Alto: risk_score ≥ 80
- 🟠 Riesgo Medio: risk_score ≥ 60
- 🟢 Riesgo Bajo: risk_score < 60

---

## 📊 Integración con Contador y Flujo Check

### Cuando se registra un pago:

1. **En tabla cobra_movements:**
   - Se guarda el movimiento con type = 'collected'
   - Se incluye photo_uri si existe comprobante
   - Se registra collected_amount y amount_original para validación

2. **En tabla contador_movements (si monto diferente):**
   - Se crea registro con source_module = 'cobracheck'
   - Se guarda reference_photo para auditoría
   - Se documenta la diferencia en description
   - Tipo de movimiento: 'income'

3. **Sincronización:**
   - Automática después de registrar el pago
   - Los módulos de Contador y Flujo Check consultan cobra_movements
   - Actualización en tiempo real

---

## 📁 Archivos Creados/Modificados

### Nuevos Archivos (Mobile):
- `apps/mobile/app/cobracheck/cartera-total.tsx` - Página de cartera
- `apps/mobile/app/cobracheck/comprobantes.tsx` - Página de facturas
- `apps/mobile/app/cobracheck/tareas-de-hoy.tsx` - Página de ruta diaria
- `apps/mobile/app/cobracheck/pagos.tsx` - Página de pagos con captura

### Archivos Modificados:
- `apps/mobile/app/cobracheck/page.tsx` - Dashboard principal
- `apps/web/app/(dashboard)/cobracheck/page.tsx` - Web dashboard

---

## 🔧 Dependencias Utilizadas

- `expo-image-picker` - Captura y selección de fotos
- `supabase` - Backend y almacenamiento
- React Native (Mobile)
- Next.js (Web)

---

## ✅ Flujo Completo de Uso

### Como Cobrador (Mobile):
1. Abro CobraCheck
2. Selecciono "PAGOS"
3. Elijo cliente (o selecciono de sección roja si está en riesgo)
4. Ingreso monto cobrado
5. SI monto ≠ saldo esperado:
   - Aparece advertencia roja
   - Sistema exige captura de foto
   - Tomo foto con cámara o selecciono de galería
6. Selecciono método de pago
7. Agrego notas si es necesario
8. Registro el pago ✓
9. El movimiento se sincroniza automáticamente a Contador y Flujo Check

### Como Supervisor/Admin (Web):
1. Accedo a CobraCheck
2. Veo los 4 botones principales
3. Hago clic en "CARTERA TOTAL" para ver todas las facturas
4. Filtro y reviso estado de cobranza
5. Veo clientes en riesgo resaltados en rojo
6. Consulto historial de pagos con fotos como evidencia

---

## 🚀 Siguientes Pasos Sugeridos

1. Configurar permisos de cámara en app.json (Expo)
2. Verificar políticas de almacenamiento en Supabase Storage
3. Crear rutas de carga de fotos optimizadas
4. Agregar sincronización de estado offline
5. Implementar notificaciones push para clientes en riesgo

---

## 📞 Soporte

Para consultas o ajustes adicionales, los cambios fueron implementados completamente en una sola actualización integrada.
