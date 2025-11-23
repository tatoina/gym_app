import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import './Auth.css';

interface AuthProps {
  onAuthSuccess: () => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Verificar si el usuario tiene documento en Firestore, si no, crearlo
      const { getDoc } = await import('firebase/firestore');
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (!userDoc.exists()) {
        // Crear documento para usuarios que no lo tienen
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          firstName: 'Usuario',
          lastName: '',
          email: userCredential.user.email || email,
          createdAt: new Date()
        });
      }
      
      onAuthSuccess();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage('Se ha enviado un correo para restablecer tu contraseña.');
      setShowResetPassword(false);
      setEmail('');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (showResetPassword) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo">
            <img src="/icons/icon-512.png" alt="MAXGYM Logo" />
          </div>
          <h2>Recuperar Contraseña</h2>
          
          <form onSubmit={handleResetPassword}>
            <div className="form-group">
              <label>Email:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
              />
            </div>
            
            {error && <div className="error-message">{error}</div>}
            {successMessage && <div className="success-message">{successMessage}</div>}
            
            <button type="submit" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </button>
          </form>
          
          <p>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setShowResetPassword(false);
                setError('');
                setSuccessMessage('');
              }}
            >
              ← Volver al inicio de sesión
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/icons/icon-512.png" alt="MAXGYM Logo" />
        </div>
        <h2>Iniciar Sesión</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
            />
          </div>
          
          <div className="form-group">
            <label>Contraseña:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          {successMessage && <div className="success-message">{successMessage}</div>}
          
          <button type="submit" disabled={loading}>
            {loading ? 'Procesando...' : 'Iniciar Sesión'}
          </button>
        </form>
        
        <p>
          <button
            type="button"
            className="link-button"
            onClick={() => setShowResetPassword(true)}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;