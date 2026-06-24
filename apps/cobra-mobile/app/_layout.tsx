import { Stack } from "expo-router"
import { useAuth } from "@gastocheck/shared"
import { useEffect } from "react"
import * as Updates from "expo-updates"

export default function RootLayout() {
  const { user, loading } = useAuth()

  useEffect(() => {
    // Verificar actualizaciones OTA automáticamente
    const checkForUpdates = async () => {
      try {
        const update = await Updates.checkAsync()
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync()
          await Updates.reloadAsync()
        }
      } catch (e) {
        console.error("Error checking for updates:", e)
      }
    }

    checkForUpdates()
  }, [])

  if (loading) {
    return null
  }

  return (
    <Stack>
      {!user ? (
        <>
          <Stack.Screen
            name="login"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="register"
            options={{ headerShown: false }}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="(tabs)"
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack>
  )
}
