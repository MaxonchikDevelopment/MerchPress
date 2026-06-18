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
            className={tab === t ? 'btn btn-primary' : 'btn'}
            onClick={() => setTab(t)}
            style={{ textTransform: 'capitalize' }}
          >
            {t}
          </button>
        ))}
      </TopBar>
      <div className="content" style={{ maxWidth: 980, margin: '0 auto', width: '100%' }}>
        {tab === 'events' && <AdminEventsPage />}
        {tab === 'designs' && <AdminDesignsPage />}
        {tab === 'stats' && <StatsPage />}
      </div>
    </div>
  );
}
