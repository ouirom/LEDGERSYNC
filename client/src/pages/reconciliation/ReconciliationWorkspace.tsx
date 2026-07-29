import { useEffect, useState, useCallback, useRef } from 'react';
import { Check, X, Zap, AlertCircle, RefreshCw, Columns } from 'lucide-react';
import api from '../../api/axios';

interface Ecriture { id: number; reference: string; libelle: string; montant: number; type: string; date_ecriture: string; lettree: boolean; lettrage_ref: string | null; }
interface Releve { id: number; reference: string | null; libelle: string; montant: number; type: string; date_operation: string; lettree: boolean; lettrage_ref: string | null; }

const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 });

export default function ReconciliationWorkspace() {
  const [comptes, setComptes] = useState<any[]>([]);
  const [selectedCompte, setSelectedCompte] = useState('');
  const [mois, setMois] = useState(String(new Date().getMonth() + 1));
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [ecritures, setEcritures] = useState<Ecriture[]>([]);
  const [releves, setReleves] = useState<Releve[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedE, setSelectedE] = useState<Set<number>>(new Set());
  const [selectedR, setSelectedR] = useState<Set<number>>(new Set());
  const [hoverRef, setHoverRef] = useState<string | null>(null);
  const [splitRatio, setSplitRatio] = useState(50);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    api.get('/comptes').then(r => setComptes(r.data.data || []));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (selectedE.size > 0 || selectedR.size > 0)) { e.preventDefault(); handleLettrage(); }
      if (e.code === 'Escape') { setSelectedE(new Set()); setSelectedR(new Set()); }
      if (e.ctrlKey && e.code === 'KeyA') { e.preventDefault(); setSelectedE(new Set(ecritures.filter(e => !e.lettree).map(e => e.id))); setSelectedR(new Set(releves.filter(r => !r.lettree).map(r => r.id))); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedE, selectedR, ecritures, releves]);

  const loadWorkspace = useCallback(async () => {
    if (!selectedCompte) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/reconciliation/workspace?compte_bancaire_id=${selectedCompte}&mois=${mois}&annee=${annee}`);
      setEcritures(data.data.ecritures || []);
      setReleves(data.data.releves || []);
      setSelectedE(new Set());
      setSelectedR(new Set());
      setSuggestions([]);
    } catch { setMsg({ type: 'error', text: 'Erreur lors du chargement' }); }
    finally { setLoading(false); }
  }, [selectedCompte, mois, annee]);

  const handleLettrage = async () => {
    if (selectedE.size === 0 && selectedR.size === 0) return;
    try {
      await api.post('/reconciliation/lettrage', {
        ecriture_ids: [...selectedE],
        releve_ids: [...selectedR],
        entreprise_id: comptes.find(c => String(c.id) === selectedCompte)?.entreprise_id || 1,
        compte_bancaire_id: parseInt(selectedCompte),
        periode_mois: parseInt(mois),
        periode_annee: parseInt(annee),
      });
      setMsg({ type: 'success', text: `Lettrage effectué : ${selectedE.size} écritures ↔ ${selectedR.size} lignes relevé` });
      setSelectedE(new Set()); setSelectedR(new Set());
      loadWorkspace();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Erreur lors du lettrage' });
    }
    setTimeout(() => setMsg(null), 4000);
  };

  const handleAutoMatch = async () => {
    try {
      const { data } = await api.post('/reconciliation/auto-match', {
        compte_bancaire_id: parseInt(selectedCompte),
        periode_mois: parseInt(mois),
        periode_annee: parseInt(annee),
      });
      setSuggestions(data.data.suggestions || []);
      setMsg({ type: 'success', text: `${data.data.suggestions.length} correspondances trouvées` });
    } catch { setMsg({ type: 'error', text: 'Erreur lors du matching automatique' }); }
    setTimeout(() => setMsg(null), 4000);
  };

  // Resizable divider
  const onMouseDown = () => { isDragging.current = true; };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = Math.max(25, Math.min(75, ((e.clientX - rect.left) / rect.width) * 100));
      setSplitRatio(ratio);
    };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const isSuggested = (eid: number, type: 'e' | 'r') => {
    if (type === 'e') return suggestions.some(s => s.ecriture_id === eid);
    return suggestions.some(s => s.releve_id === eid);
  };

  // Bilateral hover matching: highlight all rows sharing the same lettrage_ref
  const isHoverMatched = (ref: string | null) => ref != null && ref === hoverRef;

  const toggleE = (id: number) => setSelectedE(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleR = (id: number) => setSelectedR(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 90px)' }}>
      {/* ── Toolbar ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Espace de Rapprochement</h1>
        <div style={{ flex: 1 }} />

        <select className="select" style={{ width: 220 }} value={selectedCompte} onChange={e => setSelectedCompte(e.target.value)}>
          <option value="">— Sélectionner un compte —</option>
          {comptes.map((c: any) => <option key={c.id} value={c.id}>{c.intitule}</option>)}
        </select>
        <select className="select" style={{ width: 80 }} value={mois} onChange={e => setMois(e.target.value)}>
          {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, '0')}</option>)}
        </select>
        <select className="select" style={{ width: 90 }} value={annee} onChange={e => setAnnee(e.target.value)}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="btn btn-primary" onClick={loadWorkspace} disabled={!selectedCompte || loading}>
          <RefreshCw size={15} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} /> Charger
        </button>
        <button className="btn btn-ghost" onClick={handleAutoMatch} disabled={!selectedCompte || ecritures.length === 0} title="Matching automatique">
          <Zap size={15} /> Auto-Match
        </button>
      </div>

      {/* Sélection summary */}
      {(selectedE.size > 0 || selectedR.size > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'var(--primary)12', border: '1px solid var(--primary)30', borderRadius: 8, marginBottom: 8, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>{selectedE.size} écriture(s) + {selectedR.size} ligne(s) relevé sélectionnées</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-accent btn-sm" onClick={handleLettrage}><Check size={14} /> Lettrer (Espace)</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedE(new Set()); setSelectedR(new Set()); }}><X size={14} /> Effacer (Échap)</button>
        </div>
      )}

      {/* Message */}
      {msg && (
        <div style={{ padding: '8px 14px', borderRadius: 8, marginBottom: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, background: msg.type === 'success' ? '#d1fae5' : '#fee2e2', color: msg.type === 'success' ? '#065f46' : '#991b1b', border: `1px solid ${msg.type === 'success' ? '#6ee7b7' : '#fca5a5'}` }}>
          {msg.type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />} {msg.text}
        </div>
      )}

      {/* ── Split Panel ──────────────────────────────────── */}
      <div ref={containerRef} style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        {/* Écritures Comptables */}
        <div style={{ width: `${splitRatio}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="panel-header" style={{ borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)' }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Écritures Comptables</span>
            <span className="badge badge-info" style={{ marginLeft: 'auto' }}>{ecritures.filter(e => !e.lettree).length} non lettrées</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}><input type="checkbox" onChange={e => e.target.checked ? setSelectedE(new Set(ecritures.filter(e => !e.lettree).map(e => e.id))) : setSelectedE(new Set())} /></th>
                  <th>Référence</th>
                  <th>Libellé</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {ecritures.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    {loading ? 'Chargement...' : 'Sélectionnez un compte et une période'}
                  </td></tr>
                ) : ecritures.map(e => (
                  <tr
                    key={e.id}
                    className={`matching-row ${selectedE.has(e.id) ? 'selected' : ''} ${e.lettree ? 'matched' : ''} ${isSuggested(e.id, 'e') ? 'highlighted' : ''} ${isHoverMatched(e.lettrage_ref) ? 'hover-match' : ''}`}
                    onClick={() => !e.lettree && toggleE(e.id)}
                    style={{ cursor: e.lettree ? 'default' : 'pointer' }}
                    onMouseEnter={() => e.lettrage_ref && setHoverRef(e.lettrage_ref)}
                    onMouseLeave={() => setHoverRef(null)}
                  >
                    <td onClick={ev => ev.stopPropagation()}>
                      {!e.lettree && <input type="checkbox" checked={selectedE.has(e.id)} onChange={() => toggleE(e.id)} />}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{e.reference}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.libelle}>{e.libelle}</td>
                    <td style={{ fontSize: 12 }}>{new Date(e.date_ecriture).toLocaleDateString('fr-FR')}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: e.type === 'CREDIT' ? 'var(--success)' : 'var(--danger)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      {e.type === 'DEBIT' ? '-' : '+'}{fmt(e.montant)}
                    </td>
                    <td>{e.lettree ? <span className="badge badge-success">Lettré</span> : isSuggested(e.id, 'e') ? <span className="badge badge-warning">Suggéré</span> : <span className="badge badge-gray">En attente</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Divider */}
        <div className="split-divider" onMouseDown={onMouseDown} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'col-resize' }}>
          <Columns size={14} color="var(--text-muted)" />
        </div>

        {/* Relevé Bancaire */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="panel-header" style={{ borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)' }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Relevé Bancaire</span>
            <span className="badge badge-accent" style={{ marginLeft: 'auto' }}>{releves.filter(r => !r.lettree).length} non lettrées</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}><input type="checkbox" onChange={e => e.target.checked ? setSelectedR(new Set(releves.filter(r => !r.lettree).map(r => r.id))) : setSelectedR(new Set())} /></th>
                  <th>Référence</th>
                  <th>Libellé</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {releves.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    {loading ? 'Chargement...' : 'Aucune ligne de relevé'}
                  </td></tr>
                ) : releves.map(r => (
                  <tr
                    key={r.id}
                    className={`matching-row ${selectedR.has(r.id) ? 'selected' : ''} ${r.lettree ? 'matched' : ''} ${isSuggested(r.id, 'r') ? 'highlighted' : ''} ${isHoverMatched(r.lettrage_ref) ? 'hover-match' : ''}`}
                    onClick={() => !r.lettree && toggleR(r.id)}
                    style={{ cursor: r.lettree ? 'default' : 'pointer' }}
                    onMouseEnter={() => r.lettrage_ref && setHoverRef(r.lettrage_ref)}
                    onMouseLeave={() => setHoverRef(null)}
                  >
                    <td onClick={ev => ev.stopPropagation()}>
                      {!r.lettree && <input type="checkbox" checked={selectedR.has(r.id)} onChange={() => toggleR(r.id)} />}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.reference || '—'}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.libelle}>{r.libelle}</td>
                    <td style={{ fontSize: 12 }}>{new Date(r.date_operation).toLocaleDateString('fr-FR')}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: r.type === 'CREDIT' ? 'var(--success)' : 'var(--danger)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      {r.type === 'DEBIT' ? '-' : '+'}{fmt(r.montant)}
                    </td>
                    <td>{r.lettree ? <span className="badge badge-success">Lettré</span> : isSuggested(r.id, 'r') ? <span className="badge badge-warning">Suggéré</span> : <span className="badge badge-gray">En attente</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Help bar */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
        {[['Espace', 'Lettrer'], ['Échap', 'Désélectionner'], ['Ctrl+A', 'Tout sélectionner'], ['Zap', 'Auto-Match']].map(([k, v]) => (
          <span key={k} className="stat-pill"><kbd style={{ fontFamily: 'var(--font-mono)', background: 'var(--border)', padding: '1px 5px', borderRadius: 3 }}>{k}</kbd>{v}</span>
        ))}
      </div>
    </div>
  );
}
