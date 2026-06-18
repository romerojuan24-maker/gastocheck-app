import { Tabs } from "expo-router"
import { Users, Navigation, CreditCard, RotateCcw } from "lucide-react-native"
import { View, Text } from "react-native"
import { VERSION_STRING } from "../../lib/version"

export default function TabsLayout() {
  const headerRight = () => (
    <View style={{ paddingRight: 16 }}>
      <Text style={{ color: "#36BF6A", fontSize: 10, fontWeight: "bold" }}>
        {VERSION_STRING}
      </Text>
    </View>
  )

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: "#182535",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "bold",
        },
        headerRight,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#e0e0e0",
        },
        tabBarActiveTintColor: "#36BF6A",
        tabBarInactiveTintColor: "#999",
      }}
    >
      <Tabs.Screen
        name="clientes"
        options={{
          title: "Clientes",
          tabBarIcon: ({ color }) => <Users size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ruta"
        options={{
          title: "Mi Ruta",
          tabBarIcon: ({ color }) => <Navigation size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pagos"
        options={{
          title: "Pagos",
          tabBarIcon: ({ color }) => <CreditCard size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: "Historial",
          tabBarIcon: ({ color }) => <RotateCcw size={24} color={color} />,
        }}
      />
    </Tabs>
  )
}
