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
    profession: '', experience: '', framework: '', generalInfo: '',
  });
  const [savingDetails, setSavingDetails] = useState(false);

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
      const { firstName, lastName, email, phone, profession, experience, framework, generalInfo } = detailsForm;
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

  const getInitials = (name) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return parts[0][0] + parts[1][0];
    return name[0] || '?';
  };

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-back" onClick={() => navigate('/')}>
          &#x2190; חזרה
        </button>
        <div>
          <h2>{therapist ? therapist.name : 'טוען...'}</h2>
          <div className="subtitle">מטפל</div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          ⚠️ {error}
        </div>
      )}

      {/* פרטי המטפל */}
      <div className="therapist-details-section">
        <button
          className="therapist-details-toggle"
          onClick={() => setDetailsOpen((v) => !v)}
        >
          <span>פרטי המטפל</span>
          <span>{detailsOpen ? '▲' : '▼'}</span>
        </button>

        {detailsOpen && (
          <div className="therapist-details-body">
            {!editingDetails ? (
              <>
                <div className="therapist-details-grid">
                  <div className="therapist-detail-item">
                    <span className="therapist-detail-label">שם פרטי</span>
                    <span className={`therapist-detail-value${!therapist?.firstName ? ' empty' : ''}`}>
                      {therapist?.firstName || 'לא הוזן'}
                    </span>
                  </div>
                  <div className="therapist-detail-item">
                    <span className="therapist-detail-label">שם משפחה</span>
                    <span className={`therapist-detail-value${!therapist?.lastName ? ' empty' : ''}`}>
                      {therapist?.lastName || 'לא הוזן'}
                    </span>
                  </div>
                  <div className="therapist-detail-item">
                    <span className="therapist-detail-label">כתובת מייל</span>
                    <span className={`therapist-detail-value${!therapist?.email ? ' empty' : ''}`}>
                      {therapist?.email || 'לא הוזן'}
                    </span>
                  </div>
                  <div className="therapist-detail-item">
                    <span className="therapist-detail-label">טלפון</span>
                    <span className={`therapist-detail-value${!therapist?.phone ? ' empty' : ''}`}>
                      {therapist?.phone || 'לא הוזן'}
                    </span>
                  </div>
                  <div className="therapist-detail-item">
                    <span className="therapist-detail-label">מקצוע</span>
                    <span className={`therapist-detail-value${!therapist?.profession ? ' empty' : ''}`}>
                      {therapist?.profession || 'לא הוזן'}
                    </span>
                  </div>
                  <div className="therapist-detail-item">
                    <span className="therapist-detail-label">ניסיון טיפולי</span>
                    <span className={`therapist-detail-value${!therapist?.experience ? ' empty' : ''}`}>
                      {therapist?.experience || 'לא הוזן'}
                    </span>
                  </div>
                  <div className="therapist-detail-item">
                    <span className="therapist-detail-label">מסגרת טיפול</span>
                    <span className={`therapist-detail-value${!therapist?.framework ? ' empty' : ''}`}>
                      {therapist?.framework || 'לא הוזן'}
                    </span>
                  </div>
                </div>
                <div className="therapist-detail-item" style={{ marginBottom: '12px' }}>
                  <span className="therapist-detail-label">מידע כללי</span>
                  <span className={`therapist-detail-value${!therapist?.generalInfo ? ' empty' : ''}`}>
                    {therapist?.generalInfo || 'לא הוזן'}
                  </span>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setDetailsForm({
                      firstName: therapist?.firstName || '',
                      lastName: therapist?.lastName || '',
                      email: therapist?.email || '',
                      phone: therapist?.phone || '',
                      profession: therapist?.profession || '',
                      experience: therapist?.experience || '',
                      framework: therapist?.framework || '',
                      generalInfo: therapist?.generalInfo || '',
                    });
                    setEditingDetails(true);
                  }}
                >
                  עריכה
                </button>
              </>
            ) : (
              <form className="therapist-details-edit-form" onSubmit={handleSaveDetails}>
                <div className="therapist-details-edit-grid">
                  <div className="form-group">
                    <label>שם פרטי</label>
                    <input
                      className="form-input"
                      type="text"
                      value={detailsForm.firstName}
                      onChange={(e) => setDetailsForm((f) => ({ ...f, firstName: e.target.value }))}
                      disabled={savingDetails}
                    />
                  </div>
                  <div className="form-group">
                    <label>שם משפחה</label>
                    <input
                      className="form-input"
                      type="text"
                      value={detailsForm.lastName}
                      onChange={(e) => setDetailsForm((f) => ({ ...f, lastName: e.target.value }))}
                      disabled={savingDetails}
                    />
                  </div>
                  <div className="form-group">
                    <label>כתובת מייל</label>
                    <input
                      className="form-input"
                      type="email"
                      value={detailsForm.email}
                      onChange={(e) => setDetailsForm((f) => ({ ...f, email: e.target.value }))}
                      disabled={savingDetails}
                    />
                  </div>
                  <div className="form-group">
                    <label>טלפון</label>
                    <input
                      className="form-input"
                      type="text"
                      value={detailsForm.phone}
                      onChange={(e) => setDetailsForm((f) => ({ ...f, phone: e.target.value }))}
                      disabled={savingDetails}
                    />
                  </div>
                  <div className="form-group">
                    <label>מקצוע</label>
                    <input
                      className="form-input"
                      type="text"
                      value={detailsForm.profession}
                      onChange={(e) => setDetailsForm((f) => ({ ...f, profession: e.target.value }))}
                      disabled={savingDetails}
                    />
                  </div>
                  <div className="form-group">
                    <label>ניסיון טיפולי</label>
                    <input
                      className="form-input"
                      type="text"
                      value={detailsForm.experience}
                      onChange={(e) => setDetailsForm((f) => ({ ...f, experience: e.target.value }))}
                      disabled={savingDetails}
                    />
                  </div>
                  <div className="form-group">
                    <label>מסגרת טיפול</label>
                    <input
                      className="form-input"
                      type="text"
                      value={detailsForm.framework}
                      onChange={(e) => setDetailsForm((f) => ({ ...f, framework: e.target.value }))}
                      disabled={savingDetails}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>מידע כללי</label>
                  <textarea
                    className="form-input focus-area-textarea"
                    value={detailsForm.generalInfo}
                    onChange={(e) => setDetailsForm((f) => ({ ...f, generalInfo: e.target.value }))}
                    disabled={savingDetails}
                    rows={3}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={savingDetails}>
                    {savingDetails ? 'שומר...' : 'שמור'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setEditingDetails(false)}
                    disabled={savingDetails}
                  >
                    ביטול
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

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
    </div>
  );
}
