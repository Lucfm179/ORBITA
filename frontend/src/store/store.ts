import { create } from 'zustand';
import { api } from '../lib/api';
import type { TLEObject, FleetAsset, Conjunction, CatalogStats } from '../lib/api';

interface OrbitaStore {
  tles: TLEObject[];
  fleet: FleetAsset[];
  conjunctions: Conjunction[];
  catalogStats: CatalogStats | null;
  isLoading: boolean;
  error: string | null;
  selectedSatellite: number | null;
  selectedConjunction: string | null;
  filterTier: string | null;
  earthTexture: 'day' | 'night' | 'fallback';
  backgroundStyle: 'stars' | 'deep' | 'empty';
  timeScale: number;
  autoRotate: boolean;
  isAboutOpen: boolean;
  loadAllData: () => Promise<void>;
  setSelectedSatellite: (id: number | null) => void;
  setSelectedConjunction: (id: string | null) => void;
  setFilterTier: (tier: string | null) => void;
  setEarthTexture: (texture: 'day' | 'night' | 'fallback') => void;
  setBackgroundStyle: (style: 'stars' | 'deep' | 'empty') => void;
  setTimeScale: (scale: number) => void;
  setAutoRotate: (value: boolean) => void;
  setIsAboutOpen: (value: boolean) => void;
}

export const useStore = create<OrbitaStore>((set) => ({
  tles: [],
  fleet: [],
  conjunctions: [],
  catalogStats: null,
  isLoading: true,
  error: null,
  selectedSatellite: null,
  selectedConjunction: null,
  filterTier: null,
  earthTexture: 'day', // default to day
  backgroundStyle: 'stars',
  timeScale: 1, // default to 1x (Real-Time)
  autoRotate: true, // default to auto-rotating camera
  isAboutOpen: false,
  
  loadAllData: async () => {
    set((state) => ({ isLoading: state.tles.length === 0, error: null }));
    try {
      const [tles, fleet, conjunctions, catalogStats] = await Promise.all([
        api.tle(),
        api.fleet(),
        api.conjunctions(),
        api.catalogStats(),
      ]);
      set({ tles, fleet, conjunctions, catalogStats, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  setSelectedSatellite: (id) => set({ selectedSatellite: id }),
  setSelectedConjunction: (id) => set({ selectedConjunction: id }),
  setFilterTier: (tier) => set({ filterTier: tier }),
  setEarthTexture: (texture) => set({ earthTexture: texture }),
  setBackgroundStyle: (style) => set({ backgroundStyle: style }),
  setTimeScale: (scale) => set({ timeScale: scale }),
  setAutoRotate: (value) => set({ autoRotate: value }),
  setIsAboutOpen: (value) => set({ isAboutOpen: value }),
}));
