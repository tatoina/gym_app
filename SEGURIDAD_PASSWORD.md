# ⚠️ IMPORTANTE: Seguridad de la Contraseña

## La contraseña que has introducido es visible en los logs

Por seguridad, debes:

### 1. Crear una Contraseña de Aplicación en Gmail

1. Ve a https://myaccount.google.com/security
2. Activa "Verificación en 2 pasos" si no está activada
3. Ve a https://myaccount.google.com/apppasswords
4. Selecciona "Mail" y "Otro (nombre personalizado)"
5. Escribe "MAXGYM" y genera
6. Copia la contraseña de 16 caracteres (sin espacios)

### 2. Actualizar el secret en Firebase

```bash
firebase functions:secrets:set GMAIL_PASSWORD
```

Cuando te pregunte, pega la contraseña de aplicación de 16 caracteres.

### 3. Volver a desplegar

```bash
firebase deploy --only functions
```

## ¿Por qué usar contraseñas de aplicación?

- ✅ No expone tu contraseña real de Gmail
- ✅ Puedes revocarla en cualquier momento sin cambiar tu contraseña
- ✅ Es más segura para aplicaciones automatizadas
- ✅ Gmail no bloquea el acceso como con contraseñas normales

## Estado actual

✅ La función está desplegada y funcionando
✅ Los emails se enviarán a: **inaviciba@gmail.com**
⚠️ Debes cambiar a contraseña de aplicación para mayor seguridad

## Probar las notificaciones

1. Abre la app como usuario (no admin)
2. Ve a "Mis Tablas"
3. Haz clic en "💬 Solicitar Cambio"
4. Escribe un comentario
5. Envía la solicitud
6. Revisa la bandeja de entrada de **inaviciba@gmail.com**
