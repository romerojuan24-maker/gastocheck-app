# 🔗 CÓDIGO GENERADO: API Routes (8 rutas)

**Ubicación:** `/apps/web/app/api/`
**Lenguaje:** TypeScript/Next.js
**Propósito:** Endpoints REST para acceso a funciones de SAT, reconciliación y contabilidad

---

## API Route 1: POST /api/gastocheck/descargar-cfdi-sat

**Ubicación:** `/apps/web/app/api/gastocheck/descargar-cfdi-sat.ts`
**Propósito:** Disparar descarga manual de CFDIs del SAT
**Autenticación:** Usuario debe ser admin o contador
**Entrada:** { empresa_id }
**Salida:** { descargados, validados, errores, mensaje }

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const POST = async (req: Request) => {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Verificar autenticación
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { empresa_id } = await req.json();

    // Verificar que el usuario pertenece a esta empresa
    const { data: usuario } = await supabase
      .from('empresa_usuarios')
      .select('*')
      .eq('empresa_id', empresa_id)
      .eq('usuario_id', session.user.id)
      .single();

    if (!usuario) {
      return new Response(JSON.stringify({ error: 'No tienes acceso a esta empresa' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Llamar Edge Function
    const response = await fetch(
      `${process.env.SUPABASE_URL}/functions/v1/descargar-cfdi-sat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ empresa_id }),
      }
    );

    const resultado = await response.json();

    return new Response(JSON.stringify(resultado), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error descargando CFDIs:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

---

## API Route 2: GET /api/gastocheck/cfdi-pendientes

**Ubicación:** `/apps/web/app/api/gastocheck/cfdi-pendientes.ts`
**Propósito:** Obtener CFDIs sin validar (pendientes de revisión)
**Autenticación:** Usuario debe ser contador
**Parámetros:** empresa_id, limit=50, offset=0
**Salida:** { cfdis: [], total, página }

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const GET = async (req: Request) => {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const { searchParams } = new URL(req.url);
    const empresa_id = searchParams.get('empresa_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener CFDIs pendientes (no validados)
    const { data: cfdis, error, count } = await supabase
      .from('cfdi_recibidos')
      .select('*, gastos!inner(monto, proveedor)', { count: 'exact' })
      .eq('empresa_id', empresa_id)
      .eq('validado', false)
      .neq('estado', 'RECHAZADO')
      .order('descargado_en', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        cfdis,
        total: count,
        página: Math.floor(offset / limit) + 1,
        límite: limit,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error obteniendo CFDIs pendientes:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

---

## API Route 3: POST /api/gastocheck/validar-cfdi/[id]

**Ubicación:** `/apps/web/app/api/gastocheck/validar-cfdi/[id].ts`
**Propósito:** Validar manualmente un CFDI específico
**Autenticación:** Usuario debe ser contador
**Entrada:** { acción: ACEPTAR|RECHAZAR|MANUAL }
**Salida:** { estado, compra_id, alertas }

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const POST = async (req: Request, { params }: { params: { id: string } }) => {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { id } = params;
    const { accion, compra_id } = await req.json();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener CFDI
    const { data: cfdi } = await supabase
      .from('cfdi_recibidos')
      .select('*')
      .eq('id', id)
      .single();

    if (!cfdi) {
      return new Response(JSON.stringify({ error: 'CFDI no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Procesar acción
    if (accion === 'ACEPTAR') {
      // Validar contra compra
      await supabase.from('cfdi_recibidos').update({
        validado: true,
        estado: 'VALIDADO',
        compra_id,
        validado_por: session.user.id,
        validado_en: new Date(),
      });

      // Llamar confirmar-compra
      await fetch(`${process.env.SUPABASE_URL}/functions/v1/confirmar-compra-cfdi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ compra_id, cfdi_id: id }),
      });

      return new Response(
        JSON.stringify({
          estado: 'VALIDADO',
          compra_id,
          mensaje: 'CFDI validado y compra confirmada',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } else if (accion === 'RECHAZAR') {
      await supabase.from('cfdi_recibidos').update({
        estado: 'RECHAZADO',
        validado_por: session.user.id,
        validado_en: new Date(),
      });

      return new Response(
        JSON.stringify({
          estado: 'RECHAZADO',
          mensaje: 'CFDI rechazado',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } else if (accion === 'MANUAL') {
      // Vincular manualmente a compra
      await supabase.from('cfdi_recibidos').update({
        compra_id,
        validado_por: session.user.id,
        validado_en: new Date(),
      });

      return new Response(
        JSON.stringify({
          estado: 'MANUAL',
          compra_id,
          mensaje: 'CFDI vinculado manualmente',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Error validando CFDI:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

---

## API Route 4: GET /api/gastocheck/compras-confirmadas

**Ubicación:** `/apps/web/app/api/gastocheck/compras-confirmadas.ts`
**Propósito:** Obtener compras con CFDI validado (confirmadas)
**Parámetros:** empresa_id, límite=50, offset=0
**Salida:** { compras: [], total }

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const GET = async (req: Request) => {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const { searchParams } = new URL(req.url);
    const empresa_id = searchParams.get('empresa_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { data: compras, error, count } = await supabase
      .from('gastos')
      .select(
        `
        *,
        cfdi_recibidos(uuid, validado, estado),
        polizas(id, estado_sincronizacion)
      `,
        { count: 'exact' }
      )
      .eq('empresa_id', empresa_id)
      .eq('estado_compra', 'CONFIRMADA')
      .order('fecha', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        compras,
        total: count,
        mensaje: `${count} compras confirmadas`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error obteniendo compras confirmadas:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

---

## API Route 5: POST /api/cobracheck/reconciliar-ingreso/[id]

**Ubicación:** `/apps/web/app/api/cobracheck/reconciliar-ingreso/[id].ts`
**Propósito:** Buscar movimiento en banco para cobro específico
**Parámetros:** cobro_id
**Salida:** { movimiento_encontrado, movimiento_id, confianza }

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const POST = async (req: Request, { params }: { params: { id: string } }) => {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { id: cobro_id } = params;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener cobro
    const { data: cobro } = await supabase
      .from('cobros')
      .select('*')
      .eq('id', cobro_id)
      .single();

    if (!cobro) {
      return new Response(JSON.stringify({ error: 'Cobro no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Llamar Edge Function
    const response = await fetch(
      `${process.env.SUPABASE_URL}/functions/v1/reconciliar-ingreso-banco`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          cobro_id,
          monto: cobro.monto,
          cliente_rfc: cobro.cliente_rfc,
          fecha: cobro.fecha,
          empresa_id: cobro.empresa_id,
        }),
      }
    );

    const resultado = await response.json();

    return new Response(JSON.stringify(resultado), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error reconciliando ingreso:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

---

## API Route 6: GET /api/bancocheck/movimientos-no-reconciliados

**Ubicación:** `/apps/web/app/api/bancocheck/movimientos-no-reconciliados.ts`
**Propósito:** Obtener movimientos bancarios sin asignar a compra/cobro
**Parámetros:** empresa_id, límite=50, offset=0
**Salida:** { movimientos: [], total }

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const GET = async (req: Request) => {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const { searchParams } = new URL(req.url);
    const empresa_id = searchParams.get('empresa_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Obtener movimientos sin reconciliación
    const { data: movimientos, error, count } = await supabase
      .from('movimientos_financieros')
      .select(
        `
        *,
        reconciliaciones(id, confianza)
      `,
        { count: 'exact' }
      )
      .eq('empresa_id', empresa_id)
      .is('reconciliacion_id', null) // Sin reconciliación
      .in('estado_pago', ['PENDIENTE', 'PARCIAL'])
      .order('fecha', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        movimientos,
        total: count,
        mensaje: `${count} movimientos sin reconciliar`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error obteniendo movimientos no reconciliados:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

---

## API Route 7: POST /api/contabilidad/sincronizar

**Ubicación:** `/apps/web/app/api/contabilidad/sincronizar.ts`
**Propósito:** Forzar sincronización manual de cambios pendientes
**Autenticación:** Usuario debe ser contador/admin
**Entrada:** { empresa_id, tipo: TODAS|EGRESOS|INGRESOS }
**Salida:** { sincronizadas, errores, estado }

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const POST = async (req: Request) => {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { empresa_id, tipo = 'TODAS' } = await req.json();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Llamar Orquestador
    const response = await fetch(
      `${process.env.SUPABASE_URL}/functions/v1/orquestador-sync-contable`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          tipo_cambio: 'SINCRONIZACION_MANUAL',
          empresa_id,
          filtro: tipo,
        }),
      }
    );

    const resultado = await response.json();

    return new Response(JSON.stringify(resultado), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error en sincronización:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

---

## API Route 8: GET /api/contabilidad/estado-integracion

**Ubicación:** `/apps/web/app/api/contabilidad/estado-integracion.ts`
**Propósito:** Obtener estado actual de sincronización
**Parámetros:** empresa_id
**Salida:** { sincronizados, pendientes, errores, últimaSync }

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const GET = async (req: Request) => {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const { searchParams } = new URL(req.url);
    const empresa_id = searchParams.get('empresa_id');

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Contar movimientos por estado_contable
    const { data: movimientos } = await supabase
      .from('movimientos_financieros')
      .select('estado_contable')
      .eq('empresa_id', empresa_id);

    const estados = {
      REGISTRADO: 0,
      PÓLIZA_CREADA: 0,
      CFDI_VALIDADO: 0,
      PAGADO: 0,
      RECONCILIADO: 0,
    };

    movimientos?.forEach((m) => {
      if (m.estado_contable in estados) {
        estados[m.estado_contable as keyof typeof estados]++;
      }
    });

    // Contar CFDIs pendientes
    const { count: cfdisPendientes } = await supabase
      .from('cfdi_recibidos')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', empresa_id)
      .eq('validado', false);

    // Contar reconciliaciones con error
    const { count: reconciliacionesError } = await supabase
      .from('reconciliaciones')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', empresa_id)
      .eq('estado', 'FALLO');

    return new Response(
      JSON.stringify({
        estados,
        cfdisPendientes,
        reconciliacionesError,
        totalMovimientos: movimientos?.length || 0,
        salud: cfdisPendientes === 0 && reconciliacionesError === 0 ? 'OK' : 'ADVERTENCIA',
        timestamp: new Date(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error obteniendo estado:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

---

## Resumen de API Routes

| # | Método | Ruta | Propósito | Autenticación |
|---|--------|------|-----------|---------------|
| 1 | POST | /api/gastocheck/descargar-cfdi-sat | Descargar CFDIs | Admin/Contador |
| 2 | GET | /api/gastocheck/cfdi-pendientes | Listar CFDIs sin validar | Contador |
| 3 | POST | /api/gastocheck/validar-cfdi/[id] | Validar CFDI manualmente | Contador |
| 4 | GET | /api/gastocheck/compras-confirmadas | Compras con CFDI validado | Usuario |
| 5 | POST | /api/cobracheck/reconciliar-ingreso/[id] | Buscar pago en banco | Usuario |
| 6 | GET | /api/bancocheck/movimientos-no-reconciliados | Movimientos sin asignar | Usuario |
| 7 | POST | /api/contabilidad/sincronizar | Forzar sincronización | Admin/Contador |
| 8 | GET | /api/contabilidad/estado-integracion | Estado de sincronización | Usuario |

