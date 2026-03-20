import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import TherapistPage from './pages/TherapistPage.jsx';
import PatientPage from './pages/PatientPage.jsx';
import SessionPage from './pages/SessionPage.jsx';
import ConceptualizationFormPage from './pages/ConceptualizationFormPage.jsx';
import MaterialsPage from './pages/MaterialsPage.jsx';
import { AuthProvider, useAuth } from './AuthContext.jsx';

function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
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
      <div className="app-header-actions">
        {!isHome && (
          <button className="app-header-home-btn" onClick={() => navigate('/')}>
            🏠 מסך בית
          </button>
        )}
        {user && (
          <button className="app-header-logout-btn" onClick={logout} title={user.email}>
            🚪 יציאה
          </button>
        )}
      </div>
    </div>
  );
}

function LoginScreen() {
  const { login } = useAuth();
  const [error, setError] = React.useState('');

  async function handleLogin() {
    setError('');
    try {
      await login();
    } catch (e) {
      if (e.message === 'unauthorized') {
        setError('גישה לא מורשית. אפליקציה זו פרטית.');
      }
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="לוגו"
          className="login-logo"
        />
        <div className="login-title">מעקב הדרכות CBT</div>
        <div className="login-subtitle">דן ברזילי, פסיכולוג חינוכי</div>
        {error && <div className="alert alert-error" style={{ width: '100%', textAlign: 'center' }}>⚠️ {error}</div>}
        <button className="btn btn-google" onClick={handleLogin}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="20" />
          התחבר עם Google
        </button>
      </div>
    </div>
  );
}

function AppContent() {
  const { user } = useAuth();
  const location = useLocation();
  const isForm = location.pathname.startsWith('/form/');

  // Still loading auth state
  if (user === undefined) {
    return (
      <div className="loading-wrapper" style={{ minHeight: '100vh', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  // Allow public access to the form page
  if (!user && !isForm) {
    return <LoginScreen />;
  }

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

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
