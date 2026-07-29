import { useState } from 'react';
import { Palette, Sun, Moon, Eye, Sliders, Save } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const PRESET_THEMES = [
  { name: 'LedgerSync Classic', primary: '#0f3460', accent: '#e94560', bg: '#f0f2f8', dark: false },
  { name: 'Midnight Finance', primary: '#1e40af', accent: '#7c3aed', bg: '#0f172a', dark: true },
  { name: 'Emerald Banking', primary: '#065f46', accent: '#10b981', bg: '#f0fdf4', dark: false },
  { name: 'Royal Gold', primary: '#78350f', accent: '#f59e0b', bg: '#fffbeb', dark: false },
  { name: 'Slate Pro', primary: '#1e293b', accent: '#38bdf8', bg: '#f8fafc', dark: false },
  { name: 'Carbon Dark', primary: '#374151', accent: '#6366f1', bg: '#111827', dark: true },
];

export default function ThemesSettingsPage() {
  const { isDark, toggleDark } = useTheme();
  const [primary, setPrimary] = useState('#0f3460');
  const [accent, setAccent] = useState('#e94560');
  const [saved, setSaved] = useState(false);

  const applyPreset = (theme: typeof PRESET_THEMES[0]) => {
    setPrimary(theme.primary);
    setAccent(theme.accent);
    document.documentElement.style.setProperty('--primary', theme.primary);
    document.documentElement.style.setProperty('--accent', theme.accent);
    if (theme.dark !== isDark) toggleDark();
  };

  const applyCustom = () => {
    document.documentElement.style.setProperty('--primary', primary);
    document.documentElement.style.setProperty('--accent', accent);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Palette size={22} color="var(--primary)" /> Thèmes & Personnalisation
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
          Personnalisez les couleurs et le mode d'affichage de LedgerSync pour votre organisation.
        </p>
      </div>

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
          {PRESET_THEMES.map(theme => (
            <button
              key={theme.name}
              onClick={() => applyPreset(theme)}
              style={{
                padding: '14px 16px', borderRadius: 10, border: '2px solid var(--border)',
                cursor: 'pointer', background: theme.bg, textAlign: 'left', transition: 'all 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = theme.primary)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: theme.primary }} />
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: theme.accent }} />
                {theme.dark && <div style={{ fontSize: 10, color: '#94a3b8', alignSelf: 'center' }}>🌙</div>}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: theme.dark ? '#e2e8f0' : '#1a1a2e' }}>{theme.name}</div>
            </button>
          ))}
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

        <button className="btn btn-primary" onClick={applyCustom} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saved ? <><span>✓</span> Appliqué !</> : <><Save size={15} /> Appliquer les couleurs</>}
        </button>
      </div>
    </div>
  );
}
