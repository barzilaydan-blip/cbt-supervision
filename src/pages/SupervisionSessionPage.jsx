import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, query,
  where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { rephraseText, generateSessionSummary } from '../utils/aiService.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const SESSION_FIELDS = [
  { key: 'report',          label: 'דיווח המודרך',            placeholder: 'תיעוד דברי המטפל על המפגש עם המטופל...' },
  { key: 'issues',          label: 'סוגיות ודילמות',           placeholder: 'דיון מקצועי, המשגה, שאלות שעלו...' },
  { key: 'recommendations', label: 'המלצות וצעדים הבאים',      placeholder: 'סיכום אופרטיבי — יוצג בפגישה הבאה...' },
];

const QUICK_TAGS = [
  { key: 'motivation',          label: 'מוטיבציה' },
  { key: 'treatmentGoals',      label: 'מטרות טיפול' },
  { key: 'interventionTech',    label: 'טכניקות התערבות' },
  { key: 'theoreticalKnow',     label: 'ידע תיאורטי' },
  { key: 'treatmentPlanning',   label: 'תכנון טיפול' },
  { key: 'homework',            label: 'שיעורי בית' },
  { key: 'conceptualization',   label: 'המשגה' },
];

function emptyDraft() {
  return { report: '', issues: '', recommendations: '', danger: false, dangerNote: '', tags: {} };
}

function getTodayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('he-IL', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return dateStr; }
}

// Extract "last session summary" — supports both new and legacy session structures
function extractLastSessionSummary(session) {
  if (!session) return null;
  const n = session.notes || {};
  // New structure
  if (n.recommendations?.trim()) return { type: 'new', text: n.recommendations };
  // Legacy: any filled FOCUS_AREAS field
  const legacy = Object.entries(n)
    .filter(([, v]) => typeof v === 'string' && v.trim())
    .map(([k, v]) => ({ key: k, text: v }));
  if (legacy.length > 0) return { type: 'legacy', items: legacy };
  return null;
}

export default function SupervisionSessionPage() {
  const { therapistId } = useParams();
  const navigate = useNavigate();

  const [therapist, setTherapist] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const STORAGE_KEY = `sup_draft_${therapistId}`;

  function loadStoredDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  const stored = loadStoredDraft();
  const [date, setDate] = useState(stored?.date || getTodayString());
  const [selectedPatientId, setSelectedPatientId] = useState(null);

  // { [patientId]: { report, issues, recommendations, danger, dangerNote, tags } }
  const [draftNotes, setDraftNotes] = useState(stored?.draftNotes || {});
  // { [patientId]: session | null }
  const [lastSessions, setLastSessions] = useState({});
  const [loadingLastSession, setLoadingLastSession] = useState({});
  const [lastSessionOpen, setLastSessionOpen] = useState(true);

  const [aiLoading, setAiLoading] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  // { [patientId]: sessionId } — existing sessions on the current date
  const [existingSessionIds, setExistingSessionIds] = useState({});

  // Session summary
  const [sessionSummary, setSessionSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Profile editing
  const [editingBackground, setEditingBackground] = useState(false);
  const [backgroundDraft, setBackgroundDraft] = useState('');
  const [savingBackground, setSavingBackground] = useState(false);

  // ─── Auto-save draft to localStorage ─────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date, draftNotes }));
    } catch { /* quota exceeded — ignore */ }
  }, [date, draftNotes]);

  // ─── Load therapist + patients ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const tSnap = await getDoc(doc(db, 'therapists', therapistId));
        if (!tSnap.exists()) { navigate('/'); return; }
        if (!cancelled) setTherapist({ id: tSnap.id, ...tSnap.data() });

        const pSnap = await getDocs(
          query(collection(db, 'patients'), where('therapistId', '==', therapistId))
        );
        const list = pSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));
        if (!cancelled) {
          setPatients(list);
          if (list.length > 0) setSelectedPatientId(list[0].id);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) { setError('שגיאה בטעינת נתונים.'); setLoading(false); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [therapistId, navigate]);

  // ─── When date changes reset cached last-sessions so they're re-fetched with correct filter ──
  useEffect(() => {
    setLastSessions({});
    setExistingSessionIds({});
  }, [date]);

  // ─── Check for existing sessions on the current date; pre-fill drafts ─────────
  useEffect(() => {
    if (!patients.length) return;
    const newIds = {};
    Promise.all(patients.map(async (p) => {
      const snap = await getDocs(
        query(collection(db, 'sessions'), where('patientId', '==', p.id), where('date', '==', date))
      );
      if (!snap.empty) {
        const sessionDoc = snap.docs[0];
        newIds[p.id] = sessionDoc.id;
        // Pre-populate draft only if the draft is currently empty
        setDraftNotes(prev => {
          const cur = prev[p.id];
          const hasMeaningful = cur && (cur.report?.trim() || cur.issues?.trim() || cur.recommendations?.trim());
          if (hasMeaningful) return prev;
          const n = sessionDoc.data().notes || {};
          return {
            ...prev,
            [p.id]: {
              report: n.report || '',
              issues: n.issues || '',
              recommendations: n.recommendations || '',
              danger: n.danger || false,
              dangerNote: n.dangerNote || '',
              tags: { ...(n.tags || {}) },
            },
          };
        });
      } else {
        newIds[p.id] = null;
      }
    })).then(() => setExistingSessionIds(newIds)).catch(console.error);
  }, [date, patients]);

  // ─── Load last session per patient (on demand, excludes current date) ─────────
  useEffect(() => {
    if (!selectedPatientId || lastSessions[selectedPatientId] !== undefined) return;
    const pid = selectedPatientId;
    setLoadingLastSession(prev => ({ ...prev, [pid]: true }));
    getDocs(query(collection(db, 'sessions'), where('patientId', '==', pid)))
      .then(snap => {
        const docs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => d.date && d.date < date)   // exclude today's session
          .sort((a, b) => b.date.localeCompare(a.date));
        setLastSessions(prev => ({ ...prev, [pid]: docs.length > 0 ? docs[0] : null }));
      })
      .catch(err => {
        console.error('lastSession load error:', err);
        setLastSessions(prev => ({ ...prev, [pid]: null }));
      })
      .finally(() => setLoadingLastSession(prev => ({ ...prev, [pid]: false })));
  }, [selectedPatientId, lastSessions]);

  // ─── Draft helpers ────────────────────────────────────────────────────────────
  const updateDraft = useCallback((patientId, field, value) => {
    setDraftNotes(prev => ({
      ...prev,
      [patientId]: { ...(prev[patientId] || emptyDraft()), [field]: value },
    }));
  }, []);

  const updateTag = useCallback((patientId, tagKey, checked) => {
    setDraftNotes(prev => {
      const cur = prev[patientId] || emptyDraft();
      return { ...prev, [patientId]: { ...cur, tags: { ...cur.tags, [tagKey]: checked } } };
    });
  }, []);

  function hasDraft(patientId) {
    const d = draftNotes[patientId] || {};
    return !!(d.report?.trim() || d.issues?.trim() || d.recommendations?.trim() || d.danger);
  }

  function hasAnyDraft() { return patients.some(p => hasDraft(p.id)); }

  // ─── AI rephrase ──────────────────────────────────────────────────────────────
  async function handleRephrase(fieldKey) {
    const text = (draftNotes[selectedPatientId] || {})[fieldKey];
    if (!text?.trim()) return;
    setAiLoading(prev => ({ ...prev, [fieldKey]: true }));
    try {
      const rephrased = await rephraseText(text);
      updateDraft(selectedPatientId, fieldKey, rephrased);
    } catch (err) { console.error(err); }
    finally { setAiLoading(prev => ({ ...prev, [fieldKey]: false })); }
  }

  // ─── Save all ─────────────────────────────────────────────────────────────────
  async function handleFinish() {
    if (!hasAnyDraft()) { navigate(`/therapist/${therapistId}`); return; }
    setSaving(true);
    setError('');
    try {
      const supSessionRef = await addDoc(collection(db, 'supervisionSessions'), {
        therapistId, date, createdAt: serverTimestamp(),
      });
      await Promise.all(
        patients.filter(p => hasDraft(p.id)).map(p => {
          const d = draftNotes[p.id] || emptyDraft();
          const notes = {
            report: d.report || '',
            issues: d.issues || '',
            recommendations: d.recommendations || '',
            danger: d.danger || false,
            dangerNote: d.dangerNote || '',
            tags: d.tags || {},
          };
          const existingId = existingSessionIds[p.id];
          if (existingId) {
            // Session already exists on this date — update it
            return updateDoc(doc(db, 'sessions', existingId), { notes });
          }
          return addDoc(collection(db, 'sessions'), {
            patientId: p.id, therapistId,
            supervisionSessionId: supSessionRef.id,
            date,
            notes,
            createdAt: serverTimestamp(),
          });
        })
      );
      localStorage.removeItem(STORAGE_KEY);
      setSaved(true);
      setTimeout(() => navigate(`/therapist/${therapistId}`), 1500);
    } catch (err) {
      console.error(err);
      setError('שגיאה בשמירה. נסה שנית.');
      setSaving(false);
    }
  }

  // ─── Session summary ──────────────────────────────────────────────────────────
  async function handleGenerateSummary() {
    const d = draftNotes[selectedPatientId] || emptyDraft();
    const parts = [
      d.report?.trim()          && `דיווח המודרך:\n${d.report}`,
      d.issues?.trim()          && `סוגיות ודילמות:\n${d.issues}`,
      d.recommendations?.trim() && `המלצות וצעדים הבאים:\n${d.recommendations}`,
    ].filter(Boolean);
    if (!parts.length) return;
    setSummaryLoading(true);
    setSessionSummary('');
    try {
      const summary = await generateSessionSummary({
        patientName:   selectedPatient?.name,
        therapistName: therapist?.name,
        date:          formatDate(date),
        notes:         parts.join('\n\n'),
      });
      setSessionSummary(summary);
    } catch (err) { console.error(err); }
    finally { setSummaryLoading(false); }
  }

  // ─── Profile save ─────────────────────────────────────────────────────────────
  async function handleSaveBackground() {
    if (!selectedPatientId) return;
    setSavingBackground(true);
    try {
      await updateDoc(doc(db, 'patients', selectedPatientId), { background: backgroundDraft });
      setPatients(prev => prev.map(p =>
        p.id === selectedPatientId ? { ...p, background: backgroundDraft } : p
      ));
      setEditingBackground(false);
    } catch (err) { console.error(err); }
    finally { setSavingBackground(false); }
  }

  // ─── Switch patient ───────────────────────────────────────────────────────────
  function selectPatient(id) {
    setSelectedPatientId(id);
    setLastSessionOpen(true);
    setEditingBackground(false);
  }

  const selectedPatient = patients.find(p => p.id === selectedPatientId);
  const currentDraft    = draftNotes[selectedPatientId] || emptyDraft();
  const lastSession     = lastSessions[selectedPatientId];
  const lastSummary     = extractLastSessionSummary(lastSession);

  if (loading) {
    return (
      <div className="loading-wrapper" style={{ minHeight: '60vh', justifyContent: 'center' }}>
        <div className="spinner" /><span>טוען מפגש הדרכה...</span>
      </div>
    );
  }

  return (
    <div className="sup-session-page">
      {/* ── Header ── */}
      <div className="sup-session-header">
        <div className="sup-session-header-right">
          <button className="btn-back" onClick={() => hasAnyDraft() ? setConfirmExit(true) : navigate(`/therapist/${therapistId}`)}>
            &#x2190; חזרה
          </button>
          <div>
            <div className="sup-session-title">מפגש הדרכה</div>
            <div className="sup-session-therapist">{therapist?.name}</div>
          </div>
        </div>
        <div className="sup-session-header-left">
          <label className="sup-date-label">תאריך:</label>
          <input type="date" className="form-input sup-date-input" value={date} onChange={e => setDate(e.target.value)} />
          <button className="btn btn-primary sup-finish-btn" onClick={handleFinish} disabled={saving || saved}>
            {saved ? '✅ נשמר!' : saving ? '⏳ שומר...' : '💾 סיום מפגש ושמירה'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ margin: '0 16px 12px' }}>⚠️ {error}</div>}

      {/* ── Body ── */}
      <div className="sup-session-body">

        {/* Content */}
        <div className="sup-session-content">
          {!selectedPatient ? (
            <div className="focus-area-empty">בחר מטופל מהרשימה</div>
          ) : (
            <>
              {/* Context row: profile + last session side by side */}
              <div className="sup-context-row">

                {/* Patient profile */}
                <div className="sup-profile-card">
                  <div className="sup-profile-header">
                    <span>🗂 פרופיל — {selectedPatient.name}</span>
                    {!editingBackground && (
                      <div className="sup-profile-edit-btn" role="button" tabIndex={0}
                        onClick={() => { setBackgroundDraft(selectedPatient.background || ''); setEditingBackground(true); }}
                        onKeyDown={e => e.key === 'Enter' && (() => { setBackgroundDraft(selectedPatient.background || ''); setEditingBackground(true); })()}
                      >
                        ✏️ {selectedPatient.background ? 'ערוך' : '+ הוסף'}
                      </div>
                    )}
                  </div>
                  {editingBackground ? (
                    <div className="sup-profile-edit">
                      <textarea className="sup-profile-textarea" rows={4}
                        value={backgroundDraft} onChange={e => setBackgroundDraft(e.target.value)}
                        placeholder="אבחנה, מטרות טיפוליות, רקע רלוונטי..."
                      />
                      <div className="sup-profile-edit-actions">
                        <button className="btn btn-primary btn-sm" onClick={handleSaveBackground} disabled={savingBackground}>
                          {savingBackground ? '⏳...' : '💾 שמור'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingBackground(false)}>ביטול</button>
                      </div>
                    </div>
                  ) : selectedPatient.background ? (
                    <div className="sup-profile-content">{selectedPatient.background}</div>
                  ) : (
                    <div className="sup-profile-empty">לחץ "+ הוסף" להזנת פרופיל.</div>
                  )}
                </div>

                {/* Last session */}
                <div className="sup-last-session-card">
                  <div className="sup-last-session-toggle" role="button" tabIndex={0}
                    onClick={() => setLastSessionOpen(o => !o)}
                    onKeyDown={e => e.key === 'Enter' && setLastSessionOpen(o => !o)}
                  >
                    <span>📋 פגישה קודמת</span>
                    <span>{lastSessionOpen ? '▲' : '▼'}</span>
                  </div>
                  {lastSessionOpen && (
                    <div className="sup-last-session-body">
                      {loadingLastSession[selectedPatientId] ? (
                        <div className="loading-wrapper"><div className="spinner" /></div>
                      ) : !lastSummary ? (
                        <div className="focus-area-empty">אין הדרכות קודמות.</div>
                      ) : (
                        <>
                          <div className="sup-last-session-date">📅 {formatDate(lastSession.date)}</div>
                          {lastSummary.type === 'new' ? (
                            <div className="sup-last-session-field">
                              <div className="sup-last-session-field-label">המלצות וצעדים הבאים</div>
                              <div className="sup-last-session-field-value">{lastSummary.text}</div>
                            </div>
                          ) : (
                            lastSummary.items.map(item => (
                              <div key={item.key} className="sup-last-session-field">
                                <div className="sup-last-session-field-value">{item.text}</div>
                              </div>
                            ))
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Writing area */}
              <div className="sup-writing-area">
                {SESSION_FIELDS.map(f => (
                  <div key={f.key} className="sup-field-block">
                    <div className="sup-field-label">{f.label}</div>
                    <textarea
                      className="sup-field-textarea"
                      placeholder={f.placeholder}
                      rows={f.key === 'recommendations' ? 4 : 5}
                      value={currentDraft[f.key] || ''}
                      onChange={e => updateDraft(selectedPatientId, f.key, e.target.value)}
                    />
                    <div className="sup-field-actions">
                      <button className="btn btn-ai btn-sm"
                        onClick={() => handleRephrase(f.key)}
                        disabled={aiLoading[f.key] || !currentDraft[f.key]?.trim()}
                      >
                        {aiLoading[f.key] ? '⏳ מנסח...' : '✨ נסח מחדש'}
                      </button>
                    </div>
                  </div>
                ))}

                {/* Quick tags */}
                <div className="sup-tags-bar">
                  {/* Danger checkbox */}
                  <label className={`sup-tag-chip sup-tag-danger${currentDraft.danger ? ' checked' : ''}`}>
                    <input type="checkbox" checked={!!currentDraft.danger}
                      onChange={e => updateDraft(selectedPatientId, 'danger', e.target.checked)} />
                    ⚠️ מסוכנות
                  </label>
                  {QUICK_TAGS.map(t => (
                    <label key={t.key} className={`sup-tag-chip${currentDraft.tags?.[t.key] ? ' checked' : ''}`}>
                      <input type="checkbox" checked={!!currentDraft.tags?.[t.key]}
                        onChange={e => updateTag(selectedPatientId, t.key, e.target.checked)} />
                      {t.label}
                    </label>
                  ))}
                </div>

                {/* Danger note */}
                {currentDraft.danger && (
                  <div className="sup-danger-note">
                    <textarea className="sup-field-textarea" rows={2}
                      placeholder="פרט את סוגיית המסוכנות..."
                      value={currentDraft.dangerNote || ''}
                      onChange={e => updateDraft(selectedPatientId, 'dangerNote', e.target.value)}
                    />
                  </div>
                )}

                {/* AI Summary */}
                <div className="sup-summary-section">
                  <button
                    className="btn btn-ai"
                    onClick={handleGenerateSummary}
                    disabled={summaryLoading || !(currentDraft.report?.trim() || currentDraft.issues?.trim() || currentDraft.recommendations?.trim())}
                  >
                    {summaryLoading ? '⏳ מייצר סיכום...' : '✨ צור סיכום פגישה'}
                  </button>
                  {sessionSummary && (
                    <div className="sup-summary-result">
                      <div className="sup-summary-label">סיכום פגישה:</div>
                      <div className="sup-summary-text">{sessionSummary}</div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="sup-session-sidebar">
          <div className="sup-sidebar-title">מטופלים</div>
          {patients.map(p => (
            <div key={p.id}
              className={`sup-patient-btn${selectedPatientId === p.id ? ' active' : ''}`}
              role="button" tabIndex={0}
              onClick={() => selectPatient(p.id)}
              onKeyDown={e => e.key === 'Enter' && selectPatient(p.id)}
            >
              <span className="sup-patient-name">{p.name}</span>
              {hasDraft(p.id) && <span className="sup-draft-dot" title="יש הערות" />}
            </div>
          ))}
        </div>
      </div>

      {/* Confirm exit */}
      {confirmExit && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <h3>יציאה ללא שמירה?</h3>
            <p>יש הערות שלא נשמרו. לצאת בכל זאת?</p>
            <div className="confirm-dialog-actions">
              <button className="btn btn-danger" onClick={() => navigate(`/therapist/${therapistId}`)}>צא ללא שמירה</button>
              <button className="btn btn-secondary" onClick={() => setConfirmExit(false)}>חזור למפגש</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
