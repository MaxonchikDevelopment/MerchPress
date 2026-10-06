import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { UpdateBanner } from './components/UpdateBanner';
import { SessionProvider } from './context/SessionContext';
import { startAppUpdates } from './lib/appUpdate';

startAppUpdates();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <App />
      <UpdateBanner />
    </SessionProvider>
  </StrictMode>,
);
