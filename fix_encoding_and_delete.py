import chardet

# Detectar encoding
with open('src/components/AdminPanel.tsx', 'rb') as f:
    raw_data = f.read()
    result = chardet.detect(raw_data)
    print(f"Encoding detectado: {result}")

# Leer con el encoding correcto
detected_encoding = result['encoding']
with open('src/components/AdminPanel.tsx', 'r', encoding=detected_encoding or 'cp1252') as f:
    lines = f.readlines()

print(f"Total líneas: {len(lines)}")
print(f"Línea 2042 (índice 2041): {repr(lines[2041][:80])}")
print(f"Línea 2645 (índice 2644): {repr(lines[2644][:80])}")

# Eliminar líneas 2042 a 2645
new_lines = lines[:2041] + lines[2645:]

print(f"\nTotal líneas después: {len(new_lines)}")
print(f"Línea 2042 nueva: {repr(new_lines[2041][:80])}")

# Guardar con UTF-8
with open('src/components/AdminPanel.tsx', 'w', encoding='utf-8', newline='') as f:
    f.writelines(new_lines)

print("\n✅ Sección eliminada y archivo guardado como UTF-8")
