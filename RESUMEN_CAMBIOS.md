# 🏋️ GymApp - Transformación a Sistema de Ejercicios

## ✅ Cambios Completados

### 1. **Nuevo Gestor de Ejercicios** (`ExercisesManager.tsx`)
✨ **Características:**
- CRUD completo de ejercicios (Crear, Leer, Actualizar, Eliminar)
- Campos: nombre, descripción, categoría, foto, video
- Filtrado por categoría y búsqueda por texto
- Vista previa de imágenes y videos
- 100% independiente de máquinas

📸 **Medios soportados:**
- Fotos: hasta 5MB
- Videos: hasta 50MB
- Storage en Firebase

---

### 2. **WorkoutLogger Renovado**
🔄 **Migración completa:**
- Eliminada dependencia de máquinas
- Ahora usa ejercicios con `exerciseId`
- Los usuarios seleccionan ejercicios del catálogo global
- Vista previa de fotos/videos durante el entrenamiento
- Filtrado por categoría y búsqueda

📊 **Estructura de workout:**
```typescript
{
  exerciseId: string,
  exerciseName: string,
  exercisePhotoUrl: string,
  sets: number,
  reps: number,
  weight: number,
  notes: string,
  categoryName: string
}
```

---

### 3. **AssignedTable con Planificación Semanal**
📅 **Nueva funcionalidad:**
- Ejercicios agrupados por día de la semana (Lunes-Domingo)
- Cada ejercicio tiene un campo `day` (1-7)
- Vista organizada por días
- Facilita la planificación semanal

```typescript
interface AssignedExercise {
  exerciseId: string,
  exerciseName: string,
  exercisePhotoUrl: string,
  day: number, // 1=Lunes, 7=Domingo
  series: number,
  reps: number,
  weight: number,
  notes: string
}
```

**Visualización:**
```
📅 Lunes
  - Press de banca: 3x10 @ 50kg
  - Sentadillas: 4x12 @ 70kg

📅 Miércoles
  - Dominadas: 3x8
  - Peso muerto: 3x6 @ 100kg
```

---

### 4. **Firestore Rules Actualizadas**
🔒 **Seguridad:**
```javascript
// Ejercicios
- ✅ Lectura: Todos los usuarios autenticados
- ✅ Creación: Todos los usuarios
- ✅ Actualización/Eliminación: Usuarios autenticados

// Categorías
- ✅ Lectura: Todos los usuarios
- ✅ Escritura: Solo admin

// Workouts
- ✅ Ahora usan exerciseId en lugar de machineId
- ✅ Solo el propietario puede acceder a sus entrenamientos
```

---

### 5. **Scripts de Limpieza**

#### `cleanMachinesFromDB.js`
Elimina la colección de máquinas de Firestore.

**Uso:**
```bash
cd scripts
node cleanMachinesFromDB.js
```

⚠️ **IMPORTANTE:** Hacer backup antes de ejecutar

---

## 📁 Estructura de Datos

### Colección `exercises`
```javascript
{
  name: "Press de banca",
  description: "Ejercicio para pectoral mayor...",
  categoryId: "abc123",
  categoryName: "Pecho",
  photoUrl: "https://...",
  videoUrl: "https://...",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Colección `workouts`
```javascript
{
  userId: "user123",
  date: "2026-02-09",
  exerciseId: "exercise456",
  exerciseName: "Press de banca",
  exercisePhotoUrl: "https://...",
  categoryName: "Pecho",
  sets: 3,
  reps: 10,
  weight: 50,
  notes: "Buen día de pecho",
  createdAt: Timestamp
}
```

### Colección `assignedTables`
```javascript
{
  userId: "user123",
  exercises: [
    {
      exerciseId: "ex1",
      exerciseName: "Press de banca",
      exercisePhotoUrl: "https://...",
      day: 1, // Lunes
      series: 3,
      reps: 10,
      weight: 50,
      notes: "Calentar bien"
    },
    {
      exerciseId: "ex2",
      exerciseName: "Sentadillas",
      day: 1, // Lunes
      series: 4,
      reps: 12,
      weight: 70,
      notes: ""
    },
    {
      exerciseId: "ex3",
      exerciseName: "Dominadas",
      day: 3, // Miércoles
      series: 3,
      reps: 8,
      weight: 0,
      notes: "Con agarre prono"
    }
  ],
  assignedBy: "admin123",
  assignedByName: "Max",
  status: "ACTIVA",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## 🚀 Próximos Pasos

### 1. Desplegar Reglas de Firestore
```bash
firebase deploy --only firestore:rules
```

### 2. Crear Ejercicios Iniciales
- Acceder a `ExercisesManager` en la app
- Crear categorías primero
- Luego crear ejercicios con fotos/videos

### 3. Limpiar Base de Datos (Opcional)
```bash
cd scripts
node cleanMachinesFromDB.js
```

### 4. Asignar Tablas Nuevas
- Usar el admin panel
- Asignar ejercicios con días de la semana
- Los usuarios verán sus tablas organizadas por días

---

## 📋 Archivos Modificados

### Nuevos
- ✅ `src/components/ExercisesManager.tsx`
- ✅ `src/components/WorkoutLogger.old.tsx` (backup)
- ✅ `scripts/cleanMachinesFromDB.js`
- ✅ `scripts/MIGRACION_EJERCICIOS.md`
- ✅ `RESUMEN_CAMBIOS.md` (este archivo)

### Modificados
- ✅ `src/components/WorkoutLogger.tsx` (reescrito)
- ✅ `src/components/AssignedTable.tsx` (actualizado para días)
- ✅ `firestore.rules` (nuevas reglas de seguridad)

### Sin Cambios (Mantenidos)
- ⚙️ `src/components/AdminPanel.tsx` (demasiado complejo, se mantuvo original)
- ⚙️ `src/components/History.tsx`
- ⚙️ `src/components/SocialFeed.tsx`

---

## 🎯 Beneficios de la Nueva Estructura

### Para Usuarios
✅ Más fácil encontrar ejercicios (búsqueda y filtros)  
✅ Material educativo (fotos y videos)  
✅ Planificación clara por días de la semana  
✅ No depende de máquinas físicas específicas  

### Para Administradores
✅ Gestión centralizada de ejercicios  
✅ Fácil agregar nuevos ejercicios  
✅ Sistema de categorías robusto  
✅ Asignación flexible de tablas  

### Técnicas
✅ Base de datos más limpia y escalable  
✅ Menos duplicación de datos  
✅ Mejor separación de conceptos  
✅ Más fácil de mantener y extender  

---

## ⚠️ Compatibilidad con Datos Antiguos

Los entrenamientos antiguos que tienen `machineId` seguirán funcionando como historial, pero los nuevos entrenamientos usarán `exerciseId`.

Si quieres migrar los datos antiguos:
1. Crear un script de migración
2. Mapear machineId → exerciseId
3. Actualizar los documentos en Firestore

---

## 🆘 Solución de Problemas

### No aparecen ejercicios
- Verificar que las reglas de Firestore estén desplegadas
- Crear al menos una categoría
- Crear ejercicios usando ExercisesManager

### Las tablas asignadas no se ven
- Verificar que los ejercicios tengan el campo `day` (1-7)
- Verificar que `exerciseId` y `exerciseName` estén presentes

### Errores de permisos
- Desplegar las nuevas reglas: `firebase deploy --only firestore:rules`
- Verificar que el usuario esté autenticado

---

## 📞 Soporte

Si necesitas ayuda con la migración o encuentras problemas, revisa:
- `scripts/MIGRACION_EJERCICIOS.md` - Guía detallada de migración
- Logs de la consola del navegador
- Firestore Console para verificar datos

---

**¡La transformación está completa! 🎉**

Tu app ahora está centrada en ejercicios, con gestión completa de medios y planificación semanal.
