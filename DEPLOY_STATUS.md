# 🚀 Deploy - Opciones

## ⚠️ Problema de Permisos Detectado

**Cuenta actual**: `ruiznutricionapp@gmail.com`  
**Proyecto configurado**: `gymapp-bd0da`  
**Estado**: Sin permisos de acceso ❌

---

## ✅ Servidor de Desarrollo Iniciado

**URL**: http://localhost:3000

Puedes probar la aplicación ahora mismo en modo desarrollo con todos los cambios:
- ✅ Nuevo sistema de ejercicios
- ✅ Gestión con fotos/videos
- ✅ Tablas por días de semana
- ✅ WorkoutLogger renovado

---

## 🔧 Soluciones para Deploy

### Opción 1: Cambiar de Cuenta Firebase (Recomendado)

```bash
# Cerrar sesión actual
firebase logout

# Iniciar sesión con la cuenta correcta (max@max.es o la que tenga permisos)
firebase login

# Desplegar
firebase deploy --only hosting
```

### Opción 2: Agregar Permisos a la Cuenta Actual

1. Ve a [Firebase Console - IAM](https://console.firebase.google.com/project/gymapp-bd0da/settings/iam)
2. Invita a `ruiznutricionapp@gmail.com`
3. Asigna rol: **Editor** o **Owner**
4. Acepta la invitación en el email
5. Luego ejecuta: `firebase deploy --only hosting`

### Opción 3: Deploy Manual desde Firebase Console

1. **Build** ya está listo en la carpeta `build/` ✅
2. Ve a [Firebase Hosting Console](https://console.firebase.google.com/project/gymapp-bd0da/hosting)
3. Click en "Deploy"
4. Arrastra la carpeta `build/` completa
5. Confirma el deploy

### Opción 4: Actualizar Reglas Manualmente

Las reglas de Firestore se pueden actualizar desde:
1. [Firestore Rules Console](https://console.firebase.google.com/project/gymapp-bd0da/firestore/rules)
2. Copia el contenido de `firestore.rules`
3. Pega en el editor
4. Click "Publicar"

---

## 📦 Estado del Build

```
✅ Build completado exitosamente
📦 Tamaño: 314.13 kB (JavaScript) + 13.62 kB (CSS)
📁 Ubicación: build/
🎯 Reducción: -4.48 kB vs versión anterior
```

---

## 🧪 Probar Localmente

La aplicación está corriendo en:
- **Frontend**: http://localhost:3000
- **Base de datos**: Firebase Production (gymapp-bd0da)

**Notas:**
- Las reglas de Firestore antiguas siguen activas
- Los cambios funcionarán porque son retrocompatibles
- Idealmente despliega las nuevas reglas cuando puedas

---

## 🎯 Qué Probar

### 1. Nuevo Gestor de Ejercicios
- [ ] Navega a "💪 Ejercicios"
- [ ] Crea una categoría
- [ ] Crea un ejercicio con foto
- [ ] Verifica que se guarda correctamente

### 2. WorkoutLogger
- [ ] Ve a "🏋️ Entrenar"
- [ ] Selecciona un ejercicio
- [ ] Completa series/reps/peso
- [ ] Guarda el entrenamiento

### 3. Tablas Asignadas
- [ ] Ve a "📋 Mis Tablas"
- [ ] Verifica que se muestran por días
- [ ] Click en fotos de ejercicios

---

## 📝 Comandos Útiles

```bash
# Ver logs de desarrollo
# (en la ventana que se abrió automáticamente)

# Detener servidor
# Ctrl+C en la ventana del servidor

# Rebuild
npm run build

# Deploy (cuando tengas permisos)
firebase deploy --only hosting

# Deploy todo (hosting + reglas + functions)
firebase deploy
```

---

## 🆘 Si Algo Falla

1. **Error de compilación**: `npm install && npm start`
2. **Firestore permisos**: Verifica Firebase Console
3. **No aparecen ejercicios**: Créalos desde la app
4. **Servidor no responde**: Reinicia con `npm start`

---

**¡La app está lista para probar en http://localhost:3000! 🎉**
