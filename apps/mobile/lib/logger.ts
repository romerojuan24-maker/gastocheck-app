// Logger de diagnóstico — captura console.log/warn/error en un buffer en memoria
// y permite exportarlo a un archivo de texto (nombre por fecha) + compartir.
//
// logError() y logWarn() también escriben a Supabase (diagnostic_logs) para
// visibilidad remota sin necesidad de que el usuario reenvíe archivos.
//
// IMPORTANTE: usa el Share nativo de React Native (no expo-sharing), porque
// un OTA no puede agregar módulos nativos nuevos al APK ya instalado.
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Share } from 'react-native';
import { APP_VERSION } from '@gastocheck/shared';
import { supabase } from './supabase';

const MAX_LINES = 3000;
const buffer: string[] = [];
let installed = false;
let currentScreen = 'unknown';

/** Actualiza la pantalla activa — se llama desde _layout.tsx en cada cambio de ruta. */
export function setCurrentScreen(pathname: string) {
  currentScreen = pathname || 'unknown';
}

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

// Escribe a Supabase de forma fire-and-forget; nunca lanza excepciones.
async function logRemote(tag: string, level: string, message: string, metadata?: Record<string, unknown>) {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data?.session?.user?.id;
    if (!userId) return;
    await supabase.from('diagnostic_logs').insert({
      user_id: userId,
      tag,
      message,
      level,
      metadata: { screen: currentScreen, platform: Platform.OS, ...(metadata ?? {}) },
    });
  } catch {
    // El logger nunca debe crashear la app
  }
}

const SENSITIVE_KEY_RE = /token|password|secret|apikey|api_key|authorization|jwt|clabe|csd|cert|private_key/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[...]';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY_RE.test(k) ? '[REDACTED]' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

// Objetos completos (respuestas de API, filas de tablas sensibles, sesiones)
// no deben terminar sin filtrar en diagnostic_logs solo porque alguien hizo
// console.error('x falló:', objeto) en vez de objeto.message. Se redactan
// llaves sensibles y se trunca el tamaño total como defensa en profundidad.
function argsToMessage(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      try {
        const json = JSON.stringify(redact(a));
        return json.length > 1000 ? `${json.slice(0, 1000)}…[truncated]` : json;
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

/**
 * Monkeypatch console para duplicar la salida al buffer local Y, para
 * warn/error, enviar automáticamente a Supabase (diagnostic_logs) sin
 * necesitar que cada catch{} llame logError()/logWarn() manualmente.
 * Idempotente.
 */
export function initLogger() {
  if (installed) return;
  installed = true;

  const orig = {
    log:   console.log.bind(console),
    warn:  console.warn.bind(console),
    error: console.error.bind(console),
  };

  console.log = (...args: unknown[]) => { push('LOG', args); orig.log(...args); };
  console.warn = (...args: unknown[]) => {
    push('WARN', args);
    orig.warn(...args);
    logRemote('console', 'warn', argsToMessage(args));
  };
  console.error = (...args: unknown[]) => {
    push('ERROR', args);
    orig.error(...args);
    logRemote('console', 'error', argsToMessage(args));
  };

  // Errores fuera del árbol de React (timers, listeners, promesas sin
  // .catch, event handlers) — el ErrorBoundary de React NO los captura.
  const g: any = global as any;
  if (g.ErrorUtils?.setGlobalHandler) {
    const prevHandler = g.ErrorUtils.getGlobalHandler?.();
    g.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      push('ERROR', [`[GLOBAL${isFatal ? ' FATAL' : ''}] ${error.name}: ${error.message}`]);
      logRemote('global_error', 'error', `${error.name}: ${error.message}`, {
        fatal: !!isFatal,
        stack: error.stack?.slice(0, 2000),
      });
      prevHandler?.(error, isFatal);
    });
  }

  const globalAny: any = global as any;
  if (globalAny.HermesInternal || typeof globalAny.Promise !== 'undefined') {
    const onUnhandledRejection = (event: any) => {
      const reason = event?.reason ?? event;
      const message = reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason);
      push('ERROR', [`[UNHANDLED PROMISE] ${message}`]);
      logRemote('unhandled_rejection', 'error', message);
    };
    // React Native no dispara 'unhandledrejection' del DOM, pero algunos
    // polyfills (promise/setimmediate) sí exponen este listener global.
    if (typeof globalAny.addEventListener === 'function') {
      globalAny.addEventListener('unhandledrejection', onUnhandledRejection);
    }
  }

  buffer.push(`${ts()} [INIT] logger iniciado · ${APP_VERSION} · ${Platform.OS}`);
}

/** Registra una línea manual (local únicamente — para eventos informativos). */
export function logEvent(tag: string, ...args: unknown[]) {
  push(tag, args);
}

/** Registra un aviso + lo envía a Supabase diagnostic_logs. */
export function logWarn(tag: string, message: string, metadata?: Record<string, unknown>) {
  push('WARN', [message]);
  logRemote(tag, 'warn', message, metadata);
}

/** Registra un error + lo envía a Supabase diagnostic_logs. */
export function logError(tag: string, message: string, metadata?: Record<string, unknown>) {
  push('ERROR', [message]);
  logRemote(tag, 'error', message, metadata);
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

  await FileSystem.writeAsStringAsync(fileUri, contents, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Share.share({
    title:   fileName,
    message: contents,
  });

  return fileUri;
}

export function getLogLineCount(): number {
  return buffer.length;
}
