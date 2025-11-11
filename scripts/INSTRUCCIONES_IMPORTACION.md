# 📥 IMPORTAR MÁQUINAS A FIREBASE

## Preparación del archivo CSV

1. **Renombra** el archivo `plantilla_maquinas.csv` a `maquinas_gym.csv`
2. **Edita** el archivo con tus datos reales

### Formato del CSV:

```
Número,Nombre,Categoría,Descripción,URL Foto
1,Press de Banca,Pecho,Ejercicio para pecho con barra,https://ejemplo.com/foto1.jpg
2,Sentadilla,Piernas,Ejercicio de piernas con barra,https://ejemplo.com/foto2.jpg
```

### Columnas:
- **Número**: Número de la máquina (solo para referencia)
- **Nombre**: Nombre de la máquina (REQUERIDO)
- **Categoría**: Pecho, Piernas, Espalda, Hombros, Brazos, etc.
- **Descripción**: Descripción del ejercicio
- **URL Foto**: Link a la foto de la máquina (opcional)

## Importar las máquinas

1. **Instalar dependencias** (solo la primera vez):
```bash
npm install firebase
```

2. **Ejecutar el script de importación**:
```bash
node scripts/importMachines.js
```

El script:
- ✅ Lee el archivo CSV
- ✅ Valida los datos
- ✅ Muestra una preview de las máquinas
- ✅ Importa las máquinas a Firebase como globales (isGlobal: true)
- ✅ Max podrá ver, editar y eliminar estas máquinas desde el panel de administración

## Resultado

Todas las máquinas se crearán como **máquinas globales** del gimnasio y estarán disponibles:
- ✅ Para todos los usuarios en la app
- ✅ Max podrá editarlas desde el Panel de Administración
- ✅ Incluyen el campo **Categoría** para organizar mejor
- ✅ Max puede añadir/editar/eliminar máquinas manualmente desde la app

## Notas

- Las máquinas importadas tendrán `isGlobal: true`
- Max puede gestionar TODAS las máquinas globales
- Los usuarios normales NO pueden editar ni eliminar máquinas globales
- Las fotos deben ser URLs públicas (puedes subirlas a Firebase Storage primero)
