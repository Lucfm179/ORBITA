import { useStore } from '../../store/store';

export function FleetPanel() {
  const fleet = useStore((s) => s.fleet);
  const catalogStats = useStore((s) => s.catalogStats);
  const conjunctions = useStore((s) => s.conjunctions);
  const selectedSatellite = useStore((s) => s.selectedSatellite);
  const setSelectedSatellite = useStore((s) => s.setSelectedSatellite);

  return (
    <>
      {/* Left-Top: Ativos rastreados */}
      <div className="fixed left-[34px] top-[118px] w-[260px] z-40 hud-panel flex flex-col font-mono animate-slide-in-left">
        <h3 className="font-['Chakra_Petch'] text-[10px] font-bold tracking-[0.3em] text-[var(--accent-cyan)] uppercase mb-3 flex justify-between items-center">
          ATIVOS RASTREADOS <span className="text-[var(--text-secondary)] font-normal font-mono text-[9px]">{fleet.length}</span>
        </h3>
        <div className="flex flex-col">
          {fleet.map((asset) => {
            const isSelected = selectedSatellite === asset.norad_id;
            
            let statusClass = '';
            let statusLabel = 'NOMINAL';
            if (asset.status === 'critical') {
              statusClass = 'alert';
              statusLabel = 'CONJUNÇÃO';
            } else if (asset.status === 'degraded') {
              statusClass = 'watch';
              statusLabel = 'EM OBSERV.';
            }

            // Hardcode or extract simple orbit label for mockup style
            let orbitLabel = 'LEO ~540 KM';
            if (asset.norad_id === 56215) orbitLabel = 'LEO ~780 KM';
            if (asset.norad_id === 22490) orbitLabel = 'LEO ~650 KM';
            if (asset.norad_id === 25504) orbitLabel = 'LEO ~750 KM';

            return (
              <div
                key={asset.norad_id}
                onClick={() => setSelectedSatellite(isSelected ? null : asset.norad_id)}
                className={`flex items-center gap-2.5 py-2.5 border-b border-dashed border-[rgba(108,125,163,0.2)] last:border-b-0 cursor-pointer select-none transition-all duration-300 hover:bg-[rgba(255,255,255,0.03)] px-1 rounded-sm ${
                  isSelected ? 'bg-[rgba(63,230,214,0.08)] border-solid border-[rgba(63,230,214,0.4)]' : ''
                }`}
              >
                {/* Status indicator dot */}
                <span className={`w-[9px] h-[9px] rounded-full flex-shrink-0 ${
                  statusClass === 'alert'
                    ? 'bg-[var(--accent-red)] shadow-[0_0_9px_var(--accent-red)] animate-pulse'
                    : statusClass === 'watch'
                    ? 'bg-[var(--accent-amber)] shadow-[0_0_9px_var(--accent-amber)]'
                    : 'bg-[var(--accent-green)] shadow-[0_0_9px_var(--accent-green)]'
                }`} />

                <div className="flex-1">
                  <div className="text-xs text-[#fff] tracking-[0.06em] font-bold">
                    {asset.name}
                  </div>
                  <div className="text-[9px] text-[var(--text-secondary)] tracking-[0.12em] mt-0.5">
                    {orbitLabel} · NORAD {asset.norad_id}
                  </div>
                </div>

                <div className={`text-[9px] tracking-[0.18em] font-semibold text-right ${
                  statusClass === 'alert'
                    ? 'text-[var(--accent-red)]'
                    : statusClass === 'watch'
                    ? 'text-[var(--accent-amber)]'
                    : 'text-[var(--accent-green)]'
                }`}>
                  {statusLabel}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Left-Bottom: População orbital */}
      <div className="fixed left-[34px] bottom-[34px] w-[260px] z-40 hud-panel flex flex-col font-mono animate-slide-in-left">
        <h3 className="font-['Chakra_Petch'] text-[10px] font-bold tracking-[0.3em] text-[var(--accent-cyan)] uppercase mb-3 flex justify-between">
          POPULAÇÃO ORBITAL
        </h3>
        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between items-baseline border-b border-dashed border-[rgba(108,125,163,0.2)] pb-1.5">
            <span className="text-[10px] tracking-[0.18em] text-[var(--text-secondary)]">OBJETOS</span>
            <span className="font-['Chakra_Petch'] text-lg font-semibold text-[var(--accent-cyan)]">
              {catalogStats?.total?.toLocaleString('pt-BR') || '0'}
            </span>
          </div>
          <div className="flex justify-between items-baseline border-b border-dashed border-[rgba(108,125,163,0.2)] pb-1.5">
            <span className="text-[10px] tracking-[0.18em] text-[var(--text-secondary)]">SATÉLITES ATIVOS</span>
            <span className="font-['Chakra_Petch'] text-lg font-semibold text-[var(--accent-cyan)]">
              {catalogStats?.active?.toLocaleString('pt-BR') || '0'}
            </span>
          </div>
          <div className="flex justify-between items-baseline border-b border-dashed border-[rgba(108,125,163,0.2)] pb-1.5">
            <span className="text-[10px] tracking-[0.18em] text-[var(--text-secondary)]">DETRITOS</span>
            <span className="font-['Chakra_Petch'] text-lg font-semibold text-[var(--accent-amber)]">
              {catalogStats?.debris?.toLocaleString('pt-BR') || '0'}
            </span>
          </div>
          <div className="flex justify-between items-baseline pb-0">
            <span className="text-[10px] tracking-[0.18em] text-[var(--text-secondary)]">ALERTAS / 72H</span>
            <span className="font-['Chakra_Petch'] text-lg font-semibold text-[var(--accent-red)]">
              {conjunctions.length}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

