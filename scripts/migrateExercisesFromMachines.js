const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

const db = admin.firestore();

async function migrateExercises() {
  try {
    console.log('🔄 Migrando ejercicios de estructura de máquinas a categorías...\n');

    // 1. Cargar todos los ejercicios
    const exercisesSnapshot = await db.collection('exercises').get();
    console.log(`📋 Encontrados ${exercisesSnapshot.size} ejercicios\n`);

    if (exercisesSnapshot.size === 0) {
      console.log('❌ No hay ejercicios para migrar');
      process.exit(0);
    }

    // 2. Extraer categorías únicas del campo machineName
    const categoryNames = new Set();
    exercisesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.machineName && typeof data.machineName === 'string') {
        categoryNames.add(data.machineName.trim());
      }
    });

    console.log(`📂 Categorías encontradas (${categoryNames.size}):`);
    Array.from(categoryNames).sort().forEach(cat => {
      console.log(`   - ${cat}`);
    });
    console.log('');

    // 3. Crear categorías en exerciseCategories
    console.log('📁 Creando categorías en exerciseCategories...');
    const categoryMap = new Map();
    
    for (const categoryName of categoryNames) {
      const catRef = db.collection('exerciseCategories').doc();
      await catRef.set({
        name: categoryName,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      categoryMap.set(categoryName, catRef.id);
      console.log(`  ✅ ${categoryName} (${catRef.id})`);
    }
    console.log('');

    // 4. Actualizar ejercicios
    console.log('💪 Actualizando ejercicios...');
    let updated = 0;
    let skipped = 0;
    
    const batch = db.batch();
    let operationCount = 0;
    const maxBatchSize = 500;

    for (const doc of exercisesSnapshot.docs) {
      const data = doc.data();
      const machineName = data.machineName?.trim();
      
      if (machineName && categoryMap.has(machineName)) {
        const categoryId = categoryMap.get(machineName);
        batch.update(doc.ref, {
          category: categoryId,
          categoryName: machineName,
          // Mantener machineId y machineName para compatibilidad pero ya no son necesarios
        });
        updated++;
        operationCount++;

        // Firebase batch tiene límite de 500 operaciones
        if (operationCount >= maxBatchSize) {
          await batch.commit();
          console.log(`  ✓ Batch de ${operationCount} ejercicios guardado`);
          operationCount = 0;
        }
      } else {
        console.log(`  ⚠️  Ejercicio sin categoría: ${data.name}`);
        skipped++;
      }
    }
    
    // Commit final batch
    if (operationCount > 0) {
      await batch.commit();
      console.log(`  ✓ Batch final de ${operationCount} ejercicios guardado`);
    }
    
    console.log('');
    console.log('🎉 Migración completada!');
    console.log(`📊 Resumen:`);
    console.log(`   - ${categoryMap.size} categorías creadas`);
    console.log(`   - ${updated} ejercicios actualizados`);
    console.log(`   - ${skipped} ejercicios sin categoría`);
    console.log('');
    console.log('✅ Ahora los ejercicios aparecerán organizados por categorías en la app');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

migrateExercises();
