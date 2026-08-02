import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, GitMerge, Upload, Briefcase, Settings,
  Shield, ChevronLeft, ChevronRight, Bell, Moon, Sun,
  User, LogOut, Wifi, WifiOff, FileText, FilePen,
  HelpCircle, Palette, Building2, Search, X, Command, Settings2, FileSpreadsheet, BookText, Landmark,
  AlertTriangle, ClipboardCheck
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSocket } from '../../contexts/SocketContext';
import api from '../../api/axios';
import { resolveUploadUrl } from '../../utils/uploads';
import SessionTimeoutGuard from './SessionTimeoutGuard';

const MOIS_COURT = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

interface NotifItem {
  id: number;
  entreprise: string;
  compte: string;
  compte_bancaire_id: number;
  periode_mois: number;
  periode_annee: number;
  statut: string;
  montant_ecart: number;
}
interface NotifSummary {
  validationsEnAttente: { total: number; items: NotifItem[] };
  ecartsNonResolus: { total: number; items: NotifItem[] };
}

const NAV_GROUPS = [
  {
    label: 'Tableaux de Bord',
    items: [
      { to: '/dashboard/operational', icon: LayoutDashboard, label: 'Opérationnel' },
      { to: '/dashboard/executive', icon: Briefcase, label: 'Direction' },
      { to: '/dashboard/audit', icon: Shield, label: "Piste d'Audit" },
    ],
  },
  {
    label: 'Rapprochement',
    items: [
      { to: '/reconciliation/workspace', icon: GitMerge, label: 'Espace de Rapprochement' },
      { to: '/reconciliation/ecritures', icon: BookText, label: 'Écritures' },
      { to: '/reconciliation/ecritures-import', icon: FileSpreadsheet, label: 'Import Écritures' },
      { to: '/reconciliation/releves', icon: Landmark, label: 'Relevés Bancaires' },
      { to: '/reconciliation/excel-import', icon: Upload, label: 'Import Relevés' },
      { to: '/reconciliation/pdf-wizard', icon: FilePen, label: 'PV & Validation' },
    ],
  },
  {
    label: 'Opérations',
    items: [
      { to: '/jobs/monitor', icon: FileText, label: 'Moniteur de Jobs' },
    ],
  },
  {
    label: 'Paramètres',
    items: [
      { to: '/settings/periods', icon: Settings, label: 'Périodes' },
      { to: '/settings/themes', icon: Palette, label: 'Thèmes' },
      { to: '/settings/bank-templates', icon: FileText, label: "Templates d'Import" },
      { to: '/settings/application', icon: Settings2, label: 'Infrastructure', roles: ['SUPER_ADMIN'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin/hierarchy', icon: Building2, label: 'Hiérarchie' },
      { to: '/admin/audit-trail', icon: Shield, label: "Piste d'Audit" },
    ],
  },
];

// Global search items index
const SEARCH_INDEX = [
  { label: 'Tableau de Bord Opérationnel', to: '/dashboard/operational', section: 'Dashboard' },
  { label: 'Tableau de Bord Direction', to: '/dashboard/executive', section: 'Dashboard' },
  { label: 'Piste d\'Audit', to: '/dashboard/audit', section: 'Dashboard' },
  { label: 'Espace de Rapprochement', to: '/reconciliation/workspace', section: 'Rapprochement' },
  { label: 'Écritures Comptables', to: '/reconciliation/ecritures', section: 'Rapprochement' },
  { label: 'Import d\'Écritures Comptables', to: '/reconciliation/ecritures-import', section: 'Rapprochement' },
  { label: 'Relevés Bancaires', to: '/reconciliation/releves', section: 'Rapprochement' },
  { label: 'Import de Relevés Bancaires', to: '/reconciliation/excel-import', section: 'Rapprochement' },
  { label: 'Assistant PV & Validation', to: '/reconciliation/pdf-wizard', section: 'Rapprochement' },
  { label: 'Moniteur de Jobs', to: '/jobs/monitor', section: 'Opérations' },
  { label: 'Périodes Comptables', to: '/settings/periods', section: 'Paramètres' },
  { label: 'Thèmes & Personnalisation', to: '/settings/themes', section: 'Paramètres' },
  { label: 'Templates d\'Import Bancaire', to: '/settings/bank-templates', section: 'Paramètres' },
  { label: 'Paramètres d\'Infrastructure', to: '/settings/application', section: 'Paramètres' },
  { label: 'Hiérarchie Organisationnelle', to: '/admin/hierarchy', section: 'Administration' },
  { label: 'Piste d\'Audit', to: '/admin/audit-trail', section: 'Administration' },
  { label: 'Mon Profil', to: '/profile', section: 'Compte' },
  { label: 'Guide d\'aide', to: '/help', section: 'Aide' },
];

export default function AppLayout() {
  const { user, logout, hasRole } = useAuth();
  const { isDark, toggleDark } = useTheme();
  const { connected, socket } = useSocket();
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const avatarSrc = resolveUploadUrl(user?.avatarUrl);
  const entrepriseLogoSrc = resolveUploadUrl(user?.entrepriseLogoUrl);

  // Notifications: dérivées à la volée côté serveur (pas de table dédiée) —
  // rafraîchies périodiquement et sur les événements socket déjà émis par le
  // module de rapprochement, pour rester à jour sans polling agressif.
  const [notifSummary, setNotifSummary] = useState<NotifSummary | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifTotal = (notifSummary?.validationsEnAttente.total ?? 0) + (notifSummary?.ecartsNonResolus.total ?? 0);

  const fetchNotifications = useCallback(() => {
    api.get('/notifications/summary').then(r => setNotifSummary(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!socket) return;
    socket.on('rapprochement:updated', fetchNotifications);
    socket.on('lettrage:created', fetchNotifications);
    return () => {
      socket.off('rapprochement:updated', fetchNotifications);
      socket.off('lettrage:created', fetchNotifications);
    };
  }, [socket, fetchNotifications]);

  const goToValidation = (item: NotifItem) => {
    navigate(`/reconciliation/pdf-wizard?rapprochement_id=${item.id}`);
    setNotifOpen(false);
  };
  const goToEcart = (item: NotifItem) => {
    navigate('/reconciliation/workspace', { state: { compteId: String(item.compte_bancaire_id), mois: String(item.periode_mois), annee: String(item.periode_annee) } });
    setNotifOpen(false);
  };

  // Global search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(SEARCH_INDEX);
  const [searchSelected, setSearchSelected] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Help modal state
  const [helpOpen, setHelpOpen] = useState(false);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setSearchQuery('');
    setSearchResults(SEARCH_INDEX);
    setSearchSelected(0);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+F → global search
      if (e.ctrlKey && e.code === 'KeyF') {
        e.preventDefault();
        openSearch();
        return;
      }
      // Shift+/ → help modal
      if (e.shiftKey && e.code === 'Slash') {
        e.preventDefault();
        setHelpOpen(h => !h);
        return;
      }
      // Escape → close modals
      if (e.code === 'Escape') {
        if (searchOpen) closeSearch();
        if (helpOpen) setHelpOpen(false);
        return;
      }
      // Arrow navigation in search
      if (searchOpen) {
        if (e.code === 'ArrowDown') {
          e.preventDefault();
          setSearchSelected(s => Math.min(s + 1, searchResults.length - 1));
        }
        if (e.code === 'ArrowUp') {
          e.preventDefault();
          setSearchSelected(s => Math.max(s - 1, 0));
        }
        if (e.code === 'Enter' && searchResults[searchSelected]) {
          navigate(searchResults[searchSelected].to);
          closeSearch();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchOpen, helpOpen, searchResults, searchSelected, navigate, openSearch, closeSearch]);

  // Search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(SEARCH_INDEX);
      setSearchSelected(0);
      return;
    }
    const q = searchQuery.toLowerCase();
    const filtered = SEARCH_INDEX.filter(item =>
      item.label.toLowerCase().includes(q) || item.section.toLowerCase().includes(q)
    );
    setSearchResults(filtered);
    setSearchSelected(0);
  }, [searchQuery]);

  return (
    <div className="app-layout">
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-logo">
          {!collapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, background: entrepriseLogoSrc ? 'white' : 'linear-gradient(135deg,#e94560,#0f3460)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: 'white', overflow: 'hidden', flexShrink: 0 }}>
                {entrepriseLogoSrc ? <img src={entrepriseLogoSrc} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : 'L'}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'white', letterSpacing: 0.5 }}>LedgerSync</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>ERP FINANCIER</div>
              </div>
            </div>
          ) : (
            <div style={{ width: 32, height: 32, background: entrepriseLogoSrc ? 'white' : 'linear-gradient(135deg,#e94560,#0f3460)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'white', overflow: 'hidden' }}>
              {entrepriseLogoSrc ? <img src={entrepriseLogoSrc} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : 'L'}
            </div>
          )}
        </div>

        {/* Search trigger in sidebar */}
        {!collapsed && (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <button
              onClick={openSearch}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12 }}
            >
              <Search size={13} /> Rechercher...
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 3, alignItems: 'center' }}>
                <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>Ctrl</kbd>
                <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>F</kbd>
              </span>
            </button>
          </div>
        )}

        <nav className="sidebar-nav">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              {!collapsed && <div className="nav-section-label">{group.label}</div>}
              {group.items.filter(item => !('roles' in item) || hasRole(...item.roles)).map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon size={18} style={{ flexShrink: 0 }} />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          ))}

          {/* Help link — variante Administrateur (sections réservées incluses)
              pour SUPER_ADMIN/ADMIN_TENANT, sinon le guide utilisateur standard. */}
          <div>
            {!collapsed && <div className="nav-section-label">Aide</div>}
            <NavLink to={hasRole('SUPER_ADMIN', 'ADMIN_TENANT') ? '/help/admin' : '/help'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title={collapsed ? 'Aide' : undefined}>
              <HelpCircle size={18} style={{ flexShrink: 0 }} />
              {!collapsed && <span>Guide d'aide</span>}
            </NavLink>
          </div>
        </nav>

        {/* User info at bottom */}
        {!collapsed && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarSrc ? undefined : 'linear-gradient(135deg,#e94560,#0f3460)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0, overflow: 'hidden' }}>
                {avatarSrc ? <img src={avatarSrc} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${user?.prenom?.[0] || ''}${user?.nom?.[0] || ''}`}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.prenom} {user?.nom}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 }}>{user?.role}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate('/profile')} title="Profil" style={{ color: 'rgba(255,255,255,0.5)', border: 'none' }}><User size={14} /></button>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setHelpOpen(true)} title="Aide (Shift+/)" style={{ color: 'rgba(255,255,255,0.5)', border: 'none' }}><HelpCircle size={14} /></button>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={logout} title="Déconnexion" style={{ color: 'rgba(255,255,255,0.5)', border: 'none' }}><LogOut size={14} /></button>
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{ position: 'absolute', top: 22, right: -12, width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', border: '2px solid var(--bg-card)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* ── Main ────────────────────────────────────────── */}
      <div className="main-content" style={{ marginLeft: collapsed ? 64 : 240 }}>
        <header className="topbar">
          <div style={{ flex: 1 }} />

          {/* WS status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: connected ? 'var(--success)' : 'var(--text-muted)' }}>
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            {connected ? 'Connecté' : 'Hors ligne'}
          </div>

          {/* Global search button */}
          <button className="btn btn-ghost btn-sm" onClick={openSearch} style={{ gap: 8, color: 'var(--text-muted)' }}>
            <Search size={15} />
            <span style={{ fontSize: 12 }}>Rechercher</span>
            <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <kbd style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 3, fontSize: 10, border: '1px solid var(--border)' }}>Ctrl</kbd>
              <kbd style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 3, fontSize: 10, border: '1px solid var(--border)' }}>F</kbd>
            </span>
          </button>

          {/* Notifications */}
          <div style={{ position: 'relative' }}>
            <button className="btn btn-ghost btn-icon" style={{ position: 'relative' }} onClick={() => setNotifOpen(o => !o)} title="Notifications">
              <Bell size={18} />
              {notifTotal > 0 && (
                <span style={{ position: 'absolute', top: 2, right: 2, minWidth: 15, height: 15, padding: '0 3px', background: 'var(--danger, #dc2626)', borderRadius: 20, border: '1.5px solid var(--bg-card)', fontSize: 9, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {notifTotal > 9 ? '9+' : notifTotal}
                </span>
              )}
            </button>

            {notifOpen && (
              <>
                <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', top: '120%', right: 0, width: 360, maxHeight: 440, overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', zIndex: 50 }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Notifications</div>
                  {notifTotal === 0 ? (
                    <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      <Bell size={22} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                      <div>Aucune alerte</div>
                    </div>
                  ) : (
                    <>
                      {notifSummary!.validationsEnAttente.total > 0 && (
                        <div>
                          <div style={{ padding: '10px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                            Validations en attente ({notifSummary!.validationsEnAttente.total})
                          </div>
                          {notifSummary!.validationsEnAttente.items.map(item => (
                            <button
                              key={`v-${item.id}`}
                              onClick={() => goToValidation(item)}
                              style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <ClipboardCheck size={14} style={{ flexShrink: 0, color: 'var(--primary)', marginTop: 2 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{item.entreprise} · {MOIS_COURT[item.periode_mois]} {item.periode_annee}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.compte}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {notifSummary!.ecartsNonResolus.total > 0 && (
                        <div>
                          <div style={{ padding: '10px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                            Écarts non résolus ({notifSummary!.ecartsNonResolus.total})
                          </div>
                          {notifSummary!.ecartsNonResolus.items.map(item => (
                            <button
                              key={`e-${item.id}`}
                              onClick={() => goToEcart(item)}
                              style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <AlertTriangle size={14} style={{ flexShrink: 0, color: 'var(--danger, #dc2626)', marginTop: 2 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{item.entreprise} · {MOIS_COURT[item.periode_mois]} {item.periode_annee}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {item.compte} — écart de {Number(item.montant_ecart).toLocaleString('fr-FR')}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Dark mode toggle */}
          <button className="btn btn-ghost btn-icon" onClick={toggleDark} title="Basculer le thème">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Help */}
          <button className="btn btn-ghost btn-icon" onClick={() => setHelpOpen(true)} title="Aide (Shift+/)">
            <HelpCircle size={18} />
          </button>

          {/* User avatar */}
          <div
            style={{ width: 34, height: 34, borderRadius: '50%', background: avatarSrc ? undefined : 'linear-gradient(135deg,#e94560,#0f3460)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer', overflow: 'hidden' }}
            onClick={() => navigate('/profile')}
            title={`${user?.prenom} ${user?.nom}`}
          >
            {avatarSrc ? <img src={avatarSrc} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${user?.prenom?.[0] || ''}${user?.nom?.[0] || ''}`}
          </div>
        </header>

        <main className="page-content animate-fadeIn">
          <Outlet />
        </main>
      </div>

      {/* ── Global Search Modal (Ctrl+F) ─────────────────── */}
      {searchOpen && (
        <div className="modal-overlay" onClick={closeSearch} style={{ alignItems: 'flex-start', paddingTop: '10vh' }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 600, boxShadow: '0 25px 80px rgba(0,0,0,0.4)', overflow: 'hidden' }}
          >
            {/* Search input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <Search size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher une page, une fonctionnalité..."
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, background: 'transparent', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}
              />
              <button onClick={closeSearch} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Results */}
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {searchResults.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Search size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                  <div>Aucun résultat pour "{searchQuery}"</div>
                </div>
              ) : (
                <div style={{ padding: 8 }}>
                  {searchResults.map((item, i) => (
                    <button
                      key={item.to}
                      onClick={() => { navigate(item.to); closeSearch(); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: i === searchSelected ? 'var(--primary)' : 'transparent',
                        color: i === searchSelected ? 'white' : 'var(--text)',
                        textAlign: 'left', transition: 'background 0.1s',
                      }}
                      onMouseEnter={() => setSearchSelected(i)}
                    >
                      <Command size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{item.label}</div>
                      </div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: i === searchSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg)', color: i === searchSelected ? 'white' : 'var(--text-muted)', border: `1px solid ${i === searchSelected ? 'rgba(255,255,255,0.3)' : 'var(--border)'}`, whiteSpace: 'nowrap' }}>
                        {item.section}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
              {[['↑↓', 'Naviguer'], ['↵', 'Ouvrir'], ['Échap', 'Fermer']].map(([key, desc]) => (
                <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <kbd style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 3, fontSize: 10, border: '1px solid var(--border)' }}>{key}</kbd>
                  {desc}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Help Modal (Shift+/) ─────────────────────────── */}
      {helpOpen && (
        <div className="modal-overlay" onClick={() => setHelpOpen(false)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 520 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <HelpCircle size={18} color="var(--primary)" /> Raccourcis Clavier
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setHelpOpen(false)}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { keys: ['Espace'], desc: 'Valider le lettrage sélectionné', ctx: 'Rapprochement' },
                { keys: ['Ctrl', 'F'], desc: 'Ouvrir la recherche globale', ctx: 'Global' },
                { keys: ['Ctrl', 'A'], desc: 'Sélectionner tout (écritures)', ctx: 'Rapprochement' },
                { keys: ['Échap'], desc: 'Fermer / Annuler / Désélectionner', ctx: 'Global' },
                { keys: ['Shift', '/'], desc: 'Afficher ce panneau d\'aide', ctx: 'Global' },
                { keys: ['↑', '↓'], desc: 'Naviguer dans la recherche', ctx: 'Recherche' },
                { keys: ['↵'], desc: 'Valider la sélection', ctx: 'Recherche' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 120 }}>
                    {s.keys.map((k, ki) => (
                      <span key={ki}>
                        <kbd style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 4, fontSize: 12, fontWeight: 700, boxShadow: '0 2px 0 var(--border)' }}>{k}</kbd>
                        {ki < s.keys.length - 1 && <span style={{ color: 'var(--text-muted)', margin: '0 2px', fontSize: 11 }}>+</span>}
                      </span>
                    ))}
                  </div>
                  <div style={{ flex: 1, fontSize: 13 }}>{s.desc}</div>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{s.ctx}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Guide complet disponible dans Aide</span>
              <button className="btn btn-primary btn-sm" onClick={() => { setHelpOpen(false); navigate('/help'); }}>
                <HelpCircle size={13} /> Ouvrir le guide
              </button>
            </div>
          </div>
        </div>
      )}

      <SessionTimeoutGuard />
    </div>
  );
}
