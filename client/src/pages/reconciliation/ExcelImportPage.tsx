import { useEffect, useState, useRef } from 'react';
import { Upload, FileSpreadsheet, X, Loader2, ExternalLink } from 'lucide-react';
import { readSheet } from 'read-excel-file/browser';
import api from '../../api/axios';
import { useSocket } from '../../contexts/SocketContext';
import { apiErrorMessage } from '../../utils/errors';
import type { Compte } from '../../types/api';

function parseCsvPreview(text: string): { headers: string[]; rows: Record<string, unknown>[] } {
  const lines = text.split(/\r\n|\n|\r/).filter(l => l.length > 0).slice(0, 6);
  if (lines.length === 0) return { headers: [], rows: [] };
  const delimiter = (lines[0]!.match(/;/g) || []).length > (lines[0]!.match(/,/g) || []).length ? ';' : ',';
  const splitLine = (line: string) => line.split(delimiter).map(c => c.replace(/^"|"$/g, '').trim());
  const headers = splitLine(lines[0]!);
  const rows = lines.slice(1).map(line => {
    const cells = splitLine(line);
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    return row;
  });
  return { headers, rows };
}

interface JobProgress { progression: number; lignesTraitees: number; totalLignes: number; etaSeconds?: number; statut: string; erreurMessage?: string; }

export default function ExcelImportPage() {
  const { socket, subscribeJob, unsubscribeJob } = useSocket();
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [selectedCompte, setSelectedCompte] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/comptes').then(r => setComptes(r.data.data || []));
  }, []);

  // Socket.IO progress listener
  useEffect(() => {
    if (!socket || !jobId) return;
    subscribeJob(jobId);

    const onProgress = (data: JobProgress) => setProgress(data);
    const onCompleted = () => setProgress(p => p ? { ...p, progression: 100, statut: 'COMPLETE' } : null);
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

  const parseFile = async (f: File) => {
    setFile(f);
    try {
      if (f.name.toLowerCase().endsWith('.csv')) {
        const text = await f.text();
        const { headers: h, rows } = parseCsvPreview(text);
        setHeaders(h);
        setPreview(rows.slice(0, 5));
        return;
      }
      const rows = await readSheet(f); // première feuille par défaut
      const h = (rows[0] || []).map(c => String(c ?? '').trim());
      const objRows = rows.slice(1, 6).map(row => {
        const obj: Record<string, unknown> = {};
        h.forEach((col, i) => { obj[col] = row[i] ?? ''; });
        return obj;
      });
      setHeaders(h);
      setPreview(objRows);
    } catch {
      setHeaders([]);
      setPreview([]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) parseFile(f);
  };

  const handleUpload = async () => {
    if (!file || !selectedCompte) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('compte_bancaire_id', selectedCompte);
    try {
      const { data } = await api.post('/releves/import', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setJobId(String(data.data.jobId));
      setProgress({ progression: 0, lignesTraitees: 0, totalLignes: preview.length > 0 ? preview.length : 100, statut: 'EN_ATTENTE' });
    } catch (err) {
      alert(apiErrorMessage(err, 'Erreur lors de l\'upload'));
    } finally {
      setUploading(false);
    }
  };

  const reset = () => { setFile(null); setPreview([]); setHeaders([]); setJobId(null); setProgress(null); };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Import Relevé Bancaire — Excel</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Importer un fichier .xlsx ou .csv. Le traitement s'effectue en arrière-plan avec suivi temps réel.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Compte bancaire *</label>
          <select className="select" value={selectedCompte} onChange={e => setSelectedCompte(e.target.value)}>
            <option value="">— Sélectionner —</option>
            {comptes.map(c => <option key={c.id} value={c.id}>{c.intitule} — {c.banque?.nom}</option>)}
          </select>
        </div>
      </div>

      {/* Drop Zone */}
      {!file ? (
        <div
          className={`upload-zone ${dragOver ? 'dragover' : ''}`}
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInput.current?.click()}
        >
          <FileSpreadsheet size={40} style={{ margin: '0 auto 12px', color: 'var(--primary)', opacity: 0.7 }} />
          <p style={{ fontWeight: 600, margin: '0 0 6px', fontSize: 16 }}>Déposer votre fichier ici</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>ou cliquer pour parcourir — .xlsx, .csv (max 50 MB)</p>
          <input ref={fileInput} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) parseFile(e.target.files[0]); }} />
        </div>
      ) : (
        <div className="card" style={{ padding: 20 }}>
          {/* File info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--success)18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={22} color="var(--success)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{file.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(1)} KB — {preview.length} lignes (aperçu), {headers.length} colonnes</div>
            </div>
            {!progress && <button className="btn btn-ghost btn-icon" onClick={reset}><X size={16} /></button>}
          </div>

          {/* Preview table */}
          {preview.length > 0 && !progress && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Aperçu (5 premières lignes)</div>
              <div className="table-container" style={{ maxHeight: 200, overflow: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                <table style={{ fontSize: 11 }}>
                  <thead><tr>{headers.map(h => <th key={h} style={{ background: 'var(--primary)', padding: '6px 10px' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i}>{headers.map(h => <td key={h} style={{ padding: '5px 10px' }}>{String(row[h] ?? '')}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
            <button className="btn btn-accent" onClick={handleUpload} disabled={!selectedCompte || uploading} style={{ width: '100%', justifyContent: 'center', padding: 12 }}>
              {uploading ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Démarrage...</> : <><Upload size={16} /> Lancer l'import</>}
            </button>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="card" style={{ padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Format attendu</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[['Date', 'Date d\'opération (JJ/MM/AAAA)'], ['Montant', 'Montant (négatif = débit)'], ['Libelle', 'Description de l\'opération'], ['Reference', 'Référence bancaire (optionnel)'], ['Date valeur', 'Date valeur (optionnel)']].map(([col, desc]) => (
            <div key={col} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <code style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>{col}</code>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
