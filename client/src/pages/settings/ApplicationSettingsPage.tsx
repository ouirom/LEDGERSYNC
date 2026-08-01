import { useEffect, useState } from 'react';
import { Settings2, Mail, Save, Loader2, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import api from '../../api/axios';
import { apiErrorMessage } from '../../utils/errors';

const MASK = '••••••••';

interface EmailForm {
  smtp_host: string;
  smtp_port: string;
  smtp_secure: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
}

const EMPTY_EMAIL_FORM: EmailForm = { smtp_host: '', smtp_port: '587', smtp_secure: 'false', smtp_user: '', smtp_pass: '', smtp_from: '' };

// Catégories de paramètres — structure pensée pour en accueillir d'autres à
// l'avenir (ex. Sécurité, Général) sans réorganiser la page.
const CATEGORIES = [
  { key: 'EMAIL', label: 'Email (SMTP)', icon: Mail },
];

export default function ApplicationSettingsPage() {
  const [active, setActive] = useState('EMAIL');
  const [form, setForm] = useState<EmailForm>(EMPTY_EMAIL_FORM);
  const [passConfigured, setPassConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/parametres/EMAIL').then(r => {
      const d = r.data.data || {};
      setForm({
        smtp_host: d.smtp_host || '',
        smtp_port: d.smtp_port || '587',
        smtp_secure: d.smtp_secure || 'false',
        smtp_user: d.smtp_user || '',
        smtp_pass: '',
        smtp_from: d.smtp_from || '',
      });
      setPassConfigured(!!d.smtp_pass);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const valeurs: Record<string, string> = { ...form };
      // Ne pas écraser le mot de passe déjà enregistré si le champ est resté vide.
      if (!form.smtp_pass) delete valeurs['smtp_pass'];
      await api.put('/parametres/EMAIL', { valeurs });
      setMsg({ type: 'success', text: 'Paramètres enregistrés avec succès.' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: apiErrorMessage(err, 'Erreur lors de l\'enregistrement') });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setMsg(null);
    try {
      const { data } = await api.post('/parametres/email/test');
      setMsg({ type: 'success', text: data.message || 'Email de test envoyé.' });
    } catch (err) {
      setMsg({ type: 'error', text: apiErrorMessage(err, 'Échec de l\'envoi de l\'email de test') });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings2 size={22} color="var(--primary)" /> Paramètres d'Infrastructure
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Réglages d'infrastructure globaux, modifiables sans intervenir dans le code.
          </p>
        </div>
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, background: msg.type === 'success' ? '#d1fae5' : '#fee2e2', color: msg.type === 'success' ? '#065f46' : '#991b1b', border: `1px solid ${msg.type === 'success' ? '#6ee7b7' : '#fca5a5'}` }}>
          {msg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {msg.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
        {/* Catégories */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => setActive(c.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, textAlign: 'left',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: active === c.key ? 700 : 500,
                background: active === c.key ? 'var(--primary)18' : 'transparent',
                color: active === c.key ? 'var(--primary)' : 'var(--text-muted)',
              }}
            >
              <c.icon size={15} /> {c.label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <div className="card" style={{ padding: 24 }}>
          {active === 'EMAIL' && (
            loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 38 }} />)}
              </div>
            ) : (
              <>
                <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>Configuration SMTP</h3>
                <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--text-muted)' }}>
                  Utilisée pour les emails de notification (création de compte, réinitialisation de mot de passe...). Laissez le champ vide pour désactiver l'envoi réel — les emails sont alors journalisés côté serveur.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Hôte SMTP</label>
                    <input className="input" value={form.smtp_host} onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))} placeholder="smtp.example.com" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Port</label>
                    <input className="input" value={form.smtp_port} onChange={e => setForm(f => ({ ...f, smtp_port: e.target.value }))} placeholder="587" style={{ width: '100%' }} />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.smtp_secure === 'true'} onChange={e => setForm(f => ({ ...f, smtp_secure: e.target.checked ? 'true' : 'false' }))} />
                    Connexion sécurisée (TLS/SSL — généralement activé pour le port 465)
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Utilisateur SMTP</label>
                    <input className="input" value={form.smtp_user} onChange={e => setForm(f => ({ ...f, smtp_user: e.target.value }))} placeholder="no-reply@example.com" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Mot de passe SMTP</label>
                    <input className="input" type="password" value={form.smtp_pass} onChange={e => setForm(f => ({ ...f, smtp_pass: e.target.value }))} placeholder={passConfigured ? MASK : 'Non configuré'} style={{ width: '100%' }} />
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Adresse d'expédition</label>
                  <input className="input" value={form.smtp_from} onChange={e => setForm(f => ({ ...f, smtp_from: e.target.value }))} placeholder='"LedgerSync" <no-reply@example.com>' style={{ width: '100%' }} />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" onClick={save} disabled={saving}>
                    {saving ? <><Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Enregistrement...</> : <><Save size={15} /> Enregistrer</>}
                  </button>
                  <button className="btn btn-ghost" onClick={sendTest} disabled={testing}>
                    {testing ? <><Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Envoi...</> : <><Send size={15} /> Envoyer un email de test</>}
                  </button>
                </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
