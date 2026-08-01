import { useEffect, useMemo, useState } from 'react';
import { BookText, Plus, Save, X, Edit3, Trash2, Undo2, Download, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../api/axios';
import { apiErrorMessage } from '../../utils/errors';
import type { Compte } from '../../types/api';

interface Ecriture {
  id: number;
  compte_bancaire_id: number | null;
  reference: string;
  libelle: string;
  montant: number;
  type: 'DEBIT' | 'CREDIT';
  date_ecriture: string;
  date_valeur: string | null;
  piece_ref: string | null;
  lettree: boolean;
  lettrage_ref: string | null;
  etat: string;
}

interface EcritureFormState {
  targetId?: number;
  compte_bancaire_id: string;
  reference: string;
  libelle: string;
  montant: string;
  type: 'DEBIT' | 'CREDIT';
  date_ecriture: string;
  date_valeur: string;
  piece_ref: string;
}

const EMPTY_FORM: EcritureFormState = { compte_bancaire_id: '', reference: '', libelle: '', montant: '', type: 'DEBIT', date_ecriture: '', date_valeur: '', piece_ref: '' };

const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 });
const MOIS_LABELS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const ETAT_BADGE: Record<string, string> = { BROUILLON: 'badge-gray', VALIDE: 'badge-success', ANNULE: 'badge-danger' };

export default function EcrituresPage() {
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [ecritures, setEcritures] = useState<Ecriture[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCompte, setFilterCompte] = useState('');
  const [filterMois, setFilterMois] = useState('');
  const [filterAnnee, setFilterAnnee] = useState(String(new Date().getFullYear()));
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<EcritureFormState | null>(null);
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
    if (filterMois) params['mois'] = filterMois;
    if (filterAnnee) params['annee'] = filterAnnee;
    api.get('/ecritures', { params })
      // Prisma sérialise Decimal en chaîne côté JSON : on normalise en nombre ici,
      // une fois pour toutes, plutôt qu'à chaque usage (sommes, formatage).
      .then(r => { setEcritures((r.data.data || []).map((e: Ecriture) => ({ ...e, montant: Number(e.montant) }))); setTotal(r.data.meta?.total || 0); })
      .catch(() => { setEcritures([]); setTotal(0); }).finally(() => setLoading(false));
  };

  useEffect(() => { api.get('/comptes').then(r => setComptes(r.data.data || [])); }, []);
  useEffect(() => { setPage(1); }, [filterCompte, filterMois, filterAnnee]);
  useEffect(load, [filterCompte, filterMois, filterAnnee, page]);
  useEffect(() => { setSelected(new Set()); }, [ecritures]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const compteLabel = (id: number | null) => {
    const c = comptes.find(c => c.id === id);
    return c ? `${c.intitule}${c.banque ? ` (${c.banque.nom})` : ''}` : '—';
  };

  const toggleSelect = (id: number) => {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    setSelected(s => s.size === ecritures.length ? new Set() : new Set(ecritures.map(e => e.id)));
  };

  const openAdd = () => { setModalError(null); setModal({ ...EMPTY_FORM, compte_bancaire_id: filterCompte }); };
  const openEdit = (e: Ecriture) => {
    setModalError(null);
    setModal({
      targetId: e.id,
      compte_bancaire_id: e.compte_bancaire_id ? String(e.compte_bancaire_id) : '',
      reference: e.reference, libelle: e.libelle, montant: String(e.montant), type: e.type,
      date_ecriture: e.date_ecriture.slice(0, 10), date_valeur: e.date_valeur ? e.date_valeur.slice(0, 10) : '',
      piece_ref: e.piece_ref || '',
    });
  };
  const closeModal = () => { setModal(null); setModalError(null); };

  const submitModal = async () => {
    if (!modal) return;
    if (!modal.compte_bancaire_id || !modal.libelle.trim() || !modal.montant || !modal.date_ecriture) {
      setModalError('Compte, libellé, montant et date sont obligatoires'); return;
    }
    const compte = comptes.find(c => String(c.id) === modal.compte_bancaire_id);
    const d = new Date(modal.date_ecriture);
    setSaving(true); setModalError(null);
    try {
      const payload = {
        entreprise_id: compte?.entreprise_id,
        compte_bancaire_id: parseInt(modal.compte_bancaire_id),
        reference: modal.reference.trim() || `ECR-${Date.now()}`,
        libelle: modal.libelle.trim(),
        montant: parseFloat(modal.montant),
        type: modal.type,
        date_ecriture: modal.date_ecriture,
        date_valeur: modal.date_valeur || undefined,
        piece_ref: modal.piece_ref.trim() || undefined,
        periode_mois: d.getMonth() + 1,
        periode_annee: d.getFullYear(),
      };
      if (modal.targetId) {
        await api.put(`/ecritures/${modal.targetId}`, payload);
      } else {
        await api.post('/ecritures', payload);
      }
      closeModal();
      load();
      setBanner({ type: 'success', text: modal.targetId ? 'Écriture modifiée' : 'Écriture ajoutée' });
    } catch (err) {
      setModalError(apiErrorMessage(err, 'Erreur lors de l\'enregistrement'));
    } finally { setSaving(false); }
  };

  // Supprime une écriture BROUILLON, ou l'extourne si elle est VALIDE (préserve
  // la piste d'audit — voir server/src/modules/entries/ecriture.routes.ts).
  const deleteOne = async (e: Ecriture): Promise<{ ok: boolean; reason?: string }> => {
    if (e.lettree) return { ok: false, reason: 'lettrée' };
    if (e.etat === 'BROUILLON') {
      try { await api.delete(`/ecritures/${e.id}`); return { ok: true }; }
      catch (err) { return { ok: false, reason: apiErrorMessage(err, 'erreur') }; }
    }
    if (e.etat === 'VALIDE') {
      const motif = prompt(`Motif d'extourne pour "${e.reference}" (min. 5 caractères) :`);
      if (!motif || motif.trim().length < 5) return { ok: false, reason: 'extourne annulée' };
      try { await api.post(`/ecritures/${e.id}/extourne`, { motif }); return { ok: true }; }
      catch (err) { return { ok: false, reason: apiErrorMessage(err, 'erreur') }; }
    }
    return { ok: false, reason: 'déjà annulée' };
  };

  const handleDeleteOne = async (e: Ecriture) => {
    const label = e.etat === 'VALIDE' ? `Extourner l'écriture "${e.reference}" ?` : `Supprimer l'écriture "${e.reference}" ?`;
    if (!confirm(label)) return;
    const r = await deleteOne(e);
    if (r.ok) { load(); setBanner({ type: 'success', text: e.etat === 'VALIDE' ? 'Écriture extournée' : 'Écriture supprimée' }); }
    else if (r.reason !== 'extourne annulée') setBanner({ type: 'error', text: `Action impossible : ${r.reason}` });
  };

  const handleDeleteSelection = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Traiter les ${selected.size} écriture(s) sélectionnée(s) (suppression ou extourne selon leur état) ?`)) return;
    setBulkWorking(true);
    let done = 0, skipped = 0;
    for (const id of selected) {
      const e = ecritures.find(x => x.id === id);
      if (!e) continue;
      const r = await deleteOne(e);
      if (r.ok) done++; else skipped++;
    }
    setBulkWorking(false);
    setSelected(new Set());
    load();
    setBanner({ type: done > 0 ? 'success' : 'error', text: `${done} traitée(s), ${skipped} ignorée(s) (lettrées, annulées ou annulation refusée)` });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      if (filterCompte) params['compte_bancaire_id'] = filterCompte;
      if (filterMois) params['mois'] = filterMois;
      if (filterAnnee) params['annee'] = filterAnnee;
      const res = await api.get('/ecritures/export', { params, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'ecritures.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setBanner({ type: 'error', text: apiErrorMessage(err, 'Erreur lors de l\'export') });
    } finally { setExporting(false); }
  };

  const totaux = useMemo(() => ({
    debit: ecritures.filter(e => e.type === 'DEBIT').reduce((s, e) => s + e.montant, 0),
    credit: ecritures.filter(e => e.type === 'CREDIT').reduce((s, e) => s + e.montant, 0),
  }), [ecritures]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookText size={22} color="var(--primary)" /> Écritures Comptables
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Ajout, modification, suppression et export des écritures comptables.
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
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mois</label>
          <select className="select" value={filterMois} onChange={e => setFilterMois(e.target.value)}>
            <option value="">Tous</option>
            {MOIS_LABELS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Année</label>
          <input className="input" style={{ width: 100 }} value={filterAnnee} onChange={e => setFilterAnnee(e.target.value)} />
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
            <Trash2 size={13} /> {bulkWorking ? 'Traitement...' : 'Supprimer la sélection'}
          </button>
        </div>
      )}

      <div className="card table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: 32 }}><input type="checkbox" checked={ecritures.length > 0 && selected.size === ecritures.length} onChange={toggleSelectAll} /></th>
              <th>Date</th>
              <th>Référence</th>
              <th>Libellé</th>
              <th>Compte</th>
              <th style={{ textAlign: 'right' }}>Débit</th>
              <th style={{ textAlign: 'right' }}>Crédit</th>
              <th>État</th>
              <th>Lettrage</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Chargement...</td></tr>
            ) : ecritures.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Aucune écriture trouvée</td></tr>
            ) : ecritures.map(e => (
              <tr key={e.id}>
                <td><input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)} /></td>
                <td style={{ fontSize: 12 }}>{new Date(e.date_ecriture).toLocaleDateString('fr-FR')}</td>
                <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{e.reference}</td>
                <td style={{ fontSize: 13 }}>{e.libelle}</td>
                <td style={{ fontSize: 12 }}>{compteLabel(e.compte_bancaire_id)}</td>
                <td style={{ textAlign: 'right', fontSize: 13, color: '#ef4444' }}>{e.type === 'DEBIT' ? fmt(e.montant) : ''}</td>
                <td style={{ textAlign: 'right', fontSize: 13, color: '#10b981' }}>{e.type === 'CREDIT' ? fmt(e.montant) : ''}</td>
                <td><span className={`badge ${ETAT_BADGE[e.etat] || 'badge-gray'}`}>{e.etat}</span></td>
                <td>{e.lettree ? <span className="badge badge-info" style={{ fontSize: 10 }}>{e.lettrage_ref}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {e.etat === 'BROUILLON' && !e.lettree && (
                      <button className="btn btn-ghost btn-sm btn-icon" title="Modifier" onClick={() => openEdit(e)}><Edit3 size={13} /></button>
                    )}
                    {!e.lettree && e.etat !== 'ANNULE' && (
                      <button className="btn btn-danger btn-sm btn-icon" title={e.etat === 'VALIDE' ? 'Extourner' : 'Supprimer'} onClick={() => handleDeleteOne(e)}>
                        {e.etat === 'VALIDE' ? <Undo2 size={13} /> : <Trash2 size={13} />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
          <span>{total} écriture(s) — page {page} / {totalPages}</span>
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
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{modal.targetId ? 'Modifier l\'écriture' : 'Ajouter une écriture'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={closeModal}><X size={16} /></button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Compte bancaire</label>
              <select className="select" style={{ width: '100%' }} value={modal.compte_bancaire_id} onChange={e => setModal(m => m && { ...m, compte_bancaire_id: e.target.value })}>
                <option value="">— Sélectionner —</option>
                {comptes.map(c => <option key={c.id} value={c.id}>{c.intitule}{c.banque ? ` (${c.banque.nom})` : ''}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Référence</label>
                <input className="input" style={{ width: '100%' }} value={modal.reference} onChange={e => setModal(m => m && { ...m, reference: e.target.value })} placeholder="Auto si vide" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pièce jointe</label>
                <input className="input" style={{ width: '100%' }} value={modal.piece_ref} onChange={e => setModal(m => m && { ...m, piece_ref: e.target.value })} />
              </div>
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
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date d'écriture</label>
                <input className="input" type="date" style={{ width: '100%' }} value={modal.date_ecriture} onChange={e => setModal(m => m && { ...m, date_ecriture: e.target.value })} />
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
