import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../services/firebase';
import './WorkoutLogger.css';

interface Exercise {
  name: string;
  sets: number;
  reps: number;
  weight: number;
  machineId?: string;
  machineName?: string;
  machinePhotoUrl?: string;
}

interface Machine {
  id: string;
  name: string;
  description?: string;
  photoUrl?: string;
  userId?: string; // Si está vacío o es null, es máquina global (del admin)
  isGlobal?: boolean; // Indica si es máquina global del gimnasio
}

const createEmptyExercise = (): Exercise => ({
  name: '',
  sets: 1,
  reps: 1,
  weight: 0,
  machineId: '',
  machineName: '',
  machinePhotoUrl: ''
});

interface Workout {
  id?: string;
  date: string;
  exercises: Exercise[];
  notes?: string;
}

interface WorkoutLoggerProps {
  onNavigateToHistory?: () => void;
}

const WorkoutLogger: React.FC<WorkoutLoggerProps> = ({ onNavigateToHistory }) => {
  const [currentWorkout, setCurrentWorkout] = useState<Workout>({
    date: new Date().toISOString().split('T')[0],
    exercises: [],
    notes: ''
  });
  const [newExercise, setNewExercise] = useState<Exercise>(createEmptyExercise());
  const [showAddForm, setShowAddForm] = useState(false);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loadingMachines, setLoadingMachines] = useState(true);
  const [machineModalOpen, setMachineModalOpen] = useState(false);
  const [machineFormLoading, setMachineFormLoading] = useState(false);
  const [machineFormError, setMachineFormError] = useState('');
  const [machineForm, setMachineForm] = useState({
    id: '',
    name: '',
    description: '',
    photoFile: null as File | null,
    existingPhotoUrl: ''
  });
  const [machinePreview, setMachinePreview] = useState<string>('');
  const [exerciseError, setExerciseError] = useState('');
  const [showMachinesManager, setShowMachinesManager] = useState(false);

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

      // Cargar máquinas personales del usuario (incluye las antiguas sin isGlobal)
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
        .filter((machine) => machine.isGlobal !== true); // Excluir solo las que sean explícitamente globales

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
  }, []);

  useEffect(() => {
    if (!showAddForm || !machines.length) {
      return;
    }

    setNewExercise((prev) => {
      if (prev.machineId || machines.length > 1) {
        return prev;
      }

      const [onlyMachine] = machines;
      return {
        ...prev,
        machineId: onlyMachine.id,
        machineName: onlyMachine.name,
        machinePhotoUrl: onlyMachine.photoUrl || '',
        name: prev.name || onlyMachine.name
      };
    });
  }, [machines, showAddForm]);

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
      name: '',
      description: '',
      photoFile: null,
      existingPhotoUrl: ''
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

  const openMachineModalForEdit = (machine: Machine) => {
    setMachineForm({
      id: machine.id,
      name: machine.name,
      description: machine.description || '',
      photoFile: null,
      existingPhotoUrl: machine.photoUrl || ''
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

  const handleSelectMachine = (machineId: string) => {
    const selectedMachine = machines.find((machine) => machine.id === machineId);
    setExerciseError('');
    setNewExercise((prev) => {
      if (!selectedMachine) {
        return {
          ...prev,
          machineId: '',
          machineName: '',
          machinePhotoUrl: ''
        };
      }

      const isCustomName = prev.name && prev.name !== prev.machineName;

      return {
        ...prev,
        machineId: selectedMachine.id,
        machineName: selectedMachine.name,
        machinePhotoUrl: selectedMachine.photoUrl || '',
        name: isCustomName ? prev.name : selectedMachine.name
      };
    });
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

      if (machineForm.id) {
        // Editar máquina existente
        const { doc: docImport, updateDoc } = await import('firebase/firestore');
        await updateDoc(docImport(db, 'machines', machineForm.id), {
          name: trimmedName,
          description: trimmedDescription,
          photoUrl: uploadedPhotoUrl,
          updatedAt: new Date()
        });
      } else {
        // Crear nueva máquina
        const docRef = await addDoc(collection(db, 'machines'), {
          userId: auth.currentUser.uid,
          isGlobal: false,
          name: trimmedName,
          description: trimmedDescription,
          photoUrl: uploadedPhotoUrl,
          createdAt: new Date()
        });

        setNewExercise((prev) => ({
          ...prev,
          machineId: docRef.id,
          machineName: trimmedName,
          machinePhotoUrl: uploadedPhotoUrl,
          name: prev.name && prev.name !== prev.machineName ? prev.name : trimmedName
        }));

        if (!showAddForm) {
          setShowAddForm(true);
        }
      }

      await loadMachines();
      resetMachineForm();
      setMachineModalOpen(false);
    } catch (error) {
      console.error('Error saving machine:', error);
      setMachineFormError('Error al guardar la máquina. Inténtalo nuevamente.');
    } finally {
      setMachineFormLoading(false);
    }
  };

  const handleDeleteMachine = async (machineId: string, machineName: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar la máquina "${machineName}"?`)) {
      return;
    }

    try {
      const { doc: docImport, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(docImport(db, 'machines', machineId));
      await loadMachines();
      
      if (newExercise.machineId === machineId) {
        setNewExercise(createEmptyExercise());
      }
    } catch (error) {
      console.error('Error deleting machine:', error);
      alert('Error al eliminar la máquina. Inténtalo nuevamente.');
    }
  };

  const addExercise = async () => {
    if (!newExercise.machineId) {
      setExerciseError('Selecciona una máquina antes de agregar el ejercicio.');
      return;
    }

    if (!newExercise.name.trim()) {
      setExerciseError('Añade un nombre para el ejercicio.');
      return;
    }

    if (!auth.currentUser) return;

    try {
      const machine = machines.find((item) => item.id === newExercise.machineId);
      
      // Guardar directamente en Firestore
      await addDoc(collection(db, 'workouts'), {
        userId: auth.currentUser.uid,
        date: currentWorkout.date,
        name: newExercise.name.trim(),
        sets: newExercise.sets,
        reps: newExercise.reps,
        weight: newExercise.weight,
        machineId: newExercise.machineId,
        machineName: machine?.name || newExercise.machineName,
        machinePhotoUrl: machine?.photoUrl || newExercise.machinePhotoUrl || '',
        createdAt: new Date()
      });

      // Actualizar vista local (solo para mostrar contador)
      const exerciseToAdd: Exercise = {
        ...newExercise,
        name: newExercise.name.trim(),
        machineName: machine?.name || newExercise.machineName,
        machinePhotoUrl: machine?.photoUrl || newExercise.machinePhotoUrl
      };

      setCurrentWorkout((prev) => ({
        ...prev,
        exercises: [...prev.exercises, exerciseToAdd]
      }));

      setExerciseError('');
      setNewExercise(createEmptyExercise());
      setShowAddForm(false);
    } catch (error) {
      console.error('Error saving exercise:', error);
      setExerciseError('Error al guardar el ejercicio. Inténtalo nuevamente.');
    }
  };

  const handleAddExerciseClick = () => {
    if (loadingMachines) return;

    if (!machines.length) {
      openMachineModalForNew();
      return;
    }

    setExerciseError('');
    setNewExercise(createEmptyExercise());
    setShowAddForm(true);
  };

  const removeExercise = (index: number) => {
    setCurrentWorkout(prev => ({
      ...prev,
      exercises: prev.exercises.filter((_, i) => i !== index)
    }));
  };

  const selectedMachine = newExercise.machineId
    ? machines.find((machine) => machine.id === newExercise.machineId)
    : undefined;

  return (
    <div className="workout-logger">
      <h2>📝 Registrar Entrenamiento</h2>
      
      <div className="current-workout">
        <h3>Entrenamiento Actual</h3>
        
        <div className="workout-form">
          <div className="form-group">
            <label>Fecha:</label>
            <input
              type="date"
              value={currentWorkout.date}
              onChange={(e) => setCurrentWorkout(prev => ({ ...prev, date: e.target.value }))}
            />
          </div>

          <div className="exercises-section">
            <h4>Ejercicios</h4>

            <div className="machines-toolbar">
              <span className="machines-status">
                {loadingMachines
                  ? 'Cargando máquinas...'
                  : machines.length === 0
                    ? 'No tienes máquinas registradas todavía.'
                    : `${machines.length} máquina${machines.length > 1 ? 's' : ''} disponibles`}
              </span>
              <div className="machines-toolbar-buttons">
                <button type="button" className="ghost-button" onClick={openMachineModalForNew}>
                  + Añadir máquina
                </button>
                {machines.length > 0 && (
                  <button type="button" className="ghost-button" onClick={() => setShowMachinesManager(!showMachinesManager)}>
                    ⚙️ Gestionar
                  </button>
                )}
              </div>
            </div>

            {showMachinesManager && machines.length > 0 && (
              <div className="machines-list">
                <h5>Tus Máquinas</h5>
                {machines.map((machine) => (
                  <div key={machine.id} className="machine-item">
                    {machine.photoUrl && (
                      <img src={machine.photoUrl} alt={machine.name} className="machine-item-photo" />
                    )}
                    <div className="machine-item-info">
                      <strong>{machine.name}</strong>
                      {machine.description && <p>{machine.description}</p>}
                    </div>
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
                  </div>
                ))}
              </div>
            )}
            
            {currentWorkout.exercises.map((exercise, index) => {
              const machineLabel = exercise.machineName || 'Máquina no especificada';
              const displayName = exercise.name || machineLabel;

              return (
                <div key={index} className="exercise-item">
                  <div className="exercise-info">
                    {exercise.machinePhotoUrl && (
                      <img
                        src={exercise.machinePhotoUrl}
                        alt={machineLabel}
                        className="exercise-machine-photo"
                      />
                    )}
                    <div>
                      <p className="exercise-machine-name">{machineLabel}</p>
                      <p className="exercise-name">{displayName}</p>
                    </div>
                  </div>
                  <div className="exercise-meta">
                    {exercise.sets} series × {exercise.reps} repeticiones @ {exercise.weight} kg
                  </div>
                  <button onClick={() => removeExercise(index)} className="remove-btn" aria-label="Eliminar ejercicio">❌</button>
                </div>
              );
            })}

            {showAddForm && (
              <div className="add-exercise-form">
                {machines.length > 0 ? (
                  <>
                    <div className="form-group">
                      <label htmlFor="machine-select">Máquina</label>
                      <select
                        id="machine-select"
                        value={newExercise.machineId}
                        onChange={(e) => handleSelectMachine(e.target.value)}
                      >
                        <option value="">Selecciona una máquina</option>
                        {machines.map((machine) => (
                          <option key={machine.id} value={machine.id}>
                            {machine.isGlobal ? '🏋️ ' : '👤 '}{machine.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedMachine && (
                      <div className="machine-summary">
                        {selectedMachine.photoUrl && (
                          <img
                            src={selectedMachine.photoUrl}
                            alt={selectedMachine.name}
                            className="machine-summary-photo"
                          />
                        )}
                        <div className="machine-summary-info">
                          <div className="machine-summary-header">
                            <p className="machine-summary-name">{selectedMachine.name}</p>
                            <span className={`machine-badge ${selectedMachine.isGlobal ? 'global' : 'personal'}`}>
                              {selectedMachine.isGlobal ? '🏋️ Gimnasio' : '👤 Personal'}
                            </span>
                          </div>
                          {selectedMachine.description && (
                            <p className="machine-summary-description">{selectedMachine.description}</p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="form-group">
                      <label htmlFor="exercise-name">Nombre del ejercicio</label>
                      <input
                        id="exercise-name"
                        type="text"
                        placeholder="Ej. Press pecho en máquina"
                        value={newExercise.name}
                        onChange={(e) => {
                          setExerciseError('');
                          setNewExercise((prev) => ({ ...prev, name: e.target.value }));
                        }}
                      />
                    </div>

                    <div className="metrics-grid">
                      <div className="form-group">
                        <label htmlFor="exercise-sets">Series</label>
                        <input
                          id="exercise-sets"
                          type="number"
                          min="1"
                          value={newExercise.sets}
                          onChange={(e) => {
                            const parsed = parseInt(e.target.value, 10);
                            setNewExercise((prev) => ({
                              ...prev,
                              sets: Number.isNaN(parsed) ? 1 : Math.max(1, parsed)
                            }));
                          }}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="exercise-reps">Repeticiones</label>
                        <input
                          id="exercise-reps"
                          type="number"
                          min="1"
                          value={newExercise.reps}
                          onChange={(e) => {
                            const parsed = parseInt(e.target.value, 10);
                            setNewExercise((prev) => ({
                              ...prev,
                              reps: Number.isNaN(parsed) ? 1 : Math.max(1, parsed)
                            }));
                          }}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="exercise-weight">Peso (kg)</label>
                        <input
                          id="exercise-weight"
                          type="number"
                          min="0"
                          step="0.5"
                          value={newExercise.weight}
                          onChange={(e) => {
                            const parsed = parseFloat(e.target.value);
                            setNewExercise((prev) => ({
                              ...prev,
                              weight: Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
                            }));
                          }}
                        />
                      </div>
                    </div>

                    {exerciseError && <div className="form-error">{exerciseError}</div>}

                    <div className="form-actions">
                      <button type="button" onClick={addExercise} className="primary-button">
                        Agregar ejercicio
                      </button>
                      <button type="button" onClick={() => setShowAddForm(false)} className="secondary-button">
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="machines-empty-message">
                    <p>Cargando máquinas...</p>
                  </div>
                )}
              </div>
            )}

            {!showAddForm && (
              <button
                onClick={handleAddExerciseClick}
                className="add-exercise-btn"
                disabled={loadingMachines}
              >
                {loadingMachines ? 'Cargando máquinas...' : '+ Agregar Ejercicio'}
              </button>
            )}
          </div>

          {currentWorkout.exercises.length > 0 && (
            <div className="success-message-box">
              ✅ {currentWorkout.exercises.length} ejercicio{currentWorkout.exercises.length > 1 ? 's' : ''} guardado{currentWorkout.exercises.length > 1 ? 's' : ''} hoy
            </div>
          )}
        </div>
      </div>

      <div className="workout-history">
        <h3>📊 Ver Historial Completo</h3>
        <p style={{marginBottom: '1rem', color: '#b0b0b0'}}>
          Visualiza tus entrenamientos, filtra por fecha o máquina, y observa tu evolución con gráficos detallados.
        </p>
        <button
          onClick={() => onNavigateToHistory?.()}
          className="primary-button"
          style={{width: '100%', padding: '1rem'}}
        >
          Abrir Historial y Estadísticas
        </button>
      </div>

      {machineModalOpen && (
        <div className="machine-modal-backdrop" role="dialog" aria-modal="true">
          <div className="machine-modal">
            <div className="machine-modal-header">
              <h3>Registrar máquina</h3>
              <button
                type="button"
                className="close-button"
                onClick={closeMachineModal}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleMachineSubmit} className="machine-form">
              <div className="form-group">
                <label htmlFor="machine-name">Nombre de la máquina</label>
                <input
                  id="machine-name"
                  type="text"
                  value={machineForm.name}
                  onChange={(e) => setMachineForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej. Prensa de piernas"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="machine-description">Descripción</label>
                <textarea
                  id="machine-description"
                  value={machineForm.description}
                  onChange={(e) => setMachineForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Notas sobre ajustes o uso de la máquina"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label htmlFor="machine-photo">Foto (opcional)</label>
                <input
                  id="machine-photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleMachineFileChange}
                />
                <p className="field-hint">Desde el móvil, pulsa para tomar una foto directamente con la cámara.</p>
                {machinePreview && (
                  <img
                    src={machinePreview}
                    alt="Vista previa de la máquina"
                    className="machine-preview"
                  />
                )}
              </div>

              {machineFormError && <div className="form-error">{machineFormError}</div>}

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeMachineModal}
                  disabled={machineFormLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={machineFormLoading}
                >
                  {machineFormLoading ? 'Guardando...' : 'Guardar máquina'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutLogger;