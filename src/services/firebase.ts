// Configuración de Firebase
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyDz33VyfDraZoOhZkt4DKubZCxx0BELp_g',
  authDomain: 'gymapp-bd0da.firebaseapp.com',
  projectId: 'gymapp-bd0da',
  storageBucket: 'gymapp-bd0da.firebasestorage.app',
  messagingSenderId: '629940669593',
  appId: '1:629940669593:web:78eb3576d90f92ff9dbc08'
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar servicios
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Messaging (solo si está disponible en el navegador)
let messaging: any = null;
try {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    messaging = getMessaging(app);
  }
} catch (error) {
  console.log('Messaging not supported in this browser');
}

export { messaging, getToken, onMessage };
export default app;