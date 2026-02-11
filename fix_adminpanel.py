with open('src/components/AdminPanel.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Eliminar líneas 2040-2643 (0-indexed: 2039-2642)
new_lines = lines[:2039] + lines[2643:]

with open('src/components/AdminPanel.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"Eliminadas {2643 - 2040 + 1} líneas. Nueva longitud: {len(new_lines)} líneas")
