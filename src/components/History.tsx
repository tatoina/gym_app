import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, LineChart, Line, Area, AreaChart } from 'recharts';
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
  user: User | null;
}

const History: React.FC<HistoryProps> = ({ onBack, lightTheme = false, user }) => {
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
  const [showEvolutionSection, setShowEvolutionSection] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<string>('');

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Cargar entrenamientos (sin orderBy para evitar índice compuesto)
      const workoutsQuery = query(
        collection(db, 'workouts'),
        where('userId', '==', user.uid)
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

  // Obtener evolución de un ejercicio específico con más métricas
  const getExerciseEvolution = (machineId: string) => {
    if (!machineId) return [];
    
    const exerciseWorkouts = workouts
      .filter(w => w.machineId === machineId)
      .sort((a, b) => a.date.localeCompare(b.date)); // Ordenar de más antiguo a más reciente
    
    return exerciseWorkouts.map(w => ({
      date: new Date(w.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
      peso: w.weight,
      series: w.sets,
      reps: w.reps,
      volumen: (w.sets * w.reps * w.weight), // Volumen total
      fullDate: w.date
    }));
  };

  // Obtener estadísticas del ejercicio
  const getExerciseStats = (machineId: string) => {
    const evolution = getExerciseEvolution(machineId);
    if (evolution.length === 0) return null;

    const pesos = evolution.map(e => e.peso);
    const volumenes = evolution.map(e => e.volumen);
    
    const pesoMax = Math.max(...pesos);
    const pesoMin = Math.min(...pesos);
    const pesoPromedio = pesos.reduce((a, b) => a + b, 0) / pesos.length;
    const volumenTotal = volumenes.reduce((a, b) => a + b, 0);
    const volumenPromedio = volumenTotal / volumenes.length;
    
    // Calcular progreso (comparar primera y última sesión)
    const primerPeso = pesos[0];
    const ultimoPeso = pesos[pesos.length - 1];
    const progresoPeso = ultimoPeso - primerPeso;
    const progresoPorc = primerPeso > 0 ? ((progresoPeso / primerPeso) * 100) : 0;

    return {
      pesoMax,
      pesoMin,
      pesoPromedio: Math.round(pesoPromedio * 10) / 10,
      volumenTotal: Math.round(volumenTotal),
      volumenPromedio: Math.round(volumenPromedio),
      progresoPeso: Math.round(progresoPeso * 10) / 10,
      progresoPorc: Math.round(progresoPorc * 10) / 10,
      totalSesiones: evolution.length
    };
  };

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

      {/* Sección de Evolución por Ejercicio */}
      <div style={{ marginBottom: '30px' }}>
        <div 
          onClick={() => setShowEvolutionSection(!showEvolutionSection)}
          style={{
            background: lightTheme ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '20px',
            borderRadius: '12px',
            border: `2px solid ${lightTheme ? '#667eea' : 'rgba(102, 126, 234, 0.5)'}`,
            marginBottom: showEvolutionSection ? '20px' : '0',
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.3)';
          }}
        >
          <div>
            <h3 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
              📈 Análisis por Ejercicio
            </h3>
            <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)' }}>
              Selecciona un ejercicio para ver su evolución detallada
            </p>
          </div>
          <div style={{ 
            fontSize: '24px', 
            color: 'white',
            transition: 'transform 0.3s ease',
            transform: showEvolutionSection ? 'rotate(180deg)' : 'rotate(0deg)'
          }}>
            ▼
          </div>
        </div>

        {showEvolutionSection && (
        <div style={{
            background: lightTheme ? 'linear-gradient(145deg, #ffffff 0%, #f3f4f6 100%)' : 'linear-gradient(145deg, #2d2d2d 0%, #1f1f1f 100%)',
            padding: '20px',
            borderRadius: '12px',
            border: `1px solid ${lightTheme ? '#e5e7eb' : 'rgba(255, 255, 255, 0.1)'}`,
            marginTop: '10px'
          }}>
            {/* Selector de ejercicio */}
            <div style={{ marginBottom: '25px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '10px', 
                color: lightTheme ? '#111827' : '#e0e0e0',
                fontWeight: 700,
                fontSize: '15px'
              }}>
                🏋️ Selecciona un ejercicio:
              </label>
              <select
                value={selectedExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: `2px solid ${lightTheme ? '#667eea' : 'rgba(102, 126, 234, 0.6)'}`,
                  background: lightTheme ? '#f8f9ff' : '#1a1a2e',
                  color: lightTheme ? '#1a1a2e' : '#ffffff',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: lightTheme ? '0 2px 8px rgba(102, 126, 234, 0.15)' : '0 2px 8px rgba(102, 126, 234, 0.3)'
                }}
              >
                <option value="" style={{ background: lightTheme ? '#ffffff' : '#1a1a2e', color: lightTheme ? '#6b7280' : '#999' }}>
                  -- Selecciona un ejercicio para ver su evolución --
                </option>
                {machines
                  .sort((a, b) => {
                    const countA = workouts.filter(w => w.machineId === a.id).length;
                    const countB = workouts.filter(w => w.machineId === b.id).length;
                    return countB - countA;
                  })
                  .map((machine) => {
                    const count = workouts.filter(w => w.machineId === machine.id).length;
                    return (
                      <option 
                        key={machine.id} 
                        value={machine.id}
                        style={{ 
                          background: lightTheme ? '#ffffff' : '#1a1a2e', 
                          color: lightTheme ? '#111827' : '#ffffff',
                          padding: '10px'
                        }}
                      >
                        {machine.name} ({count} sesiones)
                      </option>
                    );
                  })}
              </select>
            </div>

            {/* Gráfico de evolución */}
            {selectedExercise && getExerciseEvolution(selectedExercise).length > 0 ? (
              <>
                {/* Estadísticas resumidas */}
                {(() => {
                  const stats = getExerciseStats(selectedExercise);
                  const selectedMachine = machines.find(m => m.id === selectedExercise);
                  
                  return stats ? (
                    <div style={{ 
                      marginBottom: '25px',
                      padding: '20px',
                      background: lightTheme ? '#f0f9ff' : 'rgba(102, 126, 234, 0.1)',
                      borderRadius: '12px',
                      border: `2px solid ${lightTheme ? '#3b82f6' : 'rgba(102, 126, 234, 0.3)'}`
                    }}>
                      <h4 style={{ 
                        margin: '0 0 15px 0', 
                        color: lightTheme ? '#1e40af' : '#667eea',
                        fontSize: '18px',
                        fontWeight: 'bold'
                      }}>
                        📊 {selectedMachine?.name}
                      </h4>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: '15px'
                      }}>
                        <div style={{
                          background: lightTheme ? 'white' : 'rgba(0, 0, 0, 0.3)',
                          padding: '12px',
                          borderRadius: '8px',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '24px', fontWeight: 'bold', color: lightTheme ? '#059669' : '#51cf66' }}>
                            {stats.pesoMax} kg
                          </div>
                          <div style={{ fontSize: '12px', color: lightTheme ? '#6b7280' : '#b0b0b0', marginTop: '4px' }}>
                            Peso Máximo
                          </div>
                        </div>
                        <div style={{
                          background: lightTheme ? 'white' : 'rgba(0, 0, 0, 0.3)',
                          padding: '12px',
                          borderRadius: '8px',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '24px', fontWeight: 'bold', color: lightTheme ? '#2563eb' : '#667eea' }}>
                            {stats.pesoPromedio} kg
                          </div>
                          <div style={{ fontSize: '12px', color: lightTheme ? '#6b7280' : '#b0b0b0', marginTop: '4px' }}>
                            Peso Promedio
                          </div>
                        </div>
                        <div style={{
                          background: lightTheme ? 'white' : 'rgba(0, 0, 0, 0.3)',
                          padding: '12px',
                          borderRadius: '8px',
                          textAlign: 'center'
                        }}>
                          <div style={{ 
                            fontSize: '24px', 
                            fontWeight: 'bold', 
                            color: stats.progresoPeso >= 0 
                              ? (lightTheme ? '#059669' : '#51cf66') 
                              : (lightTheme ? '#dc2626' : '#ff6b6b')
                          }}>
                            {stats.progresoPeso > 0 ? '+' : ''}{stats.progresoPeso} kg
                          </div>
                          <div style={{ fontSize: '12px', color: lightTheme ? '#6b7280' : '#b0b0b0', marginTop: '4px' }}>
                            Progreso ({stats.progresoPorc > 0 ? '+' : ''}{stats.progresoPorc}%)
                          </div>
                        </div>
                        <div style={{
                          background: lightTheme ? 'white' : 'rgba(0, 0, 0, 0.3)',
                          padding: '12px',
                          borderRadius: '8px',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '24px', fontWeight: 'bold', color: lightTheme ? '#7c3aed' : '#f093fb' }}>
                            {stats.totalSesiones}
                          </div>
                          <div style={{ fontSize: '12px', color: lightTheme ? '#6b7280' : '#b0b0b0', marginTop: '4px' }}>
                            Sesiones
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Gráficos de evolución */}
                <div style={{ marginBottom: '30px' }}>
                  <h4 style={{ 
                    margin: '0 0 20px 0', 
                    color: lightTheme ? '#111827' : '#e0e0e0',
                    fontSize: '16px',
                    fontWeight: '600'
                  }}>
                    📊 Evolución del Peso
                  </h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={getExerciseEvolution(selectedExercise)}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                      <XAxis 
                        dataKey="date" 
                        stroke={chartColors.axis}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke={chartColors.axis}
                        style={{ fontSize: '12px' }}
                        label={{ value: 'Peso (kg)', angle: -90, position: 'insideLeft', fill: chartColors.axis }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: chartColors.tooltipBg,
                          border: `1px solid ${chartColors.tooltipBorder}`,
                          borderRadius: '8px',
                          color: chartColors.tooltipText
                        }}
                        formatter={(value: any, name: string) => {
                          if (name === 'peso') return [`${value} kg`, 'Peso'];
                          return [value, name];
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="peso" 
                        stroke={lightTheme ? '#3b82f6' : '#FFD700'} 
                        strokeWidth={3}
                        dot={{ fill: lightTheme ? '#3b82f6' : '#FFD700', r: 5 }}
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Gráfico de Volumen Total */}
                <div style={{ marginBottom: '30px' }}>
                  <h4 style={{ 
                    margin: '0 0 20px 0', 
                    color: lightTheme ? '#111827' : '#e0e0e0',
                    fontSize: '16px',
                    fontWeight: '600'
                  }}>
                    💪 Volumen Total (Series × Reps × Peso)
                  </h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={getExerciseEvolution(selectedExercise)}>
                      <defs>
                        <linearGradient id="colorVolumen" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={lightTheme ? '#8b5cf6' : '#f093fb'} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={lightTheme ? '#8b5cf6' : '#f093fb'} stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                      <XAxis 
                        dataKey="date" 
                        stroke={chartColors.axis}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke={chartColors.axis}
                        style={{ fontSize: '12px' }}
                        label={{ value: 'Volumen (kg)', angle: -90, position: 'insideLeft', fill: chartColors.axis }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: chartColors.tooltipBg,
                          border: `1px solid ${chartColors.tooltipBorder}`,
                          borderRadius: '8px',
                          color: chartColors.tooltipText
                        }}
                        formatter={(value: any) => [`${value} kg`, 'Volumen Total']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="volumen" 
                        stroke={lightTheme ? '#8b5cf6' : '#f093fb'}
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorVolumen)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Gráfico de Series y Repeticiones */}
                <div style={{ marginBottom: '30px' }}>
                  <h4 style={{ 
                    margin: '0 0 20px 0', 
                    color: lightTheme ? '#111827' : '#e0e0e0',
                    fontSize: '16px',
                    fontWeight: '600'
                  }}>
                    🔢 Series y Repeticiones
                  </h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={getExerciseEvolution(selectedExercise)}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                      <XAxis 
                        dataKey="date" 
                        stroke={chartColors.axis}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke={chartColors.axis}
                        style={{ fontSize: '12px' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: chartColors.tooltipBg,
                          border: `1px solid ${chartColors.tooltipBorder}`,
                          borderRadius: '8px',
                          color: chartColors.tooltipText
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="series" 
                        stroke={lightTheme ? '#10b981' : '#51cf66'} 
                        strokeWidth={2}
                        dot={{ fill: lightTheme ? '#10b981' : '#51cf66', r: 4 }}
                        name="Series"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="reps" 
                        stroke={lightTheme ? '#f59e0b' : '#ffa94d'} 
                        strokeWidth={2}
                        dot={{ fill: lightTheme ? '#f59e0b' : '#ffa94d', r: 4 }}
                        name="Repeticiones"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Tabla de evolución */}
                <div style={{ marginTop: '30px' }}>
                  <h4 style={{ 
                    margin: '0 0 15px 0', 
                    color: lightTheme ? '#111827' : '#e0e0e0',
                    fontSize: '16px'
                  }}>
                    Historial Detallado
                  </h4>
                  <div className="exercises-table-container">
                    <table className="exercises-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th className="col-compact">S</th>
                          <th className="col-compact">R</th>
                          <th className="col-compact">P</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workouts
                          .filter(w => w.machineId === selectedExercise)
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((workout) => (
                            <tr key={workout.id}>
                              <td>
                                {new Date(workout.date).toLocaleDateString('es-ES', {
                                  weekday: 'short',
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="col-compact">{workout.sets}</td>
                              <td className="col-compact">{workout.reps}</td>
                              <td className="col-compact">{workout.weight}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : selectedExercise ? (
              <p style={{ 
                textAlign: 'center', 
                color: lightTheme ? '#6b7280' : '#b0b0b0',
                padding: '40px 20px'
              }}>
                No hay registros para este ejercicio
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* Sección de Ejercicios por Día */}
      <div style={{ marginBottom: '30px' }}>
        <div 
          onClick={() => setShowExercisesSection(!showExercisesSection)}
          style={{
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            padding: '20px',
            borderRadius: '12px',
            border: `2px solid ${lightTheme ? '#f5576c' : 'rgba(245, 87, 108, 0.5)'}`,
            marginBottom: showExercisesSection ? '20px' : '0',
            boxShadow: '0 4px 15px rgba(245, 87, 108, 0.3)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(245, 87, 108, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(245, 87, 108, 0.3)';
          }}
        >
          <div>
            <h3 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
              📝 Historial de Ejercicios por Día
            </h3>
            <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)' }}>
              Consulta tus entrenamientos organizados por fecha
            </p>
          </div>
          <div style={{ 
            fontSize: '24px', 
            color: 'white',
            transition: 'transform 0.3s ease',
            transform: showExercisesSection ? 'rotate(180deg)' : 'rotate(0deg)'
          }}>
            ▼
          </div>
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
                          <th className="col-machine">Ejercicio</th>
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

      {/* Sección de Gráficos de Evolución - Vista General */}
      {filteredWorkouts.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <div 
            onClick={() => setShowGraphsSection(!showGraphsSection)}
            style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              padding: '20px',
              borderRadius: '12px',
              border: `2px solid ${lightTheme ? '#4facfe' : 'rgba(79, 172, 254, 0.5)'}`,
              marginBottom: showGraphsSection ? '20px' : '0',
              boxShadow: '0 4px 15px rgba(79, 172, 254, 0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(79, 172, 254, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(79, 172, 254, 0.3)';
            }}
          >
            <div>
              <h3 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
                📊 Vista General de Progreso
              </h3>
              <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)' }}>
                Resumen rápido de todos tus ejercicios
              </p>
            </div>
            <div style={{ 
              fontSize: '24px', 
              color: 'white',
              transition: 'transform 0.3s ease',
              transform: showGraphsSection ? 'rotate(180deg)' : 'rotate(0deg)'
            }}>
              ▼
            </div>
          </div>

          {showGraphsSection && (
          <div style={{ padding: '20px 10px' }}>
            {machines
              .sort((a, b) => {
                  const countA = workouts.filter(w => w.machineId === a.id).length;
                  const countB = workouts.filter(w => w.machineId === b.id).length;
                  return countB - countA;
                })
                .map((machine) => {
                const machineWorkouts = workouts.filter(w => w.machineId === machine.id);
                if (machineWorkouts.length === 0) return null;
                
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
                const minWeight = Math.min(...chartData.map(d => d.weight), 0);
                const avgWeight = chartData.reduce((sum, d) => sum + d.weight, 0) / chartData.length;
                const progreso = chartData.length > 1 ? chartData[chartData.length - 1].weight - chartData[0].weight : 0;
                
                return (
                  <div 
                    key={machine.id} 
                    style={{ 
                      marginBottom: '30px', 
                      background: lightTheme ? '#ffffff' : 'rgba(255, 255, 255, 0.03)', 
                      padding: '20px', 
                      borderRadius: '12px', 
                      border: `1px solid ${lightTheme ? '#e5e7eb' : 'rgba(255, 255, 255, 0.1)'}`,
                      boxShadow: lightTheme ? '0 2px 8px rgba(0,0,0,0.05)' : '0 2px 8px rgba(0,0,0,0.2)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                      <h4 style={{ margin: 0, color: lightTheme ? '#111827' : '#e0e0e0', fontSize: '18px', fontWeight: 'bold' }}>
                        🏋️ {machine.name}
                      </h4>
                      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '11px', color: lightTheme ? '#6b7280' : '#888', marginBottom: '2px' }}>MÁX</div>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', color: lightTheme ? '#059669' : '#51cf66' }}>{maxWeight} kg</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '11px', color: lightTheme ? '#6b7280' : '#888', marginBottom: '2px' }}>PROM</div>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', color: lightTheme ? '#2563eb' : '#667eea' }}>{Math.round(avgWeight * 10) / 10} kg</div>
                        </div>
                        {chartData.length > 1 && (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: lightTheme ? '#6b7280' : '#888', marginBottom: '2px' }}>PROGRESO</div>
                            <div style={{ 
                              fontSize: '16px', 
                              fontWeight: 'bold', 
                              color: progreso >= 0 ? (lightTheme ? '#059669' : '#51cf66') : (lightTheme ? '#dc2626' : '#ff6b6b')
                            }}>
                              {progreso > 0 ? '+' : ''}{Math.round(progreso * 10) / 10} kg
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                        <XAxis 
                          dataKey="displayDate" 
                          stroke={chartColors.axis}
                          tick={{ fill: chartColors.axis, fontSize: 10 }}
                        />
                        <YAxis 
                          stroke={chartColors.axis}
                          tick={{ fill: chartColors.axis, fontSize: 10 }}
                          domain={[Math.max(0, minWeight - 5), maxWeight + 5]}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: chartColors.tooltipBg, 
                            border: `1px solid ${chartColors.tooltipBorder}`,
                            borderRadius: '8px',
                            color: chartColors.tooltipText,
                            fontSize: '12px'
                          }}
                          formatter={(value: any) => [`${value} kg`, 'Peso']}
                          labelFormatter={(label) => `Fecha: ${label}`}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="weight" 
                          stroke={lightTheme ? '#3b82f6' : '#FFD700'} 
                          strokeWidth={3}
                          dot={{ fill: lightTheme ? '#3b82f6' : '#FFD700', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    
                    <p style={{ 
                      fontSize: '12px', 
                      color: lightTheme ? '#6b7280' : '#888', 
                      marginTop: '10px', 
                      textAlign: 'center',
                      fontStyle: 'italic'
                    }}>
                      {chartData.length} sesión{chartData.length > 1 ? 'es' : ''} registrada{chartData.length > 1 ? 's' : ''}
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
