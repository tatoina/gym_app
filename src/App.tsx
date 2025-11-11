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
      <header className="app-header">
        <div className="header-content">
          <h1>🏋️‍♂️ MAXGYM</h1>
          {!isAdmin && (
            <div className="header-nav">
              <button
                className={`nav-btn ${currentView === 'workout' ? 'active' : ''}`}
                onClick={() => setCurrentView('workout')}
              >
                💪 Entrenar
              </button>
              <button
                className={`nav-btn ${currentView === 'history' ? 'active' : ''}`}
                onClick={() => setCurrentView('history')}
              >
                📊 Historial
              </button>
              <button
                className={`nav-btn ${currentView === 'assigned' ? 'active' : ''}`}
                onClick={() => setCurrentView('assigned')}
              >
                📋 Mi Tabla
              </button>
              {/* FUNCIONALIDAD SOCIAL DESACTIVADA TEMPORALMENTE - FUTURO */}
              {/*
              <button
                className={`nav-btn ${currentView === 'social' ? 'active' : ''}`}
                onClick={() => setCurrentView('social')}
              >
                🌟 MAX SOCIAL
              </button>
              */}
            </div>
          )}
          <div className="user-info">
            <span>Bienvenido, {user.email}</span>
            <button onClick={handleLogout} className="logout-btn">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>
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