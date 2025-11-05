import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
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
}

interface HistoryProps {
  onBack?: () => void;
}

const History: React.FC<HistoryProps> = ({ onBack }) => {
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMachine, setFilterMachine] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
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
      .filter((w) => w.machineId === machineId)
      .sort((a, b) => a.date.localeCompare(b.date));

    return machineWorkouts.map((w) => ({
      date: w.date,
      weight: w.weight,
      volume: w.sets * w.reps * w.weight
    }));
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
          <h4>Peso Total Levantado</h4>
          <p className="stat-value">
            {filteredWorkouts.reduce((sum, w) => sum + w.weight * w.sets * w.reps, 0).toFixed(0)} kg
          </p>
        </div>
        <div className="stat-card">
          <h4>Días Entrenados</h4>
          <p className="stat-value">
            {new Set(filteredWorkouts.map((w) => w.date)).size}
          </p>
        </div>
      </div>

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
