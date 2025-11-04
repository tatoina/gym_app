# GymApp - Instrucciones para Copilot

Este proyecto es una aplicación de seguimiento de entrenamientos de gimnasio desarrollada con React y Firebase.

## Descripción del Proyecto

- **Tecnologías**: React 18 + TypeScript + Firebase
- **Funcionalidades**: 
  - Autenticación de usuarios (email/password)
  - Registro de entrenamientos con ejercicios
  - Historial de entrenamientos
  - Interfaz responsive

## Estructura de Componentes

- `Auth.tsx`: Maneja registro e inicio de sesión
- `WorkoutLogger.tsx`: Componente principal para registrar entrenamientos
- `App.tsx`: Componente raíz con gestión de estado de autenticación

## Configuración Firebase

Antes de usar la aplicación:
1. Configurar proyecto en Firebase Console
2. Habilitar Authentication (Email/Password)  
3. Crear base de datos Firestore
4. Actualizar credenciales en `src/services/firebase.ts`

## Comandos Disponibles

- `npm start`: Servidor de desarrollo
- `npm run build`: Build de producción
- `npm test`: Ejecutar tests

## Notas de Desarrollo

- TypeScript habilitado para type safety
- CSS modular para componentes
- Firebase para backend y autenticación
- Diseño mobile-first responsive
