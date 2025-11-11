import { messaging, getToken, onMessage } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';

// VAPID Key - Necesitarás generarla en Firebase Console
// Ve a: Project Settings > Cloud Messaging > Web Push certificates
const VAPID_KEY = 'REEMPLAZAR_CON_TU_VAPID_KEY';

export const requestNotificationPermission = async () => {
  try {
    if (!messaging) {
      console.log('Messaging no disponible en este navegador');
      return null;
    }

    // Verificar si el usuario es admin
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.email !== 'max@max.es') {
      console.log('Solo el admin recibe notificaciones push');
      return null;
    }

    // Solicitar permiso al usuario
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('Permiso de notificaciones concedido');
      
      // Obtener token FCM
      const token = await getToken(messaging, { 
        vapidKey: VAPID_KEY 
      });
      
      if (token) {
        console.log('FCM Token:', token);
        
        // Guardar el token en Firestore
        await saveFCMToken(token);
        
        return token;
      } else {
        console.log('No se pudo obtener el token');
        return null;
      }
    } else {
      console.log('Permiso de notificaciones denegado');
      return null;
    }
  } catch (error) {
    console.error('Error al solicitar permiso de notificaciones:', error);
    return null;
  }
};

const saveFCMToken = async (token: string) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Crear o actualizar documento del usuario con el token
    const userRef = doc(db, 'users', currentUser.uid);
    await setDoc(userRef, {
      email: currentUser.email,
      fcmToken: token,
      updatedAt: new Date()
    }, { merge: true });

    console.log('Token FCM guardado en Firestore');
  } catch (error) {
    console.error('Error al guardar token FCM:', error);
  }
};

export const setupMessageListener = () => {
  if (!messaging) return;

  // Escuchar mensajes cuando la app está en primer plano
  onMessage(messaging, (payload) => {
    console.log('Mensaje recibido en primer plano:', payload);
    
    const notificationTitle = payload.notification?.title || 'Nueva notificación';
    const notificationOptions = {
      body: payload.notification?.body || '',
      icon: '/logo192.png',
      badge: '/logo192.png',
      requireInteraction: true
    };

    // Mostrar notificación usando la API del navegador
    if (Notification.permission === 'granted') {
      new Notification(notificationTitle, notificationOptions);
    }
  });
};
