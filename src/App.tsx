import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, db, storage } from './services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Auth from './components/Auth';
import WorkoutLogger from './components/WorkoutLogger';
import History from './components/History';
import AssignedTable from './components/AssignedTable';
import AdminPanel from './components/AdminPanel';
import AppTour from './components/AppTour';
// PUSH NOTIFICATIONS DESACTIVADAS - No funcionan en Safari iOS
// import { requestNotificationPermission, setupMessageListener } from './services/notifications';
// FUNCIONALIDAD SOCIAL DESACTIVADA TEMPORALMENTE - FUTURO
// import SocialFeed from './components/SocialFeed';
import './App.css';
import './theme-light.css';

type View = 'workout' | 'history' | 'assigned' | 'social' | 'admin';

const ADMIN_EMAIL = 'max@max.es';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('workout');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [lightTheme, setLightTheme] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [runTour, setRunTour] = useState(false);

  // Cargar preferencia de tema desde localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setLightTheme(true);
    }
  }, []);

  // Verificar si es la primera vez del usuario y mostrar tour
  useEffect(() => {
    if (user && !isAdmin) {
      const hasSeenTour = localStorage.getItem(`tour_seen_${user.uid}`);
      if (!hasSeenTour) {
        // Esperar un poco para que los elementos se rendericen
        setTimeout(() => {
          setRunTour(true);
        }, 1000);
      }
    }
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
      await signOut(auth);
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
              <button onClick={handleLogout} className="user-menu-logout">
                🚪 Cerrar Sesión
              </button>
            </div>
          )}

          <nav className="main-navigation">
            <button
              className={`main-nav-btn ${currentView === 'workout' ? 'active' : ''}`}
              onClick={() => setCurrentView('workout')}
              data-tour="nav-entrenar"
            >
              🏋 Entrenar
            </button>
            <button
              className={`main-nav-btn ${currentView === 'history' ? 'active' : ''}`}
              onClick={() => setCurrentView('history')}
              data-tour="nav-historial"
            >
              📊 Historial
            </button>
            <button
              className={`main-nav-btn ${currentView === 'assigned' ? 'active' : ''}`}
              onClick={() => setCurrentView('assigned')}
              data-tour="nav-tablas"
            >
              📋 Mis Tablas
            </button>
          </nav>
        </>
      )}
      <main>
        {isAdmin ? (
          <AdminPanel />
        ) : (
          <>
            {currentView === 'workout' && (
              <WorkoutLogger onNavigateToHistory={() => setCurrentView('history')} />
            )}
            {currentView === 'history' && (
              <History onBack={() => setCurrentView('workout')} />
            )}
            {currentView === 'assigned' && <AssignedTable />}
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

      {/* Tour de la aplicación */}
      {!isAdmin && <AppTour run={runTour} onFinish={handleTourFinish} />}
    </div>
  );
}

export default App;