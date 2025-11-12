import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
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
  category?: string;
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
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
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
  const [sharePublicly, setSharePublicly] = useState(false);
  const [todayExercisesCount, setTodayExercisesCount] = useState(0);
  const [postComment, setPostComment] = useState('');
  const [postPhoto, setPostPhoto] = useState<File | null>(null);
  const [postPhotoPreview, setPostPhotoPreview] = useState<string>('');

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
    loadTodayExercisesCount();
  }, [currentWorkout.date]);

  useEffect(() => {
    return () => {
      if (machinePreview) {
        URL.revokeObjectURL(machinePreview);
      }
    };
  }, [machinePreview]);

  const loadTodayExercisesCount = async () => {
    if (!auth.currentUser) return;
    
    try {
      const workoutsRef = collection(db, 'workouts');
      const q = query(
        workoutsRef,
        where('userId', '==', auth.currentUser.uid),
        where('date', '==', currentWorkout.date)
      );
      const snapshot = await getDocs(q);
      setTodayExercisesCount(snapshot.size);
    } catch (error) {
      console.error('Error loading today exercises count:', error);
    }
  };

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

    // Validar que los valores numéricos sean válidos
    const sets = typeof newExercise.sets === 'number' ? newExercise.sets : parseInt(newExercise.sets as any) || 1;
    const reps = typeof newExercise.reps === 'number' ? newExercise.reps : parseInt(newExercise.reps as any) || 1;
    const weight = typeof newExercise.weight === 'number' ? newExercise.weight : parseFloat(newExercise.weight as any) || 0;

    if (!auth.currentUser) return;

    try {
      const machine = machines.find((item) => item.id === newExercise.machineId);
      
      // Guardar directamente en Firestore
      await addDoc(collection(db, 'workouts'), {
        userId: auth.currentUser.uid,
        date: currentWorkout.date,
        name: newExercise.name.trim(),
        sets: sets,
        reps: reps,
        weight: weight,
        machineId: newExercise.machineId,
        machineName: machine?.name || newExercise.machineName,
        machinePhotoUrl: machine?.photoUrl || newExercise.machinePhotoUrl || '',
        createdAt: serverTimestamp()
      });

      // Actualizar vista local (solo para mostrar contador)
      const exerciseToAdd: Exercise = {
        ...newExercise,
        sets: sets,
        reps: reps,
        weight: weight,
        name: newExercise.name.trim(),
        machineName: machine?.name || newExercise.machineName,
        machinePhotoUrl: machine?.photoUrl || newExercise.machinePhotoUrl
      };

      const updatedExercises = [...currentWorkout.exercises, exerciseToAdd];

      setCurrentWorkout((prev) => ({
        ...prev,
        exercises: updatedExercises
      }));

      // Actualizar contador de ejercicios de hoy
      setTodayExercisesCount(prev => prev + 1);

      // FUNCIONALIDAD SOCIAL DESACTIVADA TEMPORALMENTE - FUTURO
      // if (sharePublicly) {
      //   await publishToSocial(exerciseToAdd);
      // }

      setExerciseError('');
      setNewExercise(createEmptyExercise());
      setShowAddForm(false);
    } catch (error) {
      console.error('Error saving exercise:', error);
      setExerciseError('Error al guardar el ejercicio. Inténtalo nuevamente.');
    }
  };

  /* FUNCIONALIDAD SOCIAL DESACTIVADA TEMPORALMENTE - FUTURO
  const publishToSocial = async (exercise: Exercise) => {
    if (!auth.currentUser) return;

    console.log('🚀 publishToSocial llamado con ejercicio:', exercise);
    console.log('📝 Comentario actual:', postComment);
    console.log('📸 Foto actual:', postPhoto ? postPhoto.name : 'Sin foto');

    try {
      // Subir foto si existe
      let photoUrl = '';
      if (postPhoto) {
        const photoRef = ref(storage, `posts/${auth.currentUser.uid}/${Date.now()}_${postPhoto.name}`);
        await uploadBytes(photoRef, postPhoto);
        photoUrl = await getDownloadURL(photoRef);
      }

      // Crear un nuevo post para este ejercicio específico
      const postData = {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Usuario',
        userEmail: auth.currentUser.email || '',
        exercise: {
          machineName: exercise.machineName,
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          weight: exercise.weight,
          machinePhotoUrl: exercise.machinePhotoUrl
        },
        date: currentWorkout.date,
        timestamp: serverTimestamp(),
        likes: [],
        ...(postComment.trim() && { comment: postComment.trim() }),
        ...(photoUrl && { photoUrl: photoUrl })
      };

      console.log('✅ Creando post para ejercicio:', postData);
      await addDoc(collection(db, 'posts'), postData);

      console.log('✅ Post publicado correctamente');
      
      // Limpiar los campos de comentario y foto después de publicar
      setPostComment('');
      setPostPhoto(null);
      setPostPhotoPreview('');
      
    } catch (error) {
      console.error('❌ Error publishing to social:', error);
    }
  };
  */

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPostPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPostPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
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
      <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>💪 Entrenamintos, registro e histórico</h2>
      
      <div className="current-workout">
        <h3>Registrar entrenamiento</h3>
        
        <div className="workout-form">
          <div className="form-group">
            <label>Fecha:</label>
            <input
              type="date"
              value={currentWorkout.date}
              onChange={(e) => setCurrentWorkout(prev => ({ ...prev, date: e.target.value }))}
            />
          </div>

          {/* FUNCIONALIDAD SOCIAL DESACTIVADA TEMPORALMENTE - FUTURO */}
          {/*
          <div className="form-group share-toggle">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={sharePublicly}
                onChange={(e) => setSharePublicly(e.target.checked)}
              />
              <span>🌟 Compartir públicamente en MAX SOCIAL</span>
            </label>
          </div>

          {sharePublicly && (
            <div className="social-fields">
              <div className="form-group">
                <label>💬 Comentario (opcional)</label>
                <textarea
                  value={postComment}
                  onChange={(e) => setPostComment(e.target.value)}
                  placeholder="¿Cómo fue tu entrenamiento? Comparte tu experiencia..."
                  rows={3}
                  maxLength={500}
                />
                <span className="char-count">{postComment.length}/500</span>
              </div>

              <div className="form-group">
                <label>📸 Foto (opcional)</label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                />
                {postPhotoPreview && (
                  <div className="photo-preview-small">
                    <img src={postPhotoPreview} alt="Preview" />
                    <button 
                      type="button"
                      className="remove-photo-btn-small"
                      onClick={() => {
                        setPostPhoto(null);
                        setPostPhotoPreview('');
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          */}

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
                <h5>Máquinas Disponibles</h5>
                {machines.map((machine) => (
                  <div key={machine.id} className="machine-item">
                    {machine.photoUrl && (
                      <img src={machine.photoUrl} alt={machine.name} className="machine-item-photo" />
                    )}
                    <div className="machine-item-info">
                      <strong>{machine.name}</strong>
                      {machine.category && <span className="machine-category-badge">🏷️ {machine.category}</span>}
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
                      <label htmlFor="category-filter">Filtrar por Categoría</label>
                      <select
                        id="category-filter"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        style={{ marginBottom: '15px' }}
                      >
                        <option value="Todas">📋 Todas las categorías</option>
                        {Array.from(new Set(machines.map(m => m.category).filter(Boolean))).sort().map(cat => (
                          <option key={cat} value={cat}>🏷️ {cat}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="machine-select">Máquina</label>
                      <select
                        id="machine-select"
                        value={newExercise.machineId}
                        onChange={(e) => handleSelectMachine(e.target.value)}
                      >
                        <option value="">Selecciona una máquina</option>
                        {machines
                          .filter(machine => categoryFilter === 'Todas' || machine.category === categoryFilter)
                          .map((machine) => (
                            <option key={machine.id} value={machine.id}>
                              {machine.isGlobal ? '🏋️ ' : '👤 '}{machine.name}
                              {machine.category ? ` (${machine.category})` : ''}
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
                            const value = e.target.value;
                            if (value === '') {
                              setNewExercise((prev) => ({ ...prev, sets: '' as any }));
                            } else {
                              const parsed = parseInt(value, 10);
                              if (!Number.isNaN(parsed)) {
                                setNewExercise((prev) => ({ ...prev, sets: Math.max(1, parsed) }));
                              }
                            }
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
                            const value = e.target.value;
                            if (value === '') {
                              setNewExercise((prev) => ({ ...prev, reps: '' as any }));
                            } else {
                              const parsed = parseInt(value, 10);
                              if (!Number.isNaN(parsed)) {
                                setNewExercise((prev) => ({ ...prev, reps: Math.max(1, parsed) }));
                              }
                            }
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
                            const value = e.target.value;
                            if (value === '') {
                              setNewExercise((prev) => ({ ...prev, weight: '' as any }));
                            } else {
                              const parsed = parseFloat(value);
                              if (!Number.isNaN(parsed)) {
                                setNewExercise((prev) => ({ ...prev, weight: Math.max(0, parsed) }));
                              }
                            }
                          }}
                        />
                      </div>
                    </div>

                    {exerciseError && <div className="form-error">{exerciseError}</div>}

                    <div className="form-actions">
                      <button type="button" onClick={addExercise} className="primary-button">
                        ➕ Agregar
                      </button>
                      <button type="button" onClick={() => setShowAddForm(false)} className="secondary-button">
                        ✖ Cancelar
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
                {loadingMachines ? '⏳ Cargando...' : '➕ Agregar Ejercicio'}
              </button>
            )}
          </div>

          {todayExercisesCount > 0 && (
            <div className="success-message-box">
              ✅ {todayExercisesCount} ejercicio{todayExercisesCount > 1 ? 's' : ''} guardado{todayExercisesCount > 1 ? 's' : ''} hoy
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