# Configuración de Notificaciones por Email

## ⚠️ IMPORTANTE: Configuración de Gmail

Para que funcionen las notificaciones por email, necesitas configurar las credenciales de Gmail.

### Paso 1: Crear una App Password en Gmail

1. Ve a tu cuenta de Google: https://myaccount.google.com/security
2. Activa la **verificación en 2 pasos** si no la tienes activada
3. Ve a: https://myaccount.google.com/apppasswords
4. En "Selecciona la app", elige **"Correo"**
5. En "Selecciona el dispositivo", elige **"Otro (nombre personalizado)"**
6. Escribe: **"MAXGYM Firebase"**
7. Haz clic en **"Generar"**
8. **COPIA LA CONTRASEÑA** de 16 caracteres que aparece (sin espacios)

### Paso 2: Configurar las credenciales en Firebase

Ejecuta estos comandos en la terminal (reemplaza los valores):

```bash
firebase functions:secrets:set GMAIL_EMAIL
# Cuando te pregunte, escribe: max@max.es (o el email que quieras usar)

firebase functions:secrets:set GMAIL_PASSWORD
# Cuando te pregunte, pega la App Password de 16 caracteres
```

### Paso 3: Desplegar las funciones

```bash
firebase deploy --only functions
```

### Paso 4: Probar

1. Inicia sesión con un usuario (no Max)
2. Ve a "Mis Tablas"
3. Haz clic en el botón 💬 "Solicitar cambio"
4. Envía un comentario
5. Max debería recibir un email en segundos! 📧

## ✅ Ventajas del sistema de Email:

- ✅ Funciona en **todos los dispositivos** (iOS, Android, Windows, Mac)
- ✅ No depende del navegador
- ✅ **Gratis** (Gmail permite 500 emails/día)
- ✅ Más confiable que push notifications web
- ✅ Funciona incluso si el navegador está cerrado

## 🔒 Seguridad:

- Las credenciales se guardan como **secrets** en Firebase Functions
- Nunca se exponen en el código fuente
- La App Password es específica para esta app (puedes revocarla cuando quieras)

## 📧 Formato del Email:

Los emails incluyen:
- Nombre del usuario que solicita
- Email del usuario
- Comentario/solicitud
- Botón directo al Panel de Administración
- Diseño profesional con colores de MAXGYM

## Alternativa con otra cuenta de Gmail:

Si prefieres usar otra cuenta de Gmail para enviar (no max@max.es):

1. Crea una cuenta nueva (ej: notificaciones.maxgym@gmail.com)
2. Genera la App Password en esa cuenta
3. Configura GMAIL_EMAIL con esa cuenta
4. Los emails se enviarán desde esa cuenta a max@max.es
