import { useSession } from './context/SessionContext';
import { useWakeLock } from './hooks/useWakeLock';
import { RoleSelect } from './components/RoleSelect';
import { CashierPage } from './pages/CashierPage';
import { PressPage } from './pages/PressPage';
import { AdminPage } from './pages/AdminPage';
import { Spinner } from './components/ui/Spinner';

export default function App() {
  const { user, loadingEvent } = useSession();
  useWakeLock(); // keep the tablet screen awake

  if (!user) return <RoleSelect />;

  // Brief wait for the active event so pages don't flash "no event".
  if (loadingEvent) {
    return (
      <div className="app">
        <div
          className="content"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)' }}
        >
          <Spinner /> Loading…
        </div>
      </div>
    );
  }

  switch (user.role) {
    case 'cashier':
      return <CashierPage />;
    case 'press':
      return <PressPage />;
    case 'admin':
      return <AdminPage />;
    default:
      return <RoleSelect />;
  }
}
