import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Opting in to the v7 behaviours now silences React Router's upgrade
        warnings and means the app already behaves the way v7 will. */}
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
