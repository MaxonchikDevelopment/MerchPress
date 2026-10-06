import { useState } from 'react';
import { useSession } from '../context/SessionContext';
import { TopBar } from '../components/TopBar';
import { AdminEventsPage } from './AdminEventsPage';
import { AdminDesignsPage } from './AdminDesignsPage';
import { AdminStaffPage } from './AdminStaffPage';
import { StatsPage } from './StatsPage';
import { BuildTag } from '../components/BuildTag';

type Tab = 'events' | 'designs' | 'staff' | 'stats';

const TAB_LABELS: Record<Tab, string> = { events: 'Events', designs: 'Designs', staff: 'Staff', stats: 'Stats' };

export function AdminPage() {
  const { activeEvent } = useSession();
  // App mounts this page only after the session has loaded, so activeEvent is settled here.
  const [tab, setTab] = useState<Tab>(activeEvent ? 'designs' : 'events');

  return (
    <div className="app">
      <TopBar title="Admin">
        {(['events', 'designs', 'staff', 'stats'] as Tab[]).map((t) => (
          <button
            key={t}
            className={tab === t ? 'tab tab-active' : 'tab'}
            onClick={() => setTab(t)}
            aria-current={tab === t ? 'page' : undefined}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </TopBar>
      <div className="content page-enter" key={tab} style={{ maxWidth: 980, margin: '0 auto', width: '100%' }}>
        {tab === 'events' && <AdminEventsPage />}
        {tab === 'designs' && <AdminDesignsPage />}
        {tab === 'staff' && <AdminStaffPage />}
        {tab === 'stats' && <StatsPage />}
        <BuildTag />
      </div>
    </div>
  );
}
