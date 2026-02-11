const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); // Asegúrate de tener este archivo

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function deleteMachinesCollection() {
  console.log('🗑️ Iniciando eliminación de la colección "machines"...');
  
  try {
    const machinesRef = db.collection('machines');
    const snapshot = await machinesRef.get();
    
    if (snapshot.empty) {
      console.log('✅ La colección "machines" ya está vacía o no existe');
      return;
    }
    
    console.log(`📋 Se encontraron ${snapshot.size} documentos en la colección "machines"`);
    console.log('⚠️ Esta acción eliminará permanentemente todas las máquinas');
    console.log('⏳ Procediendo con la eliminación en 3 segundos...');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const batch = db.batch();
    let count = 0;
    
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
    });
    
    await batch.commit();
    
    console.log(`✅ Se eliminaron ${count} máquinas correctamente`);
    console.log('🎉 Colección "machines" eliminada completamente');
    
  } catch (error) {
    console.error('❌ Error al eliminar la colección "machines":', error);
    throw error;
  }
}

async function updateWorkoutsToExercises() {
  console.log('\n🔄 Verificando entrenamientos con machineId...');
  
  try {
    const workoutsRef = db.collection('workouts');
    const snapshot = await workoutsRef.where('machineId', '!=', null).get();
    
    if (snapshot.empty) {
      console.log('✅ No hay entrenamientos con machineId (ya están migrados)');
      return;
    }
    
    console.log(`⚠️ Se encontraron ${snapshot.size} entrenamientos con machineId`);
    console.log('💡 Estos deben migrarse manualmente a exerciseId');
    console.log('   O eliminarlos si son entrenamientos antiguos');
    
    // Aquí podrías agregar lógica para migrar o eliminar
    // Por ahora solo informamos
    
  } catch (error) {
    console.error('❌ Error al verificar workouts:', error);
  }
}

async function main() {
  console.log('🏋️ GymApp - Limpieza de Base de Datos');
  console.log('=====================================\n');
  console.log('Este script eliminará:');
  console.log('- ❌ Colección de "machines"');
  console.log('- ⚠️ Revisará entrenamientos con machineId\n');
  
  try {
    await deleteMachinesCollection();
    await updateWorkoutsToExercises();
    
    console.log('\n✅ Limpieza completada exitosamente');
    console.log('\n📝 Próximos pasos:');
    console.log('1. Desplegar las nuevas reglas de Firestore: firebase deploy --only firestore:rules');
    console.log('2. Crear ejercicios usando el componente ExercisesManager');
    console.log('3. Asignar tablas a usuarios con los nuevos ejercicios\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error durante la limpieza:', error);
    process.exit(1);
  }
}

main();
