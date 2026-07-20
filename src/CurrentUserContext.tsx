import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useData } from './data';
import type { Profile, Role } from './types';

export interface CurrentUserState {
  profile: Profile | null;
  /** True only while re-establishing a persisted identity from localStorage on first load. */
  hydrating: boolean;
  setProfile: (profile: Profile | null) => void;
  /** POC-simple sign-in: creates/adopts an anonymous profile and persists the identity. */
  signIn: (displayName: string, role: Role) => Promise<Profile>;
  /** Switches the current user's role (e.g. searcher <-> coordinator) and persists it. */
  setRole: (role: Role) => Promise<Profile>;
  signOut: () => void;
}

export const CurrentUserContext = createContext<CurrentUserState | null>(null);

/** Access the signed-in profile and auth actions. Must be used within a CurrentUserContext.Provider. */
export function useCurrentUser(): CurrentUserState {
  const state = useContext(CurrentUserContext);
  if (!state) {
    throw new Error('useCurrentUser() must be used within a CurrentUserContext.Provider');
  }
  return state;
}

const STORAGE_KEY = 'findparker.identity';

interface StoredIdentity {
  displayName: string;
  role: Role;
}

function isRole(value: unknown): value is Role {
  return value === 'searcher' || value === 'coordinator';
}

function loadStoredIdentity(): StoredIdentity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { displayName?: unknown }).displayName === 'string' &&
      isRole((parsed as { role?: unknown }).role)
    ) {
      return parsed as StoredIdentity;
    }
    return null;
  } catch {
    return null;
  }
}

function storeIdentity(identity: StoredIdentity | null): void {
  try {
    if (identity) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable (private browsing, etc.) - identity just won't persist.
  }
}

/**
 * Provides the signed-in profile app-wide, backed by the DataProvider's POC-simple anonymous
 * auth. Persists the chosen display name + role to localStorage so a reload re-signs the same
 * identity in rather than dropping back to the sign-in screen.
 */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const provider = useData();
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [hydrating, setHydrating] = useState(() => loadStoredIdentity() !== null);

  useEffect(() => {
    const stored = loadStoredIdentity();
    if (!stored) return;
    let cancelled = false;
    provider
      .signInAnonymously(stored.displayName, stored.role)
      .then((signedIn) => {
        if (!cancelled) setProfileState(signedIn);
      })
      .catch(() => {
        // Re-sign-in failed (e.g. backend unreachable): fall back to the sign-in screen
        // rather than hanging on a blank hydrating state.
      })
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const setProfile = useCallback((next: Profile | null) => {
    setProfileState(next);
    storeIdentity(next ? { displayName: next.displayName, role: next.role } : null);
  }, []);

  const signIn = useCallback(
    async (displayName: string, role: Role) => {
      const signedIn = await provider.signInAnonymously(displayName, role);
      setProfile(signedIn);
      return signedIn;
    },
    [provider, setProfile],
  );

  const setRole = useCallback(
    async (role: Role) => {
      const updated = await provider.setRole(role);
      setProfile(updated);
      return updated;
    },
    [provider, setProfile],
  );

  const signOut = useCallback(() => {
    setProfile(null);
  }, [setProfile]);

  return (
    <CurrentUserContext.Provider value={{ profile, hydrating, setProfile, signIn, setRole, signOut }}>
      {children}
    </CurrentUserContext.Provider>
  );
}
