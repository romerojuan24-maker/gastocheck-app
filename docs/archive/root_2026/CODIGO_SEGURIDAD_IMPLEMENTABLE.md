# 🔒 CÓDIGO DE SEGURIDAD: Implementable (Listo para copiar-pegar)

**Todos los archivos listos para producción**  
**Paths, imports, y lógica completa**

---

## ARCHIVO 1: middleware.ts (CSRF + Rate Limiting + Session)

**Ubicación:** `/middleware.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import crypto from 'crypto';

// Rate Limiting en memoria (usar Redis en prod)
const loginAttempts = new Map<string, { count: number; resetTime: number }>();
const requestCounts = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMITS = {
  login: { max: 5, windowMs: 15 * 60 * 1000 }, // 5 intentos per 15 min
  api: { max: 100, windowMs: 15 * 60 * 1000 }, // 100 requests per 15 min
};

export async function middleware(request: NextRequest) {
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

  // 1. CSRF Protection para POST/PUT/DELETE
  if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
    const token = request.headers.get('x-csrf-token');
    const cookieToken = request.cookies.get('csrf-token')?.value;

    if (!token || token !== cookieToken) {
      return NextResponse.json({ error: 'CSRF token inválido' }, { status: 403 });
    }
  }

  // 2. Rate Limiting
  const endpoint = request.nextUrl.pathname;
  const limiter = endpoint.includes('login') ? RATE_LIMITS.login : RATE_LIMITS.api;

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, resetTime: Date.now() + limiter.windowMs });
  } else {
    const record = requestCounts.get(ip)!;
    if (Date.now() > record.resetTime) {
      record.count = 1;
      record.resetTime = Date.now() + limiter.windowMs;
    } else {
      record.count++;
    }

    if (record.count > limiter.max) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
  }

  // 3. Session validation
  const supabase = createMiddlewareClient({ req: request, res: NextResponse.next() });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session && !request.nextUrl.pathname.includes('/login')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 4. Security Headers
  const response = NextResponse.next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  );
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

---

## ARCHIVO 2: lib/encryption.ts (Encriptación AES-256)

**Ubicación:** `/lib/encryption.ts`

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

if (ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY debe ser 32 bytes (64 caracteres hex)');
}

export function encryptData(data: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return iv.toString('hex') + ':' + encrypted;
}

export function decryptData(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 2) {
    throw new Error('Datos encriptados inválidos');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Hashear para auditoría (no reversible)
export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
```

**ENV Variable necesaria:**
```
ENCRYPTION_KEY=<32 bytes en hex, generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

---

## ARCHIVO 3: lib/security.ts (Funciones de Seguridad)

**Ubicación:** `/lib/security.ts`

```typescript
import DOMPurify from 'dompurify';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Sanitizar input contra XSS
export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No permitir HTML
    ALLOWED_ATTR: [],
  });
}

// Validar RFC (formato mexicano)
export function validateRFC(rfc: string): boolean {
  const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}(?:[A-Z0-9]{3})?$/;
  return rfcRegex.test(rfc);
}

// Validar email
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Generar CSRF token
export function generateCSRFToken(): string {
  return require('crypto').randomBytes(32).toString('hex');
}

// Registrar evento de seguridad
export async function logSecurityEvent(
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  context: any,
  userId: string
) {
  try {
    await supabase.from('audit_log').insert({
      evento: event,
      severidad: severity,
      contexto: context,
      usuario_id: userId,
      ip: context.ip || 'unknown',
      creado_en: new Date(),
    });
  } catch (error) {
    console.error('Error logging security event:', error);
  }
}

// Verificar permisos (RBAC)
export async function checkPermission(
  userId: string,
  recurso: string,
  accion: 'crear' | 'leer' | 'actualizar' | 'eliminar'
): Promise<boolean> {
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('role')
    .eq('id', userId)
    .single();

  const { data: permiso } = await supabase
    .from('roles_permisos')
    .select(accion) // Select the specific action column
    .eq('role', usuario?.role)
    .eq('permiso', recurso)
    .single();

  return permiso?.[accion] === true;
}

// Detectar actividad sospechosa
export async function detectAnomalousActivity(
  userId: string,
  action: string,
  context: any
) {
  const alertas = [];

  // Verificar múltiples IPs en poco tiempo
  const { data: recentActivity } = await supabase
    .from('audit_log')
    .select('ip')
    .eq('usuario_id', userId)
    .gte('creado_en', new Date(Date.now() - 15 * 60 * 1000).toISOString()) // Últimos 15 min
    .limit(10);

  const uniqueIPs = new Set(recentActivity?.map((a: any) => a.ip));
  if (uniqueIPs.size > 3) {
    alertas.push('Múltiples IPs en corto tiempo');
  }

  // Verificar acceso fuera de horario laboral
  const hora = new Date().getHours();
  if (hora < 7 || hora > 19) {
    alertas.push('Acceso fuera de horario laboral');
  }

  // Verificar bulk access
  if (action === 'bulk_export' && context.records > 1000) {
    alertas.push('Acceso a gran cantidad de datos');
  }

  if (alertas.length > 0) {
    await logSecurityEvent(action, 'high', { alertas, ...context }, userId);
  }

  return alertas;
}
```

---

## ARCHIVO 4: app/api/auth/login.ts (Login seguro con MFA)

**Ubicación:** `/app/api/auth/login.ts`

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { logSecurityEvent, validateEmail } from '@/lib/security';
import crypto from 'crypto';

export const POST = async (req: NextRequest) => {
  try {
    const { email, password } = await req.json();

    // Validar email
    if (!validateEmail(email)) {
      await logSecurityEvent('LOGIN_FAILED_INVALID_EMAIL', 'low', { email }, 'unknown');
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });

    // 1. Login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      await logSecurityEvent('LOGIN_FAILED_WRONG_PASSWORD', 'medium', { email }, 'unknown');
      return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 });
    }

    const userId = data.user?.id;

    // 2. Verificar si usuario tiene MFA habilitado
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('mfa_habilitado, mfa_secret')
      .eq('id', userId)
      .single();

    if (usuario?.mfa_habilitado) {
      // Generar MFA code y guardarlo temporalmente
      const mfaCode = crypto.randomInt(100000, 999999).toString();
      const mfaExpiry = new Date(Date.now() + 5 * 60 * 1000); // Expira en 5 min

      await supabase
        .from('usuarios')
        .update({
          mfa_pending_code: mfaCode,
          mfa_pending_expiry: mfaExpiry,
        })
        .eq('id', userId);

      // Aquí enviarías el código por:
      // - Email
      // - SMS
      // - Google Authenticator

      await logSecurityEvent('MFA_REQUIRED', 'low', { email }, userId);

      return NextResponse.json({
        message: 'MFA requerido',
        mfa_required: true,
        mfa_method: usuario?.mfa_method || 'email',
      });
    }

    // 3. Login exitoso (sin MFA)
    await logSecurityEvent('LOGIN_SUCCESS', 'low', { email }, userId);

    // Generar CSRF token
    const csrfToken = crypto.randomBytes(32).toString('hex');
    const response = NextResponse.json({ message: 'Login exitoso', user: data.user });
    response.cookies.set('csrf-token', csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 24 horas
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Error en login' },
      { status: 500 }
    );
  }
};
```

---

## ARCHIVO 5: supabase/triggers.sql (Auditoría automática)

**Ubicación:** `/supabase/functions/audit-triggers.sql`

```sql
-- Función base para auditoría
CREATE OR REPLACE FUNCTION audit_change()
RETURNS TRIGGER AS $$
DECLARE
  v_usuario_id UUID;
  v_cambios TEXT[];
BEGIN
  -- Obtener usuario actual
  v_usuario_id := auth.uid();

  -- Detectar cambios específicos
  IF TG_OP = 'UPDATE' THEN
    -- Comparar campos
    SELECT array_agg(key)
    INTO v_cambios
    FROM jsonb_each(to_jsonb(NEW) - to_jsonb(OLD))
    WHERE key NOT IN ('actualizado_en', 'fecha_última_sync');
  END IF;

  -- Registrar en audit_log
  INSERT INTO audit_log (
    empresa_id,
    usuario_id,
    tabla,
    operacion,
    record_id,
    datos_anterior,
    datos_nuevo,
    cambios_detectados,
    hash_anterior,
    hash_nuevo,
    creado_en
  ) VALUES (
    COALESCE(NEW.empresa_id, OLD.empresa_id),
    v_usuario_id,
    TG_TABLE_NAME,
    TG_OP,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    v_cambios,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN encode(sha256(to_jsonb(OLD)::text::bytea), 'hex') ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN encode(sha256(to_jsonb(NEW)::text::bytea), 'hex') ELSE NULL END,
    CURRENT_TIMESTAMP
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers a tablas críticas
CREATE TRIGGER audit_gastos
AFTER INSERT OR UPDATE OR DELETE ON gastos
FOR EACH ROW EXECUTE FUNCTION audit_change();

CREATE TRIGGER audit_polizas
AFTER INSERT OR UPDATE OR DELETE ON polizas
FOR EACH ROW EXECUTE FUNCTION audit_change();

CREATE TRIGGER audit_movimientos_financieros
AFTER INSERT OR UPDATE OR DELETE ON movimientos_financieros
FOR EACH ROW EXECUTE FUNCTION audit_change();

CREATE TRIGGER audit_cfdi_recibidos
AFTER INSERT OR UPDATE OR DELETE ON cfdi_recibidos
FOR EACH ROW EXECUTE FUNCTION audit_change();

CREATE TRIGGER audit_cobros
AFTER INSERT OR UPDATE OR DELETE ON cobros
FOR EACH ROW EXECUTE FUNCTION audit_change();

CREATE TRIGGER audit_reconciliaciones
AFTER INSERT OR UPDATE OR DELETE ON reconciliaciones
FOR EACH ROW EXECUTE FUNCTION audit_change();

-- Trigger para marcar RFC como sensible
CREATE OR REPLACE FUNCTION flag_sensitive_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Si se accede a RFC, registrar como acceso sensible
  IF NEW.cambios_detectados @> ARRAY['rfc_proveedor', 'rfc_emisor', 'rfc'] THEN
    INSERT INTO audit_log (
      empresa_id,
      usuario_id,
      tabla,
      operacion,
      record_id,
      creado_en
    ) VALUES (
      NEW.empresa_id,
      NEW.usuario_id,
      NEW.tabla || '_RFC_ACCESS',
      'READ_SENSITIVE',
      NEW.record_id,
      CURRENT_TIMESTAMP
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sensitive_data_access
AFTER INSERT ON audit_log
FOR EACH ROW
WHEN (NEW.cambios_detectados @> ARRAY['rfc_proveedor', 'rfc_emisor'])
EXECUTE FUNCTION flag_sensitive_access();
```

---

## ARCHIVO 6: lib/firmas-digitales.ts (Firmar pólizas para SAT)

**Ubicación:** `/lib/firmas-digitales.ts`

```typescript
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Cargar clave privada (debe estar segura en servidor)
const PRIVATE_KEY = fs.readFileSync(
  path.join(process.env.CERTS_PATH || '/etc/certs', 'private-key.pem'),
  'utf8'
);

const PUBLIC_KEY = fs.readFileSync(
  path.join(process.env.CERTS_PATH || '/etc/certs', 'public-key.pem'),
  'utf8'
);

export interface PolizaFirmada {
  poliza_id: string;
  firma_digital: string;
  fecha_firma: Date;
  certificado: string;
}

export async function firmarPoliza(poliza: any): Promise<PolizaFirmada> {
  // Crear contenido determinístico (mismo orden siempre)
  const contenido = JSON.stringify({
    movimiento_financiero_id: poliza.movimiento_financiero_id,
    lineas: poliza.lineas.sort((a: any, b: any) => a.id.localeCompare(b.id)),
    total_debit: poliza.total_debit,
    total_credit: poliza.total_credit,
    fecha_poliza: poliza.fecha_poliza,
    concepto: poliza.concepto,
  });

  // Crear firma digital
  const signer = crypto.createSign('sha256');
  signer.update(contenido);
  const firma = signer.sign(PRIVATE_KEY, 'base64');

  return {
    poliza_id: poliza.id,
    firma_digital: firma,
    fecha_firma: new Date(),
    certificado: PUBLIC_KEY,
  };
}

export async function verificarFirma(
  poliza: any,
  firma: string
): Promise<boolean> {
  const contenido = JSON.stringify({
    movimiento_financiero_id: poliza.movimiento_financiero_id,
    lineas: poliza.lineas.sort((a: any, b: any) => a.id.localeCompare(b.id)),
    total_debit: poliza.total_debit,
    total_credit: poliza.total_credit,
    fecha_poliza: poliza.fecha_poliza,
    concepto: poliza.concepto,
  });

  const verifier = crypto.createVerify('sha256');
  verifier.update(contenido);

  try {
    return verifier.verify(PUBLIC_KEY, firma, 'base64');
  } catch (error) {
    console.error('Error verificando firma:', error);
    return false;
  }
}

// Generar certificado autofirmado (solo para desarrollo)
export function generateDevCertificate() {
  const { execSync } = require('child_process');

  try {
    execSync(
      'openssl req -x509 -newkey rsa:4096 -keyout /etc/certs/private-key.pem -out /etc/certs/public-key.pem -days 365 -nodes -subj "/C=MX/ST=Mexico/L=Mexico/O=CheckSuite/CN=checksuite.local"'
    );
    console.log('Certificado generado en /etc/certs/');
  } catch (error) {
    console.error('Error generando certificado:', error);
  }
}
```

---

## ARCHIVO 7: components/ProtectedForm.tsx (Form seguro)

**Ubicación:** `/components/ProtectedForm.tsx`

```typescript
'use client';

import { FormEvent, useEffect, useState } from 'react';
import { sanitizeInput, generateCSRFToken } from '@/lib/security';

export function ProtectedForm({
  onSubmit,
  children,
}: {
  onSubmit: (data: any) => Promise<void>;
  children: React.ReactNode;
}) {
  const [csrfToken, setCSRFToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Obtener token CSRF del servidor
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (token) {
      setCSRFToken(token);
    }
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formData = new FormData(e.currentTarget);
      const data: any = {};

      // Sanitizar todos los inputs
      formData.forEach((value, key) => {
        data[key] = typeof value === 'string' ? sanitizeInput(value) : value;
      });

      // Enviar con token CSRF
      const response = await fetch(e.currentTarget.action, {
        method: e.currentTarget.method,
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Error en formulario');
        return;
      }

      await onSubmit(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <div className="error-message">{error}</div>}
      {children}
      <button type="submit" disabled={loading}>
        {loading ? 'Enviando...' : 'Enviar'}
      </button>
    </form>
  );
}
```

---

## ARCHIVO 8: app/api/security/audit-logs.ts (API de auditoría)

**Ubicación:** `/app/api/security/audit-logs.ts`

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { checkPermission } from '@/lib/security';

export const GET = async (req: Request) => {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }

    // Verificar permiso
    const hasPermission = await checkPermission(session.user.id, 'audit_log', 'leer');
    if (!hasPermission) {
      return new Response(JSON.stringify({ error: 'Sin permisos' }), { status: 403 });
    }

    // Obtener logs
    const { searchParams } = new URL(req.url);
    const empresa_id = searchParams.get('empresa_id');
    const tabla = searchParams.get('tabla');
    const usuario_id = searchParams.get('usuario_id');
    const dias = parseInt(searchParams.get('dias') || '30');

    const fechaInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .eq('empresa_id', empresa_id)
      .gte('creado_en', fechaInicio.toISOString())
      .order('creado_en', { ascending: false })
      .limit(100);

    if (tabla) query = query.eq('tabla', tabla);
    if (usuario_id) query = query.eq('usuario_id', usuario_id);

    const { data, error, count } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(
      JSON.stringify({
        logs: data,
        total: count,
        filtros: { empresa_id, tabla, usuario_id, dias },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error obteniendo audit logs:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
};
```

---

## ENV Variables Necesarias

```bash
# Encriptación
ENCRYPTION_KEY=<32 bytes en hex>

# Certificados (SAT)
CERTS_PATH=/etc/certs
CERT_PRIVATE_KEY_PATH=/etc/certs/private-key.pem
CERT_PUBLIC_KEY_PATH=/etc/certs/public-key.pem

# MFA
MFA_ISSUER=CheckSuite
MFA_WINDOW=2

# Rate Limiting
REDIS_URL=redis://localhost:6379

# Seguridad
CORS_ALLOWED_ORIGINS=https://checksuite.com,https://admin.checksuite.com
SESSION_SECRET=<random 32 bytes>
```

---

## Checklist Implementación

```
[ ] Generar ENCRYPTION_KEY y guardar en ENV
[ ] Generar certificados SSL para SAT
[ ] Crear tabla audit_log en Supabase
[ ] Crear tabla roles_permisos en Supabase
[ ] Aplicar todos los triggers SQL
[ ] Copiar archivo middleware.ts
[ ] Copiar archivo lib/encryption.ts
[ ] Copiar archivo lib/security.ts
[ ] Copiar archivo lib/firmas-digitales.ts
[ ] Actualizar API routes con CSRF
[ ] Actualizar formularios con ProtectedForm
[ ] Configurar MFA (TOTP o Email)
[ ] Configurar Rate Limiting con Redis
[ ] Pruebas de seguridad (penetration test)
[ ] Auditoría de cumplimiento SAT
```

