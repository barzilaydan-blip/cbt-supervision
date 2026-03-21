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
  const [formTags, setFormTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [openDesc, setOpenDesc] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showKebab, setShowKebab] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTags, setActiveTags] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'materials'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q,
      (snap) => { setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      (err) => { console.error(err); setLoading(false); }
    );
    return unsub;
  }, []);

  function addFormTag() {
    const tag = tagInput.trim().replace(/,+$/, '');
    if (!tag || formTags.includes(tag)) { setTagInput(''); return; }
    setFormTags(prev => [...prev, tag]);
    setTagInput('');
  }

  function handleTagInputKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); addFormTag(); }
    if (e.key === ',') { e.preventDefault(); addFormTag(); }
  }

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
        tags: formTags,
        createdAt: serverTimestamp(),
      });
      setForm({ name: '', url: '', category: 'שאלונים', description: '' });
      setFormTags([]);
      setTagInput('');
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

  function toggleActiveTag(tag) {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  const isFiltering = search.trim() !== '' || activeTags.length > 0;

  const filtered = materials.filter(m => {
    const text = search.trim().toLowerCase();
    const matchesText = !text ||
      m.name?.toLowerCase().includes(text) ||
      m.description?.toLowerCase().includes(text) ||
      m.tags?.some(t => t.toLowerCase().includes(text));
    const matchesTags = activeTags.every(t => m.tags?.includes(t));
    return matchesText && matchesTags;
  });

  const grouped = MATERIAL_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = materials.filter(m => m.category === cat);
    return acc;
  }, {});

  function MaterialCard({ m }) {
    return (
      <div className="material-card">
        <div className="card">
          <div className="card-body">
            <div className="card-title">{m.name}</div>
            <a href={m.url} target="_blank" rel="noopener noreferrer" className="card-meta">
              🔗 פתח קישור
            </a>
            {m.tags?.length > 0 && (
              <div className="material-tags-row">
                {m.tags.map(tag => (
                  <button
                    key={tag}
                    className={`material-tag-pill${activeTags.includes(tag) ? ' active' : ''}`}
                    onClick={() => toggleActiveTag(tag)}
                    title={activeTags.includes(tag) ? 'הסר פילטר' : 'סנן לפי תגית'}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
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
    );
  }

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
              <button className="patient-gear-item" onClick={() => { navigate('/materials'); setShowKebab(false); }}>
                📚 ספריית חומרים
              </button>
              <button className="patient-gear-item" onClick={() => { navigate('/'); setShowKebab(false); }}>
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
            <div className="form-group">
              <label>תגיות (אופציונלי)</label>
              <div className="material-chip-row">
                {formTags.map(tag => (
                  <span key={tag} className="material-tag-chip">
                    {tag}
                    <button type="button" onClick={() => setFormTags(prev => prev.filter(t => t !== tag))}>×</button>
                  </span>
                ))}
                <input
                  className="material-chip-input"
                  type="text"
                  placeholder="הקלד תגית ולחץ Enter..."
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  onBlur={addFormTag}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary"
              disabled={adding || !form.name.trim() || !form.url.trim()}>
              {adding ? 'מוסיף...' : 'הוסף'}
            </button>
          </form>
        </div>
      )}

      {/* Search row */}
      {!loading && materials.length > 0 && (
        <div className="materials-search-row">
          <input
            className="materials-search-input"
            type="text"
            placeholder="🔍 חיפוש חומרים..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {activeTags.map(tag => (
            <button key={tag} className="active-tag-pill" onClick={() => toggleActiveTag(tag)}>
              {tag} ×
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading-wrapper"><div className="spinner" /><span>טוען...</span></div>
      ) : materials.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <p>אין חומרים עדיין. הוסף חומר ראשון.</p>
        </div>
      ) : isFiltering ? (
        <div className="section">
          <div className="section-title" style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
            נמצאו {filtered.length} תוצאות
          </div>
          <div className="card-list">
            {filtered.length === 0
              ? <div className="focus-area-empty">לא נמצאו חומרים התואמים לחיפוש.</div>
              : filtered.map(m => <MaterialCard key={m.id} m={m} />)
            }
          </div>
        </div>
      ) : (
        MATERIAL_CATEGORIES.map(cat => grouped[cat].length > 0 && (
          <div key={cat} className="section">
            <div className="section-title">{cat}</div>
            <div className="card-list">
              {grouped[cat].map(m => <MaterialCard key={m.id} m={m} />)}
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
