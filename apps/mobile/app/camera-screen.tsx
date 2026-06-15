import { useState, useRef, useEffect } from "react"
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
} from "react-native"
import { Camera, CameraType, FlashMode } from "expo-camera"
import { useRouter } from "expo-router"
import { BRAND } from "@gastocheck/shared"

export default function CameraWithFlashScreen() {
  const router = useRouter()
  const cameraRef = useRef<Camera>(null)

  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [flashMode, setFlashMode] = useState<FlashMode>(FlashMode.off)
  const [cameraType, setCameraType] = useState<CameraType>(CameraType.back)

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync()
      setHasPermission(status === "granted")
    })()
  }, [])

  async function takePicture() {
    if (!cameraRef.current) return

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: true,
      })

      // Volver a capture.tsx con la foto
      router.push({
        pathname: "/capture",
        params: { 
          photoUri: photo.uri,
          photoBase64: photo.base64,
        }
      } as any)
    } catch (error: any) {
      Alert.alert("Error", "No se pudo capturar la foto")
    }
  }

  if (hasPermission === null) {
    return <View style={{ flex: 1 }} />
  }

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Necesitamos permiso para usar la cámara</Text>
      </View>
    )
  }

  const flashIcon = {
    [FlashMode.off]: "🔦",
    [FlashMode.on]: "⚡",
    [FlashMode.auto]: "🤖",
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        type={cameraType}
        flashMode={flashMode}
        style={styles.camera}
      />

      {/* Controles */}
      <View style={styles.controls}>
        {/* Flash/Torch */}
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => {
            const modes: FlashMode[] = [FlashMode.off, FlashMode.on, FlashMode.auto]
            const nextMode = modes[(modes.indexOf(flashMode) + 1) % modes.length]
            setFlashMode(nextMode)
          }}
        >
          <Text style={styles.controlIcon}>{flashIcon[flashMode]}</Text>
          <Text style={styles.controlLabel}>
            {flashMode === FlashMode.off ? "Off" : flashMode === FlashMode.on ? "On" : "Auto"}
          </Text>
        </TouchableOpacity>

        {/* Cambiar cámara */}
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => {
            setCameraType(cameraType === CameraType.back ? CameraType.front : CameraType.back)
          }}
        >
          <Text style={styles.controlIcon}>🔄</Text>
          <Text style={styles.controlLabel}>Voltear</Text>
        </TouchableOpacity>
      </View>

      {/* Botón capturar */}
      <View style={styles.captureContainer}>
        <TouchableOpacity
          style={styles.captureBtn}
          onPress={takePicture}
        >
          <View style={styles.captureCircle} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  message: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    color: "#fff",
    fontSize: 16,
  },
  controls: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 12,
  },
  controlBtn: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  controlIcon: {
    fontSize: 20,
  },
  controlLabel: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  captureContainer: {
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: 30,
    alignItems: "center",
  },
  captureBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  captureCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: BRAND.blue,
  },
})
