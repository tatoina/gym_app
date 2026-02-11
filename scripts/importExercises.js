const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Inicializar Firebase Admin (usa las credenciales por defecto del proyecto)
admin.initializeApp();

const db = admin.firestore();

async function importExercises() {
  try {
    console.log('🚀 Iniciando importación de ejercicios...\n');

    // Leer el archivo JSON
    const ejerciciosPath = path.join(__dirname, '..', 'public', 'ejercicios_gym.json');
    const ejerciciosData = JSON.parse(fs.readFileSync(ejerciciosPath, 'utf8'));

    console.log(`📋 Encontrados ${ejerciciosData.length} ejercicios para importar\n`);

    // Extraer categorías únicas
    const categoriasUnicas = [...new Set(ejerciciosData.map(ej => ej.grupo))];
    console.log(`📂 Categorías encontradas: ${categoriasUnicas.join(', ')}\n`);

    // Crear un mapa de categorías
    const categoriaMap = {};

    // Crear categorías en Firestore
    console.log('📁 Creando categorías...');
    for (const nombreCategoria of categoriasUnicas) {
      const categoriaRef = db.collection('exerciseCategories').doc();
      await categoriaRef.set({
        name: nombreCategoria,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      categoriaMap[nombreCategoria] = categoriaRef.id;
      console.log(`  ✅ ${nombreCategoria} (${categoriaRef.id})`);
    }
    console.log('');

    // Importar ejercicios
    console.log('💪 Importando ejercicios...');
    let importados = 0;
    
    for (const ejercicio of ejerciciosData) {
      const categoryId = categoriaMap[ejercicio.grupo];
      
      const exerciseData = {
        name: ejercicio.nombre,
        category: categoryId,
        categoryName: ejercicio.grupo,
        description: `${ejercicio.nombre} - ${ejercicio.grupo}`,
        photoUrl: ejercicio.videoSource || null,
        mediaType: ejercicio.videoSource ? 'video' : 'image',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('exercises').add(exerciseData);
      importados++;
      console.log(`  ${importados}. ✅ ${ejercicio.nombre} (${ejercicio.grupo})`);
    }

    console.log(`\n🎉 Importación completada exitosamente!`);
    console.log(`📊 Resumen:`);
    console.log(`   - ${categoriasUnicas.length} categorías creadas`);
    console.log(`   - ${importados} ejercicios importados`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante la importación:', error);
    process.exit(1);
  }
}

importExercises();
