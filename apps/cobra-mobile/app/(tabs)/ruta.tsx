import { View, Text, StyleSheet, ScrollView } from "react-native"
import { useEffect, useState } from "react"
import * as Location from "expo-location"
import { formatCurrency } from "@gastocheck/shared"

interface RutaStats {
  visitados: number
  total: number
  cobrado: number
  promesas: number
  distancia: number
}

export default function RutaScreen() {
  const [stats, setStats] = useState<RutaStats>({
    visitados: 0,
    total: 0,
    cobrado: 0,
    promesas: 0,
    distancia: 0,
  })
  const [location, setLocation] = useState<Location.LocationObject | null>(null)

  useEffect(() => {
    initLocation()
    loadRoutaStats()
  }, [])

  const initLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status === "granted") {
      const loc = await Location.getCurrentLocationAsync({})
      setLocation(loc)
    }
  }

  const loadRoutaStats = async () => {
    // TODO: cargar desde Supabase daily_routes
    setStats({
      visitados: 3,
      total: 5,
      cobrado: 2500,
      promesas: 1,
      distancia: 8.5,
    })
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.date}>18 de junio, 2026</Text>
        <Text style={styles.progress}>
          {stats.visitados}/{stats.total} visitados
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Cobrado</Text>
          <Text style={styles.statValue}>
            ${(stats.cobrado / 1000).toFixed(1)}k
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Promesas</Text>
          <Text style={styles.statValue}>{stats.promesas}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Distancia</Text>
          <Text style={styles.statValue}>{stats.distancia} km</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Clientes hoy</Text>
        <View style={styles.clienteList}>
          <View style={styles.clienteItem}>
            <Text style={styles.time}>10:15</Text>
            <Text style={styles.nombre}>Cliente 1</Text>
            <Text style={styles.result}>✅ Pago $2,500</Text>
          </View>
          <View style={styles.clienteItem}>
            <Text style={styles.time}>11:30</Text>
            <Text style={styles.nombre}>Cliente 2</Text>
            <Text style={styles.result}>🤝 Promesa 20/06</Text>
          </View>
          <View style={styles.clienteItem}>
            <Text style={styles.time}>12:45</Text>
            <Text style={styles.nombre}>Cliente 3</Text>
            <Text style={styles.result}>⏳ En ruta</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#182535",
    padding: 20,
    alignItems: "center",
  },
  date: {
    color: "#fff",
    fontSize: 14,
    opacity: 0.8,
  },
  progress: {
    color: "#36BF6A",
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#182535",
  },
  section: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#182535",
    marginBottom: 12,
  },
  clienteList: {
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
  },
  clienteItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  time: {
    fontSize: 12,
    color: "#999",
  },
  nombre: {
    fontSize: 14,
    fontWeight: "600",
    color: "#182535",
    marginTop: 4,
  },
  result: {
    fontSize: 13,
    color: "#36BF6A",
    marginTop: 4,
  },
})
