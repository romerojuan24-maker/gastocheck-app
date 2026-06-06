import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// El cliente es opcional en demo: si no hay credenciales, devolvemos null y la
// UI cae a datos de ejemplo. En producción configura el .env.
export const supabase = url && anon ? createClient(url, anon) : null;
