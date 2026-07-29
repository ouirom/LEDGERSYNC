import { useState } from 'react';
import {
  BookOpen, Keyboard, GitMerge, Upload, BarChart2,
  Shield, Clock, ChevronRight, HelpCircle, Zap
} from 'lucide-react';

const KEYBOARD_SHORTCUTS = [
  { keys: ['Espace'], desc: 'Valider le lettrage des éléments sélectionnés', section: 'Rapprochement' },
  { keys: ['Ctrl', 'F'], desc: 'Recherche globale dans l\'application', section: 'Navigation' },
  { keys: ['Échap'], desc: 'Fermer modal / Annuler / Désélectionner', section: 'Navigation' },
  { keys: ['Ctrl', 'A'], desc: 'Sélectionner toutes les écritures non lettrées', section: 'Rapprochement' },
  { keys: ['Shift', '/'], desc: 'Ouvrir ce guide d\'aide', section: 'Navigation' },
];

const SECTIONS = [
  {
    icon: <GitMerge size={20} color="#0f3460" />,
    title: 'Espace de Rapprochement',
    color: '#0f3460',
    steps: [
      'Sélectionnez un compte bancaire et une période via les filtres en haut.',
      'Cliquez sur "Charger" pour afficher les écritures comptables (gauche) et le relevé bancaire (droit).',
      'Cochez les écritures et lignes de relevé correspondantes (montants égaux ou proches).',
      'Appuyez sur Espace ou cliquez "Lettrer" pour valider le rapprochement.',
      'Utilisez "Auto-Match" pour détecter automatiquement les correspondances évidentes.',
    ],
  },
  {
    icon: <Upload size={20} color="#10b981" />,
    title: 'Import de Relevé Excel',
    color: '#10b981',
    steps: [
      'Accédez à Rapprochement > Import Excel.',
      'Sélectionnez le compte bancaire cible.',
      'Glissez-déposez votre fichier .xlsx/.csv ou cliquez pour le sélectionner.',
      'Vérifiez l\'aperçu des 5 premières lignes (colonnes Date, Montant, Libelle, Référence).',
      'Cliquez "Lancer l\'import". Le traitement s\'effectue en arrière-plan avec suivi temps réel.',
    ],
  },
  {
    icon: <Clock size={20} color="#3b82f6" />,
    title: 'Moniteur de Jobs',
    color: '#3b82f6',
    steps: [
      'Le moniteur de jobs affiche tous les traitements asynchrones en cours et passés.',
      'Pour un job en cours, vous pouvez l\'annuler via l\'icône rouge.',
      'Un job échoué peut être relancé (Resume) depuis son dernier point de checkpoint.',
      'La progression est mise à jour en temps réel via WebSockets.',
    ],
  },
  {
    icon: <Shield size={20} color="#e94560" />,
    title: 'Périodes Comptables',
    color: '#e94560',
    steps: [
      'Accédez à Administration > Périodes pour gérer le verrouillage.',
      'Une période OUVERTE autorise imports, lettrages et modifications.',
      'Une période VERROUILLÉE bloque toute modification (réversible par le Manager/DAF).',
      'Une période CLOSE est définitivement verrouillée — aucune modification n\'est possible.',
      'Toute tentative d\'opération sur une période fermée retourne une erreur 423.',
    ],
  },
  {
    icon: <BarChart2 size={20} color="#8b5cf6" />,
    title: 'Piste d\'Audit',
    color: '#8b5cf6',
    steps: [
      'La piste d\'audit est inviolable : aucune entrée ne peut être supprimée.',
      'Chaque lettrage, dé-lettrage, import et connexion est tracé.',
      'Utilisez les filtres (entité, action, dates) pour retrouver un événement.',
      'Exportez la piste en CSV pour les besoins de conformité SOX ou audit externe.',
    ],
  },
];

export default function HelpPage({ isAdmin = false }: { isAdmin?: boolean }) {
  const [activeSection, setActiveSection] = useState(0);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <HelpCircle size={22} color="var(--primary)" />
          {isAdmin ? 'Guide Administrateur' : 'Guide Utilisateur'} LedgerSync
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
          Manuel de référence pour le système de rapprochement bancaire multi-tenant.
        </p>
      </div>

      {/* Quick start */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { icon: <Zap size={18} />, title: 'Démarrage rapide', desc: 'Votre premier rapprochement en 5 étapes', color: '#0f3460' },
          { icon: <Keyboard size={18} />, title: 'Raccourcis clavier', desc: 'Gagner en productivité avec les shortcucts', color: '#e94560' },
          { icon: <BookOpen size={18} />, title: 'Normes SOX / IFRS', desc: 'Conformité et séparation des fonctions', color: '#10b981' },
        ].map(card => (
          <div key={card.title} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = card.color)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${card.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color, flexShrink: 0 }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{card.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{card.desc}</div>
            </div>
            <ChevronRight size={14} color="var(--text-muted)" style={{ marginLeft: 'auto' }} />
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20 }}>
        {/* Sidebar navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SECTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveSection(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left',
                background: activeSection === i ? `${s.color}12` : 'transparent',
                color: activeSection === i ? s.color : 'var(--text)',
                fontWeight: activeSection === i ? 600 : 400, fontSize: 13,
                borderLeft: `3px solid ${activeSection === i ? s.color : 'transparent'}`,
                transition: 'all 0.15s',
              }}
            >
              {s.icon} {s.title}
            </button>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left',
              background: 'transparent', color: 'var(--text)', fontSize: 13,
              transition: 'all 0.15s',
            }}
            onClick={() => setActiveSection(SECTIONS.length)}
          >
            <Keyboard size={18} color="#e94560" /> Raccourcis clavier
          </button>
        </div>

        {/* Content */}
        <div className="card" style={{ padding: 28 }}>
          {activeSection < SECTIONS.length ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                {SECTIONS[activeSection].icon}
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{SECTIONS[activeSection].title}</h2>
              </div>
              <ol style={{ margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {SECTIONS[activeSection].steps.map((step, i) => (
                  <li key={i} style={{ paddingLeft: 8 }}>
                    <div style={{ fontSize: 14, lineHeight: 1.6 }}>{step}</div>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                <Keyboard size={20} color="#e94560" />
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Raccourcis Clavier</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {KEYBOARD_SHORTCUTS.map((shortcut, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 160 }}>
                      {shortcut.keys.map((k, ki) => (
                        <span key={ki}>
                          <kbd style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 5, fontSize: 12, fontWeight: 700, boxShadow: '0 2px 0 var(--border)' }}>{k}</kbd>
                          {ki < shortcut.keys.length - 1 && <span style={{ color: 'var(--text-muted)', margin: '0 2px', fontSize: 12 }}>+</span>}
                        </span>
                      ))}
                    </div>
                    <div style={{ flex: 1, fontSize: 13 }}>{shortcut.desc}</div>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {shortcut.section}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
