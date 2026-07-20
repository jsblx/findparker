/** Requires a signed-in user before rendering its children; otherwise shows the sign-in screen (or a brief loading state while a persisted identity is being re-established). */
import type { ReactNode } from 'react';
import { useCurrentUser } from '../CurrentUserContext';
import { SignInScreen } from './SignInScreen';

export function AuthGate({ children }: { children: ReactNode }) {
  const { profile, hydrating } = useCurrentUser();

  if (hydrating) {
    return (
      <div className="page">
        <p className="muted">Loading...</p>
      </div>
    );
  }

  if (!profile) {
    return <SignInScreen />;
  }

  return <>{children}</>;
}
