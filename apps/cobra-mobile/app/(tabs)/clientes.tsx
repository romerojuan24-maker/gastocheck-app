import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native"
import { CobraClient } from "@gastocheck/shared"
import { Link } from "expo-router"
import { useCobraClients, useCobrador } from "../../hooks/cobra"

export default function ClientesScreen() {
  const { user } = useCobrador()
  const { clients, loading, refetch } = useCobraClients(user?.company_id || "")

  const getRiskColor = (score: number) => {
    if (score >= 80) return "#ff4444"
    if (score >= 60) return "#ffaa00"
    if (score >= 40) return "#ff8800"
    return "#44aa44"
  }

  if (loading && !user) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#36BF6A" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={clients}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Link href={`/cliente/${item.id}`} asChild>
            <TouchableOpacity style={styles.clienteCard}>
              <View style={styles.header}>
                <Text style={styles.nombre}>{item.name}</Text>
                <View
                  style={[
                    styles.riskBadge,
                    { backgroundColor: getRiskColor(item.risk_score) },
                  ]}
                >
                  <Text style={styles.riskText}>{item.risk_score}/100</Text>
                </View>
              </View>
              <Text style={styles.cartera}>
                Saldo: ${item.current_balance.toLocaleString("es-MX")}
              </Text>
              <Text style={styles.status}>{item.status}</Text>
            </TouchableOpacity>
          </Link>
        )}
        refreshing={loading}
        onRefresh={refetch}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>Sin clientes asignados</Text>
          ) : null
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  clienteCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginVertical: 6,
    borderLeftWidth: 4,
    borderLeftColor: "#36BF6A",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  nombre: {
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
    color: "#182535",
  },
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  riskText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  cartera: {
    fontSize: 14,
    color: "#36BF6A",
    fontWeight: "600",
    marginBottom: 4,
  },
  status: {
    fontSize: 12,
    color: "#999",
  },
  empty: {
    textAlign: "center",
    color: "#999",
    marginTop: 40,
    fontSize: 14,
  },
})
