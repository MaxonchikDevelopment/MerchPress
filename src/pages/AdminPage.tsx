import { useState } from 'react';
import { useSession } from '../context/SessionContext';
import { TopBar, TopBlock } from '../components/TopBar';
import { AdminEventsPage } from './AdminEventsPage';
import { AdminDesignsPage } from './AdminDesignsPage';
import { AdminCompatPage } from './AdminCompatPage';
import { AdminStaffPage } from './AdminStaffPage';
import { AdminOrdersPage } from './AdminOrdersPage';
import { StatsPage } from './StatsPage';
import { BuildTag } from '../components/BuildTag';

type Tab = 'events' | 'designs' | 'compat' | 'staff' | 'stats' | 'orders';

const TAB_LABELS: Record<Tab, string> = {
  events: 'Events',
  designs: 'Designs',
  compat: 'Compatibility',
  staff: 'Staff',
  stats: 'Stats',
  orders: 'Orders',
};
const TABS: Tab[] = ['events', 'designs', 'compat', 'staff', 'stats', 'orders'];

export function AdminPage() {
  const { activeEvent } = useSession();
  // App mounts this page only after the session has loaded, so activeEvent is settled here.
  const [tab, setTab] = useState<Tab>(activeEvent ? 'designs' : 'events');

  return (
    <div className="app">
      <TopBlock>
        <TopBar title="Admin">
          {TABS.map((t) => (
            <button
              key={t}
              className={tab === t ? 'tab tab-active' : 'tab'}
              onClick={(e) => {
                setTab(t);
                // Six tabs overflow the strip on phones; keep the tapped one in view.
                e.currentTarget.scrollIntoView?.({ inline: 'center', block: 'nearest' });
              }}
              aria-current={tab === t ? 'page' : undefined}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </TopBar>
      </TopBlock>
      <div className="content page-enter" key={tab} style={{ maxWidth: 980, margin: '0 auto', width: '100%' }}>
        {tab === 'events' && <AdminEventsPage />}
        {tab === 'designs' && <AdminDesignsPage />}
        {tab === 'compat' && <AdminCompatPage />}
        {tab === 'staff' && <AdminStaffPage />}
        {tab === 'stats' && <StatsPage />}
        {tab === 'orders' && <AdminOrdersPage />}
        <BuildTag />
      </div>
    </div>
  );
}
