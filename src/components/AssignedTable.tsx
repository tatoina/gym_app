import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import TablesHistory from './TablesHistory';
import './AssignedTable.css';

interface AssignedExercise {
  machineId: string;
  machineName: string;
  machinePhotoUrl?: string;
  series: number;
  reps: number;
  notes?: string;
}

interface AssignedTableData {
  id: string;
  userId: string;
  exercises: AssignedExercise[];
  assignedBy: string;
  assignedByName: string;
  createdAt: any;
  updatedAt: any;
  status: 'ACTIVA' | 'COMPLETADA';
  completedAt?: any;
}

const AssignedTable: React.FC = () => {
  const [assignedTables, setAssignedTables] = useState<AssignedTableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadAssignedTable();
  }, []);

  const loadAssignedTable = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const q = query(
        collection(db, 'assignedTables'),
        where('userId', '==', auth.currentUser.uid),
        where('status', '==', 'ACTIVA')
      );
      
      const snapshot = await getDocs(q);
      
      const tables: AssignedTableData[] = [];
      snapshot.forEach((doc) => {
        tables.push({
          id: doc.id,
          ...(doc.data() as Omit<AssignedTableData, 'id'>)
        });
      });
      
      setAssignedTables(tables);
    } catch (error) {
      console.error('Error loading assigned table:', error);
    } finally {
      setLoading(false);
    }
  };

  const markTableAsCompleted = async (tableId: string) => {
    try {
      const tableRef = doc(db, 'assignedTables', tableId);
      await updateDoc(tableRef, {
        status: 'COMPLETADA',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Recargar las tablas activas
      await loadAssignedTable();
    } catch (error) {
      console.error('Error marking table as completed:', error);
    }
  };

  if (showHistory) {
    return <TablesHistory onBack={() => setShowHistory(false)} />;
  }

  if (loading) {
    return (
      <div className="assigned-table-container">
        <p>Cargando tablas asignadas...</p>
      </div>
    );
  }

  if (!assignedTables || assignedTables.length === 0) {
    return (
      <div className="assigned-table-container">
        <div className="empty-state">
          <h2>📋 Tablas de Ejercicios</h2>
          <p>Aún no tienes ninguna tabla asignada por tu coach.</p>
          <p>Cuando tu coach te asigne ejercicios, aparecerán aquí.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="assigned-table-container">
      <header className="assigned-table-header">
        <div>
          <h1>📋 Mis Tablas de Ejercicios</h1>
          <p className="tables-count">{assignedTables.length} tabla{assignedTables.length > 1 ? 's' : ''} activa{assignedTables.length > 1 ? 's' : ''}</p>
        </div>
        <button 
          className="history-button"
          onClick={() => setShowHistory(true)}
        >
          📚 Ver Historial
        </button>
      </header>

      {assignedTables.map((table) => (
        <div key={table.id} className="table-card">
          <div className="table-header">
            <div className="table-info">
              <h2>Tabla #{table.id.slice(-6)}</h2>
              <p className="assigned-by">
                Asignada por: <strong>{table.assignedByName}</strong>
              </p>
              <p className="assigned-date">
                Última actualización: {(() => {
                  try {
                    if (!table.updatedAt) return 'No disponible';
                    
                    let date;
                    if (table.updatedAt.seconds) {
                      date = new Date(table.updatedAt.seconds * 1000);
                    } else {
                      date = new Date(table.updatedAt);
                    }
                    
                    return date.toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    });
                  } catch (error) {
                    return 'No disponible';
                  }
                })()}
              </p>
            </div>
            <div className="table-actions">
              <span className="status-badge status-active">🟢 ACTIVA</span>
              <button 
                className="complete-button"
                onClick={() => markTableAsCompleted(table.id)}
              >
                ✅ Marcar como Completada
              </button>
            </div>
          </div>

          <div className="exercises-list">
            {table.exercises.map((exercise: AssignedExercise, index: number) => (
              <div key={index} className="assigned-exercise-card">
                <div className="exercise-header">
                  {exercise.machinePhotoUrl && (
                    <img
                      src={exercise.machinePhotoUrl}
                      alt={exercise.machineName}
                      className="exercise-photo"
                    />
                  )}
                  <div className="exercise-title">
                    <h3>{exercise.machineName}</h3>
                    <div className="exercise-metrics">
                      <span className="metric-badge">
                        {exercise.series} series
                      </span>
                      <span className="metric-badge">
                        {exercise.reps} repeticiones
                      </span>
                    </div>
                  </div>
                </div>

                {exercise.notes && (
                  <div className="exercise-notes">
                    <strong>💡 Notas del coach:</strong>
                    <p>{exercise.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="table-footer">
        <p>💡 <strong>Consejo:</strong> Sigue estas tablas durante tus entrenamientos y registra tu progreso en "Entrenar".</p>
      </div>
    </div>
  );
};

export default AssignedTable;
