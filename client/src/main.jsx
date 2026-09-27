import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './AuthContext.jsx';
import { ConfirmProvider } from './components/ConfirmDialog.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { QueueProvider } from './QueueContext.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <QueueProvider>
          <ToastProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
          </ToastProvider>
        </QueueProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
