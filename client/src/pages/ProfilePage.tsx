import { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import api from '../api/axios';
import { resolveAvatarUrl } from '../utils/avatar';
import { apiErrorMessage } from '../utils/errors';
import { User, Mail, Shield, Building2, LogOut, Camera, Trash2, Pencil, Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const dialog = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initials = `${user?.prenom?.[0] || ''}${user?.nom?.[0] || ''}`;

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nom: user?.nom || '', prenom: user?.prenom || '', email: user?.email || '' });

  const startEditing = () => {
    setForm({ nom: user?.nom || '', prenom: user?.prenom || '', email: user?.email || '' });
    setEditing(true);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      await api.post('/auth/me/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refreshUser();
    } catch (err) {
      await dialog.alert(apiErrorMessage(err, "Erreur lors de l'envoi de l'avatar"), { title: 'Erreur', tone: 'danger' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    const ok = await dialog.confirm('Supprimer votre photo de profil ?', { title: 'Supprimer l\'avatar', tone: 'danger', confirmLabel: 'Supprimer' });
    if (!ok) return;
    setUploadingAvatar(true);
    try {
      await api.delete('/auth/me/avatar');
      await refreshUser();
    } catch (err) {
      await dialog.alert(apiErrorMessage(err, 'Erreur lors de la suppression'), { title: 'Erreur', tone: 'danger' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/auth/me', form);
      await refreshUser();
      setEditing(false);
    } catch (err) {
      await dialog.alert(apiErrorMessage(err, 'Erreur lors de la mise à jour du profil'), { title: 'Erreur', tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const avatarSrc = resolveAvatarUrl(user?.avatarUrl);

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Mon Profil</h1>
      <div className="card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: avatarSrc ? undefined : 'linear-gradient(135deg,#e94560,#0f3460)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: 'white', overflow: 'hidden' }}>
              {uploadingAvatar ? (
                <Loader2 size={22} className="animate-spin" />
              ) : avatarSrc ? (
                <img src={avatarSrc} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : initials}
            </div>
            <button
              className="btn btn-primary btn-icon btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              title="Changer la photo"
              style={{ position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: '50%', padding: 0 }}
            >
              <Camera size={13} />
            </button>
            {avatarSrc && !uploadingAvatar && (
              <button
                className="btn btn-danger btn-icon btn-sm"
                onClick={handleRemoveAvatar}
                title="Supprimer la photo"
                style={{ position: 'absolute', top: -2, right: -2, width: 22, height: 22, borderRadius: '50%', padding: 0 }}
              >
                <Trash2 size={11} />
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} style={{ display: 'none' }} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{user?.prenom} {user?.nom}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{user?.email}</div>
            <span className="badge badge-info" style={{ marginTop: 6 }}>{user?.role}</span>
          </div>
        </div>

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' }}>Prénom</label>
              <input className="input" style={{ width: '100%' }} value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' }}>Nom</label>
              <input className="input" style={{ width: '100%' }} value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' }}>Email</label>
              <input className="input" type="email" style={{ width: '100%' }} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.nom.trim() || !form.prenom.trim() || !form.email.trim()}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button className="btn btn-ghost" onClick={() => setEditing(false)} disabled={saving}>Annuler</button>
            </div>
          </div>
        ) : (
          <>
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
            <button className="btn btn-secondary" onClick={startEditing} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
              <Pencil size={14} /> Modifier mes informations
            </button>
          </>
        )}

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-danger" onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LogOut size={16} /> Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
