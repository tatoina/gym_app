# Configuración de Notificaciones por Email

## Paso 1: Configurar una cuenta de Gmail para enviar emails

Para enviar emails desde Firebase Functions, necesitas:

1. **Crear o usar una cuenta de Gmail** (puede ser una cuenta dedicada para la app)
2. **Activar la verificación en 2 pasos**:
   - Ve a https://myaccount.google.com/security
   - Activa "Verificación en 2 pasos"

3. **Generar una contraseña de aplicación**:
   - Ve a https://myaccount.google.com/apppasswords
   - Selecciona "Mail" y "Windows Computer" (o cualquier otra opción)
   - Copia la contraseña de 16 caracteres generada

## Paso 2: Configurar las variables en Firebase

Ejecuta estos comandos en la terminal:

```bash
# Configurar email de Gmail
firebase functions:secrets:set GMAIL_EMAIL

# Cuando te pregunte, introduce: tu-email@gmail.com

# Configurar contraseña de aplicación
firebase functions:secrets:set GMAIL_PASSWORD

# Cuando te pregunte, introduce la contraseña de 16 caracteres generada
```

## Paso 3: Desplegar las Functions

```bash
firebase deploy --only functions
```

## Cómo funciona

Cuando un usuario solicita un cambio en su tabla asignada:

1. Se crea un documento en la colección `notifications` de Firestore
2. La Cloud Function `sendNotificationToAdmin` se activa automáticamente
3. Se envía un email a **inaviciba@gmail.com** con:
   - Nombre del usuario
   - Email del usuario
   - Comentario del usuario
   - Enlace al panel de administración

## Verificar logs

Para ver si los emails se están enviando correctamente:

```bash
firebase functions:log
```

## Cambiar el email de destino

Para cambiar el email donde llegan las notificaciones:

1. Abre `functions/index.js`
2. Busca la línea: `to: "inaviciba@gmail.com"`
3. Cámbiala por el email que quieras

## Costos

- Firebase Functions: Incluye 2 millones de invocaciones gratis al mes
- Después: $0.40 por millón de invocaciones
- Para una app pequeña, es prácticamente gratis
