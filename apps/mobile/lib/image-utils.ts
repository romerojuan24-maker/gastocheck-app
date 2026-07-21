// Utilidades de imagen con expo-image-manipulator OPCIONAL.
//
// El APK instalado (runtime 0.1.72) NO incluye el módulo nativo
// ExpoImageManipulator — se agregó a package.json después de ese build.
// El require() se hace dentro de try/catch: en el APK viejo lanza al
// registrar el módulo nativo y queda null (fallback sin romper nada);
// en el próximo APK funcionará automáticamente sin cambios de código.

let Manipulator: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Manipulator = require('expo-image-manipulator');
  if (!Manipulator?.manipulateAsync) Manipulator = null;
} catch {
  Manipulator = null;
}

export function imageToolsAvailable(): boolean {
  return Manipulator != null;
}

/** Reduce resolución/peso para subir más rápido. Devuelve la uri original si no hay soporte. */
export async function compressForUpload(uri: string): Promise<{ uri: string; changed: boolean }> {
  if (!Manipulator) return { uri, changed: false };
  try {
    const r = await Manipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.7, format: Manipulator.SaveFormat.JPEG },
    );
    return { uri: r.uri, changed: true };
  } catch {
    return { uri, changed: false };
  }
}

/** Rota la imagen 90° y devuelve la nueva uri, o null si no hay soporte nativo. */
export async function rotateImage90(uri: string): Promise<string | null> {
  if (!Manipulator) return null;
  try {
    const r = await Manipulator.manipulateAsync(
      uri,
      [{ rotate: 90 }],
      { compress: 0.9, format: Manipulator.SaveFormat.JPEG },
    );
    return r.uri;
  } catch {
    return null;
  }
}
