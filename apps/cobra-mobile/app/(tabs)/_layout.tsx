import { Tabs } from "expo-router"
import { MapPin, TrendingUp, Building2, FileText, BarChart3, Settings } from "lucide-react-native"
import { View, Text } from "react-native"
import { VERSION_STRING } from "../../lib/version"

export default function TabsLayout() {
  const headerRight = () => (
    <View style={{ paddingRight: 16 }}>
      <Text style={{ color: "#10b981", fontSize: 10, fontWeight: "bold" }}>
        CHECK SUITE v{VERSION_STRING}
      </Text>
    </View>
  )

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: "#ffffff",
        },
        headerTintColor: "#10b981",
        headerTitleStyle: {
          fontWeight: "bold",
          color: "#1e293b",
        },
        headerRight,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e2e8f0",
          borderTopWidth: 1,
          paddingBottom: 5,
        },
        tabBarActiveTintColor: "#10b981",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          marginTop: 4,
        },
      }}
    >
      {/* Mi Ruta - GastoCheck + CobraCheck unificados */}
      <Tabs.Screen
        name="ruta"
        options={{
          title: "📍 Mi Ruta",
          tabBarIcon: ({ color }) => <MapPin size={24} color={color} />,
          tabBarLabel: "Ruta",
        }}
      />

      {/* FlujoCheck - Proyección de cash flow */}
      <Tabs.Screen
        name="flujo"
        options={{
          title: "💰 FlujoCheck",
          tabBarIcon: ({ color }) => <TrendingUp size={24} color={color} />,
          tabBarLabel: "Flujo",
        }}
      />

      {/* BancoCheck - Importar y clasificar movimientos */}
      <Tabs.Screen
        name="banco"
        options={{
          title: "🏦 BancoCheck",
          tabBarIcon: ({ color }) => <Building2 size={24} color={color} />,
          tabBarLabel: "Banco",
        }}
      />

      {/* FacturaCheck - Timbrado CFDI (futuro) */}
      <Tabs.Screen
        name="factura"
        options={{
          title: "📋 FacturaCheck",
          tabBarIcon: ({ color }) => <FileText size={24} color={color} />,
          tabBarLabel: "Factura",
        }}
      />

      {/* Dashboard - KPIs unificados */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "📊 Dashboard",
          tabBarIcon: ({ color }) => <BarChart3 size={24} color={color} />,
          tabBarLabel: "Panel",
        }}
      />

      {/* Configuración */}
      <Tabs.Screen
        name="config"
        options={{
          title: "⚙️ Configuración",
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
          tabBarLabel: "Config",
        }}
      />
    </Tabs>
  )
}
