# 📧 FacturaCheck — Sistema de Distribución Configurable

**Actualización Crítica**: 2026-07-04  
**Requisito**: Las facturas se envíen a EMAIL + WHATSAPP según cliente defina  
**PAC**: FACTUROO (investigando integración)

---

## 🎯 REQUISITO NUEVO

**Antes**: Distribución automática Email + WhatsApp siempre  
**Ahora**: Distribución **configurable por cliente**
- Cliente elige: Email, WhatsApp, ambos, o ninguno
- Cada cliente puede tener configuración diferente
- Flexible para futuro (SMS, Telegram, etc)

---

## 🏗️ ARQUITECTURA ACTUALIZADA

### Tabla Nueva: `cfdi_distribution_settings`

```sql
CREATE TABLE cfdi_distribution_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  -- Canales habilitados
  send_email BOOLEAN DEFAULT true,
  send_whatsapp BOOLEAN DEFAULT false,
  send_sms BOOLEAN DEFAULT false,
  
  -- Configuración Email
  email_from TEXT,
  email_template TEXT,  -- 'simple' | 'branded' | 'custom'
  
  -- Configuración WhatsApp
  whatsapp_enabled BOOLEAN DEFAULT false,
  whatsapp_template TEXT,  -- 'simple' | 'invoice_link'
  whatsapp_phone_to_client BOOLEAN DEFAULT true,
  whatsapp_phone_to_company BOOLEAN DEFAULT false,
  
  -- Configuración SMS (futuro)
  sms_enabled BOOLEAN DEFAULT false,
  sms_template TEXT,
  
  -- Recipients
  auto_send_to_client BOOLEAN DEFAULT true,
  auto_send_to_company BOOLEAN DEFAULT false,
  cc_emails TEXT[],  -- array de emails CC
  
  -- Auditoría
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  
  CONSTRAINT valid_at_least_one_channel CHECK (
    send_email OR send_whatsapp OR send_sms
  )
);

-- RLS: user solo ve su empresa
CREATE POLICY "users_see_own_distribution_settings"
  ON cfdi_distribution_settings
  FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM company_members 
    WHERE user_id = auth.uid()
  ));
```

### Tabla Existente: `cfdi_distributions` (actualizada)

```sql
-- Modificar tabla existente para registrar qué canales se usaron

ALTER TABLE cfdi_distributions ADD COLUMN IF NOT EXISTS (
  -- Registrar cuál canal fue usado
  channel_sent_via VARCHAR(20),  -- 'email' | 'whatsapp' | 'sms' | 'multi'
  
  -- Timestamps por canal
  email_sent_at TIMESTAMP,
  email_status VARCHAR(50),  -- 'sent' | 'failed' | 'bounced' | 'opened'
  email_opened_at TIMESTAMP,
  
  whatsapp_sent_at TIMESTAMP,
  whatsapp_status VARCHAR(50),  -- 'sent' | 'failed' | 'read'
  whatsapp_read_at TIMESTAMP,
  
  sms_sent_at TIMESTAMP,
  sms_status VARCHAR(50),
  
  -- Retry logic
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP,
  
  -- Error tracking
  error_message TEXT
);
```

---

## 🔄 FLUJO DE DISTRIBUCIÓN NUEVO

```
Usuario emite CFDI
  ↓
Sistema obtiene: cfdi_distribution_settings para empresa
  ↓
¿send_email = true?
  ├─ SÍ → Enviar email (cliente + company si aplica + CCs)
  └─ NO → Skip email
  ↓
¿send_whatsapp = true?
  ├─ SÍ → Enviar WhatsApp (cliente + company si aplica)
  └─ NO → Skip WhatsApp
  ↓
¿send_sms = true?
  ├─ SÍ → Enviar SMS (cliente si aplica)
  └─ NO → Skip SMS
  ↓
Registrar en cfdi_distributions:
  - Qué canales se usaron
  - Timestamps y status por canal
  - Errores si ocurrieron
  ↓
Intentar re-envío si alguno falló (retry logic)
```

---

## 💻 CÓDIGO: HOOKS PARA DISTRIBUCIÓN

```typescript
// apps/mobile/app/facturacheck/hooks/useDistribution.ts

export function useDistributionSettings(companyId: string) {
  const [settings, setSettings] = useState<CfdiDistributionSettings | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('cfdi_distribution_settings')
          .select('*')
          .eq('company_id', companyId)
          .single()
        
        setSettings(data)
      } finally {
        setLoading(false)
      }
    }
    
    load()
  }, [companyId])

  return { settings, loading }
}

export function useDistributeCfdi() {
  const [sending, setSending] = useState(false)

  const distribute = async (
    cfdiId: string,
    settings: CfdiDistributionSettings,
    recipient: {
      email?: string
      whatsappNumber?: string
    }
  ) => {
    setSending(true)
    try {
      const distribution: any = {
        cfdi_id: cfdiId,
        channel_sent_via: []
      }

      // Email
      if (settings.send_email && recipient.email) {
        try {
          await supabase.functions.invoke('send-cfdi-email', {
            body: {
              cfdiId,
              email: recipient.email,
              template: settings.email_template,
              cc: settings.cc_emails
            }
          })
          
          distribution.email_sent_at = new Date().toISOString()
          distribution.email_status = 'sent'
          distribution.channel_sent_via.push('email')
        } catch (err) {
          distribution.email_status = 'failed'
          distribution.error_message = String(err)
        }
      }

      // WhatsApp
      if (settings.send_whatsapp && recipient.whatsappNumber) {
        try {
          await supabase.functions.invoke('send-cfdi-whatsapp', {
            body: {
              cfdiId,
              phoneNumber: recipient.whatsappNumber,
              template: settings.whatsapp_template
            }
          })
          
          distribution.whatsapp_sent_at = new Date().toISOString()
          distribution.whatsapp_status = 'sent'
          distribution.channel_sent_via.push('whatsapp')
        } catch (err) {
          distribution.whatsapp_status = 'failed'
          distribution.error_message = String(err)
        }
      }

      // SMS (futuro)
      if (settings.send_sms && recipient.whatsappNumber) {
        // Similar logic para SMS
      }

      // Registrar distribución
      if (distribution.channel_sent_via.length > 0) {
        distribution.channel_sent_via = distribution.channel_sent_via.join('|')
        
        const { error } = await supabase
          .from('cfdi_distributions')
          .insert([distribution])
        
        if (error) throw error
        
        return { success: true, channelsSent: distribution.channel_sent_via }
      } else {
        return { success: false, error: 'No channels configured' }
      }
    } finally {
      setSending(false)
    }
  }

  return { distribute, sending }
}
```

---

## 📱 UI: Pantalla de Configuración

```typescript
// apps/mobile/app/facturacheck/screens/DistributionSettingsScreen.tsx

export function DistributionSettingsScreen() {
  const { settings, loading } = useDistributionSettings(companyId)
  const [updateSettings] = useUpdateDistributionSettings()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configurar Distribución de Facturas</Text>

      {/* Email Toggle */}
      <View style={styles.setting}>
        <Text>📧 Enviar por Email</Text>
        <Switch
          value={settings?.send_email}
          onValueChange={(val) => updateSettings({ send_email: val })}
        />
      </View>

      {/* WhatsApp Toggle */}
      <View style={styles.setting}>
        <Text>💬 Enviar por WhatsApp</Text>
        <Switch
          value={settings?.send_whatsapp}
          onValueChange={(val) => updateSettings({ send_whatsapp: val })}
        />
      </View>

      {/* SMS Toggle (futuro) */}
      <View style={styles.setting}>
        <Text>📲 Enviar por SMS (próximamente)</Text>
        <Switch
          value={false}
          disabled
        />
      </View>

      {/* Auto-send to company */}
      <View style={styles.setting}>
        <Text>🏢 Enviar copia a empresa</Text>
        <Switch
          value={settings?.auto_send_to_company}
          onValueChange={(val) => updateSettings({ auto_send_to_company: val })}
        />
      </View>

      {/* CC Emails */}
      <TextInput
        placeholder="Emails adicionales (separados por coma)"
        value={settings?.cc_emails?.join(', ')}
        onChangeText={(val) => 
          updateSettings({ cc_emails: val.split(',').map(e => e.trim()) })
        }
      />

      {/* Email Template Selection */}
      <Picker
        selectedValue={settings?.email_template}
        onValueChange={(val) => updateSettings({ email_template: val })}
      >
        <Picker.Item label="Simple" value="simple" />
        <Picker.Item label="Con Branding" value="branded" />
        <Picker.Item label="Personalizado" value="custom" />
      </Picker>
    </View>
  )
}
```

---

## 🔧 EDGE FUNCTION: Distribución Automática

```typescript
// supabase/functions/distribute-cfdi/index.ts

export async function distributeCfdi(cfdiId: string, companyId: string) {
  // 1. Obtener CFDI
  const { data: cfdi } = await supabase
    .from('cfdi_documents')
    .select('*')
    .eq('id', cfdiId)
    .single()

  // 2. Obtener settings distribución
  const { data: settings } = await supabase
    .from('cfdi_distribution_settings')
    .select('*')
    .eq('company_id', companyId)
    .single()

  // 3. Obtener datos cliente
  const { data: client } = await supabase
    .from('clients')  // tabla ficticia, depende estructura
    .select('*')
    .eq('id', cfdi.client_id)
    .single()

  const distribution: any = {
    cfdi_id: cfdiId,
    company_id: companyId,
    channel_sent_via: []
  }

  // 4. Email
  if (settings.send_email && client.email) {
    try {
      await sendEmail({
        to: client.email,
        cc: settings.cc_emails,
        subject: `Factura ${cfdi.folio}`,
        htmlBody: await generateEmailTemplate(cfdi, settings.email_template)
      })
      distribution.email_sent_at = now()
      distribution.email_status = 'sent'
      distribution.channel_sent_via.push('email')
    } catch (err) {
      distribution.email_status = 'failed'
      distribution.error_message = err.message
    }
  }

  // 5. WhatsApp
  if (settings.send_whatsapp && client.whatsapp_number) {
    try {
      await sendWhatsApp({
        to: client.whatsapp_number,
        message: await generateWhatsAppTemplate(cfdi, settings.whatsapp_template),
        attachment: cfdi.pdf_storage_path
      })
      distribution.whatsapp_sent_at = now()
      distribution.whatsapp_status = 'sent'
      distribution.channel_sent_via.push('whatsapp')
    } catch (err) {
      distribution.whatsapp_status = 'failed'
      distribution.error_message = err.message
    }
  }

  // 6. Registrar
  if (distribution.channel_sent_via.length > 0) {
    distribution.channel_sent_via = distribution.channel_sent_via.join('|')
    await supabase.from('cfdi_distributions').insert([distribution])
  }

  return distribution
}
```

---

## 🎯 SEMANA 1 ACTUALIZADO (Daniel)

**Miércoles**: Agregar tablas de distribución al schema

```sql
-- Nueva tabla: cfdi_distribution_settings
-- Modificar: cfdi_distributions (agregar campos de canal)
-- Índices: company_id en settings
-- RLS: user solo ve su empresa
```

**Jueves**: Implementar hooks de distribución

```typescript
// useDistributionSettings() - obtener settings
// useDistributeCfdi() - enviar por canales
// useUpdateDistributionSettings() - actualizar config
```

**Viernes**: UI de configuración

```typescript
// DistributionSettingsScreen.tsx
// Toggles: email, whatsapp, sms
// Campos: email template, CC, auto-send company
```

---

## 📌 FACTUROO INTEGRACIÓN (En Investigación)

**Pendiente**: Resultados de investigación FACTUROO
- ¿API FACTUROO compatible con distribución configurble?
- ¿Maneja email/WhatsApp automáticamente?
- ¿Se puede configurar por cliente?
- ¿Cómo integrar con FacturaCheck?

---

**Estado**: Arquitectura actualizada, esperando análisis FACTUROO

