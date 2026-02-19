import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, setDoc, addDoc, serverTimestamp, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { auth, db, storage, functions } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject, uploadBytesResumable } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import './AdminPanel.css';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: 'usuario' | 'coach';
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
  category: string | null;
  categoryName?: string;
  description?: string;
  photoUrl?: string;
  mediaType?: 'image' | 'video';
  createdAt?: any;
}

interface AssignedExercise {
  categoryId: string;
  categoryName: string;
  exerciseId?: string;
  exerciseName?: string;
  exercisePhotoUrl?: string;
  mediaType?: 'image' | 'video';
  series: number;
  reps: number;
  weight?: number;
  notes: string;
}

interface AssignedTableData {
  id?: string;
  userId: string;
  exercises: {
    day1: AssignedExercise[];
    day2: AssignedExercise[];
    day3: AssignedExercise[];
    day4: AssignedExercise[];
    day5: AssignedExercise[];
    day6: AssignedExercise[];
    day7: AssignedExercise[];
  };
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

interface AdminPanelProps {
  user: FirebaseUser | null;
  userRole: 'admin' | 'coach' | 'usuario';
}

const AdminPanel: React.FC<AdminPanelProps> = ({ user, userRole }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [exercises, setExercises] = useState<{
    day1: AssignedExercise[];
    day2: AssignedExercise[];
    day3: AssignedExercise[];
    day4: AssignedExercise[];
    day5: AssignedExercise[];
    day6: AssignedExercise[];
    day7: AssignedExercise[];
  }>({
    day1: [],
    day2: [],
    day3: [],
    day4: [],
    day5: [],
    day6: [],
    day7: []
  });
  const [selectedDay, setSelectedDay] = useState<'day1' | 'day2' | 'day3' | 'day4' | 'day5' | 'day6' | 'day7'>('day1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Formulario para nuevo ejercicio
  const [newExercise, setNewExercise] = useState<AssignedExercise>({
    categoryId: '',
    categoryName: '',
    exerciseId: '',
    exerciseName: '',
    exercisePhotoUrl: '',
    mediaType: 'image',
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
  const [currentTableDate, setCurrentTableDate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'tablas' | 'ejercicios' | 'usuarios' | 'reproductor' | null>(null);
  
  // Estados para gestión de usuarios
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '000000',
    role: 'usuario' as 'usuario' | 'coach'
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
  const [draggedExercise, setDraggedExercise] = useState<Exercise | null>(null);
  const [draggedPlaylistIndex, setDraggedPlaylistIndex] = useState<number | null>(null);
  
  // Estados para gestión de ejercicios
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [exerciseForm, setExerciseForm] = useState({
    id: '',
    name: '',
    category: '',
    description: '',
    photoFile: null as File | null,
    photoPreview: '',
    existingPhotoUrl: '',
    mediaType: 'image' as 'image' | 'video'
  });
  const [exerciseFormLoading, setExerciseFormLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [exerciseToDelete, setExerciseToDelete] = useState<Exercise | null>(null);
  const [categoryFilterExercises, setCategoryFilterExercises] = useState<string>('Todas');
  const [tableCategoryFilter, setTableCategoryFilter] = useState<string>('Todas');
  const [tableExerciseSearch, setTableExerciseSearch] = useState<string>('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryFormName, setCategoryFormName] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showEmailConfigModal, setShowEmailConfigModal] = useState(false);
  const [emailConfig, setEmailConfig] = useState({
    notificationsEmail: 'inaviciba@gmail.com'
  });
  const [updatingEmailConfig, setUpdatingEmailConfig] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    if (selectedUserId) {
      loadUserTable(selectedUserId);
    } else {
      setExercises({
        day1: [],
        day2: [],
        day3: [],
        day4: [],
        day5: [],
        day6: [],
        day7: []
      });
      setSelectedDay('day1');
      setCurrentTableDate(null);
    }
  }, [selectedUserId]);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

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

      // Cargar categorías de ejercicios
      console.log('🔄 Cargando categorías de ejercicios...');
      const categoriesSnapshot = await getDocs(collection(db, 'exerciseCategories'));
      console.log('📦 Snapshot de categorías:', categoriesSnapshot.size, 'documentos');
      
      const categoriesData: Category[] = categoriesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as Category));
      
      setCategories(categoriesData.sort((a, b) => a.name.localeCompare(b.name)));

      // Cargar ejercicios
      const exercisesSnapshot = await getDocs(collection(db, 'exercises'));
      const exercisesData: Exercise[] = exercisesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as Exercise));
      
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
        // Si la tabla tiene el formato antiguo (array), convertirla al nuevo formato
        if (Array.isArray((data.exercises as any))) {
          setExercises({
            day1: data.exercises as any || [],
            day2: [],
            day3: [],
            day4: [],
            day5: [],
            day6: [],
            day7: []
          });
        } else {
          setExercises(data.exercises || {
            day1: [],
            day2: [],
            day3: [],
            day4: [],
            day5: [],
            day6: [],
            day7: []
          });
        }
        
        // Guardar fecha de modificación
        if (data.updatedAt) {
          const date = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
          setCurrentTableDate(date);
        } else if (data.createdAt) {
          const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          setCurrentTableDate(date);
        }
      } else {
        setExercises({
          day1: [],
          day2: [],
          day3: [],
          day4: [],
          day5: [],
          day6: [],
          day7: []
        });
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
      setExercises({
        day1: [],
        day2: [],
        day3: [],
        day4: [],
        day5: [],
        day6: [],
        day7: []
      });
      setCurrentTableDate(null);
    } catch (error) {
      console.error('Error completing table:', error);
      setMessage({ type: 'error', text: 'Error al completar la tabla' });
    } finally {
      setSaving(false);
    }
  };

  const addExercise = () => {
    if (!newExercise.categoryId) {
      setMessage({ type: 'error', text: 'Selecciona una categoría' });
      return;
    }

    const exercise: AssignedExercise = {
      ...newExercise
    };

    setExercises({
      ...exercises,
      [selectedDay]: [...exercises[selectedDay], exercise]
    });
    setNewExercise({
      categoryId: '',
      categoryName: '',
      exerciseId: '',
      exerciseName: '',
      exercisePhotoUrl: '',
      mediaType: 'image',
      series: 3,
      reps: 10,
      weight: 0,
      notes: ''
    });
    setMessage(null);
  };

  const removeExercise = (index: number) => {
    setExercises({
      ...exercises,
      [selectedDay]: exercises[selectedDay].filter((_, i) => i !== index)
    });
  };

  const clearAllExercises = () => {
    if (!window.confirm('¿Estás seguro de que deseas vaciar toda la tabla? Se eliminarán todos los ejercicios de todos los días.')) {
      return;
    }
    
    setExercises({
      day1: [],
      day2: [],
      day3: [],
      day4: [],
      day5: [],
      day6: [],
      day7: []
    });
    setMessage({ type: 'success', text: 'Tabla vaciada correctamente' });
  };

  const saveTable = async (sendEmail: boolean = true) => {
    if (!selectedUserId) {
      setMessage({ type: 'error', text: 'Selecciona un usuario' });
      return;
    }

    // Calcular total de ejercicios en todos los días
    const totalExercises = Object.values(exercises).reduce((sum, dayExercises) => sum + dayExercises.length, 0);

    if (totalExercises === 0) {
      setMessage({ type: 'error', text: 'Agrega al menos un ejercicio a la tabla' });
      return;
    }

    if (!auth.currentUser) return;

    try {
      setSaving(true);
      setMessage(null);

      const selectedUser = users.find(u => u.id === selectedUserId);
      const currentUserData = users.find(u => u.id === auth.currentUser?.uid);

      // Buscar tabla activa existente para este usuario
      const q = query(
        collection(db, 'assignedTables'),
        where('userId', '==', selectedUserId),
        where('status', '==', 'ACTIVA')
      );
      const snapshot = await getDocs(q);

      let tableRef;

      if (!snapshot.empty) {
        tableRef = doc(db, 'assignedTables', snapshot.docs[0].id);
        await updateDoc(tableRef, {
          exercises: exercises,
          assignedBy: auth.currentUser.uid,
          assignedByName: currentUserData ? `${currentUserData.firstName} ${currentUserData.lastName}` : 'Monitor',
          updatedAt: serverTimestamp(),
          status: 'ACTIVA'
        });
      } else {
        tableRef = doc(collection(db, 'assignedTables'));
        await setDoc(tableRef, {
          userId: selectedUserId,
          exercises: exercises,
          assignedBy: auth.currentUser.uid,
          assignedByName: currentUserData ? `${currentUserData.firstName} ${currentUserData.lastName}` : 'Monitor',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          status: 'ACTIVA'
        });
      }

      if (sendEmail) {
        // Enviar email al usuario notificando la tabla
        try {
          const sendTableEmail = httpsCallable(functions, 'sendTableAssignedEmail');
          await sendTableEmail({
            userEmail: selectedUser?.email,
            userName: `${selectedUser?.firstName} ${selectedUser?.lastName}`,
            coachName: currentUserData ? `${currentUserData.firstName} ${currentUserData.lastName}` : 'Tu coach',
            totalExercises: totalExercises
          });
        } catch (emailError) {
          console.warn('⚠️ Tabla guardada pero error al enviar email:', emailError);
        }
        const actionLabel = snapshot.empty ? 'asignada' : 'actualizada';
        setMessage({
          type: 'success',
          text: `✅ Tabla ${actionLabel} a ${selectedUser?.firstName} ${selectedUser?.lastName} (${totalExercises} ejercicios) — Email enviado`
        });
      } else {
        setMessage({
          type: 'success',
          text: `💾 Tabla guardada (${totalExercises} ejercicios)`
        });
      }
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

  // ==================== GESTIÓN DE EJERCICIOS ====================
  
  const openNewExerciseForm = () => {
    setExerciseForm({
      id: '',
      name: '',
      category: '',
      description: '',
      photoFile: null,
      photoPreview: '',
      existingPhotoUrl: '',
      mediaType: 'image'
    });
    setEditingExercise(null);
    setShowExerciseForm(true);
  };

  const resetExerciseForm = () => {
    setExerciseForm({
      id: '',
      name: '',
      category: '',
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

    if (!exerciseForm.category) {
      setMessage({ type: 'error', text: 'Debes seleccionar una categoría' });
      return;
    }

    try {
      setExerciseFormLoading(true);
      setUploadProgress(0);

      let photoUrl = exerciseForm.existingPhotoUrl;

      // Subir foto/video si hay uno nuevo
      if (exerciseForm.photoFile) {
        const timestamp = Date.now();
        const fileExtension = exerciseForm.photoFile.name.split('.').pop();
        const fileName = `exercises/${exerciseForm.category}_${exerciseForm.name.replace(/\s+/g, '_')}_${timestamp}.${fileExtension}`;
        const storageRef = ref(storage, fileName);
        
        // Usar uploadBytesResumable para seguimiento de progreso
        const uploadTask = uploadBytesResumable(storageRef, exerciseForm.photoFile);
        
        await new Promise((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              // Calcular progreso
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(Math.round(progress));
            },
            (error) => {
              reject(error);
            },
            () => {
              resolve(uploadTask.snapshot);
            }
          );
        });
        
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
        category: exerciseForm.category,
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
      setUploadProgress(0);
    }
  };

  const startEditExercise = (exercise: Exercise) => {
    setExerciseForm({
      id: exercise.id,
      name: exercise.name,
      category: exercise.category || '',
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

        // Compatibilidad: tablas antiguas con exercises como array
        const hasExerciseInTable = Array.isArray((tableData.exercises as any))
          ? ((tableData.exercises as any) as AssignedExercise[]).some((ex) => ex.exerciseId === exercise.id)
          : Object.values(tableData.exercises || {}).some((dayExercises) =>
              (dayExercises as AssignedExercise[]).some((ex) => ex.exerciseId === exercise.id)
            );

        if (hasExerciseInTable) {
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

        // Compatibilidad: si exercises es un array (formato antiguo)
        if (Array.isArray((tableData.exercises as any))) {
          const updatedExercisesArray = ((tableData.exercises as any) as AssignedExercise[]).filter(
            (ex) => ex.exerciseId !== exercise.id
          );

          if (updatedExercisesArray.length !== (tableData.exercises as any).length) {
            batch.update(tableDoc.ref, {
              exercises: updatedExercisesArray,
              updatedAt: serverTimestamp()
            });
          }
        } else if (tableData.exercises) {
          // Nuevo formato por días
          const updatedPerDay: AssignedTableData['exercises'] = {
            day1: (tableData.exercises.day1 || []).filter((ex) => ex.exerciseId !== exercise.id),
            day2: (tableData.exercises.day2 || []).filter((ex) => ex.exerciseId !== exercise.id),
            day3: (tableData.exercises.day3 || []).filter((ex) => ex.exerciseId !== exercise.id),
            day4: (tableData.exercises.day4 || []).filter((ex) => ex.exerciseId !== exercise.id),
            day5: (tableData.exercises.day5 || []).filter((ex) => ex.exerciseId !== exercise.id),
            day6: (tableData.exercises.day6 || []).filter((ex) => ex.exerciseId !== exercise.id),
            day7: (tableData.exercises.day7 || []).filter((ex) => ex.exerciseId !== exercise.id)
          };

          const hadExercise = Object.values(tableData.exercises).some((dayList) =>
            (dayList as AssignedExercise[]).some((ex) => ex.exerciseId === exercise.id)
          );

          if (hadExercise) {
            batch.update(tableDoc.ref, {
              exercises: updatedPerDay,
              updatedAt: serverTimestamp()
            });
          }
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

  const getExercisesByCategory = (categoryId: string): Exercise[] => {
    return allExercises.filter(ex => ex.category === categoryId);
  };

  // ==================== GESTIÓN DE CATEGORÍAS ====================
  
  const openNewCategoryForm = () => {
    setCategoryFormName('');
    setEditingCategoryId(null);
    setShowCategoryForm(true);
  };

  const startEditCategory = (category: Category) => {
    setCategoryFormName(category.name);
    setEditingCategoryId(category.id);
    setShowCategoryForm(true);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoryFormName.trim()) {
      setMessage({ type: 'error', text: 'El nombre de la categoría es obligatorio' });
      return;
    }

    // Verificar que no exista otra categoría con el mismo nombre
    const duplicate = categories.find(c => 
      c.name.toLowerCase() === categoryFormName.trim().toLowerCase() && c.id !== editingCategoryId
    );
    if (duplicate) {
      setMessage({ type: 'error', text: 'Ya existe una categoría con ese nombre' });
      return;
    }

    try {
      setSaving(true);

      if (editingCategoryId) {
        // Actualizar categoría existente
        await updateDoc(doc(db, 'exerciseCategories', editingCategoryId), {
          name: categoryFormName.trim(),
          updatedAt: serverTimestamp()
        });
        
        setCategories(categories.map(c => 
          c.id === editingCategoryId 
            ? { ...c, name: categoryFormName.trim() } 
            : c
        ).sort((a, b) => a.name.localeCompare(b.name)));
        
        setMessage({ type: 'success', text: '✅ Categoría actualizada correctamente' });
      } else {
        // Crear nueva categoría
        const docRef = await addDoc(collection(db, 'exerciseCategories'), {
          name: categoryFormName.trim(),
          createdAt: serverTimestamp()
        });
        
        const newCategory: Category = {
          id: docRef.id,
          name: categoryFormName.trim()
        };
        
        setCategories([...categories, newCategory].sort((a, b) => a.name.localeCompare(b.name)));
        setMessage({ type: 'success', text: '✅ Categoría creada correctamente' });
      }

      setShowCategoryForm(false);
      setCategoryFormName('');
      setEditingCategoryId(null);
    } catch (error) {
      console.error('Error saving category:', error);
      setMessage({ type: 'error', text: 'Error al guardar la categoría' });
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (category: Category) => {
    // Verificar si la categoría está siendo usada por ejercicios
    const exercisesInCategory = allExercises.filter(ex => ex.category === category.id);
    
    if (exercisesInCategory.length > 0) {
      const confirmMessage = `La categoría "${category.name}" tiene ${exercisesInCategory.length} ejercicio(s) asignado(s).\n\n¿Deseas eliminarla igualmente? Los ejercicios quedarán sin categoría.`;
      
      if (!window.confirm(confirmMessage)) {
        return;
      }
    } else {
      if (!window.confirm(`¿Eliminar la categoría "${category.name}"?`)) {
        return;
      }
    }

    try {
      setSaving(true);
      
      // Si hay ejercicios en esta categoría, reasignarlos a null
      if (exercisesInCategory.length > 0) {
        const updatePromises = exercisesInCategory.map(exercise => 
          updateDoc(doc(db, 'exercises', exercise.id), { category: null })
        );
        await Promise.all(updatePromises);
        
        // Actualizar el estado local de ejercicios
        setAllExercises(allExercises.map(ex => 
          ex.category === category.id ? { ...ex, category: null } : ex
        ));
      }
      
      // Ahora eliminar la categoría
      await deleteDoc(doc(db, 'exerciseCategories', category.id));
      setCategories(categories.filter(c => c.id !== category.id));
      
      const successMsg = exercisesInCategory.length > 0 
        ? `✅ Categoría eliminada. ${exercisesInCategory.length} ejercicio(s) quedaron sin categoría.`
        : '✅ Categoría eliminada correctamente';
      
      setMessage({ type: 'success', text: successMsg });
    } catch (error) {
      console.error('Error deleting category:', error);
      setMessage({ type: 'error', text: 'Error al eliminar la categoría' });
    } finally {
      setSaving(false);
    }
  };

  const getCategoryExerciseCount = (categoryName: string): number => {
    return allExercises.filter(ex => ex.category === categoryName).length;
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
    if (!emailConfig.notificationsEmail) {
      alert('⚠️ Debes indicar un email de notificaciones');
      return;
    }

    if (!emailConfig.notificationsEmail.includes('@')) {
      alert('⚠️ Email de notificaciones inválido');
      return;
    }

    setUpdatingEmailConfig(true);
    
    try {
      await setDoc(doc(db, 'config', 'email'), {
        notificationsEmail: emailConfig.notificationsEmail,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email
      }, { merge: true });

      alert('✅ Email de notificaciones actualizado correctamente');
      setShowEmailConfigModal(false);
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
  const totalAssignedExercises = Object.values(exercises).reduce(
    (sum, dayExercises) => sum + dayExercises.length,
    0
  );

  return (
    <div className="admin-panel-container">
      {/* Header de Admin con información completa */}
      <div className="admin-header">
        <div className="admin-title-section">
          <h1>Panel de Coach</h1>
          <p>Gestiona tus ejercicios, videos y tablas de entrenamiento</p>
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
          {/* Tab de Usuarios - Solo para admin (max@max.es) */}
          {userRole === 'admin' && (
            <button 
              className="nav-tab"
              onClick={() => setActiveTab('usuarios')}
            >
              👥 Mis Usuarios
            </button>
          )}
          {/* Tabs de Ejercicios y Tablas - Para admin y coach */}
          <button 
            className="nav-tab"
            onClick={() => setActiveTab('ejercicios')}
          >
            💪 Mis Ejercicios
          </button>
          <button 
            className="nav-tab"
            onClick={() => setActiveTab('tablas')}
          >
            📋 Asignar Tablas
          </button>
          <button 
            className="nav-tab"
            onClick={() => setActiveTab('reproductor')}
          >
            🎬 Reproductor de Entrenamientos
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
        {/* Sección de Gestión de Usuarios - Solo para admin */}
        {activeTab === 'usuarios' && userRole === 'admin' && (
        <>
          {/* Título compacto de la página */}
          <div style={{ 
            marginBottom: '12px',
            padding: '8px 12px',
            background: 'rgba(102, 126, 234, 0.08)',
            borderRadius: '8px',
            borderLeft: '3px solid #667eea',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h2 style={{ 
              margin: '0',
              color: '#667eea',
              fontSize: '15px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              👥 Gestión de Usuarios
            </h2>
            <button
              onClick={() => setActiveTab(null)}
              style={{
                padding: '4px 12px',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: '#b0b0b0',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = '#e0e0e0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#b0b0b0';
              }}
            >
              ← Volver
            </button>
          </div>

          {/* Header con búsqueda y botón de crear */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '10px',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <input
              type="text"
              placeholder="🔍 Buscar..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              style={{
                flex: '1',
                minWidth: '200px',
                padding: '10px 14px',
                background: '#2d2d2d',
                border: '1px solid #3d3d3d',
                borderRadius: '8px',
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
                setUserForm({ firstName: '', lastName: '', email: '', password: '', role: 'usuario' });
                setShowCreateUserModal(true);
              }}
              style={{
                padding: '8px 14px',
                background: 'linear-gradient(135deg, #51cf66 0%, #40c057 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(81, 207, 102, 0.3)'
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

          {/* Tabla de usuarios */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            marginBottom: '20px'
          }}>
            {/* Encabezado de la tabla - Solo en desktop */}
            {window.innerWidth > 768 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 90px 1fr 200px',
                gap: '12px',
                padding: '12px 16px',
                background: 'rgba(102, 126, 234, 0.15)',
                borderBottom: '2px solid rgba(102, 126, 234, 0.3)',
                fontWeight: 'bold',
                fontSize: '13px',
                color: '#667eea'
              }}>
                <div>NOMBRE</div>
                <div style={{ textAlign: 'center' }}>ROL</div>
                <div>EMAIL</div>
                <div style={{ textAlign: 'center' }}>ACCIONES</div>
              </div>
            )}

            {/* Filas de usuarios */}
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
              .map((user, index, filteredArray) => (
                <div
                  key={user.id}
                  style={{
                    display: window.innerWidth > 768 ? 'grid' : 'block',
                    gridTemplateColumns: window.innerWidth > 768 ? '1fr 90px 1fr 200px' : undefined,
                    gap: window.innerWidth > 768 ? '12px' : undefined,
                    padding: window.innerWidth > 768 ? '12px 16px' : '12px',
                    borderBottom: index < filteredArray.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                    alignItems: 'center',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* Nombre con avatar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: window.innerWidth <= 768 ? '8px' : '0'
                  }}>
                    <div style={{
                      width: window.innerWidth <= 768 ? '40px' : '45px',
                      height: window.innerWidth <= 768 ? '40px' : '45px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: window.innerWidth <= 768 ? '16px' : '18px',
                      fontWeight: 'bold',
                      color: 'white',
                      flexShrink: 0
                    }}>
                      {user.firstName.charAt(0).toUpperCase()}
                    </div>
                    <div style={{
                      flex: 1,
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        color: '#e0e0e0',
                        fontSize: window.innerWidth <= 768 ? '13px' : '14px',
                        fontWeight: 'bold',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {user.firstName} {user.lastName}
                      </div>
                      {window.innerWidth <= 768 && (
                        <div style={{
                          color: '#b0b0b0',
                          fontSize: '11px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: '2px'
                        }}>
                          {user.email}
                        </div>
                      )}
                    </div>
                    {window.innerWidth <= 768 && (
                      <div style={{
                        color: '#fff',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        padding: '4px 8px',
                        borderRadius: '5px',
                        background: user.role === 'coach' 
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                          : 'rgba(255, 255, 255, 0.1)',
                        whiteSpace: 'nowrap'
                      }}>
                        {user.role === 'coach' ? '💪' : '👤'}
                      </div>
                    )}
                  </div>

                  {/* Rol - Solo desktop */}
                  {window.innerWidth > 768 && (
                    <div style={{
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      textAlign: 'center',
                      background: user.role === 'coach' 
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                        : 'rgba(255, 255, 255, 0.1)',
                      whiteSpace: 'nowrap'
                    }}>
                      {user.role === 'coach' ? '💪 Coach' : '👤 Usuario'}
                    </div>
                  )}

                  {/* Email - Solo desktop */}
                  {window.innerWidth > 768 && (
                    <div style={{
                      color: '#b0b0b0',
                      fontSize: '13px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {user.email}
                    </div>
                  )}

                  {/* Acciones */}
                  <div style={{ 
                    display: 'flex', 
                    gap: window.innerWidth <= 768 ? '6px' : '8px',
                    justifyContent: window.innerWidth <= 768 ? 'flex-start' : 'center',
                    marginTop: window.innerWidth <= 768 ? '8px' : '0'
                  }}>
                    <button
                      onClick={() => {
                        setEditingUser(user);
                        setUserForm({
                          firstName: user.firstName,
                          lastName: user.lastName,
                          email: user.email,
                          password: '',
                          role: user.role || 'usuario'
                        });
                      }}
                      style={{
                        padding: window.innerWidth <= 768 ? '5px 10px' : '6px 12px',
                        background: 'rgba(102, 126, 234, 0.2)',
                        border: '1px solid #667eea',
                        borderRadius: window.innerWidth <= 768 ? '5px' : '6px',
                        color: '#667eea',
                        fontSize: window.innerWidth <= 768 ? '11px' : '12px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(102, 126, 234, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)';
                      }}
                    >
                      {window.innerWidth <= 768 ? '✏️' : '✏️ Editar'}
                    </button>
                    <button
                      onClick={() => setResetPasswordUserId(user.id)}
                      style={{
                        padding: window.innerWidth <= 768 ? '5px 10px' : '6px 12px',
                        background: 'rgba(255, 152, 0, 0.2)',
                        border: '1px solid #ff9800',
                        borderRadius: window.innerWidth <= 768 ? '5px' : '6px',
                        color: '#ff9800',
                        fontSize: window.innerWidth <= 768 ? '11px' : '12px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 152, 0, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 152, 0, 0.2)';
                      }}
                    >
                      {window.innerWidth <= 768 ? '🔑' : '🔑 Contraseña'}
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

                <div className="form-group">
                  <label>Tipo de Usuario *</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'usuario' | 'coach' })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#2d2d2d',
                      border: '1px solid #3d3d3d',
                      borderRadius: '6px',
                      color: '#e0e0e0',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="usuario">👤 Usuario (Alumno)</option>
                    <option value="coach">💪 Coach (Entrenador)</option>
                  </select>
                  <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#888' }}>
                    Usuario: Entrena y ve su historial | Coach: Gestiona ejercicios y tablas
                  </p>
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
                          role: userForm.role,
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
                          email: userForm.email.trim(),
                          role: userForm.role
                        }]);

                        setMessage({ 
                          type: 'success', 
                          text: `✅ Usuario ${userForm.firstName} ${userForm.lastName} creado correctamente. Se ha enviado un email de bienvenida.` 
                        });
                        
                        setShowCreateUserModal(false);
                        setUserForm({ firstName: '', lastName: '', email: '', password: '000000', role: 'usuario' });
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
                      setUserForm({ firstName: '', lastName: '', email: '', password: '', role: 'usuario' });
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

                <div className="form-group">
                  <label>Tipo de Usuario</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'usuario' | 'coach' })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#2d2d2d',
                      border: '1px solid #3d3d3d',
                      borderRadius: '6px',
                      color: '#e0e0e0',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="usuario">👤 Usuario (Alumno)</option>
                    <option value="coach">💪 Coach (Entrenador)</option>
                  </select>
                  <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#888' }}>
                    Usuario: Entrena y ve su historial | Coach: Gestiona ejercicios y tablas
                  </p>
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
                          email: userForm.email.trim(),
                          role: userForm.role
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

        {/* Sección de Gestión de Ejercicios */}
        {activeTab === 'ejercicios' && (
          <>
          {showCategoryManagement ? (
            /* ========== VISTA DE GESTIÓN DE CATEGORÍAS ========== */
            <>
              {/* Título compacto de la página de categorías */}
              <div style={{ 
                marginBottom: '12px',
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <h2 style={{ 
                  margin: '0',
                  color: '#667eea',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  🏷️ Gestión de Categorías
                </h2>
                <button
                  onClick={() => setShowCategoryManagement(false)}
                  style={{
                    padding: '4px 12px',
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    color: '#b0b0b0',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.color = '#e0e0e0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#b0b0b0';
                  }}
                >
                  ← Volver
                </button>
              </div>

              {/* Botón crear categoría */}
              <div style={{ marginBottom: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={openNewCategoryForm}
                  style={{
                    padding: '8px 14px',
                    background: 'linear-gradient(135deg, #51cf66 0%, #40c057 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(81, 207, 102, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(81, 207, 102, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(81, 207, 102, 0.3)';
                  }}
                >
                  ➕ Crear Categoría
                </button>
              </div>

              {/* Formulario de crear/editar categoría */}
              {showCategoryForm && (
              <form onSubmit={handleCategorySubmit} style={{ marginBottom: '25px' }}>
                <div style={{
                  background: 'rgba(102, 126, 234, 0.08)',
                  padding: '20px',
                  borderRadius: '10px',
                  border: '2px solid rgba(102, 126, 234, 0.25)'
                }}>
                  <h3 style={{ margin: '0 0 15px 0', color: '#e0e0e0' }}>
                    {editingCategoryId ? '✏️ Editar Categoría' : '➕ Nueva Categoría'}
                  </h3>
                  <input
                    type="text"
                    value={categoryFormName}
                    onChange={(e) => setCategoryFormName(e.target.value)}
                    placeholder="Nombre de la categoría"
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#2d2d2d',
                      border: '2px solid #3d3d3d',
                      borderRadius: '8px',
                      color: '#e0e0e0',
                      fontSize: '14px',
                      marginBottom: '15px',
                      boxSizing: 'border-box'
                    }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="submit"
                      disabled={saving || !categoryFormName.trim()}
                      style={{
                        flex: 1,
                        padding: '12px',
                        background: saving || !categoryFormName.trim() 
                          ? '#555' 
                          : 'linear-gradient(135deg, #51cf66 0%, #40c057 100%)',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        cursor: saving || !categoryFormName.trim() ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {saving ? 'Guardando...' : (editingCategoryId ? 'Actualizar' : 'Crear')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCategoryForm(false);
                        setCategoryFormName('');
                        setEditingCategoryId(null);
                      }}
                      style={{
                        flex: 1,
                        padding: '12px',
                        background: '#555',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </form>
              )}

              {/* Tabla de categorías */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '2px solid rgba(255, 255, 255, 0.1)'
              }}>
                {/* Encabezado de la tabla - Solo desktop */}
                {window.innerWidth > 768 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px 180px',
                    gap: '12px',
                    padding: '12px 16px',
                    background: 'rgba(102, 126, 234, 0.15)',
                    borderBottom: '2px solid rgba(102, 126, 234, 0.3)',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    color: '#667eea'
                  }}>
                    <div>NOMBRE</div>
                    <div>EJERCICIOS</div>
                    <div style={{ textAlign: 'center' }}>ACCIONES</div>
                  </div>
                )}

                {/* Filas de categorías */}
                {categories.length === 0 ? (
                  <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#999'
                  }}>
                    No hay categorías creadas
                  </div>
                ) : (
                  categories.map((category, index) => {
                    const exerciseCount = allExercises.filter(ex => ex.category === category.id).length;
                    return (
                      <div
                        key={category.id}
                        style={{
                          display: window.innerWidth > 768 ? 'grid' : 'block',
                          gridTemplateColumns: window.innerWidth > 768 ? '1fr 120px 180px' : undefined,
                          gap: window.innerWidth > 768 ? '12px' : undefined,
                          padding: window.innerWidth > 768 ? '12px 16px' : '12px',
                          borderBottom: index < categories.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                          alignItems: 'center',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        {/* Nombre */}
                        <div style={{
                          color: '#e0e0e0',
                          fontSize: window.innerWidth <= 768 ? '13px' : '14px',
                          fontWeight: 'bold',
                          marginBottom: window.innerWidth <= 768 ? '8px' : '0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: window.innerWidth <= 768 ? 'space-between' : 'flex-start'
                        }}>
                          <span>{category.name}</span>
                          {window.innerWidth <= 768 && (
                            <span style={{
                              color: '#b0b0b0',
                              fontSize: '11px',
                              background: 'rgba(102, 126, 234, 0.1)',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid rgba(102, 126, 234, 0.3)'
                            }}>
                              {exerciseCount} ejercicio{exerciseCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        {/* Contador de ejercicios - Solo desktop */}
                        {window.innerWidth > 768 && (
                          <div style={{
                            color: '#b0b0b0',
                            fontSize: '13px'
                          }}>
                            {exerciseCount} ejercicio{exerciseCount !== 1 ? 's' : ''}
                          </div>
                        )}

                        {/* Acciones */}
                        <div style={{ 
                          display: 'flex', 
                          gap: window.innerWidth <= 768 ? '6px' : '8px',
                          justifyContent: window.innerWidth <= 768 ? 'flex-start' : 'center'
                        }}>
                          <button
                            onClick={() => startEditCategory(category)}
                            style={{
                              padding: window.innerWidth <= 768 ? '5px 10px' : '6px 12px',
                              background: 'rgba(102, 126, 234, 0.2)',
                              border: '1px solid #667eea',
                              borderRadius: window.innerWidth <= 768 ? '5px' : '6px',
                              color: '#667eea',
                              fontSize: window.innerWidth <= 768 ? '11px' : '12px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(102, 126, 234, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)';
                            }}
                          >
                            {window.innerWidth <= 768 ? '✏️' : '✏️ Editar'}
                          </button>
                          <button
                            onClick={() => deleteCategory(category)}
                            style={{
                              padding: window.innerWidth <= 768 ? '5px 10px' : '6px 12px',
                              background: 'rgba(245, 87, 108, 0.2)',
                              border: '1px solid #f5576c',
                              borderRadius: window.innerWidth <= 768 ? '5px' : '6px',
                              color: '#f5576c',
                              fontSize: window.innerWidth <= 768 ? '11px' : '12px',
                              cursor: 'pointer',
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
                            {window.innerWidth <= 768 ? '🗑️' : '🗑️ Borrar'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            /* ========== VISTA PRINCIPAL DE EJERCICIOS ========== */
            <>
            {/* Título compacto de la página */}
            <div style={{ 
              marginBottom: '12px',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{ 
                margin: '0',
                color: '#667eea',
                fontSize: '15px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                💪 Gestión de Ejercicios
              </h2>
              <button
                onClick={() => setActiveTab(null)}
                style={{
                  padding: '4px 12px',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  color: '#b0b0b0',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = '#e0e0e0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#b0b0b0';
                }}
              >
                ← Volver
              </button>
            </div>

            {/* Botones de acción */}
            <div style={{ marginBottom: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Filtro por categoría */}
              <select
                value={categoryFilterExercises}
                onChange={(e) => setCategoryFilterExercises(e.target.value)}
                style={{
                  padding: window.innerWidth <= 768 ? '10px 14px' : '12px 16px',
                  background: '#1a1a2e',
                  border: '1px solid #3d3d3d',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  minWidth: window.innerWidth <= 768 ? '180px' : '200px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#3d3d3d';
                }}
              >
                <option value="Todas">🔍 Todas las categorías</option>
                {categories.map((cat) => {
                  const count = allExercises.filter(e => e.category === cat.id).length;
                  return (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({count})
                    </option>
                  );
                })}
              </select>

              <button
                onClick={openNewExerciseForm}
                style={{
                  padding: '8px 14px',
                  background: 'linear-gradient(135deg, #51cf66 0%, #40c057 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(81, 207, 102, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(81, 207, 102, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(81, 207, 102, 0.3)';
                }}
              >
                ➕ Crear Ejercicio
              </button>
              <button
                onClick={() => setShowCategoryManagement(true)}
                style={{
                  padding: '8px 14px',
                  background: 'rgba(102, 126, 234, 0.2)',
                  border: '1px solid #667eea',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.2)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.2)';
                }}
              >
                🏷️ Gestionar Categorías
              </button>
            </div>

            {/* Tabla de ejercicios */}
            {allExercises.length === 0 ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                border: '2px dashed rgba(255, 255, 255, 0.2)'
              }}>
                <p style={{ color: '#999', fontSize: '16px', marginBottom: '20px' }}>
                  No hay ejercicios creados
                </p>
                <button
                  onClick={openNewExerciseForm}
                  style={{
                    padding: '12px 24px',
                    background: '#667eea',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Crear primer ejercicio
                </button>
              </div>
            ) : (
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '2px solid rgba(255, 255, 255, 0.1)'
              }}>
                {/* Encabezado de la tabla - Solo en desktop */}
                {window.innerWidth > 768 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 180px 200px',
                    gap: '12px',
                    padding: '12px 16px',
                    background: 'rgba(102, 126, 234, 0.15)',
                    borderBottom: '2px solid rgba(102, 126, 234, 0.3)',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    color: '#667eea'
                  }}>
                    <div>NOMBRE</div>
                    <div>CATEGORÍA</div>
                    <div style={{ textAlign: 'center' }}>ACCIONES</div>
                  </div>
                )}

                {/* Filas de ejercicios */}
                {allExercises
                  .filter(exercise => 
                    categoryFilterExercises === 'Todas' || exercise.category === categoryFilterExercises
                  )
                  .map((exercise, index, filteredArray) => (
                    <div
                      key={exercise.id}
                      style={{
                        display: window.innerWidth > 768 ? 'grid' : 'block',
                        gridTemplateColumns: window.innerWidth > 768 ? '1fr 180px 200px' : undefined,
                        gap: window.innerWidth > 768 ? '12px' : undefined,
                        padding: window.innerWidth > 768 ? '12px 16px' : '12px',
                        borderBottom: index < filteredArray.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                        alignItems: 'center',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {/* Nombre del ejercicio */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: window.innerWidth <= 768 ? '8px' : '0'
                      }}>
                        {/* Miniatura */}
                        <div
                          style={{
                            width: window.innerWidth <= 768 ? '45px' : '50px',
                            height: window.innerWidth <= 768 ? '45px' : '50px',
                            background: 'rgba(0, 0, 0, 0.5)',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            cursor: exercise.photoUrl ? 'pointer' : 'default',
                            flexShrink: 0
                          }}
                          onClick={() => {
                            if (exercise.photoUrl) {
                              setMediaModal({
                                show: true,
                                url: exercise.photoUrl!,
                                type: exercise.mediaType || 'image',
                                title: exercise.name
                              });
                            }
                          }}
                        >
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
                            <span style={{ fontSize: '20px' }}>💪</span>
                          )}
                        </div>

                        {/* Nombre y descripción */}
                        <div style={{ overflow: 'hidden', flex: 1 }}>
                          <div style={{
                            color: '#e0e0e0',
                            fontSize: window.innerWidth <= 768 ? '13px' : '14px',
                            fontWeight: 'bold',
                            marginBottom: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {exercise.name}
                          </div>
                          {exercise.description && window.innerWidth > 768 && (
                            <div style={{
                              color: '#999',
                              fontSize: '12px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {exercise.description}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Categoría y Acciones - Layout responsive */}
                      {window.innerWidth <= 768 ? (
                        // Layout móvil: todo en una línea horizontal
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          flexWrap: 'wrap'
                        }}>
                          <div style={{
                            color: '#b0b0b0',
                            fontSize: '11px',
                            background: 'rgba(102, 126, 234, 0.1)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid rgba(102, 126, 234, 0.3)'
                          }}>
                            {exercise.categoryName || categories.find(c => c.id === exercise.category)?.name || 'Sin categoría'}
                          </div>
                          
                          <div style={{ 
                            display: 'flex', 
                            gap: '6px'
                          }}>
                            {exercise.photoUrl && (
                              <button
                                onClick={() => {
                                  setMediaModal({
                                    show: true,
                                    url: exercise.photoUrl!,
                                    type: exercise.mediaType || 'image',
                                    title: exercise.name
                                  });
                                }}
                                style={{
                                  padding: '5px 10px',
                                  background: 'rgba(51, 194, 255, 0.2)',
                                  border: '1px solid #33c2ff',
                                  borderRadius: '5px',
                                  color: '#33c2ff',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold'
                                }}
                              >
                                👁️
                              </button>
                            )}
                            <button
                              onClick={() => startEditExercise(exercise)}
                              style={{
                                padding: '5px 10px',
                                background: 'rgba(102, 126, 234, 0.2)',
                                border: '1px solid #667eea',
                                borderRadius: '5px',
                                color: '#667eea',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => deleteExercise(exercise)}
                              style={{
                                padding: '5px 10px',
                                background: 'rgba(245, 87, 108, 0.2)',
                                border: '1px solid #f5576c',
                                borderRadius: '5px',
                                color: '#f5576c',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Layout desktop: grid con columnas separadas
                        <>
                          {/* Categoría */}
                          <div style={{
                            color: '#b0b0b0',
                            fontSize: '13px'
                          }}>
                            {exercise.categoryName || categories.find(c => c.id === exercise.category)?.name || 'Sin categoría'}
                          </div>

                          {/* Acciones */}
                          <div style={{ 
                            display: 'flex', 
                            gap: '8px',
                            justifyContent: 'center'
                          }}>
                            {exercise.photoUrl && (
                              <button
                                onClick={() => {
                                  setMediaModal({
                                    show: true,
                                    url: exercise.photoUrl!,
                                    type: exercise.mediaType || 'image',
                                    title: exercise.name
                                  });
                                }}
                                style={{
                                  padding: '6px 12px',
                                  background: 'rgba(51, 194, 255, 0.2)',
                                  border: '1px solid #33c2ff',
                                  borderRadius: '6px',
                                  color: '#33c2ff',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(51, 194, 255, 0.3)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(51, 194, 255, 0.2)';
                                }}
                              >
                                👁️
                              </button>
                            )}
                            <button
                              onClick={() => startEditExercise(exercise)}
                              style={{
                                padding: '6px 12px',
                                background: 'rgba(102, 126, 234, 0.2)',
                                border: '1px solid #667eea',
                                borderRadius: '6px',
                                color: '#667eea',
                                fontSize: '12px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(102, 126, 234, 0.3)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)';
                              }}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => deleteExercise(exercise)}
                              style={{
                                padding: '6px 12px',
                                background: 'rgba(245, 87, 108, 0.2)',
                                border: '1px solid #f5576c',
                                borderRadius: '6px',
                                color: '#f5576c',
                                fontSize: '12px',
                                cursor: 'pointer',
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
                              🗑️
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
              </div>
            )}
            </>
          )}
          </>
        )}

        {/* Sección de asignación de tablas (mostrar solo si activeTab === 'tablas') */}
        {activeTab === 'tablas' && (
        <>
          {/* Título compacto — igual que el resto de secciones */}
          <div style={{
            marginBottom: '8px',
            padding: '6px 12px',
            background: 'rgba(102, 126, 234, 0.08)',
            borderRadius: '8px',
            borderLeft: '3px solid #667eea',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h2 style={{
              margin: '0', color: '#667eea', fontSize: '15px', fontWeight: 'bold',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              📋 Gestión de Tablas
            </h2>
            <button
              onClick={() => setActiveTab(null)}
              style={{
                padding: '4px 12px',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: '#b0b0b0',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#e0e0e0'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#b0b0b0'; }}
            >
              ← Volver
            </button>
          </div>

          {/* Fila: usuario + Asignar+Email + Limpiar */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="user-select"
              style={{ minWidth: '220px', maxWidth: '360px', fontSize: '13px', padding: '6px 10px' }}
            >
              <option value="">👤 Selecciona usuario…</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.email})
                </option>
              ))}
            </select>
            {selectedUserId && (
              <>
                <button
                  onClick={() => saveTable(true)}
                  disabled={saving}
                  style={{
                    padding: '6px 10px', borderRadius: '6px', border: 'none', flexShrink: 0,
                    background: saving ? '#444' : 'linear-gradient(135deg, #38b2ac, #2b9e98)',
                    color: saving ? '#888' : 'white',
                    fontWeight: 'bold', fontSize: '11px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  📧 {saving ? 'Enviando...' : 'Asignar + Email'}
                </button>
                <button
                  onClick={clearAllExercises}
                  disabled={saving || totalAssignedExercises === 0}
                  style={{
                    padding: '6px 10px', borderRadius: '6px', border: 'none', flexShrink: 0,
                    background: saving || totalAssignedExercises === 0 ? '#333' : 'linear-gradient(135deg, #e53e3e, #c53030)',
                    color: saving || totalAssignedExercises === 0 ? '#555' : 'white',
                    fontWeight: 'bold', fontSize: '11px',
                    cursor: saving || totalAssignedExercises === 0 ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🗑️ Limpiar
                </button>
                {totalAssignedExercises > 0 && (
                  <span style={{ color: '#48bb78', fontSize: '11px', marginLeft: '4px', whiteSpace: 'nowrap' }}>
                    ✔ {totalAssignedExercises} ej.
                    {currentTableDate && (
                      <span style={{ color: '#888', marginLeft: '8px' }}>
                        {currentTableDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </span>
                    )}
                  </span>
                )}
              </>
            )}
          </div>

          {selectedUserId && (
          <>
          {/* ===== TABS DE DÍAS ===== */}
          <div style={{
            display: 'flex', borderRadius: '8px', overflow: 'hidden',
            marginBottom: '8px', border: '1px solid rgba(255,255,255,0.1)',
            background: '#1a1a2e'
          }}>
            {(['day1','day2','day3','day4','day5','day6','day7'] as const).map((key, i) => {
              const count = exercises[key].length;
              const isActive = selectedDay === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(key)}
                  style={{
                    flex: 1, padding: '6px 4px',
                    border: 'none',
                    borderRight: i < 6 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    background: isActive ? 'linear-gradient(135deg, #2d2d6e, #3d3d8e)' : 'rgba(255,255,255,0.03)',
                    color: isActive ? '#a5b4fc' : '#999',
                    fontWeight: isActive ? 'bold' : 'normal',
                    fontSize: '12px', cursor: 'pointer', position: 'relative',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Día {i + 1}
                  {count > 0 && (
                    <span style={{
                      position: 'absolute', top: '4px', right: '50%',
                      transform: 'translateX(120%)',
                      background: '#48bb78', color: '#fff',
                      borderRadius: '50%', width: '16px', height: '16px',
                      fontSize: '9px', fontWeight: 'bold',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ===== DOS COLUMNAS ===== */}
          <div style={{
            display: 'flex',
            flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
            gap: '10px',
            height: window.innerWidth <= 768 ? 'auto' : 'calc(100vh - 210px)',
            minHeight: '400px'
          }}>

            {/* ===== IZQUIERDA: Catálogo de ejercicios ===== */}
            <div style={{
              width: window.innerWidth <= 768 ? '100%' : '340px',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(255,255,255,0.08)',
              overflow: 'hidden',
              height: window.innerWidth <= 768 ? '420px' : 'auto'
            }}>
              {/* Título */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontSize: '16px' }}>📋</span>
                <span style={{ color: '#e0e0e0', fontWeight: 'bold', fontSize: '14px' }}>Ejercicios Disponibles</span>
              </div>

              {/* Filtro Categorías */}
              <div>
                <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px', fontWeight: '500' }}>Filtro Categorías</div>
                <select
                  value={tableCategoryFilter}
                  onChange={(e) => setTableCategoryFilter(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px',
                    background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '7px', color: '#e0e0e0', fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  <option value="Todas">Todas</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({allExercises.filter(e => e.category === cat.id).length})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro nombre */}
              <div>
                <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px', fontWeight: '500' }}>Filtro nombre</div>
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={tableExerciseSearch}
                  onChange={(e) => setTableExerciseSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', boxSizing: 'border-box' as const,
                    background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '7px', color: '#e0e0e0', fontSize: '13px'
                  }}
                />
              </div>

              {/* Lista de ejercicios */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {allExercises
                  .filter(ex =>
                    (tableCategoryFilter === 'Todas' || ex.category === tableCategoryFilter) &&
                    (!tableExerciseSearch || ex.name.toLowerCase().includes(tableExerciseSearch.toLowerCase()))
                  )
                  .map((exercise) => {
                    const catName = categories.find(c => c.id === exercise.category)?.name || '';
                    return (
                      <div
                        key={exercise.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '8px 10px', borderRadius: '8px',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          transition: 'background 0.12s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            color: '#e0e0e0', fontSize: '13px', fontWeight: '600',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}>
                            {exercise.name}
                          </div>
                          {catName && (
                            <span style={{
                              display: 'inline-block', marginTop: '3px',
                              background: 'rgba(102,126,234,0.18)',
                              color: '#a5b4fc', fontSize: '10px', fontWeight: '500',
                              padding: '1px 7px', borderRadius: '10px'
                            }}>
                              {catName}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            const category = categories.find(c => c.id === exercise.category);
                            setExercises({
                              ...exercises,
                              [selectedDay]: [...exercises[selectedDay], {
                                categoryId: exercise.category || '',
                                categoryName: category?.name || '',
                                exerciseId: exercise.id,
                                exerciseName: exercise.name,
                                exercisePhotoUrl: exercise.photoUrl || '',
                                mediaType: (exercise.mediaType || 'image') as 'image' | 'video',
                                series: 3,
                                reps: 10,
                                weight: undefined,
                                notes: ''
                              }]
                            });
                          }}
                          title={`Añadir a Día ${selectedDay.replace('day', '')}`}
                          style={{
                            flexShrink: 0, width: '30px', height: '30px',
                            borderRadius: '7px', border: 'none',
                            background: 'linear-gradient(135deg, #48bb78, #38a169)',
                            color: 'white', fontSize: '18px', fontWeight: 'bold',
                            cursor: 'pointer', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            lineHeight: '1'
                          }}
                        >+</button>
                      </div>
                    );
                  })}
                {allExercises.filter(ex =>
                  (tableCategoryFilter === 'Todas' || ex.category === tableCategoryFilter) &&
                  (!tableExerciseSearch || ex.name.toLowerCase().includes(tableExerciseSearch.toLowerCase()))
                ).length === 0 && (
                  <div style={{ color: '#555', fontSize: '12px', textAlign: 'center', padding: '30px 0' }}>
                    Sin resultados
                  </div>
                )}
              </div>
            </div>

            {/* ===== DERECHA: Tabla de asignación por día ===== */}
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '12px', padding: '16px',
              border: '1px solid rgba(255,255,255,0.08)',
              overflow: 'hidden', minWidth: 0
            }}>
              {/* Cabecera del panel derecho */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>✅</span>
                  <span style={{ color: '#e0e0e0', fontWeight: 'bold', fontSize: '14px' }}>
                    Día {selectedDay.replace('day', '')} ({exercises[selectedDay].length} ejercicio{exercises[selectedDay].length !== 1 ? 's' : ''})
                  </span>
                </div>
                <button
                  onClick={() => saveTable(false)}
                  disabled={saving}
                  style={{
                    padding: '7px 18px', borderRadius: '7px', border: 'none',
                    background: saving ? '#333' : 'linear-gradient(135deg, #48bb78, #38a169)',
                    color: saving ? '#666' : 'white',
                    fontWeight: 'bold', fontSize: '13px',
                    cursor: saving ? 'not-allowed' : 'pointer'
                  }}
                >
                  💾 {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>

              {/* Lista de ejercicios asignados */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {exercises[selectedDay].length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '50px 20px', color: '#444' }}>
                    <div style={{ fontSize: '36px', marginBottom: '10px' }}>📭</div>
                    <div style={{ fontSize: '14px', color: '#555' }}>Sin ejercicios en este día</div>
                    <div style={{ fontSize: '12px', color: '#3a3a3a', marginTop: '6px' }}>
                      Pulsa <strong style={{ color: '#48bb78' }}>+</strong> en un ejercicio de la izquierda para añadirlo
                    </div>
                  </div>
                ) : (
                  exercises[selectedDay].map((exercise, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '12px 14px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.07)'
                      }}
                    >
                      {/* Drag handle */}
                      <span style={{ color: '#333', fontSize: '16px', cursor: 'grab', flexShrink: 0, userSelect: 'none' }}>⠿</span>
                      {/* Número */}
                      <span style={{ color: '#667eea', fontWeight: 'bold', fontSize: '14px', flexShrink: 0, minWidth: '24px' }}>
                        {index + 1}.
                      </span>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#e0e0e0', fontWeight: '600', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {exercise.exerciseName || exercise.categoryName}
                        </div>
                        {exercise.categoryName && (
                          <span style={{ color: '#667eea', fontSize: '11px' }}>{exercise.categoryName}</span>
                        )}
                      </div>
                      {/* Badges S/R/Kg */}
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        {[
                          { label: 'S', val: exercise.series },
                          { label: 'R', val: exercise.reps },
                          { label: 'Kg', val: exercise.weight ?? '-' }
                        ].map(b => (
                          <span key={b.label} style={{
                            background: 'rgba(102,126,234,0.12)', color: '#a5b4fc',
                            borderRadius: '5px', padding: '2px 6px',
                            fontSize: '11px', fontWeight: '600'
                          }}>{b.label} {b.val}</span>
                        ))}
                      </div>
                      {/* Botones acción */}
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button
                          onClick={() => {
                            if (index === 0) return;
                            const updated = [...exercises[selectedDay]];
                            [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
                            setExercises({ ...exercises, [selectedDay]: updated });
                          }}
                          disabled={index === 0}
                          style={{
                            width: '28px', height: '28px', borderRadius: '6px', border: 'none',
                            background: index === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(102,126,234,0.15)',
                            color: index === 0 ? '#333' : '#a5b4fc',
                            cursor: index === 0 ? 'default' : 'pointer', fontSize: '13px'
                          }}
                          title="Subir"
                        >↑</button>
                        <button
                          onClick={() => {
                            if (index === exercises[selectedDay].length - 1) return;
                            const updated = [...exercises[selectedDay]];
                            [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
                            setExercises({ ...exercises, [selectedDay]: updated });
                          }}
                          disabled={index === exercises[selectedDay].length - 1}
                          style={{
                            width: '28px', height: '28px', borderRadius: '6px', border: 'none',
                            background: index === exercises[selectedDay].length - 1 ? 'rgba(255,255,255,0.03)' : 'rgba(102,126,234,0.15)',
                            color: index === exercises[selectedDay].length - 1 ? '#333' : '#a5b4fc',
                            cursor: index === exercises[selectedDay].length - 1 ? 'default' : 'pointer', fontSize: '13px'
                          }}
                          title="Bajar"
                        >↓</button>
                        <button
                          onClick={() => removeExercise(index)}
                          style={{
                            width: '28px', height: '28px', borderRadius: '6px', border: 'none',
                            background: 'rgba(245,101,101,0.12)',
                            color: '#fc8181', cursor: 'pointer', fontSize: '13px'
                          }}
                          title="Eliminar"
                        >🗑️</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
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
            <h3>📧 Configurar Email del Coach</h3>
            <p style={{ color: '#999', fontSize: '14px', marginBottom: '20px' }}>
              Este es el email donde llegarán las notificaciones (cambios de tabla, sugerencias, etc.).
            </p>

            <div className="form-group">
              <label>Email de notificaciones del coach</label>
              <input
                type="email"
                placeholder="coach@ejemplo.com"
                value={emailConfig.notificationsEmail}
                onChange={(e) => setEmailConfig({ ...emailConfig, notificationsEmail: e.target.value })}
              />
              <small style={{ color: '#999', display: 'block', marginTop: '8px' }}>
                Este será el email donde llegarán las solicitudes de cambio y sugerencias de los usuarios.
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

          </div>
        </div>
      )}

      {/* Sección de Reproductor de Entrenamientos */}
      {activeTab === 'reproductor' && (
        <div className="reproductor-section">
          <div style={{
            marginBottom: '12px',
            padding: '8px 12px',
            background: 'rgba(102, 126, 234, 0.08)',
            borderRadius: '8px',
            borderLeft: '3px solid #667eea',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h2 style={{ 
              margin: '0',
              color: '#667eea',
              fontSize: '15px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              🎬 Reproductor de Entrenamientos
            </h2>
            <button
              onClick={() => setActiveTab(null)}
              style={{
                padding: '4px 12px',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: '#b0b0b0',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = '#e0e0e0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#b0b0b0';
              }}
            >
              ← Volver
            </button>
          </div>

          {/* Visor de Video/Imagen */}
          {currentExerciseIndex !== null && playlist[currentExerciseIndex] && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.8)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px',
              border: '2px solid rgba(102, 126, 234, 0.3)'
            }}>
              <div style={{
                textAlign: 'center',
                marginBottom: '15px'
              }}>
                <h3 style={{ 
                  margin: 0, 
                  color: '#667eea',
                  fontSize: '24px',
                  fontWeight: 'bold'
                }}>
                  {playlist[currentExerciseIndex].name}
                </h3>
                <p style={{ 
                  margin: '5px 0 0 0', 
                  color: '#999',
                  fontSize: '16px'
                }}>
                  {playlist[currentExerciseIndex].categoryName || categories.find(c => c.id === playlist[currentExerciseIndex].category)?.name}
                </p>
              </div>

              <div style={{
                width: '100%',
                maxHeight: window.innerHeight < 600 && window.matchMedia('(orientation: landscape)').matches 
                  ? '250px' 
                  : '500px',
                background: 'rgba(0, 0, 0, 0.5)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                {playlist[currentExerciseIndex].photoUrl ? (
                  playlist[currentExerciseIndex].mediaType === 'video' ? (
                    <video
                      key={playlist[currentExerciseIndex].id}
                      src={playlist[currentExerciseIndex].photoUrl}
                      controls
                      autoPlay={isPlaying}
                      style={{
                        width: '100%',
                        maxHeight: window.innerHeight < 600 && window.matchMedia('(orientation: landscape)').matches 
                          ? '250px' 
                          : '500px',
                        objectFit: 'contain'
                      }}
                      onEnded={() => {
                        // Avanzar automáticamente al siguiente ejercicio
                        if (currentExerciseIndex < playlist.length - 1) {
                          setCurrentExerciseIndex(currentExerciseIndex + 1);
                        } else {
                          setIsPlaying(false);
                        }
                      }}
                    />
                  ) : (
                    <img
                      src={playlist[currentExerciseIndex].photoUrl}
                      alt={playlist[currentExerciseIndex].name}
                      style={{
                        width: '100%',
                        maxHeight: window.innerHeight < 600 && window.matchMedia('(orientation: landscape)').matches 
                          ? '250px' 
                          : '500px',
                        objectFit: 'contain'
                      }}
                    />
                  )
                ) : (
                  <div style={{
                    fontSize: '100px',
                    color: '#667eea'
                  }}>
                    💪
                  </div>
                )}
              </div>

              {playlist[currentExerciseIndex].description && (
                <div style={{
                  marginTop: '15px',
                  padding: '15px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  color: '#e0e0e0',
                  lineHeight: '1.6'
                }}>
                  <strong style={{ color: '#667eea' }}>📝 Descripción:</strong><br/>
                  {playlist[currentExerciseIndex].description}
                </div>
              )}
            </div>
          )}

          <div 
            className="reproductor-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr',
              gap: '20px',
              height: 'calc(100vh - 300px)'
            }}
          >
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
                      draggable
                      onDragStart={(e) => {
                        setDraggedPlaylistIndex(index);
                        e.currentTarget.style.opacity = '0.5';
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.style.opacity = '1';
                        setDraggedPlaylistIndex(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.borderTop = '3px solid #667eea';
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.style.borderTop = '';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.borderTop = '';
                        
                        if (draggedPlaylistIndex !== null && draggedPlaylistIndex !== index) {
                          const newPlaylist = [...playlist];
                          const draggedItem = newPlaylist[draggedPlaylistIndex];
                          newPlaylist.splice(draggedPlaylistIndex, 1);
                          newPlaylist.splice(index, 0, draggedItem);
                          
                          // Actualizar el índice actual si es necesario
                          if (currentExerciseIndex === draggedPlaylistIndex) {
                            setCurrentExerciseIndex(index);
                          } else if (currentExerciseIndex !== null) {
                            if (draggedPlaylistIndex < currentExerciseIndex && index >= currentExerciseIndex) {
                              setCurrentExerciseIndex(currentExerciseIndex - 1);
                            } else if (draggedPlaylistIndex > currentExerciseIndex && index <= currentExerciseIndex) {
                              setCurrentExerciseIndex(currentExerciseIndex + 1);
                            }
                          }
                          
                          setPlaylist(newPlaylist);
                        }
                      }}
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
                        cursor: 'move',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => {
                        setCurrentExerciseIndex(index);
                        setIsPlaying(false);
                      }}
                    >
                      <div style={{
                        color: '#999',
                        fontSize: '18px',
                        cursor: 'grab',
                        padding: '0 5px'
                      }}>
                        ☰
                      </div>
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
                          {exercise.categoryName || categories.find(c => c.id === exercise.category)?.name}
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
                    (ex.categoryName && ex.categoryName.toLowerCase().includes(exerciseSearchQuery.toLowerCase()))
                  )
                  .map((exercise) => (
                    <div
                      key={exercise.id}
                      draggable
                      onClick={() => {
                        // Click para añadir a playlist (funciona en tablets)
                        if (!playlist.find(e => e.id === exercise.id)) {
                          setPlaylist([...playlist, exercise]);
                        }
                      }}
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
                        cursor: 'pointer',
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
                          {exercise.categoryName || categories.find(c => c.id === exercise.category)?.name}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de crear/editar ejercicio */}
      {showExerciseForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
          overflow: 'auto'
        }}>
          <div style={{
            background: '#1e1e1e',
            borderRadius: '15px',
            padding: '30px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            border: '2px solid rgba(102, 126, 234, 0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '25px'
            }}>
              <h2 style={{ margin: 0, color: '#667eea', fontSize: '24px' }}>
                {editingExercise ? '✏️ Editar Ejercicio' : '➕ Crear Nuevo Ejercicio'}
              </h2>
              <button
                onClick={resetExerciseForm}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#999',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '5px 10px'
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExerciseSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#e0e0e0', fontSize: '14px', fontWeight: 'bold' }}>
                  💪 Nombre del ejercicio *
                </label>
                <input
                  type="text"
                  value={exerciseForm.name}
                  onChange={(e) => setExerciseForm({ ...exerciseForm, name: e.target.value })}
                  placeholder="Ej: Press de banca con barra"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#2d2d2d',
                    border: '2px solid #3d3d3d',
                    borderRadius: '8px',
                    color: '#e0e0e0',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#e0e0e0', fontSize: '14px', fontWeight: 'bold' }}>
                  🏷️ Categoría *
                </label>
                <select
                  value={exerciseForm.category}
                  onChange={(e) => setExerciseForm({ ...exerciseForm, category: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#2d2d2d',
                    border: '2px solid #3d3d3d',
                    borderRadius: '8px',
                    color: '#e0e0e0',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    cursor: 'pointer'
                  }}
                  required
                >
                  <option value="">Selecciona una categoría</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#e0e0e0', fontSize: '14px', fontWeight: 'bold' }}>
                  📝 Descripción
                </label>
                <textarea
                  value={exerciseForm.description}
                  onChange={(e) => setExerciseForm({ ...exerciseForm, description: e.target.value })}
                  placeholder="Instrucciones o detalles del ejercicio..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#2d2d2d',
                    border: '2px solid #3d3d3d',
                    borderRadius: '8px',
                    color: '#e0e0e0',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#e0e0e0', fontSize: '14px', fontWeight: 'bold' }}>
                  📸 Foto o 🎥 Video del Ejercicio
                </label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleExercisePhotoChange}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#2d2d2d',
                    border: '2px solid #3d3d3d',
                    borderRadius: '8px',
                    color: '#e0e0e0',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    cursor: 'pointer'
                  }}
                />
                <p style={{ color: '#888', fontSize: '12px', marginTop: '8px', marginBottom: 0 }}>
                  Sube una imagen o video explicativo del ejercicio (máx. 50MB para videos)
                </p>
                {(exerciseForm.photoPreview || exerciseForm.existingPhotoUrl) && (
                  <div style={{ marginTop: '10px', textAlign: 'center' }}>
                    {exerciseForm.mediaType === 'video' ? (
                      <video
                        src={exerciseForm.photoPreview || exerciseForm.existingPhotoUrl}
                        style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }}
                        controls
                      />
                    ) : (
                      <img
                        src={exerciseForm.photoPreview || exerciseForm.existingPhotoUrl}
                        alt="Preview"
                        style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }}
                      />
                    )}
                  </div>
                )}
              </div>

              {uploadProgress > 0 && uploadProgress < 100 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ 
                    width: '100%', 
                    height: '8px', 
                    background: '#2d2d2d', 
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      width: `${uploadProgress}%`, 
                      height: '100%', 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <p style={{ color: '#999', fontSize: '12px', marginTop: '5px', textAlign: 'center' }}>
                    Subiendo... {uploadProgress}%
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  disabled={exerciseFormLoading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: exerciseFormLoading 
                      ? '#555' 
                      : 'linear-gradient(135deg, #51cf66 0%, #40c057 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: exerciseFormLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {exerciseFormLoading ? 'Guardando...' : (editingExercise ? 'Actualizar' : 'Crear')}
                </button>
                <button
                  type="button"
                  onClick={resetExerciseForm}
                  disabled={exerciseFormLoading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#555',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: exerciseFormLoading ? 'not-allowed' : 'pointer'
                  }}
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

export default AdminPanel;
