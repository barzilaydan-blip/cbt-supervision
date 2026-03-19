import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import TherapistPage from './pages/TherapistPage.jsx';
import PatientPage from './pages/PatientPage.jsx';
import SessionPage from './pages/SessionPage.jsx';
import ConceptualizationFormPage from './pages/ConceptualizationFormPage.jsx';
import MaterialsPage from './pages/MaterialsPage.jsx';

function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isForm = location.pathname.startsWith('/form/');

  if (isForm) return null;

  return (
    <div className="app-header">
      <img
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt="לוגו"
        className="app-header-logo"
        onClick={() => navigate('/')}
      />
      <div className="app-header-title">
        <div className="app-header-name">דן ברזילי, פסיכולוג חינוכי</div>
        <div className="app-header-subtitle">מומחה ומדריך בטיפול ב- CBT</div>
      </div>
      {!isHome && (
        <button className="app-header-home-btn" onClick={() => navigate('/')}>
          🏠 מסך בית
        </button>
      )}
    </div>
  );
}

function App() {
  return (
    <div className="app-container">
      <AppHeader />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/therapist/:therapistId" element={<TherapistPage />} />
        <Route path="/patient/:patientId" element={<PatientPage />} />
        <Route path="/session/:sessionId" element={<SessionPage />} />
        <Route path="/form/:patientId" element={<ConceptualizationFormPage />} />
        <Route path="/materials" element={<MaterialsPage />} />
      </Routes>
    </div>
  );
}

export default App;
