import { useStore } from '../../store/store';

export function AlertFeed() {
  const fleet = useStore((s) => s.fleet);
  const conjunctions = useStore((s) => s.conjunctions);
  const selectedConjunction = useStore((s) => s.selectedConjunction);
  const setSelectedConjunction = useStore((s) => s.setSelectedConjunction);
  const selectedSatellite = useStore((s) => s.selectedSatellite);
  
  const filterTier = useStore((s) => s.filterTier);
  const setFilterTier = useStore((s) => s.setFilterTier);

  // Filter and sort conjunctions
  let filteredConjunctions = [...conjunctions];

  // 1. Filter by selected fleet satellite
  if (selectedSatellite !== null) {
    filteredConjunctions = filteredConjunctions.filter(
      (c) => c.primary.norad_id === selectedSatellite
    );
  }

  // 2. Filter by risk tier
  if (filterTier !== null) {
    filteredConjunctions = filteredConjunctions.filter(
      (c) => c.risk_tier === filterTier
    );
  }

  // 3. Sort by risk score descending
  filteredConjunctions.sort((a, b) => b.risk_score - a.risk_score);

  // Format TCA to show countdown and local datetime (e.g. "T-14h 32m (27/05 15:04:19)")
  const formatTime = (tcaString: string) => {
    try {
      const date = new Date(tcaString);
      const now = new Date();
      const diffMs = date.getTime() - now.getTime();
      
      const localTimeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const localDateStr = date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
      
      if (diffMs <= 0) {
        return `Ocorrido (${localDateStr} ${localTimeStr})`;
      }
      
      const diffHrs = Math.floor(diffMs / 3600000);
      const diffMins = Math.floor((diffMs % 3600000) / 60000);
      
      let countdown = '';
      if (diffHrs > 0) {
        countdown = `T-${diffHrs}h ${diffMins}m`;
      } else {
        countdown = `T-${diffMins}m`;
      }
      
      return `${countdown} (${localDateStr} ${localTimeStr})`;
    } catch {
      return '00:00:00';
    }
  };

  // Compute fleet risk index data
  const getFleetRisk = () => {
    const states = fleet.map(f => f.status);
    if (states.includes('critical')) {
      return {
        riskVal: 'CRÍTICO',
        riskFillWidth: '86%',
        riskColor: 'var(--accent-red)',
        riskTxt: 'MANOBRA EVASIVA RECOMENDADA — AMAZONIA 1'
      };
    }
    if (states.includes('degraded')) {
      return {
        riskVal: 'MÉDIO',
        riskFillWidth: '52%',
        riskColor: 'var(--accent-amber)',
        riskTxt: 'MONITORAMENTO ATIVO DE 1 ATIVO'
      };
    }
    return {
      riskVal: 'BAIXO',
      riskFillWidth: '18%',
      riskColor: 'var(--accent-green)',
      riskTxt: 'TODOS OS ATIVOS NOMINAIS'
    };
  };

  const { riskVal, riskFillWidth, riskColor, riskTxt } = getFleetRisk();

  return (
    <>
      {/* Right-Top: Alertas de conjunção */}
      <div className="fixed right-[34px] top-[118px] w-[300px] max-h-[calc(100vh-320px)] z-40 hud-panel flex flex-col font-mono animate-slide-in-right">
        <h3 className="font-['Chakra_Petch'] text-[10px] font-bold tracking-[0.3em] text-[var(--accent-cyan)] uppercase mb-3 flex justify-between items-center">
          ALERTAS DE CONJUNÇÃO <span className="text-[var(--text-secondary)] font-normal font-mono text-[9px]">72H</span>
        </h3>

        {/* Filter buttons */}
        <div className="flex gap-1.5 mb-3 border-b border-[rgba(255,255,255,0.05)] pb-3">
          <button
            onClick={() => setFilterTier(null)}
            className={`filter-btn !text-[8px] !px-2.5 !py-1 ${filterTier === null ? 'active' : ''}`}
          >
            TODOS
          </button>
          <button
            onClick={() => setFilterTier('alto')}
            className={`filter-btn !text-[8px] !px-2.5 !py-1 ${filterTier === 'alto' ? 'active' : ''}`}
          >
            ALTO
          </button>
          <button
            onClick={() => setFilterTier('medio')}
            className={`filter-btn !text-[8px] !px-2.5 !py-1 ${filterTier === 'medio' ? 'active' : ''}`}
          >
            MÉDIO
          </button>
          <button
            onClick={() => setFilterTier('baixo')}
            className={`filter-btn !text-[8px] !px-2.5 !py-1 ${filterTier === 'baixo' ? 'active' : ''}`}
          >
            BAIXO
          </button>
        </div>

        {/* Conjunction list */}
        <div className="flex-1 overflow-y-auto pr-0.5 flex flex-col gap-3">
          {filteredConjunctions.length === 0 ? (
            <div className="text-center py-6 text-[var(--text-muted)] text-[10px] uppercase tracking-wider border border-dashed border-[rgba(108,125,163,0.15)] rounded-sm">
              NENHUM ALERTA ATIVO
            </div>
          ) : (
            filteredConjunctions.map((conj) => {
              const isSelected = selectedConjunction === conj.id;
              
              let sevLabel = 'BAIXO';
              let sevColor = 'text-[var(--accent-cyan)]';
              
              if (conj.risk_tier === 'alto') {
                sevLabel = 'ALTA';
                sevColor = 'text-[var(--accent-red)]';
              } else if (conj.risk_tier === 'medio') {
                sevLabel = 'MÉDIA';
                sevColor = 'text-[var(--accent-amber)]';
              }

              return (
                <div
                  key={conj.id}
                  onClick={() => setSelectedConjunction(isSelected ? null : conj.id)}
                  className={`py-2.5 border-b border-dashed border-[rgba(108,125,163,0.2)] last:border-b-0 cursor-pointer select-none transition-all duration-300 hover:bg-[rgba(255,255,255,0.03)] px-1 rounded-sm ${
                    isSelected ? 'bg-[rgba(63,230,214,0.08)] border-solid border-[rgba(63,230,214,0.4)]' : ''
                  }`}
                >
                  <div className="flex justify-between items-center text-[9px] tracking-[0.14em] mb-1.5">
                    <span className={`font-bold ${sevColor}`}>● RISCO {sevLabel}</span>
                    <span className="text-[var(--text-secondary)] font-mono">{formatTime(conj.tca)}</span>
                  </div>
                  <div className="text-xs text-[#fff] tracking-[0.04em] font-medium truncate" title={`${conj.primary.name} vs ${conj.secondary.name}`}>
                    {conj.primary.name} / {conj.secondary.name}
                  </div>
                  <div className="text-[9px] text-[var(--text-secondary)] tracking-[0.08em] mt-1">
                    DIST. MÍN {conj.miss_distance_km.toFixed(2)} KM · VEL. REL {conj.relative_velocity_kms.toFixed(1)} KM/S
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right-Bottom: Fleet Risk Index */}
      <div className="fixed right-[34px] bottom-[34px] w-[300px] z-40 hud-panel flex flex-col font-mono text-center animate-slide-in-right">
        <div className="text-[10px] tracking-[0.26em] text-[var(--text-secondary)] mb-3 font-semibold">
          ÍNDICE DE RISCO DA FROTA
        </div>
        <div className="h-2 bg-[rgba(108,125,163,0.18)] relative overflow-hidden mb-3">
          <div
            className="absolute left-0 top-0 bottom-0 transition-all duration-500"
            style={{
              width: riskFillWidth,
              background: 'linear-gradient(90deg, var(--accent-green), var(--accent-amber), var(--accent-red))'
            }}
          />
        </div>
        <div className="font-['Chakra_Petch'] text-2xl font-extrabold tracking-[0.06em] transition-colors" style={{ color: riskColor }}>
          {riskVal}
        </div>
        <div className="text-[9px] tracking-[0.22em] text-[var(--text-secondary)] mt-1.5 uppercase font-medium">
          {riskTxt}
        </div>
      </div>
    </>
  );
}

