// Notifications — expo-notifications integration + push tokens
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Configura expo-notifications y registra token push
 */
export async function setupNotifications() {
  try {
    // Solicitar permiso
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[Notifications] Permission denied');
      return null;
    }

    // Obtener token
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });

    // Registrar token en push_tokens tabla
    const { data: { user } } = await supabase.auth.getUser();
    if (user && token.data) {
      await supabase.from('push_tokens').upsert({
        user_id: user.id,
        token: token.data,
        platform: Platform.OS,
        device_info: Platform.Version?.toString() ?? 'unknown',
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      });
    }

    // Listener para notificaciones recibidas
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        console.log('[Notifications] Received:', notification.request.content.title);
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
      console.log('[Notifications] Tapped:', data);
      if (data.deepLink) {
        // Navegar a deep link (ej: /reembolso?id=xxx)
        console.log('[Notifications] Deep link:', data.deepLink);
      }
    });

    return { token: token.data, subscription };
  } catch (err) {
    console.error('[Notifications] Setup error:', err);
    return null;
  }
}

/**
 * Envía notificación local
 */
export async function sendLocalNotification(title: string, body: string, data?: Record<string, string>) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        badge: 1,
        data: data ?? {},
      },
      trigger: { seconds: 1 },
    });
  } catch (err) {
    console.error('[Notifications] Local notify error:', err);
  }
}

/**
 * Envía notificación push remotamente (desde servidor)
 * Llamada por Edge Function, no desde cliente
 */
export async function notifyUser(userId: string, payload: NotificationPayload) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const res = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-notification`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          title: payload.title,
          body: payload.body,
          data: payload.data,
        }),
      },
    );

    if (!res.ok) {
      console.warn('[Notifications] Send failed:', res.statusText);
    }
  } catch (err) {
    console.error('[Notifications] Send error:', err);
  }
}

/**
 * Recordatorio de cierre de mes
 */
export async function checkMonthEndReminder() {
  try {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    if (today.getDate() !== lastDay) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { count } = await supabase
      .from('receipts')
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', user.id)
      .eq('status', 'captured');

    if (!count || count === 0) return;

    const mes = today.toLocaleString('es-MX', { month: 'long' });
    await sendLocalNotification(
      '📅 Cierra tus comprobantes',
      `Tienes ${count} comprobante${count !== 1 ? 's' : ''} sin asignar a ${mes}`,
      { deepLink: '/receipts' },
    );
  } catch (err) {
    console.warn('[Notifications] Month-end reminder error:', err);
  }
}

// Importar Platform para detectar OS
import { Platform } from 'react-native';
