// Resuelve la membresía ACTIVA del usuario en la empresa SELECCIONADA.
// Antes, ~20 pantallas hacían:
//   supabase.from('company_members').select('role, company_id')
//     .eq('user_id', user.id).eq('status','active').maybeSingle()  // o .single()
// Sin filtrar por company_id, esto se rompe en cuanto el usuario pertenece
// a MÁS de una empresa: .single() lanza error, .maybeSingle() devuelve null
// (varias filas coinciden) — el rol cae a "employee"/null y la empresa a
// "Sin empresa", aunque el usuario sí sea admin de la empresa que tiene
// seleccionada. Toda pantalla que necesite "mi rol en la empresa actual"
// debe usar esta función en vez de repetir la consulta.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export interface ActiveMembership {
  company_id: string;
  role: string;
}

export async function getActiveMembership(userId: string): Promise<ActiveMembership | null> {
  const { data: memberships } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (!memberships || memberships.length === 0) return null;

  const selectedId = await AsyncStorage.getItem('selectedCompanyId');
  let member = selectedId ? memberships.find((m) => m.company_id === selectedId) : undefined;

  if (!member) {
    // Sin selección guardada, o ya no es válida para este usuario —
    // usar la primera membresía y persistirla.
    member = memberships[0];
    await AsyncStorage.setItem('selectedCompanyId', member.company_id);
  }

  return member;
}
