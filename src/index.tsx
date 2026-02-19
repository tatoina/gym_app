import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Registrar service worker con actualización automática
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    // Cuando hay una actualización disponible
    console.log('Nueva versión disponible. Actualizando...');
    
    if (registration && registration.waiting) {
      // Activar el nuevo service worker
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Recargar la página para aplicar la actualización
      window.location.reload();
    }
  },
  onSuccess: (registration) => {
    console.log('Service Worker registrado correctamente');
  }
});