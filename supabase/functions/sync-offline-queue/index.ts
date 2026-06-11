// sync-offline-queue — Procesa cola de sincronización offline
// Llamada cuando user reconecta o cada N minutos
// Input: { user_id }
// Output: { synced_count, failed_count, errors }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

interface SyncInput {
  user_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    const input: SyncInput = await req.json();
    const { user_id } = input;

    // Obtener pending items
    const { data: pending } = await supabase
      .from('sync_queue')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (!pending || pending.length === 0) {
      return Response.json({ ok: true, synced_count: 0, failed_count: 0 }, { headers: CORS });
    }

    let synced = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const item of pending) {
      try {
        // Marcar como syncing
        await supabase
          .from('sync_queue')
          .update({ status: 'syncing' })
          .eq('id', item.id);

        // Ejecutar operación según entity_type
        // Por ahora: mock. En producción, ejecutar la operación real
        if (item.entity_type === 'receipt') {
          // Llamar submit-receipt con payload
          // const res = await fetch(...)
        }

        // Marcar como synced
        await supabase
          .from('sync_queue')
          .update({ status: 'synced', synced_at: new Date().toISOString() })
          .eq('id', item.id);

        synced++;
      } catch (err: any) {
        failed++;
        errors.push({ id: item.id, error: err.message });
        await supabase
          .from('sync_queue')
          .update({ status: 'failed', error_message: err.message })
          .eq('id', item.id);
      }
    }

    return Response.json(
      { ok: true, synced_count: synced, failed_count: failed, errors },
      { headers: CORS },
    );
  } catch (err: any) {
    console.error('sync-offline-queue error:', err);
    return Response.json({ error: err.message }, { status: 500, headers: CORS });
  }
});
