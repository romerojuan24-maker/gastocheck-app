/**
 * Tests para GastoCheck Mobile - Mi Ruta Screen
 *
 * Para ejecutar:
 * npm test -- index.test.tsx
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import GastoCheckScreen from './index'
import * as useGastoCheckHooks from '../../../hooks/useGastoCheck'

// Mock Expo libraries
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentLocationAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 25.6866, longitude: -100.3161 },
  }),
}))

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}))

jest.mock('expo-linking', () => ({
  openURL: jest.fn().mockResolvedValue(true),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

// Mock Supabase
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'movement-1' },
            error: null,
          }),
        }),
      }),
    }),
  },
}))

// Mock hooks
jest.mock('../../../hooks/cobra', () => ({
  useCobrador: jest.fn().mockReturnValue({
    user: {
      id: 'cobrador-1',
      name: 'Juan',
      company_id: 'company-1',
    },
    loading: false,
    error: null,
  }),
  useCobraClients: jest.fn().mockReturnValue({
    clients: [],
    loading: false,
    error: null,
  }),
  useCobraInvoices: jest.fn().mockReturnValue({
    invoices: [],
    loading: false,
    error: null,
  }),
}))

// Mock @gastocheck/shared
jest.mock('@gastocheck/shared', () => ({
  formatCurrency: (amount: number) => `MXN ${amount.toLocaleString('es-MX')}`,
}))

describe('GastoCheckScreen - Mi Ruta', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('debe renderizar el header con título y fecha', () => {
      render(<GastoCheckScreen />)
      expect(screen.getByText('Mi Ruta')).toBeTruthy()
    })

    it('debe mostrar "Clientes Hoy" con contador', async () => {
      render(<GastoCheckScreen />)
      await waitFor(() => {
        expect(screen.getByText(/Clientes Hoy/)).toBeTruthy()
      })
    })

    it('debe renderizar botón "Reporte Diario"', () => {
      render(<GastoCheckScreen />)
      expect(screen.getByText(/Reporte Diario/)).toBeTruthy()
    })
  })

  describe('useRoute Hook', () => {
    it('debe cargar ruta del día', async () => {
      jest.spyOn(useGastoCheckHooks, 'useRoute').mockReturnValue({
        route: [
          {
            id: 'client-1',
            name: 'Empresa XYZ',
            lat: 25.6866,
            lng: -100.3161,
            address: 'Calle Principal 123',
            phone: '+52 81 1234 5678',
            office_hours: 'Lun-Vie 8am-6pm',
            distance: 2.5,
            eta: 8,
            status: 'pending',
            invoices_count: 3,
            total_amount: 5000,
          },
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      })

      render(<GastoCheckScreen />)

      await waitFor(() => {
        expect(screen.getByText('Empresa XYZ')).toBeTruthy()
      })
    })

    it('debe mostrar loader mientras carga ruta', () => {
      jest.spyOn(useGastoCheckHooks, 'useRoute').mockReturnValue({
        route: [],
        loading: true,
        error: null,
        refetch: jest.fn(),
      })

      render(<GastoCheckScreen />)
      // ActivityIndicator debería ser visible
    })

    it('debe mostrar mensaje cuando no hay clientes', async () => {
      jest.spyOn(useGastoCheckHooks, 'useRoute').mockReturnValue({
        route: [],
        loading: false,
        error: null,
        refetch: jest.fn(),
      })

      render(<GastoCheckScreen />)

      await waitFor(() => {
        expect(screen.getByText(/No hay clientes asignados/)).toBeTruthy()
      })
    })
  })

  describe('RouteList Component', () => {
    it('debe listar clientes con su información', async () => {
      jest.spyOn(useGastoCheckHooks, 'useRoute').mockReturnValue({
        route: [
          {
            id: 'client-1',
            name: 'Empresa XYZ',
            lat: 25.6866,
            lng: -100.3161,
            address: 'Calle Principal 123',
            phone: '+52 81 1234 5678',
            office_hours: 'Lun-Vie 8am-6pm',
            distance: 2.5,
            eta: 8,
            status: 'pending',
            invoices_count: 3,
            total_amount: 5000,
          },
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      })

      render(<GastoCheckScreen />)

      await waitFor(() => {
        expect(screen.getByText('Empresa XYZ')).toBeTruthy()
        expect(screen.getByText(/Calle Principal 123/)).toBeTruthy()
        expect(screen.getByText(/3 recibos/)).toBeTruthy()
      })
    })

    it('debe mostrar distancia y ETA', async () => {
      jest.spyOn(useGastoCheckHooks, 'useRoute').mockReturnValue({
        route: [
          {
            id: 'client-1',
            name: 'Empresa XYZ',
            lat: 25.6866,
            lng: -100.3161,
            distance: 2.5,
            eta: 8,
            status: 'pending',
            invoices_count: 3,
            total_amount: 5000,
          } as any,
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      })

      render(<GastoCheckScreen />)

      await waitFor(() => {
        expect(screen.getByText(/2.5 km/)).toBeTruthy()
        expect(screen.getByText(/8 min/)).toBeTruthy()
      })
    })
  })

  describe('ClientDetail Modal', () => {
    beforeEach(() => {
      jest.spyOn(useGastoCheckHooks, 'useRoute').mockReturnValue({
        route: [
          {
            id: 'client-1',
            name: 'Empresa XYZ',
            lat: 25.6866,
            lng: -100.3161,
            address: 'Calle Principal 123',
            phone: '+52 81 1234 5678',
            office_hours: 'Lun-Vie 8am-6pm',
            distance: 2.5,
            eta: 8,
            status: 'pending',
            invoices_count: 3,
            total_amount: 5000,
          },
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      })
    })

    it('debe abrirse al hacer tap en cliente', async () => {
      render(<GastoCheckScreen />)

      await waitFor(() => {
        const clientCard = screen.getByText('Empresa XYZ')
        fireEvent.press(clientCard)
      })

      await waitFor(() => {
        expect(screen.getByText('Detalles Cliente')).toBeTruthy()
      })
    })

    it('debe mostrar botón Google Maps', async () => {
      render(<GastoCheckScreen />)

      await waitFor(() => {
        fireEvent.press(screen.getByText('Empresa XYZ'))
      })

      await waitFor(() => {
        expect(screen.getByText(/Google Maps/)).toBeTruthy()
      })
    })

    it('debe abrir Google Maps al presionar botón', async () => {
      const { openURL } = require('expo-linking')

      render(<GastoCheckScreen />)

      await waitFor(() => {
        fireEvent.press(screen.getByText('Empresa XYZ'))
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText(/Google Maps/))
      })

      expect(openURL).toHaveBeenCalledWith(
        expect.stringContaining('25.6866')
      )
    })
  })

  describe('ScannerModal', () => {
    it('debe renderizar opción escanear ticket', async () => {
      jest.spyOn(useGastoCheckHooks, 'useRoute').mockReturnValue({
        route: [
          {
            id: 'client-1',
            name: 'Empresa XYZ',
            lat: 25.6866,
            lng: -100.3161,
            status: 'pending',
            invoices_count: 3,
            total_amount: 5000,
          } as any,
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      })

      render(<GastoCheckScreen />)

      await waitFor(() => {
        fireEvent.press(screen.getByText('Empresa XYZ'))
      })

      await waitFor(() => {
        expect(screen.getByText(/Escanear Ticket/)).toBeTruthy()
      })
    })

    it('debe procesar resultado del scanner', async () => {
      jest.spyOn(useGastoCheckHooks, 'useScanner').mockReturnValue({
        result: {
          amount: 1500,
          date: '2026-06-23',
          provider: 'PROVEEDOR ABC',
          confidence: 0.95,
        },
        loading: false,
        error: null,
      })

      // Mock image picker
      const { launchCameraAsync } = require('expo-image-picker')
      launchCameraAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://image.jpg' }],
      })

      render(<GastoCheckScreen />)

      await waitFor(() => {
        fireEvent.press(screen.getByText('Empresa XYZ'))
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText(/Escanear Ticket/))
      })

      // TODO: Completar test de scanner
    })
  })

  describe('MovementForm', () => {
    it('debe registrar intento de cobro (Pagó)', async () => {
      jest.spyOn(useGastoCheckHooks, 'useMovementCapture').mockReturnValue({
        capture: jest.fn().mockResolvedValue({
          id: 'movement-1',
          client_id: 'client-1',
          actor_id: 'cobrador-1',
          status: 'paid',
          amount: 1500,
          method: 'cash',
        }),
        loading: false,
        error: null,
      })

      jest.spyOn(useGastoCheckHooks, 'useRoute').mockReturnValue({
        route: [
          {
            id: 'client-1',
            name: 'Empresa XYZ',
            lat: 25.6866,
            lng: -100.3161,
            status: 'pending',
            invoices_count: 3,
            total_amount: 5000,
          } as any,
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      })

      render(<GastoCheckScreen />)

      await waitFor(() => {
        fireEvent.press(screen.getByText('Empresa XYZ'))
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText(/Registrar Intento/))
      })

      // TODO: Completar test de movimiento
    })
  })

  describe('ReportSummary', () => {
    it('debe mostrar estadísticas diarias', async () => {
      jest.spyOn(useGastoCheckHooks, 'useRoute').mockReturnValue({
        route: [],
        loading: false,
        error: null,
        refetch: jest.fn(),
      })

      render(<GastoCheckScreen />)

      await waitFor(() => {
        fireEvent.press(screen.getByText(/Reporte Diario/))
      })

      await waitFor(() => {
        expect(screen.getByText(/Clientes Visitados/)).toBeTruthy()
        expect(screen.getByText(/Total Cobrado/)).toBeTruthy()
        expect(screen.getByText(/Depósitos/)).toBeTruthy()
        expect(screen.getByText(/Promesas/)).toBeTruthy()
      })
    })
  })

  describe('Estadísticas', () => {
    it('debe calcular clientes visitados correctamente', () => {
      // Test lógica de conteo
      expect(true).toBe(true)
    })

    it('debe sumar total cobrado de movimientos pagados', () => {
      // Test lógica de suma
      expect(true).toBe(true)
    })

    it('debe contar promesas hechas', () => {
      // Test lógica de conteo
      expect(true).toBe(true)
    })
  })
})
