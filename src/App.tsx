import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, db, storage } from './services/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Auth from './components/Auth';
import WorkoutLogger from './components/WorkoutLogger';
import History from './components/History';
import AssignedTable from './components/AssignedTable';
import MachinesManager from './components/MachinesManager';
import AdminPanel from './components/AdminPanel';
import AppTour from './components/AppTour';
// PUSH NOTIFICATIONS DESACTIVADAS - No funcionan en Safari iOS
// import { requestNotificationPermission, setupMessageListener } from './services/notifications';
// FUNCIONALIDAD SOCIAL DESACTIVADA TEMPORALMENTE - FUTURO
// import SocialFeed from './components/SocialFeed';
import './App.css';
import './theme-light.css';

type View = 'home' | 'workout' | 'history' | 'assigned' | 'machines' | 'social' | 'admin';

const ADMIN_EMAIL = 'max@max.es';
const APP_VERSION = '2.0.0'; // Incrementar con cada deploy importante

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('home');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [lightTheme, setLightTheme] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [runTour, setRunTour] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [sendingSuggestion, setSendingSuggestion] = useState(false);

  // Verificar versión y limpiar caché si hay actualización
  useEffect(() => {
    const storedVersion = localStorage.getItem('app_version');
    if (storedVersion !== APP_VERSION) {
      console.log(`🔄 Nueva versión detectada: ${storedVersion} → ${APP_VERSION}`);
      // Limpiar caché
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            caches.delete(cacheName);
          });
        });
      }
      localStorage.setItem('app_version', APP_VERSION);
      // Forzar recarga completa
      window.location.reload();
    }
  }, []);

  // Cargar preferencia de tema desde localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setLightTheme(true);
    }
  }, []);

  // Limpiar service worker caché periódicamente
  useEffect(() => {
    const clearOldCaches = async () => {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        // Mantener solo los últimos 2 cachés
        if (cacheNames.length > 2) {
          const cachesToDelete = cacheNames.slice(0, -2);
          await Promise.all(cachesToDelete.map(name => caches.delete(name)));
          console.log('🧹 Cachés antiguos eliminados:', cachesToDelete);
        }
      }
    };
    
    clearOldCaches();
    // Limpiar cada hora
    const interval = setInterval(clearOldCaches, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Verificar si es la primera vez del usuario y mostrar tour + asignar tabla de ejemplo
  useEffect(() => {
    const setupNewUser = async () => {
      if (user && !isAdmin) {
        const hasSeenTour = localStorage.getItem(`tour_seen_${user.uid}`);
        
        // Verificar si ya tiene tabla asignada
        const tablesQuery = query(
          collection(db, 'assignedTables'),
          where('userId', '==', user.uid)
        );
        const tablesSnapshot = await getDocs(tablesQuery);
        
        // Si no tiene tablas, asignarle una de ejemplo
        if (tablesSnapshot.empty) {
          try {
            // Obtener máquinas disponibles
            const machinesSnapshot = await getDocs(collection(db, 'machines'));
            
            if (!machinesSnapshot.empty) {
              // Tomar las primeras 5 máquinas como ejemplo
              const exampleExercises = machinesSnapshot.docs.slice(0, 5).map(doc => ({
                machineId: doc.id,
                machineName: doc.data().name,
                machinePhotoUrl: doc.data().photoUrl || undefined,
                series: 3,
                reps: 12,
                weight: 10,
                notes: 'Tabla de ejemplo - Puedes solicitar cambios a Max'
              }));

              // Crear tabla de ejemplo
              await addDoc(collection(db, 'assignedTables'), {
                userId: user.uid,
                exercises: exampleExercises,
                assignedBy: 'system',
                assignedByName: 'MAXGYM',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                status: 'ACTIVA'
              });

              console.log('✅ Tabla de ejemplo asignada');
            }
          } catch (error) {
            console.error('Error creating example table:', error);
          }
        }
        
        // Mostrar tour si es primera vez
        if (!hasSeenTour) {
          setTimeout(() => {
            setRunTour(true);
          }, 1500);
        }
      }
    };

    setupNewUser();
  }, [user, isAdmin]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      const adminStatus = user?.email === ADMIN_EMAIL;
      setIsAdmin(adminStatus);
      
      // Cargar foto de perfil del usuario
      if (user && !adminStatus) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().profilePhotoUrl) {
            setProfilePhotoUrl(userDoc.data().profilePhotoUrl);
          }
        } catch (error) {
          console.error('Error loading profile photo:', error);
        }
      }
      
      // Si es admin, mostrar directamente el panel de admin
      if (adminStatus) {
        setCurrentView('admin');
        
        // PUSH NOTIFICATIONS DESACTIVADAS - Ahora usa email
        // try {
        //   await requestNotificationPermission();
        //   setupMessageListener();
        // } catch (error) {
        //   console.error('Error setting up notifications:', error);
        // }
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      // Limpiar caché del navegador
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
        console.log('✅ Caché limpiado');
      }

      // Limpiar localStorage
      localStorage.clear();
      
      // Limpiar sessionStorage
      sessionStorage.clear();

      // Cerrar sesión
      await signOut(auth);

      // Forzar recarga completa de la página para obtener nueva versión
      window.location.href = window.location.origin;
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getUserInitials = () => {
    if (!user?.email) return 'U';
    const email = user.email;
    return email.substring(0, 2).toUpperCase();
  };

  const toggleTheme = () => {
    const newTheme = !lightTheme;
    setLightTheme(newTheme);
    localStorage.setItem('theme', newTheme ? 'light' : 'dark');
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0] || !user) return;
    
    const file = event.target.files[0];
    
    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida');
      return;
    }
    
    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar los 5MB');
      return;
    }
    
    setUploadingPhoto(true);
    
    try {
      // Subir imagen a Firebase Storage
      const storageRef = ref(storage, `profile-photos/${user.uid}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      // Guardar URL en Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        profilePhotoUrl: downloadURL,
        updatedAt: new Date()
      }, { merge: true });
      
      setProfilePhotoUrl(downloadURL);
      setShowPhotoModal(false);
      alert('✅ Foto de perfil actualizada');
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('❌ Error al subir la foto. Inténtalo de nuevo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!user) return;
    
    try {
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        profilePhotoUrl: null,
        updatedAt: new Date()
      }, { merge: true });
      
      setProfilePhotoUrl(null);
      setShowPhotoModal(false);
      alert('✅ Foto de perfil eliminada');
    } catch (error) {
      console.error('Error removing photo:', error);
      alert('❌ Error al eliminar la foto');
    }
  };

  const handleTourFinish = () => {
    if (user) {
      localStorage.setItem(`tour_seen_${user.uid}`, 'true');
    }
    setRunTour(false);
  };

  const handleStartTour = () => {
    setShowUserMenu(false);
    setCurrentView('workout'); // Ir a la vista principal para el tour
    setTimeout(() => {
      setRunTour(true);
    }, 500);
  };

  const handleOpenSuggestion = () => {
    setShowUserMenu(false);
    setShowSuggestionModal(true);
    setSuggestionText('');
  };

  const handleSendSuggestion = async () => {
    if (!suggestionText.trim()) {
      alert('Por favor escribe tu sugerencia');
      return;
    }

    setSendingSuggestion(true);
    
    try {
      console.log('📝 Enviando sugerencia...');
      
      // Obtener datos del usuario desde Firestore
      let userName = user?.email || 'Usuario';
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            userName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || user.email || 'Usuario';
          }
        } catch (userError) {
          console.warn('No se pudo obtener datos del usuario, usando email:', userError);
          userName = user.email || 'Usuario';
        }
      }

      console.log('👤 Usuario:', userName);

      // Guardar sugerencia en Firestore
      const suggestionData = {
        userId: user?.uid || 'anonymous',
        userName: userName,
        userEmail: user?.email || 'no-email',
        suggestion: suggestionText,
        createdAt: serverTimestamp(),
        status: 'pending'
      };

      console.log('💾 Guardando sugerencia:', suggestionData);
      
      const docRef = await addDoc(collection(db, 'suggestions'), suggestionData);
      
      console.log('✅ Sugerencia guardada con ID:', docRef.id);

      alert('✅ Sugerencia enviada correctamente. ¡Gracias por ayudarnos a mejorar!');
      setShowSuggestionModal(false);
      setSuggestionText('');
    } catch (error: any) {
      console.error('❌ Error completo al enviar sugerencia:', error);
      console.error('Código de error:', error?.code);
      console.error('Mensaje:', error?.message);
      alert(`❌ Error al enviar la sugerencia: ${error?.message || 'Error desconocido'}. Verifica la consola para más detalles.`);
    } finally {
      setSendingSuggestion(false);
    }
  };

  if (loading) {
    return (
      <div className="App">
        <div className="loading">
          <h2>🏋️‍♂️ MAXGYM</h2>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="App">
        <div className="welcome-header">
          <h1>🏋️‍♂️ MAXGYM</h1>
          <p>Tu aplicación para trackear entrenamientos de gimnasio</p>
        </div>
        <Auth onAuthSuccess={() => {}} />
      </div>
    );
  }

  return (
    <div className={`App ${lightTheme ? 'light-theme' : ''}`}>
      {!isAdmin && (
        <>
          <div className="user-avatar-button" data-tour="user-avatar" onClick={() => setShowUserMenu(!showUserMenu)}>
            {profilePhotoUrl ? (
              <img src={profilePhotoUrl} alt="Avatar" className="avatar-image" />
            ) : (
              getUserInitials()
            )}
          </div>

          <div className="theme-toggle-button" data-tour="theme-toggle" onClick={toggleTheme} title={lightTheme ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}>
            {lightTheme ? '🌙' : '☀️'}
          </div>
          
          {showUserMenu && (
            <div className="user-dropdown-menu">
              <div className="user-menu-email">{user.email}</div>
              <button onClick={() => { setShowPhotoModal(true); setShowUserMenu(false); }} className="user-menu-option">
                📷 Cambiar Foto
              </button>
              <button onClick={handleStartTour} className="user-menu-option">
                🎓 Ver Tutorial
              </button>
              <button onClick={handleOpenSuggestion} className="user-menu-option">
                💡 Sugerencias APP
              </button>
              <button onClick={handleLogout} className="user-menu-logout">
                🚺 Cerrar Sesión
              </button>
            </div>
          )}

          {currentView === 'home' && (
            <nav className="main-navigation">
            <button
              className="main-nav-btn"
              onClick={() => setCurrentView('workout')}
              data-tour="nav-entrenar"
            >
              🏋 Entrenar
            </button>
            <button
              className="main-nav-btn"
              onClick={() => setCurrentView('history')}
              data-tour="nav-historial"
            >
              📊 Historial
            </button>
            <button
              className="main-nav-btn"
              onClick={() => setCurrentView('machines')}
              data-tour="nav-maquinas"
            >
              🏷️ Máquinas
            </button>
            <button
              className="main-nav-btn"
              onClick={() => setCurrentView('assigned')}
              data-tour="nav-tablas"
            >
              📋 Mis Tablas
            </button>
            </nav>
          )}
        </>
      )}
      <main>
        {isAdmin ? (
          <AdminPanel />
        ) : (
          <>
            {currentView === 'home' && (
              <div className="home-view">
                <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: '#e0e0e0' }}>🏋️‍♂️ MAXGYM</h2>
                <p style={{ textAlign: 'center', color: '#b0b0b0', marginBottom: '3rem' }}>Selecciona una opción para continuar</p>
              </div>
            )}
            {currentView === 'workout' && (
              <>
                <button onClick={() => setCurrentView('home')} className="back-btn-top-right">
                  ←
                </button>
                <WorkoutLogger onNavigateToHistory={() => setCurrentView('history')} />
              </>
            )}
            {currentView === 'history' && (
              <>
                <button onClick={() => setCurrentView('home')} className="back-btn-top-right">
                  ←
                </button>
                <History onBack={() => setCurrentView('home')} lightTheme={lightTheme} />
              </>
            )}
            {currentView === 'machines' && (
              <>
                <button onClick={() => setCurrentView('home')} className="back-btn-top-right">
                  ←
                </button>
                <MachinesManager />
              </>
            )}
            {currentView === 'assigned' && (
              <>
                <button onClick={() => setCurrentView('home')} className="back-btn-top-right">
                  ←
                </button>
                <AssignedTable />
              </>
            )}
            {/* FUNCIONALIDAD SOCIAL DESACTIVADA TEMPORALMENTE - FUTURO */}
            {/* {currentView === 'social' && <SocialFeed />} */}
          </>
        )}
      </main>

      {/* Modal para cambiar foto de perfil */}
      {showPhotoModal && (
        <div className="modal-overlay" onClick={() => setShowPhotoModal(false)}>
          <div className="modal-content profile-photo-modal" onClick={(e) => e.stopPropagation()}>
            <h3>📷 Foto de Perfil</h3>
            
            {profilePhotoUrl && (
              <div className="current-photo-preview">
                <img src={profilePhotoUrl} alt="Foto actual" />
                <p>Foto actual</p>
              </div>
            )}
            
            <div className="photo-actions">
              <label className="upload-photo-btn">
                {uploadingPhoto ? 'Subiendo...' : '📁 Seleccionar Foto'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  style={{ display: 'none' }}
                />
              </label>
              
              {profilePhotoUrl && (
                <button onClick={handleRemovePhoto} className="remove-photo-btn">
                  🗑️ Eliminar Foto
                </button>
              )}
            </div>
            
            <button onClick={() => setShowPhotoModal(false)} className="close-modal-btn">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Sugerencias */}
      {showSuggestionModal && (
        <div className="modal-overlay" onClick={() => setShowSuggestionModal(false)}>
          <div className="profile-photo-modal suggestion-modal" onClick={(e) => e.stopPropagation()}>
            <h3>💡 Enviar Sugerencia</h3>
            <p style={{ color: '#b0b0b0', fontSize: '14px', marginBottom: '20px' }}>
              Cuéntanos qué te gustaría mejorar en la aplicación
            </p>
            
            <textarea
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              placeholder="Escribe aquí tu sugerencia..."
              className="suggestion-textarea"
              rows={6}
              disabled={sendingSuggestion}
            />
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                onClick={handleSendSuggestion} 
                className="upload-photo-btn"
                disabled={sendingSuggestion}
                style={{ flex: 1 }}
              >
                {sendingSuggestion ? '📤 Enviando...' : '📤 Enviar'}
              </button>
              <button 
                onClick={() => setShowSuggestionModal(false)} 
                className="close-modal-btn"
                disabled={sendingSuggestion}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tour de la aplicación */}
      {!isAdmin && <AppTour run={runTour} onFinish={handleTourFinish} onChangeView={setCurrentView} />}
    </div>
  );
}

export default App;