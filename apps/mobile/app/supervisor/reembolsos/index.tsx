import { useState, useEffect, useCallback } from "react"
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, FlatList,
  ActivityIndicator, Alert, Modal, TextInput,
} from "react-native"
import { useRouter } from "expo-router"
import { BRAND } from "@gastocheck/shared"
import { supabase } from "../../../lib/supabase"

const money = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n)

interface Reembolso {
  id: string
  employee_id: string
  employee_email: string
  status: string
  total: number
  notes: string
  created_at: string
}

interface Receipt {
  id: string
  provider_name: string
  total_amount: number
  fiscal_uuid: string | null
  sat_validation_status: string | null
}

export default function SupervisorReembolsosScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [reembolsos, setReembolsos] = useState<Reembolso[]>([])
  const [selectedReembolso, setSelectedReembolso] = useState<Reembolso | null>(null)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [showSatModal, setShowSatModal] = useState(false)
  const [showClassifyModal, setShowClassifyModal] = useState(false)
  const [satVerifying, setSatVerifying] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [satResults, setSatResults] = useState<any[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle()

      if (!member) return

      const { data: reembs, error } = await supabase
        .from("reembolsos")
        .select("id, employee_id, employee_email, status, total, notes, created_at")
        .eq("company_id", member.company_id)
        .eq("status", "pending_auth")
        .order("created_at", { ascending: false })

      if (error) console.error("[reembolsos load]", error)
      setReembolsos(reembs as Reembolso[] ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function loadReceipts(reembolsoId: string) {
    const { data } = await supabase
      .from("receipt_reembolsos")
      .select("receipts(id, provider_name, total_amount, fiscal_uuid, sat_validation_status)")
      .eq("reembolso_id", reembolsoId)

    const list = (data ?? []).map((item: any) => item.receipts)
    setReceipts(list.filter(Boolean))
  }

  async function handleVerifySat() {
    if (!selectedReembolso) return

    setSatVerifying(true)
    try {
      const results = []

      for (const receipt of receipts) {
        if (receipt.fiscal_uuid) {
          const { data } = await supabase.functions.invoke("validate-cfdi", {
            body: { uuid: receipt.fiscal_uuid },
          })

          results.push({
            receiptId: receipt.id,
            provider: receipt.provider_name,
            status: data?.status || "unknown",
            message: data?.message || "",
          })
        }
      }

      setSatResults(results)
      Alert.alert("✓ Verificación completada", `${results.length} comprobantes verificados en SAT`)
    } catch (error: any) {
      Alert.alert("Error", error.message ?? "No se pudo verificar SAT")
    } finally {
      setSatVerifying(false)
    }
  }

  async function handleClose() {
    if (!selectedReembolso) return

    Alert.alert(
      "Cerrar reembolso",
      "¿Estás seguro? Esto convertirá el reembolso en una póliza contable exportable.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Cerrar",
          onPress: async () => {
            setClassifying(true)
            try {
              const { error } = await supabase
                .from("reembolsos")
                .update({ status: "closed" })
                .eq("id", selectedReembolso.id)

              if (error) throw error

              // Marcar recibos incluidos en batch
              const { data: rr } = await supabase
                .from("receipt_reembolsos")
                .select("receipt_id")
                .eq("reembolso_id", selectedReembolso.id)

              if (rr && rr.length > 0) {
                const ids = rr.map((r: any) => r.receipt_id)
                await supabase
                  .from("receipts")
                  .update({ status: "included_in_batch" })
                  .in("id", ids)
              }

              Alert.alert("✓ Reembolso cerrado", "La póliza está lista para exportar")
              setSelectedReembolso(null)
              setShowClassifyModal(false)
              load()
            } catch (e: any) {
              Alert.alert("Error", e.message)
            } finally {
              setClassifying(false)
            }
          },
        },
      ],
    )
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.title}>Reembolsos Pendientes</Text>
        <Text style={styles.subtitle}>
          {reembolsos.length} reembolso{reembolsos.length !== 1 ? "s" : ""} pendiente{reembolsos.length !== 1 ? "s" : ""} de aprobación
        </Text>

        {reembolsos.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>Sin reembolsos pendientes</Text>
            <Text style={styles.emptyHint}>Todos los reembolsos están autorizados</Text>
          </View>
        ) : (
          <FlatList
            scrollEnabled={false}
            data={reembolsos}
            keyExtractor={(r) => r.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => {
                  setSelectedReembolso(item)
                  loadReceipts(item.id)
                  setShowSatModal(true)
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {item.employee_email || "Anónimo"}
                  </Text>
                  <Text style={styles.cardDate}>
                    {new Date(item.created_at).toLocaleDateString("es-MX")}
                  </Text>
                  <Text style={styles.cardNotes}>{item.notes || "(sin descripción)"}</Text>
                </View>
                <Text style={styles.cardAmount}>{money(item.total)}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </ScrollView>

      {/* Modal SAT Verification */}
      <Modal visible={showSatModal} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowSatModal(false)}>
        <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSatModal(false)}>
              <Text style={{ color: "#90A4AE", fontSize: 15 }}>Cerrar</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: "700", color: BRAND.navy }}>
              Verificación SAT
            </Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {receipts.map((r) => (
              <View key={r.id} style={styles.receiptItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.receiptProvider} numberOfLines={1}>
                    {r.provider_name}
                  </Text>
                  <Text style={styles.receiptStatus}>
                    {r.fiscal_uuid ? "📄 Con CFDI" : "📋 Sin CFDI"}
                  </Text>
                  {r.sat_validation_status && (
                    <Text style={[styles.receiptSat, {
                      color: r.sat_validation_status === "validated" ? "#2E7D32" : "#C62828"
                    }]}>
                      {r.sat_validation_status === "validated" ? "✅ Vigente" : "❌ Cancelado"}
                    </Text>
                  )}
                </View>
                <Text style={styles.receiptAmount}>{money(r.total_amount ?? 0)}</Text>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.verifyBtn, satVerifying && { opacity: 0.6 }]}
              onPress={handleVerifySat}
              disabled={satVerifying}
            >
              {satVerifying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.verifyBtnText}>Verificar en SAT</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.classifyBtn}
              onPress={() => {
                setShowSatModal(false)
                setShowClassifyModal(true)
              }}
            >
              <Text style={styles.classifyBtnText}>Siguiente: Clasificar Cuentas</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Classify */}
      <Modal visible={showClassifyModal} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowClassifyModal(false)}>
        <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowClassifyModal(false)}>
              <Text style={{ color: "#90A4AE", fontSize: 15 }}>Atrás</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: "700", color: BRAND.navy }}>
              Clasificación de Cuentas
            </Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.classifyTitle}>
              Asigna cuenta contable a cada comprobante
            </Text>

            {receipts.map((r) => (
              <View key={r.id} style={styles.classifyItem}>
                <Text style={styles.receiptProvider} numberOfLines={1}>
                  {r.provider_name}
                </Text>
                <TextInput
                  style={styles.classifyInput}
                  placeholder="Cuenta contable (ej: 1010)"
                  placeholderTextColor="#B0BEC5"
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.closeBtn, classifying && { opacity: 0.6 }]}
              onPress={handleClose}
              disabled={classifying}
            >
              {classifying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.closeBtnText}>Cerrar Reembolso → Generar Póliza</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "800", color: BRAND.navy, marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#90A4AE", marginBottom: 16 },

  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: "700", color: BRAND.navy },
  emptyHint: { fontSize: 13, color: "#90A4AE", marginTop: 4 },

  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    marginBottom: 10, flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: "#E0E0E0",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: BRAND.navy },
  cardDate: { fontSize: 11, color: "#90A4AE", marginTop: 2 },
  cardNotes: { fontSize: 12, color: "#90A4AE", marginTop: 4, fontStyle: "italic" },
  cardAmount: { fontSize: 16, fontWeight: "800", color: BRAND.navy, minWidth: 80, textAlign: "right" },

  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E0E0E0",
  },

  receiptItem: {
    backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 8,
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: "#E0E0E0",
  },
  receiptProvider: { fontSize: 13, fontWeight: "600", color: BRAND.navy },
  receiptStatus: { fontSize: 11, color: "#90A4AE", marginTop: 2 },
  receiptSat: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  receiptAmount: { fontSize: 13, fontWeight: "700", color: BRAND.navy, minWidth: 60, textAlign: "right" },

  verifyBtn: {
    backgroundColor: BRAND.blue, borderRadius: 12, paddingVertical: 14,
    alignItems: "center", marginTop: 16,
  },
  verifyBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  classifyBtn: {
    backgroundColor: "#fff", borderRadius: 12, paddingVertical: 14,
    alignItems: "center", marginTop: 10,
    borderWidth: 2, borderColor: BRAND.blue,
  },
  classifyBtnText: { fontSize: 15, fontWeight: "700", color: BRAND.blue },

  classifyTitle: {
    fontSize: 14, fontWeight: "700", color: BRAND.navy, marginBottom: 12,
  },
  classifyItem: {
    backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: "#E0E0E0",
  },
  classifyInput: {
    backgroundColor: "#F5F5F5", borderRadius: 8, padding: 10, marginTop: 8,
    fontSize: 14, color: BRAND.navy,
    borderWidth: 1, borderColor: "#E0E0E0",
  },

  closeBtn: {
    backgroundColor: BRAND.green, borderRadius: 12, paddingVertical: 14,
    alignItems: "center", marginTop: 16,
  },
  closeBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
})
