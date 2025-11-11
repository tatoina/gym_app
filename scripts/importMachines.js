// Script para importar máquinas desde un archivo CSV a Firestore
// Las máquinas se crean como globales (isGlobal: true) sin userId
// Ejecutar con: node scripts/importMachines.js

const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');

// Configuración de Firebase
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

// Función para parsear CSV
function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  const machines = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length >= 4 && values[0]) {
      machines.push({
        number: values[0],
        name: values[1],
        category: values[2] || '',
        description: values[3] || '',
        photoUrl: values[4] || ''
      });
    }
  }
  
  return machines;
}

async function importMachines() {
  const csvFile = './scripts/maquinas_gym.csv';
  
  console.log('📥 Importando máquinas del gimnasio...\n');
  
  // Verificar si existe el archivo
  if (!fs.existsSync(csvFile)) {
    console.error('❌ No se encontró el archivo: maquinas_gym.csv');
    console.log('\n📝 Instrucciones:');
    console.log('1. Renombra "plantilla_maquinas.csv" a "maquinas_gym.csv"');
    console.log('2. Edita el archivo con los datos reales de las máquinas');
    console.log('3. Ejecuta este script nuevamente\n');
    process.exit(1);
  }
  
  try {
    // Leer archivo CSV
    const content = fs.readFileSync(csvFile, 'utf-8');
    const machines = parseCSV(content);
    
    if (machines.length === 0) {
      console.log('⚠️  No se encontraron máquinas en el archivo CSV');
      process.exit(0);
    }
    
    console.log(`📊 Se encontraron ${machines.length} máquinas para importar\n`);
    
    // Mostrar preview
    console.log('Vista previa de las máquinas:');
    console.log('═══════════════════════════════════════');
    machines.forEach((machine, idx) => {
      console.log(`${idx + 1}. [${machine.number}] ${machine.name}`);
      if (machine.category) console.log(`   🏷️  Categoría: ${machine.category}`);
      if (machine.description) console.log(`   📝 ${machine.description}`);
      if (machine.photoUrl) console.log(`   🖼️  ${machine.photoUrl}`);
    });
    console.log('═══════════════════════════════════════\n');
    
    console.log('⏳ Esperando 3 segundos antes de importar...');
    console.log('   (Presiona Ctrl+C para cancelar)\n');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('🚀 Iniciando importación...\n');
    
    let importedCount = 0;
    const machinesRef = collection(db, 'machines');
    
    for (const machine of machines) {
      try {
        await addDoc(machinesRef, {
          name: machine.name,
          category: machine.category,
          description: machine.description,
          photoUrl: machine.photoUrl,
          isGlobal: true,  // Máquina global del gimnasio
          // Sin userId - máquina del gimnasio
          createdAt: new Date()
        });
        
        importedCount++;
        console.log(`   ✓ [${machine.number}] ${machine.name} - Importada`);
      } catch (error) {
        console.error(`   ✗ [${machine.number}] ${machine.name} - Error:`, error.message);
      }
    }
    
    console.log('\n═══════════════════════════════════════');
    console.log('✅ ¡Importación completada!');
    console.log('═══════════════════════════════════════');
    console.log(`📊 Total importadas: ${importedCount}/${machines.length}`);
    console.log('═══════════════════════════════════════\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al importar máquinas:', error);
    process.exit(1);
  }
}

// Ejecutar
importMachines();
