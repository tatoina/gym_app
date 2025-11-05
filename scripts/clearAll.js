// Script MAESTRO para limpiar TODA la base de datos antes del lanzamiento oficial
// ADVERTENCIA: Este script eliminará TODOS los posts Y workouts
// Ejecutar con: node scripts/clearAll.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

// Configuración de Firebase (copia de tu firebase.ts)
const firebaseConfig = {
  apiKey: "AIzaSyBa8pQpxcbQC7xvVCZKUrwBqY-vG6uYWrQ",
  authDomain: "gymapp-bd0da.firebaseapp.com",
  projectId: "gymapp-bd0da",
  storageBucket: "gymapp-bd0da.firebasestorage.app",
  messagingSenderId: "1059175556044",
  appId: "1:1059175556044:web:67fc6e5a71dc1d33e11ef1"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearCollection(collectionName) {
  console.log(`\n📥 Obteniendo ${collectionName}...`);
  const collectionRef = collection(db, collectionName);
  const snapshot = await getDocs(collectionRef);
  
  if (snapshot.empty) {
    console.log(`✅ No hay ${collectionName} para eliminar.`);
    return 0;
  }
  
  console.log(`📊 Se encontraron ${snapshot.size} ${collectionName}`);
  console.log(`🗑️  Eliminando ${collectionName}...`);
  
  let deletedCount = 0;
  const deletePromises = [];
  
  snapshot.docs.forEach((document) => {
    deletePromises.push(
      deleteDoc(doc(db, collectionName, document.id))
        .then(() => {
          deletedCount++;
          console.log(`   ✓ ${collectionName} ${deletedCount}/${snapshot.size} eliminado`);
        })
    );
  });
  
  await Promise.all(deletePromises);
  
  return deletedCount;
}

async function clearAllData() {
  console.log('🚨 ADVERTENCIA: Este script eliminará TODOS los datos de entrenamiento');
  console.log('   - POSTS de MAX SOCIAL');
  console.log('   - WORKOUTS (entrenamientos registrados)');
  console.log('');
  console.log('⏳ Iniciando limpieza completa en 5 segundos...');
  console.log('   (Presiona Ctrl+C para cancelar)');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    let totalDeleted = 0;
    
    // Limpiar posts
    console.log('\n═══════════════════════════════════════');
    console.log('🌟 LIMPIANDO MAX SOCIAL (posts)');
    console.log('═══════════════════════════════════════');
    const postsDeleted = await clearCollection('posts');
    totalDeleted += postsDeleted;
    
    // Limpiar workouts
    console.log('\n═══════════════════════════════════════');
    console.log('💪 LIMPIANDO ENTRENAMIENTOS (workouts)');
    console.log('═══════════════════════════════════════');
    const workoutsDeleted = await clearCollection('workouts');
    totalDeleted += workoutsDeleted;
    
    // Resumen final
    console.log('\n═══════════════════════════════════════');
    console.log('✅ ¡LIMPIEZA COMPLETA FINALIZADA!');
    console.log('═══════════════════════════════════════');
    console.log(`📊 Posts eliminados:    ${postsDeleted}`);
    console.log(`📊 Workouts eliminados: ${workoutsDeleted}`);
    console.log(`📊 TOTAL ELIMINADO:     ${totalDeleted}`);
    console.log('═══════════════════════════════════════\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al limpiar datos:', error);
    process.exit(1);
  }
}

// Ejecutar
clearAllData();
