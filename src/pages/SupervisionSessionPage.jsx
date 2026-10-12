import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, query,
  where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { rephraseText, generateSessionSummary, analyzeSupervisionRecording } from '../utils/aiService.js';
import { startRecording } from '../utils/recorder.js';
import { transcribeSegment, isTranscriptionConfigured } from '../utils/transcriptionService.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const SESSION_FIELDS = [
  { key: 'report',          label: 'דיווח המודרך',            placeholder: 'מה דיווח המטפל על המפגש עם המטופל' },
  { key: 'issues',          label: 'סוגיות ודילמות',           placeholder: 'דיון מקצועי, המשגה, שאלות שעלו' },
  { key: 'recommendations', label: 'המלצות וצעדים הבאים',      placeholder: 'מה סוכם. יוצג במפגש הבא תחת "לעקוב היום"' },
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

function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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

// What a past supervision contributes to the date rail: its main points and
// what to follow up on. Sessions saved before the summary fields existed fall
// back to whatever notes they have.
function entryParts(session) {
  const n = session.notes || {};
  const follow = session.supervisorRecs?.trim()
    || (typeof n.recommendations === 'string' ? n.recommendations.trim() : '');
  if (session.summary?.trim()) return { main: session.summary.trim(), follow };
  const main = Object.entries(n)
    .filter(([k, v]) => k !== 'recommendations' && k !== 'dangerNote' && typeof v === 'string' && v.trim())
    .map(([, v]) => v.trim())
    .join('\n');
  return { main, follow };
}

// 'YYYY-MM-DD' → the two lines of a date on the rail
function railDate(dateStr) {
  const [y, m, d] = (dateStr || '').split('-');
  return { day: `${d}.${m}`, year: y };
}

export default function SupervisionSessionPage() {
  const { therapistId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get('patientId');

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
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId || null);

  // { [patientId]: { report, issues, recommendations, danger, dangerNote, tags } }
  const [draftNotes, setDraftNotes] = useState(stored?.draftNotes || {});
  // { [patientId]: past sessions, newest first } — undefined until loaded
  const [histories, setHistories] = useState({});

  const [aiLoading, setAiLoading] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  // { [patientId]: sessionId } — existing sessions on the current date
  const [existingSessionIds, setExistingSessionIds] = useState({});

  // Recording. The transcript lives in memory only — neither the audio nor the
  // transcript is ever saved; only the reviewed summary is.
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [recNotice, setRecNotice] = useState('');
  const [recordPrompt, setRecordPrompt] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [finishStage, setFinishStage] = useState('');
  const [review, setReview] = useState(null);
  const recorderRef = useRef(null);
  const transcriptRef = useRef([]);       // transcribed text per segment, in order
  const transcribeJobsRef = useRef([]);
  const failedSegmentsRef = useRef(0);

  // General (not patient-specific) notes from the previous supervision meeting
  const [lastGeneral, setLastGeneral] = useState(null);

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
          if (!initialPatientId && list.length > 0) setSelectedPatientId(list[0].id);
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
    setHistories({});
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

  // ─── Load a patient's past sessions (on demand, excludes current date) ────────
  useEffect(() => {
    if (!selectedPatientId || histories[selectedPatientId] !== undefined) return;
    const pid = selectedPatientId;
    getDocs(query(collection(db, 'sessions'), where('patientId', '==', pid)))
      .then(snap => {
        const docs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => d.date && d.date < date)   // exclude today's session
          .sort((a, b) => b.date.localeCompare(a.date));
        setHistories(prev => ({ ...prev, [pid]: docs }));
      })
      .catch(err => {
        console.error('history load error:', err);
        setHistories(prev => ({ ...prev, [pid]: [] }));
      });
  }, [selectedPatientId, histories]);

  // ─── Load general notes from the previous supervision meeting ────────────────
  useEffect(() => {
    let cancelled = false;
    getDocs(query(collection(db, 'supervisionSessions'), where('therapistId', '==', therapistId)))
      .then(snap => {
        const prev = snap.docs
          .map(d => d.data())
          .filter(d => d.date && d.date < date && (d.summary?.trim() || d.supervisorRecs?.trim()))
          .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
        if (!cancelled) setLastGeneral(prev);
      })
      .catch(console.error);
    return () => { cancelled = true; };
  }, [therapistId, date]);

  // ─── Recording ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setRecSeconds(sec => sec + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  // Leaving the page drops the recording
  useEffect(() => () => recorderRef.current?.cancel(), []);

  useEffect(() => {
    if (!recording && !hasRecording) return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [recording, hasRecording]);

  // Each segment is transcribed as soon as it is recorded, then discarded.
  function handleSegment(blob) {
    if (blob.size < 2000) return;   // stopped right after starting — nothing to transcribe
    const index = transcriptRef.current.length;
    transcriptRef.current.push('');
    setHasRecording(true);
    const job = transcribeSegment(blob)
      .catch(() => new Promise(r => setTimeout(r, 3000)).then(() => transcribeSegment(blob)))
      .then(text => { transcriptRef.current[index] = text; })
      .catch(err => {
        console.error('segment transcription failed', err);
        failedSegmentsRef.current += 1;
      });
    transcribeJobsRef.current.push(job);
  }

  async function handleStartRecording(withSystemAudio) {
    setRecordPrompt(false);
    setError('');
    try {
      const rec = await startRecording({
        withSystemAudio,
        onSegment: handleSegment,
        onSystemAudioEnded: () => setRecNotice('שיתוף שמע המחשב הופסק — ממשיך להקליט מהמיקרופון בלבד.'),
      });
      recorderRef.current = rec;
      setRecording(true);
      setRecNotice(withSystemAudio && !rec.hasSystemAudio
        ? 'שמע המחשב לא שותף — מוקלט המיקרופון בלבד. קול המודרך יוקלט רק אם הוא נשמע ברמקולים.'
        : '');
    } catch (err) {
      console.error(err);
      setError('לא ניתן להתחיל הקלטה. יש לאשר לדפדפן גישה למיקרופון.');
    }
  }

  async function handleStopRecording() {
    const rec = recorderRef.current;
    recorderRef.current = null;
    setRecording(false);
    setRecNotice('');
    if (rec) await rec.stop();
  }

  function handleRecordClick() {
    if (recording) { handleStopRecording(); return; }
    if (!isTranscriptionConfigured()) {
      setError('ההקלטה אינה זמינה: לא הוגדר מפתח לשירות התמלול (VITE_OPENAI_API_KEY).');
      return;
    }
    setRecordPrompt(true);
  }

  function discardRecording() {
    transcriptRef.current = [];
    transcribeJobsRef.current = [];
    failedSegmentsRef.current = 0;
    setHasRecording(false);
    setRecSeconds(0);
  }

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

  function hasAnyDraft() { return recording || hasRecording || patients.some(p => hasDraft(p.id)); }

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
  // For each patient with a draft, an AI summary of that patient's part of the
  // meeting is generated and saved on the session (top-level `summary` field —
  // same convention SessionPage/PatientPage already use), so it's available as
  // "פגישה קודמת" the next time a supervision session is opened for them.
  //
  // When the meeting was recorded, the summary comes from the recording instead:
  // the transcript is analysed and shown for review first (see handleFinish),
  // and `rev` carries the reviewed result.
  async function saveAll(rev) {
    const recByPatient = {};
    (rev?.patients || []).forEach(r => { recByPatient[r.patientId] = r; });
    setSaving(true);
    setError('');
    try {
      const supSessionRef = await addDoc(collection(db, 'supervisionSessions'), {
        therapistId, date, createdAt: serverTimestamp(),
        ...(rev?.generalSummary.trim() && { summary: rev.generalSummary.trim() }),
        ...(rev?.generalRecommendations.trim() && { supervisorRecs: rev.generalRecommendations.trim() }),
      });
      await Promise.all(
        patients.filter(p => hasDraft(p.id) || recByPatient[p.id]).map(async (p) => {
          const d = draftNotes[p.id] || emptyDraft();
          const notes = {
            report: d.report || '',
            issues: d.issues || '',
            recommendations: d.recommendations || '',
            danger: d.danger || false,
            dangerNote: d.dangerNote || '',
            tags: d.tags || {},
          };
          const parts = [
            notes.report          && `דיווח המודרך:\n${notes.report}`,
            notes.issues          && `סוגיות ודילמות:\n${notes.issues}`,
            notes.recommendations && `המלצות וצעדים הבאים:\n${notes.recommendations}`,
          ].filter(Boolean);
          const fromRecording = recByPatient[p.id];
          let summary = fromRecording?.summary.trim() || '';
          const supervisorRecs = fromRecording?.recommendations.trim() || '';
          if (!summary && parts.length) {
            try {
              summary = await generateSessionSummary({
                patientName:   p.name,
                therapistName: therapist?.name,
                date:          formatDate(date),
                notes:         parts.join('\n\n'),
              });
            } catch (err) {
              console.error('summary generation failed for patient', p.id, err);
            }
          }
          const payload = {
            notes,
            ...(summary && { summary }),
            ...(supervisorRecs && { supervisorRecs }),
          };
          const existingId = existingSessionIds[p.id];
          if (existingId) {
            // Session already exists on this date — update it
            return updateDoc(doc(db, 'sessions', existingId), payload);
          }
          return addDoc(collection(db, 'sessions'), {
            patientId: p.id, therapistId,
            supervisionSessionId: supSessionRef.id,
            date,
            ...payload,
            createdAt: serverTimestamp(),
          });
        })
      );
      localStorage.removeItem(STORAGE_KEY);
      discardRecording();
      setReview(null);
      setSaved(true);
      setTimeout(() => navigate(`/therapist/${therapistId}`), 1500);
    } catch (err) {
      console.error(err);
      setError('שגיאה בשמירה. נסה שנית.');
      setSaving(false);
    }
  }

  async function handleFinish() {
    if (!hasAnyDraft()) { navigate(`/therapist/${therapistId}`); return; }
    if (!recording && !hasRecording) { saveAll(null); return; }

    setError('');
    try {
      setFinishStage('transcribing');
      await handleStopRecording();
      await Promise.all(transcribeJobsRef.current);
      const transcript = transcriptRef.current
        .map((text, i) => text && `[קטע ${i + 1}]\n${text}`)
        .filter(Boolean)
        .join('\n\n');
      if (!transcript) {
        discardRecording();
        setError('לא התקבל תמליל מההקלטה. לחיצה נוספת על "סיום מפגש ושמירה" תשמור את ההערות שהוקלדו בלבד.');
        return;
      }
      setFinishStage('analyzing');
      const result = await analyzeSupervisionRecording({
        therapistName: therapist?.name,
        date: formatDate(date),
        transcript,
        patients: patients.map(p => {
          const d = draftNotes[p.id] || {};
          return {
            id: p.id,
            name: p.name,
            background: p.background,
            typedNotes: [d.report, d.issues, d.recommendations, d.danger && `מסוכנות: ${d.dangerNote || 'סומנה'}`]
              .filter(Boolean).join('\n'),
          };
        }),
      });
      setReview({
        ...result,
        patients: result.patients.filter(r => patients.some(p => p.id === r.patientId)),
        failedSegments: failedSegmentsRef.current,
      });
    } catch (err) {
      console.error(err);
      setError('שגיאה בניתוח ההקלטה. ההקלטה לא אבדה — נסה שנית.');
    } finally {
      setFinishStage('');
    }
  }

  function updateReview(field, value) {
    setReview(prev => ({ ...prev, [field]: value }));
  }

  function updateReviewPatient(patientId, field, value) {
    setReview(prev => ({
      ...prev,
      patients: prev.patients.map(r => r.patientId === patientId ? { ...r, [field]: value } : r),
    }));
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
    setEditingBackground(false);
  }

  const selectedPatient = patients.find(p => p.id === selectedPatientId);
  const currentDraft    = draftNotes[selectedPatientId] || emptyDraft();
  const history         = histories[selectedPatientId];
  const today           = railDate(date);

  if (loading) {
    return (
      <div className="loading-wrapper" style={{ minHeight: '60vh', justifyContent: 'center' }}>
        <div className="spinner" /><span>טוען מפגש הדרכה...</span>
      </div>
    );
  }

  function leaveMeeting() {
    if (hasAnyDraft()) setConfirmExit(true);
    else navigate(`/therapist/${therapistId}`);
  }

  // One past supervision on the date rail
  function renderEntry(session, index) {
    const { day, year } = railDate(session.date);
    const { main, follow } = entryParts(session);
    const number = history.length - index;
    const isPrevious = index === 0;
    const full = (
      <>
        {main && (
          <>
            <div className="sup-day-label">עיקרי הדברים</div>
            <div className="sup-day-text">{main}</div>
          </>
        )}
        {follow && (
          <>
            <div className="sup-day-label">{isPrevious ? 'לעקוב היום' : 'המלצות וצעדים הבאים'}</div>
            <div className="sup-day-text">{follow}</div>
          </>
        )}
        {!main && !follow && <div className="sup-day-line">לא נשמר תוכן להדרכה זו.</div>}
      </>
    );
    return (
      <li key={session.id} className="sup-day">
        <div className="sup-day-date"><b>{day}</b><span>{year}</span></div>
        <div className="sup-day-body">
          {isPrevious ? (
            <>
              <span className="sup-day-num">הדרכה {number} · המפגש הקודם</span>
              {full}
            </>
          ) : (
            <details>
              <summary>
                <span className="sup-day-num">הדרכה {number}</span>
                <span className="sup-day-line">{(main || follow).split('\n')[0]}</span>
              </summary>
              {full}
            </details>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className="sup-session-page">
      {/* ── Patient rail ── */}
      <aside className="sup-rail">
        <button className="sup-rail-back" onClick={leaveMeeting}>&#x2192; חזרה למודרך</button>
        <div className="sup-rail-meet">
          <div className="sup-rail-therapist">{therapist?.name}</div>
          <label className="sup-rail-kicker" htmlFor="sup-meeting-date">תאריך מפגש ההדרכה</label>
          <input
            type="date"
            id="sup-meeting-date"
            className="sup-date-input"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        <div className="sup-rail-title">מטופלים</div>
        {patients.map(p => (
          <button
            key={p.id}
            className={`sup-patient-btn${selectedPatientId === p.id ? ' active' : ''}`}
            aria-current={selectedPatientId === p.id ? 'true' : undefined}
            onClick={() => selectPatient(p.id)}
          >
            <span className="sup-patient-name">{p.name}</span>
            {draftNotes[p.id]?.danger
              ? <span className="sup-patient-flag risk">מסוכנות</span>
              : hasDraft(p.id) && <span className="sup-patient-flag">נכתב</span>}
          </button>
        ))}
      </aside>

      {/* ── Work area ── */}
      <main className="sup-work">
        <div className="sup-bar">
          <h1 className="sup-bar-name">{selectedPatient ? selectedPatient.name : 'מפגש הדרכה'}</h1>
          {selectedPatient && history && <span className="sup-bar-seq">הדרכה {history.length + 1}</span>}
          <span className="sup-bar-spacer" />
          <button
            className={`btn sup-record-btn${recording ? ' recording' : ''}`}
            onClick={handleRecordClick}
            disabled={saving || saved || !!finishStage}
          >
            <span className="sup-record-dot" aria-hidden="true" />
            {recording
              ? `עצור הקלטה ${formatDuration(recSeconds)}`
              : hasRecording ? `המשך הקלטה (${formatDuration(recSeconds)})` : 'הקלט מפגש'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate(`/materials?from=/supervision-session/${therapistId}&therapistId=${therapistId}`)}
          >
            שלח חומרים
          </button>
          <button className="btn btn-primary" onClick={handleFinish} disabled={saving || saved || !!finishStage}>
            {saved ? 'נשמר'
              : finishStage === 'transcribing' ? 'מתמלל את ההקלטה...'
              : finishStage === 'analyzing' ? 'מנתח את המפגש...'
              : saving ? 'שומר ומסכם...' : 'סיום מפגש ושמירה'}
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {recNotice && <div className="alert alert-info">{recNotice}</div>}

        {!selectedPatient ? (
          <div className="sup-empty">
            {patients.length ? 'בחר מטופל מהרשימה.' : 'למודרך זה עדיין אין מטופלים. אפשר להוסיף מטופל בדף המודרך.'}
          </div>
        ) : (
          <>
            {lastGeneral && (
              <div className="sup-last-general">
                <div className="sup-last-general-title">מהמפגש הקודם, {formatDate(lastGeneral.date)}: כללי</div>
                {lastGeneral.summary && <div>{lastGeneral.summary}</div>}
                {lastGeneral.supervisorRecs && (
                  <>
                    <div className="sup-block-label">לעקוב היום</div>
                    <div>{lastGeneral.supervisorRecs}</div>
                  </>
                )}
              </div>
            )}

            {/* Patient profile */}
            <div className="sup-profile">
              <div className="sup-profile-head">
                <span className="sup-block-label">פרופיל</span>
                {!editingBackground && (
                  <button
                    className="link-btn"
                    onClick={() => { setBackgroundDraft(selectedPatient.background || ''); setEditingBackground(true); }}
                  >
                    {selectedPatient.background ? 'עריכה' : 'הוספת פרופיל'}
                  </button>
                )}
              </div>
              {editingBackground ? (
                <div>
                  <textarea className="sup-profile-textarea" rows={4}
                    value={backgroundDraft} onChange={e => setBackgroundDraft(e.target.value)}
                    placeholder="אבחנה, מטרות טיפוליות, רקע רלוונטי"
                  />
                  <div className="sup-profile-edit-actions">
                    <button className="btn btn-primary btn-sm" onClick={handleSaveBackground} disabled={savingBackground}>
                      {savingBackground ? 'שומר...' : 'שמור'}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingBackground(false)}>ביטול</button>
                  </div>
                </div>
              ) : selectedPatient.background ? (
                <div className="sup-profile-content">{selectedPatient.background}</div>
              ) : (
                <div className="sup-profile-empty">עדיין לא נכתב פרופיל למטופל.</div>
              )}
            </div>

            {/* Writing fields */}
            {SESSION_FIELDS.map(f => (
              <div key={f.key} className="sup-field-block">
                <div className="sup-field-head">
                  <label className="sup-field-label" htmlFor={`sup-field-${f.key}`}>{f.label}</label>
                  <button className="link-btn"
                    onClick={() => handleRephrase(f.key)}
                    disabled={aiLoading[f.key] || !currentDraft[f.key]?.trim()}
                    hidden={!currentDraft[f.key]?.trim()}
                  >
                    {aiLoading[f.key] ? 'מנסח...' : 'נסח מחדש'}
                  </button>
                </div>
                <textarea
                  id={`sup-field-${f.key}`}
                  className="sup-field-textarea"
                  placeholder={f.placeholder}
                  rows={f.key === 'recommendations' ? 3 : 4}
                  value={currentDraft[f.key] || ''}
                  onChange={e => updateDraft(selectedPatientId, f.key, e.target.value)}
                />
              </div>
            ))}

            {/* Quick tags */}
            <div className="sup-tags-bar">
              <label className={`sup-tag-chip sup-tag-danger${currentDraft.danger ? ' checked' : ''}`}>
                <input type="checkbox" checked={!!currentDraft.danger}
                  onChange={e => updateDraft(selectedPatientId, 'danger', e.target.checked)} />
                מסוכנות
              </label>
              {QUICK_TAGS.map(t => (
                <label key={t.key} className={`sup-tag-chip${currentDraft.tags?.[t.key] ? ' checked' : ''}`}>
                  <input type="checkbox" checked={!!currentDraft.tags?.[t.key]}
                    onChange={e => updateTag(selectedPatientId, t.key, e.target.checked)} />
                  {t.label}
                </label>
              ))}
            </div>

            {currentDraft.danger && (
              <div className="sup-danger-note">
                <textarea className="sup-field-textarea" rows={2}
                  aria-label="פירוט סוגיית המסוכנות"
                  placeholder="פרט את סוגיית המסוכנות"
                  value={currentDraft.dangerNote || ''}
                  onChange={e => updateDraft(selectedPatientId, 'dangerNote', e.target.value)}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Date rail ── */}
      <aside className="sup-dates" aria-label="רצף ההדרכות">
        {selectedPatient && (
          <>
            <h2 className="sup-dates-title">רצף ההדרכות של {selectedPatient.name}</h2>
            <ol className="sup-days">
              <li className="sup-day today">
                <div className="sup-day-date"><b>{today.day}</b><span>{today.year}</span></div>
                <div className="sup-day-body">
                  <span className="sup-day-mark">היום</span>
                  {history && <span className="sup-day-num">הדרכה {history.length + 1}</span>}
                </div>
              </li>
              {history === undefined ? (
                <li className="sup-day-note" aria-busy="true">
                  <div className="sup-skeleton" /><div className="sup-skeleton" /><div className="sup-skeleton short" />
                </li>
              ) : history.length === 0 ? (
                <li className="sup-day-note">זו ההדרכה הראשונה של המטופל. מה שייכתב היום יופיע כאן במפגש הבא.</li>
              ) : history.map(renderEntry)}
            </ol>
          </>
        )}
      </aside>

      {/* Recording: how is the meeting held? */}
      {recordPrompt && (
        <div className="confirm-overlay">
          <div className="confirm-dialog sup-record-dialog">
            <h3>הקלטת המפגש</h3>
            <p>
              ההקלטה משמשת רק להפקת הסיכום. הקלטת הקול והתמליל אינם נשמרים.
              יש ליידע את המודרך שהמפגש מוקלט.
            </p>
            <button className="btn btn-primary sup-record-option" onClick={() => handleStartRecording(true)}>
              מפגש בזום
              <span>בחלון שייפתח: בחר "מסך מלא" וסמן "שתף גם את שמע המערכת"</span>
            </button>
            <button className="btn btn-secondary sup-record-option" onClick={() => handleStartRecording(false)}>
              מפגש פנים אל פנים
              <span>הקלטה מהמיקרופון של המחשב</span>
            </button>
            <div className="confirm-dialog-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setRecordPrompt(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* Review the summary produced from the recording before saving */}
      {review && (
        <div className="confirm-overlay">
          <div className="confirm-dialog sup-review-dialog">
            <h3>סיכום המפגש — {therapist?.name}</h3>
            <p>הסיכום הופק מההקלטה. אפשר לערוך אותו לפני השמירה.</p>
            {review.failedSegments > 0 && (
              <div className="alert alert-error">
                {review.failedSegments} קטעים מההקלטה לא תומללו, והסיכום אינו כולל אותם.
              </div>
            )}
            <div className="sup-review-body">
              {review.patients.length === 0 && !review.generalSummary && !review.generalRecommendations && (
                <div className="focus-area-empty">לא זוהה בהקלטה תוכן לסיכום.</div>
              )}
              {review.patients.map(r => (
                <div key={r.patientId} className="sup-review-section">
                  <div className="sup-review-title">{patients.find(p => p.id === r.patientId)?.name}</div>
                  <div className="sup-field-label">עיקרי הדברים</div>
                  <textarea className="sup-field-textarea" rows={5} value={r.summary}
                    onChange={e => updateReviewPatient(r.patientId, 'summary', e.target.value)} />
                  <div className="sup-field-label">המלצות למדריך למפגש הבא</div>
                  <textarea className="sup-field-textarea" rows={4} value={r.recommendations}
                    onChange={e => updateReviewPatient(r.patientId, 'recommendations', e.target.value)} />
                </div>
              ))}
              <div className="sup-review-section">
                <div className="sup-review-title">כללי — המודרך ותהליך ההדרכה</div>
                <div className="sup-field-label">עיקרי הדברים</div>
                <textarea className="sup-field-textarea" rows={4} value={review.generalSummary}
                  onChange={e => updateReview('generalSummary', e.target.value)} />
                <div className="sup-field-label">המלצות למדריך למפגש הבא</div>
                <textarea className="sup-field-textarea" rows={4} value={review.generalRecommendations}
                  onChange={e => updateReview('generalRecommendations', e.target.value)} />
              </div>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="confirm-dialog-actions">
              <button className="btn btn-primary" onClick={() => saveAll(review)} disabled={saving || saved}>
                {saved ? 'נשמר' : saving ? 'שומר...' : 'אשר ושמור'}
              </button>
              <button className="btn btn-secondary" onClick={() => setReview(null)} disabled={saving || saved}>חזור למפגש</button>
            </div>
          </div>
        </div>
      )}

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
