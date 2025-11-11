// Service Worker para Firebase Cloud Messaging
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configuración de Firebase
firebase.initializeApp({
  apiKey: 'AIzaSyDz33VyfDraZoOhZkt4DKubZCxx0BELp_g',
  authDomain: 'gymapp-bd0da.firebaseapp.com',
  projectId: 'gymapp-bd0da',
  storageBucket: 'gymapp-bd0da.firebasestorage.app',
  messagingSenderId: '629940669593',
  appId: '1:629940669593:web:78eb3576d90f92ff9dbc08'
});

// Obtener instancia de messaging
const messaging = firebase.messaging();

// Manejar notificaciones en segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Nueva notificación';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/logo192.png',
    badge: '/logo192.png',
    data: payload.data,
    requireInteraction: true,
    tag: 'gym-notification'
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejar clicks en las notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('Notification click:', event);
  event.notification.close();

  // Abrir la aplicación o enfocar si ya está abierta
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si hay una ventana abierta, enfocarla
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Si no hay ventana abierta, abrir una nueva
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});
