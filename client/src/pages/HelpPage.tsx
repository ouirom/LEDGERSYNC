import { useState } from 'react';
import {
  BookOpen, Keyboard, GitMerge, Upload, BarChart2,
  Shield, Clock, ChevronRight, HelpCircle, Zap,
  FileSpreadsheet, Lock, Users, FilePen, Bell, User, Palette
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
    icon: <FileSpreadsheet size={20} color="#f59e0b" />,
    title: 'Écritures Comptables',
    color: '#f59e0b',
    steps: [
      'Depuis Rapprochement > Écritures, gérez le tableau complet : ajout, modification, suppression (unitaire ou multiple) et export CSV.',
      'Depuis l\'espace de rapprochement, cliquez "Ajouter" pour saisir rapidement une écriture liée au compte et à la période affichés.',
      'Pour un lot d\'écritures, accédez à Rapprochement > Import Écritures.',
      'Sélectionnez le compte bancaire cible, puis glissez-déposez un ou plusieurs fichiers .xlsx/.csv/.pdf.',
      'Cliquez "Prévisualiser" pour vérifier les totaux débit/crédit et repérer les lignes invalides ou incertaines avant de valider.',
      'Cliquez "Valider l\'import" — les écritures créées apparaissent immédiatement dans l\'espace de rapprochement.',
      'Une période verrouillée ou close bloque la saisie manuelle et fait ignorer les lignes concernées lors d\'un import en lot (sans bloquer le reste du lot).',
      'Une écriture en brouillon peut être supprimée directement ; une écriture déjà validée doit être extournée (contre-passation) pour préserver la piste d\'audit.',
    ],
  },
  {
    icon: <Upload size={20} color="#10b981" />,
    title: 'Relevés Bancaires',
    color: '#10b981',
    steps: [
      'Depuis Rapprochement > Relevés Bancaires, gérez le tableau complet : ajout, modification, suppression (unitaire ou multiple) et export CSV.',
      'Une ligne déjà lettrée ne peut être ni modifiée ni supprimée directement — délettrez-la au préalable depuis l\'espace de rapprochement.',
      'Pour importer un relevé complet, accédez à Rapprochement > Import Relevés.',
      'Sélectionnez le compte bancaire cible.',
      'Glissez-déposez votre fichier .xlsx/.csv/.pdf ou cliquez pour le sélectionner (plusieurs fichiers/pages possibles).',
      'Vérifiez l\'aperçu (totaux débit/crédit, lignes invalides/incertaines) avant de valider.',
      'Cliquez "Lancer l\'import". Le traitement s\'effectue en arrière-plan avec suivi temps réel.',
    ],
  },
  {
    icon: <FilePen size={20} color="#7c3aed" />,
    title: 'Assistant PV & Validation',
    color: '#7c3aed',
    steps: [
      'Depuis Rapprochement > PV & Validation, filtrez par entreprise, compte, statut, mois et année pour retrouver un rapprochement.',
      'Chaque rapprochement suit un circuit de validation à double niveau : Brouillon → Soumis → Validé N1 (Superviseur) → Validé N2 (Manager) → Validé Final (DAF) → Clos & PV.',
      'Séparation des fonctions : la personne qui a créé, soumis ou déjà validé un niveau ne peut pas valider le niveau suivant du même rapprochement.',
      'Un rapprochement Soumis, Validé N1 ou Validé N2 peut être rejeté avec un motif obligatoire — il repasse alors en Brouillon pour correction.',
      'Une fois la validation finale (DAF) effectuée, générez le PV officiel au format PDF depuis le panneau de détail.',
      'Réouverture exceptionnelle : si une erreur est détectée après la validation finale, un DAF ou un administrateur peut rouvrir le rapprochement avec un motif obligatoire — il repasse en Brouillon et doit reparcourir tout le circuit de validation. La personne ayant signé la validation finale ne peut pas rouvrir elle-même le rapprochement.',
    ],
  },
  {
    icon: <Bell size={20} color="#f97316" />,
    title: 'Notifications',
    color: '#f97316',
    steps: [
      'La cloche en haut de l\'écran affiche deux types d\'alerte : les validations en attente de votre action, et les écarts non résolus sur des rapprochements pas encore soumis.',
      'Seules les alertes correspondant à votre rôle et à votre périmètre organisationnel sont affichées.',
      'Cliquez sur une alerte pour ouvrir directement le rapprochement concerné dans l\'Assistant PV & Validation, ou l\'Espace de Rapprochement pré-rempli sur le bon compte et la bonne période.',
      'Le badge se met à jour automatiquement en temps réel lorsqu\'un rapprochement change de statut.',
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
    icon: <User size={20} color="#14b8a6" />,
    title: 'Mon Profil',
    color: '#14b8a6',
    steps: [
      'Accédez à votre profil depuis votre avatar en haut à droite, ou depuis le menu en bas de la barre latérale.',
      'Cliquez "Modifier mes informations" pour changer votre prénom, nom ou email — un email déjà utilisé par un autre compte du tenant est refusé.',
      'Le rôle et le rattachement organisationnel restent du ressort d\'un administrateur (Administration > Hiérarchie).',
      'Cliquez l\'icône appareil photo sur votre avatar pour importer une photo de profil (JPG, PNG ou WebP, 3 Mo maximum), ou l\'icône corbeille pour la supprimer.',
    ],
  },
  {
    icon: <Lock size={20} color="#dc2626" />,
    title: 'Sécurité & Session',
    color: '#dc2626',
    steps: [
      'Après 5 minutes d\'inactivité, une alerte de déconnexion s\'affiche avec un décompte d\'1 minute avant fermeture automatique de la session.',
      'Toute action dans l\'application (clic, saisie, navigation) réinitialise ce délai.',
      'Après 5 échecs de connexion consécutifs, le compte est temporairement verrouillé quelques minutes.',
      'Le mot de passe peut être réinitialisé via "Mot de passe oublié" sur l\'écran de connexion, ou par un administrateur (Hiérarchie > Utilisateurs).',
    ],
  },
  {
    icon: <Palette size={20} color="#ec4899" />,
    title: 'Thèmes & Personnalisation',
    color: '#ec4899',
    steps: [
      'Accédez à Paramètres > Thèmes, puis sélectionnez l\'entreprise à personnaliser.',
      'Choisissez un thème prédéfini en un clic, ou personnalisez les couleurs primaire et accent puis enregistrez-les pour l\'entreprise sélectionnée.',
      'Importez un logo d\'entreprise (JPG, PNG ou WebP, 3 Mo maximum) — il remplace le pictogramme par défaut dans la barre latérale pour les utilisateurs rattachés à cette entreprise.',
      'Ces actions sont réservées aux rôles Super Admin, Admin Tenant et DAF.',
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
    icon: <Users size={20} color="#0891b2" />,
    title: 'Rattachement & Périmètre d\'accès',
    color: '#0891b2',
    adminOnly: true,
    steps: [
      'Chaque utilisateur est rattaché à un seul niveau de la hiérarchie : Entreprise, Succursale, Direction ou Service (Administration > Hiérarchie > Utilisateurs > Ajouter/Modifier).',
      'Ce niveau détermine le périmètre des données bancaires visibles : banques, comptes bancaires, relevés et écritures comptables.',
      'Un rattachement Entreprise voit toutes les succursales de son entreprise. Un rattachement Succursale, Direction ou Service ne voit que les données de sa propre succursale.',
      'Les rôles Super Admin et Admin Tenant ne sont soumis à aucune restriction de périmètre : ils voient toutes les entreprises du tenant.',
      'Changer le rattachement d\'un utilisateur prend effet à sa prochaine connexion (le jeton d\'accès déjà émis reste valide jusqu\'à son expiration, 15 minutes maximum).',
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
  const sections = SECTIONS.filter(s => !s.adminOnly || isAdmin);

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
          {sections.map((s, i) => (
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
            onClick={() => setActiveSection(sections.length)}
          >
            <Keyboard size={18} color="#e94560" /> Raccourcis clavier
          </button>
        </div>

        {/* Content */}
        <div className="card" style={{ padding: 28 }}>
          {activeSection < sections.length ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                {sections[activeSection].icon}
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{sections[activeSection].title}</h2>
              </div>
              <ol style={{ margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {sections[activeSection].steps.map((step, i) => (
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
