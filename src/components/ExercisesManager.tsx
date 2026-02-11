import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../services/firebase';
import './WorkoutLogger.css';

interface Category {
  id: string;
  name: string;
}

interface Exercise {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  photoUrl?: string;
  videoUrl?: string;
  createdAt?: any;
  updatedAt?: any;
}

const ExercisesManager: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Media preview modal
  const [mediaModal, setMediaModal] = useState<{
    show: boolean;
    url: string;
    type: 'image' | 'video';
    title: string;
  }>({ show: false, url: '', type: 'image', title: '' });

  const [exerciseForm, setExerciseForm] = useState({
    id: '',
    name: '',
    description: '',
    categoryId: '',
    categoryName: '',
    photoFile: null as File | null,
    videoFile: null as File | null,
    existingPhotoUrl: '',
    existingVideoUrl: '',
  });

  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [videoPreview, setVideoPreview] = useState<string>('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadCategories();
    loadExercises();
  }, []);

  const loadCategories = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'categories'));
      setCategories(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        name: doc.data().name 
      })));
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadExercises = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'exercises'));
      const exercisesData: Exercise[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Exercise, 'id'>)
      }));
      setExercises(exercisesData);
    } catch (error) {
      console.error('Error loading exercises:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setFormError('La imagen no puede superar 5MB');
        return;
      }
      setExerciseForm({ ...exerciseForm, photoFile: file });
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        setFormError('El video no puede superar 50MB');
        return;
      }
      setExerciseForm({ ...exerciseForm, videoFile: file });
      const reader = new FileReader();
      reader.onloadend = () => setVideoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const openNewExerciseModal = () => {
    setExerciseForm({
      id: '',
      name: '',
      description: '',
      categoryId: '',
      categoryName: '',
      photoFile: null,
      videoFile: null,
      existingPhotoUrl: '',
      existingVideoUrl: '',
    });
    setPhotoPreview('');
    setVideoPreview('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditExerciseModal = (exercise: Exercise) => {
    setExerciseForm({
      id: exercise.id,
      name: exercise.name,
      description: exercise.description,
      categoryId: exercise.categoryId,
      categoryName: exercise.categoryName,
      photoFile: null,
      videoFile: null,
      existingPhotoUrl: exercise.photoUrl || '',
      existingVideoUrl: exercise.videoUrl || '',
    });
    setPhotoPreview(exercise.photoUrl || '');
    setVideoPreview(exercise.videoUrl || '');
    setFormError('');
    setModalOpen(true);
  };

  const handleSaveExercise = async () => {
    if (!exerciseForm.name.trim()) {
      setFormError('El nombre del ejercicio es obligatorio');
      return;
    }

    if (!exerciseForm.categoryId) {
      setFormError('Debes seleccionar una categoría');
      return;
    }

    try {
      setFormLoading(true);
      setFormError('');

      let photoUrl = exerciseForm.existingPhotoUrl;
      let videoUrl = exerciseForm.existingVideoUrl;

      // Subir foto si hay una nueva
      if (exerciseForm.photoFile) {
        const photoRef = ref(storage, `exercises/photos/${Date.now()}_${exerciseForm.photoFile.name}`);
        await uploadBytes(photoRef, exerciseForm.photoFile);
        photoUrl = await getDownloadURL(photoRef);
        
        // Eliminar foto anterior si existe
        if (exerciseForm.existingPhotoUrl) {
          try {
            const oldPhotoRef = ref(storage, exerciseForm.existingPhotoUrl);
            await deleteObject(oldPhotoRef);
          } catch (e) {
            console.log('No se pudo eliminar la foto anterior');
          }
        }
      }

      // Subir video si hay uno nuevo
      if (exerciseForm.videoFile) {
        const videoRef = ref(storage, `exercises/videos/${Date.now()}_${exerciseForm.videoFile.name}`);
        await uploadBytes(videoRef, exerciseForm.videoFile);
        videoUrl = await getDownloadURL(videoRef);
        
        // Eliminar video anterior si existe
        if (exerciseForm.existingVideoUrl) {
          try {
            const oldVideoRef = ref(storage, exerciseForm.existingVideoUrl);
            await deleteObject(oldVideoRef);
          } catch (e) {
            console.log('No se pudo eliminar el video anterior');
          }
        }
      }

      const exerciseData = {
        name: exerciseForm.name.trim(),
        description: exerciseForm.description.trim(),
        categoryId: exerciseForm.categoryId,
        categoryName: exerciseForm.categoryName,
        photoUrl: photoUrl || '',
        videoUrl: videoUrl || '',
        updatedAt: serverTimestamp(),
      };

      if (exerciseForm.id) {
        // Actualizar ejercicio existente
        const exerciseRef = doc(db, 'exercises', exerciseForm.id);
        await updateDoc(exerciseRef, exerciseData);
      } else {
        // Crear nuevo ejercicio
        await addDoc(collection(db, 'exercises'), {
          ...exerciseData,
          createdAt: serverTimestamp(),
        });
      }

      await loadExercises();
      setModalOpen(false);
    } catch (error) {
      console.error('Error saving exercise:', error);
      setFormError('Error al guardar el ejercicio');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteExercise = async (exercise: Exercise) => {
    if (!window.confirm(`¿Eliminar el ejercicio "${exercise.name}"?`)) return;

    try {
      // Eliminar foto si existe
      if (exercise.photoUrl) {
        try {
          const photoRef = ref(storage, exercise.photoUrl);
          await deleteObject(photoRef);
        } catch (e) {
          console.log('No se pudo eliminar la foto');
        }
      }

      // Eliminar video si existe
      if (exercise.videoUrl) {
        try {
          const videoRef = ref(storage, exercise.videoUrl);
          await deleteObject(videoRef);
        } catch (e) {
          console.log('No se pudo eliminar el video');
        }
      }

      // Eliminar ejercicio de Firestore
      await deleteDoc(doc(db, 'exercises', exercise.id));
      await loadExercises();
    } catch (error) {
      console.error('Error deleting exercise:', error);
      alert('Error al eliminar el ejercicio');
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    setExerciseForm({
      ...exerciseForm,
      categoryId,
      categoryName: category?.name || '',
    });
  };

  const filteredExercises = exercises.filter(exercise => {
    const matchesCategory = categoryFilter === 'Todas' || exercise.categoryId === categoryFilter;
    const matchesSearch = exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         exercise.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="exercises-manager">
      <div className="exercises-header">
        <h2>📚 Gestión de Ejercicios</h2>
        <button className="btn-primary" onClick={openNewExerciseModal}>
          ➕ Nuevo Ejercicio
        </button>
      </div>

      {/* Filtros */}
      <div className="filters-section">
        <div className="filter-group">
          <label>🔍 Buscar:</label>
          <input
            type="text"
            placeholder="Nombre o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-group">
          <label>📂 Categoría:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="category-filter"
          >
            <option value="Todas">Todas</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de ejercicios */}
      {loading ? (
        <div className="loading">Cargando ejercicios...</div>
      ) : (
        <div className="exercises-grid">
          {filteredExercises.length === 0 ? (
            <div className="no-exercises">
              <p>No hay ejercicios disponibles</p>
              <button className="btn-primary" onClick={openNewExerciseModal}>
                Crear primer ejercicio
              </button>
            </div>
          ) : (
            filteredExercises.map(exercise => (
              <div key={exercise.id} className="exercise-card">
                {exercise.photoUrl && (
                  <div 
                    className="exercise-photo"
                    onClick={() => setMediaModal({ 
                      show: true, 
                      url: exercise.photoUrl!, 
                      type: 'image',
                      title: exercise.name 
                    })}
                  >
                    <img src={exercise.photoUrl} alt={exercise.name} />
                  </div>
                )}
                
                <div className="exercise-info">
                  <h3>{exercise.name}</h3>
                  <p className="exercise-category">📂 {exercise.categoryName}</p>
                  {exercise.description && (
                    <p className="exercise-description">{exercise.description}</p>
                  )}
                  
                  <div className="exercise-media-badges">
                    {exercise.photoUrl && <span className="badge">📷 Foto</span>}
                    {exercise.videoUrl && (
                      <span 
                        className="badge clickable"
                        onClick={() => setMediaModal({ 
                          show: true, 
                          url: exercise.videoUrl!, 
                          type: 'video',
                          title: exercise.name 
                        })}
                      >
                        🎥 Video
                      </span>
                    )}
                  </div>
                </div>

                <div className="exercise-actions">
                  <button 
                    className="btn-edit"
                    onClick={() => openEditExerciseModal(exercise)}
                  >
                    ✏️ Editar
                  </button>
                  <button 
                    className="btn-delete"
                    onClick={() => handleDeleteExercise(exercise)}
                  >
                    🗑️ Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal de formulario */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => !formLoading && setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{exerciseForm.id ? '✏️ Editar Ejercicio' : '➕ Nuevo Ejercicio'}</h3>

            {formError && <div className="error-message">{formError}</div>}

            <div className="form-group">
              <label>Nombre *</label>
              <input
                type="text"
                value={exerciseForm.name}
                onChange={(e) => setExerciseForm({ ...exerciseForm, name: e.target.value })}
                placeholder="Ej: Press de banca"
                disabled={formLoading}
              />
            </div>

            <div className="form-group">
              <label>Descripción</label>
              <textarea
                value={exerciseForm.description}
                onChange={(e) => setExerciseForm({ ...exerciseForm, description: e.target.value })}
                placeholder="Describe el ejercicio, técnica, músculos trabajados..."
                rows={4}
                disabled={formLoading}
              />
            </div>

            <div className="form-group">
              <label>Categoría *</label>
              <select
                value={exerciseForm.categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                disabled={formLoading}
              >
                <option value="">Seleccionar categoría</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Foto del ejercicio (máx 5MB)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                disabled={formLoading}
              />
              {photoPreview && (
                <div className="media-preview">
                  <img src={photoPreview} alt="Preview" />
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Video del ejercicio (máx 50MB)</label>
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                disabled={formLoading}
              />
              {videoPreview && (
                <div className="media-preview">
                  <video src={videoPreview} controls />
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setModalOpen(false)}
                disabled={formLoading}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveExercise}
                disabled={formLoading}
              >
                {formLoading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de vista previa de media */}
      {mediaModal.show && (
        <div className="modal-overlay" onClick={() => setMediaModal({ ...mediaModal, show: false })}>
          <div className="modal-content media-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{mediaModal.title}</h3>
            {mediaModal.type === 'image' ? (
              <img src={mediaModal.url} alt={mediaModal.title} style={{ maxWidth: '100%' }} />
            ) : (
              <video src={mediaModal.url} controls style={{ maxWidth: '100%' }} />
            )}
            <button 
              className="btn-cancel"
              onClick={() => setMediaModal({ ...mediaModal, show: false })}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExercisesManager;
