'use client';

import { useEffect, useRef, useState } from 'react';
import { THEME, toRgbTriplet, type DockIconKind } from '@/lib/phaser/theme';
import styles from './DockBar.module.css';

// Generic, non-trademarked stand-ins for each platform — plain geometric
// shapes (bag/printer/box/storefront/card/chat), not brand marks.
function IconGlyph({ kind }: { kind: DockIconKind }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (kind) {
    case 'bag':
      return (
        <svg {...common}>
          <path d="M6 8h12l-1 12H7L6 8z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
      );
    case 'printer':
      return (
        <svg {...common}>
          <path d="M6 9V4h12v5" />
          <rect x="5" y="9" width="14" height="7" rx="1" />
          <path d="M8 13h8v7H8z" />
        </svg>
      );
    case 'box':
      return (
        <svg {...common}>
          <path d="M3 8l9-5 9 5-9 5-9-5z" />
          <path d="M3 8v9l9 5 9-5V8" />
          <path d="M12 13v9" />
        </svg>
      );
    case 'storefront':
      return (
        <svg {...common}>
          <path d="M4 9l1-5h14l1 5" />
          <path d="M5 9v10h14V9" />
          <path d="M9 19v-6h6v6" />
        </svg>
      );
    case 'card':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
          <path d="M7 15h4" />
        </svg>
      );
    case 'chat':
      return (
        <svg {...common}>
          <path d="M4 5h16v11H8l-4 4V5z" />
        </svg>
      );
  }
}

export default function DockBar() {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const handleClick = (name: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(`${name} — not connected yet`);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  return (
    <>
      <div className={styles.dock}>
        {THEME.dock.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-label={item.connected ? `${item.name} — connected` : `${item.name} — not connected yet`}
            className={styles.dockItem}
            style={{ ['--glow' as string]: toRgbTriplet(item.color) }}
            onClick={() => handleClick(item.name)}
          >
            <span className={styles.icon} aria-hidden="true">
              <IconGlyph kind={item.icon} />
            </span>
            <span className={styles.label}>{item.name}</span>
            {item.connected && <span className={styles.statusDot} aria-hidden="true" />}
          </button>
        ))}
      </div>

      {toast && <div className={styles.toast} role="status">{toast}</div>}
    </>
  );
}
