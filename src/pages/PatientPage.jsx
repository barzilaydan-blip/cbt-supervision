import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  getDoc,
  query,
  where,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { FOCUS_AREAS, CONCEPTUALIZATION_SECTIONS } from '../constants.js';
import { exportPatientPDF } from '../utils/exportPDF.js';
import { sendFormEmail as sendFormEmailUtil } from '../utils/emailService.js';

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay">
      <div className="confirm-dialog">
        <h3>אישור מחיקה</h3>
        <p>{message}</p>
        <div className="confirm-dialog-actions">
          <button className="btn btn-danger" onClick={onConfirm}>מחק</button>
          <button className="btn btn-secondary" onClick={onCancel}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

const TAG_LABELS = {
  motivation: 'מוטיבציה', treatmentGoals: 'מטרות טיפול',
  interventionTech: 'טכניקות התערבות', theoreticalKnow: 'ידע תיאורטי',
  treatmentPlanning: 'תכנון טיפול', homework: 'שיעורי בית', conceptualization: 'המשגה',
};

// Saved at the end of a meeting; editable afterwards like the notes
const SUMMARY_FIELDS = [
  { key: 'summary', label: 'סיכום' },
  { key: 'supervisorRecs', label: 'המלצות למדריך למפגש הבא' },
];

function getTodayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function PatientPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [therapist, setTherapist] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [addingSession, setAddingSession] = useState(false);
  const [showAddSessionForm, setShowAddSessionForm] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState('');
  const [showSessionsManager, setShowSessionsManager] = useState(false);

  // איסוף מידע פתוח כברירת מחדל, שאר המוקדים סגורים
  const [expandedAreas, setExpandedAreas] = useState({ informationGathering: true });
  const [conceptualizations, setConceptualizations] = useState([]);
  const [showConceptualizations, setShowConceptualizations] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [savingSession, setSavingSession] = useState(false);

  const SESSION_FIELDS = [
    { key: 'report', label: 'דיווח המודרך' },
    { key: 'issues', label: 'סוגיות ודילמות' },
    { key: 'recommendations', label: 'המלצות וצעדים הבאים' },
  ];
  const QUICK_TAGS = [
    { key: 'motivation', label: 'מוטיבציה' },
    { key: 'treatmentGoals', label: 'מטרות טיפול' },
    { key: 'interventionTech', label: 'טכניקות התערבות' },
    { key: 'theoreticalKnow', label: 'ידע תיאורטי' },
    { key: 'treatmentPlanning', label: 'תכנון טיפול' },
    { key: 'homework', label: 'שיעורי בית' },
    { key: 'conceptualization', label: 'המשגה' },
  ];

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, 'patients', patientId))
      .then(async (snap) => {
        if (!snap.exists()) { navigate('/'); return; }
        const patientData = { id: snap.id, ...snap.data() };
        if (!cancelled) setPatient(patientData);
        if (patientData.therapistId) {
          const tSnap = await getDoc(doc(db, 'therapists', patientData.therapistId));
          if (!cancelled && tSnap.exists()) setTherapist({ id: tSnap.id, ...tSnap.data() });
        }
      })
      .catch((err) => { console.error(err); if (!cancelled) setError('שגיאה בטעינת נתוני המטופל.'); });
    return () => { cancelled = true; };
  }, [patientId, navigate]);

  useEffect(() => {
    const q = query(collection(db, 'conceptualizations'), where('patientId', '==', patientId));
    const unsub = onSnapshot(q,
      (snap) => setConceptualizations(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error(err)
    );
    return unsub;
  }, [patientId]);

  useEffect(() => {
    const q = query(
      collection(db, 'sessions'),
      where('patientId', '==', patientId),
      orderBy('date', 'asc')
    );
    const unsub = onSnapshot(q,
      (snap) => { setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); },
      (err) => { console.error(err); setError('שגיאה בטעינת ההדרכות.'); setLoading(false); }
    );
    return unsub;
  }, [patientId]);

  function handleAddSession() {
    setNewSessionDate(getTodayString());
    setShowAddSessionForm(true);
  }

  async function handleConfirmAddSession() {
    if (!patient || !newSessionDate) return;
    const duplicate = sessions.find(s => s.date === newSessionDate);
    if (duplicate) {
      setShowAddSessionForm(false);
      navigate(`/session/${duplicate.id}`);
      return;
    }
    setAddingSession(true);
    setError('');
    try {
      const newSession = await addDoc(collection(db, 'sessions'), {
        patientId,
        therapistId: patient.therapistId,
        date: newSessionDate,
        notes: {},
        createdAt: serverTimestamp(),
      });
      setShowAddSessionForm(false);
      navigate(`/session/${newSession.id}`);
    } catch (err) {
      console.error(err);
      setError('שגיאה ביצירת הדרכה חדשה. נסה שנית.');
    } finally {
      setAddingSession(false);
    }
  }

  async function handleDeleteSession(session) {
    setConfirmDelete(null);
    try {
      await deleteDoc(doc(db, 'sessions', session.id));
    } catch (err) {
      console.error(err);
      setError('שגיאה במחיקת ההדרכה. נסה שנית.');
    }
  }

  async function handleExportPDF() {
    if (!patient || !therapist) return;
    setPdfLoading(true);
    try {
      // Every dated supervision, oldest first, so the numbering matches this page
      const dated = sessions.filter(s => s.date).sort((a, b) => a.date.localeCompare(b.date));
      await exportPatientPDF({ patientName: patient.name, therapistName: therapist.name, sessions: dated });
    } catch (err) {
      console.error(err);
      setError('שגיאה ביצוא PDF. נסה שנית.');
    } finally {
      setPdfLoading(false);
    }
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

  function toggleArea(key) {
    setExpandedAreas((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function sendFormEmail() {
    const base = window.location.href.split('#')[0];
    const link = `${base}#/form/${patientId}`;
    setEmailError('');

    if (therapist && therapist.email) {
      try {
        await sendFormEmailUtil({
          therapistEmail: therapist.email,
          therapistName: therapist.name || ((therapist.firstName || '') + ' ' + (therapist.lastName || '')).trim(),
          patientName: patient ? patient.name : '',
          formLink: link,
        });
        setEmailSent(true);
        setTimeout(() => setEmailSent(false), 4000);
      } catch (err) {
        console.error(err);
        setEmailError('שגיאה בשליחת המייל. נסה שנית.');
        setTimeout(() => setEmailError(''), 4000);
      }
    } else {
      navigator.clipboard.writeText(link).then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 3000);
      });
    }
  }

  function startEditing(s) {
    const n = s.notes || {};
    setEditDraft({
      report: n.report || '',
      issues: n.issues || '',
      recommendations: n.recommendations || '',
      danger: n.danger || false,
      dangerNote: n.dangerNote || '',
      tags: { ...(n.tags || {}) },
      summary: s.summary || '',
      supervisorRecs: s.supervisorRecs || '',
    });
    setEditingSessionId(s.id);
  }

  async function handleSaveSession(sessionId) {
    setSavingSession(true);
    try {
      // The summary and the supervisor's follow-up live beside the notes, not inside them
      const { summary, supervisorRecs, ...notes } = editDraft;
      await updateDoc(doc(db, 'sessions', sessionId), { notes, summary, supervisorRecs });
      setEditingSessionId(null);
    } catch (err) {
      console.error(err);
      setError('שגיאה בשמירת ההדרכה. נסה שנית.');
    } finally {
      setSavingSession(false);
    }
  }

  function formatTimestamp(ts) {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // מסנן פגישות שיש בהן תוכן למוקד מסוים
  function sessionsForArea(key) {
    return sessions.filter((s) => s.notes && s.notes[key] && s.notes[key].trim());
  }

  // Numbered oldest-first, shown newest-first
  const numbered = sessions
    .filter(s => s.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s, i) => ({ s, number: i + 1 }))
    .reverse();

  const formLabel = emailSent ? 'המייל נשלח' : therapist?.email ? 'שלח טופס המשגה' : 'העתק קישור לטופס המשגה';

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head-main">
          <button className="page-head-back" onClick={() => navigate(patient ? `/therapist/${patient.therapistId}` : '/')}>
            &#x2192; {therapist ? therapist.name : 'חזרה'}
          </button>
          <h1>{patient ? patient.name : 'טוען...'}</h1>
          <div className="page-head-meta">
            {numbered.length === 0 ? 'עדיין אין הדרכות' : numbered.length === 1 ? 'הדרכה אחת' : `${numbered.length} הדרכות`}
          </div>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-secondary" onClick={sendFormEmail} disabled={!patient}>{formLabel}</button>
          <button className="btn btn-secondary" onClick={handleExportPDF} disabled={pdfLoading || sessions.length === 0 || !therapist}>
            {pdfLoading ? 'מייצא...' : 'ייצוא PDF'}
          </button>
          {patient?.therapistId && (
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/supervision-session/${patient.therapistId}?patientId=${patientId}`)}
            >
              פתח מפגש הדרכה
            </button>
          )}
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {emailError && <div className="alert alert-error">{emailError}</div>}

      {patient?.background && (
        <section className="sheet">
          <div className="sup-block-label">פרופיל</div>
          <div className="sup-profile-content">{patient.background}</div>
        </section>
      )}

      {/* Supervision history, newest first */}
      {loading ? (
        <div className="sheet" aria-busy="true">
          <div className="sup-skeleton" /><div className="sup-skeleton" /><div className="sup-skeleton short" />
        </div>
      ) : numbered.length === 0 ? (
        <div className="empty-state">
          <p>עדיין לא תועדה הדרכה על המטופל. פתח מפגש הדרכה כדי לכתוב את הראשונה.</p>
        </div>
      ) : (
        <div className="sheet">
          <ol className="sup-days">
            {numbered.map(({ s, number }) => {
              const n = s.notes || {};
              const [year, month, day] = s.date.split('-');
              const fields = [
                { label: 'דיווח המודרך', value: n.report },
                { label: 'סוגיות ודילמות', value: n.issues },
                { label: 'המלצות וצעדים הבאים', value: n.recommendations },
                // Notes saved before the three-field structure existed
                ...Object.entries(n)
                  .filter(([k, v]) => typeof v === 'string' && !['report', 'issues', 'recommendations', 'dangerNote'].includes(k))
                  .map(([, v]) => ({ label: '', value: v })),
                { label: 'סיכום', value: s.summary },
                { label: 'המלצות למדריך למפגש הבא', value: s.supervisorRecs },
              ].filter(f => f.value?.trim());
              const tags = n.tags ? Object.entries(n.tags).filter(([, v]) => v).map(([k]) => k) : [];
              const isExpanded = !!expandedAreas[s.id];
              const isEditing = editingSessionId === s.id;
              const preview = (s.summary || n.report || fields[0]?.value || '').split('\n')[0];

              return (
                <li key={s.id} className="sup-day">
                  <div className="sup-day-date"><b>{day}.{month}</b><span>{year}</span></div>
                  <div className="sup-day-body">
                    <div className="pt-day-head">
                      <button
                        className="pt-day-toggle"
                        aria-expanded={isExpanded || isEditing}
                        onClick={() => !isEditing && toggleArea(s.id)}
                      >
                        <span className="sup-day-num">הדרכה {number}</span>
                        {n.danger && <span className="pt-flag-risk">מסוכנות</span>}
                        {tags.map(t => <span key={t} className="pt-tag">{TAG_LABELS[t] || t}</span>)}
                      </button>
                      <span className="pt-day-actions">
                        {!isEditing && (
                          <button className="link-btn" onClick={() => { startEditing(s); if (!isExpanded) toggleArea(s.id); }}>עריכה</button>
                        )}
                        <button className="link-btn danger" onClick={() => setConfirmDelete(s)}>מחק</button>
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="pt-edit">
                        {[...SESSION_FIELDS, ...SUMMARY_FIELDS].map(f => (
                          <div key={f.key} className="sup-field-block">
                            <label className="sup-field-label" htmlFor={`edit-${s.id}-${f.key}`}>{f.label}</label>
                            <textarea
                              id={`edit-${s.id}-${f.key}`}
                              className="sup-field-textarea"
                              value={editDraft[f.key] || ''}
                              onChange={e => setEditDraft(d => ({ ...d, [f.key]: e.target.value }))}
                              rows={3}
                            />
                          </div>
                        ))}
                        <div className="sup-tags-bar">
                          <label className={`sup-tag-chip sup-tag-danger${editDraft.danger ? ' checked' : ''}`}>
                            <input
                              type="checkbox"
                              checked={!!editDraft.danger}
                              onChange={e => setEditDraft(d => ({ ...d, danger: e.target.checked }))}
                            />
                            מסוכנות
                          </label>
                          {QUICK_TAGS.map(t => (
                            <label key={t.key} className={`sup-tag-chip${editDraft.tags?.[t.key] ? ' checked' : ''}`}>
                              <input
                                type="checkbox"
                                checked={!!editDraft.tags?.[t.key]}
                                onChange={e => setEditDraft(d => ({ ...d, tags: { ...d.tags, [t.key]: e.target.checked } }))}
                              />
                              {t.label}
                            </label>
                          ))}
                        </div>
                        {editDraft.danger && (
                          <div className="sup-danger-note">
                            <textarea
                              className="sup-field-textarea"
                              aria-label="פירוט סוגיית המסוכנות"
                              placeholder="פרט את סוגיית המסוכנות"
                              value={editDraft.dangerNote || ''}
                              onChange={e => setEditDraft(d => ({ ...d, dangerNote: e.target.value }))}
                              rows={2}
                            />
                          </div>
                        )}
                        <div className="pt-edit-actions">
                          <button className="btn btn-primary btn-sm" onClick={() => handleSaveSession(s.id)} disabled={savingSession}>
                            {savingSession ? 'שומר...' : 'שמור'}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingSessionId(null)}>ביטול</button>
                        </div>
                      </div>
                    ) : isExpanded ? (
                      <>
                        {n.danger && n.dangerNote && (
                          <>
                            <div className="sup-day-label pt-risk-text">הערת מסוכנות</div>
                            <div className="sup-day-text">{n.dangerNote}</div>
                          </>
                        )}
                        {fields.map((f, i) => (
                          <React.Fragment key={i}>
                            {f.label && <div className="sup-day-label">{f.label}</div>}
                            <div className="sup-day-text">{f.value}</div>
                          </React.Fragment>
                        ))}
                        {fields.length === 0 && <div className="sup-day-line">לא נשמר תוכן להדרכה זו.</div>}
                      </>
                    ) : (
                      preview && <div className="sup-day-line">{preview}</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* המשגות */}
      {conceptualizations.length > 0 && (
        <div className="sessions-manager-section" style={{ marginTop: 16 }}>
          <button className="sessions-manager-toggle" onClick={() => setShowConceptualizations(v => !v)}>
            המשגות שהוגשו ({conceptualizations.length})
            <span style={{ marginRight: '8px' }}>{showConceptualizations ? '▲' : '▼'}</span>
          </button>
          {showConceptualizations && (
            <div className="sessions-manager-list">
              {[...conceptualizations]
                .sort((a, b) => (a.submittedAt?.toDate?.() || 0) - (b.submittedAt?.toDate?.() || 0))
                .map(c => (
                  <div key={c.id} className="concept-entry">
                    <div className="concept-entry-date">{formatTimestamp(c.submittedAt)}</div>
                    {CONCEPTUALIZATION_SECTIONS.map(sec => {
                      const hasContent = sec.fields.some(f => c.fields?.[f.key]?.trim());
                      if (!hasContent) return null;
                      return (
                        <div key={sec.section} className="concept-section">
                          <div className="concept-section-title">{sec.section}</div>
                          {sec.fields.map(f => c.fields?.[f.key]?.trim() ? (
                            <div key={f.key} className="concept-field">
                              <span className="concept-field-label">{f.label}:</span>
                              <span className="concept-field-value">{c.fields[f.key]}</span>
                            </div>
                          ) : null)}
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`האם אתה בטוח שברצונך למחוק את ההדרכה מתאריך ${formatDate(confirmDelete.date)}?`}
          onConfirm={() => handleDeleteSession(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {pdfLoading && (
        <div className="pdf-overlay">
          <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
          <span>מייצר PDF... אנא המתן</span>
        </div>
      )}
    </div>
  );
}
