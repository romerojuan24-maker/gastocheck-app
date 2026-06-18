import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

export default function FacturaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Detalle Factura</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.placeholder}>Factura: {id}</Text>
        <Text style={styles.placeholder}>
          Pantalla de detalle de factura en desarrollo
        </Text>
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
  content: {
    padding: 16,
  },
  placeholder: {
    color: "#999",
    fontSize: 14,
    marginBottom: 8,
  },
})
