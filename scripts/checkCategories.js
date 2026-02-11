// Script para verificar categorías en Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Leer configuración de Firebase desde el archivo
const firebaseConfig = JSON.parse(
  readFileSync(join(__dirname, '../src/services/firebase.ts'), 'utf-8')
    .match(/const firebaseConfig = ({[\s\S]*?});/)[1]
    .replace(/'/g, '"')
);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkCategories() {
  try {
    console.log('🔍 Verificando categorías en Firebase...\n');
    
    // Obtener todas las categorías
    const categoriesSnapshot = await getDocs(collection(db, 'exerciseCategories'));
    console.log('📊 Total de categorías en exerciseCategories:', categoriesSnapshot.size);
    
    const categoriesList = [];
    categoriesSnapshot.forEach(doc => {
      const data = doc.data();
      categoriesList.push({ id: doc.id, name: data.name });
      console.log(`  ✅ ${doc.id} - ${data.name}`);
    });
    
    // Obtener todos los ejercicios
    console.log('\n🔍 Verificando ejercicios...');
    const exercisesSnapshot = await getDocs(collection(db, 'exercises'));
    console.log('📊 Total de ejercicios:', exercisesSnapshot.size);
    
    // Contar ejercicios por categoría
    const categoryCount = {};
    const categoriesInExercises = new Set();
    
    exercisesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.category) {
        categoryCount[data.category] = (categoryCount[data.category] || 0) + 1;
      }
      if (data.categoryName) {
        categoriesInExercises.add(data.categoryName);
      }
    });
    
    console.log('\n📈 Ejercicios por categoría (usando category ID):');
    Object.entries(categoryCount).forEach(([catId, count]) => {
      const cat = categoriesList.find(c => c.id === catId);
      console.log(`  ${cat ? cat.name : catId}: ${count} ejercicios`);
    });
    
    console.log('\n📝 Categorías únicas encontradas en ejercicios (categoryName):');
    Array.from(categoriesInExercises).sort().forEach(name => {
      console.log(`  - ${name}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkCategories();
