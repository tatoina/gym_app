import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './services/firebase';
import Auth from './components/Auth';
import WorkoutLogger from './components/WorkoutLogger';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
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
          <h2>🏋️‍♂️ GymApp</h2>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="App">
        <div className="welcome-header">
          <h1>🏋️‍♂️ GymApp</h1>
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
          <h1>🏋️‍♂️ GymApp</h1>
          <div className="user-info">
            <span>Bienvenido, {user.email}</span>
            <button onClick={handleLogout} className="logout-btn">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>
      <main>
        <WorkoutLogger />
      </main>
    </div>
  );
}

export default App;