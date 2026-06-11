// Notifications — expo-notifications integration
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

/**
 * Configura expo-notifications
 */
export async function setupNotifications() {
  // Solicitar permiso
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.warn('Notification permissions denied');
    return null;
  }

  // Obtener token
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
  });

  // Guardar token en Supabase
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from('profiles')
      .update({ expo_push_token: token.data })
      .eq('id', user.id);
  }

  // Listener para notificaciones
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      // Procesar notificación
      console.log('Notification received:', notification);
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    },
  });

  // Handler de tap en notificación
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data.action_url) {
      // Navegar a la URL
      console.log('Navigate to:', data.action_url);
    }
  });

  return { token: token.data, subscription };
}

/**
 * Envía notificación local (para testing)
 */
export async function sendLocalNotification(title: string, message: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body: message,
      sound: true,
      badge: 1,
    },
    trigger: { seconds: 1 },
  });
}
