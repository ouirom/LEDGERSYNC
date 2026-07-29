import { useEffect, useState } from 'react';
import { FileSpreadsheet, Plus, Edit3, Trash2, Save, X, AlertCircle } from 'lucide-react';
import api from '../../api/axios';

interface BanqueTemplate {
  id: number;
  banque_id: number;
  nom: string;
  mapping_colonnes: Record<string, string>;
  ligne_entete: number;
  format_date: string;
  etat: string;
  banque?: { nom: string };
}

const COLONNES_REQUISES = [
  { key: 'date', label: 'Date opération', placeholder: 'Date' },
  { key: 'montant', label: 'Montant', placeholder: 'Montant' },
  { key: 'libelle', label: 'Libellé', placeholder: 'Libelle' },
  { key: 'reference', label: 'Référence (optionnel)', placeholder: 'Reference' },
  { key: 'date_valeur', label: 'Date valeur (optionnel)', placeholder: 'Date valeur' },
];

export default function BankTemplatesPage() {
  const [templates, setTemplates] = useState<BanqueTemplate[]>([]);
  const [banques, setBanques] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BanqueTemplate | null>(null);
  const [form, setForm] = useState({
    banque_id: '',
    nom: '',
    ligne_entete: '1',
    format_date: 'DD/MM/YYYY',
    mapping: { date: 'Date', montant: 'Montant', libelle: 'Libelle', reference: 'Reference', date_valeur: 'Date valeur' },
  });

  const loadTemplates = () => {
    api.get('/banques/templates').then(r => setTemplates(r.data.data || [])).catch(() => setTemplates([]));
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/banques').catch(() => ({ data: { data: [] } })),
      api.get('/banques/templates').catch(() => ({ data: { data: [] } })),
    ]).then(([b, t]) => {
      setBanques(b.data.data || []);
      setTemplates(t.data.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!form.banque_id || !form.nom) return;
    try {
      const payload = {
        banque_id: parseInt(form.banque_id),
        nom: form.nom,
        ligne_entete: parseInt(form.ligne_entete),
        format_date: form.format_date,
        mapping_colonnes: form.mapping,
      };
      if (editing) {
        await api.put(`/banques/templates/${editing.id}`, payload);
      } else {
        await api.post('/banques/templates', payload);
      }
      setShowForm(false);
      setEditing(null);
      loadTemplates();
    } catch {
      alert('Erreur lors de la sauvegarde du template');
    }
  };

  const handleDelete = async (t: BanqueTemplate) => {
    if (!confirm(`Supprimer le template "${t.nom}" ?`)) return;
    try {
      await api.delete(`/banques/templates/${t.id}`);
      loadTemplates();
    } catch {
      alert('Erreur lors de la suppression du template');
    }
  };

  const startEdit = (t: BanqueTemplate) => {
    setEditing(t);
    setForm({
      banque_id: String(t.banque_id),
      nom: t.nom,
      ligne_entete: String(t.ligne_entete),
      format_date: t.format_date,
      mapping: t.mapping_colonnes as any,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ banque_id: '', nom: '', ligne_entete: '1', format_date: 'DD/MM/YYYY', mapping: { date: 'Date', montant: 'Montant', libelle: 'Libelle', reference: 'Reference', date_valeur: 'Date valeur' } });
    setShowForm(false);
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileSpreadsheet size={22} color="var(--primary)" /> Templates d'Import Bancaire
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Configurez les mappings de colonnes pour chaque banque afin d'automatiser l'import des relevés.
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={15} /> Nouveau template
        </button>
      </div>

      {/* Info banner */}
      <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, marginBottom: 20, fontSize: 13 }}>
        <AlertCircle size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>Configuration du mapping</strong> : Indiquez le nom exact de la colonne dans votre fichier Excel pour chaque champ requis. Les correspondances sont insensibles à la casse.
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 20, border: '2px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editing ? 'Modifier le template' : 'Nouveau template'}</h3>
            <button className="btn btn-ghost btn-icon" onClick={resetForm}><X size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Banque *</label>
              <select className="select" value={form.banque_id} onChange={e => setForm(f => ({ ...f, banque_id: e.target.value }))}>
                <option value="">— Sélectionner une banque —</option>
                {banques.map((b: any) => <option key={b.id} value={b.id}>{b.nom}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Nom du template *</label>
              <input className="input" placeholder="Ex: Relevé Standard SGBF" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Ligne d'en-tête</label>
              <input className="input" type="number" min="1" value={form.ligne_entete} onChange={e => setForm(f => ({ ...f, ligne_entete: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Format de date</label>
              <select className="select" value={form.format_date} onChange={e => setForm(f => ({ ...f, format_date: e.target.value }))}>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="DD-MM-YYYY">DD-MM-YYYY</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Mapping des Colonnes</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {COLONNES_REQUISES.map(col => (
                <div key={col.key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: col.key === 'date' || col.key === 'montant' || col.key === 'libelle' ? 'var(--text)' : 'var(--text-muted)' }}>
                    {col.label}
                    {(col.key === 'date' || col.key === 'montant' || col.key === 'libelle') && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
                  </label>
                  <input
                    className="input"
                    placeholder={col.placeholder}
                    value={(form.mapping as any)[col.key] || ''}
                    onChange={e => setForm(f => ({ ...f, mapping: { ...f.mapping, [col.key]: e.target.value } }))}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={resetForm}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!form.banque_id || !form.nom}>
              <Save size={15} /> {editing ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* Templates list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          <FileSpreadsheet size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontWeight: 600, fontSize: 15 }}>Aucun template configuré</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Créez votre premier template pour automatiser l'import des relevés bancaires.</div>
          <button className="btn btn-primary" style={{ margin: '16px auto 0', display: 'flex', gap: 8 }} onClick={() => setShowForm(true)}>
            <Plus size={15} /> Créer un template
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {templates.map(t => (
            <div key={t.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--primary)18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileSpreadsheet size={20} color="var(--primary)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{t.nom}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {t.banque?.nom} · Format: {t.format_date} · En-tête ligne {t.ligne_entete}
                </div>
              </div>
              <span className="badge badge-success">Actif</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => startEdit(t)}><Edit3 size={14} /></button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(t)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
