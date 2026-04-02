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
  const [showGearMenu, setShowGearMenu] = useState(false);
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
      const sessionsWithContent = sessions.filter(s =>
        s.date && Object.values(s.notes || {}).some(v => v?.trim())
      );
      await exportPatientPDF({ patientName: patient.name, therapistName: therapist.name, sessions: sessionsWithContent });
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
    });
    setEditingSessionId(s.id);
  }

  async function handleSaveSession(sessionId) {
    setSavingSession(true);
    try {
      await updateDoc(doc(db, 'sessions', sessionId), { notes: editDraft });
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

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-back" onClick={() => navigate(patient ? `/therapist/${patient.therapistId}` : '/')}>
          &#x2190; חזרה
        </button>
        <div style={{ flex: 1 }}>
          <h2>{patient ? patient.name : 'טוען...'}</h2>
          <div className="subtitle">{therapist ? `מטפל: ${therapist.name}` : ''}</div>
        </div>
        {patient?.therapistId && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/supervision-session/${patient.therapistId}?patientId=${patientId}`)}
          >
            ▶ הזן מפגש
          </button>
        )}
        <div style={{ position: 'relative' }}>
          <button
            className="patient-header-kebab"
            onClick={() => setShowGearMenu(v => !v)}
            title="פעולות"
          >
            ⋮
          </button>
          {showGearMenu && (
            <div className="patient-gear-dropdown">
              <button
                className="patient-gear-item"
                onClick={() => { handleExportPDF(); setShowGearMenu(false); }}
                disabled={pdfLoading || sessions.length === 0 || !therapist}
              >
                {pdfLoading ? '⏳ מייצא...' : '📄 ייצוא PDF'}
              </button>
              <button
                className="patient-gear-item"
                onClick={() => { sendFormEmail(); setShowGearMenu(false); }}
                disabled={!patient}
              >
                {emailSent ? '✅ המייל נשלח!' : therapist?.email ? '📧 שלח טופס המשגה' : '🔗 העתק לינק להמשגה'}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}
      {emailError && <div className="alert alert-error">⚠️ {emailError}</div>}

      {/* היסטוריית הדרכות כרונולוגית */}
      {loading ? (
        <div className="loading-wrapper"><div className="spinner" /><span>טוען נתונים...</span></div>
      ) : sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>אין הדרכות עדיין.</p>
        </div>
      ) : (
        <div className="patient-sessions-timeline">
          {[...sessions]
            .filter(s => s.date)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((s, idx) => {
              const n = s.notes || {};
              const isNew = !!(n.report || n.issues || n.recommendations);
              const newFields = [
                { label: 'דיווח המודרך',          value: n.report },
                { label: 'סוגיות ודילמות',         value: n.issues },
                { label: 'המלצות וצעדים הבאים',   value: n.recommendations },
              ];
              const legacyFields = Object.entries(n)
                .filter(([k, v]) => typeof v === 'string' && v.trim() && !['report','issues','recommendations','dangerNote'].includes(k));
              const tags = n.tags ? Object.entries(n.tags).filter(([,v]) => v).map(([k]) => k) : [];
              const tagLabels = { motivation:'מוטיבציה', treatmentGoals:'מטרות טיפול', interventionTech:'טכניקות התערבות', theoreticalKnow:'ידע תיאורטי', treatmentPlanning:'תכנון טיפול', homework:'שיעורי בית', conceptualization:'המשגה' };
              const isExpanded = !!expandedAreas[s.id];

              const isEditing = editingSessionId === s.id;

              return (
                <div key={s.id} className="pt-session-card">
                  <div className="pt-session-header" onClick={() => !isEditing && toggleArea(s.id)}>
                    <div className="pt-session-header-right">
                      <span className="pt-session-num">#{idx + 1}</span>
                      <span className="pt-session-date">📅 {formatDate(s.date)}</span>
                      {n.danger && <span className="pt-danger-badge">⚠️ מסוכנות</span>}
                      {tags.length > 0 && tags.map(t => (
                        <span key={t} className="pt-tag-badge">{tagLabels[t] || t}</span>
                      ))}
                    </div>
                    <div className="pt-session-header-left">
                      {!isEditing && (
                        <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); startEditing(s); if (!isExpanded) toggleArea(s.id); }}>✏️</button>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); setConfirmDelete(s); }}>🗑</button>
                      {!isEditing && <span className="pt-chevron">{isExpanded ? '▲' : '▼'}</span>}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="pt-session-body pt-session-edit">
                      {SESSION_FIELDS.map(f => (
                        <div key={f.key} className="pt-field">
                          <div className="pt-field-label">{f.label}</div>
                          <textarea
                            className="pt-edit-textarea"
                            value={editDraft[f.key] || ''}
                            onChange={e => setEditDraft(d => ({ ...d, [f.key]: e.target.value }))}
                            rows={3}
                          />
                        </div>
                      ))}
                      <div className="pt-field">
                        <div className="pt-field-label">נושאים שנדונו</div>
                        <div className="pt-edit-tags">
                          {QUICK_TAGS.map(t => (
                            <label key={t.key} className={`pt-edit-tag${editDraft.tags?.[t.key] ? ' checked' : ''}`}>
                              <input
                                type="checkbox"
                                checked={!!editDraft.tags?.[t.key]}
                                onChange={e => setEditDraft(d => ({ ...d, tags: { ...d.tags, [t.key]: e.target.checked } }))}
                                style={{ display: 'none' }}
                              />
                              {t.label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="pt-field">
                        <label className={`pt-edit-tag${editDraft.danger ? ' checked danger' : ''}`}>
                          <input
                            type="checkbox"
                            checked={!!editDraft.danger}
                            onChange={e => setEditDraft(d => ({ ...d, danger: e.target.checked }))}
                            style={{ display: 'none' }}
                          />
                          ⚠️ מסוכנות
                        </label>
                        {editDraft.danger && (
                          <textarea
                            className="pt-edit-textarea"
                            style={{ marginTop: 6 }}
                            placeholder="הערת מסוכנות..."
                            value={editDraft.dangerNote || ''}
                            onChange={e => setEditDraft(d => ({ ...d, dangerNote: e.target.value }))}
                            rows={2}
                          />
                        )}
                      </div>
                      <div className="pt-edit-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => handleSaveSession(s.id)} disabled={savingSession}>
                          {savingSession ? '⏳ שומר...' : '✅ שמור'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingSessionId(null)}>ביטול</button>
                      </div>
                    </div>
                  ) : isExpanded && (
                    <div className="pt-session-body">
                      {isNew ? (
                        newFields.filter(f => f.value?.trim()).map(f => (
                          <div key={f.label} className="pt-field">
                            <div className="pt-field-label">{f.label}</div>
                            <div className="pt-field-value">{f.value}</div>
                          </div>
                        ))
                      ) : (
                        legacyFields.map(([k, v]) => (
                          <div key={k} className="pt-field">
                            <div className="pt-field-value">{v}</div>
                          </div>
                        ))
                      )}
                      {n.danger && n.dangerNote && (
                        <div className="pt-field pt-field-danger">
                          <div className="pt-field-label">⚠️ הערת מסוכנות</div>
                          <div className="pt-field-value">{n.dangerNote}</div>
                        </div>
                      )}
                      {s.summary && (
                        <div className="pt-field pt-field-summary">
                          <div className="pt-field-label">סיכום</div>
                          <div className="pt-field-value">{s.summary}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* המשגות */}
      {conceptualizations.length > 0 && (
        <div className="sessions-manager-section" style={{ marginTop: 16 }}>
          <button className="sessions-manager-toggle" onClick={() => setShowConceptualizations(v => !v)}>
            🧩 המשגות שהוגשו ({conceptualizations.length})
            <span style={{ marginRight: '8px' }}>{showConceptualizations ? '▲' : '▼'}</span>
          </button>
          {showConceptualizations && (
            <div className="sessions-manager-list">
              {[...conceptualizations]
                .sort((a, b) => (a.submittedAt?.toDate?.() || 0) - (b.submittedAt?.toDate?.() || 0))
                .map(c => (
                  <div key={c.id} className="concept-entry">
                    <div className="concept-entry-date">📅 {formatTimestamp(c.submittedAt)}</div>
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
