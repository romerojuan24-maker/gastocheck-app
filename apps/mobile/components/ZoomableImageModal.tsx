// Visor de imagen con pinch-to-zoom, pan y doble-tap — para revisar comprobantes en detalle.
// Implementado con PanResponder + Animated (núcleo de React Native, sin librerías nuevas)
// para no requerir un build nativo nuevo — funciona con cualquier OTA.
import { useRef, useState } from 'react';
import {
  Modal, View, Image, TouchableOpacity, Text, StyleSheet,
  Animated, PanResponder, Dimensions, type GestureResponderEvent, type PanResponderGestureState,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_ZOOM = 2.5;
const DOUBLE_TAP_MS = 280;

interface Props {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}

function distance(touches: { pageX: number; pageY: number }[]): number {
  const [a, b] = touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

function midpoint(touches: { pageX: number; pageY: number }[]): { x: number; y: number } {
  const [a, b] = touches;
  return { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 };
}

export default function ZoomableImageModal({ visible, uri, onClose }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Valores "planos" (no-Animated) para hacer la aritmética de gestos
  const scaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });
  const gestureStart = useRef({ scale: 1, x: 0, y: 0, pinchDist: 0 });
  const lastTap = useRef(0);

  const [, forceRerender] = useState(0);

  function setTransform(newScale: number, x: number, y: number) {
    const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
    // No dejar que la imagen se vaya fuera de vista al hacer pan
    const maxOffsetX = (SCREEN_W * (clampedScale - 1)) / 2;
    const maxOffsetY = (SCREEN_H * (clampedScale - 1)) / 2;
    const clampedX = clampedScale <= 1 ? 0 : Math.min(maxOffsetX, Math.max(-maxOffsetX, x));
    const clampedY = clampedScale <= 1 ? 0 : Math.min(maxOffsetY, Math.max(-maxOffsetY, y));

    scaleRef.current = clampedScale;
    translateRef.current = { x: clampedX, y: clampedY };
    scale.setValue(clampedScale);
    translateX.setValue(clampedX);
    translateY.setValue(clampedY);
  }

  function reset() {
    setTransform(1, 0, 0);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const touches = evt.nativeEvent.touches;
        gestureStart.current.scale = scaleRef.current;
        gestureStart.current.x = translateRef.current.x;
        gestureStart.current.y = translateRef.current.y;
        if (touches.length === 2) {
          gestureStart.current.pinchDist = distance(touches);
        }
      },

      onPanResponderMove: (evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
        const touches = evt.nativeEvent.touches;

        if (touches.length === 2) {
          // Pinch: escala relativa a la distancia inicial entre dedos
          const dist = distance(touches);
          if (gestureStart.current.pinchDist > 0) {
            const ratio = dist / gestureStart.current.pinchDist;
            setTransform(
              gestureStart.current.scale * ratio,
              translateRef.current.x,
              translateRef.current.y,
            );
          }
        } else if (touches.length === 1 && scaleRef.current > 1) {
          // Pan: solo si ya hay zoom aplicado
          setTransform(
            scaleRef.current,
            gestureStart.current.x + gesture.dx,
            gestureStart.current.y + gesture.dy,
          );
        }
      },

      onPanResponderRelease: (evt: GestureResponderEvent) => {
        // Snap a 1x si quedó casi sin zoom
        if (scaleRef.current < 1.05) {
          reset();
          return;
        }

        // Doble tap: detectar solo cuando fue un toque simple (no pinch/pan)
        if (evt.nativeEvent.changedTouches.length === 1) {
          const now = Date.now();
          if (now - lastTap.current < DOUBLE_TAP_MS) {
            if (scaleRef.current > 1) {
              reset();
            } else {
              setTransform(DOUBLE_TAP_ZOOM, 0, 0);
            }
            lastTap.current = 0;
          } else {
            lastTap.current = now;
          }
        }
      },
    }),
  ).current;

  // Rotación de VISTA (90° por toque) — para revisar fotos tomadas horizontales
  const [rotation, setRotation] = useState(0);

  function handleClose() {
    reset();
    setRotation(0);
    onClose();
  }

  function handleRotate() {
    reset();
    setRotation(r => (r + 90) % 360);
  }

  if (!visible || !uri) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rotateBtn} onPress={handleRotate}>
          <Text style={styles.closeIcon}>↻</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>Pellizca para acercar · doble toque zoom · ↻ gira la imagen</Text>

        <View style={styles.imageWrap} {...panResponder.panHandlers}>
          <Animated.Image
            source={{ uri }}
            resizeMode="contain"
            style={[
              styles.image,
              {
                transform: [
                  { translateX },
                  { translateY },
                  { scale },
                  { rotate: `${rotation}deg` },
                ],
              },
            ]}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  imageWrap: { width: SCREEN_W, height: SCREEN_H, justifyContent: 'center', alignItems: 'center' },
  image:     { width: SCREEN_W, height: SCREEN_H },
  closeBtn: {
    position: 'absolute', top: 48, right: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  rotateBtn: {
    position: 'absolute', bottom: 48, right: 20, zIndex: 10,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  closeIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
  hint: {
    position: 'absolute', top: 56, left: 20, right: 72, zIndex: 10,
    color: 'rgba(255,255,255,0.7)', fontSize: 11, textAlign: 'left',
  },
});
