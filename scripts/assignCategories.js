// Script para asignar categorías a las máquinas de MAXGYM
// Ejecutar con: node scripts/assignCategories.js

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Mapeo de máquinas a categorías basado en los nombres
const machineCategories = {
  // BRAZOS
  'Curl con Mancuernas': 'Brazos',
  'Curl con Barra': 'Brazos',
  'Press Francés': 'Brazos',
  'Tricpes': 'Brazos',
  
  // HOMBROS
  'Press Militar': 'Hombros',
  'Elevaciones Frontales': 'Hombros',
  'Elevaciones Laterales': 'Hombros',
  
  // PECHO
  'Press de Banca': 'Pecho',
  'Press Inclinado': 'Pecho',
  'Aperturas con Mancuernas': 'Pecho',
  'Fondos en Paralelas': 'Pecho',
  
  // ESPALDA
  'Remo con Barra': 'Espalda',
  'Jalones al Pecho': 'Espalda',
  'Dominadas': 'Espalda',
  'Peso Muerto': 'Espalda',
  
  // PIERNAS
  'Curl Femoral': 'Piernas',
  'Extensión de Cuádriceps': 'Piernas',
  'Prensa de Piernas': 'Piernas',
  'Sentadilla con Barra': 'Piernas',
  'Abductor': 'Piernas',
  
  // CORE
  'CORE': 'Core',
  'Plancha': 'Core',
  'Abdominales en Máquina': 'Core',
  
  // PRIVADO_MAX
  'Rack': 'Privado_Max',
  'Jaca': 'Privado_Max',
  'Jaula': 'Privado_Max'
};

async function assignCategoriesToMachines() {
  try {
    console.log('🚀 Iniciando asignación de categorías...\n');
    
    // Primero, obtener o crear las categorías
    const categoriesSnapshot = await db.collection('categories').get();
    const existingCategories = {};
    
    categoriesSnapshot.forEach(doc => {
      existingCategories[doc.data().name] = doc.id;
    });
    
    console.log('📋 Categorías existentes:', Object.keys(existingCategories));
    
    // Crear categorías faltantes
    const uniqueCategories = [...new Set(Object.values(machineCategories))];
    for (const categoryName of uniqueCategories) {
      if (!existingCategories[categoryName]) {
        const docRef = await db.collection('categories').add({ name: categoryName });
        existingCategories[categoryName] = docRef.id;
        console.log(`✅ Categoría creada: ${categoryName}`);
      }
    }
    
    console.log('\n🏋️ Procesando máquinas globales...\n');
    
    // Obtener todas las máquinas globales
    const machinesSnapshot = await db.collection('machines')
      .where('isGlobal', '==', true)
      .get();
    
    let updated = 0;
    let notFound = 0;
    
    for (const doc of machinesSnapshot.docs) {
      const machine = doc.data();
      const machineName = machine.name;
      const categoryName = machineCategories[machineName];
      
      if (categoryName) {
        const categoryId = existingCategories[categoryName];
        
        await doc.ref.update({
          categoryId: categoryId,
          categoryName: categoryName
        });
        
        console.log(`✅ ${machineName} → ${categoryName}`);
        updated++;
      } else {
        console.log(`⚠️  ${machineName} → No tiene categoría asignada`);
        notFound++;
      }
    }
    
    console.log('\n📊 Resumen:');
    console.log(`   ✅ Actualizadas: ${updated}`);
    console.log(`   ⚠️  Sin categoría: ${notFound}`);
    console.log(`   📦 Total: ${machinesSnapshot.size}`);
    console.log('\n✨ Proceso completado!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

assignCategoriesToMachines();
