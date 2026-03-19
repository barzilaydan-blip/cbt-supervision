import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { collection, addDoc, getDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { CONCEPTUALIZATION_SECTIONS } from '../constants.js';

export default function ConceptualizationFormPage() {
  const { patientId } = useParams();
  const [patient, setPatient] = useState(null);
  const [therapist, setTherapist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [expandedSections, setExpandedSections] = useState({ 0: true });

  useEffect(() => {
    async function load() {
      try {
        const pSnap = await getDoc(doc(db, 'patients', patientId));
        if (!pSnap.exists()) { setError('הקישור אינו תקין.'); setLoading(false); return; }
        const patientData = { id: pSnap.id, ...pSnap.data() };
        setPatient(patientData);
        if (patientData.therapistId) {
          const tSnap = await getDoc(doc(db, 'therapists', patientData.therapistId));
          if (tSnap.exists()) setTherapist({ id: tSnap.id, ...tSnap.data() });
        }
      } catch (err) {
        console.error(err);
        setError('שגיאה בטעינת הטופס.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [patientId]);

  function handleChange(key, value) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSection(idx) {
    setExpandedSections((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await addDoc(collection(db, 'conceptualizations'), {
        patientId,
        therapistId: patient.therapistId,
        fields,
        submittedAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError('שגיאה בשליחת הטופס. נסה שנית.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="form-page-wrapper">
      <div className="loading-wrapper"><div className="spinner" /><span>טוען טופס...</span></div>
    </div>
  );

  if (error) return (
    <div className="form-page-wrapper">
      <div className="alert alert-error">⚠️ {error}</div>
    </div>
  );

  if (submitted) return (
    <div className="form-page-wrapper">
      <div className="form-success-box">
        <div className="form-success-icon">✅</div>
        <h2>הטופס נשלח בהצלחה!</h2>
        <p>תוכן ההמשגה התווסף לתיק המטופל.</p>
      </div>
    </div>
  );

  return (
    <div className="form-page-wrapper">
      <div className="form-page-header">
        <div className="form-page-logo">🧠</div>
        <h1>טופס המשגה CBT</h1>
        {patient && (
          <div className="form-page-subtitle">
            מטופל/ת: <strong>{patient.name}</strong>
            {therapist && <> &nbsp;|&nbsp; מטפל/ת: <strong>{therapist.name}</strong></>}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="form-page-form">
        {CONCEPTUALIZATION_SECTIONS.map((sec, idx) => {
          const isOpen = !!expandedSections[idx];
          return (
            <div key={idx} className={`cform-section${isOpen ? ' open' : ''}`}>
              <button
                type="button"
                className="cform-section-header"
                onClick={() => toggleSection(idx)}
              >
                <span className="cform-section-num">{idx + 1}</span>
                <span className="cform-section-title">{sec.section}</span>
                <span className="focus-area-arrow">{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div className="cform-section-body">
                  {sec.fields.map((f) => (
                    <div key={f.key} className="cform-field">
                      <label className="cform-label">{f.label}</label>
                      {f.description && <div className="cform-desc">{f.description}</div>}
                      {f.type === 'text' ? (
                        <input
                          className="form-input"
                          type="text"
                          value={fields[f.key] || ''}
                          onChange={(e) => handleChange(f.key, e.target.value)}
                        />
                      ) : (
                        <textarea
                          className="focus-area-textarea"
                          rows={4}
                          value={fields[f.key] || ''}
                          onChange={(e) => handleChange(f.key, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {error && <div className="alert alert-error">⚠️ {error}</div>}

        <div className="cform-submit-row">
          <button type="submit" className="btn btn-primary cform-submit-btn" disabled={submitting}>
            {submitting ? '⏳ שולח...' : '📤 שלח טופס'}
          </button>
        </div>
      </form>
    </div>
  );
}
