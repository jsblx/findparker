/** Tracks document visibility (foreground/background), for pausing tracking when the app is hidden. */
import { useEffect, useState } from 'react';

/** Minimal shape of `document` this module needs, so tests can inject a fake without jsdom quirks. */
export interface VisibilityDoc {
  visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export function defaultVisibilityDoc(): VisibilityDoc | undefined {
  if (typeof document === 'undefined') return undefined;
  return document as unknown as VisibilityDoc;
}

export interface UseVisibilityOptions {
  doc?: VisibilityDoc;
}

/** Returns whether the document is currently visible, updating live on `visibilitychange`. */
export function useVisibility(opts: UseVisibilityOptions = {}): boolean {
  const doc = opts.doc ?? defaultVisibilityDoc();
  const [visible, setVisible] = useState(() => doc?.visibilityState !== 'hidden');

  useEffect(() => {
    if (!doc) return;
    const onChange = () => setVisible(doc.visibilityState !== 'hidden');
    onChange();
    doc.addEventListener('visibilitychange', onChange);
    return () => doc.removeEventListener('visibilitychange', onChange);
  }, [doc]);

  return visible;
}
