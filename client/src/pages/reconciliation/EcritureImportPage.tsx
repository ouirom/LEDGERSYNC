import { useEffect, useState, useRef } from 'react';
import { Upload, FileSpreadsheet, X, Loader2, ExternalLink, Eye, ArrowLeft, AlertTriangle, FileStack, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { apiErrorMessage } from '../../utils/errors';
import type { Compte, ImportPreview } from '../../types/api';

const fmtMontant = (v: number | null) => v === null ? '—' : v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface ImportResult { total_lignes: number; creees: number; ignoreesInvalides: number; ignoreesPeriodeVerrouillee: number; }

export default function EcritureImportPage() {
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [selectedCompte, setSelectedCompte] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/comptes').then(r => setComptes(r.data.data || []));
  }, []);

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
      const { data } = await api.post('/ecritures/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPreview(data.data);
    } catch (err) {
      setPreviewError(apiErrorMessage(err, 'Erreur lors de l\'analyse du fichier'));
    } finally {
      setPreviewing(false);
    }
  };

  const handleValidate = async () => {
    if (files.length === 0 || !selectedCompte) return;
    setValidating(true);
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    form.append('compte_bancaire_id', selectedCompte);
    try {
      const { data } = await api.post('/ecritures/import', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(data.data);
    } catch (err) {
      setPreviewError(apiErrorMessage(err, 'Erreur lors de l\'import'));
    } finally {
      setValidating(false);
    }
  };

  const reset = () => { setFiles([]); setPreview(null); setPreviewError(null); setResult(null); };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Import d'Écritures Comptables</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Importer un ou plusieurs fichiers .xlsx, .csv ou .pdf. La période comptable de chaque écriture est déduite de sa date — une ligne dont la période est verrouillée est ignorée plutôt que rejetée en bloc.</p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Compte bancaire *</label>
        <select className="select" value={selectedCompte} onChange={e => setSelectedCompte(e.target.value)} style={{ width: '100%', maxWidth: 400 }}>
          <option value="">— Sélectionner —</option>
          {comptes.map(c => <option key={c.id} value={c.id}>{c.intitule} — {c.banque?.nom}</option>)}
        </select>
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
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>ou cliquer pour parcourir — .xlsx, .csv, .pdf (max 50 MB/fichier)</p>
          <input ref={fileInput} type="file" accept=".xlsx,.csv,.pdf" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files?.length) addFiles(e.target.files); }} />
        </div>
      ) : (
        <div className="card" style={{ padding: 20 }}>
          {!result && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <FileStack size={16} color="var(--primary)" />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{files.length} fichier{files.length > 1 ? 's' : ''} sélectionné{files.length > 1 ? 's' : ''}</span>
                <div style={{ flex: 1 }} />
                <button className="btn btn-ghost btn-sm" onClick={() => fileInput.current?.click()}><Upload size={13} /> Ajouter un fichier</button>
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
          {!result && preview && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Aperçu — {preview.total_lignes} lignes sur {preview.nb_pages} fichier{preview.nb_pages > 1 ? 's' : ''}
                </div>
                {preview.lignes_invalides > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--danger)' }}>
                    <AlertTriangle size={12} /> {preview.lignes_invalides} ligne{preview.lignes_invalides > 1 ? 's' : ''} ignorée{preview.lignes_invalides > 1 ? 's' : ''} (date/montant illisible)
                  </span>
                )}
                {preview.lignes_incertaines > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--warning)' }}>
                    <AlertTriangle size={12} /> {preview.lignes_incertaines} ligne{preview.lignes_incertaines > 1 ? 's' : ''} au sens débit/crédit incertain
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
                      <th style={{ background: 'var(--primary)', padding: '6px 10px' }}>Libellé</th>
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
                </table>
              </div>
              {preview.total_lignes > preview.apercu.length && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>… et {preview.total_lignes - preview.apercu.length} lignes supplémentaires (non affichées dans l'aperçu)</div>
              )}
            </div>
          )}

          {previewError && !result && (
            <div style={{ marginBottom: 16, fontSize: 12, color: 'var(--danger)' }}>{previewError}</div>
          )}

          {/* Résultat de l'import */}
          {result && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontWeight: 700, fontSize: 14 }}>
                <CheckCircle2 size={18} color="var(--success)" /> Import terminé
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div style={{ padding: '10px 12px', background: 'var(--success)10', border: '1px solid var(--success)30', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>{result.creees}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>écritures créées</div>
                </div>
                <div style={{ padding: '10px 12px', background: 'var(--danger)10', border: '1px solid var(--danger)30', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--danger)' }}>{result.ignoreesInvalides}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ignorées (illisibles)</div>
                </div>
                <div style={{ padding: '10px 12px', background: 'var(--warning)10', border: '1px solid var(--warning)30', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--warning)' }}>{result.ignoreesPeriodeVerrouillee}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>période verrouillée</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button className="btn btn-ghost btn-sm" onClick={reset}><Upload size={14} /> Nouvel import</button>
                <Link to="/reconciliation/workspace" className="btn btn-primary btn-sm"><ExternalLink size={14} /> Aller à l'espace de rapprochement</Link>
              </div>
            </div>
          )}

          {/* Actions */}
          {!result && (
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
                  <button className="btn btn-accent" onClick={handleValidate} disabled={!selectedCompte || validating} style={{ flex: 1, justifyContent: 'center', padding: 12 }} title={!selectedCompte ? 'Sélectionnez un compte bancaire' : undefined}>
                    {validating ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Import...</> : <><Upload size={16} /> Valider l'import</>}
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
          {[['Date', 'Date d\'écriture (JJ/MM/AAAA)'], ['Libelle', 'Libellé de l\'opération'], ['Date valeur', 'Date de valeur (optionnel)'], ['Debit', 'Montant débité (ou Montant négatif)'], ['Credit', 'Montant crédité (ou Montant positif)'], ['Reference', 'Référence (optionnel — générée automatiquement si absente)']].map(([col, desc]) => (
            <div key={col} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <code style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>{col}</code>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
          La période comptable de chaque ligne est déduite de sa date — aucune période à sélectionner au préalable. Une ligne dont la période est verrouillée est ignorée sans bloquer les autres.
        </div>
      </div>
    </div>
  );
}
