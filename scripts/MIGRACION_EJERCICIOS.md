# Migración de Máquinas a Ejercicios

Este directorio contiene los scripts de migración de la antigua estructura basada en máquinas a la nueva estructura basada en ejercicios.

## Cambios Realizados

### 1. Nueva Estructura de Ejercicios
- Los ejercicios ahora tienen nombre, descripción, categoría, foto y video
- Se eliminó la dependencia de máquinas
- Los usuarios pueden crear y gestionar ejercicios directamente

### 2. Asignación de Tablas por Días
- Las tablas asignadas ahora agrupan ejercicios por día de la semana (1-7)
- Cada ejercicio incluye: `exerciseId`, `exerciseName`, `day`, `series`, `reps`, `weight`, `notes`

### 3. Componentes Actualizados
- **ExercisesManager**: Nuevo componente para gestionar ejercicios (CRUD completo)
- **WorkoutLogger**: Actualizado para trabajar con ejercicios
- **AssignedTable**: Actualizado para mostrar ejercicios agrupados por días

### 4. Scripts de Limpieza

#### `cleanMachinesFromDB.js`
Elimina la colección de máquinas de Firestore.

**Uso:**
```bash
cd scripts
node cleanMachinesFromDB.js
```

**⚠️ ADVERTENCIA:** Este script es destructivo. Asegúrate de tener un backup antes de ejecutarlo.

### 5. Archivos Obsoletos

Los siguientes archivos ya no son necesarios:
- `scripts/importMachines.js`
- `scripts/ejemplo_maquinas.csv`
- `scripts/maquinas_gym.csv`
- `scripts/plantilla_maquinas.csv`
- `src/components/MachinesManager.tsx` (si existe)

Puedes eliminarlos manualmente o mantenerlos como referencia histórica.

## Pasos para Completar la Migración

1. **Backup de la base de datos**
   ```bash
   # Exportar colecciones importantes
   firebase firestore:export gs://tu-bucket/backup-$(date +%Y%m%d)
   ```

2. **Desplegar nuevas reglas de Firestore**
   ```bash
   firebase deploy --only firestore:rules
   ```

3. **Eliminar colección de máquinas** (opcional)
   ```bash
   cd scripts
   node cleanMachinesFromDB.js
   ```

4. **Crear ejercicios iniciales**
   - Usa el componente `ExercisesManager` en la aplicación
   - O crea un script de importación de ejercicios similar al antiguo de máquinas

5. **Migrar tablas existentes** (si las hay)
   - Las tablas antiguas con `machineId` deberán actualizarse manualmente
   - O se pueden marcar como completadas y crear nuevas tablas

## Ventajas de la Nueva Estructura

✅ **Más flexible**: Los ejercicios no dependen de máquinas físicas  
✅ **Mejor categorización**: Sistema de categorías más robusto  
✅ **Material educativo**: Cada ejercicio puede tener foto y video  
✅ **Planificación semanal**: Asignación por días facilita la organización  
✅ **Escalable**: Más fácil agregar nuevos datos (dificultad, músculos, etc.)  

## Notas

- El `AdminPanel` se mantuvo sin cambios mayores por su complejidad
- Se puede acceder a `ExercisesManager` creando una ruta específica o integrándolo después
- Los entrenamientos antiguos con `machineId` pueden seguir existiendo como historial
