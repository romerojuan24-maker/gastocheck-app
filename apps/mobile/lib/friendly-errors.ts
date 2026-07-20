// Traduce errores técnicos de Supabase a mensajes entendibles para el usuario.
// Los errores de RLS ("new row violates row-level security policy...") son de
// backend y no le dicen nada al usuario final — aquí se convierten en un
// mensaje de permisos claro.

export function friendlyError(e: any, accion = 'realizar esta acción'): string {
  const msg: string = e?.message ?? String(e ?? '');

  if (/row-level security|violates.*policy|permission denied|42501/i.test(msg)) {
    return `Tu perfil no tiene permiso para ${accion}. Pide al administrador de tu empresa que revise tu rol en Equipo.`;
  }
  if (/Failed to fetch|Network request failed|network/i.test(msg)) {
    return 'Sin conexión. Revisa tu internet e intenta de nuevo.';
  }
  if (/JWT|token|expired/i.test(msg)) {
    return 'Tu sesión expiró. Cierra sesión y vuelve a entrar.';
  }
  return msg || 'Ocurrió un error inesperado.';
}
