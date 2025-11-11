import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import './SocialFeed.css';

interface Post {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  exercise?: {
    machineName: string;
    name: string;
    sets: number;
    reps: number;
    weight: number;
    machinePhotoUrl?: string;
  };
  workouts?: {  // Mantener compatibilidad con posts antiguos
    machineName: string;
    sets: number;
    reps: number;
    weight: number;
  }[];
  timestamp: Date;
  likes: string[];
  date: string;
  comment?: string;
  photoUrl?: string;
}

const SocialFeed: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUserId = auth.currentUser?.uid || '';

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const postsRef = collection(db, 'posts');
      const q = query(postsRef, orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      
      const loadedPosts: Post[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          userName: data.userName,
          userEmail: data.userEmail,
          exercise: data.exercise, // Nuevo formato
          workouts: data.workouts, // Formato antiguo (compatibilidad)
          timestamp: data.timestamp?.toDate() || new Date(),
          likes: data.likes || [],
          date: data.date,
          comment: data.comment || '',
          photoUrl: data.photoUrl || ''
        };
      });
      
      setPosts(loadedPosts);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: string, currentLikes: string[]) => {
    if (!currentUserId) return;

    try {
      const postRef = doc(db, 'posts', postId);
      const hasLiked = currentLikes.includes(currentUserId);

      if (hasLiked) {
        // Quitar like
        await updateDoc(postRef, {
          likes: arrayRemove(currentUserId)
        });
        setPosts(posts.map(post => 
          post.id === postId 
            ? { ...post, likes: post.likes.filter(id => id !== currentUserId) }
            : post
        ));
      } else {
        // Dar like
        await updateDoc(postRef, {
          likes: arrayUnion(currentUserId)
        });
        setPosts(posts.map(post => 
          post.id === postId 
            ? { ...post, likes: [...post.likes, currentUserId] }
            : post
        ));
      }
    } catch (error) {
      console.error('Error updating like:', error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    const confirmed = window.confirm('¿Estás seguro de que quieres eliminar esta publicación?');
    
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'posts', postId));
      setPosts(posts.filter(post => post.id !== postId));
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Error al eliminar la publicación. Inténtalo de nuevo.');
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    
    return date.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short' 
    });
  };

  const getTotalWeight = (workouts: Post['workouts']) => {
    if (!workouts) return 0;
    return workouts.reduce((sum, w) => sum + (w.weight * w.sets * w.reps), 0);
  };

  if (loading) {
    return (
      <div className="social-feed">
        <div className="feed-header">
          <h2>🌟 MAX SOCIAL</h2>
          <p>Conecta con la comunidad de MAXGYM</p>
        </div>
        <div className="loading-posts">
          <p>Cargando publicaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="social-feed">
      <div className="feed-header">
        <h2>🌟 MAX SOCIAL</h2>
        <p>Conecta con la comunidad de MAXGYM</p>
      </div>

      {posts.length === 0 ? (
        <div className="no-posts">
          <h3>🏋️‍♂️ Aún no hay entrenamientos compartidos</h3>
          <p>Sé el primero en compartir tu progreso activando "Compartir públicamente" al registrar tu entrenamiento.</p>
        </div>
      ) : (
        <div className="posts-container">
          {posts.map(post => {
            const hasLiked = post.likes.includes(currentUserId);
            
            // Soportar ambos formatos: ejercicio individual (nuevo) y array de workouts (antiguo)
            const isNewFormat = post.exercise !== undefined;
            
            return (
              <div key={post.id} className="post-card">
                <div className="post-header">
                  <div className="user-avatar">
                    {post.userEmail.charAt(0).toUpperCase()}
                  </div>
                  <div className="post-user-info">
                    <span className="user-name">{post.userEmail.split('@')[0]}</span>
                    <span className="post-time">{formatDate(post.timestamp)}</span>
                  </div>
                  {post.userId === currentUserId && (
                    <button 
                      className="delete-post-btn"
                      onClick={() => handleDeletePost(post.id)}
                      title="Eliminar publicación"
                    >
                      🗑️
                    </button>
                  )}
                </div>

                <div className="post-content">
                  <div className="post-date">
                    📅 {post.date}
                  </div>
                  
                  {isNewFormat && post.exercise ? (
                    // Formato nuevo: ejercicio individual
                    <div className="exercise-post">
                      <h3 className="exercise-title">
                        💪 {post.exercise.machineName}
                      </h3>
                      {post.exercise.name && post.exercise.name !== post.exercise.machineName && (
                        <p className="exercise-name">{post.exercise.name}</p>
                      )}
                      <div className="exercise-stats">
                        <span className="stat-badge">{post.exercise.sets} series</span>
                        <span className="stat-badge">{post.exercise.reps} reps</span>
                        <span className="stat-badge">{post.exercise.weight} kg</span>
                      </div>
                    </div>
                  ) : post.workouts ? (
                    // Formato antiguo: array de workouts (compatibilidad)
                    <>
                      <div className="workout-summary">
                        <div className="summary-stat">
                          <span className="stat-label">Ejercicios</span>
                          <span className="stat-value">{post.workouts.length}</span>
                        </div>
                        <div className="summary-stat">
                          <span className="stat-label">Peso Máx</span>
                          <span className="stat-value">{Math.max(...post.workouts.map(w => w.weight))} kg</span>
                        </div>
                        <div className="summary-stat">
                          <span className="stat-label">Peso Total</span>
                          <span className="stat-value">{getTotalWeight(post.workouts).toFixed(0)} kg</span>
                        </div>
                      </div>

                      <div className="workouts-list">
                        {post.workouts.map((workout, idx) => (
                          <div key={idx} className="workout-item">
                            <span className="workout-machine">{workout.machineName}</span>
                            <span className="workout-details">
                              {workout.sets}x{workout.reps} × {workout.weight}kg
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}

                  {post.comment && (
                    <div className="post-comment">
                      <p>{post.comment}</p>
                    </div>
                  )}

                  {post.photoUrl && (
                    <div className="post-photo">
                      <img src={post.photoUrl} alt="Foto del entrenamiento" />
                    </div>
                  )}
                </div>

                <div className="post-actions">
                  <button 
                    className={`like-button ${hasLiked ? 'liked' : ''}`}
                    onClick={() => handleLike(post.id, post.likes)}
                  >
                    {hasLiked ? '❤️' : '🤍'} {post.likes.length}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SocialFeed;
