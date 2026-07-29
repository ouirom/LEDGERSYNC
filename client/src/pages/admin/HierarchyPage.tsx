import { useEffect, useState } from 'react';
import { Building2, Users, ChevronRight, ChevronDown, Plus, Shield, Briefcase, User, Edit3, Trash2, X, Save } from 'lucide-react';
import api from '../../api/axios';

type NodeType = 'entreprise' | 'succursale' | 'sous_succursale' | 'direction' | 'service';

interface HierarchyNode {
  id: number;
  nom: string;
  code: string;
  type: NodeType;
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

const TYPE_COLORS: Record<NodeType, string> = {
  entreprise: '#0f3460',
  succursale: '#3b82f6',
  sous_succursale: '#8b5cf6',
  direction: '#10b981',
  service: '#f59e0b',
};

const TYPE_LABELS: Record<NodeType, string> = {
  entreprise: 'Entreprise',
  succursale: 'Succursale',
  sous_succursale: 'Sous-succursale',
  direction: 'Direction',
  service: 'Service',
};

// Type de l'entité enfant que chaque type peut créer, et l'endpoint REST associé
const CHILD_TYPE: Partial<Record<NodeType, NodeType[]>> = {
  entreprise: ['succursale'],
  succursale: ['sous_succursale', 'direction'],
  direction: ['service'],
};

const ENDPOINT: Record<Exclude<NodeType, 'entreprise'>, string> = {
  succursale: 'succursales',
  sous_succursale: 'sous-succursales',
  direction: 'directions',
  service: 'services',
};

const PARENT_FIELD: Record<Exclude<NodeType, 'entreprise'>, string> = {
  succursale: 'entreprise_id',
  sous_succursale: 'succursale_id',
  direction: 'succursale_id',
  service: 'direction_id',
};

interface ModalState {
  mode: 'add' | 'edit';
  type: Exclude<NodeType, 'entreprise'>;
  parentId?: number;
  targetId?: number;
  nom: string;
  code: string;
}

function TreeNode({ node, depth = 0, onAddChild, onEdit, onDelete }: {
  node: HierarchyNode; depth?: number;
  onAddChild: (parentType: NodeType, parentId: number, childType: NodeType) => void;
  onEdit: (node: HierarchyNode) => void;
  onDelete: (node: HierarchyNode) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const color = TYPE_COLORS[node.type] || '#6b7280';
  const childTypes = CHILD_TYPE[node.type];

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
          paddingLeft: 12 + depth * 24, borderRadius: 8, transition: 'background 0.1s', userSelect: 'none',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ cursor: node.children?.length ? 'pointer' : 'default' }} onClick={() => node.children?.length && setExpanded(e => !e)}>
          {node.children?.length ? (
            expanded ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />
          ) : <div style={{ width: 14 }} />}
        </div>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, cursor: node.children?.length ? 'pointer' : 'default' }} onClick={() => node.children?.length && setExpanded(e => !e)}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{node.nom}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            <code style={{ fontSize: 10, background: 'var(--bg)', padding: '1px 5px', borderRadius: 3 }}>{node.code}</code>
            {' · '}
            <span style={{ color }}>{TYPE_LABELS[node.type]}</span>
          </div>
        </div>
        <span className={`badge ${node.etat === 'ACTIF' ? 'badge-success' : 'badge-gray'}`} style={{ fontSize: 10 }}>
          {node.etat}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          {childTypes?.map(ct => (
            <button key={ct} className="btn btn-ghost btn-sm btn-icon" title={`Ajouter ${TYPE_LABELS[ct]}`} onClick={() => onAddChild(node.type, node.id, ct)}>
              <Plus size={12} />
            </button>
          ))}
          {node.type !== 'entreprise' && (
            <>
              <button className="btn btn-ghost btn-sm btn-icon" title="Modifier" onClick={() => onEdit(node)}><Edit3 size={12} /></button>
              <button className="btn btn-danger btn-sm btn-icon" title="Archiver" onClick={() => onDelete(node)}><Trash2 size={12} /></button>
            </>
          )}
        </div>
      </div>
      {expanded && node.children && (
        <div style={{ borderLeft: `2px solid ${color}20`, marginLeft: 12 + depth * 24 + 3 }}>
          {node.children.map(child => (
            <TreeNode key={`${child.type}-${child.id}`} node={child} depth={depth + 1} onAddChild={onAddChild} onEdit={onEdit} onDelete={onDelete} />
          ))}
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
  const [modal, setModal] = useState<ModalState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/entreprises').catch(() => ({ data: { data: [] } })),
      api.get('/auth/users').catch(() => ({ data: { data: [] } })),
    ]).then(([e, u]) => {
      setEntreprises(e.data.data || []);
      setUtilisateurs(u.data.data || []);
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Build hierarchy tree from entreprises
  const buildTree = (): HierarchyNode[] => {
    return entreprises.map(e => ({
      id: e.id,
      nom: e.nom,
      code: e.code,
      type: 'entreprise' as const,
      etat: e.etat,
      children: (e.succursales || []).map((s: any) => ({
        id: s.id,
        nom: s.nom,
        code: s.code,
        type: 'succursale' as const,
        etat: s.etat,
        children: [
          ...(s.sous_succursales || []).map((ss: any) => ({ id: ss.id, nom: ss.nom, code: ss.code, type: 'sous_succursale' as const, etat: ss.etat })),
          ...(s.directions || []).map((d: any) => ({
            id: d.id,
            nom: d.nom,
            code: d.code,
            type: 'direction' as const,
            etat: d.etat,
            children: (d.services || []).map((svc: any) => ({
              id: svc.id,
              nom: svc.nom,
              code: svc.code,
              type: 'service' as const,
              etat: svc.etat,
            })),
          })),
        ],
      })),
    }));
  };

  const tree = buildTree();

  const openAdd = (_parentType: NodeType, parentId: number, childType: NodeType) => {
    setError(null);
    setModal({ mode: 'add', type: childType as Exclude<NodeType, 'entreprise'>, parentId, nom: '', code: '' });
  };

  const openEdit = (node: HierarchyNode) => {
    setError(null);
    setModal({ mode: 'edit', type: node.type as Exclude<NodeType, 'entreprise'>, targetId: node.id, nom: node.nom, code: node.code });
  };

  const closeModal = () => { setModal(null); setError(null); };

  const submitModal = async () => {
    if (!modal) return;
    if (!modal.nom.trim() || !modal.code.trim()) { setError('Nom et code sont obligatoires'); return; }
    setSaving(true);
    setError(null);
    try {
      const endpoint = ENDPOINT[modal.type];
      if (modal.mode === 'add') {
        await api.post(`/hierarchy/${endpoint}`, {
          [PARENT_FIELD[modal.type]]: modal.parentId,
          nom: modal.nom.trim(),
          code: modal.code.trim(),
        });
      } else {
        await api.put(`/hierarchy/${endpoint}/${modal.targetId}`, { nom: modal.nom.trim(), code: modal.code.trim() });
      }
      closeModal();
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (node: HierarchyNode) => {
    if (node.type === 'entreprise') return;
    if (!confirm(`Archiver "${node.nom}" (${TYPE_LABELS[node.type]}) ? Cette action peut être annulée en réactivant l'entité.`)) return;
    try {
      await api.delete(`/hierarchy/${ENDPOINT[node.type as Exclude<NodeType, 'entreprise'>]}/${node.id}`);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors de l\'archivage');
    }
  };

  // Options pour le bouton global "Ajouter une entité"
  const succursaleOptions = entreprises.flatMap(e => (e.succursales || []).map((s: any) => ({ id: s.id, label: `${s.nom} (${e.nom})` })));
  const directionOptions = entreprises.flatMap(e => (e.succursales || []).flatMap((s: any) => (s.directions || []).map((d: any) => ({ id: d.id, label: `${d.nom} (${s.nom})` }))));

  const globalAddTypes: Array<{ type: Exclude<NodeType, 'entreprise'>; parents: Array<{ id: number; label: string }>; parentLabel: string }> = [
    { type: 'succursale', parents: entreprises.map(e => ({ id: e.id, label: e.nom })), parentLabel: 'Entreprise' },
    { type: 'sous_succursale', parents: succursaleOptions, parentLabel: 'Succursale' },
    { type: 'direction', parents: succursaleOptions, parentLabel: 'Succursale' },
    { type: 'service', parents: directionOptions, parentLabel: 'Direction' },
  ];

  const openGlobalAdd = () => {
    setError(null);
    const first = globalAddTypes.find(t => t.parents.length > 0) || globalAddTypes[0];
    setModal({ mode: 'add', type: first.type, parentId: first.parents[0]?.id, nom: '', code: '' });
  };

  const currentTypeConfig = modal ? globalAddTypes.find(t => t.type === modal.type) : undefined;

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
        <button className="btn btn-primary" onClick={openGlobalAdd}><Plus size={15} /> Ajouter une entité</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        {[{ key: 'structure', label: '🏢 Structure' }, { key: 'users', label: '👥 Utilisateurs' }].map(tab => (
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
                {(Object.keys(TYPE_LABELS) as NodeType[]).map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLORS[t] }} />
                    {TYPE_LABELS[t]}
                  </div>
                ))}
              </div>
              {tree.map(node => (
                <TreeNode key={node.id} node={node} onAddChild={openAdd} onEdit={openEdit} onDelete={handleDelete} />
              ))}
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

      {/* Modal Ajout / Édition */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                {modal.mode === 'add' ? `Ajouter — ${TYPE_LABELS[modal.type]}` : `Modifier — ${TYPE_LABELS[modal.type]}`}
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={closeModal}><X size={16} /></button>
            </div>

            {modal.mode === 'add' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Type d'entité</label>
                <select
                  className="select"
                  value={modal.type}
                  onChange={e => {
                    const t = e.target.value as Exclude<NodeType, 'entreprise'>;
                    const cfg = globalAddTypes.find(g => g.type === t)!;
                    setModal(m => m && { ...m, type: t, parentId: cfg.parents[0]?.id });
                  }}
                  style={{ width: '100%' }}
                >
                  {globalAddTypes.map(t => <option key={t.type} value={t.type}>{TYPE_LABELS[t.type]}</option>)}
                </select>
              </div>
            )}

            {modal.mode === 'add' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {currentTypeConfig?.parentLabel} parente
                </label>
                {currentTypeConfig && currentTypeConfig.parents.length > 0 ? (
                  <select
                    className="select"
                    value={modal.parentId}
                    onChange={e => setModal(m => m && { ...m, parentId: parseInt(e.target.value) })}
                    style={{ width: '100%' }}
                  >
                    {currentTypeConfig.parents.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--danger)' }}>
                    Aucune {currentTypeConfig?.parentLabel.toLowerCase()} disponible — créez-en une d'abord.
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Nom</label>
              <input className="input" value={modal.nom} onChange={e => setModal(m => m && { ...m, nom: e.target.value })} style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Code</label>
              <input className="input" value={modal.code} onChange={e => setModal(m => m && { ...m, code: e.target.value })} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
            </div>

            {error && <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={closeModal}>Annuler</button>
              <button
                className="btn btn-primary"
                onClick={submitModal}
                disabled={saving || (modal.mode === 'add' && !modal.parentId)}
              >
                <Save size={15} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
