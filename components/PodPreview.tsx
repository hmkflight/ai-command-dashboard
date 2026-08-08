'use client';

import { toCssHex, toRgbTriplet } from '@/lib/phaser/theme';
import type { LabPanelData } from '@/lib/mockData';
import styles from './PodPreview.module.css';

interface HoverAnchor {
  x: number;
  y: number;
  radius: number;
}

interface PodPreviewProps {
  data: LabPanelData | null;
  accent: number;
  anchor: HoverAnchor | null;
}

const CARD_HALF_WIDTH = 118;
const EST_CARD_HEIGHT = 190;
const GAP = 14;

export default function PodPreview({ data, accent, anchor }: PodPreviewProps) {
  if (!data || !anchor) return null;

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1400;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;

  // place above the pod's hit circle by default; flip below it if there isn't
  // enough room above (e.g. the pod sits near the top of the viewport)
  const spaceAbove = anchor.y - anchor.radius;
  const placeBelow = spaceAbove < EST_CARD_HEIGHT + GAP;

  const top = placeBelow ? Math.min(anchor.y + anchor.radius + GAP, viewportHeight - 40) : spaceAbove - GAP;
  const left = Math.min(Math.max(anchor.x, CARD_HALF_WIDTH + 8), viewportWidth - CARD_HALF_WIDTH - 8);

  return (
    <div
      className={`${styles.preview} ${placeBelow ? styles.below : styles.above}`}
      style={{
        left,
        top,
        ['--accent' as string]: toCssHex(accent),
        ['--accent-rgb' as string]: toRgbTriplet(accent),
      }}
      aria-hidden="true"
    >
      <div className={styles.name}>{data.name}</div>
      <div className={styles.tagline}>{data.tagline}</div>
      <div className={styles.stats}>
        {data.stats.slice(0, 2).map((stat) => (
          <div className={styles.stat} key={stat.label}>
            <span className={styles.statLabel}>{stat.label}</span>
            <span className={styles.statValue}>{stat.value}</span>
          </div>
        ))}
      </div>
      <div className={styles.hint}>Click for full dashboard →</div>
    </div>
  );
}
