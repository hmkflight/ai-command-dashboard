'use client';

import { toCssHex, type PodKey } from '@/lib/phaser/theme';
import type { StructurePosition } from '@/lib/phaser/scenes/StationScene';
import styles from './PodFocusTargets.module.css';

interface PodFocusTargetsProps {
  positions: StructurePosition[];
  onFocusPod: (position: StructurePosition) => void;
  onBlurPod: () => void;
  onActivatePod: (key: PodKey) => void;
}

/** Invisible, keyboard-focusable targets stacked over each pod so the canvas
 *  scene has a real tab order, visible focus rings, and screen-reader labels —
 *  mouse interaction is untouched since these are pointer-events: none. */
export default function PodFocusTargets({ positions, onFocusPod, onBlurPod, onActivatePod }: PodFocusTargetsProps) {
  return (
    <>
      {positions.map((p) => (
        <button
          key={p.key}
          type="button"
          aria-label={`${p.name} — open dashboard`}
          className={styles.target}
          style={{
            left: p.x,
            top: p.y,
            width: p.radius * 2,
            height: p.radius * 2,
            ['--accent' as string]: toCssHex(p.accent),
          }}
          onFocus={() => onFocusPod(p)}
          onBlur={onBlurPod}
          onClick={() => onActivatePod(p.key)}
        />
      ))}
    </>
  );
}
