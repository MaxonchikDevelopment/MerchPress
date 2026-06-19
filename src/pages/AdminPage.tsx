import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { AdminEventsPage } from './AdminEventsPage';
import { AdminDesignsPage } from './AdminDesignsPage';
import { StatsPage } from './StatsPage';

type Tab = 'events' | 'designs' | 'stats';

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('designs');

  return (
    <div className="app">
      <TopBar title="Admin">
        {(['events', 'designs', 'stats'] as Tab[]).map((t) => (
          <button
            key={t}
            className={tab === t ? 'tab tab-active' : 'tab'}
            onClick={() => setTab(t)}
            aria-current={tab === t ? 'page' : undefined}
          >
            {t}
          </button>
        ))}
      </TopBar>
      <div className="content page-enter" key={tab} style={{ maxWidth: 980, margin: '0 auto', width: '100%' }}>
        {tab === 'events' && <AdminEventsPage />}
        {tab === 'designs' && <AdminDesignsPage />}
        {tab === 'stats' && <StatsPage />}
      </div>
    </div>
  );
}
