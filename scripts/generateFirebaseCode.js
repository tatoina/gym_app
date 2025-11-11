// Script para generar código JavaScript que puedes copiar y pegar en la consola de Firebase
const fs = require('fs');

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const machines = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length >= 4 && values[1]) {
      machines.push({
        name: values[1],
        category: values[2] || '',
        description: values[3] || '',
        photoUrl: values[4] || ''
      });
    }
  }
  
  return machines;
}

const content = fs.readFileSync('./scripts/maquinas_gym.csv', 'utf-8');
const machines = parseCSV(content);

console.log('// COPIAR Y PEGAR EN LA CONSOLA DEL NAVEGADOR EN FIREBASE FIRESTORE');
console.log('// https://console.firebase.google.com/project/gymapp-bd0da/firestore/databases/-default-/data\n');
console.log('const machines = ' + JSON.stringify(machines, null, 2) + ';\n');
console.log(`
// Ejecutar este código en la consola del navegador:
async function importMachines() {
  const db = firebase.firestore();
  let count = 0;
  
  for (const machine of machines) {
    try {
      await db.collection('machines').add({
        ...machine,
        isGlobal: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      count++;
      console.log('✅ Importada: ' + machine.name);
    } catch (error) {
      console.error('❌ Error en: ' + machine.name, error);
    }
  }
  
  console.log('\\n🎉 Total importadas: ' + count + '/' + machines.length);
}

// Ejecutar la importación
importMachines();
`);
