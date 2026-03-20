import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
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

export default function HomePage() {
  const navigate = useNavigate();
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'therapists'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTherapists(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError('שגיאה בטעינת הנתונים. אנא בדוק את חיבור ה-Firebase.');
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  async function handleAddTherapist(e) {
    e.preventDefault();
    const firstName = newFirstName.trim();
    const lastName = newLastName.trim();
    if (!firstName && !lastName) return;
    setAdding(true);
    setError('');
    try {
      await addDoc(collection(db, 'therapists'), {
        firstName,
        lastName,
        name: (firstName + ' ' + lastName).trim(),
        createdAt: serverTimestamp(),
      });
      setNewFirstName('');
      setNewLastName('');
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
      setError('שגיאה בהוספת מטפל. נסה שנית.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteTherapist(therapist) {
    setConfirmDelete(null);
    try {
      // Delete all sessions for this therapist
      const sessionsQ = query(
        collection(db, 'sessions'),
        where('therapistId', '==', therapist.id)
      );
      const sessionsSnap = await getDocs(sessionsQ);
      await Promise.all(sessionsSnap.docs.map((d) => deleteDoc(doc(db, 'sessions', d.id))));

      // Delete all patients for this therapist
      const patientsQ = query(
        collection(db, 'patients'),
        where('therapistId', '==', therapist.id)
      );
      const patientsSnap = await getDocs(patientsQ);
      await Promise.all(patientsSnap.docs.map((d) => deleteDoc(doc(db, 'patients', d.id))));

      // Delete therapist
      await deleteDoc(doc(db, 'therapists', therapist.id));
    } catch (err) {
      console.error(err);
      setError('שגיאה במחיקת המטפל. נסה שנית.');
    }
  }

  const filteredTherapists = therapists.filter((t) => {
    const name = (t.name || ((t.firstName || '') + ' ' + (t.lastName || ''))).trim().toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const getInitials = (name) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return parts[0][0] + parts[1][0];
    return name[0] || '?';
  };

  return (
    <div className="page">
      <div className="page-header" style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="page-header-watermark">🧠</div>
        <div>
          <h1>מעקב הדרכות CBT</h1>
          <div className="subtitle">מערכת לניהול הדרכות סופרוויזיה</div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          ⚠️ {error}
        </div>
      )}

      <div className="page-actions" style={{ marginBottom: '16px' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/materials')}>
          📚 ספריית חומרים
        </button>
      </div>

      <div className="section">
        <div className="section-title">👥 מטפלים</div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'center' }}>
          <input
            className="form-input"
            type="text"
            placeholder="חיפוש לפי שם..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '280px' }}
          />
          <button
            className="btn btn-primary"
            onClick={() => setShowAddForm((v) => !v)}
          >
            {showAddForm ? '✕ סגור' : '+ הוסף מטפל'}
          </button>
        </div>

        {showAddForm && (
          <div className="add-form">
            <form onSubmit={handleAddTherapist}>
              <div className="add-form-row">
                <div className="form-group">
                  <label htmlFor="therapist-firstname">שם פרטי</label>
                  <input
                    id="therapist-firstname"
                    className="form-input"
                    type="text"
                    placeholder="שם פרטי..."
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    autoFocus
                    disabled={adding}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="therapist-lastname">שם משפחה</label>
                  <input
                    id="therapist-lastname"
                    className="form-input"
                    type="text"
                    placeholder="שם משפחה..."
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    disabled={adding}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={adding || (!newFirstName.trim() && !newLastName.trim())}
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
        ) : filteredTherapists.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👤</div>
            <p>{search ? 'לא נמצאו מטפלים התואמים לחיפוש.' : 'אין מטפלים עדיין. הוסף מטפל ראשון כדי להתחיל.'}</p>
          </div>
        ) : (
          <div className="card-list">
            {filteredTherapists.map((t) => (
              <div
                key={t.id}
                className="card card-clickable"
                onClick={() => navigate(`/therapist/${t.id}`)}
              >
                <div className="card-icon">{getInitials(t.name || (t.firstName + ' ' + t.lastName))}</div>
                <div className="card-body">
                  <div className="card-title">{t.name || ((t.firstName || '') + ' ' + (t.lastName || '')).trim()}</div>
                  <div className="card-meta">לחץ לצפייה במטופלים</div>
                </div>
                <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setConfirmDelete(t)}
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
          message={`האם אתה בטוח שברצונך למחוק את המטפל "${confirmDelete.name || ((confirmDelete.firstName || '') + ' ' + (confirmDelete.lastName || '')).trim()}"? פעולה זו תמחק גם את כל המטופלים וההדרכות שלו.`}
          onConfirm={() => handleDeleteTherapist(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
