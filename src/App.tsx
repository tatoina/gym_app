import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './services/firebase';
import Auth from './components/Auth';
import WorkoutLogger from './components/WorkoutLogger';
import History from './components/History';
import AssignedTable from './components/AssignedTable';
import AdminPanel from './components/AdminPanel';
// FUNCIONALIDAD SOCIAL DESACTIVADA TEMPORALMENTE - FUTURO
// import SocialFeed from './components/SocialFeed';
import './App.css';

type View = 'workout' | 'history' | 'assigned' | 'social' | 'admin';

const ADMIN_EMAIL = 'max@max.es';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('workout');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      const adminStatus = user?.email === ADMIN_EMAIL;
      setIsAdmin(adminStatus);
      // Si es admin, mostrar directamente el panel de admin
      if (adminStatus) {
        setCurrentView('admin');
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
    <div className="App">
      {!isAdmin && (
        <>
          <div className="user-avatar-button" onClick={() => setShowUserMenu(!showUserMenu)}>
            {getUserInitials()}
          </div>
          
          {showUserMenu && (
            <div className="user-dropdown-menu">
              <div className="user-menu-email">{user.email}</div>
              <button onClick={handleLogout} className="user-menu-logout">
                🚪 Cerrar Sesión
              </button>
            </div>
          )}

          <nav className="main-navigation">
            <button
              className={`main-nav-btn ${currentView === 'workout' ? 'active' : ''}`}
              onClick={() => setCurrentView('workout')}
            >
              � Entrenar
            </button>
            <button
              className={`main-nav-btn ${currentView === 'history' ? 'active' : ''}`}
              onClick={() => setCurrentView('history')}
            >
              � Historial
            </button>
            <button
              className={`main-nav-btn ${currentView === 'assigned' ? 'active' : ''}`}
              onClick={() => setCurrentView('assigned')}
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
    </div>
  );
}

export default App;