import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, setDoc, addDoc, serverTimestamp, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import { auth, db, storage, functions } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import './AdminPanel.css';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Machine {
  id: string;
  name: string;
  number?: number;
  category?: string;
  photoUrl?: string;
  description?: string;
  isGlobal?: boolean;
}

interface Category {
  id: string;
  name: string;
  createdAt?: any;
}

interface Exercise {
  id: string;
  name: string;
  machineId: string;
  machineName: string;
  description?: string;
  photoUrl?: string;
  mediaType?: 'image' | 'video';
  createdAt?: any;
}

interface AssignedExercise {
  machineId: string;
  machineName: string;
  machinePhotoUrl?: string;
  exerciseId?: string;
  exerciseName?: string;
  exercisePhotoUrl?: string;
  series: number;
  reps: number;
  weight?: number;
  notes: string;
}

interface AssignedTableData {
  id?: string;
  userId: string;
  exercises: AssignedExercise[];
  assignedBy: string;
  assignedByName: string;
  createdAt: any;
  updatedAt: any;
  status: 'ACTIVA' | 'COMPLETADA';
  completedAt?: any;
}

interface Notification {
  id: string;
  type: string;
  userId: string;
  userName: string;
  userEmail: string;
  comment: string;
  createdAt: any;
  read: boolean;
}

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [exercises, setExercises] = useState<AssignedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Formulario para nuevo ejercicio
  const [newExercise, setNewExercise] = useState<AssignedExercise>({
    machineId: '',
    machineName: '',
    machinePhotoUrl: '',
    exerciseId: '',
    exerciseName: '',
    exercisePhotoUrl: '',
    series: 3,
    reps: 10,
    weight: 0,
    notes: ''
  });

  // Formulario para nueva máquina global
  const [showMachineForm, setShowMachineForm] = useState(false);
  const [machineForm, setMachineForm] = useState({
    id: '',
    name: '',
    number: 1 as string | number,
    category: '',
    description: '',
    photoFile: null as File | null,
    photoPreview: '',
    existingPhotoUrl: '',
    mediaType: 'image' as 'image' | 'video'
  });
  const [mediaModal, setMediaModal] = useState<{
    show: boolean;
    url: string;
    type: 'image' | 'video';
    title: string;
  }>({ show: false, url: '', type: 'image', title: '' });
  const [machineFormLoading, setMachineFormLoading] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [machineToDelete, setMachineToDelete] = useState<Machine | null>(null);
  const [importing, setImporting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
  const [showMachinesSection, setShowMachinesSection] = useState(false);
  const [showCategoryManagement, setShowCategoryManagement] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{id: string, name: string} | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [currentTableDate, setCurrentTableDate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'maquinas' | 'tablas' | 'ejercicios' | 'usuarios' | 'reproductor' | null>(null);
  
  // Estados para gestión de usuarios
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '000000'
  });
  const [savingUser, setSavingUser] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  // Estados para reproductor de entrenamientos
  const [playlist, setPlaylist] = useState<Exercise[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [showCastModal, setShowCastModal] = useState(false);
  const [draggedExercise, setDraggedExercise] = useState<Exercise | null>(null);
  
  // Estados para gestión de ejercicios
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [exerciseForm, setExerciseForm] = useState({
    id: '',
    name: '',
    machineId: '',
    machineName: '',
    description: '',
    photoFile: null as File | null,
    photoPreview: '',
    existingPhotoUrl: '',
    mediaType: 'image' as 'image' | 'video'
  });
  const [exerciseFormLoading, setExerciseFormLoading] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [exerciseToDelete, setExerciseToDelete] = useState<Exercise | null>(null);
  const [machineFilterExercises, setMachineFilterExercises] = useState<string>('Todas');
  const [categoryFilterExerciseForm, setCategoryFilterExerciseForm] = useState<string>('Todas');
  const [categoryFilterTableAssignment, setCategoryFilterTableAssignment] = useState<string>('Todas');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showEmailConfigModal, setShowEmailConfigModal] = useState(false);
  const [emailConfig, setEmailConfig] = useState({
    email: '',
    password: ''
  });
  const [updatingEmailConfig, setUpdatingEmailConfig] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadUserTable(selectedUserId);
    } else {
      setExercises([]);
      setCurrentTableDate(null);
    }
  }, [selectedUserId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Cargar usuarios
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData: User[] = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as User));
      setUsers(usersData);

      // Cargar máquinas globales
      const machinesQuery = query(
        collection(db, 'machines'),
        where('isGlobal', '==', true)
      );
      const machinesSnapshot = await getDocs(machinesQuery);
      const machinesData: Machine[] = machinesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as Machine));
      
      // Asignar números automáticamente a máquinas sin número
      const machinesWithoutNumber = machinesData.filter(m => !m.number);
      if (machinesWithoutNumber.length > 0) {
        let nextNumber = 1;
        for (const machine of machinesWithoutNumber) {
          await updateDoc(doc(db, 'machines', machine.id), { number: nextNumber });
          machine.number = nextNumber;
          nextNumber++;
        }
      }
      
      setMachines(machinesData);

      // Cargar categorías desde Firebase
      console.log('🔄 Cargando categorías desde Firebase...');
      const categoriesSnapshot = await getDocs(collection(db, 'categories'));
      console.log('📦 Snapshot de categories:', categoriesSnapshot.size, 'documentos');
      
      let categoriesData: Category[] = categoriesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as Category));

      // Si no hay categorías en Firebase, usar las de las máquinas existentes
      if (categoriesData.length === 0) {
        console.log('⚠️ No hay categorías en Firebase, usando categorías de máquinas existentes');
        const uniqueCategories = Array.from(new Set(machinesData.map(m => m.category).filter(Boolean)));
        categoriesData = uniqueCategories.map((name, index) => ({
          id: `temp-${index}`,
          name: name as string
        }));
        console.log('📋 Categorías extraídas de máquinas:', categoriesData);
      }
      
      console.log('✅ Total categorías:', categoriesData.length);
      setCategories(categoriesData.sort((a, b) => a.name.localeCompare(b.name)));

      // Cargar ejercicios
      console.log('🔄 Cargando ejercicios desde Firebase...');
      const exercisesSnapshot = await getDocs(collection(db, 'exercises'));
      const exercisesData: Exercise[] = exercisesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as Exercise));
      console.log('✅ Total ejercicios:', exercisesData.length);
      setAllExercises(exercisesData.sort((a, b) => a.name.localeCompare(b.name)));

      // Cargar notificaciones no leídas
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('read', '==', false)
      );
      const notificationsSnapshot = await getDocs(notificationsQuery);
      const notificationsData: Notification[] = notificationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as Notification));
      setNotifications(notificationsData);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Error al cargar datos' });
    } finally {
      setLoading(false);
    }
  };

  const loadUserTable = async (userId: string) => {
    try {
      const q = query(
        collection(db, 'assignedTables'),
        where('userId', '==', userId),
        where('status', '==', 'ACTIVA')
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as AssignedTableData;
        setExercises(data.exercises || []);
        
        // Guardar fecha de modificación
        if (data.updatedAt) {
          const date = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
          setCurrentTableDate(date);
        } else if (data.createdAt) {
          const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          setCurrentTableDate(date);
        }
      } else {
        setExercises([]);
        setCurrentTableDate(null);
      }
    } catch (error) {
      console.error('Error loading user table:', error);
    }
  };

  const completeUserTable = async () => {
    if (!selectedUserId) return;

    if (!window.confirm('¿Marcar la tabla actual como completada? El usuario la verá en su historial.')) {
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      // Buscar tabla activa del usuario
      const q = query(
        collection(db, 'assignedTables'),
        where('userId', '==', selectedUserId),
        where('status', '==', 'ACTIVA')
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setMessage({ type: 'error', text: 'No hay tabla activa para este usuario' });
        return;
      }

      // Marcar como completada
      const tableDoc = snapshot.docs[0];
      await updateDoc(doc(db, 'assignedTables', tableDoc.id), {
        status: 'COMPLETADA',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setMessage({ type: 'success', text: 'Tabla marcada como completada' });
      setExercises([]);
      setCurrentTableDate(null);
    } catch (error) {
      console.error('Error completing table:', error);
      setMessage({ type: 'error', text: 'Error al completar la tabla' });
    } finally {
      setSaving(false);
    }
  };

  const addExercise = () => {
    if (!newExercise.machineId) {
      setMessage({ type: 'error', text: 'Selecciona una máquina' });
      return;
    }

    const selectedMachine = machines.find(m => m.id === newExercise.machineId);
    if (!selectedMachine) return;

    const exercise: AssignedExercise = {
      ...newExercise,
      machineName: selectedMachine.name,
      machinePhotoUrl: selectedMachine.photoUrl
    };

    setExercises([...exercises, exercise]);
    setNewExercise({
      machineId: '',
      machineName: '',
      machinePhotoUrl: '',
      exerciseId: '',
      exerciseName: '',
      exercisePhotoUrl: '',
      series: 3,
      reps: 10,
      weight: 0,
      notes: ''
    });
    setMessage(null);
  };

  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const saveTable = async () => {
    if (!selectedUserId) {
      setMessage({ type: 'error', text: 'Selecciona un usuario' });
      return;
    }

    if (exercises.length === 0) {
      setMessage({ type: 'error', text: 'Agrega al menos un ejercicio' });
      return;
    }

    if (!auth.currentUser) return;

    try {
      setSaving(true);
      setMessage(null);

      const selectedUser = users.find(u => u.id === selectedUserId);
      const currentUserData = users.find(u => u.id === auth.currentUser?.uid);

      console.log('💾 Guardando tabla para usuario:', {
        userId: selectedUserId,
        userName: `${selectedUser?.firstName} ${selectedUser?.lastName}`,
        email: selectedUser?.email,
        ejercicios: exercises.length
      });

      const tableData: AssignedTableData = {
        userId: selectedUserId,
        exercises: exercises,
        assignedBy: auth.currentUser.uid,
        assignedByName: currentUserData ? `${currentUserData.firstName} ${currentUserData.lastName}` : 'Monitor',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'ACTIVA'
      };

      // Buscar tablas activas existentes para este usuario
      const q = query(
        collection(db, 'assignedTables'),
        where('userId', '==', selectedUserId),
        where('status', '==', 'ACTIVA')
      );
      const snapshot = await getDocs(q);

      // Marcar todas las tablas activas como completadas
      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnapshot) => {
        const docRef = doc(db, 'assignedTables', docSnapshot.id);
        batch.update(docRef, {
          status: 'COMPLETADA',
          updatedAt: serverTimestamp()
        });
      });

      // Crear la nueva tabla activa
      const newTableRef = doc(collection(db, 'assignedTables'));
      batch.set(newTableRef, tableData);

      await batch.commit();

      setMessage({ 
        type: 'success', 
        text: `Tabla asignada correctamente a ${selectedUser?.firstName} ${selectedUser?.lastName}` 
      });
    } catch (error) {
      console.error('Error saving table:', error);
      setMessage({ type: 'error', text: 'Error al guardar la tabla' });
    } finally {
      setSaving(false);
    }
  };

  const handleMachinePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const isVideo = file.type.startsWith('video/');
      setMachineForm({
        ...machineForm,
        photoFile: file,
        photoPreview: URL.createObjectURL(file),
        mediaType: isVideo ? 'video' : 'image'
      });
    }
  };

  const openMediaModal = (url: string, type: 'image' | 'video', title: string) => {
    setMediaModal({ show: true, url, type, title });
  };

  const closeMediaModal = () => {
    setMediaModal({ show: false, url: '', type: 'image', title: '' });
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      setMessage({ type: 'error', text: 'El nombre de la categoría es obligatorio' });
      return;
    }

    // Verificar si ya existe
    const exists = categories.some(cat => cat.name.toLowerCase() === newCategoryName.trim().toLowerCase());
    if (exists) {
      setMessage({ type: 'error', text: 'Ya existe una categoría con ese nombre' });
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'categories'), {
        name: newCategoryName.trim(),
        createdAt: serverTimestamp()
      });
      
      const newCategory: Category = { id: docRef.id, name: newCategoryName.trim() };
      setCategories([...categories, newCategory].sort((a, b) => a.name.localeCompare(b.name)));
      setMachineForm({ ...machineForm, category: newCategoryName.trim() });
      setNewCategoryName('');
      setShowNewCategoryInput(false);
      setMessage({ type: 'success', text: '✅ Categoría creada correctamente' });
    } catch (error) {
      console.error('Error creating category:', error);
      setMessage({ type: 'error', text: 'Error al crear la categoría' });
    }
  };

  const migrateCategoriesFromMachines = async () => {
    if (!window.confirm('¿Migrar todas las categorías de las máquinas a Firestore? Esto creará registros de categorías si no existen.')) {
      return;
    }

    try {
      setSaving(true);
      
      // Obtener categorías únicas de las máquinas
      const uniqueCategories = Array.from(new Set(machines.map(m => m.category).filter(Boolean))) as string[];
      
      // Verificar cuáles ya existen en Firestore
      const existingCategoryNames = categories.filter(c => !c.id.startsWith('temp-')).map(c => c.name);
      const categoriesToCreate = uniqueCategories.filter(name => !existingCategoryNames.includes(name));
      
      if (categoriesToCreate.length === 0) {
        setMessage({ type: 'success', text: 'Todas las categorías ya existen en Firestore' });
        setSaving(false);
        return;
      }

      // Crear las categorías faltantes
      const newCategories: Category[] = [];
      for (const categoryName of categoriesToCreate) {
        const categoryRef = await addDoc(collection(db, 'categories'), {
          name: categoryName,
          createdAt: serverTimestamp()
        });
        newCategories.push({
          id: categoryRef.id,
          name: categoryName as string,
          createdAt: serverTimestamp()
        });
      }

      // Actualizar estado
      const updatedCategories = [...categories.filter(c => !c.id.startsWith('temp-')), ...newCategories];
      setCategories(updatedCategories.sort((a, b) => a.name.localeCompare(b.name)));
      
      setMessage({ type: 'success', text: `${categoriesToCreate.length} categoría(s) migrada(s) exitosamente` });
    } catch (error) {
      console.error('Error migrating categories:', error);
      setMessage({ type: 'error', text: 'Error al migrar categorías' });
    } finally {
      setSaving(false);
    }
  };

  const startEditCategory = (category: Category) => {
    setEditingCategory({ id: category.id, name: category.name });
    setEditCategoryName(category.name);
  };

  const cancelEditCategory = () => {
    setEditingCategory(null);
    setEditCategoryName('');
  };

  const saveEditCategory = async () => {
    if (!editingCategory) return;
    
    const newName = editCategoryName.trim();
    if (!newName) {
      setMessage({ type: 'error', text: 'El nombre no puede estar vacío' });
      return;
    }

    // Verificar si ya existe otra categoría con ese nombre
    if (categories.some(cat => cat.id !== editingCategory.id && cat.name.toLowerCase() === newName.toLowerCase())) {
      setMessage({ type: 'error', text: 'Ya existe una categoría con ese nombre' });
      return;
    }

    try {
      setSaving(true);

      const oldName = editingCategory.name;
      
      // Si es una categoría temporal (no está en Firestore), crearla primero
      let categoryId = editingCategory.id;
      if (categoryId.startsWith('temp-')) {
        const categoryRef = await addDoc(collection(db, 'categories'), {
          name: newName,
          createdAt: serverTimestamp()
        });
        categoryId = categoryRef.id;
      } else {
        // Actualizar en Firestore
        await updateDoc(doc(db, 'categories', categoryId), {
          name: newName
        });
      }

      // Actualizar todas las máquinas que usan esta categoría
      const machinesToUpdate = machines.filter(m => m.category === oldName);
      for (const machine of machinesToUpdate) {
        await updateDoc(doc(db, 'machines', machine.id), {
          category: newName
        });
      }

      // Actualizar estado local
      const updatedCategories = categories.map(cat => 
        cat.id === editingCategory.id ? { ...cat, id: categoryId, name: newName } : cat
      ).sort((a, b) => a.name.localeCompare(b.name));
      
      setCategories(updatedCategories);
      
      const updatedMachines = machines.map(m => 
        m.category === oldName ? { ...m, category: newName } : m
      );
      setMachines(updatedMachines);

      setEditingCategory(null);
      setEditCategoryName('');
      
      setMessage({ type: 'success', text: `Categoría actualizada (${machinesToUpdate.length} máquina(s) afectada(s))` });
    } catch (error) {
      console.error('Error updating category:', error);
      setMessage({ type: 'error', text: 'Error al actualizar la categoría' });
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (category: Category) => {
    const machinesWithCategory = machines.filter(m => m.category === category.name);
    
    if (machinesWithCategory.length > 0) {
      if (!window.confirm(`Esta categoría está siendo usada por ${machinesWithCategory.length} máquina(s). ¿Eliminarla de todas formas? Las máquinas quedarán sin categoría.`)) {
        return;
      }
    } else {
      if (!window.confirm(`¿Eliminar la categoría "${category.name}"?`)) {
        return;
      }
    }

    try {
      setSaving(true);

      // Si no es temporal, eliminar de Firestore
      if (!category.id.startsWith('temp-')) {
        await deleteDoc(doc(db, 'categories', category.id));
      }

      // Actualizar máquinas que usan esta categoría
      for (const machine of machinesWithCategory) {
        await updateDoc(doc(db, 'machines', machine.id), {
          category: ''
        });
      }

      // Actualizar estado local
      setCategories(categories.filter(cat => cat.id !== category.id));
      
      const updatedMachines = machines.map(m => 
        m.category === category.name ? { ...m, category: '' } : m
      );
      setMachines(updatedMachines);

      setMessage({ type: 'success', text: 'Categoría eliminada' });
    } catch (error) {
      console.error('Error deleting category:', error);
      setMessage({ type: 'error', text: 'Error al eliminar la categoría' });
    } finally {
      setSaving(false);
    }
  };

  const getCategoryMachineCount = (categoryName: string): number => {
    return machines.filter(m => m.category === categoryName).length;
  };

  // ==================== GESTIÓN DE EJERCICIOS ====================
  
  const openNewExerciseForm = () => {
    setExerciseForm({
      id: '',
      name: '',
      machineId: '',
      machineName: '',
      description: '',
      photoFile: null,
      photoPreview: '',
      existingPhotoUrl: '',
      mediaType: 'image'
    });
    setEditingExercise(null);
    setCategoryFilterExerciseForm('Todas');
    setShowExerciseForm(true);
  };

  const resetExerciseForm = () => {
    setExerciseForm({
      id: '',
      name: '',
      machineId: '',
      machineName: '',
      description: '',
      photoFile: null,
      photoPreview: '',
      existingPhotoUrl: '',
      mediaType: 'image'
    });
    setEditingExercise(null);
    setShowExerciseForm(false);
  };

  const handleExercisePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith('video/');
      setExerciseForm({
        ...exerciseForm,
        photoFile: file,
        photoPreview: URL.createObjectURL(file),
        mediaType: isVideo ? 'video' : 'image'
      });
    }
  };

  const handleExerciseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!exerciseForm.name.trim()) {
      setMessage({ type: 'error', text: 'El nombre del ejercicio es obligatorio' });
      return;
    }

    if (!exerciseForm.machineId) {
      setMessage({ type: 'error', text: 'Debes seleccionar una máquina' });
      return;
    }

    try {
      setExerciseFormLoading(true);

      let photoUrl = exerciseForm.existingPhotoUrl;

      // Subir foto/video si hay uno nuevo
      if (exerciseForm.photoFile) {
        const timestamp = Date.now();
        const fileExtension = exerciseForm.photoFile.name.split('.').pop();
        const fileName = `exercises/${exerciseForm.machineId}_${exerciseForm.name.replace(/\s+/g, '_')}_${timestamp}.${fileExtension}`;
        const storageRef = ref(storage, fileName);
        
        await uploadBytes(storageRef, exerciseForm.photoFile);
        photoUrl = await getDownloadURL(storageRef);

        // Eliminar foto anterior si existe y es diferente
        if (exerciseForm.existingPhotoUrl && exerciseForm.existingPhotoUrl !== photoUrl) {
          try {
            const oldPhotoRef = ref(storage, exerciseForm.existingPhotoUrl);
            await deleteObject(oldPhotoRef);
          } catch (error) {
            console.log('No se pudo eliminar la foto anterior:', error);
          }
        }
      }

      const exerciseData = {
        name: exerciseForm.name.trim(),
        machineId: exerciseForm.machineId,
        machineName: exerciseForm.machineName,
        description: exerciseForm.description.trim(),
        photoUrl: photoUrl || '',
        mediaType: exerciseForm.mediaType,
        updatedAt: serverTimestamp()
      };

      if (editingExercise) {
        // Actualizar ejercicio existente
        await updateDoc(doc(db, 'exercises', editingExercise.id), exerciseData);
        
        setAllExercises(allExercises.map(ex => 
          ex.id === editingExercise.id 
            ? { ...ex, ...exerciseData, id: editingExercise.id } 
            : ex
        ).sort((a, b) => a.name.localeCompare(b.name)));
        
        setMessage({ type: 'success', text: '✅ Ejercicio actualizado correctamente' });
      } else {
        // Crear nuevo ejercicio
        const docRef = await addDoc(collection(db, 'exercises'), {
          ...exerciseData,
          createdAt: serverTimestamp()
        });
        
        const newExercise: Exercise = {
          id: docRef.id,
          ...exerciseData
        };
        
        setAllExercises([...allExercises, newExercise].sort((a, b) => a.name.localeCompare(b.name)));
        setMessage({ type: 'success', text: '✅ Ejercicio creado correctamente' });
      }

      resetExerciseForm();
    } catch (error) {
      console.error('Error saving exercise:', error);
      setMessage({ type: 'error', text: 'Error al guardar el ejercicio' });
    } finally {
      setExerciseFormLoading(false);
    }
  };

  const startEditExercise = (exercise: Exercise) => {
    setExerciseForm({
      id: exercise.id,
      name: exercise.name,
      machineId: exercise.machineId,
      machineName: exercise.machineName,
      description: exercise.description || '',
      photoFile: null,
      photoPreview: exercise.photoUrl || '',
      existingPhotoUrl: exercise.photoUrl || '',
      mediaType: exercise.mediaType || 'image'
    });
    setEditingExercise(exercise);
    setShowExerciseForm(true);
  };

  const deleteExercise = async (exercise: Exercise, confirmed: boolean = false) => {
    if (!confirmed) {
      // Verificar si el ejercicio está siendo usado en tablas
      const tablesSnapshot = await getDocs(collection(db, 'assignedTables'));
      let affectedTables = 0;
      
      for (const tableDoc of tablesSnapshot.docs) {
        const tableData = tableDoc.data() as AssignedTableData;
        if (tableData.exercises?.some(ex => ex.exerciseId === exercise.id)) {
          affectedTables++;
        }
      }

      if (affectedTables > 0) {
        setExerciseToDelete({ ...exercise, needsConfirmation: true, affectedTables } as any);
      } else {
        setExerciseToDelete(exercise);
      }
      return;
    }

    try {
      setSaving(true);

      // Eliminar foto si existe
      if (exercise.photoUrl) {
        try {
          const photoRef = ref(storage, exercise.photoUrl);
          await deleteObject(photoRef);
        } catch (error) {
          console.log('No se pudo eliminar la foto:', error);
        }
      }

      // Eliminar el ejercicio de todas las tablas asignadas
      const tablesSnapshot = await getDocs(collection(db, 'assignedTables'));
      const batch = writeBatch(db);

      for (const tableDoc of tablesSnapshot.docs) {
        const tableData = tableDoc.data() as AssignedTableData;
        if (tableData.exercises?.some(ex => ex.exerciseId === exercise.id)) {
          const updatedExercises = tableData.exercises.filter(ex => ex.exerciseId !== exercise.id);
          batch.update(tableDoc.ref, { 
            exercises: updatedExercises,
            updatedAt: serverTimestamp()
          });
        }
      }

      await batch.commit();

      // Eliminar el ejercicio de Firestore
      await deleteDoc(doc(db, 'exercises', exercise.id));

      setAllExercises(allExercises.filter(ex => ex.id !== exercise.id));
      setExerciseToDelete(null);
      setMessage({ type: 'success', text: '✅ Ejercicio eliminado correctamente' });
    } catch (error) {
      console.error('Error deleting exercise:', error);
      setMessage({ type: 'error', text: 'Error al eliminar el ejercicio' });
    } finally {
      setSaving(false);
    }
  };

  const getExercisesByMachine = (machineId: string): Exercise[] => {
    return allExercises.filter(ex => ex.machineId === machineId);
  };

  const importDefaultMachines = async () => {
    if (!window.confirm('¿Importar 20 máquinas de ejemplo? Esta acción añadirá máquinas globales a la base de datos.')) {
      return;
    }

    setImporting(true);
    const defaultMachines = [
      { name: "Press de Banca", category: "Pecho", description: "Press horizontal con barra para desarrollo de pectoral" },
      { name: "Press Inclinado", category: "Pecho", description: "Press en banco inclinado para pectoral superior" },
      { name: "Aperturas con Mancuernas", category: "Pecho", description: "Ejercicio de aislamiento para pectoral" },
      { name: "Sentadilla con Barra", category: "Piernas", description: "Sentadilla completa con barra para cuádriceps y glúteos" },
      { name: "Prensa de Piernas", category: "Piernas", description: "Prensa 45 grados para desarrollo de piernas" },
      { name: "Curl Femoral", category: "Piernas", description: "Ejercicio de aislamiento para femorales" },
      { name: "Extensión de Cuádriceps", category: "Piernas", description: "Ejercicio de aislamiento para cuádriceps" },
      { name: "Peso Muerto", category: "Espalda", description: "Ejercicio compuesto para espalda baja y piernas" },
      { name: "Dominadas", category: "Espalda", description: "Ejercicio con peso corporal para dorsal" },
      { name: "Remo con Barra", category: "Espalda", description: "Remo horizontal para desarrollo de espalda" },
      { name: "Jalones al Pecho", category: "Espalda", description: "Jalones en polea alta para dorsal" },
      { name: "Press Militar", category: "Hombros", description: "Press vertical con barra para deltoides" },
      { name: "Elevaciones Laterales", category: "Hombros", description: "Aislamiento para deltoides lateral" },
      { name: "Elevaciones Frontales", category: "Hombros", description: "Aislamiento para deltoides frontal" },
      { name: "Curl con Barra", category: "Brazos", description: "Curl de bíceps con barra" },
      { name: "Curl con Mancuernas", category: "Brazos", description: "Curl alterno de bíceps" },
      { name: "Press Francés", category: "Brazos", description: "Ejercicio de tríceps con barra" },
      { name: "Fondos en Paralelas", category: "Brazos", description: "Ejercicio compuesto para tríceps y pecho" },
      { name: "Abdominales en Máquina", category: "Core", description: "Crunch en máquina para abdominales" },
      { name: "Plancha", category: "Core", description: "Ejercicio isométrico para core completo" }
    ];

    try {
      let imported = 0;
      for (const machine of defaultMachines) {
        await addDoc(collection(db, 'machines'), {
          ...machine,
          photoUrl: '',
          isGlobal: true,
          createdAt: new Date()
        });
        imported++;
      }
      
      setMessage({ type: 'success', text: `✅ ${imported} máquinas importadas correctamente` });
      await loadData();
    } catch (error) {
      console.error('Error importing machines:', error);
      setMessage({ type: 'error', text: 'Error al importar máquinas' });
    } finally {
      setImporting(false);
    }
  };

  const handleMachineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineForm.name.trim()) {
      setMessage({ type: 'error', text: 'El nombre de la máquina es obligatorio' });
      return;
    }

    if (!machineForm.number || machineForm.number === '') {
      setMessage({ type: 'error', text: 'El número de máquina es obligatorio' });
      return;
    }

    // Validar que no exista otra máquina con el mismo número
    const duplicateNumber = machines.find(m => 
      m.number === Number(machineForm.number) && m.id !== machineForm.id
    );
    if (duplicateNumber) {
      setMessage({ 
        type: 'error', 
        text: `Ya existe una máquina con el número ${machineForm.number}: "${duplicateNumber.name}"` 
      });
      return;
    }

    try {
      setMachineFormLoading(true);
      setMessage(null);

      let photoUrl = machineForm.existingPhotoUrl;
      
      // Si hay una nueva foto, subirla
      if (machineForm.photoFile) {
        const fileRef = ref(storage, `machines/global/${Date.now()}-${machineForm.photoFile.name}`);
        await uploadBytes(fileRef, machineForm.photoFile);
        photoUrl = await getDownloadURL(fileRef);

        // Si estamos editando y había una foto anterior, eliminarla
        if (editingMachine && machineForm.existingPhotoUrl) {
          try {
            const oldPhotoRef = ref(storage, machineForm.existingPhotoUrl);
            await deleteObject(oldPhotoRef);
          } catch (error) {
            console.log('Error deleting old photo:', error);
          }
        }
      }

      const machineData = {
        isGlobal: true,
        name: machineForm.name.trim(),
        number: Number(machineForm.number),
        category: machineForm.category.trim(),
        description: machineForm.description.trim(),
        photoUrl: photoUrl,
        updatedAt: new Date()
      };

      if (editingMachine) {
        // Actualizar máquina existente
        await updateDoc(doc(db, 'machines', machineForm.id), machineData);
      } else {
        // Crear nueva máquina
        await addDoc(collection(db, 'machines'), {
          ...machineData,
          createdAt: new Date()
        });
      }

      setMessage({ type: 'success', text: editingMachine ? 'Máquina actualizada correctamente' : 'Máquina global creada correctamente' });
      resetMachineForm();
      await loadData();
    } catch (error) {
      console.error('Error saving global machine:', error);
      setMessage({ type: 'error', text: 'Error al guardar la máquina' });
    } finally {
      setMachineFormLoading(false);
    }
  };

  const resetMachineForm = () => {
    // Calcular el siguiente número disponible
    const maxNumber = machines.length > 0 ? Math.max(...machines.map(m => m.number || 0)) : 0;
    
    setMachineForm({ 
      id: '',
      name: '',
      number: maxNumber + 1,
      category: '',
      description: '', 
      photoFile: null, 
      photoPreview: '',
      existingPhotoUrl: '',
      mediaType: 'image'
    });
    setShowMachineForm(false);
    setEditingMachine(null);
  };

  const openNewMachineForm = () => {
    const maxNumber = machines.length > 0 ? Math.max(...machines.map(m => m.number || 0)) : 0;
    setMachineForm({
      id: '',
      name: '',
      number: maxNumber + 1,
      category: '',
      description: '',
      photoFile: null,
      photoPreview: '',
      existingPhotoUrl: '',
      mediaType: 'image'
    });
    setShowMachineForm(true);
    setEditingMachine(null);
  };

  const startEditMachine = (machine: Machine) => {
    setEditingMachine(machine);
    setMachineForm({
      id: machine.id,
      name: machine.name,
      number: machine.number || 1,
      category: machine.category || '',
      description: machine.description || '',
      photoFile: null,
      photoPreview: machine.photoUrl || '',
      existingPhotoUrl: machine.photoUrl || '',
      mediaType: 'image'
    });
    setShowMachineForm(true);
  };

  const deleteMachine = async (machine: Machine, forceDelete = false) => {
    try {
      setMessage(null);
      
      // Verificar si la máquina está siendo usada en tablas asignadas
      const tablesQuery = query(collection(db, 'assignedTables'));
      const tablesSnapshot = await getDocs(tablesQuery);
      
      const affectedTables: { docId: string, exercises: any[], userId: string }[] = [];
      
      tablesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.exercises && data.exercises.some((ex: any) => ex.machineId === machine.id)) {
          affectedTables.push({
            docId: doc.id,
            exercises: data.exercises,
            userId: data.userId
          });
        }
      });

      // Si está siendo usada y no es eliminación forzada, mostrar información
      if (affectedTables.length > 0 && !forceDelete) {
        // Actualizar el estado para mostrar el modal con información detallada
        setMachineToDelete({ 
          ...machine, 
          affectedTables: affectedTables.length,
          needsConfirmation: true 
        } as any);
        return;
      }

      // Proceder con la eliminación
      const batch = writeBatch(db);

      // Eliminar la máquina
      batch.delete(doc(db, 'machines', machine.id));

      // Si hay tablas afectadas, actualizar cada una eliminando los ejercicios con esta máquina
      affectedTables.forEach(({ docId, exercises }) => {
        const updatedExercises = exercises.filter((ex: any) => ex.machineId !== machine.id);
        const tableRef = doc(db, 'assignedTables', docId);
        batch.update(tableRef, { 
          exercises: updatedExercises,
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();

      // Eliminar foto de Storage si existe
      if (machine.photoUrl) {
        try {
          const photoRef = ref(storage, machine.photoUrl);
          await deleteObject(photoRef);
        } catch (storageError) {
          console.log('Error deleting photo from storage:', storageError);
        }
      }

      const message = affectedTables.length > 0 
        ? `Máquina eliminada correctamente. Se han actualizado ${affectedTables.length} tabla(s) de usuarios.`
        : 'Máquina eliminada correctamente';

      setMessage({ type: 'success', text: message });
      setMachineToDelete(null);
      await loadData();
    } catch (error) {
      console.error('Error deleting machine:', error);
      setMessage({ type: 'error', text: 'Error al eliminar la máquina' });
    }
  };

  const handleUpdateEmailConfig = async () => {
    if (!emailConfig.email || !emailConfig.password) {
      alert('⚠️ Debes completar ambos campos');
      return;
    }

    if (!emailConfig.email.includes('@')) {
      alert('⚠️ Email inválido');
      return;
    }

    setUpdatingEmailConfig(true);
    
    try {
      // Guardar las credenciales en Firestore para que el admin las pueda recuperar
      await setDoc(doc(db, 'config', 'email'), {
        email: emailConfig.email,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email
      });

      alert('✅ Configuración guardada correctamente.\n\n⚠️ IMPORTANTE: Debes ejecutar estos comandos en la terminal:\n\n1. firebase functions:secrets:set GMAIL_EMAIL\n   (Introduce: ' + emailConfig.email + ')\n\n2. firebase functions:secrets:set GMAIL_PASSWORD\n   (Introduce: ' + emailConfig.password + ')\n\n3. firebase deploy --only functions');
      
      setShowEmailConfigModal(false);
      setEmailConfig({ email: '', password: '' });
    } catch (error) {
      console.error('Error updating email config:', error);
      alert('❌ Error al guardar la configuración');
    } finally {
      setUpdatingEmailConfig(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-panel-container">
        <p>Cargando panel de administración...</p>
      </div>
    );
  }

  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <div className="admin-panel-container">
      {/* Header de Admin con información completa */}
      <div className="admin-header">
        <div className="admin-title-section">
          <h1>Panel de Administración</h1>
          <p>Bienvenido, Max - Gestión de máquinas y tablas de entrenamiento</p>
        </div>
        <div className="admin-user-info">
          <div className="admin-date-info" style={{ 
            color: '#e0e0e0', 
            fontSize: '14px', 
            marginRight: '15px',
            textAlign: 'right',
            lineHeight: '1.3'
          }}>
            <div style={{ fontWeight: 'bold' }}>
              {new Date().toLocaleDateString('es-ES', { weekday: 'long' }).charAt(0).toUpperCase() + new Date().toLocaleDateString('es-ES', { weekday: 'long' }).slice(1)}
            </div>
            <div style={{ color: '#999', fontSize: '13px' }}>
              {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div className="admin-avatar" onClick={() => setShowUserMenu(!showUserMenu)}>
            <img src="/icons/maxgym.png" alt="MAXGYM Logo" className="admin-avatar-logo" />
          </div>
          {showUserMenu && (
            <div className="user-menu">
              <button onClick={() => { setShowEmailConfigModal(true); setShowUserMenu(false); }}>
                📧 Configurar Email
              </button>
              <button onClick={() => auth.signOut()}>
                🚪 Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navegación de secciones - Solo mostrar si no hay tab activo */}
      {!activeTab && (
        <div className="admin-navigation">
          <button 
            className="nav-tab"
            onClick={() => setActiveTab('usuarios')}
          >
            👥 Gestión de Usuarios
          </button>
          <button 
            className="nav-tab"
            onClick={() => setActiveTab('maquinas')}
          >
            🏋️ Gestión de Máquinas
          </button>
          <button 
            className="nav-tab"
            onClick={() => setActiveTab('ejercicios')}
          >
            💪 Gestión de Ejercicios
          </button>
          <button 
            className="nav-tab"
            onClick={() => setActiveTab('tablas')}
          >
            📋 Gestión de Tablas
          </button>
          <button 
            className="nav-tab"
            onClick={() => setActiveTab('reproductor')}
          >
            🎬 Reproductor de Entrenamientos
          </button>
        </div>
      )}

      {/* Botón de volver cuando hay un tab activo */}
      {activeTab && (
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => setActiveTab(null)}
            style={{
              padding: '12px 24px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '10px',
              color: '#e0e0e0',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.transform = 'translateX(-5px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            ← Volver al Menú Principal
          </button>
        </div>
      )}

      {message && (
        <div className={`admin-message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Notificaciones de solicitudes de cambio - Solo en menú principal o sección de tablas */}
      {(!activeTab || activeTab === 'tablas') && notifications.length > 0 && (
        <div className="notifications-section" style={{ 
          background: 'rgba(245, 87, 108, 0.1)', 
          border: '1px solid rgba(245, 87, 108, 0.3)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '30px'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#f5576c' }}>
            🔔 Solicitudes de Cambio ({notifications.length})
          </h3>
          {notifications.map((notif) => (
            <div key={notif.id} style={{
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '10px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <strong style={{ color: '#e0e0e0' }}>{notif.userName}</strong>
                  <span style={{ color: '#999', fontSize: '14px', marginLeft: '10px' }}>
                    {notif.userEmail}
                  </span>
                </div>
                <span style={{ color: '#999', fontSize: '12px' }}>
                  {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleString('es-ES') : 'Ahora'}
                </span>
              </div>
              <p style={{ color: '#b0b0b0', margin: '10px 0', lineHeight: '1.5' }}>
                💬 {notif.comment}
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    setSelectedUserId(notif.userId);
                    updateDoc(doc(db, 'notifications', notif.id), { read: true });
                    setNotifications(notifications.filter(n => n.id !== notif.id));
                  }}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    color: 'white',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 'bold'
                  }}
                >
                  👤 Ver Usuario
                </button>
                <button
                  onClick={async () => {
                    await updateDoc(doc(db, 'notifications', notif.id), { read: true });
                    setNotifications(notifications.filter(n => n.id !== notif.id));
                  }}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid #444',
                    color: '#e0e0e0',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  ✓ Marcar como leída
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="admin-content">
        {/* Sección de Gestión de Usuarios */}
        {activeTab === 'usuarios' && (
        <>
          {/* Título de la página */}
          <div style={{ 
            marginBottom: '30px',
            padding: '20px',
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
            borderRadius: '15px',
            border: '2px solid rgba(102, 126, 234, 0.3)'
          }}>
            <h2 style={{ 
              margin: '0',
              color: '#667eea',
              fontSize: '28px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              👥 Gestión de Usuarios
            </h2>
            <p style={{ 
              margin: '8px 0 0 0',
              color: '#b0b0b0',
              fontSize: '14px'
            }}>
              Administra los perfiles de los usuarios, edita su información y gestiona sus contraseñas
            </p>
          </div>

          {/* Header con búsqueda y botón de crear */}
          <div style={{
            display: 'flex',
            gap: '15px',
            marginBottom: '25px',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <input
              type="text"
              placeholder="🔍 Buscar usuario por nombre o email..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              style={{
                flex: '1',
                minWidth: '250px',
                padding: '12px 20px',
                background: '#2d2d2d',
                border: '2px solid #3d3d3d',
                borderRadius: '10px',
                color: '#e0e0e0',
                fontSize: '14px',
                transition: 'all 0.3s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)';
                e.currentTarget.style.background = '#333';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#3d3d3d';
                e.currentTarget.style.background = '#2d2d2d';
              }}
            />
            <button
              onClick={() => {
                setUserForm({ firstName: '', lastName: '', email: '', password: '' });
                setShowCreateUserModal(true);
              }}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #51cf66 0%, #40c057 100%)',
                border: 'none',
                borderRadius: '10px',
                color: 'white',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(81, 207, 102, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(81, 207, 102, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(81, 207, 102, 0.3)';
              }}
            >
              ➕ Crear Usuario
            </button>
          </div>

          {/* Contador de resultados */}
          {userSearchQuery && (
            <p style={{ 
              color: '#999', 
              fontSize: '14px', 
              marginBottom: '15px',
              fontStyle: 'italic'
            }}>
              {users.filter(user => 
                user.firstName.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                user.lastName.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                user.email.toLowerCase().includes(userSearchQuery.toLowerCase())
              ).length} resultado(s) encontrado(s)
            </p>
          )}

          {/* Lista de usuarios */}
          <div className="users-list" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px',
            marginBottom: '40px'
          }}>
            {users
              .filter(user => {
                if (!userSearchQuery) return true;
                const query = userSearchQuery.toLowerCase();
                return (
                  user.firstName.toLowerCase().includes(query) ||
                  user.lastName.toLowerCase().includes(query) ||
                  user.email.toLowerCase().includes(query)
                );
              })
              .map((user) => (
              <div key={user.id} style={{
                background: 'linear-gradient(145deg, #2d2d2d 0%, #1f1f1f 100%)',
                border: '2px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '20px',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)';
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}>
                <div style={{ marginBottom: '15px' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    fontWeight: 'bold',
                    color: 'white',
                    marginBottom: '10px'
                  }}>
                    {user.firstName.charAt(0).toUpperCase()}
                  </div>
                  <h3 style={{ margin: '0 0 5px 0', color: '#e0e0e0', fontSize: '20px' }}>
                    {user.firstName} {user.lastName}
                  </h3>
                  <p style={{ margin: '0', color: '#999', fontSize: '14px' }}>
                    📧 {user.email}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                  <button
                    onClick={() => {
                      setEditingUser(user);
                      setUserForm({
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                        password: ''
                      });
                    }}
                    style={{
                      padding: '10px 15px',
                      background: 'rgba(33, 150, 243, 0.2)',
                      border: '1px solid rgba(33, 150, 243, 0.3)',
                      borderRadius: '8px',
                      color: '#2196F3',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(33, 150, 243, 0.3)';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(33, 150, 243, 0.2)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    ✏️ Editar Información
                  </button>
                  <button
                    onClick={() => setResetPasswordUserId(user.id)}
                    style={{
                      padding: '10px 15px',
                      background: 'rgba(255, 152, 0, 0.2)',
                      border: '1px solid rgba(255, 152, 0, 0.3)',
                      borderRadius: '8px',
                      color: '#ff9800',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 152, 0, 0.3)';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 152, 0, 0.2)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    🔑 Restablecer Contraseña
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Modal de crear usuario */}
          {showCreateUserModal && (
            <div className="modal-overlay" onClick={() => setShowCreateUserModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 20px 0', color: '#51cf66' }}>
                  ➕ Crear Nuevo Usuario
                </h3>
                
                <div className="form-group">
                  <label>Nombre *</label>
                  <input
                    type="text"
                    value={userForm.firstName}
                    onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                    placeholder="Juan"
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#2d2d2d',
                      border: '1px solid #3d3d3d',
                      borderRadius: '6px',
                      color: '#e0e0e0',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div className="form-group">
                  <label>Apellidos *</label>
                  <input
                    type="text"
                    value={userForm.lastName}
                    onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                    placeholder="Pérez García"
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#2d2d2d',
                      border: '1px solid #3d3d3d',
                      borderRadius: '6px',
                      color: '#e0e0e0',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    placeholder="usuario@ejemplo.com"
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#2d2d2d',
                      border: '1px solid #3d3d3d',
                      borderRadius: '6px',
                      color: '#e0e0e0',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ 
                  background: 'rgba(81, 207, 102, 0.1)', 
                  padding: '15px', 
                  borderRadius: '8px',
                  border: '1px solid rgba(81, 207, 102, 0.3)',
                  marginBottom: '20px'
                }}>
                  <p style={{ color: '#51cf66', margin: 0, fontSize: '14px', lineHeight: '1.6' }}>
                    🔐 <strong>Contraseña predeterminada:</strong> 000000<br/>
                    📧 Se enviará un email al usuario indicándole que debe cambiar su contraseña en el primer inicio de sesión.
                  </p>
                </div>

                <div className="modal-actions">
                  <button
                    onClick={async () => {
                      // Validar campos
                      if (!userForm.firstName.trim() || !userForm.lastName.trim() || 
                          !userForm.email.trim()) {
                        setMessage({ type: 'error', text: '⚠️ Todos los campos son obligatorios' });
                        return;
                      }

                      if (!userForm.email.includes('@')) {
                        setMessage({ type: 'error', text: 'Email inválido' });
                        return;
                      }

                      try {
                        setCreatingUser(true);
                        
                        // Importar las funciones necesarias
                        const { createUserWithEmailAndPassword } = await import('firebase/auth');
                        const { doc, setDoc } = await import('firebase/firestore');
                        
                        // Crear usuario en Firebase Authentication con contraseña predeterminada
                        const userCredential = await createUserWithEmailAndPassword(
                          auth,
                          userForm.email.trim(),
                          '000000' // Contraseña predeterminada
                        );

                        // Crear documento en Firestore
                        await setDoc(doc(db, 'users', userCredential.user.uid), {
                          firstName: userForm.firstName.trim(),
                          lastName: userForm.lastName.trim(),
                          email: userForm.email.trim(),
                          createdAt: serverTimestamp()
                        });

                        // Enviar email de bienvenida
                        try {
                          const sendWelcomeEmail = httpsCallable(functions, 'sendWelcomeEmail');
                          await sendWelcomeEmail({
                            userEmail: userForm.email.trim(),
                            userName: userForm.firstName.trim()
                          });
                          console.log('Email de bienvenida enviado');
                        } catch (emailError) {
                          console.error('Error al enviar email de bienvenida:', emailError);
                          // No fallar la creación del usuario si el email falla
                        }

                        // Actualizar lista local
                        setUsers([...users, {
                          id: userCredential.user.uid,
                          firstName: userForm.firstName.trim(),
                          lastName: userForm.lastName.trim(),
                          email: userForm.email.trim()
                        }]);

                        setMessage({ 
                          type: 'success', 
                          text: `✅ Usuario ${userForm.firstName} ${userForm.lastName} creado correctamente. Se ha enviado un email de bienvenida.` 
                        });
                        
                        setShowCreateUserModal(false);
                        setUserForm({ firstName: '', lastName: '', email: '', password: '000000' });
                      } catch (error: any) {
                        console.error('Error creating user:', error);
                        let errorMessage = 'Error al crear el usuario';
                        
                        if (error.code === 'auth/email-already-in-use') {
                          errorMessage = 'El email ya está registrado';
                        } else if (error.code === 'auth/invalid-email') {
                          errorMessage = 'Email inválido';
                        } else if (error.code === 'auth/weak-password') {
                          errorMessage = 'La contraseña es muy débil';
                        }
                        
                        setMessage({ type: 'error', text: `❌ ${errorMessage}` });
                      } finally {
                        setCreatingUser(false);
                      }
                    }}
                    disabled={creatingUser}
                    className="primary-button"
                  >
                    {creatingUser ? '⏳ Creando...' : '✅ Crear Usuario'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateUserModal(false);
                      setUserForm({ firstName: '', lastName: '', email: '', password: '' });
                    }}
                    disabled={creatingUser}
                    className="secondary-button"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de editar usuario */}
          {editingUser && (
            <div className="modal-overlay" onClick={() => setEditingUser(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 20px 0', color: '#667eea' }}>
                  ✏️ Editar Usuario
                </h3>
                
                <div className="form-group">
                  <label>Nombre</label>
                  <input
                    type="text"
                    value={userForm.firstName}
                    onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#2d2d2d',
                      border: '1px solid #3d3d3d',
                      borderRadius: '6px',
                      color: '#e0e0e0',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div className="form-group">
                  <label>Apellidos</label>
                  <input
                    type="text"
                    value={userForm.lastName}
                    onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#2d2d2d',
                      border: '1px solid #3d3d3d',
                      borderRadius: '6px',
                      color: '#e0e0e0',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#2d2d2d',
                      border: '1px solid #3d3d3d',
                      borderRadius: '6px',
                      color: '#e0e0e0',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div className="modal-actions">
                  <button
                    onClick={async () => {
                      if (!userForm.firstName.trim() || !userForm.lastName.trim() || !userForm.email.trim()) {
                        setMessage({ type: 'error', text: 'Todos los campos son obligatorios' });
                        return;
                      }

                      try {
                        setSavingUser(true);
                        await updateDoc(doc(db, 'users', editingUser.id), {
                          firstName: userForm.firstName.trim(),
                          lastName: userForm.lastName.trim(),
                          email: userForm.email.trim()
                        });

                        setUsers(users.map(u => 
                          u.id === editingUser.id 
                            ? { ...u, ...userForm }
                            : u
                        ));

                        setMessage({ type: 'success', text: '✅ Usuario actualizado correctamente' });
                        setEditingUser(null);
                      } catch (error) {
                        console.error('Error updating user:', error);
                        setMessage({ type: 'error', text: 'Error al actualizar el usuario' });
                      } finally {
                        setSavingUser(false);
                      }
                    }}
                    disabled={savingUser}
                    className="primary-button"
                  >
                    {savingUser ? '⏳ Guardando...' : '💾 Guardar Cambios'}
                  </button>
                  <button
                    onClick={() => setEditingUser(null)}
                    disabled={savingUser}
                    className="secondary-button"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de restablecer contraseña */}
          {resetPasswordUserId && (
            <div className="modal-overlay" onClick={() => setResetPasswordUserId(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 20px 0', color: '#ff9800' }}>
                  🔑 Restablecer Contraseña
                </h3>
                
                <p style={{ color: '#b0b0b0', marginBottom: '20px' }}>
                  Usuario: <strong style={{ color: '#e0e0e0' }}>
                    {users.find(u => u.id === resetPasswordUserId)?.email}
                  </strong>
                </p>

                <div className="form-group">
                  <label>Nueva Contraseña</label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#2d2d2d',
                      border: '1px solid #3d3d3d',
                      borderRadius: '6px',
                      color: '#e0e0e0',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <small style={{ color: '#999', display: 'block', marginTop: '5px' }}>
                    💡 Sugerencia: Usa una contraseña fácil de recordar como "gymapp2025"
                  </small>
                </div>

                <div className="modal-actions">
                  <button
                    onClick={async () => {
                      if (newPassword.length < 6) {
                        setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres' });
                        return;
                      }

                      try {
                        setResettingPassword(true);
                        
                        // Llamar a la Cloud Function para restablecer la contraseña
                        const resetPasswordFunction = httpsCallable(functions, 'resetUserPassword');
                        const result = await resetPasswordFunction({
                          userId: resetPasswordUserId,
                          newPassword: newPassword
                        });

                        console.log('Contraseña actualizada:', result.data);
                        setMessage({ 
                          type: 'success', 
                          text: `✅ Contraseña actualizada correctamente para ${users.find(u => u.id === resetPasswordUserId)?.email}` 
                        });
                        
                        setResetPasswordUserId(null);
                        setNewPassword('');
                      } catch (error: any) {
                        console.error('Error resetting password:', error);
                        const errorMessage = error.message || 'Error al restablecer la contraseña';
                        setMessage({ type: 'error', text: `❌ ${errorMessage}` });
                      } finally {
                        setResettingPassword(false);
                      }
                    }}
                    disabled={resettingPassword}
                    className="primary-button"
                  >
                    {resettingPassword ? '⏳ Restableciendo...' : '🔑 Restablecer Contraseña'}
                  </button>
                  <button
                    onClick={() => {
                      setResetPasswordUserId(null);
                      setNewPassword('');
                    }}
                    disabled={resettingPassword}
                    className="secondary-button"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
        )}

        {/* Sección de Máquinas Globales (mostrar solo si activeTab === 'maquinas') */}
        {activeTab === 'maquinas' && (
        <>
          {/* Título de la página */}
          <div style={{ 
            marginBottom: '30px',
            padding: '20px',
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
            borderRadius: '15px',
            border: '2px solid rgba(102, 126, 234, 0.3)'
          }}>
            <h2 style={{ 
              margin: '0',
              color: '#667eea',
              fontSize: '28px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              🏋️ Gestión de Máquinas
            </h2>
            <p style={{ 
              margin: '8px 0 0 0',
              color: '#b0b0b0',
              fontSize: '14px'
            }}>
              Administra las máquinas del gimnasio, organízalas por categorías y asígnalas a los usuarios
            </p>
          </div>

          <div className="global-machines-section" style={{ marginBottom: '40px' }}>
            <div className="section-header">
              <h3>🏋️ Máquinas del Gimnasio ({machines.length})</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {machines.length === 0 && (
                <button 
                  onClick={importDefaultMachines}
                  disabled={importing}
                  className="import-machines-btn"
                  style={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    cursor: importing ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {importing ? '⏳ Importando...' : '📥 Importar 20 Máquinas'}
                </button>
              )}
              <button 
                onClick={() => showMachineForm ? setShowMachineForm(false) : openNewMachineForm()}
                className="toggle-machine-form-btn"
              >
                {showMachineForm ? '✖ Cancelar' : '➕ Nueva Máquina'}
              </button>
            </div>
          </div>

          {showMachineForm && (
            <form onSubmit={handleMachineSubmit} className="machine-form">
              <div className="form-group">
                <label>Nombre de la máquina *</label>
                <input
                  type="text"
                  value={machineForm.name}
                  onChange={(e) => setMachineForm({ ...machineForm, name: e.target.value })}
                  placeholder="Ej: Press de banca"
                  required
                />
              </div>

              <div className="form-group">
                <label>Número de máquina *</label>
                <input
                  type="number"
                  min="1"
                  value={machineForm.number}
                  onChange={(e) => setMachineForm({ ...machineForm, number: e.target.value })}
                  placeholder="Ej: 1, 2, 3..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Categoría</label>
                {!showNewCategoryInput ? (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      value={machineForm.category || ''}
                      onChange={(e) => {
                        if (e.target.value === '__new__') {
                          setShowNewCategoryInput(true);
                          setMachineForm({ ...machineForm, category: '' });
                        } else {
                          setMachineForm({ ...machineForm, category: e.target.value });
                        }
                      }}
                      style={{ flex: 1, minWidth: '200px' }}
                    >
                      <option value="">-- Selecciona una categoría --</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                      <option value="__new__" style={{ fontWeight: 'bold', color: '#667eea' }}>
                        ➕ Crear nueva categoría
                      </option>
                    </select>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Nombre de la nueva categoría..."
                      style={{ flex: 1, minWidth: '200px' }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        border: 'none',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px'
                      }}
                    >
                      ✓ Crear
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewCategoryInput(false);
                        setNewCategoryName('');
                      }}
                      style={{
                        background: 'rgba(245, 87, 108, 0.2)',
                        border: '1px solid rgba(245, 87, 108, 0.5)',
                        color: '#f5576c',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px'
                      }}
                    >
                      ✖ Cancelar
                    </button>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Descripción (opcional)</label>
                <textarea
                  value={machineForm.description}
                  onChange={(e) => setMachineForm({ ...machineForm, description: e.target.value })}
                  placeholder="Descripción de la máquina..."
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Foto o Video (opcional)</label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleMachinePhotoChange}
                />
                {machineForm.photoPreview && (
                  <div style={{ position: 'relative', display: 'inline-block', marginTop: '10px' }}>
                    {machineForm.mediaType === 'video' ? (
                      <video 
                        src={machineForm.photoPreview} 
                        className="photo-preview"
                        controls
                        onClick={() => openMediaModal(machineForm.photoPreview, 'video', machineForm.name || 'Vista previa')}
                        style={{ cursor: 'pointer' }}
                        title="Click para ampliar"
                      />
                    ) : (
                      <img 
                        src={machineForm.photoPreview} 
                        alt="Preview" 
                        className="photo-preview"
                        onClick={() => openMediaModal(machineForm.photoPreview, 'image', machineForm.name || 'Vista previa')}
                        style={{ cursor: 'pointer' }}
                        title="Click para ampliar"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setMachineForm({ 
                        ...machineForm, 
                        photoFile: null, 
                        photoPreview: '', 
                        existingPhotoUrl: '',
                        mediaType: 'image'
                      })}
                      style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        background: 'rgba(245, 87, 108, 0.9)',
                        border: 'none',
                        color: 'white',
                        borderRadius: '50%',
                        width: '30px',
                        height: '30px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}
                      title="Eliminar medio"
                    >
                      ✖
                    </button>
                  </div>
                )}
              </div>

              <button type="submit" disabled={machineFormLoading} className="submit-machine-btn">
                {machineFormLoading ? (editingMachine ? 'Actualizando...' : 'Creando...') : (editingMachine ? '💾 Actualizar Máquina' : '💾 Crear Máquina Global')}
              </button>
              {editingMachine && (
                <button type="button" onClick={resetMachineForm} className="cancel-edit-btn">
                  ✖ Cancelar Edición
                </button>
              )}
            </form>
          )}

          {/* Sección de Gestión de Categorías */}
          <div className="category-management-section" style={{ 
            marginBottom: '30px',
            background: 'rgba(102, 126, 234, 0.1)',
            border: '1px solid rgba(102, 126, 234, 0.3)',
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            <button
              onClick={() => setShowCategoryManagement(!showCategoryManagement)}
              style={{
                width: '100%',
                padding: '15px 20px',
                background: 'transparent',
                border: 'none',
                color: '#667eea',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(102, 126, 234, 0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span>🏷️ Gestionar Categorías ({categories.length})</span>
              <span>{showCategoryManagement ? '▲' : '▼'}</span>
            </button>

            {showCategoryManagement && (
              <div style={{ padding: '20px', borderTop: '1px solid rgba(102, 126, 234, 0.2)' }}>
                
                {/* Botón para migrar categorías */}
                {categories.some(c => c.id.startsWith('temp-')) && (
                  <div style={{ 
                    marginBottom: '20px', 
                    padding: '15px',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '8px'
                  }}>
                    <p style={{ margin: '0 0 10px 0', color: '#fbbf24', fontSize: '14px' }}>
                      ⚠️ Hay categorías que solo existen en las máquinas. Se recomienda migrarlas a Firestore.
                    </p>
                    <button
                      onClick={migrateCategoriesFromMachines}
                      disabled={saving}
                      style={{
                        padding: '8px 16px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        border: 'none',
                        color: 'white',
                        borderRadius: '6px',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px'
                      }}
                    >
                      {saving ? '⏳ Migrando...' : '📤 Migrar Categorías a Firestore'}
                    </button>
                  </div>
                )}

                {/* Lista de categorías */}
                <div className="categories-list">
                  {categories.length === 0 ? (
                    <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
                      No hay categorías. Crea una máquina con categoría para comenzar.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {categories.map((category) => {
                        const machineCount = getCategoryMachineCount(category.name);
                        const isEditing = editingCategory?.id === category.id;
                        const isTemporary = category.id.startsWith('temp-');

                        return (
                          <div 
                            key={category.id} 
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 15px',
                              background: isTemporary 
                                ? 'rgba(245, 158, 11, 0.1)' 
                                : 'rgba(255, 255, 255, 0.05)',
                              border: isTemporary
                                ? '1px solid rgba(245, 158, 11, 0.3)'
                                : '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '8px',
                              gap: '10px',
                              flexWrap: 'wrap'
                            }}
                          >
                            {isEditing ? (
                              <>
                                <input
                                  type="text"
                                  value={editCategoryName}
                                  onChange={(e) => setEditCategoryName(e.target.value)}
                                  style={{
                                    flex: 1,
                                    minWidth: '200px',
                                    padding: '8px',
                                    borderRadius: '6px',
                                    border: '1px solid #444',
                                    background: '#2a2a2a',
                                    color: '#e0e0e0'
                                  }}
                                  autoFocus
                                />
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    onClick={saveEditCategory}
                                    disabled={saving}
                                    style={{
                                      padding: '8px 16px',
                                      background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
                                      border: 'none',
                                      color: 'white',
                                      borderRadius: '6px',
                                      cursor: saving ? 'not-allowed' : 'pointer',
                                      fontWeight: 'bold',
                                      fontSize: '14px'
                                    }}
                                  >
                                    {saving ? '⏳' : '✓ Guardar'}
                                  </button>
                                  <button
                                    onClick={cancelEditCategory}
                                    style={{
                                      padding: '8px 16px',
                                      background: '#444',
                                      border: 'none',
                                      color: 'white',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontWeight: 'bold',
                                      fontSize: '14px'
                                    }}
                                  >
                                    ✖ Cancelar
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                  <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '8px',
                                    flexWrap: 'wrap'
                                  }}>
                                    <span style={{ 
                                      color: '#e0e0e0', 
                                      fontWeight: 'bold',
                                      fontSize: '15px'
                                    }}>
                                      {category.name}
                                    </span>
                                    <span style={{ 
                                      color: '#999', 
                                      fontSize: '13px',
                                      background: 'rgba(255, 255, 255, 0.05)',
                                      padding: '2px 8px',
                                      borderRadius: '10px'
                                    }}>
                                      {machineCount} máquina{machineCount !== 1 ? 's' : ''}
                                    </span>
                                    {isTemporary && (
                                      <span style={{ 
                                        color: '#fbbf24', 
                                        fontSize: '12px',
                                        background: 'rgba(245, 158, 11, 0.2)',
                                        padding: '2px 8px',
                                        borderRadius: '10px'
                                      }}>
                                        ⚠️ No migrada
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    onClick={() => startEditCategory(category)}
                                    style={{
                                      padding: '6px 12px',
                                      background: 'rgba(102, 126, 234, 0.2)',
                                      border: '1px solid rgba(102, 126, 234, 0.4)',
                                      color: '#667eea',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontSize: '14px',
                                      fontWeight: 'bold'
                                    }}
                                    title="Editar categoría"
                                  >
                                    ✏️ Editar
                                  </button>
                                  <button
                                    onClick={() => deleteCategory(category)}
                                    style={{
                                      padding: '6px 12px',
                                      background: 'rgba(245, 87, 108, 0.2)',
                                      border: '1px solid rgba(245, 87, 108, 0.4)',
                                      color: '#f5576c',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontSize: '14px',
                                      fontWeight: 'bold'
                                    }}
                                    title="Eliminar categoría"
                                  >
                                    🗑️ Eliminar
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {machines.length > 0 && (
            <div className="category-filter" style={{ marginBottom: '20px' }}>
              <label htmlFor="admin-category-filter" style={{ marginRight: '10px', color: '#e0e0e0' }}>
                🏷️ Filtrar por categoría:
              </label>
              <select
                id="admin-category-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #444',
                  background: '#2a2a2a',
                  color: '#e0e0e0',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="Todas">📋 Todas ({machines.length})</option>
                {Array.from(new Set(machines.map(m => m.category).filter(Boolean))).sort().map(cat => {
                  const count = machines.filter(m => m.category === cat).length;
                  return <option key={cat} value={cat}>🏷️ {cat} ({count})</option>;
                })}
              </select>
            </div>
          )}

          <div className="machines-list">
            {machines
              .filter(machine => categoryFilter === 'Todas' || machine.category === categoryFilter)
              .map((machine) => (
              <div key={machine.id} className="machine-card">
                <div className="machine-info">
                  {machine.photoUrl && (
                    <img 
                      src={machine.photoUrl} 
                      alt={machine.name} 
                      className="machine-photo"
                      onClick={() => openMediaModal(machine.photoUrl || '', 'image', machine.name)}
                      style={{ cursor: 'pointer' }}
                      title="Click para ampliar"
                    />
                  )}
                  <div className="machine-details">
                    <span className="machine-name">
                      {machine.number ? `#${machine.number} - ` : ''}{machine.name}
                    </span>
                    {machine.category && (
                      <span className="machine-category">🏷️ {machine.category}</span>
                    )}
                    {machine.description && (
                      <span className="machine-description">{machine.description}</span>
                    )}
                    <span className="machine-type">{machine.isGlobal ? '🌐 Global' : '👤 Personal'}</span>
                  </div>
                </div>
                
                {machine.isGlobal && (
                  <div className="machine-actions">
                    <button 
                      onClick={() => startEditMachine(machine)}
                      className="edit-machine-btn"
                      title="Editar máquina"
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={() => setMachineToDelete(machine)}
                      className="delete-machine-btn"
                      title="Eliminar máquina"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Modal de confirmación para eliminar */}
          {machineToDelete && (
          <div className="modal-overlay">
            <div className="modal-content delete-modal">
              <h3>⚠️ Confirmar Eliminación</h3>
              
              {(machineToDelete as any).needsConfirmation && (
                <div className="delete-warning">
                  <div className="warning-content">
                    <p><strong>Esta máquina está siendo usada en {(machineToDelete as any).affectedTables} tabla(s) de usuarios.</strong></p>
                    <p>Si procedes con la eliminación:</p>
                    <ul>
                      <li>La máquina <strong>"{machineToDelete.name}"</strong> será eliminada permanentemente</li>
                      <li>Los ejercicios con esta máquina serán removidos de todas las tablas de usuarios</li>
                      <li>Los usuarios afectados perderán esos ejercicios de sus rutinas actuales</li>
                    </ul>
                    <p>¿Estás seguro de que quieres continuar?</p>
                  </div>
                </div>
              )}
              
              {!(machineToDelete as any).needsConfirmation && (
                <>
                  <p>¿Estás seguro de que quieres eliminar la máquina <strong>"{machineToDelete.name}"</strong>?</p>
                  <p className="warning-text">Esta acción no se puede deshacer.</p>
                </>
              )}
              
              <div className="modal-actions">
                <button 
                  onClick={() => setMachineToDelete(null)}
                  className="cancel-btn"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => deleteMachine(machineToDelete, true)}
                  className="confirm-delete-btn"
                >
                  {(machineToDelete as any).needsConfirmation ? '⚠️ Confirmar Eliminación' : '🗑️ Eliminar'}
                </button>
              </div>
            </div>
          </div>
          )}
        </div>
        </>
        )}

        {/* Sección de Gestión de Ejercicios */}
        {activeTab === 'ejercicios' && (
        <>
          {/* Título de la página */}
          <div style={{ 
            marginBottom: '30px',
            padding: '20px',
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
            borderRadius: '15px',
            border: '2px solid rgba(102, 126, 234, 0.3)'
          }}>
            <h2 style={{ 
              margin: '0',
              color: '#667eea',
              fontSize: '28px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              💪 Gestión de Ejercicios
            </h2>
            <p style={{ 
              margin: '8px 0 0 0',
              color: '#b0b0b0',
              fontSize: '14px'
            }}>
              Crea y gestiona ejercicios específicos para cada máquina del gimnasio
            </p>
          </div>
          
          <div className="machines-section">
          <div className="machines-header">
            <h2 style={{ display: 'none' }}>💪 Gestión de Ejercicios</h2>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                onClick={() => showExerciseForm ? setShowExerciseForm(false) : openNewExerciseForm()}
                className="toggle-machine-form-btn"
              >
                {showExerciseForm ? '✖ Cancelar' : '➕ Nuevo Ejercicio'}
              </button>
            </div>
          </div>

          {showExerciseForm && (
            <form onSubmit={handleExerciseSubmit} className="machine-form">
              <div className="form-group">
                <label>Nombre del ejercicio *</label>
                <input
                  type="text"
                  value={exerciseForm.name}
                  onChange={(e) => setExerciseForm({ ...exerciseForm, name: e.target.value })}
                  placeholder="Ej: Press de banca con barra"
                  required
                />
              </div>

              <div className="form-group">
                <label>Filtrar máquinas por categoría</label>
                <select
                  value={categoryFilterExerciseForm}
                  onChange={(e) => {
                    setCategoryFilterExerciseForm(e.target.value);
                    // Limpiar la máquina seleccionada si no está en la nueva categoría
                    if (e.target.value !== 'Todas' && exerciseForm.machineId) {
                      const selectedMachine = machines.find(m => m.id === exerciseForm.machineId);
                      if (selectedMachine && selectedMachine.category !== e.target.value) {
                        setExerciseForm({ ...exerciseForm, machineId: '', machineName: '' });
                      }
                    }
                  }}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #444',
                    background: '#2a2a2a',
                    color: '#e0e0e0',
                    fontSize: '14px'
                  }}
                >
                  <option value="Todas">📋 Todas las categorías</option>
                  {Array.from(new Set(machines.map(m => m.category).filter(Boolean))).sort().map(cat => (
                    <option key={cat} value={cat}>
                      🏷️ {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Máquina *</label>
                <select
                  value={exerciseForm.machineId}
                  onChange={(e) => {
                    const machine = machines.find(m => m.id === e.target.value);
                    setExerciseForm({ 
                      ...exerciseForm, 
                      machineId: e.target.value,
                      machineName: machine?.name || ''
                    });
                  }}
                  required
                >
                  <option value="">-- Selecciona una máquina --</option>
                  {machines
                    .filter(machine => 
                      categoryFilterExerciseForm === 'Todas' || machine.category === categoryFilterExerciseForm
                    )
                    .map((machine) => (
                      <option key={machine.id} value={machine.id}>
                        {machine.number ? `#${machine.number} - ` : ''}{machine.name}
                        {machine.category ? ` (${machine.category})` : ''}
                      </option>
                    ))}
                </select>
                {categoryFilterExerciseForm !== 'Todas' && (
                  <small style={{ color: '#999', display: 'block', marginTop: '5px' }}>
                    Mostrando solo máquinas de la categoría: <strong>{categoryFilterExerciseForm}</strong>
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  value={exerciseForm.description}
                  onChange={(e) => setExerciseForm({ ...exerciseForm, description: e.target.value })}
                  placeholder="Descripción del ejercicio, técnica, músculos trabajados..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #444',
                    background: '#2a2a2a',
                    color: '#e0e0e0',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div className="form-group">
                <label>Foto o Video del ejercicio</label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleExercisePhotoChange}
                />
                {exerciseForm.photoPreview && (
                  <div style={{ position: 'relative', display: 'inline-block', marginTop: '10px' }}>
                    {exerciseForm.mediaType === 'video' ? (
                      <video 
                        src={exerciseForm.photoPreview} 
                        className="photo-preview"
                        controls
                        onClick={() => openMediaModal(exerciseForm.photoPreview, 'video', exerciseForm.name || 'Vista previa')}
                        style={{ cursor: 'pointer' }}
                        title="Click para ampliar"
                      />
                    ) : (
                      <img 
                        src={exerciseForm.photoPreview} 
                        alt="Preview" 
                        className="photo-preview"
                        onClick={() => openMediaModal(exerciseForm.photoPreview, 'image', exerciseForm.name || 'Vista previa')}
                        style={{ cursor: 'pointer' }}
                        title="Click para ampliar"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setExerciseForm({ 
                        ...exerciseForm, 
                        photoFile: null, 
                        photoPreview: '', 
                        existingPhotoUrl: '',
                        mediaType: 'image'
                      })}
                      style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        background: 'rgba(245, 87, 108, 0.9)',
                        border: 'none',
                        color: 'white',
                        borderRadius: '50%',
                        width: '30px',
                        height: '30px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <button type="submit" disabled={exerciseFormLoading} className="submit-machine-btn">
                {exerciseFormLoading ? (editingExercise ? 'Actualizando...' : 'Creando...') : (editingExercise ? '💾 Actualizar Ejercicio' : '💾 Crear Ejercicio')}
              </button>
              {editingExercise && (
                <button type="button" onClick={resetExerciseForm} className="cancel-edit-btn">
                  ✖ Cancelar Edición
                </button>
              )}
            </form>
          )}

          {/* Filtro por máquina */}
          {allExercises.length > 0 && (
            <div className="category-filter" style={{ marginBottom: '20px' }}>
              <label htmlFor="machine-filter-exercises" style={{ marginRight: '10px', color: '#e0e0e0' }}>
                🏋️ Filtrar por máquina:
              </label>
              <select
                id="machine-filter-exercises"
                value={machineFilterExercises}
                onChange={(e) => setMachineFilterExercises(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #444',
                  background: '#2a2a2a',
                  color: '#e0e0e0',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="Todas">📋 Todas las máquinas ({allExercises.length} ejercicios)</option>
                {machines.map(machine => {
                  const count = getExercisesByMachine(machine.id).length;
                  if (count === 0) return null;
                  return (
                    <option key={machine.id} value={machine.id}>
                      {machine.number ? `#${machine.number} - ` : ''}{machine.name} ({count} ejercicio{count !== 1 ? 's' : ''})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Lista de ejercicios */}
          <div className="machines-list">
            {allExercises.length === 0 ? (
              <div style={{ 
                gridColumn: '1 / -1', 
                textAlign: 'center', 
                padding: '40px', 
                color: '#999' 
              }}>
                <p>No hay ejercicios creados aún.</p>
                <p>Crea el primer ejercicio para comenzar.</p>
              </div>
            ) : (
              allExercises
                .filter(exercise => 
                  machineFilterExercises === 'Todas' || exercise.machineId === machineFilterExercises
                )
                .map((exercise) => (
                  <div key={exercise.id} className="machine-card">
                    <div className="machine-info">
                      {exercise.photoUrl && (
                        exercise.mediaType === 'video' ? (
                          <video
                            src={exercise.photoUrl}
                            className="machine-photo"
                            onClick={() => openMediaModal(exercise.photoUrl || '', 'video', exercise.name)}
                            style={{ cursor: 'pointer' }}
                            title="Click para ampliar"
                          />
                        ) : (
                          <img 
                            src={exercise.photoUrl} 
                            alt={exercise.name} 
                            className="machine-photo"
                            onClick={() => openMediaModal(exercise.photoUrl || '', 'image', exercise.name)}
                            style={{ cursor: 'pointer' }}
                            title="Click para ampliar"
                          />
                        )
                      )}
                      <div className="machine-details">
                        <span className="machine-name">{exercise.name}</span>
                        <span className="machine-category">
                          🏋️ {exercise.machineName}
                        </span>
                        {exercise.description && (
                          <span className="machine-description">{exercise.description}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="machine-actions">
                      <button 
                        onClick={() => startEditExercise(exercise)}
                        className="edit-machine-btn"
                        title="Editar ejercicio"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => setExerciseToDelete(exercise)}
                        className="delete-machine-btn"
                        title="Eliminar ejercicio"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* Modal de confirmación para eliminar ejercicio */}
          {exerciseToDelete && (
          <div className="modal-overlay">
            <div className="modal-content delete-modal">
              <h3>⚠️ Confirmar Eliminación</h3>
              
              {(exerciseToDelete as any).needsConfirmation && (
                <div className="delete-warning">
                  <div className="warning-content">
                    <p><strong>Este ejercicio está siendo usado en {(exerciseToDelete as any).affectedTables} tabla(s) de usuarios.</strong></p>
                    <p>Si procedes con la eliminación:</p>
                    <ul>
                      <li>El ejercicio <strong>"{exerciseToDelete.name}"</strong> será eliminado permanentemente</li>
                      <li>Será removido de todas las tablas de usuarios</li>
                      <li>Los usuarios afectados perderán este ejercicio de sus rutinas actuales</li>
                    </ul>
                    <p>¿Estás seguro de que quieres continuar?</p>
                  </div>
                </div>
              )}
              
              {!(exerciseToDelete as any).needsConfirmation && (
                <>
                  <p>¿Estás seguro de que quieres eliminar el ejercicio <strong>"{exerciseToDelete.name}"</strong>?</p>
                  <p className="warning-text">Esta acción no se puede deshacer.</p>
                </>
              )}
              
              <div className="modal-actions">
                <button 
                  onClick={() => setExerciseToDelete(null)}
                  className="cancel-btn"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => deleteExercise(exerciseToDelete, true)}
                  className="confirm-delete-btn"
                >
                  {(exerciseToDelete as any).needsConfirmation ? '⚠️ Confirmar Eliminación' : '🗑️ Eliminar'}
                </button>
              </div>
            </div>
          </div>
          )}
        </div>
        </>
        )}

        {/* Sección de asignación de tablas (mostrar solo si activeTab === 'tablas') */}
        {activeTab === 'tablas' && (
        <>
          {/* Título de la página */}
          <div style={{ 
            marginBottom: '30px',
            padding: '20px',
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
            borderRadius: '15px',
            border: '2px solid rgba(102, 126, 234, 0.3)'
          }}>
            <h2 style={{ 
              margin: '0',
              color: '#667eea',
              fontSize: '28px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              📋 Gestión de Tablas de Entrenamiento
            </h2>
            <p style={{ 
              margin: '8px 0 0 0',
              color: '#b0b0b0',
              fontSize: '14px'
            }}>
              Asigna y gestiona las rutinas de entrenamiento de cada usuario
            </p>
          </div>

          <div className="user-selector-section">
            <h3>Seleccionar Usuario</h3>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="user-select"
            >
              <option value="">-- Selecciona un usuario --</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </select>
          </div>

          {selectedUserId && (
          <>
            <div className="exercises-builder-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>Tabla de {selectedUser?.firstName} {selectedUser?.lastName}</h3>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {currentTableDate && (
                    <div style={{ 
                      color: '#b0b0b0', 
                      fontSize: '14px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: '8px 15px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      📅 Última modificación: {currentTableDate.toLocaleDateString('es-ES', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  )}
                  {exercises.length > 0 && (
                    <button
                      onClick={completeUserTable}
                      disabled={saving}
                      style={{
                        padding: '8px 16px',
                        background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
                        border: 'none',
                        color: 'white',
                        borderRadius: '6px',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      ✓ Marcar Completada
                    </button>
                  )}
                </div>
              </div>

              <div className="current-exercises-table">
                {exercises.length === 0 ? (
                  <p className="no-exercises">No hay ejercicios asignados. Agrega ejercicios abajo.</p>
                ) : (
                  <table className="exercises-table">
                    <thead>
                      <tr>
                        <th className="col-machine">Máquina</th>
                        <th className="col-compact">S</th>
                        <th className="col-compact">R</th>
                        <th className="col-compact">P</th>
                        <th className="col-delete"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {exercises.map((exercise, index) => (
                        <tr key={index}>
                          <td className="col-machine">
                            <div className="machine-cell">
                              {(exercise.exercisePhotoUrl || exercise.machinePhotoUrl) && (
                                <img 
                                  src={exercise.exercisePhotoUrl || exercise.machinePhotoUrl} 
                                  alt={exercise.exerciseName || exercise.machineName} 
                                  className="machine-thumb"
                                />
                              )}
                              <div className="machine-info">
                                <strong>{exercise.machineName}</strong>
                                {exercise.exerciseName && (
                                  <div style={{ color: '#667eea', fontSize: '13px', marginTop: '2px' }}>
                                    💪 {exercise.exerciseName}
                                  </div>
                                )}
                                {exercise.notes && <div className="exercise-note">"{exercise.notes}"</div>}
                              </div>
                            </div>
                          </td>
                          <td className="col-compact">{exercise.series}</td>
                          <td className="col-compact">{exercise.reps}</td>
                          <td className="col-compact" style={{ color: exercise.weight ? '#fff' : '#888' }}>
                            {exercise.weight || '-'}
                          </td>
                          <td className="col-delete">
                            <button 
                              onClick={() => removeExercise(index)} 
                              className="remove-exercise-btn"
                            >
                              ❌
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="add-exercise-section">
                <h4>Agregar Ejercicio</h4>
                
                <div className="form-group">
                  <label>🏷️ Filtrar por Categoría</label>
                  <select
                    value={categoryFilterTableAssignment}
                    onChange={(e) => {
                      setCategoryFilterTableAssignment(e.target.value);
                      // Reset machine selection when category changes
                      setNewExercise({ 
                        ...newExercise, 
                        machineId: '',
                        machineName: '',
                        machinePhotoUrl: '',
                        exerciseId: '',
                        exerciseName: '',
                        exercisePhotoUrl: ''
                      });
                    }}
                    style={{
                      background: 'rgba(102, 126, 234, 0.1)',
                      borderColor: 'rgba(102, 126, 234, 0.3)',
                      color: '#667eea',
                      fontWeight: 'bold'
                    }}
                  >
                    <option value="Todas">📋 Todas las categorías</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name} ({machines.filter(m => m.category === cat.name).length})
                      </option>
                    ))}
                  </select>
                  {categoryFilterTableAssignment !== 'Todas' && (
                    <small style={{ color: '#667eea', display: 'block', marginTop: '5px' }}>
                      ✓ Mostrando solo máquinas de: <strong>{categoryFilterTableAssignment}</strong>
                    </small>
                  )}
                </div>
                
                <div className="form-group">
                  <label>Máquina</label>
                  <select
                    value={newExercise.machineId}
                    onChange={(e) => {
                      const machine = machines.find(m => m.id === e.target.value);
                      setNewExercise({ 
                        ...newExercise, 
                        machineId: e.target.value,
                        machineName: machine?.name || '',
                        machinePhotoUrl: machine?.photoUrl || '',
                        exerciseId: '',
                        exerciseName: '',
                        exercisePhotoUrl: ''
                      });
                    }}
                  >
                    <option value="">-- Selecciona una máquina --</option>
                    {machines
                      .filter(machine => 
                        categoryFilterTableAssignment === 'Todas' || 
                        machine.category === categoryFilterTableAssignment
                      )
                      .sort((a, b) => (a.number || 999) - (b.number || 999))
                      .map((machine) => (
                        <option key={machine.id} value={machine.id}>
                          {machine.number ? `#${machine.number} - ` : ''}{machine.name}
                          {machine.category ? ` (${machine.category})` : ''}
                        </option>
                      ))}
                  </select>
                  {categoryFilterTableAssignment !== 'Todas' && 
                   machines.filter(m => categoryFilterTableAssignment === 'Todas' || m.category === categoryFilterTableAssignment).length === 0 && (
                    <small style={{ color: '#ff9800', display: 'block', marginTop: '5px' }}>
                      ⚠️ No hay máquinas en esta categoría
                    </small>
                  )}
                </div>

                {newExercise.machineId && (
                  <div className="form-group">
                    <label>Ejercicio (opcional)</label>
                    <select
                      value={newExercise.exerciseId || ''}
                      onChange={(e) => {
                        const exercise = allExercises.find(ex => ex.id === e.target.value);
                        setNewExercise({ 
                          ...newExercise, 
                          exerciseId: e.target.value,
                          exerciseName: exercise?.name || '',
                          exercisePhotoUrl: exercise?.photoUrl || ''
                        });
                      }}
                    >
                      <option value="">-- Ejercicio general de la máquina --</option>
                      {getExercisesByMachine(newExercise.machineId).map((exercise) => (
                        <option key={exercise.id} value={exercise.id}>
                          {exercise.name}
                        </option>
                      ))}
                    </select>
                    {getExercisesByMachine(newExercise.machineId).length === 0 && (
                      <small style={{ color: '#999', display: 'block', marginTop: '5px' }}>
                        💡 No hay ejercicios específicos para esta máquina. 
                        Puedes crearlos en la sección "Gestión de Ejercicios".
                      </small>
                    )}
                  </div>
                )}

                <div className="metrics-row">
                  <div className="form-group">
                    <label>Series</label>
                    <input
                      type="number"
                      min="1"
                      value={newExercise.series}
                      onChange={(e) => setNewExercise({ ...newExercise, series: parseInt(e.target.value) || 1 })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Repeticiones</label>
                    <input
                      type="number"
                      min="1"
                      value={newExercise.reps}
                      onChange={(e) => setNewExercise({ ...newExercise, reps: parseInt(e.target.value) || 1 })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Peso (kg)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="0"
                      value={newExercise.weight || ''}
                      onChange={(e) => setNewExercise({ ...newExercise, weight: e.target.value ? parseFloat(e.target.value) : undefined })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Notas (opcional)</label>
                  <textarea
                    value={newExercise.notes}
                    onChange={(e) => setNewExercise({ ...newExercise, notes: e.target.value })}
                    placeholder="Ej: Mantener la espalda recta, controlar el movimiento..."
                    rows={3}
                  />
                </div>

                <button onClick={addExercise} className="add-exercise-btn">
                  ➕ Agregar a la tabla
                </button>
              </div>
            </div>

            <div className="save-section">
              <button 
                onClick={saveTable} 
                disabled={saving || exercises.length === 0}
                className="save-table-btn"
              >
                {saving ? '⏳ Guardando...' : '💾 Guardar Tabla'}
              </button>
            </div>
          </>
          )}
        </>
        )}
      </div>

      {/* Modal de visualización de medios */}
      {mediaModal.show && (
        <div className="media-modal" onClick={closeMediaModal}>
          <div className="media-viewer" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal-btn" onClick={closeMediaModal} title="Cerrar">
              ✖
            </button>
            <h3 style={{ color: 'white', marginBottom: '20px', textAlign: 'center' }}>{mediaModal.title}</h3>
            {mediaModal.type === 'video' ? (
              <video src={mediaModal.url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '80vh' }} />
            ) : (
              <img src={mediaModal.url} alt={mediaModal.title} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
            )}
          </div>
        </div>
      )}

      {/* Modal de configuración de email */}
      {showEmailConfigModal && (
        <div className="modal-overlay" onClick={() => setShowEmailConfigModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>📧 Configurar Credenciales de Email</h3>
            <p style={{ color: '#999', fontSize: '14px', marginBottom: '20px' }}>
              Configura las credenciales para el envío de notificaciones por email.
            </p>

            <div className="form-group">
              <label>Email de Gmail</label>
              <input
                type="email"
                placeholder="ejemplo@gmail.com"
                value={emailConfig.email}
                onChange={(e) => setEmailConfig({ ...emailConfig, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Contraseña de Aplicación de Gmail</label>
              <input
                type="password"
                placeholder="Contraseña de 16 caracteres"
                value={emailConfig.password}
                onChange={(e) => setEmailConfig({ ...emailConfig, password: e.target.value })}
              />
              <small style={{ color: '#999', display: 'block', marginTop: '8px' }}>
                ⚠️ Usa una contraseña de aplicación de Gmail, no tu contraseña normal.<br/>
                Cómo obtenerla: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" style={{ color: '#667eea' }}>Google App Passwords</a>
              </small>
            </div>

            <div className="modal-actions">
              <button 
                onClick={handleUpdateEmailConfig} 
                className="primary-button"
                disabled={updatingEmailConfig}
              >
                {updatingEmailConfig ? '⏳ Guardando...' : '💾 Guardar Configuración'}
              </button>
              <button 
                onClick={() => setShowEmailConfigModal(false)} 
                className="secondary-button"
                disabled={updatingEmailConfig}
              >
                Cancelar
              </button>
            </div>

            <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(255, 193, 7, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 193, 7, 0.3)' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#ffc107' }}>
                ⚠️ <strong>IMPORTANTE:</strong> Después de guardar, deberás ejecutar comandos en la terminal para actualizar los secrets de Firebase. Se te mostrarán las instrucciones.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sección de Reproductor de Entrenamientos */}
      {activeTab === 'reproductor' && (
        <div className="reproductor-section">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '30px'
          }}>
            <h2 style={{ margin: 0, color: '#e0e0e0', display: 'flex', alignItems: 'center', gap: '12px' }}>
              🎬 Reproductor de Entrenamientos
            </h2>
            <button
              onClick={() => setShowCastModal(true)}
              style={{
                padding: '12px 20px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '10px',
                color: 'white',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
              }}
            >
              📺 Enviar a TV/Proyector
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            height: 'calc(100vh - 300px)'
          }}>
            {/* Panel Izquierdo - Lista de Reproducción */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              padding: '20px',
              border: '2px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#51cf66', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📋 Lista de Reproducción ({playlist.length})
              </h3>
              
              {/* Área de drop */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.background = 'rgba(81, 207, 102, 0.2)';
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  if (draggedExercise) {
                    setPlaylist([...playlist, draggedExercise]);
                    setDraggedExercise(null);
                  }
                }}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px',
                  border: '2px dashed rgba(255, 255, 255, 0.2)',
                  padding: '15px',
                  overflowY: 'auto',
                  transition: 'all 0.3s ease',
                  minHeight: '300px'
                }}
              >
                {playlist.length === 0 ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: '#999',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '15px' }}>🎯</div>
                    <p style={{ margin: 0, fontSize: '16px' }}>
                      Arrastra ejercicios aquí para crear tu lista de reproducción
                    </p>
                  </div>
                ) : (
                  playlist.map((exercise, index) => (
                    <div
                      key={`${exercise.id}-${index}`}
                      style={{
                        background: currentExerciseIndex === index 
                          ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)'
                          : 'rgba(255, 255, 255, 0.05)',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '10px',
                        border: currentExerciseIndex === index 
                          ? '2px solid #667eea' 
                          : '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => {
                        setCurrentExerciseIndex(index);
                        setIsPlaying(false);
                      }}
                    >
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontWeight: 'bold',
                        color: '#667eea',
                        minWidth: '40px',
                        textAlign: 'center'
                      }}>
                        {index + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#e0e0e0', fontWeight: 'bold', fontSize: '14px' }}>
                          {exercise.name}
                        </div>
                        <div style={{ color: '#999', fontSize: '12px' }}>
                          {exercise.machineName}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlaylist(playlist.filter((_, i) => i !== index));
                          if (currentExerciseIndex === index) {
                            setCurrentExerciseIndex(null);
                          } else if (currentExerciseIndex !== null && currentExerciseIndex > index) {
                            setCurrentExerciseIndex(currentExerciseIndex - 1);
                          }
                        }}
                        style={{
                          background: 'rgba(245, 87, 108, 0.2)',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#f5576c',
                          padding: '6px 10px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(245, 87, 108, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(245, 87, 108, 0.2)';
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Controles de reproducción */}
              <div style={{
                marginTop: '15px',
                padding: '15px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '15px'
                }}>
                  <button
                    onClick={() => {
                      if (currentExerciseIndex !== null && currentExerciseIndex > 0) {
                        setCurrentExerciseIndex(currentExerciseIndex - 1);
                        setIsPlaying(false);
                      }
                    }}
                    disabled={currentExerciseIndex === null || currentExerciseIndex === 0}
                    style={{
                      background: currentExerciseIndex !== null && currentExerciseIndex > 0 
                        ? 'rgba(255, 255, 255, 0.1)' 
                        : 'rgba(255, 255, 255, 0.03)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '50px',
                      height: '50px',
                      color: currentExerciseIndex !== null && currentExerciseIndex > 0 
                        ? '#e0e0e0' 
                        : '#555',
                      fontSize: '20px',
                      cursor: currentExerciseIndex !== null && currentExerciseIndex > 0 
                        ? 'pointer' 
                        : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (currentExerciseIndex !== null && currentExerciseIndex > 0) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = currentExerciseIndex !== null && currentExerciseIndex > 0 
                        ? 'rgba(255, 255, 255, 0.1)' 
                        : 'rgba(255, 255, 255, 0.03)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    ⏮
                  </button>

                  <button
                    onClick={() => {
                      if (playlist.length > 0) {
                        if (currentExerciseIndex === null) {
                          setCurrentExerciseIndex(0);
                        }
                        setIsPlaying(!isPlaying);
                      }
                    }}
                    disabled={playlist.length === 0}
                    style={{
                      background: playlist.length > 0 
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                        : 'rgba(255, 255, 255, 0.03)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '70px',
                      height: '70px',
                      color: 'white',
                      fontSize: '28px',
                      cursor: playlist.length > 0 ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      boxShadow: playlist.length > 0 ? '0 4px 12px rgba(102, 126, 234, 0.4)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (playlist.length > 0) {
                        e.currentTarget.style.transform = 'scale(1.1)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = playlist.length > 0 
                        ? '0 4px 12px rgba(102, 126, 234, 0.4)' 
                        : 'none';
                    }}
                  >
                    {isPlaying ? '⏸' : '▶'}
                  </button>

                  <button
                    onClick={() => {
                      if (currentExerciseIndex !== null && currentExerciseIndex < playlist.length - 1) {
                        setCurrentExerciseIndex(currentExerciseIndex + 1);
                        setIsPlaying(false);
                      }
                    }}
                    disabled={currentExerciseIndex === null || currentExerciseIndex === playlist.length - 1}
                    style={{
                      background: currentExerciseIndex !== null && currentExerciseIndex < playlist.length - 1 
                        ? 'rgba(255, 255, 255, 0.1)' 
                        : 'rgba(255, 255, 255, 0.03)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '50px',
                      height: '50px',
                      color: currentExerciseIndex !== null && currentExerciseIndex < playlist.length - 1 
                        ? '#e0e0e0' 
                        : '#555',
                      fontSize: '20px',
                      cursor: currentExerciseIndex !== null && currentExerciseIndex < playlist.length - 1 
                        ? 'pointer' 
                        : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (currentExerciseIndex !== null && currentExerciseIndex < playlist.length - 1) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = currentExerciseIndex !== null && currentExerciseIndex < playlist.length - 1 
                        ? 'rgba(255, 255, 255, 0.1)' 
                        : 'rgba(255, 255, 255, 0.03)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    ⏭
                  </button>
                </div>

                {currentExerciseIndex !== null && playlist[currentExerciseIndex] && (
                  <div style={{
                    marginTop: '15px',
                    textAlign: 'center',
                    color: '#e0e0e0',
                    fontSize: '14px'
                  }}>
                    <div style={{ fontWeight: 'bold' }}>
                      {playlist[currentExerciseIndex].name}
                    </div>
                    <div style={{ color: '#999', fontSize: '12px', marginTop: '5px' }}>
                      {currentExerciseIndex + 1} de {playlist.length}
                    </div>
                  </div>
                )}
              </div>

              {playlist.length > 0 && (
                <button
                  onClick={() => {
                    setPlaylist([]);
                    setCurrentExerciseIndex(null);
                    setIsPlaying(false);
                  }}
                  style={{
                    marginTop: '10px',
                    padding: '10px',
                    background: 'rgba(245, 87, 108, 0.2)',
                    border: '1px solid rgba(245, 87, 108, 0.3)',
                    borderRadius: '8px',
                    color: '#f5576c',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(245, 87, 108, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(245, 87, 108, 0.2)';
                  }}
                >
                  🗑️ Limpiar Lista
                </button>
              )}
            </div>

            {/* Panel Derecho - Base de Datos de Ejercicios */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              padding: '20px',
              border: '2px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#667eea', display: 'flex', alignItems: 'center', gap: '8px' }}>
                💪 Base de Datos de Ejercicios
              </h3>

              {/* Buscador */}
              <input
                type="text"
                placeholder="🔍 Buscar ejercicio..."
                value={exerciseSearchQuery}
                onChange={(e) => setExerciseSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 15px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#e0e0e0',
                  fontSize: '14px',
                  marginBottom: '15px',
                  boxSizing: 'border-box'
                }}
              />

              {/* Lista de ejercicios */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '15px',
                alignContent: 'start'
              }}>
                {allExercises
                  .filter(ex => 
                    ex.name.toLowerCase().includes(exerciseSearchQuery.toLowerCase()) ||
                    ex.machineName.toLowerCase().includes(exerciseSearchQuery.toLowerCase())
                  )
                  .map((exercise) => (
                    <div
                      key={exercise.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedExercise(exercise);
                        e.currentTarget.style.opacity = '0.5';
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        cursor: 'grab',
                        border: '2px solid rgba(255, 255, 255, 0.1)',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.borderColor = '#667eea';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{
                        width: '100%',
                        height: '120px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                      }}>
                        {exercise.photoUrl ? (
                          exercise.mediaType === 'video' ? (
                            <video 
                              src={exercise.photoUrl} 
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              muted
                            />
                          ) : (
                            <img 
                              src={exercise.photoUrl} 
                              alt={exercise.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          )
                        ) : (
                          <span style={{ fontSize: '40px' }}>💪</span>
                        )}
                      </div>
                      <div style={{ padding: '10px' }}>
                        <div style={{
                          color: '#e0e0e0',
                          fontWeight: 'bold',
                          fontSize: '13px',
                          marginBottom: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {exercise.name}
                        </div>
                        <div style={{
                          color: '#999',
                          fontSize: '11px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {exercise.machineName}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cast a TV/Proyector */}
      {showCastModal && (
        <div className="modal-overlay" onClick={() => setShowCastModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px 0', color: '#667eea', display: 'flex', alignItems: 'center', gap: '10px' }}>
              📺 Enviar a TV/Proyector
            </h3>
            
            <div style={{
              background: 'rgba(102, 126, 234, 0.1)',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid rgba(102, 126, 234, 0.3)',
              marginBottom: '20px'
            }}>
              <p style={{ color: '#667eea', margin: '0 0 15px 0', fontSize: '14px', lineHeight: '1.6' }}>
                📡 <strong>Función de Cast WiFi</strong>
              </p>
              <p style={{ color: '#999', margin: 0, fontSize: '13px', lineHeight: '1.6' }}>
                Esta función te permitirá enviar la reproducción de entrenamientos a una TV o proyector compatible con WiFi Display (Miracast, Chromecast, AirPlay, etc.).
              </p>
            </div>

            <div style={{
              background: 'rgba(255, 193, 7, 0.1)',
              padding: '15px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 193, 7, 0.3)',
              marginBottom: '20px'
            }}>
              <p style={{ color: '#ffc107', margin: 0, fontSize: '13px', lineHeight: '1.6' }}>
                ⚠️ <strong>En desarrollo:</strong> La función de Cast WiFi requiere integración con Web Presentation API o APIs específicas de dispositivos (Chromecast SDK, AirPlay API). Por ahora, puedes usar el modo pantalla completa del navegador y compartir la pantalla manualmente.
              </p>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => {
                  // Intentar entrar en modo pantalla completa
                  if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen();
                  }
                  setShowCastModal(false);
                }}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                🖥️ Pantalla Completa
              </button>
              <button
                onClick={() => setShowCastModal(false)}
                style={{
                  padding: '12px 24px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#e0e0e0',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
