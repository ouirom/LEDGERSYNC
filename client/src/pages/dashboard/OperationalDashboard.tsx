import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, GitMerge, AlertTriangle, CheckCircle2, Clock, RefreshCw, FileText } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import type { Compte, JobTraitement, DashboardSummary } from '../../types/api';

const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

const MOCK_CHART = MONTHS.slice(0, 7).map((m) => ({
  mois: m,
  ecritures: Math.floor(Math.random() * 200) + 80,
  lettrees: Math.floor(Math.random() * 180) + 60,
  ecart: Math.floor(Math.random() * 20),
}));

interface KPI { label: string; value: string; sub: string; icon: React.ReactNode; color: string; trend?: 'up' | 'down'; }

export default function OperationalDashboard() {
  const { user } = useAuth();
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [jobs, setJobs] = useState<JobTraitement[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/comptes').catch(() => ({ data: { data: [] } })),
      api.get('/jobs?limit=5').catch(() => ({ data: { data: [] } })),
      api.get('/reports/dashboard-summary').catch(() => ({ data: { data: null } })),
    ]).then(([c, j, s]) => {
      setComptes(c.data.data || []);
      setJobs(j.data.data || []);
      setSummary(s.data.data || null);
    }).finally(() => setLoading(false));
  }, []);

  const kpis: KPI[] = [
    {
      label: 'Écritures ce mois',
      value: summary ? String(summary.ecritures.total) : '—',
      sub: summary ? `${summary.ecritures.lettrees} lettrées` : 'Chargement...',
      icon: <FileText size={20} />, color: '#0f3460', trend: 'up',
    },
    {
      label: 'Taux de lettrage',
      value: summary ? `${summary.ecritures.tauxLettrage}%` : '—',
      sub: summary ? `${summary.ecritures.lettrees} / ${summary.ecritures.total} lettrées` : 'Chargement...',
      icon: <CheckCircle2 size={20} />, color: '#10b981', trend: 'up',
    },
    {
      label: 'Rapprochements ouverts',
      value: summary ? String(summary.rapprochements.ouverts) : '—',
      sub: summary ? `${summary.rapprochements.valides} validés` : 'Chargement...',
      icon: <AlertTriangle size={20} />, color: '#f59e0b',
    },
    {
      label: 'Jobs en cours',
      value: summary ? String(summary.jobs.enCours) : String(jobs.filter(j => j.statut === 'EN_COURS').length),
      sub: 'Traitement asynchrone',
      icon: <Clock size={20} />, color: '#3b82f6',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Tableau de Bord Opérationnel</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Bonjour, {user?.prenom} — {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => window.location.reload()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={15} /> Actualiser
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {kpis.map(kpi => (
          <div key={kpi.label} className="kpi-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div className="kpi-icon" style={{ background: `${kpi.color}18`, color: kpi.color }}>
              {kpi.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div className="kpi-value" style={{ color: kpi.color }}>{loading ? '—' : kpi.value}</div>
              <div className="kpi-label">{kpi.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 12, color: kpi.trend === 'up' ? 'var(--success)' : kpi.trend === 'down' ? 'var(--warning)' : 'var(--text-muted)' }}>
                {kpi.trend === 'up' ? <TrendingUp size={12} /> : kpi.trend === 'down' ? <TrendingDown size={12} /> : null}
                {kpi.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Évolution du Lettrage (7 derniers mois)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={MOCK_CHART}>
              <defs>
                <linearGradient id="ecritures" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f3460" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0f3460" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="lettrees" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mois" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="ecritures" stroke="#0f3460" fill="url(#ecritures)" name="Écritures" strokeWidth={2} />
              <Area type="monotone" dataKey="lettrees" stroke="#10b981" fill="url(#lettrees)" name="Lettrées" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Écarts par Mois</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={MOCK_CHART}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mois" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="ecart" fill="#e94560" name="Écart" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comptes + Jobs row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Comptes bancaires */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Comptes Bancaires</h3>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 44 }} />)}
            </div>
          ) : comptes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
              <GitMerge size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <div>Aucun compte configuré</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {comptes.slice(0, 5).map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--primary)18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GitMerge size={16} color="var(--primary)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.intitule}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.banque?.nom} • {c.devise}</div>
                  </div>
                  <span className="badge badge-success">Actif</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Jobs récents */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Jobs Récents</h3>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 44 }} />)}
            </div>
          ) : jobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
              <Clock size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <div>Aucun job récent</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {jobs.map(j => (
                <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.nom_fichier || j.type_job}</div>
                    <div className="progress-bar" style={{ marginTop: 4 }}>
                      <div className="progress-fill" style={{ width: `${j.progression}%` }} />
                    </div>
                  </div>
                  <span className={`badge ${j.statut === 'COMPLETE' ? 'badge-success' : j.statut === 'ECHOUE' ? 'badge-danger' : j.statut === 'EN_COURS' ? 'badge-info' : 'badge-gray'}`} style={{ fontSize: 10 }}>
                    {j.statut}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
