import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, addDoc, orderBy } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import TablesHistory from './TablesHistory';
import './AssignedTable.css';

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
  mediaType?: 'image' | 'video';
  // Métricas
  series: number;
  reps: number;
  weight?: number;
  notes?: string;
}

interface AssignedTableData {
  id: string;
  userId: string;
  exercises: {
    day1: AssignedExercise[];
    day2: AssignedExercise[];
    day3: AssignedExercise[];
    day4: AssignedExercise[];
    day5: AssignedExercise[];
    day6: AssignedExercise[];
    day7: AssignedExercise[];
  };
  assignedBy: string;
  assignedByName: string;
  createdAt: any;
  updatedAt: any;
  status: 'ACTIVA' | 'COMPLETADA';
  completedAt?: any;
  tableNumber?: number;
}

interface AssignedTableProps {
  user: User | null;
}

const AssignedTable: React.FC<AssignedTableProps> = ({ user }) => {
  const [assignedTables, setAssignedTables] = useState<AssignedTableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestComment, setRequestComment] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{url: string; name: string; type: 'image' | 'video'} | null>(null);

  useEffect(() => {
    if (user) {
      loadAssignedTable();
    }
  }, [user]);

  const loadAssignedTable = async () => {
    if (!user) {
      console.log('❌ No hay usuario autenticado');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 Buscando tablas para usuario:', user.uid);
      console.log('📧 Email del usuario:', user.email);
      
      // Cargar todas las tablas (activas y completadas) para numerarlas correctamente
      const allTablesQuery = query(
        collection(db, 'assignedTables'),
        where('userId', '==', user.uid)
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
        where('userId', '==', user.uid),
        where('status', '==', 'ACTIVA')
      );
      
      const activeSnapshot = await getDocs(activeQuery);
      console.log('✅ Tablas activas encontradas:', activeSnapshot.docs.length);
      
      const tables: AssignedTableData[] = [];
      activeSnapshot.forEach((docSnap) => {
        const tableData: any = docSnap.data();

        // Normalizar ejercicios a formato por días (day1..day7)
        let normalizedExercises: AssignedTableData['exercises'];
        if (Array.isArray(tableData.exercises)) {
          normalizedExercises = {
            day1: tableData.exercises || [],
            day2: [],
            day3: [],
            day4: [],
            day5: [],
            day6: [],
            day7: []
          };
        } else {
          normalizedExercises = {
            day1: tableData.exercises?.day1 || [],
            day2: tableData.exercises?.day2 || [],
            day3: tableData.exercises?.day3 || [],
            day4: tableData.exercises?.day4 || [],
            day5: tableData.exercises?.day5 || [],
            day6: tableData.exercises?.day6 || [],
            day7: tableData.exercises?.day7 || []
          };
        }

        const totalExercises = Object.values(normalizedExercises).reduce(
          (sum, dayExercises) => sum + dayExercises.length,
          0
        );

        console.log('📋 Tabla encontrada:', {
          id: docSnap.id,
          userId: tableData.userId,
          ejercicios: totalExercises,
          status: tableData.status
        });

        tables.push({
          id: docSnap.id,
          tableNumber: tableNumbers[docSnap.id],
          ...(tableData as Omit<AssignedTableData, 'id' | 'tableNumber' | 'exercises'>),
          exercises: normalizedExercises
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
    if (!user || !requestComment.trim()) {
      alert('Por favor escribe un comentario');
      return;
    }

    try {
      setSendingRequest(true);
      
      // Obtener datos del usuario actual
      const userDoc = await getDocs(query(
        collection(db, 'users'),
        where('uid', '==', user.uid)
      ));

      let userName = 'Usuario';
      if (!userDoc.empty) {
        const userData = userDoc.docs[0].data();
        userName = `${userData.firstName} ${userData.lastName}`;
      }

      // Crear notificación para Max
      await addDoc(collection(db, 'notifications'), {
        type: 'TABLE_CHANGE_REQUEST',
        userId: user.uid,
        userName: userName,
        userEmail: user.email,
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
    return <TablesHistory onBack={() => setShowHistory(false)} user={user} />;
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
              data-tour="request-change"
            >
              💬
            </button>
          )}
          <button 
            className="icon-button"
            onClick={() => setShowHistory(true)}
            title="Ver historial de tablas"
            data-tour="history-button"
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
            {/* Mostrar solo los días que tienen ejercicios */}
            {(() => {
              const days = [
                { key: 'day1', label: 'Día 1' },
                { key: 'day2', label: 'Día 2' },
                { key: 'day3', label: 'Día 3' },
                { key: 'day4', label: 'Día 4' },
                { key: 'day5', label: 'Día 5' },
                { key: 'day6', label: 'Día 6' },
                { key: 'day7', label: 'Día 7' }
              ] as const;

              const daysWithExercises = days.filter((d) => {
                const list = (table.exercises as any)[d.key] as AssignedExercise[];
                return list && list.length > 0;
              });

              if (daysWithExercises.length === 0) {
                return (
                  <p className="no-exercises">
                    No hay ejercicios en esta tabla todavía.
                  </p>
                );
              }

              return daysWithExercises.map((d) => {
                const dayExercises = (table.exercises as any)[d.key] as AssignedExercise[];
                return (
                  <div key={d.key} style={{ marginBottom: '20px' }}>
                    <h3 style={{
                      margin: '0 0 10px 0',
                      color: '#51cf66',
                      fontSize: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>{d.label}</span>
                      <span style={{
                        fontSize: '12px',
                        color: '#b0b0b0'
                      }}>
                        ({dayExercises.length} ejercicios)
                      </span>
                    </h3>

                    <table className="exercises-table">
                      <thead>
                        <tr>
                          <th>Categoría / Ejercicio</th>
                          <th>Series</th>
                          <th>Repeticiones</th>
                          <th>Peso</th>
                          <th>Foto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayExercises.map((exercise: AssignedExercise, index: number) => {
                          const displayName = exercise.categoryName || exercise.machineName || 'Sin categoría';
                          const photoUrl = exercise.exercisePhotoUrl || exercise.machinePhotoUrl;
                          const mediaType: 'image' | 'video' = exercise.mediaType || 'image';

                          return (
                            <tr key={index}>
                              <td>
                                <div style={{ textAlign: 'left' }}>
                                  {photoUrl ? (
                                    <strong
                                      onClick={() => setSelectedMedia({ url: photoUrl!, name: displayName, type: mediaType })}
                                      style={{
                                        cursor: 'pointer',
                                        color: '#667eea',
                                        textDecoration: 'underline',
                                        textDecorationStyle: 'dotted'
                                      }}
                                      title="Clic para ver foto"
                                    >
                                      {displayName}
                                    </strong>
                                  ) : (
                                    <strong>{displayName}</strong>
                                  )}
                                  {exercise.exerciseName && (
                                    <div style={{ fontSize: '13px', color: '#667eea', marginTop: '2px' }}>
                                      💪 {exercise.exerciseName}
                                    </div>
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
                                {photoUrl ? (
                                  <button
                                    onClick={() => setSelectedMedia({ url: photoUrl!, name: displayName, type: mediaType })}
                                    className="view-photo-btn"
                                    title={mediaType === 'video' ? 'Ver vídeo' : 'Ver foto'}
                                  >
                                    {mediaType === 'video' ? '🎥' : '🔍'}
                                  </button>
                                ) : (
                                  <span style={{ color: '#666' }}>-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              });
            })()}
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

      {/* Modal para ver foto/vídeo maximizado */}
      {selectedMedia && (
        <div className="modal-overlay" onClick={() => setSelectedMedia(null)}>
          <div className="modal-content image-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedMedia.name}</h3>
            {selectedMedia.type === 'video' ? (
              <video
                src={selectedMedia.url}
                controls
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  borderRadius: '8px'
                }}
              />
            ) : (
              <img 
                src={selectedMedia.url} 
                alt={selectedMedia.name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: '8px'
                }}
              />
            )}
            <button
              onClick={() => setSelectedMedia(null)}
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
