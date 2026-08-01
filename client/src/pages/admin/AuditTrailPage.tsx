import { Fragment, useEffect, useState } from 'react';
import { Search, Download, RefreshCw, ChevronDown, ChevronRight, ClipboardList, LogIn } from 'lucide-react';
import api from '../../api/axios';
import type { AuditLog, LogConnexion } from '../../types/api';
import { useDialog } from '../../contexts/DialogContext';

type Tab = 'traitement' | 'connexions';

export default function AuditTrailPage() {
  const dialog = useDialog();
  const [tab, setTab] = useState<Tab>('traitement');

  // ── Journal de traitement (piste d'audit CRUD) ─────────────
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState({ entite: '', action: '', date_debut: '', date_fin: '' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50', ...Object.fromEntries(Object.entries(search).filter(([, v]) => v)) });
    try {
      const { data } = await api.get(`/audit?${params}`);
      setLogs(data.data || []);
      setTotal(data.meta?.total || 0);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (tab === 'traitement') load(); }, [page, tab]);

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams(Object.fromEntries(Object.entries(search).filter(([, v]) => v)));
      const response = await api.get(`/reports/audit-export?${params}`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_trail_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      await dialog.alert('Erreur lors de l\'export CSV', { tone: 'danger' });
    }
  };

  const ACTION_COLORS: Record<string, string> = { CREATE: '#10b981', UPDATE: '#3b82f6', DELETE: '#ef4444', LOGIN: '#8b5cf6', LETTRAGE: '#f59e0b' };

  // ── Journal de connexion (login history) ───────────────────
  const [cnxLogs, setCnxLogs] = useState<LogConnexion[]>([]);
  const [cnxLoading, setCnxLoading] = useState(false);
  const [cnxSearch, setCnxSearch] = useState({ succes: '', date_debut: '', date_fin: '' });
  const [cnxPage, setCnxPage] = useState(1);
  const [cnxTotal, setCnxTotal] = useState(0);

  const loadConnexions = async () => {
    setCnxLoading(true);
    const params = new URLSearchParams({ page: String(cnxPage), limit: '50', ...Object.fromEntries(Object.entries(cnxSearch).filter(([, v]) => v)) });
    try {
      const { data } = await api.get(`/audit/connexions?${params}`);
      setCnxLogs(data.data || []);
      setCnxTotal(data.meta?.total || 0);
    } finally { setCnxLoading(false); }
  };

  useEffect(() => { if (tab === 'connexions') loadConnexions(); }, [cnxPage, tab]);

  const exportConnexionsCSV = async () => {
    try {
      const params = new URLSearchParams(Object.fromEntries(Object.entries(cnxSearch).filter(([, v]) => v)));
      const response = await api.get(`/reports/connexions-export?${params}`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `journal_connexions_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      await dialog.alert('Erreur lors de l\'export CSV', { tone: 'danger' });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Piste d'Audit</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Journal inviolable des opérations et des connexions</p>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={tab === 'traitement' ? exportCSV : exportConnexionsCSV}><Download size={15} /> Exporter CSV</button>
        <button className="btn btn-ghost" onClick={tab === 'traitement' ? load : loadConnexions}><RefreshCw size={15} style={{ animation: (loading || cnxLoading) ? 'spin 0.8s linear infinite' : 'none' }} /></button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => setTab('traitement')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 4px', marginBottom: -1, background: 'none', border: 'none', borderBottom: tab === 'traitement' ? '2px solid var(--primary)' : '2px solid transparent', color: tab === 'traitement' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          <ClipboardList size={15} /> Traitement <span style={{ fontSize: 11, opacity: 0.7 }}>({total.toLocaleString()})</span>
        </button>
        <button
          onClick={() => setTab('connexions')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 4px', marginBottom: -1, marginLeft: 16, background: 'none', border: 'none', borderBottom: tab === 'connexions' ? '2px solid var(--primary)' : '2px solid transparent', color: tab === 'connexions' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          <LogIn size={15} /> Connexions <span style={{ fontSize: 11, opacity: 0.7 }}>({cnxTotal.toLocaleString()})</span>
        </button>
      </div>

      {tab === 'traitement' ? (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="input" placeholder="Entité..." style={{ paddingLeft: 32, width: 150 }} value={search.entite} onChange={e => setSearch(s => ({ ...s, entite: e.target.value }))} />
            </div>
            <input className="input" placeholder="Action..." style={{ width: 130 }} value={search.action} onChange={e => setSearch(s => ({ ...s, action: e.target.value }))} />
            <input className="input" type="date" style={{ width: 150 }} value={search.date_debut} onChange={e => setSearch(s => ({ ...s, date_debut: e.target.value }))} />
            <input className="input" type="date" style={{ width: 150 }} value={search.date_fin} onChange={e => setSearch(s => ({ ...s, date_fin: e.target.value }))} />
            <button className="btn btn-primary" onClick={() => { setPage(1); load(); }}><Search size={14} /> Filtrer</button>
          </div>

          <div className="card">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 24 }}></th>
                  <th>ID</th>
                  <th>Entité</th>
                  <th>Action</th>
                  <th>Entité ID</th>
                  <th>User ID</th>
                  <th>IP</th>
                  <th>Motif</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    {loading ? 'Chargement...' : 'Aucune entrée d\'audit'}
                  </td></tr>
                ) : logs.map(l => {
                  const hasDiff = l.avant || l.apres;
                  const expanded = expandedId === l.id;
                  return (
                    <Fragment key={l.id}>
                      <tr style={{ cursor: hasDiff ? 'pointer' : 'default' }} onClick={() => hasDiff && setExpandedId(expanded ? null : l.id)}>
                        <td>{hasDiff && (expanded ? <ChevronDown size={13} color="var(--text-muted)" /> : <ChevronRight size={13} color="var(--text-muted)" />)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>#{l.id}</td>
                        <td><code style={{ fontSize: 11, background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>{l.entite}</code></td>
                        <td>
                          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: `${ACTION_COLORS[l.action] || '#6b7280'}18`, color: ACTION_COLORS[l.action] || '#6b7280' }}>
                            {l.action}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{l.entite_id || '—'}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{l.utilisateur_id || '—'}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{l.ip_address || '—'}</td>
                        <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }} title={l.motif}>{l.motif || '—'}</td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString('fr-FR')}</td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={9} style={{ background: 'var(--bg)', padding: '12px 16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: l.avant && l.apres ? '1fr 1fr' : '1fr', gap: 12 }}>
                              {l.avant && (
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Avant</div>
                                  <pre style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: 10, overflow: 'auto', maxHeight: 240, margin: 0 }}>{JSON.stringify(l.avant, null, 2)}</pre>
                                </div>
                              )}
                              {l.apres && (
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Après</div>
                                  <pre style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: 10, overflow: 'auto', maxHeight: 240, margin: 0 }}>{JSON.stringify(l.apres, null, 2)}</pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {total > 50 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--border)', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {page} — {Math.ceil(total / 50)} pages — {total} entrées</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Précédent</button>
                  <button className="btn btn-ghost btn-sm" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(p => p + 1)}>Suivant →</button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <select className="input" style={{ width: 150 }} value={cnxSearch.succes} onChange={e => setCnxSearch(s => ({ ...s, succes: e.target.value }))}>
              <option value="">Tous les statuts</option>
              <option value="true">Succès</option>
              <option value="false">Échec</option>
            </select>
            <input className="input" type="date" style={{ width: 150 }} value={cnxSearch.date_debut} onChange={e => setCnxSearch(s => ({ ...s, date_debut: e.target.value }))} />
            <input className="input" type="date" style={{ width: 150 }} value={cnxSearch.date_fin} onChange={e => setCnxSearch(s => ({ ...s, date_fin: e.target.value }))} />
            <button className="btn btn-primary" onClick={() => { setCnxPage(1); loadConnexions(); }}><Search size={14} /> Filtrer</button>
          </div>

          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Email</th>
                  <th>Statut</th>
                  <th>Motif</th>
                  <th>IP</th>
                  <th>Navigateur</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {cnxLogs.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    {cnxLoading ? 'Chargement...' : 'Aucune connexion enregistrée'}
                  </td></tr>
                ) : cnxLogs.map(l => (
                  <tr key={l.id}>
                    <td>{l.utilisateur.prenom} {l.utilisateur.nom}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.utilisateur.email}</td>
                    <td>
                      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: l.succes ? '#10b98118' : '#ef444418', color: l.succes ? '#10b981' : '#ef4444' }}>
                        {l.succes ? 'Succès' : 'Échec'}
                      </span>
                    </td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }} title={l.motif_echec || undefined}>{l.motif_echec || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{l.ip_address || '—'}</td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text-muted)' }} title={l.user_agent || undefined}>{l.user_agent || '—'}</td>
                    <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {cnxTotal > 50 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--border)', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {cnxPage} — {Math.ceil(cnxTotal / 50)} pages — {cnxTotal} entrées</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" disabled={cnxPage === 1} onClick={() => setCnxPage(p => p - 1)}>← Précédent</button>
                  <button className="btn btn-ghost btn-sm" disabled={cnxPage >= Math.ceil(cnxTotal / 50)} onClick={() => setCnxPage(p => p + 1)}>Suivant →</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
