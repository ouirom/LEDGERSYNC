import { useEffect, useState } from 'react';
import { Lock, Unlock, Plus, AlertTriangle, AlertCircle } from 'lucide-react';
import api from '../../api/axios';

const STATUT_MAP: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  OUVERT: { label: 'Ouvert', badge: 'badge-success', icon: <Unlock size={12} /> },
  VERROUILLE: { label: 'Verrouillé', badge: 'badge-warning', icon: <Lock size={12} /> },
  CLOS: { label: 'Clos', badge: 'badge-danger', icon: <Lock size={12} /> },
};

const MOIS_NOMS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

export default function PeriodsSettingsPage() {
  const [periodes, setPeriodes] = useState<any[]>([]);
  const [entreprises, setEntreprises] = useState<any[]>([]);
  const [selectedEnt, setSelectedEnt] = useState('');
  const [selectedAnnee, setSelectedAnnee] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newMois, setNewMois] = useState(String(new Date().getMonth() + 1));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/entreprises').then(r => { setEntreprises(r.data.data || []); if (r.data.data?.[0]) setSelectedEnt(String(r.data.data[0].id)); });
  }, []);

  useEffect(() => {
    if (!selectedEnt) return;
    setLoading(true);
    api.get(`/periods?entreprise_id=${selectedEnt}&annee=${selectedAnnee}`).then(r => setPeriodes(r.data.data || [])).finally(() => setLoading(false));
  }, [selectedEnt, selectedAnnee]);

  const lock = async (id: number, statut: string) => {
    setError(null);
    try {
      await api.patch(`/periods/${id}/lock`, { statut });
      api.get(`/periods?entreprise_id=${selectedEnt}&annee=${selectedAnnee}`).then(r => setPeriodes(r.data.data || []));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du changement de statut de la période');
    }
  };

  const create = async () => {
    setError(null);
    try {
      await api.post('/periods', { entreprise_id: parseInt(selectedEnt), mois: parseInt(newMois), annee: parseInt(selectedAnnee) });
      setShowCreate(false);
      api.get(`/periods?entreprise_id=${selectedEnt}&annee=${selectedAnnee}`).then(r => setPeriodes(r.data.data || []));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la création de la période');
    }
  };

  const annees = [2024, 2025, 2026, 2027];

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Périodes Comptables</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Gérez le verrouillage des périodes. Une période verrouillée interdit toute modification.</p>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> Créer une période</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <select className="select" style={{ width: 220 }} value={selectedEnt} onChange={e => setSelectedEnt(e.target.value)}>
          {entreprises.map((e: any) => <option key={e.id} value={e.id}>{e.nom}</option>)}
        </select>
        <select className="select" style={{ width: 100 }} value={selectedAnnee} onChange={e => setSelectedAnnee(e.target.value)}>
          {annees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading && <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>Chargement des périodes...</p>}

      {/* Periods grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {MOIS_NOMS.map((nom, idx) => {
          const moisNum = idx + 1;
          const periode = periodes.find(p => p.mois === moisNum);
          const cfg = periode ? STATUT_MAP[periode.statut] : null;

          return (
            <div key={moisNum} className="card" style={{ padding: 16, opacity: !periode ? 0.5 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>{String(moisNum).padStart(2, '0')}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{nom}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedAnnee}</div>
                </div>
              </div>

              {periode ? (
                <>
                  <div style={{ marginBottom: 10 }}>
                    <span className={`badge ${cfg!.badge}`} style={{ display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
                      {cfg!.icon} {cfg!.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {periode.statut === 'OUVERT' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => lock(periode.id, 'VERROUILLE')} style={{ fontSize: 11 }}>
                        <Lock size={11} /> Verrouiller
                      </button>
                    )}
                    {periode.statut === 'VERROUILLE' && (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => lock(periode.id, 'OUVERT')} style={{ fontSize: 11 }}>
                          <Unlock size={11} /> Rouvrir
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => lock(periode.id, 'CLOS')} style={{ fontSize: 11 }}>
                          <Lock size={11} /> Clore
                        </button>
                      </>
                    )}
                    {periode.statut === 'CLOS' && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={11} /> Définitivement clos
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => { setNewMois(String(moisNum)); setShowCreate(true); }} style={{ fontSize: 11, width: '100%', justifyContent: 'center' }}>
                  <Plus size={11} /> Créer
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700 }}>Créer une période comptable</h3>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <select className="select" value={newMois} onChange={e => setNewMois(e.target.value)}>
                {MOIS_NOMS.map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
              </select>
              <select className="select" value={selectedAnnee} onChange={e => setSelectedAnnee(e.target.value)}>
                {annees.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={create}>Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
