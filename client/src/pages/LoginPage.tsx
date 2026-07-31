import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GitMerge, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { apiErrorMessage } from '../utils/errors';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard/operational');
    } catch (err) {
      setError(apiErrorMessage(err, 'Identifiants invalides'));
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role: string) => {
    const accounts: Record<string, [string, string]> = {
      admin: ['admin@ledgersync.demo', 'Admin@2026!'],
      daf: ['daf@ledgersync.demo', 'Daf@2026!'],
      user: ['comptable@ledgersync.demo', 'User@2026!'],
      superviseur: ['superviseur@ledgersync.demo', 'Superviseur@2026!'],
      manager: ['manager@ledgersync.demo', 'Manager@2026!'],
      user_ci: ['comptable.ci@ledgersync.demo', 'User@2026!'],
      manager_ci: ['manager.ci@ledgersync.demo', 'Manager@2026!'],
    };
    const [e, p] = accounts[role];
    setEmail(e); setPassword(p);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'linear-gradient(135deg, #0d0d1a 0%, #1a1a2e 40%, #16213e 70%, #0f3460 100%)' }}>
      {/* Left panel — branding */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 80px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(233,69,96,0.12) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(15,52,96,0.4) 0%, transparent 50%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}>
            <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg,#e94560,#0f3460)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GitMerge size={28} color="white" />
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'white', letterSpacing: 1 }}>LedgerSync</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, textTransform: 'uppercase' }}>ERP Financier</div>
            </div>
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 800, color: 'white', lineHeight: 1.2, marginBottom: 20 }}>
            Rapprochement Bancaire<br />
            <span style={{ background: 'linear-gradient(90deg,#e94560,#ff8fa3)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Multi-Tenant
            </span>
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, maxWidth: 440 }}>
            Gérez vos rapprochements bancaires avec un workflow de validation dual-control, 
            une piste d'audit inviolable et un traitement asynchrone haute performance.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', gap: 10, marginTop: 40, flexWrap: 'wrap' }}>
            {['SOX Compliant', 'ISO 27001', 'Multi-Tenant', 'Temps Réel'].map(tag => (
              <span key={tag} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Decorative circles */}
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(233,69,96,0.06)', border: '1px solid rgba(233,69,96,0.1)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(233,69,96,0.08)', border: '1px solid rgba(233,69,96,0.15)' }} />
      </div>

      {/* Right panel — login form */}
      <div style={{ width: 480, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 48px', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: 'white', marginBottom: 6 }}>Connexion</h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 32 }}>Accédez à votre espace de travail sécurisé</p>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 20, fontSize: 13, color: '#fca5a5' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="votre@email.com"
              style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'white', fontSize: 14, outline: 'none', transition: 'border-color 0.15s' }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>Mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{ width: '100%', padding: '11px 40px 11px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'white', fontSize: 14, outline: 'none', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
              <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 0 }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <Link to="/forgot-password" style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Mot de passe oublié ?</Link>
            </div>
          </div>

          <button
            id="btn-login"
            type="submit"
            disabled={loading}
            style={{ padding: '13px', background: 'linear-gradient(135deg,#e94560,#c73652)', border: 'none', borderRadius: 10, color: 'white', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s', marginTop: 8 }}
          >
            {loading ? <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Connexion...</> : 'Se connecter'}
          </button>
        </form>

        {/* Demo accounts, groupés par entreprise */}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 12, textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase' }}>Comptes de démonstration</p>
          {[
            {
              entreprise: 'SARL Démo Finances (Sénégal)',
              accounts: [
                { key: 'admin', label: 'Super Admin', color: '#e94560' },
                { key: 'daf', label: 'DAF', color: '#3b82f6' },
                { key: 'user', label: 'Comptable', color: '#10b981' },
                { key: 'superviseur', label: 'Superviseur', color: '#f59e0b' },
                { key: 'manager', label: 'Manager', color: '#8b5cf6' },
              ],
            },
            {
              entreprise: 'SARL Abidjan Négoce (Côte d\'Ivoire)',
              accounts: [
                { key: 'user_ci', label: 'Comptable', color: '#10b981' },
                { key: 'manager_ci', label: 'Manager', color: '#8b5cf6' },
              ],
            },
          ].map(group => (
            <div key={group.entreprise} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{group.entreprise}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {group.accounts.map(({ key, label, color }) => (
                  <button key={key} onClick={() => fillDemo(key)} style={{ flex: '1 1 30%', padding: '8px 4px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}33`, borderRadius: 8, color, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
