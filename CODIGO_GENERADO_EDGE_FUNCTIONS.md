# 🔧 CÓDIGO GENERADO: Edge Functions (6 funciones)

**Ubicación:** `/supabase/functions/`
**Lenguaje:** TypeScript/Deno
**Propósito:** Backend automation para SAT, reconciliación y sincronización contable

---

## Edge Function 1: descargar-cfdi-sat

**Ubicación:** `/supabase/functions/descargar-cfdi-sat/index.ts`
**Propósito:** Descargar CFDIs recibidos del SAT automáticamente
**Trigger:** Diariamente a las 10 AM (cron) + Manual via API
**Entrada:** empresa_id
**Salida:** { descargados: number, validados: number, errores: string[] }

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2.43.4';
import { SAT } from 'https://deno.land/x/sat_api/mod.ts'; // Librería hipotética

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { empresa_id } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

  // 1. Obtener RFC y credenciales de empresa
  const { data: empresa, error: empresaError } = await supabase
    .from('empresas')
    .select('rfc, sat_username, sat_password')
    .eq('id', empresa_id)
    .single();

  if (empresaError) {
    return new Response(JSON.stringify({ error: 'Empresa no encontrada' }), { status: 400 });
  }

  try {
    // 2. Conectar a SAT (usando credenciales de empresa)
    const sat = new SAT({
      rfc: empresa.rfc,
      username: empresa.sat_username,
      password: empresa.sat_password,
    });

    // 3. Obtener CFDIs recibidos del último mes
    const hoy = new Date();
    const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const cfdisRecibidos = await sat.descargarCFDIsRecibidos({
      fechaInicio: hace30Dias.toISOString(),
      fechaFin: hoy.toISOString(),
      estado: 'VIGENTE',
    });

    // 4. Para cada CFDI: verificar si ya existe
    let descargados = 0;
    let validados = 0;
    const errores = [];

    for (const cfdi of cfdisRecibidos) {
      try {
        const { data: existe } = await supabase
          .from('cfdi_recibidos')
          .select('id')
          .eq('uuid', cfdi.uuid)
          .single();

        if (existe) {
          continue; // Ya existe, saltar
        }

        // 5. Insertar CFDI en BD
        const { error: insertError } = await supabase
          .from('cfdi_recibidos')
          .insert({
            empresa_id,
            uuid: cfdi.uuid,
            xml_content: cfdi.xmlContent,
            monto: parseFloat(cfdi.total),
            rfc_emisor: cfdi.rfcEmisor,
            nombre_emisor: cfdi.nombreEmisor,
            fecha_emision: cfdi.fechaEmision,
            concepto: cfdi.concepto,
            estado: 'RECIBIDO',
            descargado_en: new Date(),
          });

        if (insertError) {
          errores.push(`CFDI ${cfdi.uuid}: ${insertError.message}`);
          continue;
        }

        descargados++;

        // 6. Dispara: Validar CFDI contra compra
        // Esto se hace en otro edge function
      } catch (error) {
        errores.push(`Error procesando CFDI ${cfdi.uuid}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        descargados,
        validados,
        errores,
        mensaje: `Descargados ${descargados} CFDIs, ${validados} validados`,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error descargando CFDIs:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
```

---

## Edge Function 2: validar-cfdi-compra

**Ubicación:** `/supabase/functions/validar-cfdi-compra/index.ts`
**Propósito:** Validar CFDI contra compra registrada + auto-reconciliar si match
**Trigger:** Después de descargar CFDI (automático)
**Entrada:** cfdi_id, empresa_id
**Salida:** { estado: MATCH|NO_MATCH|ERROR, compra_id, alertas }

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2.43.4';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { cfdi_id, empresa_id } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

  try {
    // 1. Obtener CFDI
    const { data: cfdi, error: cfdiError } = await supabase
      .from('cfdi_recibidos')
      .select('*')
      .eq('id', cfdi_id)
      .single();

    if (cfdiError) {
      return new Response(JSON.stringify({ error: 'CFDI no encontrado' }), { status: 400 });
    }

    // 2. Buscar compra correspondiente
    // Criterios: RFC proveedor = RFC emisor, monto exacto, fecha ±2 días
    const { data: compra, error: compraError } = await supabase
      .from('gastos')
      .select('*')
      .eq('empresa_id', empresa_id)
      .eq('rfc_proveedor', cfdi.rfc_emisor)
      .eq('monto', cfdi.monto)
      .gte('fecha', new Date(cfdi.fecha_emision).getTime() - 2 * 24 * 60 * 60 * 1000)
      .lte('fecha', new Date(cfdi.fecha_emision).getTime() + 2 * 24 * 60 * 60 * 1000)
      .single();

    if (compraError) {
      // NO ENCONTRÓ COMPRA
      return new Response(
        JSON.stringify({
          estado: 'NO_MATCH',
          mensaje: 'No hay compra registrada que coincida con este CFDI',
          cfdi_id,
          alertas: ['RFC no coincide', 'Monto no coincide', 'Fecha no coincide'],
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. ENCONTRÓ COMPRA - Validar datos
    const monto_coincide = Math.abs(compra.monto - cfdi.monto) < 0.01;
    const fecha_diff = Math.abs(
      new Date(compra.fecha).getTime() - new Date(cfdi.fecha_emision).getTime()
    ) / (1000 * 60 * 60 * 24);
    const fecha_coincide = fecha_diff <= 2;
    const rfc_coincide = compra.rfc_proveedor === cfdi.rfc_emisor;

    // Calcular confianza
    let confianza = 0;
    if (monto_coincide) confianza += 40;
    if (fecha_coincide) confianza += 35;
    if (rfc_coincide) confianza += 25;

    // 4. Actualizar CFDI con resultado
    const { error: updateError } = await supabase
      .from('cfdi_recibidos')
      .update({
        compra_id: compra.id,
        estado: confianza >= 95 ? 'VALIDADO' : 'PARCIAL',
        monto_coincide,
        fecha_coincide,
        rfc_coincide,
        confianza_match: confianza,
        validado: confianza >= 95,
      })
      .eq('id', cfdi_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
    }

    return new Response(
      JSON.stringify({
        estado: confianza >= 95 ? 'MATCH' : 'PARCIAL',
        compra_id: compra.id,
        confianza,
        monto_coincide,
        fecha_coincide,
        rfc_coincide,
        mensaje: `CFDI validado con confianza ${confianza}%`,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error validando CFDI:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
```

---

## Edge Function 3: confirmar-compra-cfdi

**Ubicación:** `/supabase/functions/confirmar-compra-cfdi/index.ts`
**Propósito:** Confirmar compra (pasar a CONFIRMADA) cuando CFDI válido + buscar pago en banco
**Trigger:** Automático cuando CFDI validado
**Entrada:** compra_id, cfdi_id
**Salida:** { estado: CONFIRMADA, póliza_id, movimiento_banco_id }

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2.43.4';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { compra_id, cfdi_id } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

  try {
    // 1. Obtener compra y CFDI
    const { data: compra } = await supabase
      .from('gastos')
      .select('*')
      .eq('id', compra_id)
      .single();

    const { data: cfdi } = await supabase
      .from('cfdi_recibidos')
      .select('*')
      .eq('id', cfdi_id)
      .single();

    // 2. Actualizar compra a CONFIRMADA
    const { error: updateError } = await supabase
      .from('gastos')
      .update({
        estado_compra: 'CONFIRMADA',
        cfdi_recibido_id: cfdi_id,
        cfdi_uuid: cfdi.uuid,
      })
      .eq('id', compra_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
    }

    // 3. Actualizar movimiento financiero
    const { error: movUpdateError } = await supabase
      .from('movimientos_financieros')
      .update({
        cfdi_recibido_id: cfdi_id,
        estado_contable: 'CFDI_VALIDADO',
        validado_por_sat: true,
        fecha_última_sync: new Date(),
      })
      .eq('gasto_id', compra_id);

    if (movUpdateError) {
      return new Response(JSON.stringify({ error: movUpdateError.message }), { status: 500 });
    }

    // 4. Actualizar póliza con CFDI UUID
    const { error: polizaError } = await supabase
      .from('polizas')
      .update({
        cfdi_uuid: cfdi.uuid,
        validada_por_cfdi: true,
      })
      .eq('gasto_id', compra_id);

    if (polizaError) {
      return new Response(JSON.stringify({ error: polizaError.message }), { status: 500 });
    }

    // 5. AUTOMÁTICAMENTE: Buscar pago en banco
    // Llamar edge function reconciliar-egreso-banco
    const reconcileResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/reconciliar-egreso-banco`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          compra_id,
          monto: compra.monto,
          proveedor_rfc: compra.rfc_proveedor,
          fecha: compra.fecha,
          empresa_id: compra.empresa_id,
        }),
      }
    );

    const reconcileResult = await reconcileResponse.json();

    return new Response(
      JSON.stringify({
        estado: 'CONFIRMADA',
        compra_id,
        cfdi_id,
        reconciliacion: reconcileResult,
        mensaje: 'Compra confirmada + busca pago en banco iniciada',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error confirmando compra:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
```

---

## Edge Function 4: reconciliar-ingreso-banco

**Ubicación:** `/supabase/functions/reconciliar-ingreso-banco/index.ts`
**Propósito:** Auto-buscar movimiento bancario para ingreso/cobro
**Trigger:** Automático cuando se registra cobro
**Entrada:** cobro_id, monto, cliente_rfc, fecha, empresa_id
**Salida:** { movimiento_encontrado: true|false, movimiento_id, confianza }

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2.43.4';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { cobro_id, monto, cliente_rfc, fecha, empresa_id } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

  try {
    // 1. Buscar movimiento en banco
    // Criterios: monto exacto/aproximado, fecha ±2 días, tipo INGRESO
    const fechaBase = new Date(fecha);
    const hace2dias = new Date(fechaBase.getTime() - 2 * 24 * 60 * 60 * 1000);
    const mas2dias = new Date(fechaBase.getTime() + 2 * 24 * 60 * 60 * 1000);

    const { data: movimientos } = await supabase
      .from('banco_movimientos')
      .select('*')
      .eq('empresa_id', empresa_id)
      .eq('tipo', 'INGRESO')
      .gte('fecha', hace2dias.toISOString())
      .lte('fecha', mas2dias.toISOString())
      .gte('monto', monto * 0.98) // Tolerancia: ±2%
      .lte('monto', monto * 1.02);

    if (!movimientos || movimientos.length === 0) {
      // NO ENCONTRÓ MOVIMIENTO
      return new Response(
        JSON.stringify({
          movimiento_encontrado: false,
          cobro_id,
          mensaje: 'No hay movimiento bancario que coincida',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Si encontró múltiples, elegir el más probable
    const movimiento = movimientos[0]; // TODO: Mejorar lógica de selección

    // 3. Crear reconciliación
    const { data: reconciliacion, error: reconciliarError } = await supabase
      .from('reconciliaciones')
      .insert({
        empresa_id,
        movimiento_bancario_id: movimiento.id,
        cobro_id,
        tipo: 'INGRESO',
        monto,
        fecha_movimiento: movimiento.fecha,
        fecha_registro: fecha,
        criterios_match: ['MONTO', 'FECHA'],
        confianza: 90,
        estado: 'AUTOMÁTICO',
        reconciliado: true,
        reconciliado_en: new Date(),
      })
      .select('id')
      .single();

    if (reconciliarError) {
      return new Response(JSON.stringify({ error: reconciliarError.message }), { status: 500 });
    }

    // 4. Actualizar cobro
    await supabase
      .from('cobros')
      .update({
        movimiento_banco_id: movimiento.id,
        estado: 'PAGADO',
        reconciliacion_id: reconciliacion.id,
      })
      .eq('id', cobro_id);

    // 5. Actualizar movimiento financiero
    await supabase
      .from('movimientos_financieros')
      .update({
        reconciliacion_id: reconciliacion.id,
        estado_pago: 'PAGADO',
        validado_por_banco: true,
        fecha_última_sync: new Date(),
      })
      .eq('cobro_id', cobro_id);

    return new Response(
      JSON.stringify({
        movimiento_encontrado: true,
        movimiento_id: movimiento.id,
        cobro_id,
        confianza: 90,
        mensaje: 'Ingreso reconciliado automáticamente',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error reconciliando ingreso:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
```

---

## Edge Function 5: reconciliar-egreso-banco

**Similar a Function 4, pero para egresos (compras)**

```typescript
// Mismo código que Function 4, pero:
// - tipo: 'EGRESO'
// - Busca en gastos en lugar de cobros
// - proveedor_rfc en lugar de cliente_rfc
```

---

## Edge Function 6: orquestador-sync-contable

**Ubicación:** `/supabase/functions/orquestador-sync-contable/index.ts`
**Propósito:** Orquestador central de sincronización contable
**Trigger:** Cualquier cambio relevante (triggers en BD)
**Entrada:** tipo_cambio, origen_id, datos
**Salida:** { póliza_actualizada, movimiento_actualizado, estado }

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2.43.4';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { tipo_cambio, origen_id, empresa_id, datos } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

  try {
    let resultado = {};

    switch (tipo_cambio) {
      case 'COMPRA_REGISTRADA':
        // Crear póliza + buscar CFDI
        resultado = await procesarCompraRegistrada(supabase, origen_id, empresa_id);
        break;

      case 'CFDI_VALIDADO':
        // Confirmar compra + buscar pago en banco
        resultado = await procesarCFDIValidado(supabase, origen_id, empresa_id);
        break;

      case 'COBRO_REGISTRADO':
        // Crear póliza + buscar pago en banco
        resultado = await procesarCobroRegistrado(supabase, origen_id, empresa_id);
        break;

      case 'PAGO_EN_BANCO':
        // Buscar compra/cobro relacionado + reconciliar
        resultado = await procesarPagoEnBanco(supabase, origen_id, empresa_id);
        break;

      case 'RECONCILIACION_VALIDADA':
        // Actualizar pólizas + movimientos
        resultado = await procesarReconciliacionValidada(supabase, origen_id, empresa_id);
        break;

      default:
        return new Response(JSON.stringify({ error: 'Tipo de cambio desconocido' }), {
          status: 400,
        });
    }

    return new Response(JSON.stringify(resultado), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error en orquestador:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});

async function procesarCompraRegistrada(supabase, origen_id, empresa_id) {
  // Lógica para cuando se registra compra
  // Crear póliza automática
  // Buscar CFDI pendiente
  return { status: 'ok' };
}

// ... otras funciones
```

---

## Resumen de Edge Functions

| # | Nombre | Propósito | Trigger |
|---|--------|-----------|---------|
| 1 | descargar-cfdi-sat | Descarga CFDIs del SAT | Cron diario + Manual |
| 2 | validar-cfdi-compra | Valida CFDI vs compra | Automático post-descarga |
| 3 | confirmar-compra-cfdi | Confirma compra + busca pago | Automático post-validación |
| 4 | reconciliar-ingreso-banco | Auto-busca pago de ingreso | Automático post-cobro |
| 5 | reconciliar-egreso-banco | Auto-busca pago de egreso | Automático post-compra |
| 6 | orquestador-sync-contable | Coordinador central | Triggers de cambios |

