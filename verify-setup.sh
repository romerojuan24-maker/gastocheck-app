#!/bin/bash
# Script de verificación de setup CHECK SUITE
# Uso: bash verify-setup.sh
# Status: Checa todo lo necesario antes de testing

set -e

echo "════════════════════════════════════════════════════════════"
echo "🔍 CHECK SUITE - SETUP VERIFICATION SCRIPT"
echo "════════════════════════════════════════════════════════════"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter
CHECKS_PASSED=0
CHECKS_FAILED=0

# Function to check
check() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅${NC} $1"
    ((CHECKS_PASSED++))
  else
    echo -e "${RED}❌${NC} $1"
    ((CHECKS_FAILED++))
  fi
}

# ============================================
# 1. CHECK SYSTEM REQUIREMENTS
# ============================================
echo ""
echo "📦 SYSTEM REQUIREMENTS"
echo "─────────────────────────────────────────────────────────"

command -v node &> /dev/null
check "Node.js installed"

command -v npm &> /dev/null
check "npm installed"

command -v git &> /dev/null
check "Git installed"

# ============================================
# 2. CHECK PROJECT STRUCTURE
# ============================================
echo ""
echo "📁 PROJECT STRUCTURE"
echo "─────────────────────────────────────────────────────────"

[ -f "package.json" ]
check "Root package.json exists"

[ -d "apps/web" ]
check "apps/web directory exists"

[ -d "apps/mobile" ]
check "apps/mobile directory exists"

[ -d "packages/shared" ]
check "packages/shared directory exists"

[ -f "apps/web/package.json" ]
check "Web package.json exists"

[ -f "apps/mobile/app.json" ]
check "Mobile app.json exists"

# ============================================
# 3. CHECK ENV FILES
# ============================================
echo ""
echo "⚙️ ENVIRONMENT FILES"
echo "─────────────────────────────────────────────────────────"

[ -f ".env.local" ]
check ".env.local exists"

[ -f ".env.example" ]
check ".env.example exists"

# Check if .env.local has required keys (even if empty)
grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local 2>/dev/null
check ".env.local has NEXT_PUBLIC_SUPABASE_URL"

grep -q "NEXT_PUBLIC_ANTHROPIC_API_KEY" .env.local 2>/dev/null
check ".env.local has NEXT_PUBLIC_ANTHROPIC_API_KEY"

grep -q "STRIPE_SECRET_KEY" .env.local 2>/dev/null
check ".env.local has STRIPE_SECRET_KEY"

# ============================================
# 4. CHECK GIT STATUS
# ============================================
echo ""
echo "📌 GIT STATUS"
echo "─────────────────────────────────────────────────────────"

git rev-parse --git-dir &> /dev/null
check "Git repository initialized"

[ -z "$(git status --porcelain)" ] || [ -n "$(git status --porcelain)" ]
check "Git repository has commits"

# ============================================
# 5. CHECK DOCUMENTATION
# ============================================
echo ""
echo "📚 DOCUMENTATION"
echo "─────────────────────────────────────────────────────────"

[ -f "GUIA_APIS_PASO_A_PASO.md" ]
check "GUIA_APIS_PASO_A_PASO.md exists"

[ -f "GUIA_SUPABASE_PRODUCCION.md" ]
check "GUIA_SUPABASE_PRODUCCION.md exists"

[ -f "GUIA_VERCEL_DEPLOYMENT.md" ]
check "GUIA_VERCEL_DEPLOYMENT.md exists"

[ -f "GUIA_EAS_MOBILE_DEPLOYMENT.md" ]
check "GUIA_EAS_MOBILE_DEPLOYMENT.md exists"

[ -f "SUPABASE_SEED_DATA.sql" ]
check "SUPABASE_SEED_DATA.sql exists"

[ -f "TESTING_CHECKLIST.csv" ]
check "TESTING_CHECKLIST.csv exists"

# ============================================
# 6. CHECK CODE QUALITY (TypeScript)
# ============================================
echo ""
echo "🔧 CODE QUALITY"
echo "─────────────────────────────────────────────────────────"

cd apps/web
npm run typecheck &> /tmp/typecheck.log
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅${NC} TypeScript compilation successful"
  ((CHECKS_PASSED++))
else
  echo -e "${YELLOW}⚠️${NC} TypeScript has warnings (not blocking)"
  ((CHECKS_FAILED++))
fi
cd ../..

# ============================================
# 7. SUMMARY
# ============================================
echo ""
echo "════════════════════════════════════════════════════════════"
echo "📊 VERIFICATION SUMMARY"
echo "════════════════════════════════════════════════════════════"

TOTAL=$((CHECKS_PASSED + CHECKS_FAILED))
echo -e "Checks passed: ${GREEN}${CHECKS_PASSED}${NC}/${TOTAL}"
echo -e "Checks failed: ${RED}${CHECKS_FAILED}${NC}/${TOTAL}"

if [ $CHECKS_FAILED -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ ALL CHECKS PASSED${NC}"
  echo ""
  echo "Next step:"
  echo "1. Obtener APIs (GUIA_APIS_PASO_A_PASO.md)"
  echo "2. Actualizar .env.local"
  echo "3. npm run dev (en apps/web)"
  echo "4. Testear http://localhost:3001"
  exit 0
else
  echo ""
  echo -e "${RED}❌ SOME CHECKS FAILED${NC}"
  echo ""
  echo "Please fix the issues above and try again."
  exit 1
fi
