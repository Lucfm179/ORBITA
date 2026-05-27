import { useStore } from '../../store/store';

export function AboutModal() {
  const isAboutOpen = useStore((s) => s.isAboutOpen);
  const setIsAboutOpen = useStore((s) => s.setIsAboutOpen);

  if (!isAboutOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(4,6,15,0.85)] backdrop-blur-md font-mono"
      onClick={() => setIsAboutOpen(false)}
    >
      <div 
        className="hud-panel w-full max-w-[680px] max-h-[85vh] overflow-y-auto flex flex-col border border-[var(--accent-cyan)] shadow-[0_0_40px_rgba(63,230,214,0.15)] animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-[rgba(63,230,214,0.22)] pb-4 mb-5">
          <div>
            <h2 className="font-['Chakra_Petch'] text-lg font-bold tracking-[0.2em] text-[#fff] uppercase">
              SOBRE O PROJETO ORB<span className="text-[var(--accent-cyan)]">I</span>TA
            </h2>
            <p className="text-[9px] text-[var(--text-secondary)] tracking-wider uppercase mt-1">
              Global Solution 2026 · FIAP Espaço & Sustentabilidade
            </p>
          </div>
          <button 
            onClick={() => setIsAboutOpen(false)}
            className="filter-btn !text-xs !px-3 !py-1 !font-bold"
          >
            [ FECHAR ]
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col gap-6 text-xs leading-relaxed text-[var(--text-primary)]">
          {/* Mission & ODS */}
          <div>
            <h3 className="font-['Chakra_Petch'] text-[10px] font-bold tracking-[0.2em] text-[var(--accent-cyan)] uppercase mb-2">
              🛰️ 1. MISSÃO E ALINHAMENTO ODS
            </h3>
            <p className="mb-2">
              O **ORBITA** é uma central inteligente de controle de tráfego espacial dedicada a proteger a infraestrutura orbital crítica da Terra. O projeto está diretamente alinhado com as seguintes metas da ONU:
            </p>
            <ul className="list-disc list-inside pl-2 flex flex-col gap-1 text-[11px] text-[var(--text-secondary)]">
              <li>
                <strong className="text-[var(--text-primary)]">ODS 9 (Indústria, Inovação e Infraestrutura):</strong> Protege satélites essenciais de telecomunicações, GPS, monitoramento e meteorologia, evitando colisões com detritos espaciais.
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">ODS 14 (Vida na Água):</strong> Auxilia frotas de observação da Terra (como o satélite brasileiro <span className="text-white font-semibold">Amazonia-1</span> do INPE) a realizarem de forma segura o monitoramento ambiental de oceanos e florestas sem risco de perda operacional catastrófica.
              </li>
            </ul>
          </div>

          {/* Space Debris Problem */}
          <div>
            <h3 className="font-['Chakra_Petch'] text-[10px] font-bold tracking-[0.2em] text-[var(--accent-cyan)] uppercase mb-2">
              ☄️ 2. O PROBLEMA E A SÍNDROME DE KESSLER
            </h3>
            <p>
              A órbita baixa terrestre (LEO) abriga dezenas de milhares de objetos e detritos espaciais viajando a velocidades relativas de até **28.000 km/h**. Uma colisão física, por menor que seja o detrito, destrói satélites e gera milhares de novos estilhaços. Esse crescimento em cadeia (a chamada **Síndrome de Kessler**) pode tornar a órbita inutilizável para gerações futuras.
            </p>
          </div>

          {/* SGP4 & Monte Carlo */}
          <div>
            <h3 className="font-['Chakra_Petch'] text-[10px] font-bold tracking-[0.2em] text-[var(--accent-cyan)] uppercase mb-2">
              🧬 3. MOTOR FÍSICO E PROPAGAÇÃO (SGP4 + MONTE CARLO)
            </h3>
            <p className="mb-2">
              Para mapear e prever riscos com precisão, a plataforma executa as seguintes etapas:
            </p>
            <ul className="list-decimal list-inside pl-2 flex flex-col gap-1.5 text-[11px] text-[var(--text-secondary)]">
              <li>
                <strong className="text-[var(--text-primary)]">Propagação SGP4:</strong> Traduz conjuntos de parâmetros TLE (Two-Line Elements) em coordenadas cartesianas (x, y, z) tridimensionais no espaço Inercial.
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">Filtros Geométricos:</strong> O backend roda pré-filtros de altitude (apogeu e perigeu) eliminando 99% das combinações redundantes e tornando a triagem computacionalmente tratável.
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">Simulação de Monte Carlo:</strong> Para aproximações críticas de risco, o sistema simula centenas de perturbações orbitais estatísticas baseadas na incerteza da órbita e calcula a probabilidade matemática exata de colisão ($P_c$).
              </li>
            </ul>
          </div>

          {/* Machine Learning */}
          <div>
            <h3 className="font-['Chakra_Petch'] text-[10px] font-bold tracking-[0.2em] text-[var(--accent-cyan)] uppercase mb-2">
              🧠 4. INTELIGÊNCIA ARTIFICIAL (TRIAGEM DE ALERTAS)
            </h3>
            <p>
              Em vez de sobrecarregar operadores humanos com centenas de alarmes falsos semanais, o ORBITA utiliza um classificador **Gradient Boosting Classifier** (treinado pelo scikit-learn no backend). 
              A IA pondera 7 variáveis (incluindo distância mínima, velocidade relativa e a idade das TLEs) e devolve um score de risco de <span className="text-[var(--accent-cyan)]">0.0</span> a <span className="text-[var(--accent-cyan)]">1.0</span>, recomendando se o operador deve:
            </p>
            <div className="flex gap-4 mt-3 text-center text-[10px] uppercase font-bold tracking-wider">
              <div className="flex-1 p-2 bg-[rgba(255,59,78,0.06)] border border-[rgba(255,59,78,0.2)] text-[var(--accent-red)] rounded-sm">
                Risco Alto &gt; 0.7
                <div className="text-[8px] text-[var(--text-primary)] mt-1 lowercase">Avaliar Manobra</div>
              </div>
              <div className="flex-1 p-2 bg-[rgba(246,166,35,0.06)] border border-[rgba(246,166,35,0.2)] text-[var(--accent-amber)] rounded-sm">
                Risco Médio 0.3 - 0.7
                <div className="text-[8px] text-[var(--text-primary)] mt-1 lowercase">Monitorar Órbita</div>
              </div>
              <div className="flex-1 p-2 bg-[rgba(63,230,214,0.06)] border border-[rgba(63,230,214,0.2)] text-[var(--accent-cyan)] rounded-sm">
                Risco Baixo &lt; 0.3
                <div className="text-[8px] text-[var(--text-primary)] mt-1 lowercase">Sem Ação Requerida</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="border-t border-[rgba(63,230,214,0.15)] pt-4 mt-6 text-center text-[9px] text-[var(--text-muted)] tracking-widest uppercase">
          ORBITA SPACE TRAFFIC SYSTEMS © 2026
        </div>
      </div>
    </div>
  );
}
