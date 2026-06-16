import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(url, anon, {
  auth: {
    // En React Native el adaptador de almacenamiento es obligatorio para que
    // la sesión persista y autoRefreshToken funcione. Sin esto, el token
    // expira (~1h) y las peticiones salen como anon → auth.uid() NULL → RLS falla.
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
