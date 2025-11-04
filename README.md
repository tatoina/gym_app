# gym_app

## 🏋️‍♂️ GymApp - Tracker de Entrenamientos

Una aplicación web desarrollada con React y Firebase para trackear entrenamientos de gimnasio.

## ✨ Características

- **Autenticación de usuarios**: Registro e inicio de sesión con email y contraseña
- **Registro de entrenamientos**: Añade ejercicios con series, repeticiones y peso
- **Historial completo**: Visualiza todos tus entrenamientos anteriores
- **Máquinas personalizadas**: Crea tu catálogo de máquinas con foto y descripción
- **Interfaz responsive**: Experiencia mobile-first adaptable a cualquier pantalla
- **PWA instalable**: Se puede instalar en Android, iOS (Safari) y escritorio
- **Tiempo real**: Datos sincronizados con Firebase Firestore

## 🚀 Tecnologías

- **Frontend**: React 18 con TypeScript
- **Backend**: Firebase (Authentication + Firestore)
- **Estilos**: CSS3 con diseño responsive
- **Build**: Create React App

## ⚡ Instalación y Uso

### Prerrequisitos
- Node.js (versión 14 o superior)
- Una cuenta de Firebase

### Configuración de Firebase
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto
3. Habilita Authentication (Email/Password)
4. Crea una base de datos Firestore
5. Habilita Firebase Storage
6. Copia la configuración de tu proyecto
7. Reemplaza las credenciales en `src/services/firebase.ts`

### Comandos

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm start

# Construir para producción
npm run build

# Ejecutar tests
npm test
```

## 📱 Uso de la Aplicación

1. **Registro/Login**: Crea una cuenta o inicia sesión
2. **Añadir máquinas**: Usa "+ Añadir máquina" para registrar nombre, foto y descripción
3. **Agregar ejercicio**: Haz clic en "+ Agregar Ejercicio" y selecciona la máquina
4. **Completar datos**: Ajusta series, repeticiones y peso
5. **Guardar entrenamiento**: Haz clic en "💾 Guardar Entrenamiento"
6. **Ver historial**: Revisa todos tus entrenamientos anteriores

## PWA e Instalación

- La app incluye `manifest.json`, service worker y assets optimizados.
- Para generar iconos propios ejecuta `npm run generate:icons` después de actualizar `scripts/generate-icons.js`.
- En producción (`npm run build`) se registra el service worker automáticamente.
- Para probar la instalabilidad en local sirve la carpeta `build` (por ejemplo con `npx serve build`) y ábrela en un navegador móvil o simulador.

## Estructura del Proyecto

```
src/
├── components/
│   ├── Auth.tsx              # Componente de autenticación
│   ├── Auth.css              # Estilos de autenticación
│   ├── WorkoutLogger.tsx     # Componente principal de entrenamientos
│   └── WorkoutLogger.css     # Estilos del logger
├── services/
│   └── firebase.ts           # Configuración de Firebase
├── App.tsx                   # Componente principal
├── App.css                   # Estilos principales
├── service-worker.ts         # Service worker personalizado para PWA
├── serviceWorkerRegistration.ts # Registro del service worker
├── index.tsx                 # Punto de entrada
└── index.css                 # Estilos globales

public/
├── manifest.json             # Manifest PWA
└── icons/                    # Iconos instalables (192px y 512px)

scripts/
└── generate-icons.js         # Script para regenerar iconos
```

## 🔧 Configuración Requerida

Antes de usar la aplicación, debes configurar Firebase:

1. Edita `src/services/firebase.ts`
2. Reemplaza los valores de `firebaseConfig` con tu configuración real
3. Asegúrate de que Authentication, Firestore y Storage estén habilitados

## 📝 Notas de Desarrollo

- La aplicación usa TypeScript para type safety.
- Firebase se usa para autenticación, almacenamiento de datos y fotos.
- El diseño es mobile-first y optimizado para PWA instalables.
- Los datos se guardan en tiempo real en Firestore.
- Firestore organiza los datos en colecciones `machines` (máquinas del usuario) y `workouts` (entrenamientos).

## 🎯 Próximas Características

- [ ] Gráficos de progreso
- [ ] Rutinas predefinidas
- [ ] Compartir entrenamientos
- [ ] Estadísticas avanzadas
- [ ] Modo offline

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia ISC.
