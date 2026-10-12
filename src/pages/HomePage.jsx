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
    const q = query(collection(db, 'therapists'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const nameA = (a.name || ((a.firstName || '') + ' ' + (a.lastName || ''))).trim();
          const nameB = (b.name || ((b.firstName || '') + ' ' + (b.lastName || ''))).trim();
          return nameA.localeCompare(nameB, 'he');
        });
        setTherapists(list);
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

  const displayName = (t) => t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim();

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head-main">
          <h1>מטפלים</h1>
          <div className="page-head-meta">מעקב הדרכות CBT</div>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/materials')}>ספריית חומרים</button>
          <button className="btn btn-primary" onClick={() => setShowAddForm((v) => !v)}>
            {showAddForm ? 'סגור' : 'הוסף מטפל'}
          </button>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

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

      <input
        className="form-input list-search"
        type="search"
        aria-label="חיפוש מטפל לפי שם"
        placeholder="חיפוש לפי שם"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <ul className="ruled-list" aria-busy="true">
          {[0, 1, 2].map(i => <li key={i} className="ruled-skeleton"><i /><i /></li>)}
        </ul>
      ) : filteredTherapists.length === 0 ? (
        <div className="empty-state">
          <p>{search
            ? 'לא נמצאו מטפלים התואמים לחיפוש.'
            : 'עדיין אין מטפלים. הוסף מטפל ראשון כדי להתחיל לתעד הדרכות.'}</p>
        </div>
      ) : (
        <ul className="ruled-list">
          {filteredTherapists.map((t) => (
            <li key={t.id} className="ruled-row">
              <button className="ruled-row-main" onClick={() => navigate(`/therapist/${t.id}`)}>
                <span className="ruled-row-name">{displayName(t)}</span>
                {t.profession && <span className="ruled-row-meta">{t.profession}</span>}
              </button>
              <div className="ruled-row-actions">
                <button className="link-btn danger" onClick={() => setConfirmDelete(t)}>מחק</button>
              </div>
            </li>
          ))}
        </ul>
      )}

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
