import { useEffect, useState } from 'react';
import { watchVRSupport } from './vr-support.js';
import './vr-control.css';

export function VRControl({ available, disabled, active, onEnter, onExit }) {
  const [supported, setSupported] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState('');
  useEffect(() => watchVRSupport(setSupported), []);
  if (!available || (!supported && !active)) return null;
  const toggle = async () => {
    if (pending) return;
    setPending(true); setError('');
    try { await (active ? onExit() : onEnter()); }
    catch { setError('VR could not start. Check your headset connection and VR software, then try again. Normal controls are ready.'); }
    finally { setPending(false); }
  };
  return <div className="vr-control">
    <button disabled={disabled || pending} onClick={toggle}>{pending ? 'Connecting…' : active ? 'Exit VR' : 'Enter VR'}</button>
    {error && <p role="alert">{error}</p>}
    {!active && <small>Headset view · no controllers needed</small>}
  </div>;
}
