// Notifications — stub sin expo-notifications (módulo nativo no en APK actual)
// Las funciones están preservadas para que los imports no rompan; son no-ops.

export async function setupNotifications(): Promise<null> {
  return null;
}

export async function sendLocalNotification(
  _title: string,
  _body: string,
  _data?: Record<string, string>,
): Promise<void> {
  // no-op
}

export async function notifyUser(
  _userId: string,
  _payload: { title: string; body: string; data?: Record<string, string> },
): Promise<void> {
  // no-op
}

export async function checkMonthEndReminder(): Promise<void> {
  // no-op
}
