'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { clampYear, parseStoredView } from '@/lib/view/storage';

const STORAGE_KEY = 'profit-optimizer.view.v1';

/**
 * Year range shown in the picker: [current - 1, current + 4].
 * Pinned at import time — acceptable because the app reloads on day change.
 */
const NOW_YEAR = new Date().getFullYear();
export const YEAR_MIN = NOW_YEAR - 1;
export const YEAR_MAX = NOW_YEAR + 4;

export type ScenarioId = 'baseline' | string; // 'baseline' or a scenario UUID

interface ViewContextValue {
  year: number;
  scenarioId: ScenarioId;
  setYear: (year: number) => void;
  setScenarioId: (id: ScenarioId) => void;
}

const ViewContext = createContext<ViewContextValue | null>(null);

export function ViewProvider({ children }: { children: ReactNode }) {
  const [year, setYearState] = useState<number>(NOW_YEAR);
  const [scenarioId, setScenarioIdState] = useState<ScenarioId>('baseline');

  // Hydrate from localStorage on mount (client only; SSR renders defaults).
  // The set-state-in-effect rule flags this pattern as suboptimal, but it's
  // the only SSR-safe way to read localStorage: during server render, window
  // doesn't exist; during client render 1, we must match the server output
  // (NOW_YEAR / 'baseline') to avoid a hydration mismatch; then we sync here.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = parseStoredView(window.localStorage.getItem(STORAGE_KEY));
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setYearState(clampYear(stored.year, YEAR_MIN, YEAR_MAX));
      setScenarioIdState(stored.scenarioId);
    }
  }, []);

  // Persist on change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ year, scenarioId }),
    );
  }, [year, scenarioId]);

  const setYear = useCallback((y: number) => {
    setYearState(clampYear(y, YEAR_MIN, YEAR_MAX));
  }, []);

  const setScenarioId = useCallback((id: ScenarioId) => {
    setScenarioIdState(id);
  }, []);

  return (
    <ViewContext.Provider value={{ year, scenarioId, setYear, setScenarioId }}>
      {children}
    </ViewContext.Provider>
  );
}

export function useViewContext(): ViewContextValue {
  const ctx = useContext(ViewContext);
  if (!ctx) {
    throw new Error('useViewContext must be used inside <ViewProvider>');
  }
  return ctx;
}
