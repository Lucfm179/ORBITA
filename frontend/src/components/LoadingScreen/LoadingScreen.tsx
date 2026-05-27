import { useState, useEffect } from 'react';

export function LoadingScreen() {
  const [statusIdx, setStatusIdx] = useState(0);
  
  const statusTexts = [
    'Conectando ao catálogo orbital...',
    'Carregando dados dos satélites...',
    'Propagando órbitas em tempo real...',
    'Analisando janelas de aproximação...',
    'Executando triagem com IA de risco...',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIdx((prev) => (prev + 1) % statusTexts.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050510]">
      {/* Background Starfield Mock */}
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--border-glow),_transparent)] pointer-events-none" />
      
      {/* Animated Orbit Rings */}
      <div className="relative w-40 h-40 flex items-center justify-center mb-8">
        <div className="loading-orbit-ring" />
        <div className="loading-orbit-ring-2" />
        <span className="text-xl font-bold tracking-widest text-[var(--accent-cyan)] font-['Space_Grotesk'] animate-pulse">
          🛰️
        </span>
      </div>

      {/* Brand Title */}
      <h1 className="text-3xl font-black tracking-[0.25em] text-gradient-cyan glow-text-cyan font-['Space_Grotesk'] mb-3">
        ORBITA
      </h1>

      {/* Rotating Status Text */}
      <div className="h-6 flex items-center justify-center">
        <p className="text-xs font-mono text-[var(--text-secondary)] tracking-wide animate-pulse">
          {statusTexts[statusIdx]}
        </p>
      </div>
    </div>
  );
}
