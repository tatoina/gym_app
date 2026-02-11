const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

const db = admin.firestore();

async function checkExercises() {
  try {
    console.log('🔍 Verificando ejercicios en Firebase...\n');

    // Verificar categorías
    const categoriesSnapshot = await db.collection('exerciseCategories').get();
    console.log(`📂 Categorías de ejercicios: ${categoriesSnapshot.size}`);
    
    if (categoriesSnapshot.size > 0) {
      categoriesSnapshot.forEach(doc => {
        console.log(`   - ${doc.data().name} (${doc.id})`);
      });
    }
    console.log('');

    // Verificar ejercicios
    const exercisesSnapshot = await db.collection('exercises').get();
    console.log(`💪 Total de ejercicios: ${exercisesSnapshot.size}\n`);
    
    if (exercisesSnapshot.size > 0) {
      // Agrupar por categoría
      const byCategory = {};
      exercisesSnapshot.forEach(doc => {
        const data = doc.data();
        const catName = data.categoryName || data.category || 'Sin categoría';
        if (!byCategory[catName]) {
          byCategory[catName] = [];
        }
        byCategory[catName].push(data.name);
      });

      console.log('📊 Ejercicios por categoría:');
      Object.keys(byCategory).sort().forEach(cat => {
        console.log(`\n  🏷️  ${cat} (${byCategory[cat].length} ejercicios):`);
        byCategory[cat].slice(0, 5).forEach(name => {
          console.log(`     - ${name}`);
        });
        if (byCategory[cat].length > 5) {
          console.log(`     ... y ${byCategory[cat].length - 5} más`);
        }
      });
    } else {
      console.log('⚠️  No hay ejercicios en la base de datos');
      console.log('\n💡 Puedes importarlos usando:');
      console.log('   node scripts/importExercises.js');
    }

    console.log('\n✅ Verificación completada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkExercises();
