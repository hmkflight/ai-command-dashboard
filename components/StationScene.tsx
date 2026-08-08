'use client';

import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import { THEME, toCssHex } from '@/lib/phaser/theme';
import styles from './StationScene.module.css';

export default function StationScene() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [{ default: PhaserLib }, { default: StationSceneClass }] = await Promise.all([
        import('phaser'),
        import('@/lib/phaser/scenes/StationScene'),
      ]);

      if (cancelled || !hostRef.current) return;

      const game = new PhaserLib.Game({
        type: PhaserLib.AUTO,
        parent: hostRef.current,
        transparent: true,
        scale: {
          mode: PhaserLib.Scale.RESIZE,
          width: hostRef.current.clientWidth,
          height: hostRef.current.clientHeight,
        },
        scene: [StationSceneClass],
        render: { antialias: true, roundPixels: false },
      });

      gameRef.current = game;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div className={styles.wrapper}>
      <div ref={hostRef} className={styles.canvasHost} />
      {!ready && <div className={styles.loading}>Initializing Station Uplink&hellip;</div>}

      <div className={styles.dock}>
        {THEME.dock.map((item) => (
          <div
            key={item.key}
            className={styles.dockItem}
            style={{ ['--glow' as string]: hexToRgbTriplet(item.color) }}
          >
            {item.label}
            <span className={styles.dockLabel}>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function hexToRgbTriplet(color: number): string {
  const hex = toCssHex(color);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
