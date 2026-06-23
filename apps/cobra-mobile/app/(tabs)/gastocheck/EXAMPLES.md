# GastoCheck Mobile - Ejemplos de Uso

## Uso Básico del Componente

### Importar en la App
```typescript
import GastoCheckScreen from './gastocheck'

export default function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="GastoCheck"
        component={GastoCheckScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  )
}
```

### O en Tabs
```typescript
// app/(tabs)/_layout.tsx
import GastoCheckScreen from './gastocheck'

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="gastocheck"
        component={GastoCheckScreen}
        options={{
          title: 'Mi Ruta',
          tabBarIcon: ({ color }) => <MapPin color={color} />,
        }}
      />
    </Tabs>
  )
}
```

---

## Usar Hooks Individualmente

### useRoute - Cargar Ruta del Día

```typescript
import { useRoute } from '../../../hooks/useGastoCheck'

function MyRouteComponent() {
  const { route, loading, error, refetch } = useRoute(
    'cobrador-id-123',
    '2026-06-23'
  )

  if (loading) return <ActivityIndicator />
  if (error) return <Text>Error: {error}</Text>

  return (
    <FlatList
      data={route}
      renderItem={({ item }) => (
        <View>
          <Text>{item.name}</Text>
          <Text>{item.distance} km</Text>
        </View>
      )}
    />
  )
}
```

### useScanner - Escanear Foto

```typescript
import { useScanner } from '../../../hooks/useGastoCheck'
import * as ImagePicker from 'expo-image-picker'

function ScannerComponent() {
  const [imageUri, setImageUri] = useState<string | null>(null)
  const { result, loading, error } = useScanner(imageUri)

  const handleTakePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })

    if (!result.canceled) {
      setImageUri(result.assets[0].uri)
    }
  }

  return (
    <View>
      <TouchableOpacity onPress={handleTakePhoto}>
        <Text>📸 Tomar Foto</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator />}

      {result && (
        <View>
          <Text>Monto: {result.amount}</Text>
          <Text>Fecha: {result.date}</Text>
          <Text>Proveedor: {result.provider}</Text>
          <Text>Confianza: {(result.confidence! * 100).toFixed(0)}%</Text>
        </View>
      )}

      {error && <Text>Error: {error}</Text>}
    </View>
  )
}
```

### useMovementCapture - Registrar Intento

```typescript
import { useMovementCapture } from '../../../hooks/useGastoCheck'

function CaptureMovementComponent() {
  const { capture, loading, error } = useMovementCapture()

  const handleCapturePaid = async () => {
    const movement = await capture({
      client_id: 'client-123',
      actor_id: 'cobrador-123',
      status: 'paid',
      amount: 1500,
      method: 'cash',
      notes: 'Cliente pagó en efectivo sin problema',
    })

    if (movement) {
      console.log('Intento registrado:', movement.id)
    } else {
      console.log('Error:', error)
    }
  }

  const handleCapturePromise = async () => {
    const movement = await capture({
      client_id: 'client-123',
      actor_id: 'cobrador-123',
      status: 'promise',
      amount: 1500,
      promise_date: '2026-06-30',
      notes: 'Promete pagar el 30 de junio',
    })

    if (movement) {
      console.log('Promesa registrada')
    }
  }

  return (
    <View>
      <TouchableOpacity onPress={handleCapturePaid}>
        <Text>✓ Registrar Pago</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleCapturePromise}>
        <Text>🤝 Registrar Promesa</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator />}
    </View>
  )
}
```

### useDailyReport - Generar Reporte

```typescript
import { useDailyReport } from '../../../hooks/useGastoCheck'

function ReportComponent() {
  const { generate, loading, error } = useDailyReport()

  const handleGenerateReport = async () => {
    const report = await generate('cobrador-123', '2026-06-23')

    if (report) {
      console.log('Reporte generado:', {
        visitados: report.clients_visited,
        cobrado: report.total_collected,
        promesas: report.promises_made,
      })
    } else {
      console.log('Error:', error)
    }
  }

  return (
    <TouchableOpacity onPress={handleGenerateReport}>
      <Text>📊 Generar Reporte</Text>
    </TouchableOpacity>
  )
}
```

---

## Ejemplo: Componente Custom - "Mi Resumen Diario"

```typescript
import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import {
  useMovementsByDate,
  useRoute,
  useCashDeposits,
} from '../../../hooks/useGastoCheck'
import { formatCurrency } from '@gastocheck/shared'

interface DailySummaryProps {
  actorId: string
  date: string
}

export function DailySummary({ actorId, date }: DailySummaryProps) {
  const { route } = useRoute(actorId, date)
  const { movements } = useMovementsByDate(actorId, date)
  const { deposits } = useCashDeposits(actorId, date)

  // Calcular estadísticas
  const stats = {
    totalClientes: route.length,
    clientesVisitados: new Set(movements.map((m) => m.client_id)).size,
    totalPendiente: route.reduce((sum, r) => sum + r.total_amount, 0),
    totalCobrado: movements
      .filter((m) => m.status === 'paid')
      .reduce((sum, m) => sum + m.amount, 0),
    totalDepositos: deposits.reduce((sum, d) => sum + d.amount, 0),
    promesas: movements.filter((m) => m.status === 'promise').length,
  }

  const porcentajeCompleto = (stats.clientesVisitados / stats.totalClientes) * 100

  return (
    <View style={styles.container}>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${porcentajeCompleto}%` },
          ]}
        />
      </View>
      <Text style={styles.progressText}>
        {stats.clientesVisitados}/{stats.totalClientes} completado
      </Text>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Por Cobrar</Text>
          <Text style={styles.statValue}>
            {formatCurrency(stats.totalPendiente)}
          </Text>
          <Text style={styles.statDelta}>
            -{formatCurrency(stats.totalPendiente - stats.totalCobrado)}
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Cobrado</Text>
          <Text style={styles.statValue}>
            {formatCurrency(stats.totalCobrado)}
          </Text>
          <Text style={styles.statPercent}>
            {((stats.totalCobrado / stats.totalPendiente) * 100).toFixed(0)}%
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Promesas</Text>
          <Text style={styles.statValue}>{stats.promesas}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Depósitos</Text>
          <Text style={styles.statValue}>
            {formatCurrency(stats.totalDepositos)}
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#36BF6A',
  },
  progressText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '48%',
    padding: 10,
    backgroundColor: '#0f172a',
    borderRadius: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#36BF6A',
  },
  statDelta: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 4,
  },
  statPercent: {
    fontSize: 11,
    color: '#36BF6A',
    marginTop: 4,
  },
})
```

---

## Ejemplo: Integración con Navigator

```typescript
// app/(tabs)/_layout.tsx

import { Tabs } from 'expo-router'
import { MapPin, Clock, FileText, Settings } from 'lucide-react-native'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#36BF6A',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          backgroundColor: '#182535',
          borderTopColor: '#1e293b',
        },
        headerStyle: {
          backgroundColor: '#182535',
        },
        headerTintColor: '#fff',
      }}
    >
      {/* Mi Ruta - Captura en campo */}
      <Tabs.Screen
        name="gastocheck"
        options={{
          title: 'Mi Ruta',
          tabBarIcon: ({ color }) => <MapPin size={24} color={color} />,
          headerShown: false,
        }}
      />

      {/* Clientes - Vista de contactos */}
      <Tabs.Screen
        name="clientes"
        options={{
          title: 'Clientes',
          tabBarIcon: ({ color }) => <Users size={24} color={color} />,
        }}
      />

      {/* Historial - Movimientos del día */}
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          tabBarIcon: ({ color }) => <Clock size={24} color={color} />,
        }}
      />

      {/* Reportes - Resúmenes diarios */}
      <Tabs.Screen
        name="reportes"
        options={{
          title: 'Reportes',
          tabBarIcon: ({ color }) => <FileText size={24} color={color} />,
        }}
      />

      {/* Perfil */}
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
        }}
      />
    </Tabs>
  )
}
```

---

## Ejemplo: Test para Componente Custom

```typescript
import { render, screen, waitFor } from '@testing-library/react-native'
import { DailySummary } from './DailySummary'
import * as useGastoCheckHooks from '../../../hooks/useGastoCheck'

jest.mock('../../../hooks/useGastoCheck')

describe('DailySummary', () => {
  it('debe mostrar progreso de clientes visitados', async () => {
    const mockUseRoute = jest.spyOn(useGastoCheckHooks, 'useRoute')
    const mockUseMovementsByDate = jest.spyOn(
      useGastoCheckHooks,
      'useMovementsByDate'
    )
    const mockUseCashDeposits = jest.spyOn(
      useGastoCheckHooks,
      'useCashDeposits'
    )

    mockUseRoute.mockReturnValue({
      route: [
        { id: '1', name: 'Cliente 1', total_amount: 5000 } as any,
        { id: '2', name: 'Cliente 2', total_amount: 3000 } as any,
        { id: '3', name: 'Cliente 3', total_amount: 2000 } as any,
      ],
      loading: false,
      error: null,
      refetch: jest.fn(),
    })

    mockUseMovementsByDate.mockReturnValue({
      movements: [
        {
          id: '1',
          client_id: '1',
          status: 'paid',
          amount: 5000,
        } as any,
      ],
      loading: false,
      error: null,
      refetch: jest.fn(),
    })

    mockUseCashDeposits.mockReturnValue({
      deposits: [{ amount: 5000 } as any],
      loading: false,
      error: null,
    })

    render(<DailySummary actorId="cobrador-1" date="2026-06-23" />)

    await waitFor(() => {
      expect(screen.getByText('1/3 completado')).toBeTruthy()
      expect(screen.getByText(/Cobrado/)).toBeTruthy()
    })
  })
})
```

---

## Ejemplo: Datos de Prueba para Desarrollo

```typescript
// hooks/useGastoCheck.mock.ts

export const mockRoute = [
  {
    id: 'client-1',
    name: 'Tienda Central',
    lat: 25.6866,
    lng: -100.3161,
    address: 'Centro Comercial, Monterrey',
    phone: '+52 81 1234 5678',
    office_hours: 'Lun-Vie 8am-6pm',
    distance: 2.5,
    eta: 8,
    status: 'pending' as const,
    invoices_count: 3,
    total_amount: 5000,
  },
  {
    id: 'client-2',
    name: 'Negocio ABC',
    lat: 25.6900,
    lng: -100.3200,
    address: 'Avenida Reforma 456',
    phone: '+52 81 2345 6789',
    office_hours: 'Lun-Sab 9am-7pm',
    distance: 5.2,
    eta: 15,
    status: 'pending' as const,
    invoices_count: 2,
    total_amount: 8000,
  },
]

export const mockScanResult = {
  amount: 1500.5,
  date: '2026-06-23',
  provider: 'PROVEEDOR EJEMPLO S.A.',
  confidence: 0.95,
}

export const mockMovements = [
  {
    id: 'mov-1',
    client_id: 'client-1',
    actor_id: 'cobrador-1',
    movement_date: new Date().toISOString(),
    status: 'paid' as const,
    amount: 2500,
    method: 'cash' as const,
  },
  {
    id: 'mov-2',
    client_id: 'client-2',
    actor_id: 'cobrador-1',
    movement_date: new Date().toISOString(),
    status: 'promise' as const,
    amount: 4000,
    promise_date: '2026-06-30',
  },
]
```

---

## Cómo Usar Datos Mock en Desarrollo

```typescript
// En environment de desarrollo
import { mockRoute, mockScanResult } from '../mocks/useGastoCheck.mock'

const isDev = __DEV__

export function useRoute(actorId: string, date: string) {
  if (isDev && !actorId) {
    return {
      route: mockRoute,
      loading: false,
      error: null,
      refetch: () => Promise.resolve(),
    }
  }

  // ... código real
}
```

---

## Preguntas Frecuentes

### P: ¿Cómo agregar más campos a MovementForm?

```typescript
// En index.tsx, en MovementForm

<Text style={styles.formLabel}>Foto de Referencia</Text>
<TouchableOpacity onPress={pickPhoto}>
  <Text>📷 Adjuntar Foto</Text>
</TouchableOpacity>

{photoUri && (
  <Image source={{ uri: photoUri }} style={{ height: 200 }} />
)}
```

### P: ¿Cómo sincronizar offline?

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'

async function saveMovementOffline(movement: Movement) {
  const stored = await AsyncStorage.getItem('movements_offline')
  const movements = stored ? JSON.parse(stored) : []
  movements.push(movement)
  await AsyncStorage.setItem('movements_offline', JSON.stringify(movements))
}

async function syncOnlineMovements() {
  const stored = await AsyncStorage.getItem('movements_offline')
  if (!stored) return

  const movements = JSON.parse(stored)
  for (const movement of movements) {
    await capture(movement)
  }

  await AsyncStorage.removeItem('movements_offline')
}
```

### P: ¿Cómo agregar notificaciones push?

```typescript
import * as Notifications from 'expo-notifications'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

// Cuando llega nueva ruta
async function notifyNewRoute() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📍 Nueva Ruta Disponible',
      body: '5 clientes asignados para hoy',
      data: { screen: 'gastocheck' },
    },
    trigger: { seconds: 1 },
  })
}
```

---

## Recursos

- [Documentación Completa](./../../docs/GASTOCHECK_MOBILE_RUTA.md)
- [Setup e Instalación](./GASTOCHECK_SETUP.md)
- [Tests](./index.test.tsx)
- [Hooks](./../../hooks/useGastoCheck.ts)
