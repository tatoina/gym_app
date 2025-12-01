import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
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
  // Calcular fechas por defecto: última semana
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 7);
  
  const defaultDateFrom = weekAgo.toISOString().split('T')[0];
  const defaultDateTo = today.toISOString().split('T')[0];

  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMachine, setFilterMachine] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>(defaultDateFrom);
  const [filterDateTo, setFilterDateTo] = useState<string>(defaultDateTo);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ sets: 0, reps: 0, weight: 0 });
  
  // Estados para secciones colapsables
  const [showMaxWeights, setShowMaxWeights] = useState(true);
  const [showCharts, setShowCharts] = useState(true);
  const [showHistory, setShowHistory] = useState(true);

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

  const getEvolutionData = (machineId: string) => {
    const machineWorkouts = workouts
      .filter((w) => w.machineId === machineId && w.date >= filterDateFrom && w.date <= filterDateTo)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Agrupar por fecha y obtener peso máximo de cada día
    const byDate = new Map<string, number>();
    machineWorkouts.forEach((w) => {
      const weight = Number(w.weight) || 0;
      const currentMax = byDate.get(w.date) || 0;
      if (weight > currentMax) {
        byDate.set(w.date, weight);
      }
    });

    // Convertir a array para gráfico
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, weight]) => ({
        date,
        displayDate: new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        weight
      }));
  };

  const getAllMachinesEvolutionData = () => {
    const machinesData = machines.map(machine => {
      const machineEvolution = getEvolutionData(machine.id);
      const maxWeight = Math.max(...machineEvolution.map(d => d.weight), 0);
      const workoutsCount = machineEvolution.length;
      
      return {
        machineName: machine.name,
        machineId: machine.id,
        maxWeight,
        workoutsCount,
        evolution: machineEvolution
      };
    }).filter(m => m.workoutsCount > 0);

    return machinesData.sort((a, b) => b.maxWeight - a.maxWeight);
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
      <header className="history-header">
        <h1>📊 Historial y Estadísticas</h1>
        <button onClick={() => onBack?.()} className="back-button">
          ← Volver
        </button>
      </header>

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

      {filteredWorkouts.length > 0 && (
        <div className="max-weights-by-machine">
          <h3 
            onClick={() => setShowMaxWeights(!showMaxWeights)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <span>{showMaxWeights ? '▼' : '▶'}</span>
            Peso Máximo por Máquina
          </h3>
          {showMaxWeights && (
            <div className="machine-max-grid">
              {getMaxWeightByMachine().map((machine, index) => (
                <div key={index} className="machine-max-card">
                  <span className="machine-name">{machine.name}</span>
                  <span className="machine-weight">{machine.weight.toFixed(0)} kg</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {filteredWorkouts.length > 0 && (
        <div className="evolution-charts-section">
          <h3 
            onClick={() => setShowCharts(!showCharts)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <span>{showCharts ? '▼' : '▶'}</span>
            📈 Gráficos de Evolución por Máquina
          </h3>
          
          {showCharts && (
            filterMachine ? (
              // Mostrar gráfico detallado de una máquina específica
              (() => {
                const evolutionData = getEvolutionData(filterMachine);
                const machineName = machines.find(m => m.id === filterMachine)?.name || 'Máquina';
                
                return evolutionData.length > 0 ? (
                <div className="single-machine-chart">
                  <h4>Evolución de {machineName}</h4>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={evolutionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                      <XAxis 
                        dataKey="displayDate" 
                        stroke={chartColors.axis}
                        tick={{ fill: chartColors.axis, style: { fill: chartColors.axis } }}
                      />
                      <YAxis 
                        stroke={chartColors.axis}
                        tick={{ fill: chartColors.axis, style: { fill: chartColors.axis } }}
                        label={{ value: 'Peso (kg)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: chartColors.axis } }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: chartColors.tooltipBg, 
                          border: `1px solid ${chartColors.tooltipBorder}`,
                          borderRadius: '8px',
                          color: chartColors.tooltipText
                        }}
                        formatter={(value: any, name: string) => [
                          `${value} kg`,
                          'Peso Máximo'
                        ]}
                        labelFormatter={(label) => `Fecha: ${label}`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="weight" 
                        stroke="#FFD700" 
                        strokeWidth={3}
                        dot={{ fill: '#FFD700', r: 6 }}
                        activeDot={{ r: 8, fill: '#FFA500' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="chart-legend">
                    <span className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#FFD700' }}></span>
                      Peso máximo por fecha
                    </span>
                  </div>
                </div>
                ) : (
                  <p className="no-chart-data">Se necesitan al menos 2 entrenamientos para mostrar tendencia</p>
                );
              })()
            ) : (
              // Mostrar gráficos múltiples de todas las máquinas
              <div className="multiple-machines-charts">
                {getAllMachinesEvolutionData().slice(0, 6).map((machineData) => (
                <div key={machineData.machineId} className="machine-chart-card">
                  <h4>{machineData.machineName}</h4>
                  <div className="machine-stats">
                    <span>Máx: {machineData.maxWeight}kg</span>
                    <span>{machineData.workoutsCount} entrenamientos</span>
                  </div>
                  {machineData.evolution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={machineData.evolution}>
                        <XAxis 
                          dataKey="displayDate" 
                          stroke={chartColors.axis}
                          tick={{ fontSize: 10, fill: chartColors.axis, style: { fill: chartColors.axis } }}
                          interval="preserveStartEnd"
                        />
                        <YAxis 
                          stroke={chartColors.axis}
                          tick={{ fontSize: 10, fill: chartColors.axis, style: { fill: chartColors.axis } }}
                          domain={['dataMin - 5', 'dataMax + 5']}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: chartColors.tooltipBg, 
                            border: `1px solid ${chartColors.tooltipBorder}`,
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: chartColors.tooltipText
                          }}
                          formatter={(value) => [`${value} kg`, 'Peso']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="weight" 
                          stroke="#FFD700" 
                          strokeWidth={2}
                          dot={{ fill: '#FFD700', r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="single-point-chart">
                      <span>Solo 1 entrenamiento registrado</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            )
          )}
        </div>
      )}

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
            <div key={key} className="workout-group">
              <div 
                className="group-header clickable"
                onClick={() => setExpandedDate(isExpanded ? null : key)}
              >
                <h3 className="group-title">
                  📋 {dateFormatted}
                </h3>
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
                          <th className="col-photo">Foto</th>
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
                              <td className="col-photo">
                                {workout.machinePhotoUrl ? (
                                  <img
                                    src={workout.machinePhotoUrl}
                                    alt={workout.machineName}
                                    className="machine-thumb"
                                  />
                                ) : (
                                  <span className="no-photo">-</span>
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
    </div>
  );
};

export default History;
