import { useEffect, useState, useRef } from 'react';
import { Upload, FileSpreadsheet, X, Loader2, ExternalLink, Eye, ArrowLeft, AlertTriangle, FileStack } from 'lucide-react';
import api from '../../api/axios';
import { useSocket } from '../../contexts/SocketContext';
import { apiErrorMessage } from '../../utils/errors';
import type { Compte, ImportPreview, ReleveBancaire } from '../../types/api';

interface JobProgress { progression: number; lignesTraitees: number; totalLignes: number; etaSeconds?: number; statut: string; erreurMessage?: string; }

const fmtMontant = (v: number | null) => v === null ? '—' : v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ExcelImportPage() {
  const { socket, subscribeJob, unsubscribeJob } = useSocket();
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [selectedCompte, setSelectedCompte] = useState('');
  const [reference, setReference] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [releves, setReleves] = useState<ReleveBancaire[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/comptes').then(r => setComptes(r.data.data || []));
  }, []);

  const loadReleves = () => {
    if (!selectedCompte) { setReleves([]); return; }
    api.get(`/releves/statements?compte_bancaire_id=${selectedCompte}`).then(r => setReleves(r.data.data || [])).catch(() => setReleves([]));
  };

  useEffect(loadReleves, [selectedCompte]);

  // Socket.IO progress listener
  useEffect(() => {
    if (!socket || !jobId) return;
    subscribeJob(jobId);

    const onProgress = (data: JobProgress) => setProgress(data);
    const onCompleted = () => { setProgress(p => p ? { ...p, progression: 100, statut: 'COMPLETE' } : null); loadReleves(); };
    const onFailed = (data: { erreur: string }) => setProgress(p => p ? { ...p, statut: 'ECHOUE', erreurMessage: data.erreur } : null);

    socket.on('job:progress', onProgress);
    socket.on('job:completed', onCompleted);
    socket.on('job:failed', onFailed);

    return () => {
      unsubscribeJob(jobId);
      socket.off('job:progress', onProgress);
      socket.off('job:completed', onCompleted);
      socket.off('job:failed', onFailed);
    };
  }, [socket, jobId]);

  const addFiles = (list: FileList | File[]) => {
    setPreview(null);
    setPreviewError(null);
    setFiles(prev => [...prev, ...Array.from(list)]);
  };

  const removeFile = (idx: number) => {
    setPreview(null);
    setPreviewError(null);
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const handlePreview = async () => {
    if (files.length === 0) return;
    setPreviewing(true);
    setPreviewError(null);
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    try {
      const { data } = await api.post('/releves/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPreview(data.data);
    } catch (err) {
      setPreviewError(apiErrorMessage(err, 'Erreur lors de l\'analyse du fichier'));
    } finally {
      setPreviewing(false);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0 || !selectedCompte) return;
    setUploading(true);
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    form.append('compte_bancaire_id', selectedCompte);
    if (reference.trim()) form.append('reference', reference.trim());
    if (dateDebut) form.append('date_debut', dateDebut);
    if (dateFin) form.append('date_fin', dateFin);
    try {
      const { data } = await api.post('/releves/import', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setJobId(String(data.data.jobId));
      setProgress({ progression: 0, lignesTraitees: 0, totalLignes: preview?.total_lignes || 100, statut: 'EN_ATTENTE' });
    } catch (err) {
      alert(apiErrorMessage(err, 'Erreur lors de l\'upload'));
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFiles([]); setPreview(null); setPreviewError(null); setJobId(null); setProgress(null);
    setReference(''); setDateDebut(''); setDateFin('');
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Import Relevé Bancaire</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Importer un ou plusieurs fichiers .xlsx, .csv ou .pdf (les pages d'un même relevé). Prévisualisez avant de valider — le traitement s'effectue ensuite en arrière-plan avec suivi temps réel.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Compte bancaire *</label>
          <select className="select" value={selectedCompte} onChange={e => setSelectedCompte(e.target.value)} style={{ width: '100%' }}>
            <option value="">— Sélectionner —</option>
            {comptes.map(c => <option key={c.id} value={c.id}>{c.intitule} — {c.banque?.nom}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Référence (optionnel)</label>
          <input className="input" value={reference} onChange={e => setReference(e.target.value)} placeholder="N° de relevé" style={{ width: '100%' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Période</label>
            <input className="input" type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>&nbsp;</label>
            <input className="input" type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>
      </div>

      {/* Drop Zone */}
      {files.length === 0 ? (
        <div
          className={`upload-zone ${dragOver ? 'dragover' : ''}`}
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInput.current?.click()}
        >
          <FileSpreadsheet size={40} style={{ margin: '0 auto 12px', color: 'var(--primary)', opacity: 0.7 }} />
          <p style={{ fontWeight: 600, margin: '0 0 6px', fontSize: 16 }}>Déposer votre/vos fichier(s) ici</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>ou cliquer pour parcourir — .xlsx, .csv, .pdf (max 50 MB/page). Un relevé peut comporter plusieurs pages : sélectionnez plusieurs fichiers.</p>
          <input ref={fileInput} type="file" accept=".xlsx,.csv,.pdf" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files?.length) addFiles(e.target.files); }} />
        </div>
      ) : (
        <div className="card" style={{ padding: 20 }}>
          {/* Files list */}
          {!progress && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <FileStack size={16} color="var(--primary)" />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{files.length} page{files.length > 1 ? 's' : ''} sélectionnée{files.length > 1 ? 's' : ''}</span>
                <div style={{ flex: 1 }} />
                <button className="btn btn-ghost btn-sm" onClick={() => fileInput.current?.click()}><Upload size={13} /> Ajouter une page</button>
                <input ref={fileInput} type="file" accept=".xlsx,.csv,.pdf" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files?.length) addFiles(e.target.files); }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <FileSpreadsheet size={16} color="var(--success)" />
                    <span style={{ flex: 1, fontSize: 13 }}>{f.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(f.size / 1024).toFixed(1)} KB</span>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeFile(i)}><X size={13} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {!progress && preview && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Aperçu — {preview.total_lignes} lignes sur {preview.nb_pages} page{preview.nb_pages > 1 ? 's' : ''}
                </div>
                {preview.lignes_invalides > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--danger)' }}>
                    <AlertTriangle size={12} /> {preview.lignes_invalides} ligne{preview.lignes_invalides > 1 ? 's' : ''} ignorée{preview.lignes_invalides > 1 ? 's' : ''} (date/montant illisible)
                  </span>
                )}
                {preview.lignes_incertaines > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--warning)' }}>
                    <AlertTriangle size={12} /> {preview.lignes_incertaines} ligne{preview.lignes_incertaines > 1 ? 's' : ''} au sens débit/crédit incertain (à vérifier)
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1, padding: '8px 12px', background: 'var(--danger)10', border: '1px solid var(--danger)30', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total débit</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)' }}>{fmtMontant(preview.total_debit)}</span>
                </div>
                <div style={{ flex: 1, padding: '8px 12px', background: 'var(--success)10', border: '1px solid var(--success)30', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total crédit</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>{fmtMontant(preview.total_credit)}</span>
                </div>
              </div>
              <div className="table-container" style={{ maxHeight: 280, overflow: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                <table style={{ fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ background: 'var(--primary)', padding: '6px 10px' }}>Date</th>
                      <th style={{ background: 'var(--primary)', padding: '6px 10px' }}>Libellé de l'opération</th>
                      <th style={{ background: 'var(--primary)', padding: '6px 10px' }}>Valeur</th>
                      <th style={{ background: 'var(--primary)', padding: '6px 10px', textAlign: 'right' }}>Débit</th>
                      <th style={{ background: 'var(--primary)', padding: '6px 10px', textAlign: 'right' }}>Crédit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.apercu.map((l, i) => (
                      <tr key={i} style={!l.valide ? { opacity: 0.4, textDecoration: 'line-through' } : l.incertain ? { background: 'var(--warning)10' } : undefined}>
                        <td style={{ padding: '5px 10px', whiteSpace: 'nowrap' }}>{l.date_operation ? new Date(l.date_operation).toLocaleDateString('fr-FR') : '—'}</td>
                        <td style={{ padding: '5px 10px' }}>{l.incertain && <AlertTriangle size={11} color="var(--warning)" style={{ verticalAlign: -1, marginRight: 4 }} />}{l.libelle}</td>
                        <td style={{ padding: '5px 10px', whiteSpace: 'nowrap' }}>{l.date_valeur ? new Date(l.date_valeur).toLocaleDateString('fr-FR') : '—'}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: 'var(--danger)' }}>{l.debit !== null ? fmtMontant(l.debit) : ''}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: 'var(--success)' }}>{l.credit !== null ? fmtMontant(l.credit) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} style={{ padding: '6px 10px', fontWeight: 700, borderTop: '2px solid var(--border)' }}>Total ({preview.total_lignes - preview.lignes_invalides} ligne{preview.total_lignes - preview.lignes_invalides > 1 ? 's' : ''} valide{preview.total_lignes - preview.lignes_invalides > 1 ? 's' : ''})</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--danger)', borderTop: '2px solid var(--border)' }}>{fmtMontant(preview.total_debit)}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--success)', borderTop: '2px solid var(--border)' }}>{fmtMontant(preview.total_credit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {preview.total_lignes > preview.apercu.length && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>… et {preview.total_lignes - preview.apercu.length} lignes supplémentaires (non affichées dans l'aperçu)</div>
              )}
            </div>
          )}

          {previewError && !progress && (
            <div style={{ marginBottom: 16, fontSize: 12, color: 'var(--danger)' }}>{previewError}</div>
          )}

          {/* Progress */}
          {progress && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>
                  {progress.statut === 'COMPLETE' ? '✅ Import terminé' :
                    progress.statut === 'ECHOUE' ? `❌ Import échoué${progress.erreurMessage ? ' — ' + progress.erreurMessage : ''}` :
                    `Traitement en cours... ${progress.progression.toFixed(0)}%`}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {progress.lignesTraitees.toLocaleString()} / {progress.totalLignes.toLocaleString()} lignes
                  {progress.etaSeconds ? ` — ETA: ${progress.etaSeconds}s` : ''}
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress.progression}%`, background: progress.statut === 'COMPLETE' ? 'var(--success)' : progress.statut === 'ECHOUE' ? 'var(--danger)' : undefined }} />
              </div>
              {progress.statut === 'COMPLETE' && (
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button className="btn btn-ghost btn-sm" onClick={reset}><Upload size={14} /> Nouvel import</button>
                  <a href="/reconciliation/workspace" className="btn btn-primary btn-sm"><ExternalLink size={14} /> Aller à l'espace de rapprochement</a>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {!progress && (
            <div style={{ display: 'flex', gap: 10 }}>
              {!preview ? (
                <>
                  <button className="btn btn-ghost" onClick={reset}><X size={14} /> Annuler</button>
                  <button className="btn btn-accent" onClick={handlePreview} disabled={previewing} style={{ flex: 1, justifyContent: 'center', padding: 12 }}>
                    {previewing ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Analyse...</> : <><Eye size={16} /> Prévisualiser</>}
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-ghost" onClick={() => setPreview(null)}><ArrowLeft size={14} /> Modifier la sélection</button>
                  <button className="btn btn-accent" onClick={handleUpload} disabled={!selectedCompte || uploading} style={{ flex: 1, justifyContent: 'center', padding: 12 }}>
                    {uploading ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Démarrage...</> : <><Upload size={16} /> Valider l'import</>}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="card" style={{ padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Format attendu</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[['Date', 'Date d\'opération (JJ/MM/AAAA)'], ['Libelle', 'Libellé de l\'opération'], ['Date valeur', 'Date de valeur (optionnel)'], ['Debit', 'Montant débité (ou Montant négatif)'], ['Credit', 'Montant crédité (ou Montant positif)'], ['Reference', 'Référence bancaire (optionnel)']].map(([col, desc]) => (
            <div key={col} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <code style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>{col}</code>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
          Deux colonnes séparées <code>Debit</code>/<code>Credit</code> ou une seule colonne <code>Montant</code> signée (négatif = débit) sont acceptées.
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          Pour un fichier <code>.pdf</code>, l'extraction est automatique (tableau détecté ou, à défaut, analyse du texte) — vérifiez toujours l'aperçu avant de valider, certaines mises en page peuvent être mal reconnues.
        </div>
      </div>

      {/* Historique des relevés du compte sélectionné */}
      {selectedCompte && (
        <div className="card" style={{ padding: 16, marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Relevés de ce compte {releves.length > 0 && `(${releves.length})`}
          </div>
          {releves.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun relevé importé pour ce compte pour l'instant.</div>
          ) : (
            <table style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Période</th>
                  <th>Pages</th>
                  <th>Lignes</th>
                  <th>Statut</th>
                  <th>Importé le</th>
                </tr>
              </thead>
              <tbody>
                {releves.map(r => (
                  <tr key={r.id}>
                    <td>{r.reference || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ fontSize: 11 }}>
                      {r.date_debut ? new Date(r.date_debut).toLocaleDateString('fr-FR') : '—'}
                      {r.date_fin ? ` → ${new Date(r.date_fin).toLocaleDateString('fr-FR')}` : ''}
                    </td>
                    <td>{r.nb_pages}</td>
                    <td>{r._count?.lignes ?? 0}</td>
                    <td><span className={`badge ${r.etat === 'VALIDE' ? 'badge-success' : 'badge-gray'}`}>{r.etat}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
