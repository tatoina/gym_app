import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './History.css';

interface WorkoutRecord {
  id: string;
  date: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  machineId: string;
  machineName: string;
  machinePhotoUrl?: string;
  createdAt: Date;
}

interface Machine {
  id: string;
  name: string;
  category?: string;
}

interface HistoryProps {
  onBack?: () => void;
  lightTheme?: boolean;
}

const History: React.FC<HistoryProps> = ({ onBack, lightTheme = false }) => {
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ sets: 0, reps: 0, weight: 0 });
  
  // Estados para secciones colapsables
  const [showExercisesSection, setShowExercisesSection] = useState(false);
  const [showGraphsSection, setShowGraphsSection] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);

      // Cargar entrenamientos (sin orderBy para evitar índice compuesto)
      const workoutsQuery = query(
        collection(db, 'workouts'),
        where('userId', '==', auth.currentUser.uid)
      );
      const workoutsSnapshot = await getDocs(workoutsQuery);
      const workoutsData: WorkoutRecord[] = workoutsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          date: data.date,
          name: data.name,
          sets: data.sets,
          reps: data.reps,
          weight: data.weight,
          machineId: data.machineId,
          machineName: data.machineName,
          machinePhotoUrl: data.machinePhotoUrl,
          createdAt: data.createdAt
        };
      });
      
      console.log('Workouts cargados:', workoutsData.length, workoutsData);
      
      // Ordenar por fecha y createdAt en el cliente
      workoutsData.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        
        // Manejar tanto Timestamps de Firestore como objetos Date
        let timeA = 0;
        let timeB = 0;
        
        if (a.createdAt) {
          if (typeof (a.createdAt as any).seconds === 'number') {
            timeA = (a.createdAt as any).seconds * 1000;
          } else if (a.createdAt instanceof Date) {
            timeA = a.createdAt.getTime();
          }
        }
        
        if (b.createdAt) {
          if (typeof (b.createdAt as any).seconds === 'number') {
            timeB = (b.createdAt as any).seconds * 1000;
          } else if (b.createdAt instanceof Date) {
            timeB = b.createdAt.getTime();
          }
        }
        
        return timeB - timeA;
      });
      
      setWorkouts(workoutsData);

      // Extraer máquinas únicas de los entrenamientos del usuario
      const uniqueMachinesMap = new Map<string, Machine>();
      workoutsData.forEach((workout) => {
        if (workout.machineId && workout.machineName) {
          uniqueMachinesMap.set(workout.machineId, {
            id: workout.machineId,
            name: workout.machineName
          });
        }
      });
      const machinesData: Machine[] = Array.from(uniqueMachinesMap.values());
      setMachines(machinesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (workout: WorkoutRecord) => {
    setEditingId(workout.id);
    setEditForm({
      sets: workout.sets,
      reps: workout.reps,
      weight: workout.weight
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ sets: 0, reps: 0, weight: 0 });
  };

  const handleSaveEdit = async (workoutId: string) => {
    try {
      const workoutRef = doc(db, 'workouts', workoutId);
      await updateDoc(workoutRef, {
        sets: editForm.sets,
        reps: editForm.reps,
        weight: editForm.weight
      });
      
      // Actualizar estado local
      setWorkouts(workouts.map(w => 
        w.id === workoutId 
          ? { ...w, sets: editForm.sets, reps: editForm.reps, weight: editForm.weight }
          : w
      ));
      
      setEditingId(null);
      alert('✅ Ejercicio actualizado');
    } catch (error) {
      console.error('Error updating workout:', error);
      alert('❌ Error al actualizar el ejercicio');
    }
  };

  const handleDelete = async (workoutId: string, machineName: string) => {
    if (!confirm(`¿Eliminar el ejercicio de ${machineName}?`)) return;
    
    try {
      await deleteDoc(doc(db, 'workouts', workoutId));
      setWorkouts(workouts.filter(w => w.id !== workoutId));
      alert('✅ Ejercicio eliminado');
    } catch (error) {
      console.error('Error deleting workout:', error);
      alert('❌ Error al eliminar el ejercicio');
    }
  };

  // Mostrar todos los entrenamientos sin filtros
  const filteredWorkouts = workouts;

  // Calcular peso máximo por máquina
  const getMaxWeightByMachine = () => {
    const maxByMachine = new Map<string, { name: string; weight: number }>();
    
    filteredWorkouts.forEach((workout) => {
      const currentWeight = Number(workout.weight) || 0;
      const existing = maxByMachine.get(workout.machineId);
      
      if (!existing || currentWeight > existing.weight) {
        maxByMachine.set(workout.machineId, {
          name: workout.machineName,
          weight: currentWeight
        });
      }
    });
    
    return Array.from(maxByMachine.values()).sort((a, b) => b.weight - a.weight);
  };

  const groupedData = (): [string, WorkoutRecord[]][] => {
    const byDate: { [date: string]: WorkoutRecord[] } = {};
    filteredWorkouts.forEach((w) => {
      if (!byDate[w.date]) byDate[w.date] = [];
      byDate[w.date].push(w);
    });
    return Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]));
  };

  // Obtener fechas con entrenamientos para el calendario
  const getDatesWithWorkouts = () => {
    const dates = new Set<string>();
    workouts.forEach(w => dates.add(w.date));
    return dates;
  };

  // Verificar si una fecha tiene entrenamientos
  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      // Usar fecha local para evitar desfase de zona horaria
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const datesWithWorkouts = getDatesWithWorkouts();
      if (datesWithWorkouts.has(dateStr)) {
        return 'has-workout';
      }
    }
    return null;
  };

  // Manejar selección de fecha en el calendario
  const handleCalendarChange = (value: any) => {
    if (value && value instanceof Date) {
      // Usar fecha local para evitar desfase de zona horaria
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      setSelectedCalendarDate(value);
      setExpandedDate(dateStr);
      
      // Scroll hacia el día seleccionado
      setTimeout(() => {
        const element = document.getElementById(`workout-date-${dateStr}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };



  // Colores dinámicos según el tema
  const chartColors = {
    grid: lightTheme ? '#e5e7eb' : '#333',
    axis: lightTheme ? '#6b7280' : '#b0b0b0',
    tooltipBg: lightTheme ? '#ffffff' : '#2d2d2d',
    tooltipBorder: lightTheme ? '#e5e7eb' : '#FFD700',
    tooltipText: lightTheme ? '#111827' : '#e0e0e0',
  };

  console.log('🎨 History lightTheme:', lightTheme, 'chartColors:', chartColors);

  if (loading) {
    return <div className="history-container"><p>Cargando historial...</p></div>;
  }

  return (
    <div className={`history-container ${lightTheme ? 'light-theme-charts' : ''}`}>
      <h2>📊 Historial y Estadísticas</h2>

      {/* Calendario */}
      <div style={{ marginTop: '20px', marginBottom: '30px' }}>
        <h3 style={{ marginBottom: '15px', textAlign: 'center' }}>📅 Calendario de Entrenamientos</h3>
        <div className="calendar-section">
          <div className="calendar-wrapper">
            <Calendar
              onChange={handleCalendarChange}
              value={selectedCalendarDate}
              tileClassName={tileClassName}
              locale="es-ES"
              formatMonthYear={(locale, date) => 
                date.toLocaleDateString(locale, { month: 'short', year: 'numeric' }).toUpperCase()
              }
            />
          </div>
          <div style={{ marginTop: '10px', fontSize: '14px', color: lightTheme ? '#6b7280' : '#b0b0b0', textAlign: 'center' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: lightTheme ? '#667eea' : '#FFD700', marginRight: '8px', borderRadius: '3px' }}></span>
            Días con entrenamientos
          </div>
        </div>
      </div>

      {/* Sección de Ejercicios por Día */}
      <div style={{ marginBottom: '30px' }}>
        <div 
          className="section-header clickable"
          onClick={() => setShowExercisesSection(!showExercisesSection)}
          style={{
            background: lightTheme ? 'linear-gradient(145deg, #ffffff 0%, #f3f4f6 100%)' : 'linear-gradient(145deg, #2d2d2d 0%, #1f1f1f 100%)',
            padding: '20px',
            borderRadius: '12px',
            border: `1px solid ${lightTheme ? '#e5e7eb' : 'rgba(255, 255, 255, 0.1)'}`,
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: showExercisesSection ? '20px' : '0'
          }}
        >
          <h3 style={{ margin: 0, color: lightTheme ? '#111827' : '#e0e0e0', fontSize: '18px' }}>
            📝 Historial de Ejercicios por Día
          </h3>
          <button 
            className="expand-button"
            style={{
              background: 'transparent',
              border: 'none',
              color: lightTheme ? '#667eea' : '#FFD700',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '5px 10px'
            }}
          >
            {showExercisesSection ? '▲' : '▼'}
          </button>
        </div>

        {showExercisesSection && (
          <div className="grouped-workouts">
            {groupedData().map(([key, records]) => {
              const isExpanded = expandedDate === key;
          const dateFormatted = new Date(key).toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          
          return (
            <div key={key} id={`workout-date-${key}`} className="workout-group">
              <div 
                className="group-header clickable"
                onClick={() => setExpandedDate(isExpanded ? null : key)}
              >
                <h4 className="group-title">
                  {dateFormatted}
                </h4>
                <div className="group-header-right">
                  <span className="exercises-count-badge">
                    {records.length} ejercicio{records.length > 1 ? 's' : ''}
                  </span>
                  <button className="expand-button">
                    {isExpanded ? '▲' : '▼'}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="exercises-detail">
                  <div className="exercises-table-container">
                    <table className="exercises-table">
                      <thead>
                        <tr>
                          <th className="col-machine">Máquina</th>
                          <th className="col-compact">S</th>
                          <th className="col-compact">R</th>
                          <th className="col-compact">P</th>
                          <th className="col-actions">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((workout) => {
                          const isEditing = editingId === workout.id;
                          return (
                            <tr key={workout.id}>
                              <td className="col-machine">
                                {workout.machineName}
                              </td>
                              <td className="col-compact">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={editForm.sets}
                                    onChange={(e) => setEditForm({ ...editForm, sets: Number(e.target.value) })}
                                    className="edit-input"
                                    min="1"
                                  />
                                ) : (
                                  workout.sets
                                )}
                              </td>
                              <td className="col-compact">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={editForm.reps}
                                    onChange={(e) => setEditForm({ ...editForm, reps: Number(e.target.value) })}
                                    className="edit-input"
                                    min="1"
                                  />
                                ) : (
                                  workout.reps
                                )}
                              </td>
                              <td className="col-compact">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={editForm.weight}
                                    onChange={(e) => setEditForm({ ...editForm, weight: Number(e.target.value) })}
                                    className="edit-input"
                                    min="0"
                                    step="0.5"
                                  />
                                ) : (
                                  workout.weight
                                )}
                              </td>
                              <td className="col-actions">
                                {isEditing ? (
                                  <div className="action-buttons">
                                    <button
                                      onClick={() => handleSaveEdit(workout.id)}
                                      className="btn-save"
                                      title="Guardar"
                                    >
                                      ✓
                                    </button>
                                    <button
                                      onClick={handleCancelEdit}
                                      className="btn-cancel"
                                      title="Cancelar"
                                    >
                                      ✗
                                    </button>
                                  </div>
                                ) : (
                                  <div className="action-buttons">
                                    <button
                                      onClick={() => handleStartEdit(workout)}
                                      className="btn-edit"
                                      title="Editar"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => handleDelete(workout.id, workout.machineName)}
                                      className="btn-delete"
                                      title="Eliminar"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
          </div>
        )}
      </div>

      {/* Sección de Gráficos de Evolución */}
      {filteredWorkouts.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <div 
            className="section-header clickable"
            onClick={() => setShowGraphsSection(!showGraphsSection)}
            style={{
              background: lightTheme ? 'linear-gradient(145deg, #ffffff 0%, #f3f4f6 100%)' : 'linear-gradient(145deg, #2d2d2d 0%, #1f1f1f 100%)',
              padding: '20px',
              borderRadius: '12px',
              border: `1px solid ${lightTheme ? '#e5e7eb' : 'rgba(255, 255, 255, 0.1)'}`,
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: showGraphsSection ? '20px' : '0'
            }}
          >
            <h3 style={{ margin: 0, color: lightTheme ? '#111827' : '#e0e0e0', fontSize: '18px' }}>
              📊 Gráficos de Evolución
            </h3>
            <button 
              className="expand-button"
              style={{
                background: 'transparent',
                border: 'none',
                color: lightTheme ? '#667eea' : '#FFD700',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '5px 10px'
              }}
            >
              {showGraphsSection ? '▲' : '▼'}
            </button>
          </div>

          {showGraphsSection && (
            <div style={{ padding: '20px 10px' }}>
              {machines.map((machine) => {
                const machineWorkouts = workouts.filter(w => w.machineId === machine.id);
                if (machineWorkouts.length === 0) return null;
                
                // Obtener peso máximo por fecha para esta máquina
                const weightsByDate = new Map<string, number>();
                machineWorkouts.forEach((w) => {
                  const weight = Number(w.weight) || 0;
                  const currentMax = weightsByDate.get(w.date) || 0;
                  if (weight > currentMax) {
                    weightsByDate.set(w.date, weight);
                  }
                });
                
                const chartData = Array.from(weightsByDate.entries())
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([date, weight]) => ({
                    date,
                    displayDate: new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
                    weight
                  }));
                
                const maxWeight = Math.max(...chartData.map(d => d.weight), 0);
                
                return (
                  <div key={machine.id} style={{ marginBottom: '30px', background: lightTheme ? '#f9fafb' : 'rgba(255, 255, 255, 0.03)', padding: '15px', borderRadius: '12px', border: `1px solid ${lightTheme ? '#e5e7eb' : 'rgba(255, 255, 255, 0.1)'}` }}>
                    <h4 style={{ margin: '0 0 15px 0', color: lightTheme ? '#111827' : '#e0e0e0', fontSize: '16px' }}>
                      🏋️ {machine.name} <span style={{ color: lightTheme ? '#667eea' : '#FFD700', fontWeight: '700' }}>- Máx: {maxWeight} kg</span>
                    </h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                        <XAxis 
                          dataKey="displayDate" 
                          stroke={chartColors.axis}
                          tick={{ fill: chartColors.axis, fontSize: 11 }}
                        />
                        <YAxis 
                          stroke={chartColors.axis}
                          tick={{ fill: chartColors.axis, fontSize: 11 }}
                          label={{ value: 'Peso (kg)', angle: -90, position: 'insideLeft', style: { fill: chartColors.axis, fontSize: 11 } }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: chartColors.tooltipBg, 
                            border: `1px solid ${chartColors.tooltipBorder}`,
                            borderRadius: '8px',
                            color: chartColors.tooltipText
                          }}
                          formatter={(value: any) => [`${value} kg`, 'Peso Máximo']}
                          labelFormatter={(label) => `Fecha: ${label}`}
                        />
                        <Bar dataKey="weight" fill={lightTheme ? '#667eea' : '#FFD700'} radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <p style={{ fontSize: '13px', color: lightTheme ? '#6b7280' : '#b0b0b0', marginTop: '10px', textAlign: 'center' }}>
                      {chartData.length} día{chartData.length > 1 ? 's' : ''} registrado{chartData.length > 1 ? 's' : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {filteredWorkouts.length === 0 && (
        <div className="no-results">
          <p>No se encontraron ejercicios registrados.</p>
        </div>
      )}
    </div>
  );
};

export default History;
