import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GitMerge, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../api/axios';
import { apiErrorMessage } from '../utils/errors';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Erreur lors de la demande'));
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

        {sent ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <CheckCircle2 size={40} color="var(--success, #10b981)" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 8 }}>Email envoyé</h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
              Si un compte existe avec l'adresse <strong style={{ color: 'white' }}>{email}</strong>, un lien de réinitialisation vient de lui être envoyé. Vérifiez votre boîte de réception.
            </p>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 6 }}>Mot de passe oublié</h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>Entrez votre email, nous vous enverrons un lien de réinitialisation.</p>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 18, fontSize: 13, color: '#fca5a5' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="votre@email.com"
                  style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'white', fontSize: 14, outline: 'none' }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{ padding: '13px', background: 'linear-gradient(135deg,#e94560,#c73652)', border: 'none', borderRadius: 10, color: 'white', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {loading ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Envoi...</> : 'Envoyer le lien'}
              </button>
            </form>
          </>
        )}

        <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 24, fontSize: 13, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
