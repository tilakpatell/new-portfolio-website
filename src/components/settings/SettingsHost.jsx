import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import ErrorBoundary from '../ErrorBoundary';
import { applyMotion, read } from './settings.js';

// Always in the shell: puts the kept motion setting on the page, and opens
// the settings panel when something asks ('tp:settings', lib/palette's
// openSettings). The panel itself loads the first time it's opened.
const Settings = lazy(() => import('./Settings.jsx'));

function Shut({ onClose }) {
  useEffect(() => onClose(), [onClose]);
  return null;
}

export default function SettingsHost() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    applyMotion(read().motion);
    const onOpen = () => setOpen(true);
    window.addEventListener('tp:settings', onOpen);
    return () => window.removeEventListener('tp:settings', onOpen);
  }, []);
  if (!open) return null;
  return (
    <ErrorBoundary fallback={<Shut onClose={close} />}>
      <Suspense fallback={null}>
        <Settings onClose={close} />
      </Suspense>
    </ErrorBoundary>
  );
}
