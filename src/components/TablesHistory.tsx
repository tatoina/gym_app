import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import './TablesHistory.css';

interface AssignedExercise {
  machineId: string;
  machineName: string;
  machinePhotoUrl?: string;
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
}

const TablesHistory: React.FC<TablesHistoryProps> = ({ onBack }) => {
  const [completedTables, setCompletedTables] = useState<CompletedTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTableId, setExpandedTableId] = useState<string | null>(null);

  useEffect(() => {
    loadCompletedTables();
  }, []);

  const loadCompletedTables = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const q = query(
        collection(db, 'assignedTables'),
        where('userId', '==', auth.currentUser.uid),
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
              style={{ cursor: 'pointer' }}
            >
              <div className="table-info">
                <h2>📋 Tabla del {formatDate(table.createdAt)}</h2>
                <p className="assigned-by">
                  Por: <strong>{table.assignedByName}</strong> • {table.exercises.length} ejercicios
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="status-badge status-completed">✅ Anterior</span>
                <button 
                  className="expand-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedTableId(isExpanded ? null : table.id);
                  }}
                >
                  {isExpanded ? '▲' : '▼'}
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="exercises-detail">
                <table className="exercises-table">
                  <thead>
                    <tr>
                      <th>Máquina</th>
                      <th className="col-compact">S</th>
                      <th className="col-compact">R</th>
                      <th className="col-compact">P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.exercises.map((exercise: AssignedExercise, index: number) => (
                      <tr key={index}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {exercise.machinePhotoUrl && (
                              <img 
                                src={exercise.machinePhotoUrl} 
                                alt={exercise.machineName}
                                style={{ width: '35px', height: '35px', objectFit: 'cover', borderRadius: '4px' }}
                              />
                            )}
                            <div>
                              <strong>{exercise.machineName}</strong>
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
                    ))}
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