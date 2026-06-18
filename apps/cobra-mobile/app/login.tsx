import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native"
import { useState } from "react"
import { useAuth } from "@gastocheck/shared"
import { Link, useRouter } from "expo-router"
import { VERSION_STRING } from "../lib/version"

export default function LoginScreen() {
  const [email, setEmail] = useState("cobrador@test.com")
  const [password, setPassword] = useState("Test1234!")
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  const handleLogin = async () => {
    try {
      setLoading(true)
      await login(email, password)
      router.replace("/(tabs)/clientes")
    } catch (error: any) {
      Alert.alert("Error", error.message ?? "No se pudo iniciar sesión")
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.versionBadge}>
        <Text style={styles.versionText}>{VERSION_STRING}</Text>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>CobraCheck</Text>
        <Text style={styles.subtitle}>Controla lo que te debes</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Iniciando..." : "Iniciar Sesión"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Demo: cualquier cobrador</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  versionBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "#182535",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  versionText: {
    color: "#36BF6A",
    fontSize: 11,
    fontWeight: "bold",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#182535",
  },
  subtitle: {
    fontSize: 14,
    color: "#36BF6A",
    marginTop: 4,
  },
  form: {
    gap: 12,
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: "#f9f9f9",
  },
  button: {
    backgroundColor: "#182535",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  footer: {
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: "#999",
  },
})
