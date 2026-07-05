# 🏦 BancoCheck — Dual Approach: Manual + Automático (Implementación)

**Propósito**: Importar estados de cuenta de DOS formas (manual OCR + API automática)  
**Cobertura**: 100% clientes (con/sin APIs bancarias disponibles)  
**Estado**: 🟢 LISTO PARA CODIFICAR  
**No requiere**: Contratos previos (API specs públicas), búsqueda manual API Facturama, compra de saldos

---

## 🎯 DUAL ROUTES ARCHITECTURE

### RUTA A: IMPORTACIÓN MANUAL (OCR + Parsers)

```
USUARIO ACCIÓN:
└─ Toma foto estado de cuenta (JPG/PNG) O descarga PDF
   └─ Sube a app

SISTEMA PROCESA:
1. OCR: Extrae texto de imagen/PDF
2. Reconocimiento formato: Detecta banco + estructura
3. Parseo: Extrae campos clave
4. Validación: Verifica integridad datos
5. Importación: Crea transacciones en DB
6. Deduplicación: Evita duplicados

RESULTADO:
└─ Estado de cuenta manual cargado en BancoCheck
```

### RUTA B: INTEGRACIÓN AUTOMÁTICA (APIs)

```
USUARIO ACCIÓN:
└─ Conecta banco con OAuth (Click "Connect BBVA")

SISTEMA PROCESA:
1. OAuth Flow: Usuario autoriza en banco
2. Token: Recibe access_token encriptado
3. Sincronización: Descarga transacciones automáticamente
4. Cron Job: Repite cada hora/diario
5. Webhooks: Updatea en tiempo real si disponible

RESULTADO:
└─ Estado de cuenta sincronizado automáticamente
```

### RUTA C: HYBRID (Usuario usa ambas)

```
CLIENTE TÍPICO:
├─ Conecta BBVA automáticamente (últimas transacciones)
├─ Sube PDF histórico de 6 meses atrás (manual OCR)
├─ Ambas fuentes coexisten en BancoCheck
└─ Sistema deduplica automáticamente
```

---

## 📋 TABLA 1: `bank_statement_imports` (Manual OCR)

```sql
CREATE TABLE bank_statement_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  -- Documento
  document_url TEXT NOT NULL,        -- URL archivo (S3 o local)
  document_type TEXT,                -- 'pdf', 'jpg', 'png', 'csv'
  document_name TEXT,
  upload_date TIMESTAMP DEFAULT now(),
  
  -- Banco detectado (OCR)
  detected_bank TEXT,                -- "BBVA", "Santander", "Banamex", "unknown"
  detected_bank_confidence INT,      -- 0-100 (cuán seguro es reconocimiento)
  
  -- OCR EXTRACTION
  ocr_text_extracted TEXT,           -- Texto bruto extraído
  ocr_confidence_score INT,          -- 0-100 (calidad OCR)
  
  -- PARSED DATA
  parsed_data JSONB,                 -- Array de transacciones extraídas
  -- Estructura: [{date, description, amount, balance, reference}, ...]
  
  -- VALIDACIÓN
  validation_status TEXT DEFAULT 'pending', -- pending, validated, rejected
  validation_errors TEXT[],          -- Array de errores si hay
  manual_review_required BOOLEAN DEFAULT false,
  review_by_admin UUID,
  review_date TIMESTAMP,
  
  -- IMPORTACIÓN
  import_status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  transactions_created INT DEFAULT 0,
  duplicates_skipped INT DEFAULT 0,
  import_date TIMESTAMP,
  
  -- METADATA
  line_items_detected INT,           -- Cuántas transacciones encontró
  statement_period_from DATE,        -- Período del extracto
  statement_period_to DATE,
  account_number_detected TEXT,      -- Si se puede extraer
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_company_status ON bank_statement_imports(company_id, import_status);
CREATE INDEX idx_validation ON bank_statement_imports(company_id, validation_status);
```

---

## 📋 TABLA 2: `bank_statement_ocr_config` (Reconocimiento por banco)

```sql
CREATE TABLE bank_statement_ocr_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Banco
  bank_name TEXT UNIQUE NOT NULL,    -- "BBVA", "Santander", "Banamex", etc.
  
  -- PATRONES DE RECONOCIMIENTO
  logo_keywords TEXT[],              -- ["BBVA", "Bancomer", "bbva.com"]
  header_patterns TEXT[],            -- Patrones header documento
  transaction_row_pattern TEXT,      -- Regex para detectar fila transacción
  
  -- MAPEO DE CAMPOS
  field_mapping JSONB,               -- {date_col: 1, desc_col: 2, amount_col: 3, balance_col: 4}
  date_format TEXT,                  -- "DD/MM/YYYY", "MM/DD/YYYY", etc.
  decimal_separator TEXT,            -- "." o ","
  thousand_separator TEXT,           -- "," o "."
  
  -- REGLAS ESPECÍFICAS
  ignore_lines_with TEXT[],          -- Líneas a ignorar (ej: "TOTALES", "SALDO")
  amount_column_negative_indicator TEXT, -- "-" o "CR" para negativos
  balance_location TEXT,             -- "end_of_line", "separate_column"
  
  -- PRECISIÓN
  ocr_confidence_required INT DEFAULT 85, -- % mínimo OCR para importar
  
  -- ESTADO
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

---

## 📋 TABLA 3: `bank_accounts_automated` (API Automática)

```sql
CREATE TABLE bank_accounts_automated (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  -- Identificación
  account_name TEXT NOT NULL,        -- "Mi Operativa BBVA", "Reserva Santander"
  bank_name TEXT NOT NULL,           -- "BBVA", "Santander", "Belvo"
  integration_type TEXT,             -- 'direct_api', 'belvo'
  
  -- OAuth / Credenciales
  oauth_access_token TEXT,           -- Encriptado
  oauth_refresh_token TEXT,          -- Encriptado
  oauth_expires_at TIMESTAMP,
  
  -- Datos banco
  bank_account_id TEXT,              -- ID del banco (ej: "4975460352")
  account_number TEXT,               -- Últimos 4 dígitos
  account_type TEXT,                 -- "CURRENT_ACCOUNT", "SAVINGS"
  currency TEXT DEFAULT 'MXN',
  
  -- ÚLTIMA SINCRONIZACIÓN
  last_sync_date TIMESTAMP,
  last_sync_status TEXT,             -- 'success', 'failed', 'pending'
  last_sync_error TEXT,              -- Si falló, por qué
  
  -- CONFIGURACIÓN SYNC
  sync_frequency TEXT DEFAULT 'daily', -- 'hourly', 'daily', 'weekly'
  auto_sync_enabled BOOLEAN DEFAULT true,
  sync_last_n_days INT DEFAULT 90,   -- Cuántos días histórico
  
  -- SALDO
  current_balance DECIMAL(15,2),
  balance_updated_at TIMESTAMP,
  
  -- ESTADO
  is_connected BOOLEAN DEFAULT true,
  connection_issues BOOLEAN DEFAULT false,
  needs_reauth BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_company_account ON bank_accounts_automated(company_id);
CREATE INDEX idx_connection_status ON bank_accounts_automated(company_id, is_connected);
```

---

## 🧮 ALGORITMO 1: OCR Recognition & Field Extraction

```typescript
async function processStatementImport(
  documentFile: File,
  companyId: string
): Promise<StatementImportResult> {
  
  // 1. CONVERTIR A TEXTO (OCR)
  const ocrResult = await performOCR(documentFile, {
    lang: ['es', 'en'],
    confidence_required: 85
  })
  
  const ocrText = ocrResult.fullText
  const ocrConfidence = ocrResult.confidence
  
  // 2. RECONOCER BANCO (Logo/Header patterns)
  const detectedBank = recognizeBank(ocrText, {
    patterns: loadBankPatterns()
  })
  
  if (!detectedBank) {
    return {
      success: false,
      error: 'No se pudo detectar banco. Sube PDF más claro.',
      validation_required: true
    }
  }
  
  // 3. CARGAR CONFIG ESPECÍFICA DEL BANCO
  const bankConfig = await loadBankOCRConfig(detectedBank.bank_name)
  
  // 4. PARSEAR TRANSACCIONES
  const transactions = parseStatementRows(
    ocrText,
    bankConfig,
    {
      rowPattern: bankConfig.transaction_row_pattern,
      fieldMapping: bankConfig.field_mapping,
      dateFormat: bankConfig.date_format,
      decimalSeparator: bankConfig.decimal_separator
    }
  )
  
  if (transactions.length === 0) {
    return {
      success: false,
      error: 'No se encontraron transacciones en el documento.',
      validation_required: true
    }
  }
  
  // 5. VALIDAR INTEGRIDAD
  const validation = validateParsedData(transactions, bankConfig)
  
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.errors.join('; '),
      validation_required: true,
      parsed_data: transactions // Enviar para revisión manual
    }
  }
  
  // 6. DEDUPLICACIÓN (verificar si ya existen)
  const deduplicatedTransactions = await deduplicateTransactions(
    companyId,
    transactions
  )
  
  // 7. CREAR REGISTRO IMPORTACIÓN
  const importRecord = await db.insert('bank_statement_imports').values({
    company_id: companyId,
    document_url: await uploadToS3(documentFile),
    document_type: detectFileType(documentFile),
    detected_bank: detectedBank.bank_name,
    detected_bank_confidence: detectedBank.confidence,
    ocr_text_extracted: ocrText,
    ocr_confidence_score: ocrConfidence,
    parsed_data: deduplicatedTransactions,
    validation_status: 'validated',
    import_status: 'pending',
    line_items_detected: deduplicatedTransactions.length,
    statement_period_from: extractPeriodStart(ocrText),
    statement_period_to: extractPeriodEnd(ocrText)
  })
  
  // 8. IMPORTAR TRANSACCIONES
  const created = await importTransactionsToBank(
    companyId,
    deduplicatedTransactions,
    {
      source: 'manual_import',
      import_id: importRecord.id
    }
  )
  
  return {
    success: true,
    import_id: importRecord.id,
    transactions_created: created.count,
    duplicates_skipped: transactions.length - created.count,
    detected_bank: detectedBank.bank_name,
    period: {
      from: importRecord.statement_period_from,
      to: importRecord.statement_period_to
    }
  }
}

// Helper: Reconocer banco por patrones
function recognizeBank(ocrText: string, options: any): BankRecognitionResult {
  const patterns = options.patterns
  
  let bestMatch = null
  let highestConfidence = 0
  
  for (const [bank, keywords] of Object.entries(patterns)) {
    const matches = keywords.filter(k => ocrText.includes(k)).length
    const confidence = (matches / keywords.length) * 100
    
    if (confidence > highestConfidence) {
      highestConfidence = confidence
      bestMatch = bank
    }
  }
  
  return {
    bank_name: bestMatch || 'unknown',
    confidence: Math.round(highestConfidence)
  }
}

// Helper: Parsear filas de transacciones
function parseStatementRows(
  text: string,
  config: BankOCRConfig,
  options: any
): Transaction[] {
  const transactions: Transaction[] = []
  const lines = text.split('\n')
  
  for (const line of lines) {
    // Skip líneas ignorables
    if (config.ignore_lines_with.some(ignore => line.includes(ignore))) {
      continue
    }
    
    // Match patrón transacción
    const match = line.match(new RegExp(config.transaction_row_pattern))
    if (!match) continue
    
    // Extraer campos según mapping
    const fieldMapping = config.field_mapping as any
    const fields = line.split(/\s{2,}/) // Split por espacios múltiples
    
    transactions.push({
      date: parseDate(fields[fieldMapping.date_col], config.date_format),
      description: fields[fieldMapping.desc_col],
      amount: parseAmount(
        fields[fieldMapping.amount_col],
        config.decimal_separator,
        config.thousand_separator
      ),
      balance: parseAmount(
        fields[fieldMapping.balance_col],
        config.decimal_separator
      ),
      type: fields[fieldMapping.amount_col].includes('-') ? 'DEBIT' : 'CREDIT'
    })
  }
  
  return transactions
}

// Helper: Deduplicar contra BD
async function deduplicateTransactions(
  companyId: string,
  newTransactions: any[]
): Promise<any[]> {
  const existing = await db
    .from('bank_transactions')
    .select('date, amount, description')
    .eq('company_id', companyId)
  
  return newTransactions.filter(newTx => {
    const isDuplicate = existing.some(ex =>
      ex.date === newTx.date &&
      Math.abs(ex.amount - newTx.amount) < 0.01 &&
      ex.description === newTx.description
    )
    return !isDuplicate
  })
}
```

---

## 🧮 ALGORITMO 2: OAuth Flow (Automático)

```typescript
async function initiateAutomaticBankConnection(
  companyId: string,
  bankName: 'bbva' | 'santander' | 'belvo'
): Promise<OAuthFlowResponse> {
  
  // 1. GENERAR OAUTH URL
  const bankConfig = getBankOAuthConfig(bankName)
  
  const authUrl = new URL(bankConfig.authorizationEndpoint)
  authUrl.searchParams.append('client_id', bankConfig.clientId)
  authUrl.searchParams.append('redirect_uri', `${APP_URL}/callback/bank/${bankName}`)
  authUrl.searchParams.append('scope', bankConfig.scopes.join(' '))
  authUrl.searchParams.append('response_type', 'code')
  authUrl.searchParams.append('state', generateRandomState()) // CSRF protection
  
  // 2. GUARDAR STATE EN SESSION (para verificar después)
  await saveOAuthState(companyId, bankName, authUrl.searchParams.get('state')!)
  
  return {
    authorizationUrl: authUrl.toString(),
    bankName,
    redirectAfter: `${APP_URL}/bancocheck`
  }
}

async function handleOAuthCallback(
  companyId: string,
  bankName: string,
  code: string,
  state: string
): Promise<OAuthCallbackResult> {
  
  // 1. VERIFICAR STATE (CSRF protection)
  const savedState = await getOAuthState(companyId, bankName)
  if (savedState !== state) {
    throw new Error('Invalid OAuth state. Possible CSRF attack.')
  }
  
  // 2. INTERCAMBIAR CODE POR TOKEN
  const bankConfig = getBankOAuthConfig(bankName)
  
  const tokenResponse = await fetch(bankConfig.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: bankConfig.clientId,
      client_secret: bankConfig.clientSecret,
      redirect_uri: `${APP_URL}/callback/bank/${bankName}`
    })
  })
  
  const tokens = await tokenResponse.json()
  
  // 3. OBTENER INFO CUENTA
  const accountsResponse = await fetch(`${bankConfig.apiBaseUrl}/accounts`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  })
  
  const accounts = await accountsResponse.json()
  
  // 4. GUARDAR TOKEN ENCRIPTADO EN DB
  for (const account of accounts.accounts || accounts.results || []) {
    await db.insert('bank_accounts_automated').values({
      company_id: companyId,
      account_name: account.name,
      bank_name: bankName,
      integration_type: 'direct_api',
      oauth_access_token: encryptToken(tokens.access_token),
      oauth_refresh_token: encryptToken(tokens.refresh_token),
      oauth_expires_at: new Date(Date.now() + tokens.expires_in * 1000),
      bank_account_id: account.id,
      account_number: account.number,
      account_type: account.type,
      is_connected: true
    })
  }
  
  // 5. TRIGGER PRIMER SYNC
  await syncBankTransactions(companyId, bankName)
  
  return {
    success: true,
    accounts_connected: accounts.accounts?.length || 0,
    redirectTo: '/bancocheck'
  }
}

async function syncBankTransactions(
  companyId: string,
  bankName?: string
): Promise<SyncResult> {
  // Obtener cuentas conectadas
  const accounts = await db
    .from('bank_accounts_automated')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_connected', true)
    .then(rows => bankName ? rows.filter(r => r.bank_name === bankName) : rows)
  
  let totalCreated = 0
  let totalErrors = 0
  
  for (const account of accounts) {
    try {
      // Obtener transacciones del banco
      const transactions = await fetchBankTransactions(account)
      
      // Deduplicar
      const deduped = await deduplicateTransactions(companyId, transactions)
      
      // Importar
      const created = await importTransactionsToBank(companyId, deduped, {
        source: 'api_sync',
        bank_name: account.bank_name,
        account_id: account.bank_account_id
      })
      
      totalCreated += created.count
      
      // Actualizar sync status
      await db
        .from('bank_accounts_automated')
        .update({
          last_sync_date: new Date(),
          last_sync_status: 'success',
          connection_issues: false
        })
        .eq('id', account.id)
        
    } catch (error) {
      totalErrors++
      
      await db
        .from('bank_accounts_automated')
        .update({
          last_sync_status: 'failed',
          last_sync_error: error.message,
          connection_issues: true
        })
        .eq('id', account.id)
    }
  }
  
  return { total_created: totalCreated, total_errors: totalErrors }
}
```

---

## 🎨 UI: CONEXIÓN BANCO

```
┌──────────────────────────────────────────────────────┐
│  🏦 CONECTAR BANCO A BANCOCHECK                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  OPCIÓN 1: Sincronización Automática (Recomendado) │
│  ┌────────────────────────────────────────────────┐ │
│  │ Conecta tu banco directamente. Las            │ │
│  │ transacciones se sincronizan automáticamente. │ │
│  │                                                │ │
│  │ Bancos soportados:                             │ │
│  │ ☑️  BBVA    ☑️  Santander  ☑️  Banamex       │ │
│  │ ☑️  Scotiabank  ☑️  Banorte  ☑️  Otros (Belvo) │ │
│  │                                                │ │
│  │ [🔗 Conectar BBVA]  [🔗 Conectar Santander]   │ │
│  │ [🔗 Conectar Otro]                             │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  OPCIÓN 2: Importación Manual (PDF/Foto)            │
│  ┌────────────────────────────────────────────────┐ │
│  │ Descarga tu estado de cuenta en PDF o toma    │ │
│  │ una foto. Sistema extrae datos automáticamente.
│  │                                                │ │
│  │ Formatos soportados: PDF, JPG, PNG             │ │
│  │                                                │ │
│  │ [📤 Subir Documento]                           │ │
│  │                                                │ │
│  │ o arrastra aquí →                              │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  MIS CUENTAS CONECTADAS:                            │
│  ├─ BBVA Operativa         🟢 CONECTADA (última sync: hace 2h)
│  ├─ Santander Reserva      🟢 CONECTADA (última sync: hace 6h)
│  └─ Estado Cuenta PDF      📄 Importado 2026-07-03 (3 transactions)
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 🚀 IMPLEMENTACIÓN: NO BLOQUEANTES

**Para MANUAL (OCR)**: 
- ✅ Busco Facturama API pública (no compro saldo)
- ✅ Codifico OCR + parsers
- ✅ Cuando Juan tenga contrato Facturama, solo agrego credenciales

**Para AUTOMÁTICO (APIs)**:
- ✅ Documentación BBVA es pública
- ✅ Santander Open Banking es pública (CNBV regulado)
- ✅ Belvo es pública (requiere sign-up gratis para sandbox)
- ✅ Codifico todos sin contratos previos
- ✅ Cuando clientes usen, activo credenciales reales

**SIN BLOQUEANTES**. Listo para codificar. ✅

