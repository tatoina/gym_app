import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
  photoUrl?: string;
}

interface AssignedExercise {
  machineId: string;
  machineName: string;
  machinePhotoUrl?: string;
  series: number;
  reps: number;
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
}

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [exercises, setExercises] = useState<AssignedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Formulario para nuevo ejercicio
  const [newExercise, setNewExercise] = useState<AssignedExercise>({
    machineId: '',
    machineName: '',
    machinePhotoUrl: '',
    series: 3,
    reps: 10,
    notes: ''
  });

  // Formulario para nueva máquina global
  const [showMachineForm, setShowMachineForm] = useState(false);
  const [machineForm, setMachineForm] = useState({
    name: '',
    description: '',
    photoFile: null as File | null,
    photoPreview: ''
  });
  const [machineFormLoading, setMachineFormLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadUserTable(selectedUserId);
    } else {
      setExercises([]);
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
      setMachines(machinesData);
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
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as AssignedTableData;
        setExercises(data.exercises || []);
      } else {
        setExercises([]);
      }
    } catch (error) {
      console.error('Error loading user table:', error);
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

      const tableData: AssignedTableData = {
        userId: selectedUserId,
        exercises: exercises,
        assignedBy: auth.currentUser.uid,
        assignedByName: currentUserData ? `${currentUserData.firstName} ${currentUserData.lastName}` : 'Monitor',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Buscar si ya existe una tabla para este usuario
      const q = query(
        collection(db, 'assignedTables'),
        where('userId', '==', selectedUserId)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        // Actualizar existente
        const docId = snapshot.docs[0].id;
        await setDoc(doc(db, 'assignedTables', docId), tableData);
      } else {
        // Crear nueva
        await addDoc(collection(db, 'assignedTables'), tableData);
      }

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

  const handleMachineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineForm.name.trim()) {
      setMessage({ type: 'error', text: 'El nombre de la máquina es obligatorio' });
      return;
    }

    try {
      setMachineFormLoading(true);
      setMessage(null);

      let photoUrl = '';
      if (machineForm.photoFile) {
        const fileRef = ref(storage, `machines/global/${Date.now()}-${machineForm.photoFile.name}`);
        await uploadBytes(fileRef, machineForm.photoFile);
        photoUrl = await getDownloadURL(fileRef);
      }

      await addDoc(collection(db, 'machines'), {
        isGlobal: true,
        name: machineForm.name.trim(),
        description: machineForm.description.trim(),
        photoUrl: photoUrl,
        createdAt: new Date()
      });

      setMessage({ type: 'success', text: 'Máquina global creada correctamente' });
      setMachineForm({ name: '', description: '', photoFile: null, photoPreview: '' });
      setShowMachineForm(false);
      await loadData();
    } catch (error) {
      console.error('Error creating global machine:', error);
      setMessage({ type: 'error', text: 'Error al crear la máquina' });
    } finally {
      setMachineFormLoading(false);
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
      <header className="admin-header">
        <h1>⚙️ Panel de Administración</h1>
        <p>Asigna tablas de ejercicios a tus usuarios</p>
      </header>

      {message && (
        <div className={`admin-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="admin-content">
        {/* Sección de Máquinas Globales */}
        <div className="global-machines-section">
          <div className="section-header">
            <h3>🏋️ Máquinas del Gimnasio ({machines.length})</h3>
            <button 
              onClick={() => setShowMachineForm(!showMachineForm)}
              className="toggle-machine-form-btn"
            >
              {showMachineForm ? '✖ Cancelar' : '➕ Nueva Máquina'}
            </button>
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
                  <img src={machineForm.photoPreview} alt="Preview" className="photo-preview" />
                )}
              </div>

              <button type="submit" disabled={machineFormLoading} className="submit-machine-btn">
                {machineFormLoading ? 'Creando...' : '💾 Crear Máquina Global'}
              </button>
            </form>
          )}

          <div className="machines-list">
            {machines.map((machine) => (
              <div key={machine.id} className="machine-card">
                {machine.photoUrl && (
                  <img src={machine.photoUrl} alt={machine.name} className="machine-photo" />
                )}
                <span className="machine-name">{machine.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="divider"></div>

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
                {user.firstName} {user.lastName} ({user.email})
              </option>
            ))}
          </select>
        </div>

        {selectedUserId && (
          <>
            <div className="exercises-builder-section">
              <h3>Tabla de {selectedUser?.firstName} {selectedUser?.lastName}</h3>

              <div className="current-exercises">
                {exercises.length === 0 ? (
                  <p className="no-exercises">No hay ejercicios asignados. Agrega ejercicios abajo.</p>
                ) : (
                  exercises.map((exercise, index) => (
                    <div key={index} className="exercise-item">
                      <div className="exercise-info">
                        {exercise.machinePhotoUrl && (
                          <img src={exercise.machinePhotoUrl} alt={exercise.machineName} className="exercise-thumb" />
                        )}
                        <div>
                          <strong>{exercise.machineName}</strong>
                          <p>{exercise.series} series × {exercise.reps} reps</p>
                          {exercise.notes && <p className="exercise-note">"{exercise.notes}"</p>}
                        </div>
                      </div>
                      <button onClick={() => removeExercise(index)} className="remove-exercise-btn">
                        ❌
                      </button>
                    </div>
                  ))
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
                    {machines.map((machine) => (
                      <option key={machine.id} value={machine.id}>
                        {machine.name}
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
                {saving ? 'Guardando...' : '💾 Guardar y Asignar Tabla'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
