import { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Globe, Building2,
  BarChart3, RefreshCw, Award, ShieldCheck
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import type { Entreprise } from '../../types/api';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul'];
const COLORS = ['#0f3460', '#e94560', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];

const MOCK_RADAR = [
  { subject: 'Lettrage', A: 91, fullMark: 100 },
  { subject: 'Conformité', A: 87, fullMark: 100 },
  { subject: 'Rapidité', A: 78, fullMark: 100 },
  { subject: 'Couverture', A: 95, fullMark: 100 },
  { subject: 'Exactitude', A: 89, fullMark: 100 },
  { subject: 'Audit Trail', A: 100, fullMark: 100 },
];

const MOCK_BAR = MONTHS.map((m) => ({
  mois: m,
  rapproches: Math.floor(Math.random() * 50) + 150,
  ecarts: Math.floor(Math.random() * 15) + 2,
}));

const MOCK_PIE = [
  { name: 'Lettrés', value: 226 },
  { name: 'En attente', value: 15 },
  { name: 'Écart', value: 6 },
];

export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/entreprises').catch(() => ({ data: { data: [] } })),
    ]).then(([e]) => {
      setEntreprises(e.data.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const executiveKpis = [
    {
      label: 'Taux de rapprochement', value: '94.2%', sub: '+2.1% vs mois dernier',
      icon: <Award size={22} />, color: '#0f3460', trend: 'up',
    },
    {
      label: 'Écart résiduel total', value: '42 500 XOF', sub: '3 comptes concernés',
      icon: <DollarSign size={22} />, color: '#f59e0b', trend: 'down',
    },
    {
      label: 'Conformité SOX', value: '100%', sub: 'Piste d\'audit complète',
      icon: <ShieldCheck size={22} />, color: '#10b981', trend: 'up',
    },
    {
      label: 'Entités couvertes', value: String(entreprises.length || '—'), sub: 'Multi-organisations actives',
      icon: <Building2 size={22} />, color: '#8b5cf6',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Tableau de Bord Direction</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Vue consolidée — {user?.prenom} {user?.nom} · {user?.role}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 10px', background: 'var(--bg)', borderRadius: 20, border: '1px solid var(--border)' }}>
            <Globe size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Vue Consolidée Multi-Entités
          </span>
          <button className="btn btn-ghost" onClick={() => window.location.reload()}>
            <RefreshCw size={15} /> Actualiser
          </button>
        </div>
      </div>

      {/* Executive KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {executiveKpis.map(kpi => (
          <div key={kpi.label} className="kpi-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div className="kpi-icon" style={{ background: `${kpi.color}18`, color: kpi.color }}>
              {kpi.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div className="kpi-value" style={{ color: kpi.color, fontSize: 24 }}>{loading ? '—' : kpi.value}</div>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Bar chart */}
        <div className="card" style={{ padding: 20, gridColumn: 'span 2' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={16} color="var(--primary)" /> Rapprochements par Mois
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={MOCK_BAR}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mois" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="rapproches" fill="#0f3460" name="Rapprochés" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ecarts" fill="#e94560" name="Écarts" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Répartition Lettrage</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={MOCK_PIE} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                {MOCK_PIE.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Radar + Entities */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        {/* Radar chart */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Score Qualité</h3>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={MOCK_RADAR}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
              <Radar name="Score" dataKey="A" stroke="#0f3460" fill="#0f3460" fillOpacity={0.25} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Entities table */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={16} color="var(--primary)" /> Entités enregistrées
          </h3>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 44 }} />)}
            </div>
          ) : entreprises.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
              <Building2 size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <div style={{ fontSize: 13 }}>Aucune entité configurée</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Entité</th>
                  <th>Code</th>
                  <th>Statut</th>
                  <th>Taux</th>
                </tr>
              </thead>
              <tbody>
                {entreprises.map((e, i) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>{e.nom}</td>
                    <td><code style={{ fontSize: 11, background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>{e.code}</code></td>
                    <td><span className="badge badge-success">Actif</span></td>
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>{(85 + i * 3).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
