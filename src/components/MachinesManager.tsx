import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../services/firebase';
import './WorkoutLogger.css';

interface Exercise {
  name: string;
  description?: string;
  mediaFile?: File | null;
  mediaPreview?: string;
  mediaUrl?: string;
}

interface Category {
  id: string;
  name: string;
}

interface Machine {
  id: string;
  number?: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  description?: string;
  photoUrl?: string;
  userId?: string;
  isGlobal?: boolean;
  exercises?: Exercise[];
}

const MachinesManager: React.FC = () => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loadingMachines, setLoadingMachines] = useState(true);
  const [machineModalOpen, setMachineModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
  const [machineFormLoading, setMachineFormLoading] = useState(false);
  const [machineFormError, setMachineFormError] = useState('');
  const [machineForm, setMachineForm] = useState({
    id: '',
    number: '',
    name: '',
    categoryId: '',
    categoryName: '',
    description: '',
    photoFile: null as File | null,
    existingPhotoUrl: '',
    exercises: [] as Exercise[],
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [machinePreview, setMachinePreview] = useState<string>('');
  const [exerciseError, setExerciseError] = useState('');
  const [showGlobalMachines, setShowGlobalMachines] = useState(true);
  const [showPersonalMachines, setShowPersonalMachines] = useState(true);

  const loadCategories = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'categories'));
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
    } catch (e) {
      setCategories([]);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setCategoryError('El nombre es obligatorio');
      return;
    }
    try {
      const docRef = await addDoc(collection(db, 'categories'), { name: newCategoryName.trim() });
      setCategories([...categories, { id: docRef.id, name: newCategoryName.trim() }]);
      setNewCategoryName('');
      setCategoryModalOpen(false);
      setCategoryError('');
    } catch (e) {
      setCategoryError('Error al crear la categoría');
    }
  };

  const loadMachines = async () => {
    if (!auth.currentUser) return;

    try {
      setLoadingMachines(true);
      
      // Cargar máquinas globales (del admin, isGlobal = true)
      const globalMachinesQuery = query(
        collection(db, 'machines'),
        where('isGlobal', '==', true)
      );
      const globalSnapshot = await getDocs(globalMachinesQuery);
      const globalMachines: Machine[] = globalSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Machine, 'id'>)
      }));

      // Cargar máquinas personales del usuario
      const personalMachinesQuery = query(
        collection(db, 'machines'),
        where('userId', '==', auth.currentUser.uid)
      );
      const personalSnapshot = await getDocs(personalMachinesQuery);
      const personalMachines: Machine[] = personalSnapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Machine, 'id'>)
        }))
        .filter((machine) => machine.isGlobal !== true);

      // Combinar ambas listas y ordenar
      const allMachines = [...globalMachines, ...personalMachines];
      allMachines.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      setMachines(allMachines);
    } catch (error) {
      console.error('Error loading machines:', error);
    } finally {
      setLoadingMachines(false);
    }
  };

  useEffect(() => {
    loadMachines();
    loadCategories();
  }, []);

  useEffect(() => {
    return () => {
      if (machinePreview) {
        URL.revokeObjectURL(machinePreview);
      }
    };
  }, [machinePreview]);

  const resetMachineForm = () => {
    setMachineForm({
      id: '',
      number: '',
      name: '',
      categoryId: '',
      categoryName: '',
      description: '',
      photoFile: null,
      existingPhotoUrl: '',
      exercises: [],
    });
    setMachineFormError('');
    if (machinePreview) {
      URL.revokeObjectURL(machinePreview);
      setMachinePreview('');
    }
  };

  const openMachineModalForNew = () => {
    resetMachineForm();
    setExerciseError('');
    setMachineModalOpen(true);
  };

  const handleAddExerciseToMachine = (exercise: Exercise) => {
    setMachineForm(prev => ({
      ...prev,
      exercises: [...(prev.exercises || []), exercise]
    }));
  };

  const handleRemoveExerciseFromMachine = (index: number) => {
    setMachineForm(prev => ({
      ...prev,
      exercises: prev.exercises.filter((_, i) => i !== index)
    }));
  };

  const openMachineModalForEdit = (machine: Machine) => {
    setMachineForm({
      id: machine.id,
      number: machine.number || '',
      name: machine.name,
      categoryId: machine.categoryId || '',
      categoryName: machine.categoryName || '',
      description: machine.description || '',
      photoFile: null,
      existingPhotoUrl: machine.photoUrl || '',
      exercises: machine.exercises || [],
    });
    if (machine.photoUrl) {
      setMachinePreview(machine.photoUrl);
    }
    setExerciseError('');
    setMachineModalOpen(true);
  };

  const closeMachineModal = () => {
    resetMachineForm();
    setMachineModalOpen(false);
  };

  const handleMachineFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;

    if (machinePreview) {
      URL.revokeObjectURL(machinePreview);
    }

    if (file) {
      setMachinePreview(URL.createObjectURL(file));
    } else {
      setMachinePreview('');
    }

    setMachineForm((prev) => ({
      ...prev,
      photoFile: file
    }));
  };

  const handleMachineSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth.currentUser) return;

    const trimmedName = machineForm.name.trim();
    const trimmedDescription = machineForm.description.trim();

    if (!trimmedName) {
      setMachineFormError('El nombre de la máquina es obligatorio.');
      return;
    }

    try {
      setMachineFormLoading(true);
      setMachineFormError('');

      let uploadedPhotoUrl = machineForm.existingPhotoUrl;

      if (machineForm.photoFile) {
        const file = machineForm.photoFile;
        const fileRef = ref(storage, `machines/${auth.currentUser.uid}/${Date.now()}-${file.name}`);
        await uploadBytes(fileRef, file);
        uploadedPhotoUrl = await getDownloadURL(fileRef);
      }

      // Subir archivos de ejercicios y obtener URLs
      if (!auth.currentUser) throw new Error('No user');
      const exercisesWithUrls = await Promise.all((machineForm.exercises || []).map(async (ex, idx) => {
        let mediaUrl = '';
        if (ex.mediaFile) {
          const ext = ex.mediaFile.name.split('.').pop();
          const fileRef = ref(storage, `machines/${auth.currentUser!.uid}/exercises/${Date.now()}-${idx}.${ext}`);
          await uploadBytes(fileRef, ex.mediaFile);
          mediaUrl = await getDownloadURL(fileRef);
        }
        return {
          name: ex.name,
          description: ex.description,
          mediaUrl,
        };
      }));

      if (machineForm.id) {
        // Editar máquina existente
        await updateDoc(doc(db, 'machines', machineForm.id), {
          name: trimmedName,
          categoryId: machineForm.categoryId || null,
          categoryName: machineForm.categoryName || null,
          description: trimmedDescription,
          photoUrl: uploadedPhotoUrl,
          exercises: exercisesWithUrls,
          updatedAt: new Date()
        });
      } else {
        // Crear nueva máquina
        await addDoc(collection(db, 'machines'), {
          userId: auth.currentUser.uid,
          isGlobal: false,
          name: trimmedName,
          categoryId: machineForm.categoryId || null,
          categoryName: machineForm.categoryName || null,
          description: trimmedDescription,
          photoUrl: uploadedPhotoUrl,
          exercises: exercisesWithUrls,
          createdAt: new Date()
        });
      }

      await loadMachines();
      closeMachineModal();
    } catch (error) {
      console.error('Error saving machine:', error);
      setMachineFormError('Error al guardar la máquina. Inténtalo de nuevo.');
    } finally {
      setMachineFormLoading(false);
    }
  };

  const handleDeleteMachine = async (machineId: string, machineName: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar la máquina "${machineName}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'machines', machineId));
      await loadMachines();
    } catch (error) {
      console.error('Error deleting machine:', error);
      alert('Error al eliminar la máquina');
    }
  };

  const getFilteredMachines = () => {
    return machines.filter(m => {
      // Filtro por tipo (global/personal)
      if (!showGlobalMachines && m.isGlobal) return false;
      if (!showPersonalMachines && !m.isGlobal) return false;
      
      // Filtro por categoría
      if (categoryFilter !== 'Todas' && m.categoryName !== categoryFilter) return false;
      
      return true;
    });
  };

  const getUniqueCategories = () => {
    const cats = new Set<string>();
    machines.forEach(m => {
      if (m.categoryName) cats.add(m.categoryName);
    });
    return Array.from(cats).sort();
  };

  return (
    <div className="workout-logger-container">
      <h2>🏋️ Gestión de Máquinas</h2>

      <div className="machines-toolbar">
        <span className="machines-status">
          {loadingMachines
            ? 'Cargando máquinas...'
            : machines.length === 0
              ? 'No tienes máquinas registradas todavía.'
              : `${getFilteredMachines().length} de ${machines.length} máquina${machines.length > 1 ? 's' : ''}`}
        </span>
        <div className="machines-toolbar-buttons">
          <button type="button" className="ghost-button" onClick={openMachineModalForNew}>
            + Añadir máquina
          </button>
        </div>
      </div>

      {/* Filtros */}
      {machines.length > 0 && (
        <div className="filters-section" style={{ marginBottom: '1rem' }}>
          {/* Checkboxes para tipo de máquina */}
          <div className="filter-checkboxes" style={{ 
            display: 'flex', 
            gap: '1rem', 
            marginBottom: '1rem',
            padding: '0.75rem',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e0e0e0' }}>
              <input
                type="checkbox"
                checked={showGlobalMachines}
                onChange={(e) => setShowGlobalMachines(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>🏋️ MAXGYM</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e0e0e0' }}>
              <input
                type="checkbox"
                checked={showPersonalMachines}
                onChange={(e) => setShowPersonalMachines(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>👤 Mis máquinas</span>
            </label>
          </div>

          {/* Filtro por categoría */}
          <div className="category-filter-section">
            <label>Filtrar por categoría:</label>
            <select 
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="category-filter-select"
            >
              <option value="Todas">📋 Todas las categorías</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>🏷️ {cat.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Lista de máquinas */}
      {machines.length > 0 && (
        <div className="machines-list">
          {getFilteredMachines().map((machine) => (
            <div key={machine.id} className="machine-item">
              {machine.photoUrl && (
                <img src={machine.photoUrl} alt={machine.name} className="machine-item-photo" />
              )}
              <div className="machine-item-info">
                <strong>{machine.name}</strong>
                {machine.categoryName && <span className="machine-category-badge">🏷️ {machine.categoryName}</span>}
                {machine.description && <p>{machine.description}</p>}
                {machine.isGlobal && <span className="global-badge">🌐 Global</span>}
              </div>
              {!machine.isGlobal && (
                <div className="machine-item-actions">
                  <button
                    type="button"
                    className="edit-machine-btn"
                    onClick={() => openMachineModalForEdit(machine)}
                    aria-label="Editar máquina"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="delete-machine-btn"
                    onClick={() => handleDeleteMachine(machine.id, machine.name)}
                    aria-label="Eliminar máquina"
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de máquina */}
      {machineModalOpen && (
        <div className="modal-overlay" onClick={closeMachineModal}>
          <div className="modal-content machine-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{machineForm.id ? 'Editar Máquina' : 'Nueva Máquina'}</h3>
            
            <form onSubmit={handleMachineSubmit}>
              <div className="form-group">
                <label>Nombre *</label>
                <input
                  type="text"
                  placeholder="Ej: Press de banca"
                  value={machineForm.name}
                  onChange={(e) => setMachineForm({ ...machineForm, name: e.target.value })}
                  disabled={machineFormLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label>Categoría</label>
                <select
                  value={machineForm.categoryId}
                  onChange={(e) => {
                    const selectedCategory = categories.find(cat => cat.id === e.target.value);
                    setMachineForm({ 
                      ...machineForm, 
                      categoryId: e.target.value,
                      categoryName: selectedCategory?.name || ''
                    });
                  }}
                  disabled={machineFormLoading}
                >
                  <option value="">📋 Sin categoría</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>🏷️ {cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  placeholder="Descripción de la máquina..."
                  value={machineForm.description}
                  onChange={(e) => setMachineForm({ ...machineForm, description: e.target.value })}
                  disabled={machineFormLoading}
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Foto de la Máquina</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleMachineFileChange}
                  disabled={machineFormLoading}
                />
                {(machinePreview || machineForm.existingPhotoUrl) && (
                  <div className="photo-preview-container">
                    <img
                      src={machinePreview || machineForm.existingPhotoUrl}
                      alt="Vista previa"
                      className="photo-preview"
                    />
                  </div>
                )}
              </div>

              {machineFormError && (
                <p className="error-message">{machineFormError}</p>
              )}

              <div className="modal-actions">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={machineFormLoading}
                >
                  {machineFormLoading ? 'Guardando...' : (machineForm.id ? 'Actualizar' : 'Crear')}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeMachineModal}
                  disabled={machineFormLoading}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MachinesManager;
