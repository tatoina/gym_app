// ARCHIVO DESACTIVADO - AHORA USAMOS NOTIFICACIONES POR EMAIL
// Las notificaciones push no funcionan en Safari iOS, por lo que hemos cambiado a email
// Las notificaciones se envían automáticamente desde la Cloud Function

export const requestNotificationPermission = async () => {
  console.log('Push notifications desactivadas - usamos email notifications');
  return null;
};

export const setupMessageListener = () => {
  console.log('Push notifications desactivadas - usamos email notifications');
  return;
};
