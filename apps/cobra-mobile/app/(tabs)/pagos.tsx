import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native"
import { useState } from "react"

interface Pago {
  id: string
  cliente: string
  monto: number
  metodo: string
  fecha: string
}

export default function PagosScreen() {
  const [pagos, setPagos] = useState<Pago[]>([
    {
      id: "1",
      cliente: "Cliente 1",
      monto: 2500,
      metodo: "Efectivo",
      fecha: "18/06 10:15",
    },
    {
      id: "2",
      cliente: "Cliente 3",
      monto: 1200,
      metodo: "Transfer",
      fecha: "17/06 14:30",
    },
  ])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.total}>Total Hoy: $3,700</Text>
      </View>

      <FlatList
        data={pagos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.pagoCard}>
            <View style={styles.info}>
              <Text style={styles.cliente}>{item.cliente}</Text>
              <Text style={styles.fecha}>{item.fecha}</Text>
            </View>
            <View style={styles.right}>
              <Text style={styles.monto}>${item.monto}</Text>
              <Text style={styles.metodo}>{item.metodo}</Text>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab}>
        <Text style={styles.fabText}>+ Registrar Pago</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#36BF6A",
    padding: 20,
    alignItems: "center",
  },
  total: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  pagoCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#36BF6A",
  },
  info: {
    flex: 1,
  },
  cliente: {
    fontSize: 14,
    fontWeight: "600",
    color: "#182535",
  },
  fecha: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  right: {
    alignItems: "flex-end",
  },
  monto: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#36BF6A",
  },
  metodo: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  fab: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    backgroundColor: "#182535",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  fabText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
})
