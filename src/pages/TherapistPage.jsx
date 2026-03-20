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
import { sendMaterialsEmail } from '../utils/emailService.js';
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

function SupervisionSummaryModal({ therapist, patients, allSessions, onClose }) {
  const [exporting, setExporting] = useState(false);
  const hoursPerSession = parseFloat(therapist?.hoursPerSession) || 0;
  const uniqueDates = [...new Set(allSessions.map(s => s.date).filter(Boolean))].sort();
  const totalHours = uniqueDates.length * hoursPerSession;

  const patientRows = patients.map(p => {
    const pSessions = allSessions.filter(s => s.patientId === p.id && s.date);
    const pDates = [...new Set(pSessions.map(s => s.date))].sort();
    return { name: p.name, count: pDates.length, dates: pDates };
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
            <h2>📊 סיכום שעות הדרכה</h2>
            <div className="summary-modal-therapist">{therapist?.name}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="therapist-banner-btn" onClick={handleExport} disabled={exporting} style={{ opacity: exporting ? 0.7 : 1 }}>
              {exporting ? '⏳ מייצא...' : '⬇ ייצוא PDF'}
            </button>
            <button className="summary-modal-close" onClick={onClose}>✕</button>
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
                <div className="summary-patient-dates">
                  {row.dates.map(d => (
                    <span key={d} className="summary-date-chip">{d}</span>
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
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  // Materials section
  const [materials, setMaterials] = useState([]);
  const [showMaterials, setShowMaterials] = useState(false);
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
        setPatients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
      const list = selected.map(m => `• ${m.name}: ${m.url}`).join('\n');
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

  const getInitials = (name) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return parts[0][0] + parts[1][0];
    return name[0] || '?';
  };

  return (
    <div className="page">
      {/* BANNER */}
      <div className="therapist-banner">
        <div className="therapist-banner-main">
          <button className="btn-back" onClick={() => navigate('/')}>
            &#x2190; חזרה
          </button>
          <div style={{ flex: 1 }}>
            <h2>{therapist ? therapist.name : 'טוען...'}{therapist?.profession ? ` | ${therapist.profession}` : ''}</h2>
            <div className="subtitle">
              {(() => {
                const uniqueDates = new Set(allSessions.map(s => s.date).filter(Boolean)).size;
                const hours = parseFloat(therapist?.hoursPerSession);
                if (uniqueDates > 0 && hours > 0) return `${uniqueDates} מפגשי הדרכה | סה"כ ${uniqueDates * hours} שעות`;
                return `${uniqueDates} מפגשי הדרכה`;
              })()}
            </div>
          </div>
          <div className="therapist-banner-actions">
            <button
              className="therapist-banner-btn"
              onClick={() => { setDetailsOpen(v => !v); setShowActionsMenu(false); }}
            >
              👤 פרטי המטפל {detailsOpen ? '▲' : '▼'}
            </button>
            <div style={{ position: 'relative' }}>
              <button
                className="therapist-banner-btn"
                onClick={() => { setShowActionsMenu(v => !v); setDetailsOpen(false); }}
              >
                ⚙️ פעולות נוספות {showActionsMenu ? '▲' : '▼'}
              </button>
              {showActionsMenu && (
                <div className="therapist-actions-dropdown">
                  <button className="therapist-actions-item" onClick={() => { setShowSummary(true); setShowActionsMenu(false); }}>
                    📊 סיכום שעות הדרכה
                  </button>
                  <button className="therapist-actions-item" onClick={() => { setShowMaterials(v => !v); setShowActionsMenu(false); }}>
                    📚 שלח חומרי עזר למטפל
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* פרטי המטפל — פאנל נופל */}
        {detailsOpen && (
          <div className="therapist-details-panel">
            {!editingDetails ? (
              <>
                <div className="therapist-details-grid">
                  <div className="therapist-detail-item">
                    <span className="therapist-detail-label">שם פרטי</span>
                    <span className={`therapist-detail-value${!therapist?.firstName ? ' empty' : ''}`}>{therapist?.firstName || 'לא הוזן'}</span>
                  </div>
                  <div className="therapist-detail-item">
                    <span className="therapist-detail-label">שם משפחה</span>
                    <span className={`therapist-detail-value${!therapist?.lastName ? ' empty' : ''}`}>{therapist?.lastName || 'לא הוזן'}</span>
                  </div>
                  <div className="therapist-detail-item">
                    <span className="therapist-detail-label">כתובת מייל</span>
                    <span className={`therapist-detail-value${!therapist?.email ? ' empty' : ''}`}>{therapist?.email || 'לא הוזן'}</span>
                  </div>
                  <div className="therapist-detail-item">
                    <span className="therapist-detail-label">טלפון</span>
                    <span className={`therapist-detail-value${!therapist?.phone ? ' empty' : ''}`}>{therapist?.phone || 'לא הוזן'}</span>
                  </div>
                  <div className="therapist-detail-item">
                    <span className="therapist-detail-label">מקצוע</span>
                    <span className={`therapist-detail-value${!therapist?.profession ? ' empty' : ''}`}>{therapist?.profession || 'לא הוזן'}</span>
                  </div>
                  <div className="therapist-detail-item">
                    <span className="therapist-detail-label">ניסיון טיפולי</span>
                    <span className={`therapist-detail-value${!therapist?.experience ? ' empty' : ''}`}>{therapist?.experience || 'לא הוזן'}</span>
                  </div>
                  <div className="therapist-detail-item">
                    <span className="therapist-detail-label">מסגרת טיפול</span>
                    <span className={`therapist-detail-value${!therapist?.framework ? ' empty' : ''}`}>{therapist?.framework || 'לא הוזן'}</span>
                  </div>
                  <div className="therapist-detail-item">
                    <span className="therapist-detail-label">שעות הדרכה למפגש</span>
                    <span className={`therapist-detail-value${!therapist?.hoursPerSession ? ' empty' : ''}`}>{therapist?.hoursPerSession || 'לא הוזן'}</span>
                  </div>
                </div>
                <div className="therapist-detail-item" style={{ marginBottom: '12px' }}>
                  <span className="therapist-detail-label">מידע כללי</span>
                  <span className={`therapist-detail-value${!therapist?.generalInfo ? ' empty' : ''}`}>{therapist?.generalInfo || 'לא הוזן'}</span>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  setDetailsForm({
                    firstName: therapist?.firstName || '', lastName: therapist?.lastName || '',
                    email: therapist?.email || '', phone: therapist?.phone || '',
                    profession: therapist?.profession || '', experience: therapist?.experience || '',
                    framework: therapist?.framework || '', generalInfo: therapist?.generalInfo || '',
                    hoursPerSession: therapist?.hoursPerSession || '',
                  });
                  setEditingDetails(true);
                }}>
                  עריכה
                </button>
              </>
            ) : (
              <form className="therapist-details-edit-form" onSubmit={handleSaveDetails}>
                <div className="therapist-details-edit-grid">
                  <div className="form-group"><label>שם פרטי</label>
                    <input className="form-input" type="text" value={detailsForm.firstName} onChange={(e) => setDetailsForm((f) => ({ ...f, firstName: e.target.value }))} disabled={savingDetails} />
                  </div>
                  <div className="form-group"><label>שם משפחה</label>
                    <input className="form-input" type="text" value={detailsForm.lastName} onChange={(e) => setDetailsForm((f) => ({ ...f, lastName: e.target.value }))} disabled={savingDetails} />
                  </div>
                  <div className="form-group"><label>כתובת מייל</label>
                    <input className="form-input" type="email" value={detailsForm.email} onChange={(e) => setDetailsForm((f) => ({ ...f, email: e.target.value }))} disabled={savingDetails} />
                  </div>
                  <div className="form-group"><label>טלפון</label>
                    <input className="form-input" type="text" value={detailsForm.phone} onChange={(e) => setDetailsForm((f) => ({ ...f, phone: e.target.value }))} disabled={savingDetails} />
                  </div>
                  <div className="form-group"><label>מקצוע</label>
                    <input className="form-input" type="text" value={detailsForm.profession} onChange={(e) => setDetailsForm((f) => ({ ...f, profession: e.target.value }))} disabled={savingDetails} />
                  </div>
                  <div className="form-group"><label>ניסיון טיפולי</label>
                    <input className="form-input" type="text" value={detailsForm.experience} onChange={(e) => setDetailsForm((f) => ({ ...f, experience: e.target.value }))} disabled={savingDetails} />
                  </div>
                  <div className="form-group"><label>מסגרת טיפול</label>
                    <input className="form-input" type="text" value={detailsForm.framework} onChange={(e) => setDetailsForm((f) => ({ ...f, framework: e.target.value }))} disabled={savingDetails} />
                  </div>
                  <div className="form-group"><label>שעות הדרכה למפגש</label>
                    <input className="form-input" type="number" step="0.5" min="0" placeholder="למשל: 1.5" value={detailsForm.hoursPerSession} onChange={(e) => setDetailsForm((f) => ({ ...f, hoursPerSession: e.target.value }))} disabled={savingDetails} />
                  </div>
                </div>
                <div className="form-group"><label>מידע כללי</label>
                  <textarea className="form-input focus-area-textarea" value={detailsForm.generalInfo} onChange={(e) => setDetailsForm((f) => ({ ...f, generalInfo: e.target.value }))} disabled={savingDetails} rows={3} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={savingDetails}>{savingDetails ? 'שומר...' : 'שמור'}</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingDetails(false)} disabled={savingDetails}>ביטול</button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* חומרי עזר — פאנל נופל */}
        {showMaterials && (
          <div className="therapist-details-panel">
            {materialsError && <div className="alert alert-error">⚠️ {materialsError}</div>}
            {materialsSent && <div className="alert alert-success">✅ החומרים נשלחו בהצלחה!</div>}
            {materials.length === 0 ? (
              <div className="focus-area-empty">אין חומרים בספרייה. הוסף חומרים מהדף הראשי.</div>
            ) : (
              <>
                <div style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>סמן את החומרים לשליחה:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {materials.map(m => (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!selectedMaterials[m.id]} onChange={e => setSelectedMaterials(prev => ({ ...prev, [m.id]: e.target.checked }))} />
                      <span><strong>{m.name}</strong> <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>({m.category})</span></span>
                    </label>
                  ))}
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleSendMaterials} disabled={sendingMaterials || Object.values(selectedMaterials).every(v => !v) || !therapist?.email}>
                  {sendingMaterials ? '⏳ שולח...' : '📧 שלח למטפל'}
                </button>
                {!therapist?.email && <div style={{ marginTop: '8px', color: 'var(--danger)', fontSize: '0.85rem' }}>⚠️ יש להוסיף כתובת מייל בפרטי המטפל לפני השליחה.</div>}
              </>
            )}
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      <div className="section">
        <div className="section-title">
          🧑‍⚕️ מטופלים
          <button
            className="btn btn-primary btn-sm"
            style={{ marginRight: 'auto' }}
            onClick={() => setShowAddForm((v) => !v)}
          >
            {showAddForm ? '✕ סגור' : '+ הוסף מטופל'}
          </button>
        </div>

        {showAddForm && (
          <div className="add-form">
            <form onSubmit={handleAddPatient}>
              <div className="add-form-row">
                <div className="form-group">
                  <label htmlFor="patient-name">שם המטופל</label>
                  <input
                    id="patient-name"
                    className="form-input"
                    type="text"
                    placeholder="הזן שם מלא..."
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                    autoFocus
                    disabled={adding}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={adding || !newPatientName.trim()}
                >
                  {adding ? 'מוסיף...' : 'הוסף'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="loading-wrapper">
            <div className="spinner" />
            <span>טוען נתונים...</span>
          </div>
        ) : patients.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🧑‍⚕️</div>
            <p>אין מטופלים עדיין. הוסף מטופל ראשון.</p>
          </div>
        ) : (
          <div className="card-list">
            {patients.map((p) => (
              <div
                key={p.id}
                className="card card-clickable"
                onClick={() => navigate(`/patient/${p.id}`)}
              >
                <div className="card-icon">{getInitials(p.name)}</div>
                <div className="card-body">
                  <div className="card-title">{p.name}</div>
                  <div className="card-meta">לחץ לצפייה בהדרכות</div>
                </div>
                <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setConfirmDelete(p)}
                  >
                    🗑 מחק
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          message={`האם אתה בטוח שברצונך למחוק את המטופל "${confirmDelete.name}"? פעולה זו תמחק גם את כל ההדרכות שלו.`}
          onConfirm={() => handleDeletePatient(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
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
