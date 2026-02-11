const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

const db = admin.firestore();

async function fixExercisesCategories() {
  try {
    console.log('🔧 Arreglando ejercicios y categorías...\n');

    // 1. Cargar todos los ejercicios
    const exercisesSnapshot = await db.collection('exercises').get();
    console.log(`📋 Encontrados ${exercisesSnapshot.size} ejercicios\n`);

    if (exercisesSnapshot.size === 0) {
      console.log('❌ No hay ejercicios para procesar');
      process.exit(0);
    }

    // 2. Mostrar el primer ejercicio para entender la estructura
    const firstExercise = exercisesSnapshot.docs[0].data();
    console.log('📄 Estructura del primer ejercicio:');
    console.log(JSON.stringify(firstExercise, null, 2));
    console.log('\n📊 Campos disponibles:', Object.keys(firstExercise).join(', '));
    console.log('\n');

    // 3. Intentar extraer categorías únicas de diferentes campos posibles
    const categoryFields = ['categoryName', 'category', 'grupo', 'group', 'type', 'muscleGroup'];
    let categoriesMap = new Map();
    
    // Probar cada campo
    for (const field of categoryFields) {
      const uniqueValues = new Set();
      exercisesSnapshot.docs.forEach(doc => {
        const value = doc.data()[field];
        if (value && typeof value === 'string' && value.trim()) {
          uniqueValues.add(value.trim());
        }
      });
      
      if (uniqueValues.size > 0) {
        console.log(`✅ Campo "${field}" tiene ${uniqueValues.size} valores únicos:`);
        console.log(`   ${Array.from(uniqueValues).join(', ')}\n`);
        
        // Usar este campo para las categorías
        for (const catName of uniqueValues) {
          if (!categoriesMap.has(catName)) {
            categoriesMap.set(catName, null); // ID se asignará después
          }
        }
        
        // Usar el primer campo válido que encontremos
        if (categoriesMap.size > 0) {
          console.log(`🎯 Usando el campo "${field}" para las categorías\n`);
          
          // 4. Crear categorías en exerciseCategories
          console.log('📁 Creando categorías en exerciseCategories...');
          for (const catName of categoriesMap.keys()) {
            const catRef = db.collection('exerciseCategories').doc();
            await catRef.set({
              name: catName,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            categoriesMap.set(catName, catRef.id);
            console.log(`  ✅ ${catName} (${catRef.id})`);
          }
          console.log('');

          // 5. Actualizar ejercicios con category e categoryId correctos
          console.log('💪 Actualizando ejercicios...');
          let updated = 0;
          
          const batch = db.batch();
          exercisesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const categoryName = data[field];
            
            if (categoryName && categoriesMap.has(categoryName)) {
              const categoryId = categoriesMap.get(categoryName);
              batch.update(doc.ref, {
                category: categoryId,
                categoryName: categoryName
              });
              updated++;
            }
          });
          
          await batch.commit();
          console.log(`  ✅ ${updated} ejercicios actualizados\n`);
          
          console.log('🎉 Proceso completado!');
          console.log(`📊 Resumen:`);
          console.log(`   - ${categoriesMap.size} categorías creadas`);
          console.log(`   - ${updated} ejercicios actualizados`);
          
          process.exit(0);
        }
      }
    }

    console.log('❌ No se encontró ningún campo válido para categorías');
    console.log('💡 Revisa la estructura del primer ejercicio arriba para determinar qué campo usar');
    
    process.exit(1);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixExercisesCategories();
