// Conectar cuenta bancaria con Plaid
// POST /api/bancos/conectar

import { createClient } from 'jsr:@supabase/supabase-js@2.43.4';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { empresa_id, public_token, metadata } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Intercambiar public_token por access_token (en producción, llamar a Plaid)
    // Por ahora, guardar metadata y public_token
    const { data: cuenta, error } = await supabase
      .from('banco_cuentas')
      .insert({
        empresa_id,
        nombre: metadata?.account?.name || 'Nueva cuenta',
        numero_cuenta: metadata?.account?.id || '',
        tipo_cuenta: metadata?.account?.type || 'CHEQUES',
        banco_codigo: metadata?.institution?.institution_id || '000',
        banco_nombre: metadata?.institution?.name || 'Desconocido',
        plaid_item_id: public_token,
        plaid_access_token: public_token, // En producción, intercambiar token
        plaid_account_id: metadata?.account?.id || '',
        activo: true,
        saldo_actual: 0,
      })
      .select('id')
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error }), { status: 500 });
    }

    // Sincronizar movimientos iniciales (últimos 90 días)
    // Por ahora, solo crear cuenta vacía
    // La sincronización ocurre en sync-bank-accounts

    return new Response(
      JSON.stringify({
        success: true,
        banco_cuenta_id: cuenta.id,
        message: 'Cuenta bancaria conectada. Sincronizando movimientos...',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
