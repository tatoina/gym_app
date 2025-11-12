import React, { useState, useEffect } from 'react';
import './AppTour.css';

interface Step {
  title: string;
  description: string;
  target?: string;
  placement?: 'center' | 'top' | 'bottom' | 'left' | 'right';
}

interface AppTourProps {
  run: boolean;
  onFinish: () => void;
}

const AppTour: React.FC<AppTourProps> = ({ run, onFinish }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const steps: Step[] = [
    {
      title: '🎉 ¡Bienvenido a MAXGYM!',
      description: 'Te voy a mostrar cómo usar la aplicación para registrar tus entrenamientos y seguir las tablas de ejercicios que Max te asigne.',
      placement: 'center'
    },
    {
      title: '🏋️ Entrenar',
      description: 'Aquí registras tus entrenamientos diarios. Selecciona la máquina, añade series, repeticiones y peso. ¡Así de fácil!',
      target: '[data-tour="nav-entrenar"]',
      placement: 'bottom'
    },
    {
      title: '📊 Historial',
      description: 'Revisa todos tus entrenamientos pasados, ve tu progreso en gráficas y analiza tu evolución semana a semana.',
      target: '[data-tour="nav-historial"]',
      placement: 'bottom'
    },
    {
      title: '📋 Mis Tablas',
      description: 'Aquí verás las tablas de ejercicios que Max te asigna. Son tu guía para entrenar correctamente cada día.',
      target: '[data-tour="nav-tablas"]',
      placement: 'bottom'
    },
    {
      title: '☀️ Tema Claro/Oscuro',
      description: 'Cambia entre tema oscuro y claro según tu preferencia. Tu elección se guardará automáticamente.',
      target: '[data-tour="theme-toggle"]',
      placement: 'bottom'
    },
    {
      title: '👤 Tu Perfil',
      description: 'Aquí puedes subir tu foto de perfil, volver a ver este tour o cerrar sesión cuando termines.',
      target: '[data-tour="user-avatar"]',
      placement: 'left'
    },
    {
      title: '✅ ¡Todo Listo!',
      description: 'Ya conoces todas las funcionalidades de MAXGYM. Puedes volver a ver este tour desde tu avatar → "Ver Tutorial"',
      placement: 'center'
    }
  ];

  useEffect(() => {
    if (run && steps[currentStep].target) {
      const element = document.querySelector(steps[currentStep].target!);
      if (element) {
        const rect = element.getBoundingClientRect();
        const placement = steps[currentStep].placement || 'bottom';
        
        let top = 0;
        let left = 0;
        
        switch (placement) {
          case 'bottom':
            top = rect.bottom + window.scrollY + 20;
            left = rect.left + window.scrollX + (rect.width / 2);
            break;
          case 'top':
            top = rect.top + window.scrollY - 20;
            left = rect.left + window.scrollX + (rect.width / 2);
            break;
          case 'left':
            top = rect.top + window.scrollY + (rect.height / 2);
            left = rect.left + window.scrollX - 20;
            break;
          case 'right':
            top = rect.top + window.scrollY + (rect.height / 2);
            left = rect.right + window.scrollX + 20;
            break;
        }
        
        setPosition({ top, left });
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentStep, run, steps]);

  if (!run) return null;

  const step = steps[currentStep];
  const isCenter = step.placement === 'center';

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onFinish();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onFinish();
  };

  return (
    <>
      <div className="tour-overlay" onClick={handleSkip} />
      {step.target && (
        <div 
          className="tour-spotlight" 
          style={{
            top: `${document.querySelector(step.target)?.getBoundingClientRect().top}px`,
            left: `${document.querySelector(step.target)?.getBoundingClientRect().left}px`,
            width: `${document.querySelector(step.target)?.getBoundingClientRect().width}px`,
            height: `${document.querySelector(step.target)?.getBoundingClientRect().height}px`,
          }}
        />
      )}
      <div 
        className={`tour-tooltip ${isCenter ? 'tour-tooltip-center' : ''}`}
        style={isCenter ? {} : { top: `${position.top}px`, left: `${position.left}px` }}
      >
        <div className="tour-content">
          <h3>{step.title}</h3>
          <p>{step.description}</p>
          <div className="tour-progress">
            Paso {currentStep + 1} de {steps.length}
          </div>
        </div>
        <div className="tour-actions">
          <button onClick={handleSkip} className="tour-btn tour-btn-skip">
            Saltar
          </button>
          {currentStep > 0 && (
            <button onClick={handleBack} className="tour-btn tour-btn-back">
              Atrás
            </button>
          )}
          <button onClick={handleNext} className="tour-btn tour-btn-next">
            {currentStep === steps.length - 1 ? 'Finalizar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </>
  );
};

export default AppTour;
