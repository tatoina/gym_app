/**
 * Script para actualizar las reglas de Firebase Storage
 * Ejecutar con: node updateStorageRules.js
 */

const admin = require('firebase-admin');
const fs = require('fs');

// Leer las reglas desde storage.rules
const rules = fs.readFileSync('./storage.rules', 'utf8');

console.log('📝 Reglas de Storage a aplicar:');
console.log(rules);
console.log('\n⚠️  NOTA: Para aplicar las reglas de Storage:');
console.log('1. Ve a Firebase Console: https://console.firebase.google.com/project/gymapp-bd0da/storage/rules');
console.log('2. Copia y pega el contenido de storage.rules');
console.log('3. Haz click en "Publicar"\n');
