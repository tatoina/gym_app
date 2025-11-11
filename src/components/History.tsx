import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
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
}

const History: React.FC<HistoryProps> = ({ onBack }) => {
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
  const [groupBy, setGroupBy] = useState<'date' | 'machine'>('date');

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
    if (groupBy === 'date') {
      const byDate: { [date: string]: WorkoutRecord[] } = {};
      filteredWorkouts.forEach((w) => {
        if (!byDate[w.date]) byDate[w.date] = [];
        byDate[w.date].push(w);
      });
      return Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]));
    } else {
      const byMachine: { [machineId: string]: WorkoutRecord[] } = {};
      filteredWorkouts.forEach((w) => {
        if (!byMachine[w.machineId]) byMachine[w.machineId] = [];
        byMachine[w.machineId].push(w);
      });
      return Object.entries(byMachine).map(([machineId, records]) => [
        records[0].machineName,
        records
      ] as [string, WorkoutRecord[]]);
    }
  };

  const getEvolutionData = (machineId: string) => {
    const machineWorkouts = workouts
      .filter((w) => w.machineId === machineId && w.date >= filterDateFrom && w.date <= filterDateTo)
      .sort((a, b) => a.date.localeCompare(b.date));

    return machineWorkouts.map((w, index) => ({
      date: w.date,
      displayDate: new Date(w.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
      weight: Number(w.weight) || 0,
      volume: (Number(w.sets) || 0) * (Number(w.reps) || 0) * (Number(w.weight) || 0),
      sets: w.sets,
      reps: w.reps,
      ejercicio: index + 1
    }));
  };

  const getAllMachinesEvolutionData = () => {
    const machinesData = machines.map(machine => {
      const machineEvolution = getEvolutionData(machine.id);
      const maxWeight = Math.max(...machineEvolution.map(d => d.weight), 0);
      const totalVolume = machineEvolution.reduce((sum, d) => sum + d.volume, 0);
      const workoutsCount = machineEvolution.length;
      
      return {
        machineName: machine.name,
        machineId: machine.id,
        maxWeight,
        totalVolume,
        workoutsCount,
        evolution: machineEvolution
      };
    }).filter(m => m.workoutsCount > 0);

    return machinesData.sort((a, b) => b.maxWeight - a.maxWeight);
  };

  if (loading) {
    return <div className="history-container"><p>Cargando historial...</p></div>;
  }

  return (
    <div className="history-container">
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

          <div className="filter-group">
            <label>Agrupar por:</label>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'date' | 'machine')}>
              <option value="date">Fecha</option>
              <option value="machine">Máquina</option>
            </select>
          </div>
        </div>
      </div>

      <div className="stats-summary">
        <div className="stat-card">
          <h4>Total Ejercicios</h4>
          <p className="stat-value">{filteredWorkouts.length}</p>
        </div>
        <div className="stat-card">
          <h4>Peso Máximo Alcanzado</h4>
          <p className="stat-value">
            {filteredWorkouts.length > 0 
              ? Math.max(...filteredWorkouts.map(w => Number(w.weight) || 0)).toFixed(0)
              : 0} kg
          </p>
        </div>
        <div className="stat-card">
          <h4>Días Entrenados</h4>
          <p className="stat-value">
            {new Set(filteredWorkouts.map((w) => w.date)).size}
          </p>
        </div>
      </div>

      {filteredWorkouts.length > 0 && (
        <div className="max-weights-by-machine">
          <h3>Peso Máximo por Máquina</h3>
          <div className="machine-max-grid">
            {getMaxWeightByMachine().map((machine, index) => (
              <div key={index} className="machine-max-card">
                <span className="machine-name">{machine.name}</span>
                <span className="machine-weight">{machine.weight.toFixed(0)} kg</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredWorkouts.length > 0 && (
        <div className="evolution-charts-section">
          <h3>📈 Gráficos de Evolución por Máquina</h3>
          
          {filterMachine ? (
            // Mostrar gráfico detallado de una máquina específica
            (() => {
              const evolutionData = getEvolutionData(filterMachine);
              const machineName = machines.find(m => m.id === filterMachine)?.name || 'Máquina';
              
              return evolutionData.length > 1 ? (
                <div className="single-machine-chart">
                  <h4>Evolución de {machineName}</h4>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={evolutionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis 
                        dataKey="displayDate" 
                        stroke="#b0b0b0"
                        tick={{ fill: '#b0b0b0' }}
                      />
                      <YAxis 
                        stroke="#b0b0b0"
                        tick={{ fill: '#b0b0b0' }}
                        label={{ value: 'Peso (kg)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#b0b0b0' } }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#2d2d2d', 
                          border: '1px solid #FFD700',
                          borderRadius: '8px',
                          color: '#e0e0e0'
                        }}
                        formatter={(value: any, name: string) => [
                          `${value}${name === 'weight' ? ' kg' : name === 'volume' ? ' kg*rep' : ''}`,
                          name === 'weight' ? 'Peso' : name === 'volume' ? 'Volumen' : name
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
                      <Line 
                        type="monotone" 
                        dataKey="volume" 
                        stroke="#00bcd4" 
                        strokeWidth={2}
                        dot={{ fill: '#00bcd4', r: 4 }}
                        opacity={0.7}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="chart-legend">
                    <span className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#FFD700' }}></span>
                      Peso máximo por sesión
                    </span>
                    <span className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#00bcd4' }}></span>
                      Volumen total (sets × reps × peso)
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
                  {machineData.evolution.length > 1 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={machineData.evolution}>
                        <XAxis 
                          dataKey="displayDate" 
                          stroke="#b0b0b0"
                          tick={{ fontSize: 10, fill: '#b0b0b0' }}
                          interval="preserveStartEnd"
                        />
                        <YAxis 
                          stroke="#b0b0b0"
                          tick={{ fontSize: 10, fill: '#b0b0b0' }}
                          domain={['dataMin - 5', 'dataMax + 5']}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#2d2d2d', 
                            border: '1px solid #FFD700',
                            borderRadius: '4px',
                            fontSize: '12px'
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
          )}
        </div>
      )}

      <div className="grouped-workouts">
        {groupedData().map(([key, records]) => {
          return (
            <div key={key} className="workout-group">
              <h3 className="group-title">
                {groupBy === 'date'
                  ? new Date(key).toLocaleDateString('es-ES', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : key}
              </h3>

              {groupBy === 'machine' && records.length > 0 && (
                <div className="evolution-chart">
                  <h4>Evolución de peso</h4>
                  <div className="chart-container">
                    {getEvolutionData(records[0].machineId).map((point, idx) => (
                      <div key={idx} className="chart-point">
                        <div className="chart-bar" style={{ height: `${(point.weight / 100) * 150}px` }}>
                          <span className="chart-value">{point.weight}kg</span>
                        </div>
                        <span className="chart-label">{new Date(point.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="workout-records-list">
                {records.map((workout) => (
                  <div key={workout.id} className="workout-record">
                    {workout.machinePhotoUrl && (
                      <img
                        src={workout.machinePhotoUrl}
                        alt={workout.machineName}
                        className="workout-record-photo"
                      />
                    )}
                    <div className="workout-record-info">
                      <strong>{workout.name}</strong>
                      <p className="workout-record-machine">{workout.machineName}</p>
                      {groupBy === 'machine' && (
                        <p className="workout-record-date">
                          {new Date(workout.date).toLocaleDateString('es-ES')}
                        </p>
                      )}
                    </div>
                    <div className="workout-record-stats">
                      <span>{workout.sets} × {workout.reps}</span>
                      <span className="weight-badge">{workout.weight} kg</span>
                    </div>
                  </div>
                ))}
              </div>
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
