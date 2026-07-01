# 🧪 TESTING UNITARIO GUIDE

**Fecha:** 2026-06-19  
**Target:** 50%+ cobertura  
**Tiempo:** ~2 horas setup + escritura

---

## 🎯 SETUP

### Instalar dependencias

```bash
cd apps/web
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event

# Para Next.js 15
npm install --save-dev @next/env
```

### jest.config.js

```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
}

module.exports = createJestConfig(customJestConfig)
```

### jest.setup.js

```javascript
import '@testing-library/jest-dom'
```

### package.json

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

---

## ✍️ ESCRIBIR TESTS

### Test 1: Schemas (Zod Validation)

**__tests__/schemas.test.ts:**

```typescript
import { loginSchema, cobraClientSchema } from '@/lib/schemas'

describe('Schemas', () => {
  describe('loginSchema', () => {
    it('accepts valid email and password', () => {
      const data = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      }
      expect(() => loginSchema.parse(data)).not.toThrow()
    })

    it('rejects short password', () => {
      const data = {
        email: 'test@example.com',
        password: 'short',
      }
      expect(() => loginSchema.parse(data)).toThrow()
    })

    it('rejects invalid email', () => {
      const data = {
        email: 'not-an-email',
        password: 'SecurePass123!',
      }
      expect(() => loginSchema.parse(data)).toThrow()
    })
  })

  describe('cobraClientSchema', () => {
    it('accepts valid client data', () => {
      const data = {
        name: 'ABC Corp',
        rfc: 'ABC123456789',
      }
      expect(() => cobraClientSchema.parse(data)).not.toThrow()
    })

    it('rejects short RFC', () => {
      const data = {
        name: 'ABC Corp',
        rfc: 'SHORT',
      }
      expect(() => cobraClientSchema.parse(data)).toThrow()
    })
  })
})
```

### Test 2: Utility Functions

**__tests__/utils.test.ts:**

```typescript
import { isValidRedirect, canSeeFinancials } from '@/lib/utils'

describe('isValidRedirect', () => {
  beforeEach(() => {
    // Mock window.location
    delete (window as any).location
    window.location = { origin: 'http://localhost:3000' } as any
  })

  it('accepts same-origin redirects', () => {
    expect(isValidRedirect('/hoy')).toBe(true)
    expect(isValidRedirect('http://localhost:3000/cobracheck')).toBe(true)
  })

  it('rejects cross-origin redirects', () => {
    expect(isValidRedirect('http://evil.com')).toBe(false)
    expect(isValidRedirect('https://attacker.com')).toBe(false)
  })

  it('rejects null/undefined', () => {
    expect(isValidRedirect(null)).toBe(false)
    expect(isValidRedirect(undefined)).toBe(false)
  })
})

describe('canSeeFinancials', () => {
  it('allows owner, admin, accountant', () => {
    expect(canSeeFinancials('owner')).toBe(true)
    expect(canSeeFinancials('admin')).toBe(true)
    expect(canSeeFinancials('accountant')).toBe(true)
  })

  it('denies other roles', () => {
    expect(canSeeFinancials('employee')).toBe(false)
    expect(canSeeFinancials('supervisor')).toBe(false)
  })
})
```

### Test 3: React Components

**__tests__/KPICard.test.tsx:**

```typescript
import { render, screen } from '@testing-library/react'
import { KPICard } from '@/components/KPICard'

describe('KPICard', () => {
  it('renders KPI title and value', () => {
    render(
      <KPICard
        title="Total Cartera"
        value={150000}
        icon="📊"
      />
    )

    expect(screen.getByText('Total Cartera')).toBeInTheDocument()
    expect(screen.getByText('$150,000')).toBeInTheDocument()
  })

  it('formats large numbers correctly', () => {
    render(
      <KPICard
        title="Balance"
        value={1000000}
      />
    )

    expect(screen.getByText('$1,000,000')).toBeInTheDocument()
  })

  it('applies color based on status', () => {
    const { container } = render(
      <KPICard
        title="Risk Score"
        value={75}
        status="high"
      />
    )

    const element = container.querySelector('.text-red-600')
    expect(element).toBeInTheDocument()
  })
})
```

---

## 🏃 EJECUTAR TESTS

```bash
# Tests una vez
npm test

# Watch mode (rerun on change)
npm run test:watch

# Coverage report
npm run test:coverage
```

---

## 📊 COVERAGE TARGETS

```
Line Coverage:       50%
Branch Coverage:     40%
Function Coverage:   50%
Statement Coverage:  50%
```

---

## 📋 TESTS A ESCRIBIR

| Prioridad | Módulo | Casos | Tiempo |
|-----------|--------|-------|--------|
| 🔴 Alta | Schemas | 8 | 30 min |
| 🔴 Alta | Utils | 10 | 30 min |
| 🟡 Media | Components | 5 | 30 min |
| 🟡 Media | Auth | 4 | 20 min |
| 🟢 Baja | API routes | 3 | 20 min |

**Total:** ~2 horas

---

## ✅ CHECKLIST

- [ ] Setup Jest
- [ ] Create jest.config.js
- [ ] Create jest.setup.js
- [ ] Add test scripts
- [ ] Write schema tests
- [ ] Write util tests
- [ ] Write component tests
- [ ] Coverage report

---

**Testing ready para CI/CD**
