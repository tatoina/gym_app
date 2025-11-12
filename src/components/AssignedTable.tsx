import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, addDoc, orderBy } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import TablesHistory from './TablesHistory';
import './AssignedTable.css';

interface AssignedExercise {
  machineId: string;
  machineName: string;
  machinePhotoUrl?: string;
  series: number;
  reps: number;
  weight?: number;
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
  tableNumber?: number;
}

const AssignedTable: React.FC = () => {
  const [assignedTables, setAssignedTables] = useState<AssignedTableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestComment, setRequestComment] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{url: string, name: string} | null>(null);

  useEffect(() => {
    loadAssignedTable();
  }, []);

  const loadAssignedTable = async () => {
    if (!auth.currentUser) {
      console.log('❌ No hay usuario autenticado');
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 Buscando tablas para usuario:', auth.currentUser.uid);
      console.log('📧 Email del usuario:', auth.currentUser.email);
      
      // Cargar todas las tablas (activas y completadas) para numerarlas correctamente
      const allTablesQuery = query(
        collection(db, 'assignedTables'),
        where('userId', '==', auth.currentUser.uid)
      );
      const allSnapshot = await getDocs(allTablesQuery);
      console.log('📊 Total de tablas encontradas (todas):', allSnapshot.docs.length);
      
      // Ordenar por fecha de creación manualmente y crear mapa de números
      const sortedDocs = allSnapshot.docs.sort((a, b) => {
        const aTime = a.data().createdAt?.seconds || 0;
        const bTime = b.data().createdAt?.seconds || 0;
        return aTime - bTime;
      });
      
      // Crear mapa de ID a número de tabla
      const tableNumbers: { [key: string]: number } = {};
      sortedDocs.forEach((doc, index) => {
        tableNumbers[doc.id] = index + 1;
      });
      
      // Cargar solo las tablas activas
      const activeQuery = query(
        collection(db, 'assignedTables'),
        where('userId', '==', auth.currentUser.uid),
        where('status', '==', 'ACTIVA')
      );
      
      const activeSnapshot = await getDocs(activeQuery);
      console.log('✅ Tablas activas encontradas:', activeSnapshot.docs.length);
      
      const tables: AssignedTableData[] = [];
      activeSnapshot.forEach((doc) => {
        const tableData = doc.data();
        console.log('📋 Tabla encontrada:', {
          id: doc.id,
          userId: tableData.userId,
          ejercicios: tableData.exercises?.length || 0,
          status: tableData.status
        });
        tables.push({
          id: doc.id,
          tableNumber: tableNumbers[doc.id],
          ...(doc.data() as Omit<AssignedTableData, 'id' | 'tableNumber'>)
        });
      });
      
      setAssignedTables(tables);
      console.log('💾 Tablas cargadas en estado:', tables.length);
    } catch (error) {
      console.error('❌ Error loading assigned table:', error);
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

  const sendChangeRequest = async () => {
    if (!auth.currentUser || !requestComment.trim()) {
      alert('Por favor escribe un comentario');
      return;
    }

    try {
      setSendingRequest(true);
      
      // Obtener datos del usuario actual
      const userDoc = await getDocs(query(
        collection(db, 'users'),
        where('uid', '==', auth.currentUser.uid)
      ));

      let userName = 'Usuario';
      if (!userDoc.empty) {
        const userData = userDoc.docs[0].data();
        userName = `${userData.firstName} ${userData.lastName}`;
      }

      // Crear notificación para Max
      await addDoc(collection(db, 'notifications'), {
        type: 'TABLE_CHANGE_REQUEST',
        userId: auth.currentUser.uid,
        userName: userName,
        userEmail: auth.currentUser.email,
        comment: requestComment.trim(),
        createdAt: serverTimestamp(),
        read: false
      });

      alert('✅ Solicitud enviada correctamente. Max verá tu mensaje.');
      setShowRequestModal(false);
      setRequestComment('');
    } catch (error) {
      console.error('Error sending request:', error);
      alert('❌ Error al enviar la solicitud');
    } finally {
      setSendingRequest(false);
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

  return (
    <div className="assigned-table-container">
      <header className="assigned-table-header">
        <div>
          <h1>📋 MIS TABLAS</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {assignedTables && assignedTables.length > 0 && (
            <button 
              className="icon-button"
              onClick={() => setShowRequestModal(true)}
              title="Solicitar cambio de tabla"
            >
              💬
            </button>
          )}
          <button 
            className="icon-button"
            onClick={() => setShowHistory(true)}
            title="Ver historial de tablas"
          >
            📚
          </button>
        </div>
      </header>

      {(!assignedTables || assignedTables.length === 0) ? (
        <div className="empty-state">
          <h2>📋 Sin Tabla Activa</h2>
          <p>Aún no tienes ninguna tabla asignada por tu coach.</p>
          <p>Cuando tu coach te asigne ejercicios, aparecerán aquí.</p>
          <p style={{ marginTop: '20px', color: '#b0b0b0' }}>
            💡 Puedes revisar tus tablas anteriores en el historial 📚
          </p>
        </div>
      ) : null}

      {assignedTables.map((table) => (
        <div key={table.id} className="table-card">
          <div className="table-header">
            <div className="table-info">
              <h2>Tabla #{table.tableNumber || '?'}</h2>
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
          </div>

          <div className="exercises-table-container">
            <table className="exercises-table">
              <thead>
                <tr>
                  <th>Máquina</th>
                  <th>Series</th>
                  <th>Repeticiones</th>
                  <th>Peso</th>
                  <th>Foto</th>
                </tr>
              </thead>
              <tbody>
                {table.exercises.map((exercise: AssignedExercise, index: number) => (
                  <tr key={index}>
                    <td>
                      <div style={{ textAlign: 'left' }}>
                        {exercise.machinePhotoUrl ? (
                          <strong 
                            onClick={() => setSelectedImage({ url: exercise.machinePhotoUrl!, name: exercise.machineName })}
                            style={{ 
                              cursor: 'pointer', 
                              color: '#667eea',
                              textDecoration: 'underline',
                              textDecorationStyle: 'dotted'
                            }}
                            title="Clic para ver foto de la máquina"
                          >
                            {exercise.machineName}
                          </strong>
                        ) : (
                          <strong>{exercise.machineName}</strong>
                        )}
                        {exercise.notes && (
                          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                            💡 {exercise.notes}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>{exercise.series}</td>
                    <td style={{ textAlign: 'center' }}>{exercise.reps}</td>
                    <td style={{ textAlign: 'center', color: exercise.weight ? '#fff' : '#888' }}>
                      {exercise.weight ? `${exercise.weight} kg` : '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {exercise.machinePhotoUrl ? (
                        <button
                          onClick={() => setSelectedImage({ url: exercise.machinePhotoUrl!, name: exercise.machineName })}
                          className="view-photo-btn"
                          title="Ver foto de la máquina"
                        >
                          🔍
                        </button>
                      ) : (
                        <span style={{ color: '#666' }}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="table-footer">
        <p>💡 <strong>Consejo:</strong> Sigue estas tablas durante tus entrenamientos y registra tu progreso en "Entrenar".</p>
      </div>

      {/* Modal para solicitar cambio de tabla */}
      {showRequestModal && (
        <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>💬 Solicitar Cambio de Tabla</h3>
            <p style={{ color: '#b0b0b0', marginBottom: '20px' }}>
              Envía un mensaje a Max explicando qué cambios necesitas en tu tabla de ejercicios.
            </p>
            
            <textarea
              value={requestComment}
              onChange={(e) => setRequestComment(e.target.value)}
              placeholder="Ejemplo: Me gustaría cambiar el press de banca por press inclinado porque tengo molestias en el hombro..."
              rows={6}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #444',
                background: '#2a2a2a',
                color: '#e0e0e0',
                fontSize: '14px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={sendChangeRequest}
                disabled={sendingRequest || !requestComment.trim()}
                style={{
                  flex: 1,
                  background: sendingRequest || !requestComment.trim() 
                    ? '#555' 
                    : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  border: 'none',
                  color: 'white',
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: sendingRequest || !requestComment.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {sendingRequest ? '⏳' : '📤'} {sendingRequest ? 'Enviando...' : 'Enviar'}
              </button>
              <button
                onClick={() => setShowRequestModal(false)}
                style={{
                  padding: '12px 20px',
                  background: 'transparent',
                  border: '1px solid #444',
                  color: '#e0e0e0',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                ✖ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ver foto maximizada */}
      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="modal-content image-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedImage.name}</h3>
            <img 
              src={selectedImage.url} 
              alt={selectedImage.name}
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: '8px'
              }}
            />
            <button
              onClick={() => setSelectedImage(null)}
              style={{
                marginTop: '20px',
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                color: 'white',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ✖ Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignedTable;
