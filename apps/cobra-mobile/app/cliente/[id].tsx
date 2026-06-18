import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useCobraInvoices } from "../../hooks/cobra"
import { CobraInvoice } from "@gastocheck/shared"

export default function ClienteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { invoices, loading } = useCobraInvoices(id)

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#36BF6A" />
      </View>
    )
  }

  const totalPending = invoices.reduce(
    (sum, inv) => sum + (inv.total - inv.paid),
    0
  )
  const totalInvoices = invoices.length

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "#22c55e"
      case "partial":
        return "#f97316"
      case "pending":
        return "#ef4444"
      case "overdue":
        return "#7c2d12"
      default:
        return "#666"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "paid":
        return "Pagada"
      case "partial":
        return "Parcial"
      case "pending":
        return "Pendiente"
      case "overdue":
        return "Vencida"
      default:
        return status
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Facturas</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Facturas</Text>
          <Text style={styles.summaryValue}>{totalInvoices}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Pendiente total</Text>
          <Text style={styles.summaryValue}>
            ${totalPending.toLocaleString("es-MX")}
          </Text>
        </View>
      </View>

      <View style={styles.invoicesList}>
        {invoices.map((inv) => (
          <TouchableOpacity
            key={inv.id}
            style={styles.invoiceCard}
            onPress={() => router.push(`/factura/${inv.id}`)}
          >
            <View style={styles.invoiceHeader}>
              <Text style={styles.folio}>{inv.folio}</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(inv.status) },
                ]}
              >
                <Text style={styles.statusText}>
                  {getStatusLabel(inv.status)}
                </Text>
              </View>
            </View>

            <View style={styles.invoiceRow}>
              <Text style={styles.label}>Monto</Text>
              <Text style={styles.value}>
                ${inv.total.toLocaleString("es-MX")}
              </Text>
            </View>

            <View style={styles.invoiceRow}>
              <Text style={styles.label}>Pagado</Text>
              <Text style={styles.value}>
                ${inv.paid.toLocaleString("es-MX")}
              </Text>
            </View>

            <View style={styles.invoiceRow}>
              <Text style={styles.label}>Vencimiento</Text>
              <Text style={styles.value}>
                {new Date(inv.due_date).toLocaleDateString("es-MX")}
              </Text>
            </View>

            {inv.total - inv.paid > 0 && (
              <View style={styles.pendingBar}>
                <View
                  style={{
                    width: `${((inv.total - inv.paid) / inv.total) * 100}%`,
                    height: 4,
                    backgroundColor: getStatusColor(inv.status),
                  }}
                />
              </View>
            )}
          </TouchableOpacity>
        ))}
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    color: "#36BF6A",
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  summaryCard: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginVertical: 12,
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#182535",
  },
  invoicesList: {
    paddingHorizontal: 12,
    gap: 8,
  },
  invoiceCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
  },
  invoiceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  folio: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#182535",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  invoiceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: "#999",
  },
  value: {
    fontSize: 12,
    fontWeight: "600",
    color: "#182535",
  },
  pendingBar: {
    height: 4,
    backgroundColor: "#e0e0e0",
    borderRadius: 2,
    marginTop: 8,
    overflow: "hidden",
  },
})
