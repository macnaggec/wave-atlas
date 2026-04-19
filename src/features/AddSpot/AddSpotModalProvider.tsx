import {
  createContext,
  useContext,
  useMemo,
} from 'react';
import { useMapStore } from 'widgets/GlobeMap/model/mapStore';

interface AddSpotContextValue {
  /** Enter pin-placement mode, optionally pre-filling the spot name. */
  startAddSpot: (initialName?: string) => void;
}

const AddSpotContext = createContext<AddSpotContextValue | null>(null);

export function AddSpotProvider({ children }: { children: React.ReactNode }) {
  const enterPinPlacement = useMapStore((s) => s.enterPinPlacement);

  const value = useMemo(
    () => ({ startAddSpot: (name = '') => enterPinPlacement(name) }),
    [enterPinPlacement],
  );

  return (
    <AddSpotContext.Provider value={value}>
      {children}
    </AddSpotContext.Provider>
  );
}

export function useAddSpot(): AddSpotContextValue {
  const ctx = useContext(AddSpotContext);
  if (!ctx) throw new Error('useAddSpot must be used within AddSpotProvider');
  return ctx;
}

