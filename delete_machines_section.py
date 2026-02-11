import codecs

# Leer el archivo con UTF-8
with codecs.open('src/components/AdminPanel.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total líneas antes: {len(lines)}")
print(f"Línea 2042 (índice 2041): {repr(lines[2041])}")
print(f"Línea 2645 (índice 2644): {repr(lines[2644])}")

# Eliminar líneas 2042 a 2645 (índices 2041 a 2644)
# Esto elimina todo el bloque de máquinas
new_lines = lines[:2041] + lines[2645:]

print(f"Total líneas después: {len(new_lines)}")
print(f"Línea 2042 nueva (índice 2041): {repr(new_lines[2041])}")

# Guardar
with codecs.open('src/components/AdminPanel.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("✅ Sección de máquinas eliminada completamente")
