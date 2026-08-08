import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStructureAccent, podKeyFromSlug, POD_SLUGS, toCssHex, toRgbTriplet } from '@/lib/phaser/theme';
import { MOCK_LAB_DATA, type MockAgent } from '@/lib/mockData';
import styles from './page.module.css';

export function generateStaticParams() {
  return Object.values(POD_SLUGS).map((labId) => ({ labId }));
}

const STATUS_COLOR: Record<MockAgent['status'], string> = {
  working: '#3ddc84',
  idle: '#8a97a8',
  reviewing: '#ffce54',
  blocked: '#ff5a5a',
};

interface LabDetailPageProps {
  params: Promise<{ labId: string }>;
}

export default async function LabDetailPage({ params }: LabDetailPageProps) {
  const { labId } = await params;
  const key = podKeyFromSlug(labId);
  if (!key) notFound();

  const data = MOCK_LAB_DATA[key];
  const accent = getStructureAccent(key);

  return (
    <div
      className={styles.page}
      style={{ ['--accent' as string]: toCssHex(accent), ['--accent-rgb' as string]: toRgbTriplet(accent) }}
    >
      <div className={styles.topBar}>
        <Link href="/station" className={styles.backLink}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Station
        </Link>
      </div>

      <div className={styles.content}>
        <header className={styles.header}>
          <h1 className={styles.name}>{data.name}</h1>
          <p className={styles.tagline}>{data.tagline}</p>
        </header>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Agent Roster</h2>
          {data.agents.length === 0 ? (
            <p className={styles.emptyNote}>No dedicated agents — measurement layer only.</p>
          ) : (
            <div className={styles.agentGrid}>
              {data.agents.map((agent) => (
                <div className={styles.agentCard} key={agent.name}>
                  <div className={styles.agentTop}>
                    <span
                      className={styles.statusDot}
                      style={{ color: STATUS_COLOR[agent.status], background: STATUS_COLOR[agent.status] }}
                    />
                    <span className={styles.agentName}>{agent.name}</span>
                    <span className={styles.agentStatus}>{agent.status}</span>
                  </div>
                  <div className={styles.agentRole}>{agent.role}</div>
                  {agent.currentTask && <div className={styles.agentTask}>→ {agent.currentTask}</div>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Stats</h2>
          <div className={styles.statsGrid}>
            {data.stats.map((stat) => (
              <div className={styles.statCard} key={stat.label}>
                <div className={styles.statLabel}>{stat.label}</div>
                <div className={styles.statValue}>{stat.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Activity</h2>
          <div className={styles.activityList}>
            {data.activity.map((entry, i) => (
              <div className={styles.activityRow} key={`${entry.timestamp}-${i}`}>
                <span className={styles.activityTime}>{entry.timestamp}</span>
                <span className={styles.activityMessage}>{entry.message}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
