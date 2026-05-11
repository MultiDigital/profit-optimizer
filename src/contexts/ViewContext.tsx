'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  AS_OF_DATE_MIN,
  AS_OF_DATE_MAX,
  clampAsOfDate,
  parseStoredView,
} from '@/lib/view/storage';

const STORAGE_KEY = 'profit-optimizer.view.v2';

export { AS_OF_DATE_MIN, AS_OF_DATE_MAX };

export type ScenarioId = 'baseline' | string; // 'baseline' or a scenario UUID

interface ViewContextValue {
  asOfDate: string; // ISO YYYY-MM-DD
  scenarioId: ScenarioId;
  // Optional secondary date for side-by-side comparison views (e.g. cost
  // centers). In-memory only — not persisted across reloads, since it's a
  // transient comparison action rather than a sticky preference.
  compareDate: string | null;
  setAsOfDate: (date: string) => void;
  setScenarioId: (id: ScenarioId) => void;
  setCompareDate: (date: string | null) => void;
}

const ViewContext = createContext<ViewContextValue | null>(null);

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ViewProvider({ children }: { children: ReactNode }) {
  const [asOfDate, setAsOfDateState] = useState<string>(todayISO());
  const [scenarioId, setScenarioIdState] = useState<ScenarioId>('baseline');
  const [compareDate, setCompareDateState] = useState<string | null>(null);

  // Hydrate from localStorage on mount (client only; SSR renders defaults).
  // The set-state-in-effect rule flags this pattern as suboptimal, but it's
  // the only SSR-safe way to read localStorage: during server render, window
  // doesn't exist; during client render 1, we must match the server output
  // (todayISO() / 'baseline') to avoid a hydration mismatch; then we sync here.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = parseStoredView(window.localStorage.getItem(STORAGE_KEY));
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAsOfDateState(clampAsOfDate(stored.asOfDate, AS_OF_DATE_MIN, AS_OF_DATE_MAX));
      setScenarioIdState(stored.scenarioId);
    }
  }, []);

  // Persist on change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ asOfDate, scenarioId }),
    );
  }, [asOfDate, scenarioId]);

  const setAsOfDate = useCallback((d: string) => {
    setAsOfDateState(clampAsOfDate(d, AS_OF_DATE_MIN, AS_OF_DATE_MAX));
  }, []);

  const setScenarioId = useCallback((id: ScenarioId) => {
    setScenarioIdState(id);
  }, []);

  const setCompareDate = useCallback((d: string | null) => {
    if (d === null) {
      setCompareDateState(null);
      return;
    }
    setCompareDateState(clampAsOfDate(d, AS_OF_DATE_MIN, AS_OF_DATE_MAX));
  }, []);

  return (
    <ViewContext.Provider
      value={{ asOfDate, scenarioId, compareDate, setAsOfDate, setScenarioId, setCompareDate }}
    >
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
