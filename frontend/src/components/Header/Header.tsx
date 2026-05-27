import { useState, useEffect } from 'react';

export function Header() {
  const [liveLocalTime, setLiveLocalTime] = useState('');
  const [liveUTCTime, setLiveUTCTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const t = new Date();
      
      // Local Time: HH:MM:SS
      const localStr = [t.getHours(), t.getMinutes(), t.getSeconds()]
        .map((n) => String(n).padStart(2, '0'))
        .join(':');
      
      // Timezone Offset: e.g. UTC-3
      const offsetMin = t.getTimezoneOffset();
      const offsetSign = offsetMin > 0 ? '-' : '+';
      const offsetHrs = Math.abs(Math.floor(offsetMin / 60));
      setLiveLocalTime(`${localStr} (UTC${offsetSign}${offsetHrs})`);

      // UTC Time: HH:MM:SSZ
      setLiveUTCTime(
        [t.getUTCHours(), t.getUTCMinutes(), t.getUTCSeconds()]
          .map((n) => String(n).padStart(2, '0'))
          .join(':') + 'Z'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Top-Left: Brand */}
      <div className="fixed top-[30px] left-[34px] z-50 pointer-events-none select-none">
        <div className="font-['Chakra_Petch'] font-bold text-[30px] tracking-[0.42em] text-[#fff] leading-none drop-shadow-[0_0_22px_rgba(63,230,214,0.45)]">
          ORB<span className="text-[var(--accent-cyan)]">I</span>TA
        </div>
        <div className="mt-[7px] text-[10px] tracking-[0.34em] text-[var(--text-secondary)] uppercase">
          Orbital Traffic Intelligence
        </div>
      </div>

      {/* Top-Right: Status */}
      <div className="fixed top-[30px] right-[34px] z-50 text-right pointer-events-none select-none">
        <div className="font-['Chakra_Petch'] text-[21px] font-semibold tracking-[0.14em] text-[#fff]">
          {liveLocalTime}
        </div>
        <div className="mt-[6px] text-[10px] tracking-[0.2em] text-[var(--text-secondary)] flex items-center justify-end">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] shadow-[0_0_8px_var(--accent-green)] mr-1.5 animate-pulse" />
          <span className="text-[var(--accent-green)] font-bold">LIVE</span> · UTC {liveUTCTime} · TLE FEED
        </div>
      </div>
    </>
  );
}
