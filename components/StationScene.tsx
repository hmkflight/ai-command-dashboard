'use client';

import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import { THEME, toRgbTriplet, getStructureAccent, type PodKey } from '@/lib/phaser/theme';
import { MOCK_LAB_DATA } from '@/lib/mockData';
import LabPanel from './LabPanel';
import styles from './StationScene.module.css';

export default function StationScene() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false);
  const [activePod, setActivePod] = useState<PodKey | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [{ default: PhaserLib }, { default: StationSceneClass }] = await Promise.all([
        import('phaser'),
        import('@/lib/phaser/scenes/StationScene'),
      ]);

      if (cancelled || !hostRef.current) return;

      const scene = new StationSceneClass({
        onPodClick: (key: PodKey) => {
          setActivePod(key);
          setPanelOpen(true);
        },
      });

      const game = new PhaserLib.Game({
        type: PhaserLib.AUTO,
        parent: hostRef.current,
        transparent: true,
        scale: {
          mode: PhaserLib.Scale.RESIZE,
          width: hostRef.current.clientWidth,
          height: hostRef.current.clientHeight,
        },
        scene,
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

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const handleDockClick = (name: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(`${name} — not connected yet`);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const closePanel = () => setPanelOpen(false);

  return (
    <div className={styles.wrapper}>
      <div ref={hostRef} className={styles.canvasHost} />
      {!ready && <div className={styles.loading}>Initializing Station Uplink&hellip;</div>}

      <LabPanel
        data={activePod ? MOCK_LAB_DATA[activePod] : null}
        accent={activePod ? getStructureAccent(activePod) : THEME.hudmeta.accent}
        open={panelOpen}
        onClose={closePanel}
      />

      <div className={styles.dock}>
        {THEME.dock.map((item) => (
          <button
            key={item.key}
            type="button"
            className={styles.dockItem}
            style={{ ['--glow' as string]: toRgbTriplet(item.color) }}
            onClick={() => handleDockClick(item.name)}
          >
            {item.label}
            <span className={styles.dockLabel}>{item.name}</span>
          </button>
        ))}
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
