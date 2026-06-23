import React, { useState } from "react"
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs"
import { useAuth } from "@gastocheck/shared"
import { View, Text, ScrollView } from "react-native"
import { VERSION_STRING } from "../../lib/version"

// Importar pantallas
import RutaScreen from "./ruta"
import FlujoScreen from "./flujo"
import BancoScreen from "./banco"
import FacturaScreen from "./factura"
import DashboardScreen from "./dashboard"
import ConfigScreen from "./config"

const Tab = createMaterialTopTabNavigator()

// CHECK SUITE - Módulo principal
function CheckSuiteModule() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: "bold", color: "#1e293b", marginBottom: 16 }}>
          CHECK SUITE
        </Text>

        {/* Tab secondary para módulos */}
        <Tab.Navigator
          screenOptions={{
            tabBarScrollEnabled: true,
            tabBarStyle: {
              backgroundColor: "#ffffff",
              borderBottomColor: "#e2e8f0",
            },
            tabBarActiveTintColor: "#10b981",
            tabBarInactiveTintColor: "#94a3b8",
            tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
          }}
        >
          <Tab.Screen name="ruta" component={RutaScreen} options={{ title: "Mi Ruta" }} />
          <Tab.Screen name="flujo" component={FlujoScreen} options={{ title: "Flujo" }} />
          <Tab.Screen name="banco" component={BancoScreen} options={{ title: "Banco" }} />
          <Tab.Screen name="factura" component={FacturaScreen} options={{ title: "Factura" }} />
          <Tab.Screen name="dashboard" component={DashboardScreen} options={{ title: "Panel" }} />
        </Tab.Navigator>
      </View>
    </ScrollView>
  )
}

// GastoCheck - Módulo de gastos
function GastoCheckModule() {
  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 18, fontWeight: "bold", color: "#1e293b" }}>GastoCheck</Text>
      <Text style={{ color: "#64748b", marginTop: 8 }}>Módulo de Gastos y Anticipos</Text>
    </View>
  )
}

// CobraCheck - Módulo de cobranza
function CobraCheckModule() {
  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 18, fontWeight: "bold", color: "#1e293b" }}>CobraCheck</Text>
      <Text style={{ color: "#64748b", marginTop: 8 }}>Módulo de Cobranza</Text>
    </View>
  )
}

export default function TabsLayout() {
  const { user } = useAuth()

  // Control de acceso por módulo (puedes cambiar según permisos del usuario)
  const hasCheckSuite = true // user?.role === "admin" || user?.role === "supervisor"
  const hasGastoCheck = true // user?.permissions?.includes("gasto_check")
  const hasCobraCheck = true // user?.permissions?.includes("cobra_check")

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarScrollEnabled: true,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderBottomColor: "#e2e8f0",
          borderBottomWidth: 2,
          elevation: 0,
        },
        tabBarActiveTintColor: "#10b981",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: "700",
          textTransform: "uppercase",
        },
        tabBarIndicatorStyle: {
          backgroundColor: "#10b981",
          height: 3,
        },
      }}
    >
      {hasCheckSuite && (
        <Tab.Screen
          name="checksuite"
          component={CheckSuiteModule}
          options={{
            title: "CHECK SUITE",
          }}
        />
      )}

      {hasGastoCheck && (
        <Tab.Screen
          name="gastocheck"
          component={GastoCheckModule}
          options={{
            title: "GASTOCHECK",
          }}
        />
      )}

      {hasCobraCheck && (
        <Tab.Screen
          name="cobracheck"
          component={CobraCheckModule}
          options={{
            title: "COBRACHECK",
          }}
        />
      )}

      {/* Config siempre disponible */}
      <Tab.Screen
        name="config"
        component={ConfigScreen}
        options={{
          title: "⚙️ CONFIG",
        }}
      />
    </Tab.Navigator>
  )
}
