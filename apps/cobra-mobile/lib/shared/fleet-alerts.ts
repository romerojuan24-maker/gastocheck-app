// Lógica de alertas inteligentes para flotillas
// Detección de anomalías: robo de combustible, mantenimiento preventivo, etc.

export interface FuelAlert {
  vehicle_id: string;
  type: 'anomaly' | 'maintenance' | 'efficiency';
  message: string;
  severity: 'low' | 'medium' | 'high';
  value: number;
  threshold: number;
  recommendations: string[];
}

/**
 * Detecta robo de combustible basándose en km/litro
 * Si el promedio baja >15%, es una anomalía
 */
export function detectFuelTheft(
  historicalKmPerLiter: number,
  currentKmPerLiter: number,
): FuelAlert | null {
  const threshold = 0.85; // -15% de cambio
  const ratio = currentKmPerLiter / historicalKmPerLiter;

  if (ratio < threshold) {
    return {
      vehicle_id: '',
      type: 'anomaly',
      message: `⚠️ Anomalía: Rendimiento de ${(ratio * 100).toFixed(1)}% del histórico`,
      severity: 'high',
      value: currentKmPerLiter,
      threshold: historicalKmPerLiter * threshold,
      recommendations: [
        'Revisar medidor de combustible',
        'Verificar posible robo o fuga',
        'Auditar paradas y consumo del operador',
      ],
    };
  }

  return null;
}

/**
 * Predice mantenimiento basándose en km acumulados
 * Intervalos estándar: cambio aceite cada 5000 km, inspección cada 10000 km
 */
export function predictMaintenance(
  currentKm: number,
  lastOilChange: number,
  lastInspection: number,
): FuelAlert[] {
  const alerts: FuelAlert[] = [];
  const OIL_CHANGE_INTERVAL = 5000;
  const INSPECTION_INTERVAL = 10000;
  const WARNING_MARGIN = 500; // Alertar 500 km antes

  const kmSinceOilChange = currentKm - lastOilChange;
  if (kmSinceOilChange > OIL_CHANGE_INTERVAL - WARNING_MARGIN) {
    alerts.push({
      vehicle_id: '',
      type: 'maintenance',
      message: `🛢️ Cambio de aceite próximo en ${Math.max(0, OIL_CHANGE_INTERVAL - kmSinceOilChange).toFixed(0)} km`,
      severity: kmSinceOilChange > OIL_CHANGE_INTERVAL ? 'high' : 'medium',
      value: kmSinceOilChange,
      threshold: OIL_CHANGE_INTERVAL,
      recommendations: [
        'Agendar cita con mecánico',
        'Revisar nivel de aceite regularmente',
        'Usar aceite 5W-30 especificado',
      ],
    });
  }

  const kmSinceInspection = currentKm - lastInspection;
  if (kmSinceInspection > INSPECTION_INTERVAL - WARNING_MARGIN) {
    alerts.push({
      vehicle_id: '',
      type: 'maintenance',
      message: `🔧 Inspección general próxima en ${Math.max(0, INSPECTION_INTERVAL - kmSinceInspection).toFixed(0)} km`,
      severity: kmSinceInspection > INSPECTION_INTERVAL ? 'high' : 'medium',
      value: kmSinceInspection,
      threshold: INSPECTION_INTERVAL,
      recommendations: [
        'Revisar frenos, llantas y suspensión',
        'Probar luces y sistemas eléctricos',
        'Inspeccionar cinturones y mangueras',
      ],
    });
  }

  return alerts;
}

/**
 * Análisis de eficiencia por operador
 * Compara gasto promedio vs esperado para el tipo de vehículo
 */
export function analyzeOperatorEfficiency(
  operatorSpending: number,
  monthlyDistance: number,
  vehicleType: string,
): FuelAlert | null {
  // Gastos esperados por tipo (estimado)
  const expectedSpendingPerKm: Record<string, number> = {
    'compact': 0.8,        // $0.80 por km
    'sedan': 1.0,
    'suv': 1.3,
    'pickup': 1.2,
    'van': 1.5,
  };

  const expectedSpending = (expectedSpendingPerKm[vehicleType] ?? 1.0) * monthlyDistance;
  const variance = (operatorSpending - expectedSpending) / expectedSpending;

  if (variance > 0.2) { // +20% vs esperado
    return {
      vehicle_id: '',
      type: 'efficiency',
      message: `📊 Gasto +${(variance * 100).toFixed(0)}% vs esperado`,
      severity: variance > 0.3 ? 'high' : 'medium',
      value: operatorSpending,
      threshold: expectedSpending,
      recommendations: [
        'Revisar estilo de conducción del operador',
        'Verificar congestión de rutas',
        'Controlar presión de llantas',
        'Auditar paradas no autorizadas',
      ],
    };
  }

  return null;
}
