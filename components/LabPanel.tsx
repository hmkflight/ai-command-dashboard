'use client';

import { useEffect } from 'react';
import { toCssHex, toRgbTriplet } from '@/lib/phaser/theme';
import type { LabPanelData, MockAgent } from '@/lib/mockData';
import styles from './LabPanel.module.css';

const STATUS_COLOR: Record<MockAgent['status'], string> = {
  working: '#3ddc84',
  idle: '#8a97a8',
  reviewing: '#ffce54',
  blocked: '#ff5a5a',
};

interface LabPanelProps {
  data: LabPanelData | null;
  accent: number;
  open: boolean;
  onClose: () => void;
}

export default function LabPanel({ data, accent, open, onClose }: LabPanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const accentCss = toCssHex(accent);
  const accentRgb = toRgbTriplet(accent);

  return (
    <>
      <div
        className={`${styles.overlay} ${open ? styles.overlayOpen : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
        style={{ ['--accent' as string]: accentCss, ['--accent-rgb' as string]: accentRgb }}
        aria-hidden={!open}
      >
        {data && (
          <>
            <div className={styles.header}>
              <h2 className={styles.name}>{data.name}</h2>
              <p className={styles.tagline}>{data.tagline}</p>
              <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close panel">
                ✕
              </button>
            </div>

            <div className={styles.body}>
              <section>
                <h3 className={styles.sectionTitle}>Agent Roster</h3>
                {data.agents.length === 0 ? (
                  <p className={styles.emptyNote}>No dedicated agents — measurement layer only.</p>
                ) : (
                  <div className={styles.agentList}>
                    {data.agents.map((agent) => (
                      <div className={styles.agentRow} key={agent.name}>
                        <span
                          className={styles.statusDot}
                          style={{ color: STATUS_COLOR[agent.status], background: STATUS_COLOR[agent.status] }}
                        />
                        <div className={styles.agentMeta}>
                          <div className={styles.agentNameRow}>
                            <span className={styles.agentName}>{agent.name}</span>
                            <span className={styles.agentRole}>{agent.role}</span>
                          </div>
                          {agent.currentTask && <span className={styles.agentTask}>→ {agent.currentTask}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className={styles.sectionTitle}>Stats</h3>
                <div className={styles.statsGrid}>
                  {data.stats.map((stat) => (
                    <div className={styles.statCard} key={stat.label}>
                      <div className={styles.statLabel}>{stat.label}</div>
                      <div className={styles.statValue}>{stat.value}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className={styles.sectionTitle}>Activity</h3>
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
          </>
        )}
      </aside>
    </>
  );
}
