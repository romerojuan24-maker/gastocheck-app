# Prueba E2E: create-company
# Fecha: 2026-07-18
# Entorno: Produccion (Supabase)

$SUPABASE_URL = "https://omhycwfjxynkfwywzwvz.supabase.co"
$ANON_KEY = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY

Write-Host "=== PRUEBA E2E: create-company ===" -ForegroundColor Green
Write-Host "Entorno: PRODUCCION (Supabase)"
Write-Host "Fecha: 2026-07-18"
Write-Host ""

# Paso 1: Crear usuario de prueba
Write-Host "Paso 1: Crear usuario de prueba en Auth..." -ForegroundColor Yellow

$testEmail = "test-adm001-$(Get-Date -Format 'yyyyMMdd-HHmmss')@test.local"
$testPassword = "TestPassword123!@#"

$authSignUpBody = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

Write-Host "POST $SUPABASE_URL/auth/v1/signup" -ForegroundColor Cyan
Write-Host "Body: $authSignUpBody" -ForegroundColor Cyan

$headers = @{
    "apikey" = $ANON_KEY
    "Content-Type" = "application/json"
}

try {
    $signUpResponse = Invoke-WebRequest -Uri "$SUPABASE_URL/auth/v1/signup" `
        -Method POST `
        -Headers $headers `
        -Body $authSignUpBody `
        -ErrorAction Stop

    $signUpJson = $signUpResponse.Content | ConvertFrom-Json
    Write-Host "Response SignUp:"
    Write-Host $signUpResponse.Content
} catch {
    Write-Host "ERROR: Fallo en SignUp" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host $_.Exception.Response.Content
    exit 1
}

Write-Host ""

# Parse user ID from response
if ($signUpJson -and $signUpJson.user) {
    $userId = $signUpJson.user.id
    $accessToken = $signUpJson.session.access_token
    Write-Host "OK: Usuario creado" -ForegroundColor Green
    Write-Host "   Email: $testEmail" -ForegroundColor Green
    Write-Host "   User ID: $userId" -ForegroundColor Green
    Write-Host "   Access Token (primeros 50 caracteres): $($accessToken.Substring(0, 50))..." -ForegroundColor Green
} else {
    Write-Host "ERROR: Fallo al crear usuario" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Paso 2: Invocar create-company
Write-Host "Paso 2: Invocar Edge Function create-company..." -ForegroundColor Yellow

$companyName = "E2E Test Company $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$createCompanyBody = @{
    companyName = $companyName
} | ConvertTo-Json

Write-Host "POST $SUPABASE_URL/functions/v1/create-company" -ForegroundColor Cyan
Write-Host "Authorization: Bearer [token]" -ForegroundColor Cyan
Write-Host "Body: $createCompanyBody" -ForegroundColor Cyan

$headersCreateCompany = @{
    "Authorization" = "Bearer $accessToken"
    "apikey" = $ANON_KEY
    "Content-Type" = "application/json"
}

try {
    $createCompanyResponse = Invoke-WebRequest -Uri "$SUPABASE_URL/functions/v1/create-company" `
        -Method POST `
        -Headers $headersCreateCompany `
        -Body $createCompanyBody `
        -ErrorAction Stop

    $companyJson = $createCompanyResponse.Content | ConvertFrom-Json
    Write-Host "Response create-company:"
    Write-Host $createCompanyResponse.Content
} catch {
    Write-Host "ERROR: Fallo en create-company" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)"
    Write-Host "Message: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "Response: $($_.Exception.Response.Content)"
    }
    exit 1
}

Write-Host ""

# Parse response
if ($companyJson -and $companyJson.company_id) {
    $companyId = $companyJson.company_id
    Write-Host "OK: Empresa creada" -ForegroundColor Green
    Write-Host "   Company ID: $companyId" -ForegroundColor Green
    if ($companyJson.trial_ends_at) {
        Write-Host "   Trial ends at: $($companyJson.trial_ends_at)" -ForegroundColor Green
    }
} else {
    Write-Host "ERROR: Fallo al crear empresa" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Documentar IDs para verificacion posterior
Write-Host "Paso 3: Guardar IDs para verificacion posterior" -ForegroundColor Yellow
Write-Host ""

$testData = @{
    timestamp = Get-Date -Format 'o'
    entorno = "PRODUCCION"
    test_email = $testEmail
    user_id = $userId
    access_token_preview = "$($accessToken.Substring(0, 50))..."
    company_id = $companyId
    company_name = $companyName
    trial_ends_at = if ($companyJson.trial_ends_at) { $companyJson.trial_ends_at } else { "N/A" }
    full_response_create_company = $createCompanyResponse.Content
}

$testData | ConvertTo-Json -Depth 10 | Out-File -FilePath "docs/TEST_E2E_CREATE_COMPANY_RESULT.json" -Encoding UTF8 -Force

Write-Host "OK: Datos guardados en docs/TEST_E2E_CREATE_COMPANY_RESULT.json" -ForegroundColor Green
Write-Host ""

# Criterios de exito
Write-Host "=== CRITERIOS DE EXITO ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Esperado:"
Write-Host "  HTTP 200/201"
Write-Host "  company_id valido"
Write-Host "  empresa creada"
Write-Host "  company_members creada"
Write-Host "  role = admin"
Write-Host "  trial_ends_at asignado"
Write-Host "  usuario puede leer su empresa"
Write-Host ""
Write-Host "Obtenido:"
Write-Host "  HTTP: 200 (OK)" -ForegroundColor Green
Write-Host "  company_id: $companyId" -ForegroundColor Green
Write-Host "  trial_ends_at: $($companyJson.trial_ends_at)" -ForegroundColor $(if ($companyJson.trial_ends_at) { 'Green' } else { 'Red' })
Write-Host ""

Write-Host "=== SIGUIENTE: Verificar persistencia en BD ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ejecutar en Supabase SQL Editor:"
Write-Host "  SELECT * FROM companies WHERE id = '$companyId';" -ForegroundColor Yellow
Write-Host "  SELECT * FROM company_members WHERE company_id = '$companyId';" -ForegroundColor Yellow
