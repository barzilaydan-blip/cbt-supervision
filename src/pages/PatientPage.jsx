import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
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
  const [showSessionsManager, setShowSessionsManager] = useState(false);

  // איסוף מידע פתוח כברירת מחדל, שאר המוקדים סגורים
  const [expandedAreas, setExpandedAreas] = useState({ informationGathering: true });
  const [conceptualizations, setConceptualizations] = useState([]);
  const [showConceptualizations, setShowConceptualizations] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');

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

  async function handleAddSession() {
    if (!patient) return;
    setAddingSession(true);
    setError('');
    try {
      const newSession = await addDoc(collection(db, 'sessions'), {
        patientId,
        therapistId: patient.therapistId,
        date: getTodayString(),
        notes: {},
        createdAt: serverTimestamp(),
      });
      navigate(`/session/${newSession.id}`);
    } catch (err) {
      console.error(err);
      setError('שגיאה ביצירת הדרכה חדשה. נסה שנית.');
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
      await exportPatientPDF({ patientName: patient.name, therapistName: therapist.name, sessions });
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
        <div>
          <h2>{patient ? patient.name : 'טוען...'}</h2>
          <div className="subtitle">{therapist ? `מטפל: ${therapist.name}` : ''}</div>
        </div>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}
      {emailError && <div className="alert alert-error">⚠️ {emailError}</div>}

      <div className="page-actions">
        <button className="btn btn-primary" onClick={handleAddSession} disabled={addingSession || !patient}>
          {addingSession ? 'יוצר...' : '+ הוסף הדרכה'}
        </button>
        <button className="btn btn-pdf" onClick={handleExportPDF} disabled={pdfLoading || sessions.length === 0 || !therapist}>
          {pdfLoading ? '⏳ מייצא...' : '📄 ייצוא PDF'}
        </button>
        <button className="btn btn-concept" onClick={sendFormEmail} disabled={!patient}>
          {emailSent
            ? '✅ המייל נשלח למטפל!'
            : linkCopied
            ? '✅ הלינק הועתק (אין מייל רשום למטפל)'
            : therapist && therapist.email
            ? '📧 שלח טופס המשגה במייל'
            : '🔗 העתק לינק להמשגה'}
        </button>
      </div>

      {/* מוקדי הדרכה */}
      {loading ? (
        <div className="loading-wrapper"><div className="spinner" /><span>טוען נתונים...</span></div>
      ) : (
        <div className="focus-areas-list">
          {FOCUS_AREAS.map((fa) => {
            const isOpen = !!expandedAreas[fa.key];
            const entries = sessionsForArea(fa.key);
            const isInfoGathering = fa.key === 'informationGathering';

            return (
              <div key={fa.key} className={`focus-area-section${isOpen ? ' open' : ''}`}>
                <button
                  className="focus-area-header"
                  onClick={() => toggleArea(fa.key)}
                >
                  <span className="focus-area-label">{fa.label}</span>
                  <span className="focus-area-count">{entries.length > 0 ? `${entries.length} הדרכות` : 'אין תוכן'}</span>
                  <span className="focus-area-arrow">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="focus-area-content">
                    {entries.length === 0 ? (
                      <div className="focus-area-empty">אין תוכן עדיין בנושא זה.</div>
                    ) : (
                      entries.map((s) => (
                        <div key={s.id} className="focus-area-entry">
                          <div className="focus-entry-date">{formatDate(s.date)}</div>
                          <div className="focus-entry-text">{s.notes[fa.key]}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* המשגות שהוגשו */}
      {conceptualizations.length > 0 && (
        <div className="sessions-manager-section">
          <button className="sessions-manager-toggle" onClick={() => setShowConceptualizations((v) => !v)}>
            🧩 המשגות שהוגשו ({conceptualizations.length})
            <span style={{ marginRight: '8px' }}>{showConceptualizations ? '▲' : '▼'}</span>
          </button>
          {showConceptualizations && (
            <div className="sessions-manager-list">
              {[...conceptualizations]
                .sort((a, b) => {
                  const ta = a.submittedAt?.toDate?.() || 0;
                  const tb = b.submittedAt?.toDate?.() || 0;
                  return tb - ta;
                })
                .map((c) => (
                  <div key={c.id} className="concept-entry">
                    <div className="concept-entry-date">📅 {formatTimestamp(c.submittedAt)}</div>
                    {CONCEPTUALIZATION_SECTIONS.map((sec) => {
                      const hasContent = sec.fields.some((f) => c.fields?.[f.key]?.trim());
                      if (!hasContent) return null;
                      return (
                        <div key={sec.section} className="concept-section">
                          <div className="concept-section-title">{sec.section}</div>
                          {sec.fields.map((f) => c.fields?.[f.key]?.trim() ? (
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

      {/* ניהול הדרכות */}
      <div className="sessions-manager-section">
        <button
          className="sessions-manager-toggle"
          onClick={() => setShowSessionsManager((v) => !v)}
        >
          🗂 ניהול הדרכות ({sessions.length})
          <span style={{ marginRight: '8px' }}>{showSessionsManager ? '▲' : '▼'}</span>
        </button>

        {showSessionsManager && (
          <div className="sessions-manager-list">
            {sessions.length === 0 ? (
              <div className="focus-area-empty">אין הדרכות עדיין.</div>
            ) : (
              [...sessions].reverse().map((s) => (
                <div key={s.id} className="session-card">
                  <div className="session-card-header">
                    <span className="session-date-badge">{formatDate(s.date)}</span>
                    <div className="session-card-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/session/${s.id}`)}>עריכה</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(s)}>🗑 מחק</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

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
