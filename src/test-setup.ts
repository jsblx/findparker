import '@testing-library/jest-dom';

// jsdom doesn't implement createObjectURL/revokeObjectURL, but maplibre-gl calls
// `URL.createObjectURL` at module load time (to spin up its worker) - so merely importing
// anything that pulls in the map module chain (e.g. App.tsx's route table) needs this stub,
// even in tests that never actually render a MapCanvas.
if (typeof window !== 'undefined') {
  if (typeof window.URL.createObjectURL !== 'function') {
    window.URL.createObjectURL = () => '';
  }
  if (typeof window.URL.revokeObjectURL !== 'function') {
    window.URL.revokeObjectURL = () => {};
  }
}
