#!/usr/bin/env python3
"""
Script para eliminar completamente la funcionalidad de máquinas de GymApp

Este script realiza los siguientes cambios:
1. App.tsx:
   - Elimina 'machines' del tipo View
   - Elimina el import de MachinesManager
   - Elimina el botón de navegación "Máquinas"
   - Elimina la vista de renderizado de MachinesManager
   - Elimina la lógica de creación de tabla de ejemplo con máquinas

2. AdminPanel.tsx:
   - Cambia el tipo activeTab eliminando 'maquinas'
   - Actualiza el texto de bienvenida
   - Elimina el botón "Gestión de Máquinas"
   - Elimina la sección completa de gestión de máquinas (líneas 2047-3062)
"""

import re

def remove_machines_from_app():
    """Elimina las referencias a máquinas en App.tsx"""
    app_file = r'c:\Users\usuario\gymapp\src\App.tsx'
    
    with open(app_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Eliminar import de MachinesManager (línea 10)
        if "import MachinesManager from './components/MachinesManager';" in line:
            print(f"✅ Línea {i+1}: Import de MachinesManager eliminado")
            i += 1
            continue
        
        # Cambiar tipo View (línea 20)
        if "type View = 'home' | 'workout' | 'history' | 'assigned' | 'machines' | 'social' | 'admin';" in line:
            new_lines.append(line.replace(" | 'machines'", ""))
            print(f"✅ Línea {i+1}: Tipo View actualizado (eliminado 'machines')")
            i += 1
            continue
        
        # Eliminar botón de máquinas (líneas ~436-442)
        if "onClick={() => setCurrentView('machines')}" in line:
            # Retroceder hasta encontrar <button
            while i > 0 and '<button' not in lines[i]:
                i -= 1
            # Avanzar hasta encontrar </button>
            while i < len(lines) and '</button>' not in lines[i]:
                i += 1
            print(f"✅ Botón de navegación 'Máquinas' eliminado")
            i += 1
            continue
        
        # Eliminar vista de MachinesManager (líneas ~481-487)
        if "currentView === 'machines'" in line:
            # Retroceder hasta encontrar el inicio del bloque condicional
            while i > 0 and '{currentView ===' not in lines[i]:
                i -= 1
            # Avanzar hasta encontrar el cierre )}
            depth = 0
            started = False
            while i < len(lines):
                if '{' in lines[i]:
                    depth += lines[i].count('{')
                    started = True
                if '}' in lines[i]:
                    depth -= lines[i].count('}')
                if started and depth == 0:
                    break
                i += 1
            print(f"✅ Vista de renderizado de MachinesManager eliminada")
            i += 1
            continue
        
        # Eliminar lógica de creación de tabla de ejemplo con máquinas (líneas ~93-133)
        if "// Verificar si ya tiene tabla asignada" in line:
            # Saltar todas las líneas hasta "// Mostrar tour si es primera vez"
            while i < len(lines) and "// Mostrar tour si es primera vez" not in lines[i]:
                i += 1
            print(f"✅ Lógica de creación de tabla de ejemplo eliminada")
            continue
        
        new_lines.append(line)
        i += 1
    
    with open(app_file, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    print("✅ App.tsx actualizado\n")

def remove_machines_from_admin_panel():
    """Elimina las referencias a máquinas en AdminPanel.tsx"""
    admin_file = r'c:\Users\usuario\gymapp\src\components\AdminPanel.tsx'
    
    with open(admin_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Cambiar tipo activeTab (línea 135)
        if "'maquinas' | 'tablas' | 'ejercicios' | 'usuarios' | 'reproductor'" in line:
            new_lines.append(line.replace("'maquinas' | ", ""))
            print(f"✅ Línea {i+1}: Tipo activeTab actualizado")
            i += 1
            continue
        
        # Cambiar texto de bienvenida (línea ~1240)
        if "Gestión de máquinas y tablas de entrenamiento" in line:
            new_lines.append(line.replace(
                "Gestión de máquinas y tablas de entrenamiento",
                "Gestión de tablas de entrenamiento y ejercicios"
            ))
            print(f"✅ Línea {i+1}: Texto de bienvenida actualizado")
            i += 1
            continue
        
        # Eliminar botón "Gestión de Máquinas" (líneas ~1284-1290)
        if "onClick={() => setActiveTab('maquinas')}" in line:
            # Retroceder hasta encontrar <button
            start_i = i
            while start_i > 0 and '<button' not in lines[start_i]:
                start_i -= 1
            # Avanzar hasta encontrar </button>
            end_i = i
            while end_i < len(lines) and '</button>' not in lines[end_i]:
                end_i += 1
            print(f"✅ Líneas {start_i+1}-{end_i+1}: Botón 'Gestión de Máquinas' eliminado")
            i = end_i + 1
            continue
        
        # Eliminar sección completa de máquinas (líneas 2047-3062)
        if "Sección de Máquinas Globales" in line:
            start_i = i
            # Buscar el cierre de esta sección (justo antes de "Sección de asignación de tablas")
            while i < len(lines) and "Sección de asignación de tablas" not in lines[i]:
                i += 1
            # Retroceder 2 líneas para no eliminar el comentario de tablas
            i -= 1
            # Retroceder hasta encontrar el cierre )}
            while i > start_i and ')}' not in lines[i]:
                i -= 1
            print(f"✅ Líneas {start_i+1}-{i+1}: Sección completa de máquinas eliminada ({i - start_i + 1} líneas)")
            i += 1
            continue
        
        new_lines.append(line)
        i += 1
    
    with open(admin_file, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    print("✅ AdminPanel.tsx actualizado\n")

if __name__ == '__main__':
    print("🔧 Iniciando eliminación de funcionalidad de máquinas...\n")
    
    try:
        remove_machines_from_app()
        remove_machines_from_admin_panel()
        print("✅ ¡Proceso completado exitosamente!")
        print("\n📌 SIGUIENTE PASO:")
        print("   Para borrar la colección 'machines' de Firestore, ejecuta:")
        print("   cd scripts")
        print("   node cleanMachinesFromDB.js")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        print("\n   Revisa los archivos manualmente")
