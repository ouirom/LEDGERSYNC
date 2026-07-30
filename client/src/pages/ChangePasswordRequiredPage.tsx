import { useState } from 'react';
import { GitMerge, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';
import { apiErrorMessage } from '../utils/errors';

// Bloque l'accès à l'application tant que l'utilisateur n'a pas changé son mot
// de passe initial (compte fraîchement créé, ou réinitialisé par un admin).
export default function ChangePasswordRequiredPage() {
  const { user, markPasswordChanged, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { setError('Le nouveau mot de passe doit contenir au moins 6 caractères'); return; }
    if (newPassword !== confirm) { setError('Les mots de passe ne correspondent pas'); return; }
    if (newPassword === currentPassword) { setError('Le nouveau mot de passe doit être différent de l\'actuel'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      markPasswordChanged();
    } catch (err) {
      setError(apiErrorMessage(err, 'Erreur lors du changement de mot de passe'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0d0d1a 0%, #1a1a2e 40%, #16213e 70%, #0f3460 100%)' }}>
      <div style={{ width: 440, padding: '40px 36px', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#e94560,#0f3460)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GitMerge size={20} color="white" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>LedgerSync</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, marginBottom: 20, fontSize: 12, color: '#fbbf24' }}>
          <ShieldAlert size={16} style={{ flexShrink: 0 }} />
          Changement de mot de passe requis avant de continuer
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 6 }}>Bienvenue{user ? `, ${user.prenom}` : ''}</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>
          Pour des raisons de sécurité, vous devez choisir un nouveau mot de passe avant d'accéder à votre espace de travail.
        </p>

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 18, fontSize: 13, color: '#fca5a5' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>Mot de passe actuel</label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'white', fontSize: 14, outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>Nouveau mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                placeholder="6 caractères minimum"
                style={{ width: '100%', padding: '11px 40px 11px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'white', fontSize: 14, outline: 'none' }}
              />
              <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 0 }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>Confirmation</label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'white', fontSize: 14, outline: 'none' }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ padding: '13px', background: 'linear-gradient(135deg,#e94560,#c73652)', border: 'none', borderRadius: 10, color: 'white', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}
          >
            {loading ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Modification...</> : 'Changer le mot de passe'}
          </button>
        </form>

        <button onClick={logout} style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 20, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
