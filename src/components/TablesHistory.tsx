import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import './TablesHistory.css';

interface AssignedExercise {
  machineId: string;
  machineName: string;
  machinePhotoUrl?: string;
  series: number;
  reps: number;
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
  completedAt: any;
}

interface TablesHistoryProps {
  onBack?: () => void;
}

const TablesHistory: React.FC<TablesHistoryProps> = ({ onBack }) => {
  const [completedTables, setCompletedTables] = useState<CompletedTable[]>([]);
  const [loading, setLoading] = useState(true);

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
        where('status', '==', 'COMPLETADA'),
        orderBy('completedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      const tables: CompletedTable[] = [];
      snapshot.forEach((doc) => {
        tables.push({
          id: doc.id,
          ...(doc.data() as Omit<CompletedTable, 'id'>)
        });
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

      {completedTables.map((table) => (
        <div key={table.id} className="completed-table-card">
          <div className="table-header">
            <div className="table-info">
              <h2>Tabla #{table.id.slice(-6)}</h2>
              <p className="assigned-by">
                Asignada por: <strong>{table.assignedByName}</strong>
              </p>
              <div className="table-dates">
                <p className="created-date">
                  Creada: {formatDate(table.createdAt)}
                </p>
                <p className="completed-date">
                  ✅ Completada: {formatDate(table.completedAt)}
                </p>
              </div>
            </div>
            <div className="table-status">
              <span className="status-badge status-completed">✅ COMPLETADA</span>
            </div>
          </div>

          <div className="exercises-summary">
            <h3>Ejercicios ({table.exercises.length})</h3>
            <div className="exercises-grid">
              {table.exercises.map((exercise: AssignedExercise, index: number) => (
                <div key={index} className="exercise-summary-card">
                  {exercise.machinePhotoUrl && (
                    <img
                      src={exercise.machinePhotoUrl}
                      alt={exercise.machineName}
                      className="exercise-summary-photo"
                    />
                  )}
                  <div className="exercise-summary-info">
                    <h4>{exercise.machineName}</h4>
                    <p>{exercise.series} × {exercise.reps}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TablesHistory;