import { View, Text, FlatList, StyleSheet } from "react-native"
import { useState } from "react"

interface Actividad {
  id: string
  tipo: string
  cliente: string
  fecha: string
  detalle: string
}

export default function HistorialScreen() {
  const [actividades, setActividades] = useState<Actividad[]>([
    {
      id: "1",
      tipo: "pago",
      cliente: "Cliente 1",
      fecha: "18/06 10:15",
      detalle: "Pago registrado $2,500",
    },
    {
      id: "2",
      tipo: "promesa",
      cliente: "Cliente 2",
      fecha: "17/06 11:30",
      detalle: "Promesa de pago 20/06",
    },
    {
      id: "3",
      tipo: "whatsapp",
      cliente: "Cliente 3",
      fecha: "17/06 14:00",
      detalle: "Recordatorio enviado",
    },
  ])

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case "pago":
        return "✅"
      case "promesa":
        return "🤝"
      case "whatsapp":
        return "📲"
      default:
        return "•"
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={actividades}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.actividadItem}>
            <Text style={styles.icon}>{getIcon(item.tipo)}</Text>
            <View style={styles.info}>
              <Text style={styles.cliente}>{item.cliente}</Text>
              <Text style={styles.detalle}>{item.detalle}</Text>
              <Text style={styles.fecha}>{item.fecha}</Text>
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => (
          <View style={styles.separator} />
        )}
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
  actividadItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "flex-start",
    gap: 12,
  },
  icon: {
    fontSize: 20,
    marginTop: 2,
  },
  info: {
    flex: 1,
  },
  cliente: {
    fontSize: 14,
    fontWeight: "600",
    color: "#182535",
  },
  detalle: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  fecha: {
    fontSize: 11,
    color: "#999",
    marginTop: 4,
  },
  separator: {
    height: 0.5,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 60,
  },
})
