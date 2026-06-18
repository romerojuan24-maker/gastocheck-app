import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
} from "react-native"
import { useState, useEffect } from "react"
import { useCobraClients, useCobrador } from "../../hooks/cobra"

interface Pago {
  id: string
  cliente: string
  monto: number
  metodo: string
  fecha: string
}

export default function PagosScreen() {
  const { user } = useCobrador()
  const { clients } = useCobraClients(user?.company_id || "")
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
      metodo: "Transferencia",
      fecha: "17/06 14:30",
    },
  ])
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    cliente_id: "",
    monto: "",
    metodo: "cash",
    referencia: "",
  })

  const totalHoy = pagos.reduce((sum, p) => sum + p.monto, 0)

  const handleRegistrarPago = () => {
    if (!formData.cliente_id || !formData.monto) {
      alert("Completa cliente y monto")
      return
    }

    const cliente = clients.find((c) => c.id === formData.cliente_id)
    if (!cliente) return

    const nuewoPago: Pago = {
      id: Date.now().toString(),
      cliente: cliente.name,
      monto: parseFloat(formData.monto),
      metodo: formData.metodo === "cash" ? "Efectivo" : formData.metodo === "transfer" ? "Transferencia" : formData.metodo,
      fecha: new Date().toLocaleString("es-MX", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }

    setPagos([nuewoPago, ...pagos])
    setFormData({ cliente_id: "", monto: "", metodo: "cash", referencia: "" })
    setShowModal(false)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.total}>
          Total Hoy: ${totalHoy.toLocaleString("es-MX")}
        </Text>
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

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowModal(true)}
      >
        <Text style={styles.fabText}>+ Registrar Pago</Text>
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide">
        <ScrollView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.closeButton}>← Cerrar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Registrar Pago</Text>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Cliente</Text>
            <View style={styles.select}>
              <FlatList
                data={clients}
                scrollEnabled={false}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.selectOption,
                      formData.cliente_id === item.id && styles.selectOptionActive,
                    ]}
                    onPress={() => setFormData({ ...formData, cliente_id: item.id })}
                  >
                    <Text
                      style={[
                        styles.selectOptionText,
                        formData.cliente_id === item.id && styles.selectOptionTextActive,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>

            <Text style={styles.label}>Monto (MXN)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              value={formData.monto}
              onChangeText={(text) => setFormData({ ...formData, monto: text })}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Método de Pago</Text>
            <View style={styles.methodGrid}>
              {[
                { id: "cash", label: "Efectivo" },
                { id: "transfer", label: "Transferencia" },
                { id: "check", label: "Cheque" },
                { id: "credit_card", label: "Tarjeta" },
              ].map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.methodButton,
                    formData.metodo === method.id && styles.methodButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, metodo: method.id })}
                >
                  <Text
                    style={[
                      styles.methodButtonText,
                      formData.metodo === method.id && styles.methodButtonTextActive,
                    ]}
                  >
                    {method.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Referencia (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Comprobante #12345"
              value={formData.referencia}
              onChangeText={(text) => setFormData({ ...formData, referencia: text })}
            />

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleRegistrarPago}
            >
              <Text style={styles.submitButtonText}>Registrar Pago</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>
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
  modalContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  modalHeader: {
    backgroundColor: "#182535",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  closeButton: {
    color: "#36BF6A",
    fontSize: 14,
    fontWeight: "600",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  formSection: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#182535",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  select: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    maxHeight: 150,
  },
  selectOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  selectOptionActive: {
    backgroundColor: "#e8f5e9",
  },
  selectOptionText: {
    fontSize: 14,
    color: "#182535",
  },
  selectOptionTextActive: {
    fontWeight: "bold",
    color: "#36BF6A",
  },
  methodGrid: {
    display: "flex",
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  methodButton: {
    flex: 1,
    minWidth: 80,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  methodButtonActive: {
    backgroundColor: "#36BF6A",
    borderColor: "#36BF6A",
  },
  methodButtonText: {
    fontSize: 12,
    color: "#182535",
    fontWeight: "500",
  },
  methodButtonTextActive: {
    color: "#fff",
    fontWeight: "bold",
  },
  submitButton: {
    backgroundColor: "#182535",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 24,
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
})
