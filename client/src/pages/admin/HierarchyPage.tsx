import { useEffect, useState } from 'react';
import { Building2, Users, ChevronRight, ChevronDown, Plus, Shield, Briefcase, User } from 'lucide-react';
import api from '../../api/axios';

interface HierarchyNode {
  id: number;
  nom: string;
  code: string;
  type: 'entreprise' | 'succursale' | 'direction' | 'service';
  children?: HierarchyNode[];
  etat: string;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  SUPER_ADMIN: <Shield size={12} />,
  ADMIN_TENANT: <Shield size={12} />,
  DAF: <Briefcase size={12} />,
  MANAGER: <Users size={12} />,
  SUPERVISEUR: <Users size={12} />,
  USER: <User size={12} />,
  AUDITEUR: <Shield size={12} />,
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'badge-danger',
  ADMIN_TENANT: 'badge-warning',
  DAF: 'badge-info',
  MANAGER: 'badge-info',
  SUPERVISEUR: 'badge-warning',
  USER: 'badge-gray',
  AUDITEUR: 'badge-accent',
};

function TreeNode({ node, depth = 0 }: { node: HierarchyNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  const TYPE_COLORS: Record<string, string> = {
    entreprise: '#0f3460',
    succursale: '#3b82f6',
    direction: '#10b981',
    service: '#f59e0b',
  };

  const color = TYPE_COLORS[node.type] || '#6b7280';

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
          paddingLeft: 12 + depth * 24, cursor: node.children?.length ? 'pointer' : 'default',
          borderRadius: 8, transition: 'background 0.1s', userSelect: 'none',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        onClick={() => node.children?.length && setExpanded(e => !e)}
      >
        {node.children?.length ? (
          expanded ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />
        ) : <div style={{ width: 14 }} />}
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{node.nom}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            <code style={{ fontSize: 10, background: 'var(--bg)', padding: '1px 5px', borderRadius: 3 }}>{node.code}</code>
            {' · '}
            <span style={{ textTransform: 'capitalize', color }}>{node.type}</span>
          </div>
        </div>
        <span className={`badge ${node.etat === 'ACTIF' ? 'badge-success' : 'badge-gray'}`} style={{ fontSize: 10 }}>
          {node.etat}
        </span>
      </div>
      {expanded && node.children && (
        <div style={{ borderLeft: `2px solid ${color}20`, marginLeft: 12 + depth * 24 + 3 }}>
          {node.children.map(child => <TreeNode key={`${child.type}-${child.id}`} node={child} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

export default function HierarchyPage() {
  const [entreprises, setEntreprises] = useState<any[]>([]);
  const [utilisateurs, setUtilisateurs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'structure' | 'users'>('structure');

  useEffect(() => {
    Promise.all([
      api.get('/entreprises').catch(() => ({ data: { data: [] } })),
      api.get('/auth/users').catch(() => ({ data: { data: [] } })),
    ]).then(([e, u]) => {
      setEntreprises(e.data.data || []);
      setUtilisateurs(u.data.data || []);
    }).finally(() => setLoading(false));
  }, []);

  // Build hierarchy tree from entreprises
  const buildTree = (): HierarchyNode[] => {
    return entreprises.map(e => ({
      id: e.id,
      nom: e.nom,
      code: e.code,
      type: 'entreprise',
      etat: e.etat,
      children: (e.succursales || []).map((s: any) => ({
        id: s.id,
        nom: s.nom,
        code: s.code,
        type: 'succursale',
        etat: s.etat,
        children: (s.directions || []).map((d: any) => ({
          id: d.id,
          nom: d.nom,
          code: d.code,
          type: 'direction',
          etat: d.etat,
          children: (d.services || []).map((svc: any) => ({
            id: svc.id,
            nom: svc.nom,
            code: svc.code,
            type: 'service',
            etat: svc.etat,
          })),
        })),
      })),
    }));
  };

  const tree = buildTree();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={22} color="var(--primary)" /> Hiérarchie Organisationnelle
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Structure des entités, succursales, directions, services et utilisateurs.
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary"><Plus size={15} /> Ajouter une entité</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        {[{ key: 'structure', label: '🏢 Structure', icon: <Building2 size={14} /> }, { key: 'users', label: '👥 Utilisateurs', icon: <Users size={14} /> }].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '10px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 14, fontWeight: activeTab === tab.key ? 700 : 400,
              color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: `2px solid ${activeTab === tab.key ? 'var(--primary)' : 'transparent'}`,
              marginBottom: -2, transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'structure' && (
        <div className="card" style={{ padding: 20 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 40 }} />)}
            </div>
          ) : tree.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              <Building2 size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <div style={{ fontWeight: 600 }}>Aucune structure organisationnelle</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Configurez vos entreprises, succursales et services.</div>
            </div>
          ) : (
            <div>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                {[['#0f3460', 'Entreprise'], ['#3b82f6', 'Succursale'], ['#10b981', 'Direction'], ['#f59e0b', 'Service']].map(([color, label]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                    {label}
                  </div>
                ))}
              </div>
              {tree.map(node => <TreeNode key={node.id} node={node} />)}
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Entreprise</th>
                <th>Statut</th>
                <th>Dernière connexion</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Chargement...</td></tr>
              ) : utilisateurs.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                  Aucun utilisateur trouvé
                </td></tr>
              ) : utilisateurs.map((u: any) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#e94560,#0f3460)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {u.prenom?.[0]}{u.nom?.[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{u.prenom} {u.nom}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{u.email}</td>
                  <td>
                    <span className={`badge ${ROLE_COLORS[u.role] || 'badge-gray'}`} style={{ display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
                      {ROLE_ICONS[u.role]} {u.role?.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{u.entreprise?.nom || '—'}</td>
                  <td><span className={`badge ${u.etat === 'ACTIF' ? 'badge-success' : 'badge-gray'}`}>{u.etat}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {u.derniere_connexion ? new Date(u.derniere_connexion).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
