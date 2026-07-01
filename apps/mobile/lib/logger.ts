// Logger de diagnóstico — captura console.log/warn/error en un buffer en memoria
// y permite exportarlo a un archivo de texto (nombre por fecha) + compartir.
//
// IMPORTANTE: usa el Share nativo de React Native (no expo-sharing), porque
// un OTA no puede agregar módulos nativos nuevos al APK ya instalado.
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Share } from 'react-native';
import { APP_VERSION } from '@gastocheck/shared';

const MAX_LINES = 3000;
const buffer: string[] = [];
let installed = false;

function ts(): string {
  return new Date().toISOString();
}

function push(level: string, args: unknown[]) {
  const text = args
    .map((a) => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    })
    .join(' ');
  buffer.push(`${ts()} [${level}] ${text}`);
  if (buffer.length > MAX_LINES) buffer.splice(0, buffer.length - MAX_LINES);
}

/** Monkeypatch console para duplicar la salida al buffer. Idempotente. */
export function initLogger() {
  if (installed) return;
  installed = true;

  const orig = {
    log:   console.log.bind(console),
    warn:  console.warn.bind(console),
    error: console.error.bind(console),
  };

  console.log = (...args: unknown[]) => { push('LOG', args); orig.log(...args); };
  console.warn = (...args: unknown[]) => { push('WARN', args); orig.warn(...args); };
  console.error = (...args: unknown[]) => { push('ERROR', args); orig.error(...args); };

  buffer.push(`${ts()} [INIT] logger iniciado · ${APP_VERSION} · ${Platform.OS}`);
}

/** Registra una línea manual (útil para marcar acciones del usuario). */
export function logEvent(tag: string, ...args: unknown[]) {
  push(tag, args);
}

function buildContents(extra?: Record<string, unknown>): string {
  const header = [
    '=== GASTOCHECK · LOG DE DIAGNOSTICO ===',
    `Generado: ${ts()}`,
    `Version: ${APP_VERSION}`,
    `Plataforma: ${Platform.OS} ${Platform.Version}`,
    extra ? `Contexto: ${JSON.stringify(extra)}` : '',
    `Lineas: ${buffer.length}`,
    '========================================',
    '',
  ].filter(Boolean).join('\n');
  return header + buffer.join('\n') + '\n';
}

/**
 * Escribe el buffer a un archivo gastocheck-log-YYYY-MM-DD.txt en el
 * almacenamiento privado de la app y abre el diálogo de compartir (Share nativo)
 * con el contenido como texto, para poder enviarlo por WhatsApp/correo.
 * Devuelve el URI del archivo generado.
 */
export async function exportLogs(extra?: Record<string, unknown>): Promise<string> {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const fileName = `gastocheck-log-${date}.txt`;
  const fileUri = `${FileSystem.documentDirectory}${fileName}`;
  const contents = buildContents(extra);

  // 1. Guardar archivo (registro en el dispositivo)
  await FileSystem.writeAsStringAsync(fileUri, contents, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  // 2. Compartir el contenido como texto (Share nativo — siempre disponible)
  await Share.share({
    title:   fileName,
    message: contents,
  });

  return fileUri;
}

export function getLogLineCount(): number {
  return buffer.length;
}
