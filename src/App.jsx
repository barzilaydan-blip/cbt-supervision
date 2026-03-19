import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import TherapistPage from './pages/TherapistPage.jsx';
import PatientPage from './pages/PatientPage.jsx';
import SessionPage from './pages/SessionPage.jsx';
import ConceptualizationFormPage from './pages/ConceptualizationFormPage.jsx';

function App() {
  return (
    <div className="app-container">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/therapist/:therapistId" element={<TherapistPage />} />
        <Route path="/patient/:patientId" element={<PatientPage />} />
        <Route path="/session/:sessionId" element={<SessionPage />} />
        <Route path="/form/:patientId" element={<ConceptualizationFormPage />} />
      </Routes>
    </div>
  );
}

export default App;
