import React, { useState, useEffect } from 'react';
import './AppTour.css';

interface Step {
  title: string;
  description: string;
  target?: string;
  placement?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  view?: 'workout' | 'history' | 'assigned';
}

interface AppTourProps {
  run: boolean;
  onFinish: () => void;
  onChangeView?: (view: 'workout' | 'history' | 'assigned') => void;
}

const AppTour: React.FC<AppTourProps> = ({ run, onFinish, onChangeView }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [actualPlacement, setActualPlacement] = useState<'center' | 'top' | 'bottom' | 'left' | 'right'>('bottom');

  const steps: Step[] = [
    {
      title: '🎉 ¡Bienvenido a MAXGYM!',
      description: 'Te voy a mostrar cómo usar la aplicación para registrar tus entrenamientos y seguir las tablas de ejercicios que Max te asigne.',
      placement: 'center',
      view: 'workout'
    },
    {
      title: '🏋️ Botón Entrenar',
      description: 'Este es el botón principal. Aquí registras tus entrenamientos diarios: selecciona la máquina, añade series, repeticiones y peso.',
      target: '[data-tour="nav-entrenar"]',
      placement: 'center',
      view: 'workout'
    },
    {
      title: '📊 Botón Historial',
      description: 'Con este botón accedes a tu historial completo de entrenamientos. Verás gráficas de progreso y evolución semana a semana.',
      target: '[data-tour="nav-historial"]',
      placement: 'center',
      view: 'workout'
    },
    {
      title: '📋 Botón Mis Tablas',
      description: 'Aquí encuentras las tablas de ejercicios que Max te asigna. Son tu guía de entrenamiento personalizada.',
      target: '[data-tour="nav-tablas"]',
      placement: 'center',
      view: 'workout'
    },
    {
      title: '💬 Botón Solicitar Cambios',
      description: '¿Necesitas modificar tu tabla? Este botón te permite enviar un mensaje directo a Max. Le llegará un email automáticamente con tu solicitud.',
      target: '[data-tour="request-change"]',
      placement: 'center',
      view: 'assigned'
    },
    {
      title: '📚 Botón Historial de Tablas',
      description: 'Aquí consultas todas las tablas anteriores que has completado. Perfecto para revisar tu progresión.',
      target: '[data-tour="history-button"]',
      placement: 'center',
      view: 'assigned'
    },
    {
      title: '✅ ¡Todo Listo!',
      description: 'Ya conoces todas las funcionalidades de MAXGYM. ¡A entrenar! 💪',
      placement: 'center',
      view: 'workout'
    }
  ];

  useEffect(() => {
    if (run) {
      // Cambiar vista si es necesario
      const step = steps[currentStep];
      if (step.view && onChangeView) {
        onChangeView(step.view);
      }

      // Esperar a que se renderice la vista
      setTimeout(() => {
        if (step.target) {
          const element = document.querySelector(step.target);
          if (element) {
            const rect = element.getBoundingClientRect();
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const tooltipWidth = windowWidth < 768 ? windowWidth - 40 : 400; // Responsive
            const tooltipHeight = 200; // Altura aproximada del tooltip
            
            let placement = step.placement || 'bottom';
            let top = 0;
            let left = 0;
            
            // Calcular posición inicial según placement
            switch (placement) {
              case 'bottom':
                top = rect.bottom + window.scrollY + 20;
                left = rect.left + window.scrollX + (rect.width / 2);
                break;
              case 'top':
                top = rect.top + window.scrollY - tooltipHeight - 20;
                left = rect.left + window.scrollX + (rect.width / 2);
                break;
              case 'left':
                top = rect.top + window.scrollY + (rect.height / 2);
                left = rect.left + window.scrollX - tooltipWidth - 20;
                break;
              case 'right':
                top = rect.top + window.scrollY + (rect.height / 2);
                left = rect.right + window.scrollX + 20;
                break;
            }
            
            // Ajustar horizontalmente si se sale de la pantalla
            if (left - (tooltipWidth / 2) < 20) {
              left = 20 + (tooltipWidth / 2);
            } else if (left + (tooltipWidth / 2) > windowWidth - 20) {
              left = windowWidth - 20 - (tooltipWidth / 2);
            }
            
            // Ajustar verticalmente si se sale de la pantalla
            if (top < window.scrollY + 20) {
              // Si se sale por arriba, poner debajo del elemento
              top = rect.bottom + window.scrollY + 20;
              placement = 'bottom';
            } else if (top + tooltipHeight > window.scrollY + windowHeight - 20) {
              // Si se sale por abajo, poner arriba del elemento
              top = rect.top + window.scrollY - tooltipHeight - 20;
              placement = 'top';
            }
            
            setPosition({ top, left });
            if (placement !== 'center') {
              setActualPlacement(placement);
            }
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 300);
    }
  }, [currentStep, run, steps, onChangeView]);

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
        className="tour-tooltip tour-tooltip-center"
        style={{}}
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
