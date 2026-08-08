// Central palette + layout constants for the station scene.
// Swap or extend colors here — nothing downstream should hardcode hex values.

export interface PodDef {
  key: string;
  name: string;
  accent: number;
  core: number;
  /** angle in degrees around Hudmeta, 0 = east, -90 = north */
  angle: number;
}

/** Generic, non-trademarked iconography — see IconGlyph in DockBar for the SVGs. */
export type DockIconKind = 'bag' | 'printer' | 'box' | 'storefront' | 'card' | 'chat';

export interface DockItemDef {
  key: string;
  name: string;
  icon: DockIconKind;
  color: number;
  connected: boolean;
}

export const THEME = {
  colors: {
    voidBg: 0x050810,
    voidBgCss: '#050810',
    panelBg: 0x0a0f1c,
    nebulaA: 0x2a1550,
    nebulaB: 0x14264a,
    starDim: 0x6f8fb5,
    starBright: 0xdff3ff,
  },

  hudmeta: {
    key: 'hudmeta',
    name: 'Hudmeta',
    accent: 0x2ee6d6,
    accentBright: 0xb8fff5,
    core: 0x062a2c,
  } satisfies { key: string; name: string; accent: number; accentBright: number; core: number },

  pods: [
    { key: 'devLab', name: 'Dev Lab', accent: 0xffb020, core: 0x2b1a00, angle: -90 },
    { key: 'contentLab', name: 'Content Lab', accent: 0xff36c4, core: 0x2b0022, angle: -18 },
    { key: 'revenueBay', name: 'Revenue Bay', accent: 0xa15bff, core: 0x1e0033, angle: 54 },
    { key: 'research', name: 'Research & Trading Facility', accent: 0x3d8bff, core: 0x001a33, angle: 126 },
    { key: 'podLab', name: 'POD Lab', accent: 0x39ff8f, core: 0x00301a, angle: 198 },
  ] satisfies PodDef[],

  layout: {
    podRadius: 460,
    hudmetaSize: 130,
    podSize: 78,
    // squashes the ring + structures vertically for an isometric-style read
    isoSquash: 0.62,
  },

  glow: {
    layers: 4,
    scaleStep: 0.22,
    baseAlpha: 0.24,
  },

  camera: {
    minZoom: 0.35,
    maxZoom: 1.9,
    // exponential-decay rates (per second) for delta-time-based smoothing —
    // higher = snappier convergence to the drag/zoom target, frame-rate independent
    scrollDecay: 10,
    zoomDecay: 8,
  },

  // connected: true only for Etsy + Printify, matching POD Lab's mock
  // "Store Status: Connected (Etsy + Printify)" — everything else is a future hook
  dock: [
    { key: 'etsy', name: 'Etsy', icon: 'bag', color: 0xff5a00, connected: true },
    { key: 'printify', name: 'Printify', icon: 'printer', color: 0x00c9a7, connected: true },
    { key: 'amazon', name: 'Amazon', icon: 'box', color: 0xffcc00, connected: false },
    { key: 'shopify', name: 'Shopify', icon: 'storefront', color: 0x95e35b, connected: false },
    { key: 'stripe', name: 'Stripe', icon: 'card', color: 0x6772e5, connected: false },
    { key: 'discord', name: 'Discord', icon: 'chat', color: 0x7289da, connected: false },
  ] satisfies DockItemDef[],
};

export function toCssHex(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

/** "r, g, b" — for building rgba()/currentColor-friendly CSS custom properties. */
export function toRgbTriplet(value: number): string {
  return `${(value >> 16) & 0xff}, ${(value >> 8) & 0xff}, ${value & 0xff}`;
}

/** All structure keys — Hudmeta plus the five pods — used to key mock data & panels. */
export type PodKey = 'hudmeta' | (typeof THEME.pods)[number]['key'];

export function getStructureAccent(key: string): number {
  if (key === THEME.hudmeta.key) return THEME.hudmeta.accent;
  return THEME.pods.find((p) => p.key === key)?.accent ?? THEME.hudmeta.accent;
}

/** /station/[labId] route slugs — kebab-case, distinct from the internal camelCase PodKey. */
export const POD_SLUGS: Record<PodKey, string> = {
  hudmeta: 'hudmeta',
  devLab: 'dev-lab',
  podLab: 'pod-lab',
  contentLab: 'content-lab',
  research: 'research-trading',
  revenueBay: 'revenue-bay',
};

export function podKeyFromSlug(slug: string): PodKey | undefined {
  return (Object.keys(POD_SLUGS) as PodKey[]).find((key) => POD_SLUGS[key] === slug);
}
