import { createContext, useContext } from 'react';
import type { Profile } from './types';

export interface CurrentUserState {
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
}

export const CurrentUserContext = createContext<CurrentUserState | null>(null);

/** Access the signed-in profile and a setter for it. Must be used within a CurrentUserContext.Provider. */
export function useCurrentUser(): CurrentUserState {
  const state = useContext(CurrentUserContext);
  if (!state) {
    throw new Error('useCurrentUser() must be used within a CurrentUserContext.Provider');
  }
  return state;
}
