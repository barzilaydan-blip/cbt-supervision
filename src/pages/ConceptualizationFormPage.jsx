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

  // The letterhead the therapist sees: who is asking for this form
  const letterhead = (
    <header className="form-letterhead">
      <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="form-letterhead-logo" />
      <div>
        <div className="form-letterhead-name">דן ברזילי, פסיכולוג חינוכי</div>
        <div className="form-letterhead-title">מומחה ומדריך בטיפול ב- CBT</div>
      </div>
    </header>
  );

  if (loading) return (
    <div className="form-page-wrapper" aria-busy="true">
      {letterhead}
      <div className="sup-skeleton" /><div className="sup-skeleton" /><div className="sup-skeleton short" />
    </div>
  );

  if (!patient) return (
    <div className="form-page-wrapper">
      {letterhead}
      <div className="alert alert-error">{error}</div>
    </div>
  );

  if (submitted) return (
    <div className="form-page-wrapper">
      {letterhead}
      <div className="form-done">
        <h1>הטופס התקבל</h1>
        <p>ההמשגה נוספה לתיק ההדרכה של {patient.name}. אפשר לסגור את הדף.</p>
      </div>
    </div>
  );

  return (
    <div className="form-page-wrapper">
      {letterhead}
      <div className="form-page-head">
        <h1>טופס המשגת מקרה</h1>
        <div className="form-page-subtitle">
          מטופל/ת: <strong>{patient.name}</strong>
          {therapist && <> · מטפל/ת: <strong>{therapist.name}</strong></>}
        </div>
        <p className="form-page-intro">
          אפשר למלא רק את החלקים הרלוונטיים. מה שייכתב כאן יוצג למדריך לקראת מפגש ההדרכה.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="form-page-form">
        {CONCEPTUALIZATION_SECTIONS.map((sec, idx) => (
          <section key={sec.section} className="cform-section">
            <h2 className="cform-section-title"><span className="cform-section-num">{idx + 1}</span>{sec.section}</h2>
            {sec.fields.map((f) => (
              <div key={f.key} className="cform-field">
                <label className="cform-label" htmlFor={`cform-${f.key}`}>{f.label}</label>
                {f.description && <div className="cform-desc" id={`cform-${f.key}-desc`}>{f.description}</div>}
                {f.type === 'text' ? (
                  <input
                    id={`cform-${f.key}`}
                    className="form-input"
                    type="text"
                    aria-describedby={f.description ? `cform-${f.key}-desc` : undefined}
                    value={fields[f.key] || ''}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                  />
                ) : (
                  <textarea
                    id={`cform-${f.key}`}
                    className="sup-field-textarea"
                    rows={4}
                    aria-describedby={f.description ? `cform-${f.key}-desc` : undefined}
                    value={fields[f.key] || ''}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </section>
        ))}

        {error && <div className="alert alert-error">{error}</div>}

        <div className="cform-submit-row">
          <button type="submit" className="btn btn-primary cform-submit-btn" disabled={submitting}>
            {submitting ? 'שולח...' : 'שלח את הטופס'}
          </button>
        </div>
      </form>
    </div>
  );
}
