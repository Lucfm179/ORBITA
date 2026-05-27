import { useStore } from '../../store/store';

export function VisualSettings() {
  const earthTexture = useStore((s) => s.earthTexture);
  const setEarthTexture = useStore((s) => s.setEarthTexture);
  const backgroundStyle = useStore((s) => s.backgroundStyle);
  const setBackgroundStyle = useStore((s) => s.setBackgroundStyle);
  const timeScale = useStore((s) => s.timeScale);
  const setTimeScale = useStore((s) => s.setTimeScale);
  const autoRotate = useStore((s) => s.autoRotate);
  const setAutoRotate = useStore((s) => s.setAutoRotate);

  return (
    <div className="fixed left-1/2 bottom-[45px] -translate-x-1/2 z-40 hud-panel flex items-center gap-5 font-mono text-[9px] tracking-wider uppercase animate-slide-in-bottom select-none">
      <div className="flex items-center gap-2">
        <span className="text-[var(--text-secondary)] font-bold">TERRA:</span>
        <button
          onClick={() => setEarthTexture('day')}
          className={`filter-btn !text-[8px] !px-2 !py-0.5 ${earthTexture === 'day' ? 'active' : ''}`}
        >
          DIA
        </button>
        <button
          onClick={() => setEarthTexture('night')}
          className={`filter-btn !text-[8px] !px-2 !py-0.5 ${earthTexture === 'night' ? 'active' : ''}`}
        >
          NOITE
        </button>
        <button
          onClick={() => setEarthTexture('fallback')}
          className={`filter-btn !text-[8px] !px-2 !py-0.5 ${earthTexture === 'fallback' ? 'active' : ''}`}
        >
          MINIMALISTA
        </button>
      </div>

      <div className="w-[1px] h-3 bg-[rgba(108,125,163,0.3)]" />

      <div className="flex items-center gap-2">
        <span className="text-[var(--text-secondary)] font-bold">ESPAÇO:</span>
        <button
          onClick={() => setBackgroundStyle('stars')}
          className={`filter-btn !text-[8px] !px-2 !py-0.5 ${backgroundStyle === 'stars' ? 'active' : ''}`}
        >
          ESTRELADO
        </button>
        <button
          onClick={() => setBackgroundStyle('deep')}
          className={`filter-btn !text-[8px] !px-2 !py-0.5 ${backgroundStyle === 'deep' ? 'active' : ''}`}
        >
          PROFUNDO
        </button>
        <button
          onClick={() => setBackgroundStyle('empty')}
          className={`filter-btn !text-[8px] !px-2 !py-0.5 ${backgroundStyle === 'empty' ? 'active' : ''}`}
        >
          VAZIO
        </button>
      </div>

      <div className="w-[1px] h-3 bg-[rgba(108,125,163,0.3)]" />

      <div className="flex items-center gap-2">
        <span className="text-[var(--text-secondary)] font-bold">CÂMERA:</span>
        <button
          onClick={() => setAutoRotate(true)}
          className={`filter-btn !text-[8px] !px-2 !py-0.5 ${autoRotate ? 'active' : ''}`}
        >
          GIRATÓRIA
        </button>
        <button
          onClick={() => setAutoRotate(false)}
          className={`filter-btn !text-[8px] !px-2 !py-0.5 ${!autoRotate ? 'active' : ''}`}
        >
          FIXA
        </button>
      </div>

      <div className="w-[1px] h-3 bg-[rgba(108,125,163,0.3)]" />

      <div className="flex items-center gap-2">
        <span className="text-[var(--text-secondary)] font-bold">VELOCIDADE:</span>
        <button
          onClick={() => setTimeScale(1)}
          className={`filter-btn !text-[8px] !px-2 !py-0.5 ${timeScale === 1 ? 'active' : ''}`}
        >
          1X (REAL)
        </button>
        <button
          onClick={() => setTimeScale(10)}
          className={`filter-btn !text-[8px] !px-2 !py-0.5 ${timeScale === 10 ? 'active' : ''}`}
        >
          10X
        </button>
        <button
          onClick={() => setTimeScale(100)}
          className={`filter-btn !text-[8px] !px-2 !py-0.5 ${timeScale === 100 ? 'active' : ''}`}
        >
          100X
        </button>
        <button
          onClick={() => setTimeScale(600)}
          className={`filter-btn !text-[8px] !px-2 !py-0.5 ${timeScale === 600 ? 'active' : ''}`}
        >
          600X
        </button>
      </div>
    </div>
  );
}
