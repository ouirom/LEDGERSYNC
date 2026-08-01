import { useEffect, useMemo, useState } from 'react';
import { Landmark, Plus, Save, X, Edit3, Trash2, Download, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../api/axios';
import { apiErrorMessage } from '../../utils/errors';
import { useDialog } from '../../contexts/DialogContext';
import type { Compte } from '../../types/api';

interface ReleveLigne {
  id: number;
  compte_bancaire_id: number;
  reference: string | null;
  libelle: string;
  montant: number;
  type: 'DEBIT' | 'CREDIT';
  date_operation: string;
  date_valeur: string | null;
  lettree: boolean;
  lettrage_ref: string | null;
  etat: string;
}

interface LigneFormState {
  targetId?: number;
  compte_bancaire_id: string;
  reference: string;
  libelle: string;
  montant: string;
  type: 'DEBIT' | 'CREDIT';
  date_operation: string;
  date_valeur: string;
}

const EMPTY_FORM: LigneFormState = { compte_bancaire_id: '', reference: '', libelle: '', montant: '', type: 'DEBIT', date_operation: '', date_valeur: '' };

const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 });

export default function RelevesPage() {
  const dialog = useDialog();
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [lignes, setLignes] = useState<ReleveLigne[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCompte, setFilterCompte] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<LigneFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 100;

  const load = () => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
    if (filterCompte) params['compte_bancaire_id'] = filterCompte;
    api.get('/releves', { params })
      // Prisma sérialise Decimal en chaîne côté JSON : on normalise en nombre ici,
      // une fois pour toutes, plutôt qu'à chaque usage (sommes, formatage).
      .then(r => { setLignes((r.data.data || []).map((l: ReleveLigne) => ({ ...l, montant: Number(l.montant) }))); setTotal(r.data.meta?.total || 0); })
      .catch(() => { setLignes([]); setTotal(0); }).finally(() => setLoading(false));
  };

  useEffect(() => { api.get('/comptes').then(r => setComptes(r.data.data || [])); }, []);
  useEffect(() => { setPage(1); }, [filterCompte]);
  useEffect(load, [filterCompte, page]);
  useEffect(() => { setSelected(new Set()); }, [lignes]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const compteLabel = (id: number) => {
    const c = comptes.find(c => c.id === id);
    return c ? `${c.intitule}${c.banque ? ` (${c.banque.nom})` : ''}` : '—';
  };

  const toggleSelect = (id: number) => {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    setSelected(s => s.size === lignes.length ? new Set() : new Set(lignes.map(l => l.id)));
  };

  const openAdd = () => { setModalError(null); setModal({ ...EMPTY_FORM, compte_bancaire_id: filterCompte }); };
  const openEdit = (l: ReleveLigne) => {
    setModalError(null);
    setModal({
      targetId: l.id,
      compte_bancaire_id: String(l.compte_bancaire_id),
      reference: l.reference || '', libelle: l.libelle, montant: String(l.montant), type: l.type,
      date_operation: l.date_operation.slice(0, 10), date_valeur: l.date_valeur ? l.date_valeur.slice(0, 10) : '',
    });
  };
  const closeModal = () => { setModal(null); setModalError(null); };

  const submitModal = async () => {
    if (!modal) return;
    if (!modal.compte_bancaire_id || !modal.libelle.trim() || !modal.montant || !modal.date_operation) {
      setModalError('Compte, libellé, montant et date sont obligatoires'); return;
    }
    setSaving(true); setModalError(null);
    try {
      const payload = {
        compte_bancaire_id: parseInt(modal.compte_bancaire_id),
        reference: modal.reference.trim() || undefined,
        libelle: modal.libelle.trim(),
        montant: parseFloat(modal.montant),
        type: modal.type,
        date_operation: modal.date_operation,
        date_valeur: modal.date_valeur || undefined,
      };
      if (modal.targetId) {
        await api.put(`/releves/${modal.targetId}`, payload);
      } else {
        await api.post('/releves', payload);
      }
      closeModal();
      load();
      setBanner({ type: 'success', text: modal.targetId ? 'Ligne modifiée' : 'Ligne ajoutée' });
    } catch (err) {
      setModalError(apiErrorMessage(err, 'Erreur lors de l\'enregistrement'));
    } finally { setSaving(false); }
  };

  const deleteOne = async (l: ReleveLigne): Promise<{ ok: boolean; reason?: string }> => {
    if (l.lettree) return { ok: false, reason: 'lettrée — délettrez-la depuis l\'espace de rapprochement' };
    try { await api.delete(`/releves/${l.id}`); return { ok: true }; }
    catch (err) { return { ok: false, reason: apiErrorMessage(err, 'erreur') }; }
  };

  const handleDeleteOne = async (l: ReleveLigne) => {
    if (!(await dialog.confirm(`Supprimer la ligne "${l.libelle}" ?`, { tone: 'danger', confirmLabel: 'Supprimer' }))) return;
    const r = await deleteOne(l);
    if (r.ok) { load(); setBanner({ type: 'success', text: 'Ligne supprimée' }); }
    else setBanner({ type: 'error', text: `Action impossible : ${r.reason}` });
  };

  const handleDeleteSelection = async () => {
    if (selected.size === 0) return;
    if (!(await dialog.confirm(`Supprimer les ${selected.size} ligne(s) sélectionnée(s) ?`, { tone: 'danger', confirmLabel: 'Supprimer' }))) return;
    setBulkWorking(true);
    let done = 0, skipped = 0;
    for (const id of selected) {
      const l = lignes.find(x => x.id === id);
      if (!l) continue;
      const r = await deleteOne(l);
      if (r.ok) done++; else skipped++;
    }
    setBulkWorking(false);
    setSelected(new Set());
    load();
    setBanner({ type: done > 0 ? 'success' : 'error', text: `${done} supprimée(s), ${skipped} ignorée(s) (déjà lettrées)` });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      if (filterCompte) params['compte_bancaire_id'] = filterCompte;
      const res = await api.get('/releves/export', { params, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'releve.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setBanner({ type: 'error', text: apiErrorMessage(err, 'Erreur lors de l\'export') });
    } finally { setExporting(false); }
  };

  const totaux = useMemo(() => ({
    debit: lignes.filter(l => l.type === 'DEBIT').reduce((s, l) => s + l.montant, 0),
    credit: lignes.filter(l => l.type === 'CREDIT').reduce((s, l) => s + l.montant, 0),
  }), [lignes]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Landmark size={22} color="var(--primary)" /> Relevés Bancaires
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Ajout, modification, suppression et export des lignes de relevé bancaire.
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={handleExport} disabled={exporting}>
          <Download size={15} /> {exporting ? 'Export...' : 'Exporter'}
        </button>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={15} /> Ajouter</button>
      </div>

      {banner && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 16, borderRadius: 8, fontSize: 13, background: banner.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${banner.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: banner.type === 'success' ? '#10b981' : '#ef4444' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} /> {banner.text}
          <button className="btn btn-ghost btn-sm btn-icon" style={{ marginLeft: 'auto' }} onClick={() => setBanner(null)}><X size={14} /></button>
        </div>
      )}

      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Compte</label>
          <select className="select" value={filterCompte} onChange={e => setFilterCompte(e.target.value)} style={{ minWidth: 220 }}>
            <option value="">Tous les comptes</option>
            {comptes.map(c => <option key={c.id} value={c.id}>{c.intitule}{c.banque ? ` (${c.banque.nom})` : ''}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
          <div><span style={{ color: 'var(--text-muted)' }}>Débit (page)</span> <strong style={{ color: '#ef4444' }}>{fmt(totaux.debit)}</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Crédit (page)</span> <strong style={{ color: '#10b981' }}>{fmt(totaux.credit)}</strong></div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="card" style={{ padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg)' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.size} sélectionnée(s)</span>
          <button className="btn btn-danger btn-sm" onClick={handleDeleteSelection} disabled={bulkWorking}>
            <Trash2 size={13} /> {bulkWorking ? 'Suppression...' : 'Supprimer la sélection'}
          </button>
        </div>
      )}

      <div className="card table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: 32 }}><input type="checkbox" checked={lignes.length > 0 && selected.size === lignes.length} onChange={toggleSelectAll} /></th>
              <th>Date</th>
              <th>Référence</th>
              <th>Libellé</th>
              <th>Compte</th>
              <th style={{ textAlign: 'right' }}>Débit</th>
              <th style={{ textAlign: 'right' }}>Crédit</th>
              <th>Lettrage</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Chargement...</td></tr>
            ) : lignes.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Aucune ligne trouvée</td></tr>
            ) : lignes.map(l => (
              <tr key={l.id}>
                <td><input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)} /></td>
                <td style={{ fontSize: 12 }}>{new Date(l.date_operation).toLocaleDateString('fr-FR')}</td>
                <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{l.reference || '—'}</td>
                <td style={{ fontSize: 13 }}>{l.libelle}</td>
                <td style={{ fontSize: 12 }}>{compteLabel(l.compte_bancaire_id)}</td>
                <td style={{ textAlign: 'right', fontSize: 13, color: '#ef4444' }}>{l.type === 'DEBIT' ? fmt(l.montant) : ''}</td>
                <td style={{ textAlign: 'right', fontSize: 13, color: '#10b981' }}>{l.type === 'CREDIT' ? fmt(l.montant) : ''}</td>
                <td>{l.lettree ? <span className="badge badge-info" style={{ fontSize: 10 }}>{l.lettrage_ref}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}</td>
                <td>
                  {!l.lettree && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm btn-icon" title="Modifier" onClick={() => openEdit(l)}><Edit3 size={13} /></button>
                      <button className="btn btn-danger btn-sm btn-icon" title="Supprimer" onClick={() => handleDeleteOne(l)}><Trash2 size={13} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
          <span>{total} ligne(s) — page {page} / {totalPages}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm btn-icon" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft size={14} /></button>
            <button className="btn btn-ghost btn-sm btn-icon" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}><ChevronRight size={14} /></button>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{modal.targetId ? 'Modifier la ligne' : 'Ajouter une ligne'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={closeModal}><X size={16} /></button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Compte bancaire</label>
              <select className="select" style={{ width: '100%' }} value={modal.compte_bancaire_id} onChange={e => setModal(m => m && { ...m, compte_bancaire_id: e.target.value })}>
                <option value="">— Sélectionner —</option>
                {comptes.map(c => <option key={c.id} value={c.id}>{c.intitule}{c.banque ? ` (${c.banque.nom})` : ''}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Référence</label>
              <input className="input" style={{ width: '100%' }} value={modal.reference} onChange={e => setModal(m => m && { ...m, reference: e.target.value })} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Libellé</label>
              <input className="input" style={{ width: '100%' }} value={modal.libelle} onChange={e => setModal(m => m && { ...m, libelle: e.target.value })} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Montant</label>
                <input className="input" type="number" step="0.01" style={{ width: '100%' }} value={modal.montant} onChange={e => setModal(m => m && { ...m, montant: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type</label>
                <select className="select" style={{ width: '100%' }} value={modal.type} onChange={e => setModal(m => m && { ...m, type: e.target.value as 'DEBIT' | 'CREDIT' })}>
                  <option value="DEBIT">Débit</option>
                  <option value="CREDIT">Crédit</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date opération</label>
                <input className="input" type="date" style={{ width: '100%' }} value={modal.date_operation} onChange={e => setModal(m => m && { ...m, date_operation: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date valeur</label>
                <input className="input" type="date" style={{ width: '100%' }} value={modal.date_valeur} onChange={e => setModal(m => m && { ...m, date_valeur: e.target.value })} />
              </div>
            </div>

            {modalError && <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--danger)' }}>{modalError}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={closeModal}>Annuler</button>
              <button className="btn btn-primary" onClick={submitModal} disabled={saving}>
                <Save size={15} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
