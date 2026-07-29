import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GitMerge, Eye, EyeOff, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import { apiErrorMessage } from '../utils/errors';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères'); return; }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(apiErrorMessage(err, 'Lien de réinitialisation invalide ou expiré'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0d0d1a 0%, #1a1a2e 40%, #16213e 70%, #0f3460 100%)' }}>
      <div style={{ width: 420, padding: '40px 36px', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#e94560,#0f3460)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GitMerge size={20} color="white" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>LedgerSync</span>
        </div>

        {!token ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <AlertCircle size={40} color="#fca5a5" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 8 }}>Lien invalide</h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Ce lien de réinitialisation est incomplet. Faites une nouvelle demande.</p>
            <Link to="/forgot-password" style={{ display: 'inline-block', marginTop: 16, fontSize: 13, color: '#e94560', textDecoration: 'none', fontWeight: 600 }}>Demander un nouveau lien</Link>
          </div>
        ) : done ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <CheckCircle2 size={40} color="var(--success, #10b981)" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 8 }}>Mot de passe réinitialisé</h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Vous allez être redirigé vers la page de connexion...</p>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 6 }}>Nouveau mot de passe</h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>Choisissez un nouveau mot de passe pour votre compte.</p>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 18, fontSize: 13, color: '#fca5a5' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>Nouveau mot de passe</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
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
                style={{ padding: '13px', background: 'linear-gradient(135deg,#e94560,#c73652)', border: 'none', borderRadius: 10, color: 'white', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {loading ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Réinitialisation...</> : 'Réinitialiser le mot de passe'}
              </button>
            </form>
          </>
        )}

        {!done && (
          <Link to="/login" style={{ display: 'block', textAlign: 'center', marginTop: 24, fontSize: 13, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
            Retour à la connexion
          </Link>
        )}
      </div>
    </div>
  );
}
