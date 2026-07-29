import { useEffect, useState } from 'react';
import { FileText, ChevronRight, CheckCircle2, Download, Loader2, AlertCircle, FilePen } from 'lucide-react';
import api from '../../api/axios';

interface Rapprochement {
  id: number;
  periode_mois: number;
  periode_annee: number;
  statut: string;
  montant_ecart: number;
  pv_url: string | null;
  compte_bancaire: { intitule: string; banque: { nom: string } };
  entreprise: { nom: string };
}

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

const STATUT_COLORS: Record<string, string> = {
  BROUILLON: 'badge-gray',
  EN_COURS: 'badge-info',
  SOUMIS: 'badge-warning',
  VALIDE_N1: 'badge-info',
  VALIDE_N2: 'badge-warning',
  VALIDE_FINAL: 'badge-success',
  REJETE: 'badge-danger',
  CLOS: 'badge-success',
};

const WORKFLOW_STEPS = [
  { key: 'BROUILLON', label: 'Brouillon', desc: 'Rapprochement en préparation' },
  { key: 'SOUMIS', label: 'Soumis', desc: 'En attente de validation Superviseur' },
  { key: 'VALIDE_N1', label: 'Validé N1', desc: 'Validé par le Superviseur' },
  { key: 'VALIDE_N2', label: 'Validé N2', desc: 'Validé par le Manager' },
  { key: 'VALIDE_FINAL', label: 'Validé DAF', desc: 'Validation finale' },
  { key: 'CLOS', label: 'Clos & PV', desc: 'PV officiel généré' },
];

export default function PdfWizardPage() {
  const [rapprochements, setRapprochements] = useState<Rapprochement[]>([]);
  const [selected, setSelected] = useState<Rapprochement | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.get('/reconciliation/list?limit=50')
      .then(r => setRapprochements(r.data.data || []))
      .catch(() => setRapprochements([]))
      .finally(() => setLoading(false));
  }, []);

  const generatePV = async (rapp: Rapprochement) => {
    setGenerating(true);
    try {
      // Utiliser axios avec responseType blob pour gérer le JWT automatiquement
      const response = await api.get(`/reports/pv/${rapp.id}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PV_Rapprochement_${MOIS[rapp.periode_mois - 1]}_${rapp.periode_annee}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMsg({ type: 'success', text: 'PV généré et téléchargé avec succès !' });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erreur lors de la génération du PV PDF';
      setMsg({ type: 'error', text: msg });
    } finally {
      setGenerating(false);
      setTimeout(() => setMsg(null), 4000);
    }
  };

  const submitRaprochement = async (rapp: Rapprochement) => {
    try {
      await api.post('/reconciliation/submit', { rapprochement_id: rapp.id });
      setMsg({ type: 'success', text: 'Rapprochement soumis pour validation !' });
      api.get('/reconciliation/list?limit=50').then(r => setRapprochements(r.data.data || []));
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Erreur lors de la soumission' });
    }
    setTimeout(() => setMsg(null), 4000);
  };

  const getStepIndex = (statut: string) => WORKFLOW_STEPS.findIndex(s => s.key === statut);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <FilePen size={22} color="var(--primary)" /> Assistant PV & Validation
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
          Gérez le workflow de validation dual-control et générez les PV officiels de rapprochement.
        </p>
      </div>

      {/* Message */}
      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, background: msg.type === 'success' ? '#d1fae5' : '#fee2e2', color: msg.type === 'success' ? '#065f46' : '#991b1b', border: `1px solid ${msg.type === 'success' ? '#6ee7b7' : '#fca5a5'}` }}>
          {msg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {msg.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.4fr' : '1fr', gap: 20 }}>
        {/* List */}
        <div>
          <div style={{ marginBottom: 12, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Rapprochements ({rapprochements.length})
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 72 }} />)}
            </div>
          ) : rapprochements.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <FileText size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <div style={{ fontWeight: 600 }}>Aucun rapprochement trouvé</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Commencez par lettrer des écritures dans l'espace de travail.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rapprochements.map(r => (
                <div
                  key={r.id}
                  className="card"
                  style={{ padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s', border: selected?.id === r.id ? '2px solid var(--primary)' : '1px solid var(--border)' }}
                  onClick={() => setSelected(r)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary)18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                      {MOIS[r.periode_mois - 1]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.compte_bancaire?.intitule || 'Compte'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {r.entreprise?.nom} · {MOIS[r.periode_mois - 1]} {r.periode_annee}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span className={`badge ${STATUT_COLORS[r.statut] || 'badge-gray'}`}>{r.statut.replace('_', ' ')}</span>
                      {r.pv_url && <span style={{ fontSize: 10, color: 'var(--success)' }}>✓ PV disponible</span>}
                    </div>
                    <ChevronRight size={16} color="var(--text-muted)" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Workflow steps */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Workflow de Validation Dual-Control</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {WORKFLOW_STEPS.map((step, idx) => {
                  const currentIdx = getStepIndex(selected.statut);
                  const isDone = idx <= currentIdx;
                  const isCurrent = idx === currentIdx;
                  return (
                    <div key={step.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: idx < WORKFLOW_STEPS.length - 1 ? 16 : 0, position: 'relative' }}>
                      {idx < WORKFLOW_STEPS.length - 1 && (
                        <div style={{ position: 'absolute', left: 11, top: 26, bottom: 0, width: 2, background: isDone ? 'var(--primary)' : 'var(--border)', zIndex: 0 }} />
                      )}
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: isDone ? 'var(--primary)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1, boxShadow: isCurrent ? '0 0 0 4px rgba(15,52,96,0.2)' : 'none' }}>
                        {isDone ? <CheckCircle2 size={14} color="white" /> : <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />}
                      </div>
                      <div style={{ paddingTop: 2 }}>
                        <div style={{ fontSize: 13, fontWeight: isCurrent ? 700 : 600, color: isCurrent ? 'var(--primary)' : isDone ? 'var(--text)' : 'var(--text-muted)' }}>{step.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{step.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Info */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Détails</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['Entreprise', selected.entreprise?.nom],
                  ['Compte', selected.compte_bancaire?.intitule],
                  ['Banque', selected.compte_bancaire?.banque?.nom],
                  ['Période', `${MOIS[selected.periode_mois - 1]} ${selected.periode_annee}`],
                  ['Écart résiduel', `${Number(selected.montant_ecart).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} XOF`],
                  ['Statut', selected.statut],
                ].map(([label, val]) => (
                  <div key={label} style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{val || '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Actions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selected.statut === 'BROUILLON' && (
                  <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => submitRaprochement(selected)}>
                    <ChevronRight size={16} /> Soumettre pour validation
                  </button>
                )}
                <button
                  className="btn btn-accent"
                  style={{ justifyContent: 'center' }}
                  onClick={() => generatePV(selected)}
                  disabled={generating}
                >
                  {generating
                    ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Génération en cours...</>
                    : <><Download size={16} /> Générer PV Officiel PDF</>}
                </button>
                {selected.pv_url && (
                  <a href={selected.pv_url} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ justifyContent: 'center' }}>
                    <FileText size={16} /> Voir le PV existant
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
