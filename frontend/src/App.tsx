import { useEffect } from 'react';
import { useStore } from './store/store';
import { Globe } from './components/Globe';
import { Header } from './components/Header/Header';
import { FleetPanel } from './components/FleetPanel/FleetPanel';
import { AlertFeed } from './components/AlertFeed/AlertFeed';
import { LoadingScreen } from './components/LoadingScreen/LoadingScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { VisualSettings } from './components/VisualSettings/VisualSettings';
import { AboutModal } from './components/AboutModal/AboutModal';

function App() {
  const isLoading = useStore((s) => s.isLoading);
  const error = useStore((s) => s.error);
  const loadAllData = useStore((s) => s.loadAllData);
  const fleet = useStore((s) => s.fleet);

  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => {
      loadAllData();
    }, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [loadAllData]);

  const isCritical = fleet.some((f) => f.status === 'critical');

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)', position: 'relative' }}>
      {isLoading && <LoadingScreen />}
      
      {/* Brackets for mission-control framing */}
      <div className="frame"></div>

      <ErrorBoundary fallbackTitle="Header">
        <Header />
      </ErrorBoundary>
      
      {/* Full screen Globe in the background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <ErrorBoundary fallbackTitle="Globe">
          <Globe />
        </ErrorBoundary>
      </div>

      {/* Floating HUD Panels */}
      <ErrorBoundary fallbackTitle="FleetPanel">
        <FleetPanel />
      </ErrorBoundary>
      
      <ErrorBoundary fallbackTitle="AlertFeed">
        <AlertFeed />
      </ErrorBoundary>

      <ErrorBoundary fallbackTitle="VisualSettings">
        <VisualSettings />
      </ErrorBoundary>

      <ErrorBoundary fallbackTitle="AboutModal">
        <AboutModal />
      </ErrorBoundary>

      {/* Flashing warning banner at the top center */}
      {isCritical && (
        <div className="fixed left-1/2 top-[46px] -translate-x-1/2 z-50 font-['Chakra_Petch'] text-xs font-semibold tracking-[0.3em] text-[var(--accent-red)] border border-[var(--accent-red)] bg-[rgba(255,59,78,0.1)] py-2 px-6 uppercase shadow-[0_0_30px_rgba(255,59,78,0.4)] animate-pulse pointer-events-none">
          ⚠ Conjunção crítica detectada
        </div>
      )}

      {/* Legend / Hint at the bottom center */}
      <div className="fixed left-1/2 bottom-[18px] -translate-x-1/2 z-50 text-[9px] tracking-[0.2em] text-[var(--text-secondary)] text-center pointer-events-none select-none uppercase">
        ARRASTE PARA ORBITAR · ROLE PARA ZOOM &nbsp;|&nbsp;
        <span className="inline-flex items-center gap-1 mx-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cyan)] shadow-[0_0_7px_var(--accent-cyan)]" /> ATIVOS
        </span>
        <span className="inline-flex items-center gap-1 mx-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-amber)] shadow-[0_0_7px_var(--accent-amber)]" /> DETRITOS
        </span>
        <span className="inline-flex items-center gap-1 mx-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ffffff] shadow-[0_0_7px_#ffffff]" /> SUA FROTA
        </span>
      </div>

      {error && (
        <div style={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255,51,102,0.15)',
          border: '1px solid var(--accent-red)',
          borderRadius: 8,
          padding: '8px 16px',
          color: 'var(--accent-red)',
          fontSize: '0.85rem',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          Erro: {error}
        </div>
      )}
    </div>
  );
}

export default App;

