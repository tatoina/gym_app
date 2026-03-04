import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, db, storage } from './services/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Auth, { APP_VERSION } from './components/Auth';
import WorkoutLogger from './components/WorkoutLogger';
import History from './components/History';
import AssignedTable from './components/AssignedTable';
import AdminPanel from './components/AdminPanel';
// PUSH NOTIFICATIONS DESACTIVADAS - No funcionan en Safari iOS
// import { requestNotificationPermission, setupMessageListener } from './services/notifications';
// FUNCIONALIDAD SOCIAL DESACTIVADA TEMPORALMENTE - FUTURO
// import SocialFeed from './components/SocialFeed';
import './App.css';
import './theme-light.css';

type View = 'home' | 'workout' | 'history' | 'assigned' | 'social' | 'admin';

const ADMIN_EMAIL = 'max@max.es';
// APP_VERSION importada desde Auth.tsx

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('home');
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'coach' | 'usuario'>('usuario');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [lightTheme, setLightTheme] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [sendingSuggestion, setSendingSuggestion] = useState(false);

  // Navegar y cerrar menú de usuario al mismo tiempo
  const navigateTo = (view: View) => {
    setCurrentView(view);
    setShowUserMenu(false);
  };

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

  // Cerrar menú de usuario al hacer click fuera
  useEffect(() => {
    if (!showUserMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-dropdown-menu') && !target.closest('.user-avatar-button')) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

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



  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      const adminStatus = user?.email === ADMIN_EMAIL;
      setIsAdmin(adminStatus);
      
      // Determinar el rol del usuario (un solo getDoc)
      if (adminStatus) {
        setUserRole('admin');
        setCurrentView('admin');
      } else if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const role = userData.role || 'usuario';
            setUserRole(role);
            
            // Cargar foto de perfil
            if (userData.profilePhotoUrl) {
              setProfilePhotoUrl(userData.profilePhotoUrl);
            }

            // Si es coach, ir al panel de admin
            if (role === 'coach') {
              setCurrentView('admin');
            }
          }
        } catch (error) {
          console.error('Error loading user data:', error);
        }
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
          <p>Seguimiento profesional de tus entrenamientos</p>
        </div>
        <Auth onAuthSuccess={() => {}} />
      </div>
    );
  }

  return (
    <div className={`App ${lightTheme ? 'light-theme' : ''}`}>
      {!isAdmin && (
        <>
          <div className="user-avatar-button" onClick={() => setShowUserMenu(!showUserMenu)}>
            {profilePhotoUrl ? (
              <img src={profilePhotoUrl} alt="Avatar" className="avatar-image" />
            ) : (
              getUserInitials()
            )}
          </div>
          
          {showUserMenu && (
            <div className="user-dropdown-menu">
              <div className="user-menu-email">{user.email}</div>
              <button onClick={() => { setShowPhotoModal(true); setShowUserMenu(false); }} className="user-menu-option">
                📷 Cambiar Foto
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
              onClick={() => navigateTo('workout')}
              data-tour="nav-entrenar"
            >
              🏋 Entrenar
            </button>
            <button
              className="main-nav-btn"
              onClick={() => navigateTo('history')}
              data-tour="nav-historial"
            >
              📊 Historial
            </button>
            <button
              className="main-nav-btn"
              onClick={() => navigateTo('assigned')}
              data-tour="nav-tablas"
            >
              📋 Mis Tablas
            </button>
            </nav>
          )}
        </>
      )}
      <main>
        {isAdmin || userRole === 'coach' ? (
          <AdminPanel user={user} userRole={userRole} />
        ) : (
          <>
            {currentView === 'home' && (
              <div className="home-view">
                <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#e0e0e0', fontSize: '2rem' }}>🏋️‍♂️ MAXGYM</h2>
                <p style={{ textAlign: 'center', color: '#b0b0b0', marginBottom: '3rem', fontSize: '1.1rem' }}>Tu entrenamiento, tu progreso</p>
              </div>
            )}

            {/* Vistas siempre montadas, mostradas/ocultas con CSS para evitar re-fetches */}
            <div style={{ display: currentView === 'workout' ? 'block' : 'none' }}>
              <button onClick={() => navigateTo('home')} className="back-btn-top-right">
                ←
              </button>
              <WorkoutLogger onNavigateToHistory={() => navigateTo('history')} user={user} />
            </div>
            <div style={{ display: currentView === 'history' ? 'block' : 'none' }}>
              <button onClick={() => navigateTo('home')} className="back-btn-top-right">
                ←
              </button>
              <History onBack={() => navigateTo('home')} lightTheme={lightTheme} user={user} />
            </div>
            <div style={{ display: currentView === 'assigned' ? 'block' : 'none' }}>
              <button onClick={() => navigateTo('home')} className="back-btn-top-right">
                ←
              </button>
              <AssignedTable user={user} />
            </div>
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
    </div>
  );
}

export default App;