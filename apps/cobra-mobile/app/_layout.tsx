import { Stack } from "expo-router"
import { useAuth } from "@gastocheck/shared"
import { useEffect } from "react"

export default function RootLayout() {
  const { user, loading } = useAuth()

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
