# Configuración de Firebase Cloud Messaging (FCM)

## PASOS PARA COMPLETAR LA CONFIGURACIÓN:

### 1. Generar VAPID Key (Web Push Certificate)

1. Ve a Firebase Console: https://console.firebase.google.com/project/gymapp-bd0da/settings/cloudmessaging
2. En la sección "Web configuration", busca "Web Push certificates"
3. Si no existe, haz clic en "Generate key pair"
4. Copia la clave generada (empieza con "B...")
5. Reemplaza `REEMPLAZAR_CON_TU_VAPID_KEY` en `src/services/notifications.ts` con tu clave

### 2. Actualizar Firestore Rules

Añade estas reglas para la colección `users`:

```
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
  allow read: if request.auth.token.email == 'max@max.es';
}
```

### 3. Desplegar Cloud Functions

Ejecuta en la terminal:
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### 4. Desplegar el sitio web

```bash
npm run build
firebase deploy --only hosting
```

### 5. Probar las notificaciones

1. Inicia sesión como max@max.es
2. Acepta los permisos de notificación cuando se soliciten
3. Inicia sesión con otro usuario
4. Solicita un cambio de tabla
5. Max debería recibir una notificación push

## Estructura implementada:

- **Cloud Function**: `functions/index.js` - Detecta nuevas notificaciones y envía push
- **Service Worker**: `public/firebase-messaging-sw.js` - Maneja notificaciones en background
- **Notification Service**: `src/services/notifications.ts` - Gestiona permisos y tokens
- **App.tsx**: Inicializa notificaciones para el admin

## Notas:

- Las notificaciones solo se envían a max@max.es
- El token FCM se guarda automáticamente en Firestore
- Las notificaciones funcionan incluso con la app cerrada (si el navegador está abierto)
- Compatible con Chrome, Firefox, Edge (no Safari en iOS)
