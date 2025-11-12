# 🔴 ERROR DETECTADO: Contraseña de Aplicación Requerida

## El problema

Gmail está rechazando el login porque usa una contraseña normal en lugar de una contraseña de aplicación.

Error: `Application-specific password required`

## Solución Paso a Paso

### 1. Activar Verificación en 2 pasos

1. Ve a: https://myaccount.google.com/security
2. Busca "Verificación en 2 pasos"
3. Actívala si no está activada

### 2. Generar Contraseña de Aplicación

1. Ve a: https://myaccount.google.com/apppasswords
2. Si no ves la opción, primero debes activar la verificación en 2 pasos
3. Selecciona:
   - App: "Correo"
   - Dispositivo: "Otro (nombre personalizado)"
4. Escribe "MAXGYM" como nombre
5. Haz clic en "Generar"
6. **Copia la contraseña de 16 caracteres** (algo como: `abcd efgh ijkl mnop`)

### 3. Configurar en Firebase

Ejecuta este comando en la terminal:

```bash
firebase functions:secrets:set GMAIL_PASSWORD
```

Cuando te pida el valor, **pega la contraseña de 16 caracteres SIN ESPACIOS**

Ejemplo: si la contraseña generada es `abcd efgh ijkl mnop`, introduce: `abcdefghijklmnop`

### 4. Volver a desplegar

```bash
firebase deploy --only functions
```

### 5. Probar

1. Ve a la app como usuario
2. Solicita un cambio en "Mis Tablas"
3. Revisa el email en inaviciba@gmail.com

## Estado Actual

❌ Gmail rechaza la contraseña normal
✅ La función está desplegada correctamente
✅ El trigger se activa cuando se crea una notificación
⏳ Solo falta configurar la contraseña de aplicación

## Alternativa: Usar otro servicio de email

Si prefieres no usar Gmail, puedes usar:
- SendGrid (gratis hasta 100 emails/día)
- Mailgun (gratis hasta 5000 emails/mes)
- Amazon SES (muy económico)

Avísame si prefieres usar otro servicio.
