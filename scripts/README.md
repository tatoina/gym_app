# Script de Limpieza de MAX SOCIAL

Este script elimina **TODOS** los posts de la base de datos de MAX SOCIAL.

## ⚠️ ADVERTENCIA
Este script es **IRREVERSIBLE**. Una vez ejecutado, todos los posts serán eliminados permanentemente.

## 📋 Uso

### Antes del lanzamiento oficial:

1. **Instalar dependencias de Firebase (si no están instaladas)**
   ```bash
   npm install
   ```

2. **Ejecutar el script**
   ```bash
   node scripts/clearPosts.js
   ```

3. **El script hará:**
   - Mostrar advertencia durante 3 segundos
   - Contar cuántos posts hay
   - Eliminarlos todos uno por uno
   - Mostrar progreso en tiempo real
   - Confirmar cuando termine

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
