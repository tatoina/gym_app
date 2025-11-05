// Script para limpiar todos los posts de MAX SOCIAL antes del lanzamiento oficial
// ADVERTENCIA: Este script eliminará TODOS los posts de la base de datos
// Ejecutar con: node scripts/clearPosts.js

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

async function clearAllPosts() {
  console.log('🚨 ADVERTENCIA: Este script eliminará TODOS los posts de MAX SOCIAL');
  console.log('⏳ Iniciando limpieza en 3 segundos...');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    console.log('📥 Obteniendo posts...');
    const postsRef = collection(db, 'posts');
    const snapshot = await getDocs(postsRef);
    
    if (snapshot.empty) {
      console.log('✅ No hay posts para eliminar.');
      process.exit(0);
    }
    
    console.log(`📊 Se encontraron ${snapshot.size} posts`);
    console.log('🗑️  Eliminando posts...');
    
    let deletedCount = 0;
    const deletePromises = [];
    
    snapshot.docs.forEach((document) => {
      deletePromises.push(
        deleteDoc(doc(db, 'posts', document.id))
          .then(() => {
            deletedCount++;
            console.log(`   ✓ Post ${deletedCount}/${snapshot.size} eliminado`);
          })
      );
    });
    
    await Promise.all(deletePromises);
    
    console.log('');
    console.log('✅ ¡Limpieza completada!');
    console.log(`📊 Total de posts eliminados: ${deletedCount}`);
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al limpiar posts:', error);
    process.exit(1);
  }
}

// Ejecutar
clearAllPosts();
