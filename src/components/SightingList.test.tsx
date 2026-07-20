import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SightingList } from './SightingList';
import type { Sighting } from '../types';

function makeSighting(overrides: Partial<Sighting> = {}): Sighting {
  return {
    id: 's1',
    incidentId: 'incident-1',
    reportedBy: 'user-1',
    lat: 1,
    lng: 2,
    observedAt: Date.now(),
    type: 'visual',
    confidence: 0.6,
    status: 'unverified',
    verifiedBy: null,
    verifiedVia: null,
    corroboratesId: null,
    notes: '',
    photoUrl: null,
    ...overrides,
  };
}

describe('SightingList', () => {
  it('shows a message when there are no sightings', () => {
    render(
      <SightingList
        sightings={[]}
        promotedSightings={[]}
        ipp={{ lat: 0, lng: 0 }}
        role="coordinator"
        onVerify={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText(/no sightings reported yet/i)).toBeInTheDocument();
  });

  it('lets a coordinator verify/reject an unverified sighting', () => {
    const sighting = makeSighting();
    const onVerify = vi.fn();
    const onReject = vi.fn();
    render(
      <SightingList
        sightings={[sighting]}
        promotedSightings={[sighting]}
        ipp={{ lat: 0, lng: 0 }}
        role="coordinator"
        onVerify={onVerify}
        onReject={onReject}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));
    expect(onVerify).toHaveBeenCalledWith('s1');

    fireEvent.click(screen.getByRole('button', { name: /reject/i }));
    expect(onReject).toHaveBeenCalledWith('s1');
  });

  it('hides verify/reject for non-coordinators and shows a coordinator-only note', () => {
    const sighting = makeSighting();
    render(
      <SightingList
        sightings={[sighting]}
        promotedSightings={[sighting]}
        ipp={{ lat: 0, lng: 0 }}
        role="searcher"
        onVerify={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /verify/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
    expect(screen.getByText(/coordinator only/i)).toBeInTheDocument();
  });

  it('shows a corroboration-promoted sighting as verified, with no verify/reject buttons', () => {
    const raw = makeSighting({ status: 'unverified', verifiedVia: null });
    const promoted = makeSighting({ status: 'verified', verifiedVia: 'corroboration' });
    render(
      <SightingList
        sightings={[raw]}
        promotedSightings={[promoted]}
        ipp={{ lat: 0, lng: 0 }}
        role="coordinator"
        onVerify={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getByText('verified')).toBeInTheDocument();
    expect(screen.getByText(/via corroboration/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /verify/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
  });
});
