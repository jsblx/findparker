import { createContext, useContext } from 'react';
import type { DataProvider } from './DataProvider';
import { InMemoryProvider } from './InMemoryProvider';
import { SupabaseProvider } from './SupabaseProvider';

export type { DataProvider } from './DataProvider';
export { InMemoryProvider } from './InMemoryProvider';
export { SupabaseProvider } from './SupabaseProvider';

/**
 * Factory for the app's DataProvider. Returns a SupabaseProvider when Supabase env vars
 * are configured, otherwise falls back to the in-memory provider so the app always runs
 * locally without a backend. Never throws at import time.
 */
export function createDataProvider(): DataProvider {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (url) {
    return new SupabaseProvider(url, anonKey ?? '');
  }
  return new InMemoryProvider();
}

export const DataProviderContext = createContext<DataProvider | null>(null);

/** Access the app-wide DataProvider. Must be used within a DataProviderContext.Provider. */
export function useData(): DataProvider {
  const provider = useContext(DataProviderContext);
  if (!provider) {
    throw new Error('useData() must be used within a DataProviderContext.Provider');
  }
  return provider;
}
