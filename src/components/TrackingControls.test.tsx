import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TrackingControls } from './TrackingControls';

const baseProps = {
  pointsCollected: 0,
  queued: 0,
  wakeLockActive: false,
  supported: { geolocation: true, wakeLock: true },
  error: null,
  onStart: vi.fn(),
  onEnd: vi.fn(),
};

describe('TrackingControls', () => {
  it('shows Start search when idle', () => {
    render(<TrackingControls {...baseProps} status="idle" />);
    expect(screen.getByRole('button', { name: /start search/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /end search/i })).not.toBeInTheDocument();
  });

  it('shows End search and live counters when active', () => {
    render(<TrackingControls {...baseProps} status="active" pointsCollected={5} queued={2} wakeLockActive />);
    expect(screen.getByRole('button', { name: /end search/i })).toBeInTheDocument();
    expect(screen.getByText(/points collected: 5/i)).toBeInTheDocument();
    expect(screen.getByText(/queued \(offline\): 2/i)).toBeInTheDocument();
    expect(screen.getByText(/screen wake lock: active/i)).toBeInTheDocument();
  });

  it('shows the paused message when paused', () => {
    render(<TrackingControls {...baseProps} status="paused" />);
    expect(screen.getByText(/tracking paused/i)).toBeInTheDocument();
  });

  it('calls onStart with the selected mode and radius', () => {
    const onStart = vi.fn();
    render(<TrackingControls {...baseProps} status="idle" onStart={onStart} />);
    fireEvent.click(screen.getByRole('radio', { name: /watchtower/i }));
    fireEvent.click(screen.getByRole('button', { name: /start search/i }));
    expect(onStart).toHaveBeenCalledWith('watchtower', 100);
  });

  it('calls onEnd when End search is clicked', () => {
    const onEnd = vi.fn();
    render(<TrackingControls {...baseProps} status="active" onEnd={onEnd} />);
    fireEvent.click(screen.getByRole('button', { name: /end search/i }));
    expect(onEnd).toHaveBeenCalled();
  });

  it('surfaces an error message', () => {
    render(<TrackingControls {...baseProps} status="active" error="GPS permission denied" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/gps permission denied/i);
  });
});
