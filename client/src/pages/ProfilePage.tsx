import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Shield, Building2, LogOut } from 'lucide-react';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const initials = `${user?.prenom?.[0] || ''}${user?.nom?.[0] || ''}`;

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Mon Profil</h1>
      <div className="card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#e94560,#0f3460)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: 'white' }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{user?.prenom} {user?.nom}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{user?.email}</div>
            <span className="badge badge-info" style={{ marginTop: 6 }}>{user?.role}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { icon: <User size={16} />, label: 'Nom complet', value: `${user?.prenom} ${user?.nom}` },
            { icon: <Mail size={16} />, label: 'Email', value: user?.email },
            { icon: <Shield size={16} />, label: 'Rôle', value: user?.role },
            { icon: <Building2 size={16} />, label: 'Entreprise', value: user?.entrepriseNom || 'Non assigné' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ color: 'var(--primary)' }}>{item.icon}</div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontWeight: 500 }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-danger" onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LogOut size={16} /> Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
