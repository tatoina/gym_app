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
  const [filterMachine, setFilterMachine] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ sets: 0, reps: 0, weight: 0 });
  
  // Estados para secciones colapsables
  const [showMaxWeights, setShowMaxWeights] = useState(true);
  const [expandedGraphDate, setExpandedGraphDate] = useState<string | null>(null);
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

  const filteredWorkouts = workouts.filter((workout) => {
    if (filterMachine && workout.machineId !== filterMachine) return false;
    if (filterDateFrom && workout.date < filterDateFrom) return false;
    if (filterDateTo && workout.date > filterDateTo) return false;
    return true;
  });

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

  // Obtener datos de peso máximo por fecha para una máquina específica
  const getMaxWeightByDate = () => {
    if (!filterMachine) return [];
    
    const machineWorkouts = filteredWorkouts.filter(w => w.machineId === filterMachine);
    const byDate = new Map<string, number>();
    
    machineWorkouts.forEach((w) => {
      const weight = Number(w.weight) || 0;
      const currentMax = byDate.get(w.date) || 0;
      if (weight > currentMax) {
        byDate.set(w.date, weight);
      }
    });
    
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, weight]) => ({
        date,
        displayDate: new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        weight
      }));
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
      const dateStr = date.toISOString().split('T')[0];
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
      const dateStr = value.toISOString().split('T')[0];
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

      <div className="filters-section">
        <h3>Filtros</h3>
        <div className="filters-grid">
          <div className="filter-group">
            <label>Máquina:</label>
            <select value={filterMachine} onChange={(e) => setFilterMachine(e.target.value)}>
              <option value="">Todas</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Desde:</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Hasta:</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Calendario */}
      <div className="calendar-section" style={{ marginTop: '20px', marginBottom: '30px' }}>
        <h3 style={{ marginBottom: '15px' }}>📅 Calendario de Entrenamientos</h3>
        <div className="calendar-wrapper">
          <Calendar
            onChange={handleCalendarChange}
            value={selectedCalendarDate}
            tileClassName={tileClassName}
            locale="es-ES"
          />
        </div>
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#b0b0b0' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#FFD700', marginRight: '8px', borderRadius: '3px' }}></span>
          Días con entrenamientos
        </div>
      </div>

      {/* Historial por día - PRIMERO */}
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

      {filteredWorkouts.length === 0 && (
        <div className="no-results">
          <p>No se encontraron ejercicios con los filtros aplicados.</p>
        </div>
      )}

      {/* Gráficos - DESPUÉS del historial */}
      {filteredWorkouts.length > 0 && (
        <>
          {/* Gráfico de evolución por máquina seleccionada */}
          {filterMachine && (
            <div className="workout-group" style={{ marginTop: '20px' }}>
              <div 
                className="group-header clickable"
                onClick={() => setExpandedGraphDate(expandedGraphDate === 'evolution' ? null : 'evolution')}
              >
                <h4 className="group-title">
                  📈 Evolución de {machines.find(m => m.id === filterMachine)?.name || 'Máquina'}
                </h4>
                <button className="expand-button">
                  {expandedGraphDate === 'evolution' ? '▲' : '▼'}
                </button>
              </div>
              {expandedGraphDate === 'evolution' && (
                <div className="exercises-detail" style={{ padding: '15px' }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={getMaxWeightByDate()}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                      <XAxis 
                        dataKey="displayDate" 
                        stroke={chartColors.axis}
                        tick={{ fill: chartColors.axis, fontSize: 12 }}
                      />
                      <YAxis 
                        stroke={chartColors.axis}
                        tick={{ fill: chartColors.axis, fontSize: 12 }}
                        label={{ value: 'Peso (kg)', angle: -90, position: 'insideLeft', style: { fill: chartColors.axis } }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: chartColors.tooltipBg, 
                          border: `1px solid ${chartColors.tooltipBorder}`,
                          borderRadius: '8px',
                          color: chartColors.tooltipText
                        }}
                        formatter={(value: any) => [`${value} kg`, 'Peso']}
                        labelFormatter={(label) => `Fecha: ${label}`}
                      />
                      <Bar dataKey="weight" fill="#FFD700" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Peso máximo por máquina */}
          <div className="workout-group" style={{ marginTop: '20px' }}>
            <div 
              className="group-header clickable"
              onClick={() => setShowMaxWeights(!showMaxWeights)}
            >
              <h4 className="group-title">
                🏆 Peso Máximo por Máquina
              </h4>
              <button className="expand-button">
                {showMaxWeights ? '▲' : '▼'}
              </button>
            </div>
            {showMaxWeights && (
              <div className="exercises-detail" style={{ padding: '15px' }}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getMaxWeightByMachine()}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                    <XAxis 
                      dataKey="name" 
                      stroke={chartColors.axis}
                      tick={{ fill: chartColors.axis, fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      stroke={chartColors.axis}
                      tick={{ fill: chartColors.axis, fontSize: 12 }}
                      label={{ value: 'Peso (kg)', angle: -90, position: 'insideLeft', style: { fill: chartColors.axis } }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: chartColors.tooltipBg, 
                        border: `1px solid ${chartColors.tooltipBorder}`,
                        borderRadius: '8px',
                        color: chartColors.tooltipText
                      }}
                      formatter={(value: any) => [`${value} kg`, 'Peso Máximo']}
                    />
                    <Bar dataKey="weight" fill="#FFD700" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default History;
