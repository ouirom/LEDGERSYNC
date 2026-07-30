import { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const TIMEOUT_MS = 5 * 60 * 1000; // déconnexion après 5 min d'inactivité totale
const WARNING_MS = 60 * 1000; // avertissement affiché 1 min avant l'expiration
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;

// Déconnecte automatiquement l'utilisateur après une période d'inactivité,
// avec un avertissement à décompte 60 secondes avant l'expiration effective —
// toute interaction (y compris pendant le décompte) réinitialise le minuteur.
// Monté uniquement dans AppLayout, donc actif seulement en session authentifiée.
export default function SessionTimeoutGuard() {
  const { logout } = useAuth();
  const [remaining, setRemaining] = useState<number | null>(null);
  const lastActivity = useRef(Date.now());

  const resetActivity = useCallback(() => {
    lastActivity.current = Date.now();
    setRemaining(null);
  }, []);

  useEffect(() => {
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, resetActivity, { passive: true }));

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivity.current;
      if (elapsed >= TIMEOUT_MS) {
        logout();
      } else if (elapsed >= TIMEOUT_MS - WARNING_MS) {
        setRemaining(Math.max(0, Math.ceil((TIMEOUT_MS - elapsed) / 1000)));
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, resetActivity));
      clearInterval(interval);
    };
  }, [resetActivity, logout]);

  if (remaining === null) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="modal" style={{ maxWidth: 420, textAlign: 'center', padding: 28 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--warning)18', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <ShieldAlert size={28} color="var(--warning)" />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>Session sur le point d'expirer</h3>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--text-muted)' }}>
          Par sécurité, vous allez être déconnecté par inactivité dans <strong style={{ color: 'var(--text)' }}>{remaining}s</strong>.
        </p>
        <div className="progress-bar" style={{ marginBottom: 20 }}>
          <div className="progress-fill" style={{ width: `${(remaining / (WARNING_MS / 1000)) * 100}%`, background: 'var(--warning)', transition: 'width 1s linear' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-ghost" onClick={logout}>Se déconnecter</button>
          <button className="btn btn-primary" onClick={resetActivity}>Rester connecté</button>
        </div>
      </div>
    </div>
  );
}
