import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import './TablesHistory.css';

interface AssignedExercise {
  // Nuevo formato con categorías
  categoryId?: string;
  categoryName?: string;
  // Formato antiguo con máquinas (para compatibilidad)
  machineId?: string;
  machineName?: string;
  machinePhotoUrl?: string;
  // Campos del ejercicio específico
  exerciseId?: string;
  exerciseName?: string;
  exercisePhotoUrl?: string;
  // Métricas
  series: number;
  reps: number;
  weight?: number;
  notes?: string;
}

interface CompletedTable {
  id: string;
  userId: string;
  exercises: AssignedExercise[];
  assignedBy: string;
  assignedByName: string;
  createdAt: any;
  updatedAt: any;
  status: 'COMPLETADA';
  completedAt?: any;
}

interface TablesHistoryProps {
  onBack?: () => void;
  user: User | null;
}

const TablesHistory: React.FC<TablesHistoryProps> = ({ onBack, user }) => {
  const [completedTables, setCompletedTables] = useState<CompletedTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTableId, setExpandedTableId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadCompletedTables();
    }
  }, [user]);

  const loadCompletedTables = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const q = query(
        collection(db, 'assignedTables'),
        where('userId', '==', user.uid),
        where('status', '==', 'COMPLETADA')
      );
      
      const snapshot = await getDocs(q);
      
      const tables: CompletedTable[] = [];
      snapshot.forEach((doc) => {
        tables.push({
          id: doc.id,
          ...(doc.data() as Omit<CompletedTable, 'id'>)
        });
      });
      
      // Ordenar manualmente por fecha de actualización (más reciente primero)
      tables.sort((a, b) => {
        const aTime = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
        const bTime = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      
      setCompletedTables(tables);
    } catch (error) {
      console.error('Error loading completed tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    try {
      if (!timestamp) return 'No disponible';
      
      let date;
      if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else {
        date = new Date(timestamp);
      }
      
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'No disponible';
    }
  };

  if (loading) {
    return (
      <div className="tables-history-container">
        <p>Cargando historial de tablas...</p>
      </div>
    );
  }

  if (completedTables.length === 0) {
    return (
      <div className="tables-history-container">
        <header className="history-header">
          <div>
            <h1>📚 Historial de Tablas</h1>
          </div>
          <button onClick={() => onBack?.()} className="back-button">
            ← Volver
          </button>
        </header>
        <div className="empty-state">
          <h2>Sin Tablas Completadas</h2>
          <p>Aún no has completado ninguna tabla de ejercicios.</p>
          <p>Las tablas que marques como completadas aparecerán aquí.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tables-history-container">
      <header className="history-header">
        <div>
          <h1>📚 Historial de Tablas</h1>
          <p className="history-count">{completedTables.length} tabla{completedTables.length > 1 ? 's' : ''} completada{completedTables.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => onBack?.()} className="back-button">
          ← Volver
        </button>
      </header>

      {completedTables.map((table) => {
        const isExpanded = expandedTableId === table.id;
        
        return (
          <div key={table.id} className="completed-table-card">
            <div 
              className="table-header clickable"
              onClick={() => setExpandedTableId(isExpanded ? null : table.id)}
              style={{ 
                cursor: 'pointer',
                padding: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '15px',
                flexWrap: 'wrap',
                minHeight: '70px'
              }}
            >
              <div className="table-info" style={{ flex: '1 1 200px' }}>
                <h2 style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '18px', 
                  fontWeight: 'bold',
                  color: '#e0e0e0'
                }}>
                  📋 Tabla del {formatDate(table.createdAt)}
                </h2>
                <p className="assigned-by" style={{ margin: 0, fontSize: '14px', color: '#b0b0b0' }}>
                  Por: <strong>{table.assignedByName}</strong> • {table.exercises.length} ejercicio{table.exercises.length > 1 ? 's' : ''}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button 
                  className="expand-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedTableId(isExpanded ? null : table.id);
                  }}
                  style={{
                    padding: '12px 20px',
                    background: isExpanded ? 'rgba(102, 126, 234, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                    border: '2px solid rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '15px',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    minWidth: '140px',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {isExpanded ? '▲ Ocultar' : '▼ Ver Ejercicios'}
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="exercises-detail">
                <table className="exercises-table">
                  <thead>
                    <tr>
                      <th>Categoría / Ejercicio</th>
                      <th className="col-compact">S</th>
                      <th className="col-compact">R</th>
                      <th className="col-compact">P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.exercises.map((exercise: AssignedExercise, index: number) => {
                      // Determinar qué nombre mostrar (nuevo formato o antiguo)
                      const displayName = exercise.categoryName || exercise.machineName || 'Sin categoría';
                      const photoUrl = exercise.exercisePhotoUrl || exercise.machinePhotoUrl;
                      
                      return (
                      <tr key={index}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {photoUrl && (
                              <img 
                                src={photoUrl} 
                                alt={displayName}
                                style={{ width: '35px', height: '35px', objectFit: 'cover', borderRadius: '4px' }}
                              />
                            )}
                            <div>
                              <strong>{displayName}</strong>
                              {exercise.exerciseName && (
                                <div style={{ fontSize: '11px', color: '#667eea', marginTop: '2px' }}>
                                  💪 {exercise.exerciseName}
                                </div>
                              )}
                              {exercise.notes && (
                                <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                                  💡 {exercise.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="col-compact">{exercise.series}</td>
                        <td className="col-compact">{exercise.reps}</td>
                        <td className="col-compact" style={{ color: (exercise as any).weight ? '#fff' : '#888' }}>
                          {(exercise as any).weight || '-'}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TablesHistory;