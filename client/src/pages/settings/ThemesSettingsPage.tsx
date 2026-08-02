import { useEffect, useRef, useState } from 'react';
import { Palette, Sun, Moon, Eye, Sliders, Save, Check, Image, Upload, Trash2, Loader2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useDialog } from '../../contexts/DialogContext';
import api from '../../api/axios';
import { apiErrorMessage } from '../../utils/errors';
import { resolveUploadUrl } from '../../utils/uploads';
import type { Entreprise, Theme as ThemeRow } from '../../types/api';

export default function ThemesSettingsPage() {
  const { isDark, toggleDark, setDark, colors, setColors } = useTheme();
  const { user, refreshUser } = useAuth();
  const dialog = useDialog();
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [selectedEnt, setSelectedEnt] = useState('');
  const [themes, setThemes] = useState<ThemeRow[]>([]);
  const [primary, setPrimary] = useState(colors.primary);
  const [accent, setAccent] = useState(colors.accent);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const currentEntreprise = entreprises.find(e => String(e.id) === selectedEnt);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/entreprises').catch(() => ({ data: { data: [] } })),
      api.get('/themes').catch(() => ({ data: { data: [] } })),
    ]).then(([e, t]) => {
      setEntreprises(e.data.data || []);
      setThemes(t.data.data || []);
      if (e.data.data?.[0]) setSelectedEnt(String(e.data.data[0].id));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (currentEntreprise?.theme) {
      setPrimary(currentEntreprise.theme.couleur_primaire);
      setAccent(currentEntreprise.theme.couleur_accent);
    }
  }, [selectedEnt]); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (type: 'success' | 'error', text: string) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000); };

  const assignTheme = async (themeId: number, apply?: { primary: string; accent: string; dark: boolean }) => {
    if (!selectedEnt) return;
    setApplying(themeId);
    try {
      const { data } = await api.patch(`/entreprises/${selectedEnt}/theme`, { theme_id: themeId });
      setEntreprises(prev => prev.map(e => String(e.id) === selectedEnt ? { ...e, theme: data.data.theme } : e));
      if (apply) {
        setColors({ primary: apply.primary, accent: apply.accent });
        setDark(apply.dark);
      }
      flash('success', 'Thème appliqué et enregistré pour l\'entreprise');
    } catch (err) {
      flash('error', apiErrorMessage(err, 'Erreur lors de l\'application du thème'));
    } finally {
      setApplying(null);
    }
  };

  const applyPreset = (theme: ThemeRow) => {
    assignTheme(theme.id, { primary: theme.couleur_primaire, accent: theme.couleur_accent, dark: theme.mode_sombre });
  };

  const applyCustom = async () => {
    if (!selectedEnt) return;
    setSaving(true);
    try {
      const { data: created } = await api.post('/themes', {
        nom: `Personnalisé — ${currentEntreprise?.nom || 'Entreprise'}`,
        couleur_primaire: primary,
        couleur_secondaire: primary,
        couleur_accent: accent,
        mode_sombre: isDark,
      });
      setThemes(prev => [...prev, created.data]);
      await assignTheme(created.data.id, { primary, accent, dark: isDark });
    } catch (err) {
      flash('error', apiErrorMessage(err, 'Erreur lors de la création du thème personnalisé'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedEnt) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const { data } = await api.post(`/entreprises/${selectedEnt}/logo`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setEntreprises(prev => prev.map(ent => String(ent.id) === selectedEnt ? { ...ent, logo_url: data.data.logo_url } : ent));
      if (String(user?.entrepriseId) === selectedEnt) void refreshUser();
      flash('success', 'Logo mis à jour');
    } catch (err) {
      flash('error', apiErrorMessage(err, "Erreur lors de l'envoi du logo"));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!selectedEnt) return;
    const ok = await dialog.confirm('Supprimer le logo de cette entreprise ?', { title: 'Supprimer le logo', tone: 'danger', confirmLabel: 'Supprimer' });
    if (!ok) return;
    setUploadingLogo(true);
    try {
      await api.delete(`/entreprises/${selectedEnt}/logo`);
      setEntreprises(prev => prev.map(ent => String(ent.id) === selectedEnt ? { ...ent, logo_url: null } : ent));
      if (String(user?.entrepriseId) === selectedEnt) void refreshUser();
      flash('success', 'Logo supprimé');
    } catch (err) {
      flash('error', apiErrorMessage(err, 'Erreur lors de la suppression du logo'));
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Palette size={22} color="var(--primary)" /> Thèmes & Personnalisation
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
          Personnalisez les couleurs de LedgerSync pour votre organisation. Le thème choisi est enregistré et appliqué automatiquement à chaque connexion.
        </p>
      </div>

      {/* Entreprise selector */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Entreprise</label>
        <select className="select" style={{ width: '100%', maxWidth: 340 }} value={selectedEnt} onChange={e => setSelectedEnt(e.target.value)} disabled={loading}>
          {entreprises.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
        </select>
        {currentEntreprise?.theme && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
            Thème actuel : <strong style={{ color: 'var(--text)' }}>{currentEntreprise.theme.nom}</strong>
          </div>
        )}
      </div>

      {/* Logo entreprise */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image size={16} color="var(--primary)" /> Logo de l'entreprise
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {uploadingLogo ? (
              <Loader2 size={22} className="animate-spin" color="var(--text-muted)" />
            ) : currentEntreprise?.logo_url ? (
              <img src={resolveUploadUrl(currentEntreprise.logo_url)} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <Image size={24} color="var(--text-muted)" style={{ opacity: 0.4 }} />
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo || !selectedEnt} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Upload size={14} /> {currentEntreprise?.logo_url ? 'Remplacer' : 'Importer un logo'}
              </button>
              {currentEntreprise?.logo_url && (
                <button className="btn btn-danger" onClick={handleLogoRemove} disabled={uploadingLogo} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Trash2 size={14} /> Supprimer
                </button>
              )}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>JPG, PNG ou WebP, 3 Mo maximum.</span>
          </div>
          <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoChange} style={{ display: 'none' }} />
        </div>
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: msg.type === 'success' ? '#d1fae5' : '#fee2e2', color: msg.type === 'success' ? '#065f46' : '#991b1b', border: `1px solid ${msg.type === 'success' ? '#6ee7b7' : '#fca5a5'}` }}>
          {msg.text}
        </div>
      )}

      {/* Mode toggle */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Mode d'affichage</h3>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className={`btn ${!isDark ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => isDark && toggleDark()}
            style={{ flex: 1, justifyContent: 'center', gap: 8, padding: '14px 20px' }}
          >
            <Sun size={18} /> Mode Clair
          </button>
          <button
            className={`btn ${isDark ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => !isDark && toggleDark()}
            style={{ flex: 1, justifyContent: 'center', gap: 8, padding: '14px 20px' }}
          >
            <Moon size={18} /> Mode Sombre
          </button>
        </div>
      </div>

      {/* Preset themes */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Eye size={16} color="var(--primary)" /> Thèmes Prédéfinis
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {themes.map(theme => {
            const isActive = currentEntreprise?.theme?.id === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => applyPreset(theme)}
                disabled={applying === theme.id || !selectedEnt}
                style={{
                  padding: '14px 16px', borderRadius: 10, border: `2px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                  cursor: 'pointer', background: theme.mode_sombre ? '#111827' : '#f8fafc', textAlign: 'left', transition: 'all 0.2s', position: 'relative',
                }}
              >
                {isActive && <Check size={14} color="var(--primary)" style={{ position: 'absolute', top: 10, right: 10 }} />}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: theme.couleur_primaire }} />
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: theme.couleur_accent }} />
                  {theme.mode_sombre && <div style={{ fontSize: 10, color: '#94a3b8', alignSelf: 'center' }}>🌙</div>}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.mode_sombre ? '#e2e8f0' : '#1a1a2e' }}>{theme.nom}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom colors */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sliders size={16} color="var(--primary)" /> Couleurs Personnalisées
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Couleur Primaire
            </label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="color"
                value={primary}
                onChange={e => setPrimary(e.target.value)}
                style={{ width: 48, height: 40, borderRadius: 8, cursor: 'pointer', padding: 2, background: 'var(--bg)', border: '1px solid var(--border)' }}
              />
              <input
                className="input"
                value={primary}
                onChange={e => setPrimary(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Couleur Accent
            </label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="color"
                value={accent}
                onChange={e => setAccent(e.target.value)}
                style={{ width: 48, height: 40, borderRadius: 8, cursor: 'pointer', padding: 2, background: 'var(--bg)', border: '1px solid var(--border)' }}
              />
              <input
                className="input"
                value={accent}
                onChange={e => setAccent(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Aperçu</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={{ padding: '8px 16px', borderRadius: 8, background: primary, color: 'white', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'default' }}>Bouton principal</button>
            <button style={{ padding: '8px 16px', borderRadius: 8, background: accent, color: 'white', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'default' }}>Bouton accent</button>
            <span style={{ padding: '4px 12px', borderRadius: 20, background: `${primary}18`, color: primary, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>Badge primaire</span>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, alignSelf: 'center' }} />
          </div>
        </div>

        <button className="btn btn-primary" onClick={applyCustom} disabled={saving || !selectedEnt} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Save size={15} /> {saving ? 'Enregistrement...' : 'Enregistrer pour cette entreprise'}
        </button>
      </div>
    </div>
  );
}
