# 📧 Sistema de Emails de Bienvenida - MAXGYM

## Descripción

Cuando un **Coach** crea un nuevo usuario desde el Panel de Administración, se envía automáticamente un email de bienvenida completo con:

- ✅ Credenciales de acceso (email y contraseña temporal: `000000`)
- ✅ Instrucciones detalladas para instalar la PWA en diferentes dispositivos
- ✅ Pasos para el primer inicio de sesión
- ✅ Características principales de MAXGYM
- ✅ Información de contacto y soporte

## 📋 Contenido del Email

### 1. **Credenciales de Acceso**
- Email del usuario
- Contraseña temporal: `000000`
- Advertencia para cambiar la contraseña

### 2. **Instrucciones de Instalación de la PWA**

#### 📱 iPhone/iPad (Safari)
1. Abrir Safari y visitar: `gymapp-bd0da.web.app`
2. Tocar el botón **Compartir** ⬆️ (abajo en el centro)
3. Deslizar hacia abajo y seleccionar **"Añadir a pantalla de inicio"** ➕
4. Tocar **"Añadir"** en la esquina superior derecha
5. ¡Listo! MAXGYM aparecerá en la pantalla de inicio

#### 🤖 Android (Chrome)
1. Abrir Google Chrome y visitar: `gymapp-bd0da.web.app`
2. Tocar el menú **⋮** (tres puntos arriba a la derecha)
3. Seleccionar **"Añadir a pantalla de inicio"** o **"Instalar app"**
4. Confirmar tocando **"Añadir"** o **"Instalar"**
5. ¡Listo! La app estará disponible como cualquier otra

#### 💻 PC/Mac (Chrome, Edge)
1. Abrir Chrome o Edge y visitar: `gymapp-bd0da.web.app`
2. Mirar en la barra de direcciones, verás un icono de **instalación** ⊕
3. Hacer clic en él y seleccionar **"Instalar"**
4. La app se abrirá en su propia ventana
5. ¡Acceso directo creado en el escritorio!

### 3. **Primeros Pasos**
1. Acceder a la aplicación con email y contraseña `000000`
2. Cambiar la contraseña por una segura
3. Explorar las tablas de ejercicios asignadas
4. Registrar entrenamientos diarios
5. Consultar el historial de progreso

### 4. **Características Destacadas**
- 📊 Seguimiento de entrenamientos (series, reps, peso)
- 📋 Tablas personalizadas asignadas por el coach
- 📈 Historial completo de progreso
- 🎥 Videos y fotos de los ejercicios

## 🔧 Configuración Técnica

### Cloud Function: `sendWelcomeEmail`

**Ubicación:** `/functions/index.js`

**Trigger:** Llamada manual desde `AdminPanel.tsx` cuando se crea un usuario

**Seguridad:** 
- Solo usuarios autenticados pueden llamarla
- Solo el admin (`max@max.es`) tiene permisos

**Parámetros requeridos:**
```javascript
{
  userEmail: string,  // Email del nuevo usuario
  userName: string    // Nombre del nuevo usuario
}
```

### Variables de Entorno (Secrets)

El sistema usa Firebase Secrets para las credenciales de Gmail:

```bash
GMAIL_EMAIL=tu-email@gmail.com
GMAIL_PASSWORD=tu-app-password
```

**Nota:** Debes generar una **Contraseña de Aplicación** en tu cuenta de Gmail (no usar la contraseña normal).

### Configurar Secrets en Firebase

```bash
firebase functions:secrets:set GMAIL_EMAIL
firebase functions:secrets:set GMAIL_PASSWORD
```

## 🚀 Flujo de Creación de Usuario

```
1. Coach entra al Panel Admin → Gestión de Usuarios
2. Click en "➕ Crear Usuario"
3. Completa el formulario:
   - Nombre
   - Apellidos
   - Email
   - Teléfono (opcional)
4. Click en "✅ Crear Usuario"
5. Sistema:
   a. Crea cuenta en Firebase Auth (password: 000000)
   b. Crea documento en Firestore (/users/{uid})
   c. Llama a Cloud Function sendWelcomeEmail
   d. Envía email con todas las instrucciones
6. Usuario recibe el email y puede empezar a usar MAXGYM
```

## 📧 Preview del Email

Para ver cómo se ve el email, abre el archivo:
```
EMAIL_PREVIEW.html
```

Este archivo contiene el HTML exacto del email que recibirán los usuarios.

## ✅ Testing

### Probar en Desarrollo Local
1. Crear un usuario de prueba desde el Panel Admin
2. Verificar logs en consola para errores
3. Revisar que el email llegue correctamente

### Verificar Cloud Functions
```bash
firebase functions:log --only sendWelcomeEmail
```

## 🐛 Troubleshooting

### El email no se envía
1. Verificar que los secrets de Gmail estén configurados:
   ```bash
   firebase functions:secrets:access GMAIL_EMAIL
   firebase functions:secrets:access GMAIL_PASSWORD
   ```

2. Verificar permisos del usuario autenticado:
   - Solo `max@max.es` puede crear usuarios

3. Revisar logs de Cloud Functions:
   ```bash
   firebase functions:log
   ```

### El email llega a spam
- Verificar que el dominio de Gmail esté verificado
- Asegurar que la contraseña de aplicación sea válida
- Considerar usar un servicio de email transaccional (SendGrid, Mailgun)

### Error de autenticación
- Regenerar la contraseña de aplicación de Gmail
- Actualizar el secret:
  ```bash
  firebase functions:secrets:set GMAIL_PASSWORD
  firebase deploy --only functions
  ```

## 📱 URLs de la Aplicación

- **Producción:** https://gymapp-bd0da.web.app
- **Desarrollo:** http://localhost:3000

**Nota:** El email usa la URL de producción para que funcione correctamente.

## 🔐 Seguridad

- ✅ Solo coaches pueden crear usuarios
- ✅ Email validado antes de crear cuenta
- ✅ Contraseña temporal segura (usuario debe cambiarla)
- ✅ Secrets protegidos en Firebase
- ✅ Logs de auditoría en Cloud Functions

## 📞 Soporte

Para problemas o dudas sobre el sistema de emails:
- Email: inaviciba@gmail.com
- Revisar documentación: `/functions/index.js`

---

**Última actualización:** Febrero 2026
**Versión:** 2.0.0
