import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, setDoc, addDoc, serverTimestamp, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import { auth, db, storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
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

interface AssignedExercise {
  machineId: string;
  machineName: string;
  machinePhotoUrl?: string;
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
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [exercises, setExercises] = useState<AssignedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Formulario para nuevo ejercicio
  const [newExercise, setNewExercise] = useState<AssignedExercise>({
    machineId: '',
    machineName: '',
    machinePhotoUrl: '',
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
    existingPhotoUrl: ''
  });
  const [machineFormLoading, setMachineFormLoading] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [machineToDelete, setMachineToDelete] = useState<Machine | null>(null);
  const [importing, setImporting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
  const [showMachinesSection, setShowMachinesSection] = useState(false);
  const [currentTableDate, setCurrentTableDate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'maquinas' | 'tablas' | null>(null);
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
      setMachineForm({
        ...machineForm,
        photoFile: file,
        photoPreview: URL.createObjectURL(file)
      });
    }
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
      existingPhotoUrl: ''
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
      existingPhotoUrl: ''
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
      existingPhotoUrl: machine.photoUrl || ''
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

      {/* Navegación de secciones */}
      <div className="admin-navigation">
        <button 
          className={`nav-tab ${activeTab === 'maquinas' ? 'active' : ''}`}
          onClick={() => setActiveTab(activeTab === 'maquinas' ? null : 'maquinas')}
        >
          {activeTab === 'maquinas' ? '✖ Cerrar' : '🏋️'} Gestión de Máquinas
        </button>
        <button 
          className={`nav-tab ${activeTab === 'tablas' ? 'active' : ''}`}
          onClick={() => setActiveTab(activeTab === 'tablas' ? null : 'tablas')}
        >
          {activeTab === 'tablas' ? '✖ Cerrar' : '📋'} Gestión de Tablas
        </button>
      </div>

      {message && (
        <div className={`admin-message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Notificaciones de solicitudes de cambio */}
      {notifications.length > 0 && (
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
        {/* Sección de Máquinas Globales (mostrar solo si activeTab === 'maquinas') */}
        {activeTab === 'maquinas' && (
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
                <input
                  type="text"
                  value={machineForm.category}
                  onChange={(e) => setMachineForm({ ...machineForm, category: e.target.value })}
                  placeholder="Ej: Pecho, Piernas, Espalda..."
                />
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
                <label>Foto (opcional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleMachinePhotoChange}
                />
                {machineForm.photoPreview && (
                  <div style={{ position: 'relative', display: 'inline-block', marginTop: '10px' }}>
                    <img src={machineForm.photoPreview} alt="Preview" className="photo-preview" />
                    <button
                      type="button"
                      onClick={() => setMachineForm({ 
                        ...machineForm, 
                        photoFile: null, 
                        photoPreview: '', 
                        existingPhotoUrl: '' 
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
                      title="Eliminar foto"
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
                    <img src={machine.photoUrl} alt={machine.name} className="machine-photo" />
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
        )}

        {/* Sección de asignación de tablas (mostrar solo si activeTab === 'tablas') */}
        {activeTab === 'tablas' && (
        <>
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
                              {exercise.machinePhotoUrl && (
                                <img 
                                  src={exercise.machinePhotoUrl} 
                                  alt={exercise.machineName} 
                                  className="machine-thumb"
                                />
                              )}
                              <div className="machine-info">
                                <strong>{exercise.machineName}</strong>
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
                  <label>Máquina</label>
                  <select
                    value={newExercise.machineId}
                    onChange={(e) => setNewExercise({ ...newExercise, machineId: e.target.value })}
                  >
                    <option value="">-- Selecciona una máquina --</option>
                    {machines
                      .sort((a, b) => (a.number || 999) - (b.number || 999))
                      .map((machine) => (
                        <option key={machine.id} value={machine.id}>
                          {machine.number ? `#${machine.number} - ` : ''}{machine.name}
                        </option>
                      ))}
                  </select>
                </div>

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
    </div>
  );
};

export default AdminPanel;
