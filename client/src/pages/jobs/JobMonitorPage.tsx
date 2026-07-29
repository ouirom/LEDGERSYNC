import { useEffect, useState } from 'react';
import { RefreshCw, XCircle, RotateCcw, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../api/axios';
import { useSocket } from '../../contexts/SocketContext';
import { apiErrorMessage } from '../../utils/errors';
import type { JobTraitement } from '../../types/api';

interface JobProgressEvent { jobId: number; progression: number; lignesTraitees: number; }
interface JobDoneEvent { jobId: number; }

const STATUT_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  EN_ATTENTE: { label: 'En attente', badge: 'badge-gray', icon: <Clock size={12} /> },
  EN_COURS: { label: 'En cours', badge: 'badge-info', icon: <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> },
  COMPLETE: { label: 'Terminé', badge: 'badge-success', icon: <CheckCircle2 size={12} /> },
  ECHOUE: { label: 'Échoué', badge: 'badge-danger', icon: <AlertCircle size={12} /> },
  ANNULE: { label: 'Annulé', badge: 'badge-gray', icon: <XCircle size={12} /> },
};

export default function JobMonitorPage() {
  const { socket, subscribeJob } = useSocket();
  const [jobs, setJobs] = useState<JobTraitement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadJobs = () => {
    setLoading(true);
    api.get('/jobs?limit=50').then(r => setJobs(r.data.data || [])).finally(() => setLoading(false));
  };

  useEffect(() => { loadJobs(); }, []);

  // Subscribe to active jobs progress
  useEffect(() => {
    if (!socket) return;
    jobs.filter(j => j.statut === 'EN_COURS').forEach(j => subscribeJob(String(j.id)));
    socket.on('job:progress', (data: JobProgressEvent) => {
      setJobs(prev => prev.map(j => j.id === data.jobId ? { ...j, progression: data.progression, lignes_traitees: data.lignesTraitees, statut: 'EN_COURS' } : j));
    });
    socket.on('job:completed', (data: JobDoneEvent) => {
      setJobs(prev => prev.map(j => j.id === data.jobId ? { ...j, statut: 'COMPLETE', progression: 100 } : j));
    });
    socket.on('job:failed', (data: JobDoneEvent) => {
      setJobs(prev => prev.map(j => j.id === data.jobId ? { ...j, statut: 'ECHOUE' } : j));
    });
    return () => { socket.off('job:progress'); socket.off('job:completed'); socket.off('job:failed'); };
  }, [socket, jobs.length]);

  const cancel = async (id: number) => {
    setError(null);
    try {
      await api.post(`/jobs/${id}/cancel`);
      loadJobs();
    } catch (err) {
      setError(apiErrorMessage(err, 'Erreur lors de l\'annulation du job'));
    }
  };

  const resume = async (id: number) => {
    setError(null);
    try {
      await api.post(`/jobs/${id}/resume`);
      loadJobs();
    } catch (err) {
      setError(apiErrorMessage(err, 'Erreur lors de la reprise du job'));
    }
  };

  const filtered = jobs.filter(j => !filter || j.statut === filter);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Moniteur de Jobs</h1>
        <div style={{ flex: 1 }} />
        <select className="select" style={{ width: 150 }} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="btn btn-ghost" onClick={loadJobs}><RefreshCw size={15} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} /> Actualiser</button>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {Object.entries(STATUT_CONFIG).map(([k, v]) => {
          const count = jobs.filter(j => j.statut === k).length;
          return (
            <div key={k} className="stat-pill" style={{ cursor: 'pointer' }} onClick={() => setFilter(filter === k ? '' : k)}>
              {v.icon}<span style={{ fontWeight: 600 }}>{count}</span> {v.label}
            </div>
          );
        })}
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Fichier</th>
              <th>Type</th>
              <th>Progression</th>
              <th>Lignes</th>
              <th>Statut</th>
              <th>Créé le</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                {loading ? 'Chargement...' : 'Aucun job trouvé'}
              </td></tr>
            ) : filtered.map(j => {
              const cfg = STATUT_CONFIG[j.statut] || STATUT_CONFIG['EN_ATTENTE'];
              return (
                <tr key={j.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>#{j.id}</td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={j.nom_fichier}>{j.nom_fichier || '—'}</td>
                  <td><code style={{ fontSize: 11, background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>{j.type_job}</code></td>
                  <td style={{ width: 140 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="progress-bar" style={{ flex: 1 }}>
                        <div className="progress-fill" style={{ width: `${j.progression}%`, background: j.statut === 'COMPLETE' ? 'var(--success)' : j.statut === 'ECHOUE' ? 'var(--danger)' : undefined }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, minWidth: 30 }}>{(j.progression || 0).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{(j.lignes_traitees || 0).toLocaleString()} / {(j.total_lignes || 0).toLocaleString()}</td>
                  <td><span className={`badge ${cfg.badge}`} style={{ display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>{cfg.icon}{cfg.label}</span></td>
                  <td style={{ fontSize: 12 }}>{new Date(j.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(j.statut === 'EN_COURS' || j.statut === 'EN_ATTENTE') && (
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => cancel(j.id)} title="Annuler"><XCircle size={13} /></button>
                      )}
                      {(j.statut === 'ECHOUE' || j.statut === 'ANNULE') && (
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => resume(j.id)} title="Reprendre"><RotateCcw size={13} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
