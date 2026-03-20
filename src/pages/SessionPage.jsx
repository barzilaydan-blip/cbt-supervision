import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { FOCUS_AREAS } from '../constants.js';
import { rephraseText, getTherapeuticRecommendations, generateSessionSummary } from '../utils/aiService.js';

export default function SessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [patient, setPatient] = useState(null);
  const [therapist, setTherapist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  // Local editable state
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'sessions', sessionId),
      async (snap) => {
        if (!snap.exists()) {
          navigate('/');
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        setSession(data);
        setDate(data.date || '');
        setNotes(data.notes || {});
        if (data.summary) setSessionSummary(prev => prev || data.summary);
        setLoading(false);

        // Load patient + therapist once
        try {
          if (data.patientId && !patient) {
            const pSnap = await getDoc(doc(db, 'patients', data.patientId));
            if (pSnap.exists()) setPatient({ id: pSnap.id, ...pSnap.data() });
          }
          if (data.therapistId && !therapist) {
            const tSnap = await getDoc(doc(db, 'therapists', data.therapistId));
            if (tSnap.exists()) setTherapist({ id: tSnap.id, ...tSnap.data() });
          }
        } catch (err) {
          console.error(err);
        }
      },
      (err) => {
        console.error(err);
        setError('שגיאה בטעינת ההדרכה.');
        setLoading(false);
      }
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleNoteChange = useCallback((key, value) => {
    setNotes((prev) => ({ ...prev, [key]: value }));
  }, []);

  async function handleSave() {
    if (!session) return;
    setSaving(true);
    setSaveSuccess(false);
    setError('');
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        date,
        notes,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError('שגיאה בשמירת ההדרכה. נסה שנית.');
    } finally {
      setSaving(false);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-');
      return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('he-IL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  const patientId = session?.patientId;

  const [expandedFields, setExpandedFields] = useState({ informationGathering: true });
  const [aiLoading, setAiLoading] = useState({});
  const [aiRecommendations, setAiRecommendations] = useState('');
  const [aiRecsLoading, setAiRecsLoading] = useState(false);
  const [sessionSummary, setSessionSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  function toggleField(key) {
    setExpandedFields((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleRephrase(key) {
    const text = notes[key];
    if (!text || !text.trim()) return;
    setAiLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const rephrased = await rephraseText(text);
      handleNoteChange(key, rephrased);
    } catch (err) {
      console.error(err);
      setError('שגיאה בניסוח מחדש. נסה שנית.');
    } finally {
      setAiLoading((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function handleRecommendations() {
    const filledNotes = FOCUS_AREAS.filter(fa => notes[fa.key]?.trim())
      .map(fa => `**${fa.label}:** ${notes[fa.key]}`)
      .join('\n\n');
    if (!filledNotes) return;
    setAiRecsLoading(true);
    setAiRecommendations('');
    try {
      const recs = await getTherapeuticRecommendations({
        patientName: patient?.name,
        focusAreaLabel: 'כלל תחומי ההדרכה',
        notes: filledNotes,
        therapistProfession: therapist?.profession,
      });
      setAiRecommendations(recs);
    } catch (err) {
      console.error(err);
      setError('שגיאה בקבלת המלצות. נסה שנית.');
    } finally {
      setAiRecsLoading(false);
    }
  }

  async function handleGenerateSummary() {
    const filledNotes = FOCUS_AREAS.filter(fa => notes[fa.key]?.trim())
      .map(fa => `${fa.label}: ${notes[fa.key]}`)
      .join('\n\n');
    if (!filledNotes) return;
    setSummaryLoading(true);
    setSessionSummary('');
    try {
      const summary = await generateSessionSummary({
        patientName: patient?.name,
        therapistName: therapist?.name,
        date: formatDate(date),
        notes: filledNotes,
      });
      setSessionSummary(summary);
    } catch (err) {
      console.error(err);
      setError('שגיאה ביצירת הסיכום. נסה שנית.');
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleSaveSummary() {
    if (!sessionSummary.trim()) return;
    try {
      await updateDoc(doc(db, 'sessions', sessionId), { summary: sessionSummary });
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <button
          className="btn-back"
          onClick={() => navigate(patientId ? `/patient/${patientId}` : '/')}
        >
          &#x2190; חזרה
        </button>
        <div>
          <h2>
            {loading ? 'טוען...' : `הדרכה${date ? ` – ${formatDate(date)}` : ''}`}
          </h2>
          <div className="subtitle">
            {patient && therapist
              ? `${patient.name} | מטפל: ${therapist.name}`
              : patient ? patient.name : ''}
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}
      {saveSuccess && <div className="alert alert-success">✅ ההדרכה נשמרה בהצלחה!</div>}

      {loading ? (
        <div className="loading-wrapper"><div className="spinner" /><span>טוען הדרכה...</span></div>
      ) : (
        <div className="session-form">
          <div className="session-date-section">
            <label htmlFor="session-date">תאריך הדרכה:</label>
            <input
              id="session-date"
              className="form-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {FOCUS_AREAS.map((fa) => {
            const isOpen = !!expandedFields[fa.key];
            const hasContent = !!(notes[fa.key] && notes[fa.key].trim());
            return (
              <div key={fa.key} className={`session-field-section${isOpen ? ' open' : ''}`}>
                <button
                  className="session-field-header"
                  onClick={() => toggleField(fa.key)}
                >
                  <span className="session-field-label">{fa.label}</span>
                  {hasContent && <span className="session-field-dot" title="יש תוכן" />}
                  <span className="focus-area-arrow">{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div className="session-field-body">
                    <textarea
                      className="focus-area-textarea"
                      placeholder={`הערות בנושא "${fa.label}"...`}
                      value={notes[fa.key] || ''}
                      onChange={(e) => handleNoteChange(fa.key, e.target.value)}
                      rows={4}
                      autoFocus={fa.key === 'informationGathering'}
                    />
                    {notes[fa.key]?.trim() && (
                      <button
                        className="btn-ai-rephrase"
                        onClick={() => handleRephrase(fa.key)}
                        disabled={aiLoading[fa.key]}
                        title="נסח מחדש עם AI"
                      >
                        {aiLoading[fa.key] ? '⏳ מנסח...' : '✨ נסח מחדש'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="session-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: '120px' }}>
              {saving ? '⏳ שומר...' : '💾 שמור'}
            </button>
            <button
              className="btn btn-ai"
              onClick={handleRecommendations}
              disabled={aiRecsLoading}
            >
              {aiRecsLoading ? '⏳ מייצר המלצות...' : '💡 המלצות טיפוליות'}
            </button>
            <button
              className="btn btn-ai"
              onClick={handleGenerateSummary}
              disabled={summaryLoading}
            >
              {summaryLoading ? '⏳ מייצר סיכום...' : '📋 סיכום פגישה'}
            </button>
            <button className="btn btn-secondary" onClick={() => navigate(patientId ? `/patient/${patientId}` : '/')}>
              חזרה למטופל
            </button>
          </div>

          {aiRecommendations && (
            <div className="ai-recommendations-box">
              <div className="ai-recommendations-header">
                <span>💡 המלצות טיפוליות</span>
                <button className="ai-recommendations-close" onClick={() => setAiRecommendations('')}>✕</button>
              </div>
              <div className="ai-recommendations-content">{aiRecommendations}</div>
            </div>
          )}

          {(sessionSummary || summaryLoading) && (
            <div className="session-summary-box">
              <div className="session-summary-header">
                <span>📋 סיכום פגישה</span>
                <button className="ai-recommendations-close" onClick={() => setSessionSummary('')}>✕</button>
              </div>
              <textarea
                className="session-summary-textarea"
                value={sessionSummary}
                onChange={(e) => setSessionSummary(e.target.value)}
                onBlur={handleSaveSummary}
                rows={5}
                placeholder="הסיכום יופיע כאן..."
                disabled={summaryLoading}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
