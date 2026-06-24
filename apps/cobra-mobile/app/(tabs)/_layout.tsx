import { Tabs } from "expo-router"
import { MapPin, LayoutDashboard, TrendingUp, Landmark, FileText, Settings } from "lucide-react-native"

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: "#10b981",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e2e8f0",
        },
        headerStyle: { backgroundColor: "#10b981" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="ruta"
        options={{
          title: "Mi Ruta",
          tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Panel",
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="flujo"
        options={{
          title: "Flujo",
          tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="banco"
        options={{
          title: "Banco",
          tabBarIcon: ({ color, size }) => <Landmark color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="factura"
        options={{
          title: "Factura",
          tabBarIcon: ({ color, size }) => <FileText color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="config"
        options={{
          title: "Config",
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />

      {/* Rutas accesibles por navegación, ocultas de la barra de tabs */}
      <Tabs.Screen name="clientes" options={{ href: null }} />
      <Tabs.Screen name="historial" options={{ href: null }} />
      <Tabs.Screen name="pagos" options={{ href: null }} />
      <Tabs.Screen name="gastocheck" options={{ href: null }} />
    </Tabs>
  )
}
