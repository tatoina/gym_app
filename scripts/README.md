# Scripts de Limpieza Pre-Lanzamiento

Scripts para limpiar datos de prueba antes del lanzamiento oficial de MAXGYM.

## ⚠️ ADVERTENCIA
Estos scripts son **IRREVERSIBLES**. Los datos eliminados no se pueden recuperar.

## 📋 Scripts Disponibles

### 🌟 `clearPosts.js` - Limpiar MAX SOCIAL
Elimina **TODOS** los posts de MAX SOCIAL.

```bash
node scripts/clearPosts.js
```

### 💪 `clearWorkouts.js` - Limpiar Entrenamientos
Elimina **TODOS** los entrenamientos registrados (historial completo).

```bash
node scripts/clearWorkouts.js
```

### 🔥 `clearAll.js` - Limpieza COMPLETA (RECOMENDADO)
Elimina **TODOS** los posts Y entrenamientos en una sola ejecución.

```bash
node scripts/clearAll.js
```

## � Uso Paso a Paso

### Antes del lanzamiento oficial:

1. **Instalar dependencias de Firebase (si no están instaladas)**
   ```bash
   npm install
   ```

2. **Elegir el script según lo que necesites limpiar:**
   - Solo posts: `node scripts/clearPosts.js`
   - Solo entrenamientos: `node scripts/clearWorkouts.js`
   - **Todo (recomendado para pre-lanzamiento)**: `node scripts/clearAll.js`

3. **El script hará:**
   - Mostrar advertencia con tiempo de cancelación
   - Contar cuántos registros hay
   - Eliminarlos todos uno por uno
   - Mostrar progreso en tiempo real
   - Mostrar resumen al finalizar

## 🎯 Cuándo usar

- **Antes del lanzamiento oficial**: Para empezar con la base de datos limpia
- **Después de pruebas**: Para eliminar datos de testing
- **Nunca en producción activa**: A menos que quieras borrar todo intencionalmente

## 💡 Alternativas

Si solo quieres eliminar posts específicos:
- Usa la interfaz de MAX SOCIAL (botón 🗑️ en cada post)
- Usa Firebase Console: https://console.firebase.google.com/project/gymapp-bd0da/firestore

## 🔐 Seguridad

Este script solo puede ser ejecutado por alguien con acceso al proyecto y las credenciales de Firebase.
