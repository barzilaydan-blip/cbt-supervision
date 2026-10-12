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
  getDocs,
  updateDoc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { sendMaterialsEmail, formatMaterialsListHtml } from '../utils/emailService.js';
import { exportSummaryPDF } from '../utils/exportPDF.js';

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay">
      <div className="confirm-dialog">
        <h3>אישור מחיקה</h3>
        <p>{message}</p>
        <div className="confirm-dialog-actions">
          <button className="btn btn-danger" onClick={onConfirm}>
            מחק
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            ביטול
          </button>
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

const DETAIL_FIELDS = [
  { key: 'firstName', label: 'שם פרטי' },
  { key: 'lastName', label: 'שם משפחה' },
  { key: 'email', label: 'כתובת מייל', type: 'email' },
  { key: 'phone', label: 'טלפון' },
  { key: 'profession', label: 'מקצוע' },
  { key: 'experience', label: 'ניסיון טיפולי' },
  { key: 'framework', label: 'מסגרת טיפול' },
  { key: 'hoursPerSession', label: 'שעות הדרכה למפגש', type: 'number' },
];

// 'YYYY-MM-DD' → 'DD.MM.YYYY'
function shortDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function SupervisionSummaryModal({ therapist, patients, allSessions, onClose }) {
  const [exporting, setExporting] = useState(false);
  const hoursPerSession = parseFloat(therapist?.hoursPerSession) || 0;
  const uniqueDates = [...new Set(allSessions.map(s => s.date).filter(Boolean))].sort();
  const totalHours = uniqueDates.length * hoursPerSession;

  const patientRows = patients.map(p => {
    const pSessions = allSessions.filter(s => s.patientId === p.id && s.date)
      .sort((a, b) => a.date.localeCompare(b.date));
    const sessionDetails = pSessions.map(s => {
      const tags = s.notes?.tags
        ? Object.entries(s.notes.tags).filter(([, v]) => v).map(([k]) => TAG_LABELS[k] || k)
        : [];
      return { date: s.date, tags };
    });
    return { name: p.name, count: sessionDetails.length, sessionDetails };
  }).filter(r => r.count > 0).sort((a, b) => b.count - a.count);

  async function handleExport() {
    setExporting(true);
    try {
      await exportSummaryPDF({ therapist, patientRows, uniqueDates, totalHours });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="summary-modal" onClick={e => e.stopPropagation()}>
        <div className="summary-modal-header">
          <div>
            <h2>סיכום שעות הדרכה</h2>
            <div className="summary-modal-therapist">{therapist?.name}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExport} disabled={exporting}>
              {exporting ? 'מייצא...' : 'ייצוא PDF'}
            </button>
            <button className="summary-modal-close" aria-label="סגור" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="summary-total-box">
          <div className="summary-total-item">
            <span className="summary-total-number">{uniqueDates.length}</span>
            <span className="summary-total-label">מפגשי הדרכה</span>
          </div>
          {hoursPerSession > 0 && (
            <>
              <div className="summary-total-divider" />
              <div className="summary-total-item">
                <span className="summary-total-number">{hoursPerSession}</span>
                <span className="summary-total-label">שעות למפגש</span>
              </div>
              <div className="summary-total-divider" />
              <div className="summary-total-item">
                <span className="summary-total-number">{totalHours}</span>
                <span className="summary-total-label">סה"כ שעות</span>
              </div>
            </>
          )}
        </div>

        {patientRows.length === 0 ? (
          <div className="focus-area-empty">אין נתוני הדרכה עדיין.</div>
        ) : (
          <div className="summary-patient-list">
            {patientRows.map(row => (
              <div key={row.name} className="summary-patient-row">
                <div className="summary-patient-header">
                  <span className="summary-patient-name">{row.name}</span>
                  <span className="summary-patient-count">{row.count} הדרכות</span>
                </div>
                <div className="summary-sessions-list">
                  {row.sessionDetails.map((s, i) => (
                    <div key={s.date + i} className="summary-session-row">
                      <span className="summary-date-chip">{shortDate(s.date)}</span>
                      {s.tags.length > 0 && (
                        <div className="summary-session-tags">
                          {s.tags.map(t => (
                            <span key={t} className="summary-tag-chip">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TherapistPage() {
  const { therapistId } = useParams();
  const navigate = useNavigate();

  const [therapist, setTherapist] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPatientName, setNewPatientName] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState('');

  // Therapist details section
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    profession: '', experience: '', framework: '', generalInfo: '', hoursPerSession: '',
  });
  const [savingDetails, setSavingDetails] = useState(false);
  const [allSessions, setAllSessions] = useState([]);

  const [showSummary, setShowSummary] = useState(false);

  // Patient profile editing
  const [editingProfilePatient, setEditingProfilePatient] = useState(null);
  const [profileDraft, setProfileDraft] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Materials section
  const [materials, setMaterials] = useState([]);
  const [showMaterials, setShowMaterials] = useState(false);
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialCatFilter, setMaterialCatFilter] = useState('הכל');
  const [selectedMaterials, setSelectedMaterials] = useState({});
  const [sendingMaterials, setSendingMaterials] = useState(false);
  const [materialsSent, setMaterialsSent] = useState(false);
  const [materialsError, setMaterialsError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, 'therapists', therapistId))
      .then((snap) => {
        if (!snap.exists()) {
          navigate('/');
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        if (!cancelled) {
          setTherapist(data);
          setDetailsForm({
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            phone: data.phone || '',
            profession: data.profession || '',
            experience: data.experience || '',
            framework: data.framework || '',
            generalInfo: data.generalInfo || '',
            hoursPerSession: data.hoursPerSession || '',
          });
        }
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError('שגיאה בטעינת נתוני המטפל.');
      });
    return () => { cancelled = true; };
  }, [therapistId, navigate]);

  useEffect(() => {
    const q = query(collection(db, 'sessions'), where('therapistId', '==', therapistId));
    const unsub = onSnapshot(q,
      (snap) => setAllSessions(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error(err)
    );
    return unsub;
  }, [therapistId]);

  useEffect(() => {
    const q = query(collection(db, 'materials'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q,
      (snap) => setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error(err)
    );
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'patients'),
      where('therapistId', '==', therapistId),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Newest patient first
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setPatients(list);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError('שגיאה בטעינת רשימת המטופלים.');
        setLoading(false);
      }
    );
    return unsub;
  }, [therapistId]);

  async function handleAddPatient(e) {
    e.preventDefault();
    const name = newPatientName.trim();
    if (!name) return;
    setAdding(true);
    setError('');
    try {
      await addDoc(collection(db, 'patients'), {
        name,
        therapistId,
        createdAt: serverTimestamp(),
      });
      setNewPatientName('');
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
      setError('שגיאה בהוספת מטופל. נסה שנית.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDeletePatient(patient) {
    setConfirmDelete(null);
    try {
      // Delete all sessions for this patient
      const sessionsQ = query(
        collection(db, 'sessions'),
        where('patientId', '==', patient.id)
      );
      const sessionsSnap = await getDocs(sessionsQ);
      await Promise.all(sessionsSnap.docs.map((d) => deleteDoc(doc(db, 'sessions', d.id))));

      // Delete patient
      await deleteDoc(doc(db, 'patients', patient.id));
    } catch (err) {
      console.error(err);
      setError('שגיאה במחיקת המטופל. נסה שנית.');
    }
  }

  async function handleSaveDetails(e) {
    e.preventDefault();
    setSavingDetails(true);
    setError('');
    try {
      const { firstName, lastName, email, phone, profession, experience, framework, generalInfo, hoursPerSession } = detailsForm;
      const updates = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: (firstName.trim() + ' ' + lastName.trim()).trim(),
        email: email.trim(),
        phone: phone.trim(),
        profession: profession.trim(),
        experience: experience.trim(),
        framework: framework.trim(),
        generalInfo: generalInfo.trim(),
        hoursPerSession: hoursPerSession.trim(),
      };
      await updateDoc(doc(db, 'therapists', therapistId), updates);
      setTherapist((prev) => ({ ...prev, ...updates }));
      setEditingDetails(false);
    } catch (err) {
      console.error(err);
      setError('שגיאה בשמירת פרטי המטפל. נסה שנית.');
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleSendMaterials() {
    const selected = materials.filter(m => selectedMaterials[m.id]);
    if (selected.length === 0) return;
    if (!therapist?.email) {
      setMaterialsError('אין כתובת מייל רשומה למטפל.');
      return;
    }
    setSendingMaterials(true);
    setMaterialsError('');
    try {
      const list = formatMaterialsListHtml(selected);
      await sendMaterialsEmail({
        therapistEmail: therapist.email,
        therapistName: therapist.name || `${therapist.firstName || ''} ${therapist.lastName || ''}`.trim(),
        materialsList: list,
      });
      setMaterialsSent(true);
      setSelectedMaterials({});
      setTimeout(() => setMaterialsSent(false), 4000);
    } catch (err) {
      console.error(err);
      setMaterialsError('שגיאה בשליחת המייל. נסה שנית.');
    } finally {
      setSendingMaterials(false);
    }
  }

  async function handleSaveProfile() {
    if (!editingProfilePatient) return;
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, 'patients', editingProfilePatient.id), { background: profileDraft });
      setEditingProfilePatient(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingProfile(false);
    }
  }

  // Per patient: how many supervisions there were and the most recent one
  const statsByPatient = {};
  allSessions.forEach((s) => {
    if (!s.date) return;
    const st = statsByPatient[s.patientId] || (statsByPatient[s.patientId] = { count: 0, last: null });
    st.count += 1;
    if (!st.last || s.date > st.last.date) st.last = s;
  });

  function patientMeta(patientId) {
    const st = statsByPatient[patientId];
    if (!st) return 'עדיין אין הדרכות';
    const count = st.count === 1 ? 'הדרכה אחת' : `${st.count} הדרכות`;
    return `${count} · אחרונה ${shortDate(st.last.date)}`;
  }

  const meetingCount = new Set(allSessions.map(s => s.date).filter(Boolean)).size;
  const hoursPerMeeting = parseFloat(therapist?.hoursPerSession);
  const headMeta = [
    therapist?.profession,
    meetingCount === 1 ? 'מפגש הדרכה אחד' : `${meetingCount} מפגשי הדרכה`,
    meetingCount > 0 && hoursPerMeeting > 0 && `סה"כ ${meetingCount * hoursPerMeeting} שעות`,
  ].filter(Boolean).join(' · ');

  function openDetailsEditor() {
    setDetailsForm(Object.fromEntries(
      [...DETAIL_FIELDS.map(f => f.key), 'generalInfo'].map(key => [key, therapist?.[key] || ''])
    ));
    setEditingDetails(true);
  }

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head-main">
          <button className="page-head-back" onClick={() => navigate('/')}>&#x2192; כל המטפלים</button>
          <h1>{therapist ? therapist.name : 'טוען...'}</h1>
          <div className="page-head-meta">{headMeta}</div>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-secondary" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(v => !v)}>
            פרטי המטפל
          </button>
          <button className="btn btn-secondary" onClick={() => setShowSummary(true)}>סיכום שעות</button>
          <button className="btn btn-secondary" aria-expanded={showMaterials} onClick={() => setShowMaterials(v => !v)}>
            שלח חומרים
          </button>
          <button className="btn btn-primary" onClick={() => navigate(`/supervision-session/${therapistId}`)}>
            התחל מפגש הדרכה
          </button>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Therapist details */}
      {detailsOpen && (
        <section className="sheet">
          <h2 className="sheet-title">פרטי המטפל</h2>
          {!editingDetails ? (
            <>
              <div className="details-grid">
                {DETAIL_FIELDS.map(f => (
                  <div key={f.key} className="details-item">
                    <span className="details-label">{f.label}</span>
                    <span className={`details-value${therapist?.[f.key] ? '' : ' empty'}`}>{therapist?.[f.key] || 'לא הוזן'}</span>
                  </div>
                ))}
                <div className="details-item wide">
                  <span className="details-label">מידע כללי</span>
                  <span className={`details-value${therapist?.generalInfo ? '' : ' empty'}`}>{therapist?.generalInfo || 'לא הוזן'}</span>
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={openDetailsEditor}>עריכה</button>
            </>
          ) : (
            <form onSubmit={handleSaveDetails}>
              <div className="details-grid">
                {DETAIL_FIELDS.map(f => (
                  <div key={f.key} className="form-group">
                    <label htmlFor={`details-${f.key}`}>{f.label}</label>
                    <input
                      id={`details-${f.key}`}
                      className="form-input"
                      type={f.type || 'text'}
                      {...(f.key === 'hoursPerSession' ? { step: '0.5', min: '0', placeholder: 'למשל: 1.5' } : {})}
                      value={detailsForm[f.key]}
                      onChange={(e) => setDetailsForm((form) => ({ ...form, [f.key]: e.target.value }))}
                      disabled={savingDetails}
                    />
                  </div>
                ))}
                <div className="form-group details-item wide">
                  <label htmlFor="details-generalInfo">מידע כללי</label>
                  <textarea
                    id="details-generalInfo"
                    className="sup-field-textarea"
                    rows={3}
                    value={detailsForm.generalInfo}
                    onChange={(e) => setDetailsForm((form) => ({ ...form, generalInfo: e.target.value }))}
                    disabled={savingDetails}
                  />
                </div>
              </div>
              <div className="details-actions">
                <button type="submit" className="btn btn-primary btn-sm" disabled={savingDetails}>{savingDetails ? 'שומר...' : 'שמור'}</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingDetails(false)} disabled={savingDetails}>ביטול</button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* Send materials to the therapist */}
      {showMaterials && (() => {
        const cats = ['הכל', ...([...new Set(materials.map(m => m.category).filter(Boolean))].sort())];
        const txt = materialSearch.trim().toLowerCase();
        const filtered = materials.filter(m => {
          const matchCat = materialCatFilter === 'הכל' || m.category === materialCatFilter;
          const matchTxt = !txt ||
            m.name?.toLowerCase().includes(txt) ||
            m.description?.toLowerCase().includes(txt) ||
            m.tags?.some(t => t.toLowerCase().includes(txt));
          return matchCat && matchTxt;
        });
        const selectedCount = Object.values(selectedMaterials).filter(Boolean).length;
        return (
          <section className="sheet">
            <h2 className="sheet-title">שליחת חומרים למטפל</h2>
            {materialsError && <div className="alert alert-error">{materialsError}</div>}
            {materialsSent && <div className="alert alert-success">החומרים נשלחו.</div>}
            {materials.length === 0 ? (
              <div className="send-hint">אין עדיין חומרים בספרייה. אפשר להוסיף חומרים בספריית החומרים שבמסך הבית.</div>
            ) : (
              <>
                <input
                  className="form-input"
                  type="search"
                  aria-label="חיפוש חומרים"
                  placeholder="חיפוש לפי שם, תיאור או תגית"
                  value={materialSearch}
                  onChange={e => setMaterialSearch(e.target.value)}
                />
                <div className="mat-cat-filter-row">
                  {cats.map(cat => (
                    <button
                      key={cat}
                      className={`mat-cat-pill${materialCatFilter === cat ? ' active' : ''}`}
                      onClick={() => setMaterialCatFilter(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="send-hint">
                  {selectedCount > 0 ? `נבחרו ${selectedCount} חומרים` : 'סמן חומרים לשליחה'}
                </div>
                <div className="send-list">
                  {filtered.length === 0
                    ? <div className="send-hint">לא נמצאו חומרים התואמים לחיפוש.</div>
                    : filtered.map(m => (
                      <label key={m.id} className="mat-send-row">
                        <input type="checkbox" checked={!!selectedMaterials[m.id]} onChange={e => setSelectedMaterials(prev => ({ ...prev, [m.id]: e.target.checked }))} />
                        <div>
                          <div className="send-row-name">{m.name}</div>
                          <div className="send-row-tags">
                            <span className="mat-send-cat">{m.category}</span>
                            {m.tags?.map(t => <span key={t} className="mat-send-tag">{t}</span>)}
                          </div>
                        </div>
                      </label>
                    ))
                  }
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleSendMaterials} disabled={sendingMaterials || selectedCount === 0 || !therapist?.email}>
                  {sendingMaterials ? 'שולח...' : selectedCount > 0 ? `שלח ${selectedCount} חומרים במייל` : 'שלח במייל'}
                </button>
                {!therapist?.email && <div className="send-hint danger">כדי לשלוח, הוסף כתובת מייל בפרטי המטפל.</div>}
              </>
            )}
          </section>
        );
      })()}

      <div className="list-head">
        <h2>מטופלים</h2>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? 'סגור' : 'הוסף מטופל'}
        </button>
      </div>

      {showAddForm && (
        <div className="add-form">
          <form onSubmit={handleAddPatient}>
            <div className="add-form-row">
              <div className="form-group">
                <label htmlFor="patient-name">שם המטופל או ראשי תיבות</label>
                <input
                  id="patient-name"
                  className="form-input"
                  type="text"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  autoFocus
                  disabled={adding}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={adding || !newPatientName.trim()}>
                {adding ? 'מוסיף...' : 'הוסף'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <ul className="ruled-list" aria-busy="true">
          {[0, 1, 2].map(i => <li key={i} className="ruled-skeleton"><i /><i /></li>)}
        </ul>
      ) : patients.length === 0 ? (
        <div className="empty-state">
          <p>למטפל זה עדיין אין מטופלים. הוסף מטופל, ואז אפשר להתחיל מפגש הדרכה.</p>
        </div>
      ) : (
        <ul className="ruled-list">
          {patients.map((p) => (
            <li key={p.id} className="ruled-row">
              <button className="ruled-row-main" onClick={() => navigate(`/patient/${p.id}`)}>
                <span className="ruled-row-name">{p.name}</span>
                <span className="ruled-row-meta">{patientMeta(p.id)}</span>
              </button>
              {statsByPatient[p.id]?.last.notes?.danger && (
                <span className="ruled-row-flag">מסוכנות במפגש האחרון</span>
              )}
              <div className="ruled-row-actions">
                <button className="link-btn" onClick={() => { setProfileDraft(p.background || ''); setEditingProfilePatient(p); }}>
                  פרופיל
                </button>
                <button className="link-btn danger" onClick={() => setConfirmDelete(p)}>מחק</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`האם אתה בטוח שברצונך למחוק את המטופל "${confirmDelete.name}"? פעולה זו תמחק גם את כל ההדרכות שלו.`}
          onConfirm={() => handleDeletePatient(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {editingProfilePatient && (
        <div className="confirm-overlay" onClick={() => setEditingProfilePatient(null)}>
          <div className="confirm-dialog sup-review-dialog" onClick={e => e.stopPropagation()}>
            <h3>פרופיל מטופל: {editingProfilePatient.name}</h3>
            <p>הפרופיל מוצג בראש מסך המפגש בכל הדרכה על המטופל.</p>
            <textarea
              className="sup-profile-textarea"
              rows={7}
              aria-label="פרופיל המטופל"
              value={profileDraft}
              onChange={e => setProfileDraft(e.target.value)}
              placeholder="אבחנה, מטרות טיפוליות, רקע רלוונטי"
            />
            <div className="confirm-dialog-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? 'שומר...' : 'שמור'}
              </button>
              <button className="btn btn-secondary" onClick={() => setEditingProfilePatient(null)}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {showSummary && (
        <SupervisionSummaryModal
          therapist={therapist}
          patients={patients}
          allSessions={allSessions}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}
