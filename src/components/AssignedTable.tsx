import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
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
  updatedAt: any; // Puede ser Date o Timestamp de Firestore
}

const AssignedTable: React.FC = () => {
  const [assignedTable, setAssignedTable] = useState<AssignedTableData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssignedTable();
  }, []);

  const loadAssignedTable = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const q = query(
        collection(db, 'assignedTables'),
        where('userId', '==', auth.currentUser.uid)
      );
      
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setAssignedTable({
          id: doc.id,
          ...(doc.data() as Omit<AssignedTableData, 'id'>)
        });
      }
    } catch (error) {
      console.error('Error loading assigned table:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="assigned-table-container">
        <p>Cargando tabla asignada...</p>
      </div>
    );
  }

  if (!assignedTable || assignedTable.exercises.length === 0) {
    return (
      <div className="assigned-table-container">
        <div className="empty-state">
          <h2>📋 Tabla de Ejercicios</h2>
          <p>Aún no tienes ninguna tabla asignada por tu monitor.</p>
          <p>Cuando tu monitor te asigne ejercicios, aparecerán aquí.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="assigned-table-container">
      <header className="assigned-table-header">
        <div>
          <h1>📋 Mi Tabla de Ejercicios</h1>
          <p className="assigned-by">
            Asignada por: <strong>{assignedTable.assignedByName}</strong>
          </p>
          <p className="assigned-date">
            Última actualización: {(() => {
              try {
                if (!assignedTable.updatedAt) return 'No disponible';
                
                let date;
                if (assignedTable.updatedAt.seconds) {
                  // Es un Timestamp de Firestore
                  date = new Date(assignedTable.updatedAt.seconds * 1000);
                } else {
                  // Es un Date normal
                  date = new Date(assignedTable.updatedAt);
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
      </header>

      <div className="exercises-list">
        {assignedTable.exercises.map((exercise, index) => (
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
                <strong>Notas del monitor:</strong>
                <p>{exercise.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="table-footer">
        <p>💡 <strong>Consejo:</strong> Sigue esta tabla durante tus entrenamientos y registra tu progreso en la pestaña "Entrenar".</p>
      </div>
    </div>
  );
};

export default AssignedTable;
