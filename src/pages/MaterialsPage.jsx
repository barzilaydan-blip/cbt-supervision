import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, orderBy, query,
} from 'firebase/firestore';
import { db } from '../firebase.js';

export const MATERIAL_CATEGORIES = ['שאלונים', 'דפי עבודה', 'מדריכים', 'כלים טיפוליים', 'אחר'];

export default function MaterialsPage() {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', category: 'שאלונים', description: '' });
  const [openDesc, setOpenDesc] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showKebab, setShowKebab] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'materials'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q,
      (snap) => { setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      (err) => { console.error(err); setLoading(false); }
    );
    return unsub;
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    const name = form.name.trim();
    const url = form.url.trim();
    if (!name || !url) return;
    setAdding(true);
    setError('');
    try {
      await addDoc(collection(db, 'materials'), {
        name, url, category: form.category,
        description: form.description.trim(),
        createdAt: serverTimestamp(),
      });
      setForm({ name: '', url: '', category: 'שאלונים', description: '' });
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
      setError('שגיאה בהוספת חומר.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id) {
    setConfirmDelete(null);
    try {
      await deleteDoc(doc(db, 'materials', id));
    } catch (err) {
      console.error(err);
      setError('שגיאה במחיקת חומר.');
    }
  }

  const grouped = MATERIAL_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = materials.filter(m => m.category === cat);
    return acc;
  }, {});

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-back" onClick={() => navigate('/')}>&#x2190; חזרה</button>
        <div style={{ flex: 1 }}>
          <h2>📚 ספריית חומרים</h2>
          <div className="subtitle">ניהול חומרי עזר לטיפול</div>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            className="patient-header-kebab"
            onClick={() => setShowKebab(v => !v)}
            title="תפריט"
          >
            ⋮
          </button>
          {showKebab && (
            <div className="patient-gear-dropdown">
              <button
                className="patient-gear-item"
                onClick={() => { navigate('/materials'); setShowKebab(false); }}
              >
                📚 ספריית חומרים
              </button>
              <button
                className="patient-gear-item"
                onClick={() => { navigate('/'); setShowKebab(false); }}
              >
                👥 מטפלים
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      <div className="page-actions">
        <button className="btn btn-primary" onClick={() => setShowAddForm(v => !v)}>
          {showAddForm ? '✕ סגור' : '+ הוסף חומר'}
        </button>
      </div>

      {showAddForm && (
        <div className="add-form">
          <form onSubmit={handleAdd}>
            <div className="form-group">
              <label>שם החומר</label>
              <input
                className="form-input" type="text" placeholder="למשל: שאלון דיכאון PHQ-9"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>קישור Google Drive</label>
              <input
                className="form-input" type="url" placeholder="https://drive.google.com/..."
                value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>קטגוריה</label>
              <select className="form-input" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {MATERIAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>תיאור (אופציונלי)</label>
              <textarea
                className="form-input"
                placeholder="תיאור קצר של החומר..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <button type="submit" className="btn btn-primary"
              disabled={adding || !form.name.trim() || !form.url.trim()}>
              {adding ? 'מוסיף...' : 'הוסף'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading-wrapper"><div className="spinner" /><span>טוען...</span></div>
      ) : materials.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <p>אין חומרים עדיין. הוסף חומר ראשון.</p>
        </div>
      ) : (
        MATERIAL_CATEGORIES.map(cat => grouped[cat].length > 0 && (
          <div key={cat} className="section">
            <div className="section-title">{cat}</div>
            <div className="card-list">
              {grouped[cat].map(m => (
                <div key={m.id} className="material-card">
                  <div className="card">
                    <div className="card-body">
                      <div className="card-title">{m.name}</div>
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="card-meta">
                        🔗 פתח קישור
                      </a>
                    </div>
                    <div className="card-actions">
                      <button
                        className="material-eye-btn"
                        onClick={() => setOpenDesc(openDesc === m.id ? null : m.id)}
                        title="תיאור"
                      >
                        👁
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(m.id)}>
                        🗑 מחק
                      </button>
                    </div>
                  </div>
                  {openDesc === m.id && (
                    <div className="material-desc-panel">
                      {m.description?.trim()
                        ? m.description
                        : <span className="material-desc-empty">אין מידע נוסף</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {confirmDelete && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <h3>אישור מחיקה</h3>
            <p>האם אתה בטוח שברצונך למחוק חומר זה?</p>
            <div className="confirm-dialog-actions">
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>מחק</button>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
