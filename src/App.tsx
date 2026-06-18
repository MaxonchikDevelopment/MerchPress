import { useSession } from './context/SessionContext';
import { useWakeLock } from './hooks/useWakeLock';
import { RoleSelect } from './components/RoleSelect';
import { CashierPage } from './pages/CashierPage';
import { PressPage } from './pages/PressPage';
import { AdminPage } from './pages/AdminPage';

export default function App() {
  const { user, loadingEvent } = useSession();
  useWakeLock(); // keep the tablet screen awake

  if (!user) return <RoleSelect />;

  // Brief wait for the active event so pages don't flash "no event".
  if (loadingEvent) {
    return (
      <div className="app">
        <div className="content"><div className="muted">Loading…</div></div>
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
