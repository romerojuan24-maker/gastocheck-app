# Script de verificación de setup CHECK SUITE (Windows PowerShell)
# Uso: .\verify-setup.ps1
# Status: Checa todo lo necesario antes de testing

$ErrorActionPreference = "Continue"

# Color functions
function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "⚠️ $Message" -ForegroundColor Yellow
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
}

# Initialize counters
$passed = 0
$failed = 0

# ============================================
# 1. CHECK SYSTEM REQUIREMENTS
# ============================================
Write-Section "📦 SYSTEM REQUIREMENTS"

# Check Node.js
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Success "Node.js installed ($nodeVersion)"
        $passed++
    }
} catch {
    Write-Error-Custom "Node.js not found"
    $failed++
}

# Check npm
try {
    $npmVersion = npm --version 2>$null
    if ($npmVersion) {
        Write-Success "npm installed ($npmVersion)"
        $passed++
    }
} catch {
    Write-Error-Custom "npm not found"
    $failed++
}

# Check git
try {
    $gitVersion = git --version 2>$null
    if ($gitVersion) {
        Write-Success "Git installed"
        $passed++
    }
} catch {
    Write-Error-Custom "Git not found"
    $failed++
}

# ============================================
# 2. CHECK PROJECT STRUCTURE
# ============================================
Write-Section "📁 PROJECT STRUCTURE"

$checks = @(
    @{ Path = "package.json"; Name = "Root package.json" },
    @{ Path = "apps/web"; Name = "apps/web directory"; IsDir = $true },
    @{ Path = "apps/mobile"; Name = "apps/mobile directory"; IsDir = $true },
    @{ Path = "packages/shared"; Name = "packages/shared directory"; IsDir = $true },
    @{ Path = "apps/web/package.json"; Name = "Web package.json" },
    @{ Path = "apps/mobile/app.json"; Name = "Mobile app.json" }
)

foreach ($check in $checks) {
    if ($check.IsDir) {
        if (Test-Path $check.Path -PathType Container) {
            Write-Success "$($check.Name) exists"
            $passed++
        } else {
            Write-Error-Custom "$($check.Name) not found"
            $failed++
        }
    } else {
        if (Test-Path $check.Path -PathType Leaf) {
            Write-Success "$($check.Name) exists"
            $passed++
        } else {
            Write-Error-Custom "$($check.Name) not found"
            $failed++
        }
    }
}

# ============================================
# 3. CHECK ENV FILES
# ============================================
Write-Section "⚙️ ENVIRONMENT FILES"

if (Test-Path ".env.local" -PathType Leaf) {
    Write-Success ".env.local exists"
    $passed++
} else {
    Write-Warning-Custom ".env.local not found (create it from .env.example)"
    $failed++
}

if (Test-Path ".env.example" -PathType Leaf) {
    Write-Success ".env.example exists"
    $passed++
} else {
    Write-Error-Custom ".env.example not found"
    $failed++
}

# Check env contents
if (Test-Path ".env.local" -PathType Leaf) {
    $envContent = Get-Content ".env.local" -Raw

    if ($envContent -match "NEXT_PUBLIC_SUPABASE_URL") {
        Write-Success ".env.local has NEXT_PUBLIC_SUPABASE_URL"
        $passed++
    } else {
        Write-Warning-Custom ".env.local missing NEXT_PUBLIC_SUPABASE_URL"
        $failed++
    }

    if ($envContent -match "NEXT_PUBLIC_ANTHROPIC_API_KEY") {
        Write-Success ".env.local has NEXT_PUBLIC_ANTHROPIC_API_KEY"
        $passed++
    } else {
        Write-Warning-Custom ".env.local missing NEXT_PUBLIC_ANTHROPIC_API_KEY"
        $failed++
    }

    if ($envContent -match "STRIPE_SECRET_KEY") {
        Write-Success ".env.local has STRIPE_SECRET_KEY"
        $passed++
    } else {
        Write-Warning-Custom ".env.local missing STRIPE_SECRET_KEY"
        $failed++
    }
}

# ============================================
# 4. CHECK GIT STATUS
# ============================================
Write-Section "📌 GIT STATUS"

try {
    $gitDir = git rev-parse --git-dir 2>$null
    if ($gitDir) {
        Write-Success "Git repository initialized"
        $passed++
    }
} catch {
    Write-Error-Custom "Not a git repository"
    $failed++
}

# ============================================
# 5. CHECK DOCUMENTATION
# ============================================
Write-Section "📚 DOCUMENTATION"

$docs = @(
    "GUIA_APIS_PASO_A_PASO.md",
    "GUIA_SUPABASE_PRODUCCION.md",
    "GUIA_VERCEL_DEPLOYMENT.md",
    "GUIA_EAS_MOBILE_DEPLOYMENT.md",
    "SUPABASE_SEED_DATA.sql",
    "TESTING_CHECKLIST.csv",
    "TROUBLESHOOTING.md"
)

foreach ($doc in $docs) {
    if (Test-Path $doc -PathType Leaf) {
        Write-Success "$doc exists"
        $passed++
    } else {
        Write-Warning-Custom "$doc not found"
        $failed++
    }
}

# ============================================
# 6. CHECK node_modules
# ============================================
Write-Section "📦 DEPENDENCIES"

if (Test-Path "node_modules" -PathType Container) {
    Write-Success "Root node_modules exists"
    $passed++
} else {
    Write-Warning-Custom "Root node_modules not found (run: pnpm install)"
    $failed++
}

if (Test-Path "apps/web/node_modules" -PathType Container) {
    Write-Success "Web node_modules exists"
    $passed++
} else {
    Write-Warning-Custom "Web node_modules not found (run: pnpm install)"
    $failed++
}

# ============================================
# 7. SUMMARY
# ============================================
Write-Section "📊 VERIFICATION SUMMARY"

$total = $passed + $failed
Write-Host "Checks passed: " -NoNewline
Write-Host "$passed" -ForegroundColor Green
Write-Host "Checks failed: " -NoNewline
if ($failed -eq 0) {
    Write-Host "$failed" -ForegroundColor Green
} else {
    Write-Host "$failed" -ForegroundColor Red
}
Write-Host "Total: $total"

Write-Host ""

if ($failed -eq 0) {
    Write-Host "✅ ALL CHECKS PASSED" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Obtener APIs (GUIA_APIS_PASO_A_PASO.md)"
    Write-Host "2. Actualizar .env.local con valores"
    Write-Host "3. npm run dev (en apps/web)"
    Write-Host "4. Testear http://localhost:3001"
    Write-Host ""
} else {
    Write-Host "⚠️ SOME CHECKS FAILED" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please fix the issues above:" -ForegroundColor Yellow
    Write-Host "- Create .env.local from .env.example"
    Write-Host "- Run: pnpm install"
    Write-Host "- Check project structure"
    Write-Host ""
}
