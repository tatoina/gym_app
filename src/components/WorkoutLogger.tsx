import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User } from 'firebase/auth';
import { auth, db, storage } from '../services/firebase';
import './WorkoutLogger.css';

interface Exercise {
  name: string;
  description?: string;
  mediaFile?: File | null;
  mediaPreview?: string;
  sets?: number;
  reps?: number;
  weight?: number;
  machineId?: string;
  machineName?: string;
  machinePhotoUrl?: string;
  // Campos específicos para CORE
  time?: number;
  additionalNotes?: string;
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
  videoUrl?: string;
  userId?: string;
  isGlobal?: boolean;
  exercises?: Exercise[];
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
  user: User | null;
}

const WorkoutLogger: React.FC<WorkoutLoggerProps> = ({ onNavigateToHistory, user }) => {
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
  const [ownerFilter, setOwnerFilter] = useState<string>('Todas');
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
  // CRUD de categorías
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

  useEffect(() => { loadCategories(); }, []);
  // Modal para ver foto/video de un ejercicio
  const [exerciseMediaModal, setExerciseMediaModal] = useState<{
    show: boolean;
    url: string;
    type: 'image' | 'video';
    title: string;
  }>({ show: false, url: '', type: 'image', title: '' });

  const openExerciseMedia = (machine: Machine) => {
    const url = machine.videoUrl || machine.photoUrl || '';
    const type = machine.videoUrl ? 'video' : 'image';
    setExerciseMediaModal({ show: true, url, type, title: machine.name });
  };

  const [machinePreview, setMachinePreview] = useState<string>('');
  const [exerciseError, setExerciseError] = useState('');
  const [sharePublicly, setSharePublicly] = useState(false);
  const [todayExercisesCount, setTodayExercisesCount] = useState(0);
  const [postComment, setPostComment] = useState('');
  const [postPhoto, setPostPhoto] = useState<File | null>(null);
  const [postPhotoPreview, setPostPhotoPreview] = useState<string>('');

  const loadMachines = async () => {
    if (!user) {
      setLoadingMachines(false);
      return;
    }

    try {
      setLoadingMachines(true);

      // Cargar ejercicios globales definidos por el admin
      const exercisesSnapshot = await getDocs(collection(db, 'exercises'));
      const fromExercises: Machine[] = exercisesSnapshot.docs.map((docSnap) => {
        const data: any = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || 'Ejercicio sin nombre',
          categoryId: data.categoryId,
          categoryName: data.categoryName,
          description: data.description,
          photoUrl: data.photoUrl || '',
          videoUrl: data.videoUrl || '',
          isGlobal: true,
        };
      });

      fromExercises.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      setMachines(fromExercises);
    } catch (error) {
      console.error('Error loading exercises for workout logger:', error);
    } finally {
      setLoadingMachines(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadMachines();
      loadCategories();
    }
  }, [user]);

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
    if (!user) {
      setTodayExercisesCount(0);
      return;
    }
    
    try {
      const workoutsRef = collection(db, 'workouts');
      const q = query(
        workoutsRef,
        where('userId', '==', user.uid),
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

  // Añadir ejercicio a la máquina en el formulario
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
    if (!user) return;

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
        const fileRef = ref(storage, `machines/${user.uid}/${Date.now()}-${file.name}`);
        await uploadBytes(fileRef, file);
        uploadedPhotoUrl = await getDownloadURL(fileRef);
      }

      // Subir archivos de ejercicios y obtener URLs
      if (!user) throw new Error('No user');
      const exercisesWithUrls = await Promise.all((machineForm.exercises || []).map(async (ex, idx) => {
        let mediaUrl = '';
        if (ex.mediaFile) {
          const ext = ex.mediaFile.name.split('.').pop();
          const fileRef = ref(storage, `machines/${user.uid}/exercises/${Date.now()}-${idx}.${ext}`);
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
        const { doc: docImport, updateDoc } = await import('firebase/firestore');
        await updateDoc(docImport(db, 'machines', machineForm.id), {
          name: trimmedName,
          description: trimmedDescription,
          photoUrl: uploadedPhotoUrl,
          exercises: exercisesWithUrls,
          updatedAt: new Date()
        });
      } else {
        // Crear nueva máquina
        const docRef = await addDoc(collection(db, 'machines'), {
          userId: user.uid,
          isGlobal: false,
          name: trimmedName,
          description: trimmedDescription,
          photoUrl: uploadedPhotoUrl,
          exercises: exercisesWithUrls,
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

    if (!user) return;

    try {
      const machine = machines.find((item) => item.id === newExercise.machineId);
      
      // Guardar directamente en Firestore
      await addDoc(collection(db, 'workouts'), {
        userId: user.uid,
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
      setExerciseError('Tu coach todavía no ha creado ejercicios en la base de datos. Pídele que te asigne una tabla o que registre ejercicios.');
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

  // Estado para nuevo ejercicio en el modal de máquina
  const [machineExerciseForm, setMachineExerciseForm] = useState<Exercise>({
    name: '',
    description: '',
    mediaFile: null,
    mediaPreview: '',
  });

  const resetMachineExerciseForm = () => setMachineExerciseForm({ name: '', description: '', mediaFile: null, mediaPreview: '' });

  const handleMachineExerciseFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (machineExerciseForm.mediaPreview) URL.revokeObjectURL(machineExerciseForm.mediaPreview);
    setMachineExerciseForm((prev: Exercise) => ({
      ...prev,
      mediaFile: file,
      mediaPreview: file ? URL.createObjectURL(file) : ''
    }));
  };

  // Handlers de ejercicios por máquina
  const handleAddExerciseToMachineForm = (): void => {
    if (!machineExerciseForm.name.trim()) return;
    setMachineForm((prev) => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        {
          name: machineExerciseForm.name.trim(),
          description: machineExerciseForm.description?.trim() || '',
          mediaFile: machineExerciseForm.mediaFile,
          mediaPreview: machineExerciseForm.mediaPreview,
        }
      ]
    }));
    resetMachineExerciseForm();
  };

  const handleRemoveExerciseFromMachineForm = (idx: number): void => {
    setMachineForm((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((_: any, i: number) => i !== idx)
    }));
  };

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


            
            {currentWorkout.exercises.map((exercise, index) => {
              const machineLabel = exercise.machineName || 'Ejercicio no especificado';
              const displayName = exercise.name || machineLabel;
              const isCoreExercise = exercise.machineName === 'CORE';

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
                      <p className="exercise-machine-name">{displayName}</p>
                      {displayName !== machineLabel && (
                        <p className="exercise-name">{machineLabel}</p>
                      )}
                      {isCoreExercise && exercise.additionalNotes && (
                        <p className="exercise-additional-notes" style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                          ➕ {exercise.additionalNotes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="exercise-meta">
                    {isCoreExercise ? (
                      // Mostrar información especial para CORE
                      <>
                        {exercise.time && <span>⏱️ {exercise.time}s</span>}
                        {exercise.sets && <span>{exercise.sets} series</span>}
                        {exercise.reps && <span>× {exercise.reps} reps</span>}
                      </>
                    ) : (
                      // Mostrar información normal
                      <>{exercise.sets} series × {exercise.reps} repeticiones @ {exercise.weight} kg</>
                    )}
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
                        {Array.from(new Set(
                          machines
                            .map(m => m.categoryName)
                            .filter(Boolean)
                        )).sort().map(cat => (
                          <option key={cat} value={cat}>🏷️ {cat}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="machine-select">Ejercicio</label>
                      <select
                        id="machine-select"
                        value={newExercise.machineId}
                        onChange={(e) => handleSelectMachine(e.target.value)}
                      >
                        <option value="">Selecciona un ejercicio</option>
                        {machines
                          .filter(machine => {
                            // Filtro por categoría
                            if (categoryFilter !== 'Todas' && machine.categoryName !== categoryFilter) return false;
                            return true;
                          })
                          .map((machine) => (
                            <option key={machine.id} value={machine.id}>
                              {machine.isGlobal ? '🏋️ ' : '👤 '}{machine.name}
                              {machine.categoryName ? ` (${machine.categoryName})` : ''}
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
                          {(selectedMachine.photoUrl || selectedMachine.videoUrl) && (
                            <button
                              type="button"
                              className="view-media-btn"
                              onClick={() => openExerciseMedia(selectedMachine)}
                            >
                              {selectedMachine.videoUrl ? '▶ Ver vídeo de ejecución' : '🖼 Ver imagen de ejecución'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="form-group">
                      <label htmlFor="exercise-name">Nombre del ejercicio</label>
                      <input
                        id="exercise-name"
                        type="text"
                        placeholder={selectedMachine?.name === 'CORE' ? 'Ej. Plancha frontal' : 'Ej. Press pecho en máquina'}
                        value={newExercise.name}
                        onChange={(e) => {
                          setExerciseError('');
                          setNewExercise((prev) => ({ ...prev, name: e.target.value }));
                        }}
                      />
                    </div>

                    {selectedMachine?.name === 'CORE' ? (
                      // Campos especiales para CORE
                      <>
                        <div className="metrics-grid">
                          <div className="form-group">
                            <label htmlFor="exercise-time">⏱️ Tiempo (segundos)</label>
                            <input
                              id="exercise-time"
                              type="number"
                              min="0"
                              placeholder="Ej. 60"
                              value={newExercise.time || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '') {
                                  setNewExercise((prev) => ({ ...prev, time: undefined }));
                                } else {
                                  const parsed = parseInt(value, 10);
                                  if (!Number.isNaN(parsed)) {
                                    setNewExercise((prev) => ({ ...prev, time: Math.max(0, parsed) }));
                                  }
                                }
                              }}
                            />
                          </div>
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
                        </div>
                        <div className="form-group">
                          <label htmlFor="exercise-additional">➕ Notas adicionales</label>
                          <textarea
                            id="exercise-additional"
                            placeholder="Añade cualquier información adicional..."
                            value={newExercise.additionalNotes || ''}
                            onChange={(e) => setNewExercise((prev) => ({ ...prev, additionalNotes: e.target.value }))}
                            rows={3}
                          />
                        </div>
                      </>
                    ) : (
                      // Campos normales para otras máquinas
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
                    )}

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

      {/* Modal media de ejercicio */}
      {exerciseMediaModal.show && (
        <div
          className="machine-modal-backdrop"
          onClick={() => setExerciseMediaModal(m => ({ ...m, show: false }))}
        >
          <div
            className="machine-modal"
            style={{ maxWidth: '90vw', maxHeight: '90vh', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="machine-modal-header">
              <h3>{exerciseMediaModal.title}</h3>
              <button
                type="button"
                className="close-button"
                onClick={() => setExerciseMediaModal(m => ({ ...m, show: false }))}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
              {exerciseMediaModal.type === 'video' ? (
                <video
                  src={exerciseMediaModal.url}
                  controls
                  autoPlay
                  playsInline
                  style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px' }}
                />
              ) : (
                <img
                  src={exerciseMediaModal.url}
                  alt={exerciseMediaModal.title}
                  style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px', objectFit: 'contain' }}
                />
              )}
            </div>
          </div>
        </div>
      )}

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
                <label htmlFor="machine-media">Foto o Video (opcional)</label>
                <input
                  id="machine-media"
                  type="file"
                  accept="image/*,video/*"
                  capture="environment"
                  onChange={handleMachineFileChange}
                />
                <p className="field-hint">Desde el móvil, pulsa para tomar una foto o grabar un video directamente con la cámara.</p>
                {machinePreview && (
                  machinePreview.match(/video/) ? (
                    <video src={machinePreview} controls className="machine-preview" />
                  ) : (
                    <img
                      src={machinePreview}
                      alt="Vista previa de la máquina"
                      className="machine-preview"
                    />
                  )
                )}

                {/* Formulario para añadir ejercicios a la máquina */}
                <div className="machine-exercise-form">
                  <h4>Ejercicios de esta máquina</h4>
                  <input
                    type="text"
                    placeholder="Nombre del ejercicio"
                    value={machineExerciseForm.name}
                    onChange={e => setMachineExerciseForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <textarea
                    placeholder="Descripción (opcional)"
                    value={machineExerciseForm.description}
                    onChange={e => setMachineExerciseForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                  <input
                    type="file"
                    accept="image/*,video/*"
                    capture="environment"
                    onChange={handleMachineExerciseFileChange}
                  />
                  {machineExerciseForm.mediaPreview && (
                    machineExerciseForm.mediaPreview.match(/video/) ? (
                      <video src={machineExerciseForm.mediaPreview} controls width={120} />
                    ) : (
                      <img src={machineExerciseForm.mediaPreview} alt="Preview" width={120} />
                    )
                  )}
                  <button type="button" onClick={handleAddExerciseToMachineForm} disabled={!machineExerciseForm.name.trim()}>
                    Añadir ejercicio
                  </button>
                </div>

                {/* Lista de ejercicios añadidos */}
                {machineForm.exercises.length > 0 && (
                  <div className="machine-exercise-list">
                    <h5>Ejercicios añadidos:</h5>
                    <ul>
                      {machineForm.exercises.map((ex, idx) => (
                        <li key={idx}>
                          <b>{ex.name}</b> {ex.description && <span>- {ex.description}</span>}
                          {ex.mediaPreview && (
                            ex.mediaPreview.match(/video/) ? (
                              <video src={ex.mediaPreview} controls width={60} />
                            ) : (
                              <img src={ex.mediaPreview} alt="Preview" width={60} />
                            )
                          )}
                          <button type="button" onClick={() => handleRemoveExerciseFromMachineForm(idx)}>
                            Eliminar
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="machine-category">Categoría</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    id="machine-category"
                    value={machineForm.categoryId}
                    onChange={e => {
                      const selected = categories.find(cat => cat.id === e.target.value);
                      setMachineForm(prev => ({
                        ...prev,
                        categoryId: e.target.value,
                        categoryName: selected ? selected.name : ''
                      }));
                    }}
                    required
                  >
                    <option value="">Selecciona una categoría...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setCategoryModalOpen(true)} className="secondary-button" style={{padding: '0 10px'}}>+ Nueva</button>
                </div>
              </div>

              {/* Modal para crear nueva categoría */}
              {categoryModalOpen && (
                <div className="category-modal-backdrop" role="dialog" aria-modal="true">
                  <div className="category-modal">
                    <h4>Nueva Categoría</h4>
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      placeholder="Nombre de la categoría"
                      autoFocus
                    />
                    {categoryError && <div className="form-error">{categoryError}</div>}
                    <div style={{marginTop: 12, display: 'flex', gap: 8}}>
                      <button type="button" className="primary-button" onClick={handleAddCategory} disabled={!newCategoryName.trim()}>
                        Crear
                      </button>
                      <button type="button" className="secondary-button" onClick={() => { setCategoryModalOpen(false); setNewCategoryName(''); setCategoryError(''); }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}

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