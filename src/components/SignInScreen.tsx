/** POC-simple sign-in: pick a display name and a role, no password. Shown by AuthGate whenever no user is signed in. */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useCurrentUser } from '../CurrentUserContext';
import type { Role } from '../types';

export function SignInScreen() {
  const { signIn } = useCurrentUser();
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Role>('searcher');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!displayName.trim()) return;
    setSubmitting(true);
    try {
      await signIn(displayName.trim(), role);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page sign-in-screen">
      <h1>FindParker</h1>
      <p className="muted">Coordinate volunteer search-and-rescue in the field.</p>
      <form className="stack" onSubmit={handleSubmit}>
        <label htmlFor="displayName">Your name</label>
        <input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Jamie"
          required
        />
        <label htmlFor="role">Your role</label>
        <select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="searcher">Searcher</option>
          <option value="coordinator">Coordinator</option>
        </select>
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
