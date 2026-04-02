import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc, getDoc, serverTimestamp, orderBy, query,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { sendMaterialsEmail } from '../utils/emailService.js';

export const MATERIAL_CATEGORIES = ['שאלונים', 'דפי עבודה', 'מדריכים', 'כלים טיפוליים', 'אחר'];

export default function MaterialsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromUrl = searchParams.get('from');       // e.g. /supervision-session/xxx
  const sendTherapistId = searchParams.get('therapistId');
  const sendMode = !!fromUrl;

  const [therapistForSend, setTherapistForSend] = useState(null);
  const [selectedMaterials, setSelectedMaterials] = useState(new Set());
  const [sendLoading, setSendLoading] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState('');

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
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', url: '', category: 'שאלונים', description: '' });
  const [editTags, setEditTags] = useState([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteTag, setConfirmDeleteTag] = useState(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiMeta, setAiMeta] = useState(null);
  const [aiStep, setAiStep] = useState('idle'); // idle | generating | preview
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'materials'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q,
      (snap) => { setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      (err) => { console.error(err); setLoading(false); }
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (!sendTherapistId) return;
    getDoc(doc(db, 'therapists', sendTherapistId))
      .then(snap => { if (snap.exists()) setTherapistForSend({ id: snap.id, ...snap.data() }); })
      .catch(console.error);
  }, [sendTherapistId]);

  function toggleMaterial(id) {
    setSelectedMaterials(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSendMaterials() {
    if (!therapistForSend?.email || selectedMaterials.size === 0) return;
    setSendLoading(true);
    setSendError('');
    try {
      const selected = materials.filter(m => selectedMaterials.has(m.id));
      const materialsList = selected.map(m => `• ${m.name}${m.url ? ': ' + m.url : ''}`).join('\n');
      await sendMaterialsEmail({
        therapistEmail: therapistForSend.email,
        therapistName: therapistForSend.name || '',
        materialsList,
      });
      setSendSuccess(true);
      setTimeout(() => { setSendSuccess(false); navigate(fromUrl); }, 2000);
    } catch (err) {
      console.error(err);
      setSendError('שגיאה בשליחת המייל. נסה שנית.');
    } finally {
      setSendLoading(false);
    }
  }

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

  function openEdit(m) {
    setEditingMaterial(m);
    setEditForm({ name: m.name || '', url: m.url || '', category: m.category || 'שאלונים', description: m.description || '' });
    setEditTags(m.tags || []);
    setEditTagInput('');
  }

  function addEditTag() {
    const tag = editTagInput.trim().replace(/,+$/, '');
    if (!tag || editTags.includes(tag)) { setEditTagInput(''); return; }
    setEditTags(prev => [...prev, tag]);
    setEditTagInput('');
  }

  function handleEditTagKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); addEditTag(); }
    if (e.key === ',') { e.preventDefault(); addEditTag(); }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    const name = editForm.name.trim();
    const url = editForm.url.trim();
    if (!name) return;
    setSaving(true);
    setError('');
    try {
      await updateDoc(doc(db, 'materials', editingMaterial.id), {
        name, url, category: editForm.category,
        description: editForm.description.trim(),
        tags: editTags,
      });
      setEditingMaterial(null);
    } catch (err) {
      console.error(err);
      setError('שגיאה בעדכון חומר.');
    } finally {
      setSaving(false);
    }
  }

  function toggleActiveTag(tag) {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  async function handleDeleteTag(tag) {
    setConfirmDeleteTag(null);
    const affected = materials.filter(m => m.tags?.includes(tag));
    try {
      await Promise.all(affected.map(m =>
        updateDoc(doc(db, 'materials', m.id), {
          tags: m.tags.filter(t => t !== tag),
        })
      ));
      setActiveTags(prev => prev.filter(t => t !== tag));
    } catch (err) {
      console.error(err);
      setError('שגיאה במחיקת התגית.');
    }
  }

  async function handleGenerate() {
    if (!aiPrompt.trim()) return;
    setAiStep('generating');
    setAiError('');
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({
        apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true,
      });
      const msg = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `אתה פסיכולוג CBT מנוסה שיוצר חומרים טיפוליים בעברית.
בקשה: ${aiPrompt}

הנחיות עיצוב:
- השתמש בכותרות ברורות (עם ===, ---, או **)
- השתמש בטבלאות כשמתאים (למשל: עמודות של מצב/מחשבה/תחושה/תגובה)
- השתמש ברשימות ממוספרות או בנקודות
- הוסף שאלות מובנות ומקומות לכתיבה (_____)
- הפוך את החומר לשמיש ומושך ויזואלית
- כתוב בעברית ברורה ומקצועית

בסוף הוסף בלוק JSON כזה בדיוק (אל תשנה את המבנה):
===JSON===
{"suggestedName": "...", "suggestedCategory": "...", "suggestedTags": [...]}
===END===`,
        }],
      });
      const fullText = msg.content[0].text;
      const jsonMatch = fullText.match(/===JSON===\s*([\s\S]*?)\s*===END===/);
      let meta = { suggestedName: '', suggestedCategory: 'דפי עבודה', suggestedTags: [] };
      let mainText = fullText;
      if (jsonMatch) {
        try { meta = JSON.parse(jsonMatch[1]); } catch {}
        mainText = fullText.replace(/===JSON===[\s\S]*?===END===/g, '').trim();
      }
      setAiResult(mainText);
      setAiMeta({
        name: meta.suggestedName || '',
        category: MATERIAL_CATEGORIES.includes(meta.suggestedCategory) ? meta.suggestedCategory : 'דפי עבודה',
        tags: Array.isArray(meta.suggestedTags) ? meta.suggestedTags : [],
      });
      setAiStep('preview');
    } catch (err) {
      console.error(err);
      setAiError('שגיאה ביצירת החומר. נסה שנית.');
      setAiStep('idle');
    }
  }

  async function handleAiSave() {
    if (!aiMeta?.name?.trim()) return;
    setSaving(true);
    setAiError('');
    try {
      await addDoc(collection(db, 'materials'), {
        name: aiMeta.name.trim(),
        url: '',
        category: aiMeta.category,
        description: aiResult,
        tags: aiMeta.tags,
        createdAt: serverTimestamp(),
      });
      setShowAiPanel(false);
      setAiPrompt('');
      setAiResult('');
      setAiMeta(null);
      setAiStep('idle');
      setAiError('');
    } catch (err) {
      console.error(err);
      setAiError('שגיאה בשמירה.');
    } finally {
      setSaving(false);
    }
  }

  const RECENT_COUNT = 5;
  const recentMaterials = materials.slice(0, RECENT_COUNT);

  const allTags = [...new Set(materials.flatMap(m => m.tags || []))].sort();

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
      <div className={`material-card${sendMode && selectedMaterials.has(m.id) ? ' material-card-selected' : ''}`}
        onClick={sendMode ? () => toggleMaterial(m.id) : undefined}
        style={sendMode ? { cursor: 'pointer' } : undefined}
      >
        <div className="card">
          <div className="card-body">
            {sendMode && (
              <input type="checkbox" className="material-send-checkbox"
                checked={selectedMaterials.has(m.id)}
                onChange={() => toggleMaterial(m.id)}
                onClick={e => e.stopPropagation()}
              />
            )}
            <div className="card-title">{m.name}</div>
            {m.url && (
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="card-meta">
                🔗 פתח קישור
              </a>
            )}
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
              onClick={e => { e.currentTarget.blur(); setOpenDesc(openDesc === m.id ? null : m.id); }}
              title="תיאור"
            >
              👁
            </button>
            <button
              className="material-eye-btn"
              onClick={() => openEdit(m)}
              title="עריכה"
            >
              ✏️
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
        <button className="btn-back" onClick={() => navigate(sendMode ? fromUrl : '/')}>&#x2190; {sendMode ? 'חזרה למפגש' : 'חזרה'}</button>
        <div style={{ flex: 1 }}>
          <h2>📚 ספריית חומרים</h2>
          <div className="subtitle">{sendMode && therapistForSend ? `שליחה ל: ${therapistForSend.name}` : 'ניהול חומרי עזר לטיפול'}</div>
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

      {sendMode && (
        <div className="materials-send-bar">
          <span className="materials-send-label">סמן חומרים לשליחה:</span>
          <div style={{ flex: 1 }} />
          {sendError && <span className="materials-send-error">⚠️ {sendError}</span>}
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSendMaterials}
            disabled={sendLoading || sendSuccess || selectedMaterials.size === 0 || !therapistForSend?.email}
          >
            {sendSuccess ? '✅ נשלח!' : sendLoading ? '⏳ שולח...' : `📧 שלח ${selectedMaterials.size > 0 ? `(${selectedMaterials.size})` : ''}`}
          </button>
          {!therapistForSend?.email && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>אין כתובת מייל למטפל</span>
          )}
        </div>
      )}

      {!sendMode && <div className="page-actions">
        <button className="btn btn-primary" onClick={() => { setShowAddForm(v => !v); setShowAiPanel(false); }}>
          {showAddForm ? '✕ סגור' : '+ הוסף חומר'}
        </button>
        <button className="btn btn-secondary" onClick={() => { setShowAiPanel(v => !v); setShowAddForm(false); setAiStep('idle'); setAiError(''); }}>
          {showAiPanel ? '✕ סגור' : '🤖 צור עם AI'}
        </button>
      </div>}

      {showAiPanel && (
        <div className="add-form ai-panel">
          <div className="ai-panel-title">🤖 יצירת חומר עם Claude</div>
          {aiStep === 'idle' && (
            <>
              <div className="form-group">
                <label>תאר מה תרצה ליצור</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="למשל: צור דף עבודה לזיהוי מחשבות אוטומטיות שליליות..."
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  autoFocus
                />
              </div>
              {aiError && <div className="alert alert-error">⚠️ {aiError}</div>}
              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={!aiPrompt.trim()}
              >
                ▶ צור
              </button>
            </>
          )}
          {aiStep === 'generating' && (
            <div className="loading-wrapper">
              <div className="spinner" />
              <span>Claude יוצר את החומר...</span>
            </div>
          )}
          {aiStep === 'preview' && aiMeta && (
            <>
              <div className="form-group">
                <label>תוצאה שנוצרה</label>
                <div className="ai-result-preview">
                  <ReactMarkdown>{aiResult}</ReactMarkdown>
                </div>
              </div>
              <div className="form-group">
                <label>שם החומר</label>
                <input
                  className="form-input"
                  type="text"
                  value={aiMeta.name}
                  onChange={e => setAiMeta(m => ({ ...m, name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>קטגוריה</label>
                <select
                  className="form-input"
                  value={aiMeta.category}
                  onChange={e => setAiMeta(m => ({ ...m, category: e.target.value }))}
                >
                  {MATERIAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>תגיות</label>
                <div className="material-chip-row">
                  {aiMeta.tags.map(tag => (
                    <span key={tag} className="material-tag-chip">
                      {tag}
                      <button type="button" onClick={() => setAiMeta(m => ({ ...m, tags: m.tags.filter(t => t !== tag) }))}>×</button>
                    </span>
                  ))}
                </div>
              </div>
              {aiError && <div className="alert alert-error">⚠️ {aiError}</div>}
              <div className="ai-panel-actions">
                <button className="btn btn-primary" onClick={handleAiSave} disabled={saving || !aiMeta.name.trim()}>
                  {saving ? 'שומר...' : '✅ שמור לספרייה'}
                </button>
                <button className="btn btn-secondary" onClick={() => { setAiStep('idle'); setAiError(''); }}>
                  🔄 נסה שוב
                </button>
                <button className="btn btn-secondary" onClick={() => { setShowAiPanel(false); setAiStep('idle'); setAiError(''); }}>
                  ✕ בטל
                </button>
              </div>
            </>
          )}
        </div>
      )}

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
              {allTags.filter(t => !formTags.includes(t)).length > 0 && (
                <div className="tag-suggestions">
                  <span className="tag-suggestions-label">תגיות קיימות:</span>
                  {allTags.filter(t => !formTags.includes(t)).map(t => (
                    <button type="button" key={t} className="tag-suggestion-pill"
                      onClick={() => setFormTags(prev => [...prev, t])}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
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
        <>
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
          {allTags.length > 0 && (
            <div className="all-tags-row">
              {allTags.map(tag => (
                <span key={tag} className={`material-tag-pill-wrap${activeTags.includes(tag) ? ' active' : ''}`}>
                  <button
                    className="material-tag-pill-label"
                    onClick={() => toggleActiveTag(tag)}
                    title={activeTags.includes(tag) ? 'הסר פילטר' : 'סנן לפי תגית'}
                  >
                    {tag}
                  </button>
                  <button
                    className="material-tag-pill-delete"
                    onClick={() => setConfirmDeleteTag(tag)}
                    title="מחק תגית מהמערכת"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </>
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
        <div className="section">
          <div className="section-title" style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
            {RECENT_COUNT} החומרים האחרונים שעלו
          </div>
          <div className="card-list">
            {recentMaterials.map(m => <MaterialCard key={m.id} m={m} />)}
          </div>
          {materials.length > RECENT_COUNT && (
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                חפש או סנן לפי תגית כדי לראות את כל {materials.length} החומרים
              </span>
            </div>
          )}
        </div>
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

      {confirmDeleteTag && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <h3>מחיקת תגית</h3>
            <p>האם למחוק את התגית <strong>"{confirmDeleteTag}"</strong> מכל החומרים?<br/>
              ({materials.filter(m => m.tags?.includes(confirmDeleteTag)).length} חומרים יושפעו)
            </p>
            <div className="confirm-dialog-actions">
              <button className="btn btn-danger" onClick={() => handleDeleteTag(confirmDeleteTag)}>מחק</button>
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteTag(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {editingMaterial && (
        <div className="confirm-overlay" onClick={() => setEditingMaterial(null)}>
          <div className="material-edit-dialog" onClick={e => e.stopPropagation()}>
            <h3>עריכת חומר</h3>
            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label>שם החומר</label>
                <input
                  className="form-input" type="text"
                  value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>קישור</label>
                <input
                  className="form-input" type="url"
                  value={editForm.url} onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>קטגוריה</label>
                <select className="form-input" value={editForm.category}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                  {MATERIAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>תיאור</label>
                <textarea
                  className="form-input"
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>תגיות</label>
                {editTags.length > 0 && (
                  <div className="edit-tags-list">
                    {editTags.map(tag => (
                      <div key={tag} className="edit-tag-row">
                        <span className="edit-tag-label">{tag}</span>
                        <button
                          type="button"
                          className="edit-tag-remove"
                          onClick={() => setEditTags(prev => prev.filter(t => t !== tag))}
                        >
                          הסר
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {allTags.filter(t => !editTags.includes(t)).length > 0 && (
                  <div className="tag-suggestions" style={{ marginTop: editTags.length ? '8px' : '0' }}>
                    <span className="tag-suggestions-label">הוסף תגית:</span>
                    {allTags.filter(t => !editTags.includes(t)).map(t => (
                      <button type="button" key={t} className="tag-suggestion-pill"
                        onClick={() => setEditTags(prev => [...prev, t])}>
                        + {t}
                      </button>
                    ))}
                  </div>
                )}
                <div className="material-chip-row" style={{ marginTop: '8px' }}>
                  <input
                    className="material-chip-input"
                    type="text"
                    placeholder="הקלד תגית חדשה ולחץ Enter..."
                    value={editTagInput}
                    onChange={e => setEditTagInput(e.target.value)}
                    onKeyDown={handleEditTagKeyDown}
                    onBlur={addEditTag}
                  />
                </div>
              </div>
              <div className="confirm-dialog-actions">
                <button type="submit" className="btn btn-primary" disabled={saving || !editForm.name.trim()}>
                  {saving ? 'שומר...' : 'שמור'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingMaterial(null)}>ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
