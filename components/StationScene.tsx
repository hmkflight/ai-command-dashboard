'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type Phaser from 'phaser';
import { INTRO_SESSION_KEY, type StructurePosition } from '@/lib/phaser/scenes/StationScene';
import { getStructureAccent, POD_SLUGS, type PodKey } from '@/lib/phaser/theme';
import { MOCK_LAB_DATA } from '@/lib/mockData';
import DockBar from './DockBar';
import PodPreview from './PodPreview';
import PodFocusTargets from './PodFocusTargets';
import styles from './StationScene.module.css';

interface HoverAnchor {
  x: number;
  y: number;
  radius: number;
}

export default function StationScene() {
  const router = useRouter();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [ready, setReady] = useState(false);
  const [hoverKey, setHoverKey] = useState<PodKey | null>(null);
  const [hoverAnchor, setHoverAnchor] = useState<HoverAnchor | null>(null);
  const [positions, setPositions] = useState<StructurePosition[]>([]);
  // Flipped the instant any click/activation navigates away. Without it, the
  // scene's own per-frame hover/position callbacks (still firing every frame
  // until the game is destroyed on unmount) keep re-rendering this component,
  // which can starve the pending router.push transition and it never commits.
  const navigatingRef = useRef(false);

  const handlePodClick = useCallback(
    (key: PodKey) => {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      setHoverKey(null);
      setHoverAnchor(null);
      router.push(`/station/${POD_SLUGS[key]}`);
    },
    [router],
  );

  const handlePodHover = useCallback((key: PodKey | null, anchor: HoverAnchor | null) => {
    if (navigatingRef.current) return;
    setHoverKey(key);
    setHoverAnchor(anchor);
  }, []);

  const handleFocusPod = useCallback((position: StructurePosition) => {
    if (navigatingRef.current) return;
    setHoverKey(position.key);
    setHoverAnchor({ x: position.x, y: position.y, radius: position.radius });
  }, []);

  const handleBlurPod = useCallback(() => {
    if (navigatingRef.current) return;
    setHoverKey(null);
    setHoverAnchor(null);
  }, []);

  const handleStructuresPositioned = useCallback((next: StructurePosition[]) => {
    if (navigatingRef.current) return;
    setPositions(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [{ default: PhaserLib }, { default: StationSceneClass }] = await Promise.all([
        import('phaser'),
        import('@/lib/phaser/scenes/StationScene'),
      ]);

      if (cancelled || !hostRef.current) return;

      const reducedMotion =
        typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const skipIntro = typeof window !== 'undefined' && sessionStorage.getItem(INTRO_SESSION_KEY) === '1';
      if (typeof window !== 'undefined') sessionStorage.setItem(INTRO_SESSION_KEY, '1');

      const scene = new StationSceneClass({
        onPodClick: handlePodClick,
        onPodHover: handlePodHover,
        onStructuresPositioned: handleStructuresPositioned,
        reducedMotion,
        skipIntro,
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
    // scene callbacks are only read once at construction time by Phaser.Game
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.wrapper}>
      <div ref={hostRef} className={styles.canvasHost} />
      {!ready && <div className={styles.loading}>Initializing Station Uplink&hellip;</div>}

      <PodFocusTargets
        positions={positions}
        onFocusPod={handleFocusPod}
        onBlurPod={handleBlurPod}
        onActivatePod={handlePodClick}
      />

      <PodPreview
        data={hoverKey ? MOCK_LAB_DATA[hoverKey] : null}
        accent={hoverKey ? getStructureAccent(hoverKey) : 0}
        anchor={hoverAnchor}
      />

      <DockBar />
    </div>
  );
}
