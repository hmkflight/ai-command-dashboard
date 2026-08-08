import Phaser from 'phaser';
import { THEME, toCssHex, type PodDef, type PodKey } from '../theme';

const MIN_ZOOM = THEME.camera.minZoom;
const MAX_ZOOM = THEME.camera.maxZoom;
const CLICK_DRAG_THRESHOLD = 6;
// Hit radius as a multiple of the structure's base size — sized to cover the
// visible glow halo (beyond the crisp octagon outline at 1.0x) rather than just
// the crisp shape. Capped at 1.28x: any higher and Hudmeta's hit circle starts
// overlapping Dev Lab's (the closest pod, ~285px away on the squashed ring).
const HIT_RADIUS_MULT = 1.28;
// Hover only commits to a new pod after the nearest-candidate has been stable
// for this many consecutive update() frames — a small dead-zone that stops
// hover from thrashing when the pointer sits in a boundary/ambiguous zone.
const HOVER_COMMIT_FRAMES = 3;
const INTRO_LEG_MS = 1300;
const INTRO_SESSION_KEY = 'station-intro-played';

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface HoverAnchor extends ScreenPoint {
  /** screen-space hit radius, so the preview card can decide to render above or below */
  radius: number;
}

export interface StructurePosition extends HoverAnchor {
  key: PodKey;
  name: string;
  accent: number;
}

/** Frame-rate-independent exponential smoothing: converges toward `target` at a
 *  constant real-time rate regardless of the current frame delta. */
function expDecay(current: number, target: number, decay: number, dt: number): number {
  const diff = target - current;
  if (Math.abs(diff) < 0.01) return target;
  return current + diff * (1 - Math.exp(-decay * dt));
}

export interface StationSceneCallbacks {
  onPodClick: (key: PodKey) => void;
  onPodHover?: (key: PodKey | null, anchor: HoverAnchor | null) => void;
  onStructuresPositioned?: (positions: StructurePosition[]) => void;
  reducedMotion?: boolean;
  skipIntro?: boolean;
}

function octagonPoints(cx: number, cy: number, r: number, squash: number): Phaser.Math.Vector2[] {
  const pts: Phaser.Math.Vector2[] = [];
  const sides = 8;
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 8;
    pts.push(new Phaser.Math.Vector2(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r * squash));
  }
  return pts;
}

/** Layered composite: base plate, faked radial-gradient core, outer ring, hairline highlight. */
function drawStructureTexture(
  scene: Phaser.Scene,
  key: string,
  size: number,
  accent: number,
  core: number,
) {
  const w = size * 2.4;
  const h = size * 2.4;
  const cx = w / 2;
  const cy = h / 2;
  const g = scene.add.graphics();

  const plate = octagonPoints(cx, cy, size * 0.92, 0.55);
  g.fillStyle(core, 0.6);
  g.fillPoints(plate, true, true);

  const coreColor = Phaser.Display.Color.ValueToColor(core);
  const accentColor = Phaser.Display.Color.ValueToColor(accent);
  const rings = 12;
  for (let i = rings; i >= 1; i--) {
    const t = i / rings;
    const r = size * 0.58 * t;
    const blended = Phaser.Display.Color.Interpolate.ColorWithColor(coreColor, accentColor, rings, rings - i);
    const col = Phaser.Display.Color.GetColor(blended.r, blended.g, blended.b);
    const a = 0.04 + (1 - t) * 0.55;
    g.fillStyle(col, a);
    g.fillCircle(cx, cy, r);
  }

  const ringPts = octagonPoints(cx, cy, size, 0.55);
  g.lineStyle(3, accent, 0.95);
  g.strokePoints(ringPts, true, true);

  const highlightPts = octagonPoints(cx, cy, size * 0.97, 0.55);
  g.lineStyle(1, 0xffffff, 0.55);
  g.strokePoints(highlightPts, true, true);

  const basePts = octagonPoints(cx, cy, size * 1.04, 0.55);
  g.lineStyle(1, accent, 0.3);
  g.strokePoints(basePts, true, true);

  g.generateTexture(key, w, h);
  g.destroy();
}

/** Thin seam lines + panel rectangles + rivet dots — a semi-transparent greeble
 *  layer stacked on top of the crisp body texture for extra surface detail. */
function drawGreebleTexture(scene: Phaser.Scene, key: string, size: number, accent: number) {
  const w = size * 2.4;
  const h = size * 2.4;
  const cx = w / 2;
  const cy = h / 2;
  const g = scene.add.graphics();

  g.lineStyle(1, accent, 0.55);
  const seams = 3;
  for (let i = 0; i < seams; i++) {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const r1 = size * Phaser.Math.FloatBetween(0.12, 0.3);
    const r2 = size * Phaser.Math.FloatBetween(0.72, 0.94);
    g.lineBetween(
      cx + Math.cos(angle) * r1,
      cy + Math.sin(angle) * r1 * 0.55,
      cx + Math.cos(angle) * r2,
      cy + Math.sin(angle) * r2 * 0.55,
    );
  }

  g.lineStyle(1, accent, 0.4);
  const panels = 3;
  for (let i = 0; i < panels; i++) {
    const pw = size * Phaser.Math.FloatBetween(0.16, 0.3);
    const ph = pw * Phaser.Math.FloatBetween(0.4, 0.7);
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const rr = size * Phaser.Math.FloatBetween(0.28, 0.62);
    const px = cx + Math.cos(angle) * rr;
    const py = cy + Math.sin(angle) * rr * 0.55;
    g.strokeRect(px - pw / 2, py - ph / 2, pw, ph);
  }

  g.fillStyle(accent, 0.65);
  const rivets = 5;
  for (let i = 0; i < rivets; i++) {
    const angle = (i / rivets) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2);
    const rr = size * Phaser.Math.FloatBetween(0.55, 0.85);
    const px = cx + Math.cos(angle) * rr;
    const py = cy + Math.sin(angle) * rr * 0.55;
    g.fillCircle(px, py, 1.6);
  }

  g.generateTexture(key, w, h);
  g.destroy();
}

/** Soft radial-fade circle, reused (at different sizes/tints) for stars and nebula blobs. */
function drawSoftBlob(scene: Phaser.Scene, key: string, radius: number) {
  const w = radius * 2;
  const h = radius * 2;
  const cx = w / 2;
  const cy = h / 2;
  const g = scene.add.graphics();
  const rings = 10;
  for (let i = rings; i >= 1; i--) {
    const t = i / rings;
    const r = radius * t;
    const a = (1 - t) * 0.85 + 0.03;
    g.fillStyle(0xffffff, Math.min(a, 0.9));
    g.fillCircle(cx, cy, r);
  }
  g.generateTexture(key, w, h);
  g.destroy();
}

/** A hotter/tighter radial-gradient sprite (bright pinpoint core + soft falloff) —
 *  used for ambient motes and bridge energy-flow dots for a sparkle-like glow. */
function drawParticleGlow(scene: Phaser.Scene, key: string, radius: number) {
  const w = radius * 2;
  const h = radius * 2;
  const cx = w / 2;
  const cy = h / 2;
  const g = scene.add.graphics();
  const rings = 14;
  for (let i = rings; i >= 1; i--) {
    const t = i / rings;
    const r = radius * t;
    const a = Math.pow(1 - t, 1.6) * 0.95 + 0.02;
    g.fillStyle(0xffffff, Math.min(a, 0.98));
    g.fillCircle(cx, cy, r);
  }
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx, cy, radius * 0.12);
  g.generateTexture(key, w, h);
  g.destroy();
}

function drawDiamond(scene: Phaser.Scene, key: string, size: number) {
  const w = size;
  const h = size;
  const cx = w / 2;
  const cy = h / 2;
  const g = scene.add.graphics();
  const pts = [
    new Phaser.Math.Vector2(cx, cy - size * 0.5),
    new Phaser.Math.Vector2(cx + size * 0.3, cy),
    new Phaser.Math.Vector2(cx, cy + size * 0.5),
    new Phaser.Math.Vector2(cx - size * 0.3, cy),
  ];
  g.fillStyle(0xffffff, 1);
  g.fillPoints(pts, true, true);
  g.lineStyle(1.5, 0xffffff, 0.9);
  g.strokePoints(pts, true, true);
  g.generateTexture(key, w, h);
  g.destroy();
}

function drawDashedRing(scene: Phaser.Scene, key: string, radius: number, thickness: number) {
  const w = radius * 2 + 8;
  const h = radius * 2 + 8;
  const cx = w / 2;
  const cy = h / 2;
  const g = scene.add.graphics();
  const segments = 28;
  for (let i = 0; i < segments; i++) {
    if (i % 2 === 0) continue;
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    g.lineStyle(thickness, 0xffffff, 0.9);
    g.beginPath();
    g.arc(cx, cy, radius, a0, a1);
    g.strokePath();
  }
  g.generateTexture(key, w, h);
  g.destroy();
}

function drawSweepWedge(scene: Phaser.Scene, key: string, radius: number) {
  const w = radius * 2;
  const h = radius * 2;
  const cx = w / 2;
  const cy = h / 2;
  const g = scene.add.graphics();
  const arcDeg = 58;
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = Phaser.Math.DegToRad(-arcDeg / 2 + arcDeg * t) - Math.PI / 2;
    const alpha = (1 - t) * 0.5;
    g.lineStyle(2, 0xffffff, alpha);
    g.lineBetween(cx, cy, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  g.generateTexture(key, w, h);
  g.destroy();
}

interface GlowImage extends Phaser.GameObjects.Image {
  __baseAlpha?: number;
  __baseScale?: number;
}

interface StructureInfo {
  key: PodKey;
  name: string;
  accent: number;
  x: number;
  y: number;
  hitRadius: number;
  glowImages: GlowImage[];
  main: Phaser.GameObjects.Image;
  breathe: Phaser.GameObjects.Container;
}

interface CameraStop {
  x: number;
  y: number;
  zoom: number;
}

export default class StationScene extends Phaser.Scene {
  private targetZoom = 1;
  private targetScrollX = 0;
  private targetScrollY = 0;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private dragStartScroll = { x: 0, y: 0 };
  private pointerDownAt = { x: 0, y: 0 };

  private bridgeCurves = new Map<string, Phaser.Curves.QuadraticBezier>();
  private starLayer!: Phaser.GameObjects.Container;
  private nebulaLayer!: Phaser.GameObjects.Container;
  private hudmetaRing?: Phaser.GameObjects.Image;
  private hudmetaSweep?: Phaser.GameObjects.Image;
  private agentTimer?: Phaser.Time.TimerEvent;

  private onPodClick: (key: PodKey) => void;
  private onPodHover: (key: PodKey | null, anchor: HoverAnchor | null) => void;
  private onStructuresPositioned: (positions: StructurePosition[]) => void;
  private reducedMotion: boolean;
  private skipIntro: boolean;

  private structures: StructureInfo[] = [];
  private hoveredKey: PodKey | null = null;
  private candidateKey: PodKey | null = null;
  private candidateStreak = 0;
  // set the instant a click navigates away — halts the per-frame hover/position
  // callbacks so they can't keep re-rendering the React tree (and fighting the
  // pending route transition) while this scene waits to be torn down
  private navigatingAway = false;

  private defaultCameraStop: CameraStop = { x: 0, y: 0, zoom: 1 };
  private introPending = false;
  private introActive = false;
  private introLegs: CameraStop[] = [];
  private introLegIndex = 0;
  private introLegStartTime = 0;

  constructor(callbacks?: StationSceneCallbacks) {
    super('StationScene');
    this.onPodClick = callbacks?.onPodClick ?? (() => {});
    this.onPodHover = callbacks?.onPodHover ?? (() => {});
    this.onStructuresPositioned = callbacks?.onStructuresPositioned ?? (() => {});
    this.reducedMotion = callbacks?.reducedMotion ?? false;
    this.skipIntro = callbacks?.skipIntro ?? false;
  }

  create() {
    this.cameras.main.setBackgroundColor(THEME.colors.voidBg);

    this.generateTextures();
    this.buildNebula();
    this.buildStarfield();
    this.buildBridges();
    this.registerStructure(
      THEME.hudmeta.key as PodKey,
      THEME.hudmeta.name,
      0,
      0,
      THEME.layout.hudmetaSize,
      THEME.hudmeta.accent,
      true,
    );
    THEME.pods.forEach((pod) => {
      const { x, y } = this.getPodPosition(pod);
      this.registerStructure(pod.key as PodKey, pod.name, x, y, THEME.layout.podSize, pod.accent, false);
    });
    this.setupCamera();
    this.setupInput();
    this.scheduleNextAgent();

    if (!this.reducedMotion && !this.skipIntro) {
      this.introPending = true;
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
  }

  update(time: number, delta: number) {
    const cam = this.cameras.main;

    if (this.introPending) {
      this.introPending = false;
      this.startIntroSequence(time);
    }
    this.advanceIntro(time);

    // cap dt so a stalled tab / GC pause doesn't cause a sudden camera jump on resume
    const dt = Math.min(delta / 1000, 0.1);
    cam.zoom = expDecay(cam.zoom, this.targetZoom, THEME.camera.zoomDecay, dt);
    cam.scrollX = expDecay(cam.scrollX, this.targetScrollX, THEME.camera.scrollDecay, dt);
    cam.scrollY = expDecay(cam.scrollY, this.targetScrollY, THEME.camera.scrollDecay, dt);

    if (!this.reducedMotion) {
      const t = time * 0.00003;
      this.starLayer.x = Math.sin(t) * 24;
      this.starLayer.y = Math.cos(t * 0.8) * 16;

      const tn = time * 0.000012;
      this.nebulaLayer.x = Math.sin(tn) * 40;
      this.nebulaLayer.y = Math.cos(tn * 0.7) * 26;

      if (this.hudmetaRing) this.hudmetaRing.rotation += delta * 0.00025;
      if (this.hudmetaSweep) this.hudmetaSweep.rotation += delta * 0.0009;
    }

    if (!this.navigatingAway) {
      this.resolveHover(cam);
      this.reportPositions(cam);
    }
  }

  private cleanup() {
    this.agentTimer?.remove();
    this.introActive = false;
    this.tweens.killAll();
  }

  // ---------------------------------------------------------------- textures

  private generateTextures() {
    drawSoftBlob(this, 'soft-dot', 18);
    drawSoftBlob(this, 'nebula-blob', 260);
    drawParticleGlow(this, 'particle-glow', 20);
    drawDiamond(this, 'agent-diamond', 22);
    drawStructureTexture(this, 'hudmeta-body', THEME.layout.hudmetaSize, THEME.hudmeta.accent, THEME.hudmeta.core);
    drawGreebleTexture(this, 'hudmeta-greeble', THEME.layout.hudmetaSize, THEME.hudmeta.accent);
    THEME.pods.forEach((pod) => {
      drawStructureTexture(this, `${pod.key}-body`, THEME.layout.podSize, pod.accent, pod.core);
      drawGreebleTexture(this, `${pod.key}-greeble`, THEME.layout.podSize, pod.accent);
    });
    drawDashedRing(this, 'ring-dashed', THEME.layout.hudmetaSize * 1.35, 3);
    drawSweepWedge(this, 'sweep-wedge', THEME.layout.hudmetaSize * 1.55);
  }

  // ----------------------------------------------------------------- layout

  private getPodPosition(pod: PodDef) {
    const rad = Phaser.Math.DegToRad(pod.angle);
    const R = THEME.layout.podRadius;
    return { x: Math.cos(rad) * R, y: Math.sin(rad) * R * THEME.layout.isoSquash };
  }

  // -------------------------------------------------------------- structure

  private registerStructure(
    key: PodKey,
    name: string,
    x: number,
    y: number,
    size: number,
    accent: number,
    isHud: boolean,
  ) {
    const bodyKey = `${key}-body`;
    const container = this.add.container(x, y).setDepth(isHud ? 20 : 10);

    const breathe = this.add.container(0, 0);
    const glowImages: GlowImage[] = [];
    const layers = THEME.glow.layers;
    for (let i = layers; i >= 1; i--) {
      const scale = 1 + i * THEME.glow.scaleStep;
      const alpha = THEME.glow.baseAlpha * (1 - i / (layers + 1.6));
      const img: GlowImage = this.add
        .image(0, 0, bodyKey)
        .setScale(scale)
        .setAlpha(alpha)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(accent);
      img.__baseAlpha = alpha;
      img.__baseScale = scale;
      glowImages.push(img);
      breathe.add(img);
    }
    container.add(breathe);

    const main = this.add.image(0, 0, bodyKey).setScale(1);
    container.add(main);

    const greeble = this.add.image(0, 0, `${key}-greeble`).setAlpha(0.55).setTint(accent);
    container.add(greeble);

    if (isHud) {
      const ring = this.add
        .image(0, 0, 'ring-dashed')
        .setAlpha(0.6)
        .setTint(accent)
        .setBlendMode(Phaser.BlendModes.ADD);
      const sweep = this.add
        .image(0, 0, 'sweep-wedge')
        .setAlpha(0.7)
        .setTint(THEME.hudmeta.accentBright)
        .setBlendMode(Phaser.BlendModes.ADD);
      container.add(ring);
      container.add(sweep);
      this.hudmetaRing = ring;
      this.hudmetaSweep = sweep;
    } else if (!this.reducedMotion) {
      this.buildMotes(x, y, size, accent);
    }

    if (!this.reducedMotion) {
      this.tweens.add({
        targets: breathe,
        scale: { from: 0.94, to: 1.08 },
        duration: Phaser.Math.Between(3000, 5000),
        delay: Phaser.Math.Between(0, 2200),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    this.add
      .text(x, y - size * 1.15 - 14, name, {
        fontFamily: '"Orbitron", "Trebuchet MS", sans-serif',
        fontSize: isHud ? '20px' : '15px',
        color: toCssHex(accent),
        fontStyle: '600',
        align: 'center',
      })
      .setOrigin(0.5, 1)
      .setDepth(25)
      .setShadow(0, 0, toCssHex(accent), 8, true, true);

    // hit area covers the visible glow halo, not just the crisp octagon outline
    const hitRadius = size * HIT_RADIUS_MULT;

    this.structures.push({ key, name, accent, x, y, hitRadius, glowImages, main, breathe });

    return container;
  }

  private buildMotes(x: number, y: number, size: number, accent: number) {
    const emitter = this.add.particles(x, y, 'particle-glow', {
      x: { min: -size * 0.6, max: size * 0.6 },
      y: { min: size * 0.25, max: size * 0.65 },
      lifespan: { min: 3200, max: 5200 },
      speedY: { min: -16, max: -6 },
      speedX: { min: -5, max: 5 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 0.55, end: 0 },
      frequency: 950,
      quantity: 1,
      tint: accent,
      blendMode: 'ADD',
    });
    emitter.setDepth(6);
  }

  // ------------------------------------------------------------ hover/click

  /** Nearest structure whose center is within its own hit radius of a world
   *  point — ties resolve to the closer center, never "first hit detected". */
  private nearestStructureAt(worldX: number, worldY: number): PodKey | null {
    let candidate: PodKey | null = null;
    let bestDist = Infinity;
    for (const s of this.structures) {
      const d = Phaser.Math.Distance.Between(worldX, worldY, s.x, s.y);
      if (d <= s.hitRadius && d < bestDist) {
        bestDist = d;
        candidate = s.key;
      }
    }
    return candidate;
  }

  /** Every frame: find the nearest structure center within its hit radius and
   *  only commit a hover change once that candidate has been stable for a few
   *  frames — this resolves ambiguous/boundary zones to a single settled pod
   *  instead of the hover state thrashing between overlapping candidates. */
  private resolveHover(cam: Phaser.Cameras.Scene2D.Camera) {
    if (this.isDragging) return;

    const pointer = this.input.activePointer;
    const wp = cam.getWorldPoint(pointer.x, pointer.y);
    const candidate = this.nearestStructureAt(wp.x, wp.y);

    if (candidate === this.candidateKey) {
      this.candidateStreak++;
    } else {
      this.candidateKey = candidate;
      this.candidateStreak = 1;
    }

    if (this.candidateStreak >= HOVER_COMMIT_FRAMES && candidate !== this.hoveredKey) {
      this.setHoveredKey(candidate, cam);
    }
  }

  private setHoveredKey(key: PodKey | null, cam: Phaser.Cameras.Scene2D.Camera) {
    if (this.hoveredKey === key) return;

    const prev = this.structures.find((s) => s.key === this.hoveredKey);
    if (prev) this.setStructureHighlighted(prev, false);

    this.hoveredKey = key;

    const next = this.structures.find((s) => s.key === key);
    if (next) this.setStructureHighlighted(next, true);

    this.input.setDefaultCursor(key ? 'pointer' : 'default');
    if (!next) this.onPodHover(null, null);
    else this.emitHoverAnchor(next, cam);
  }

  private setStructureHighlighted(s: StructureInfo, entering: boolean) {
    s.glowImages.forEach((img) => {
      this.tweens.add({
        targets: img,
        alpha: entering ? Math.min((img.__baseAlpha ?? 0.2) * 2.2, 0.65) : (img.__baseAlpha ?? 0.2),
        scaleX: entering ? (img.__baseScale ?? 1) * 1.05 : (img.__baseScale ?? 1),
        scaleY: entering ? (img.__baseScale ?? 1) * 1.05 : (img.__baseScale ?? 1),
        duration: entering ? 180 : 220,
      });
    });
    this.tweens.add({ targets: s.main, scale: entering ? 1.06 : 1, duration: entering ? 180 : 220 });
  }

  /** World-to-screen projection for the DOM overlay (preview card, focus rings).
   *  `worldView` (not `scrollX/scrollY` directly) is the correct reference here:
   *  Phaser's scroll is anchored at the viewport center, so at zoom !== 1 a plain
   *  `(worldX - scrollX) * zoom` is off by a zoom-dependent amount — worldView.x/y
   *  is the world-space coordinate of the screen's top-left corner, which is what
   *  a simple linear scale into screen space actually needs. */
  private worldToScreen(cam: Phaser.Cameras.Scene2D.Camera, worldX: number, worldY: number): ScreenPoint {
    return {
      x: (worldX - cam.worldView.x) * cam.zoom,
      y: (worldY - cam.worldView.y) * cam.zoom,
    };
  }

  private emitHoverAnchor(s: StructureInfo, cam: Phaser.Cameras.Scene2D.Camera) {
    const p = this.worldToScreen(cam, s.x, s.y);
    this.onPodHover(s.key, { x: p.x, y: p.y, radius: s.hitRadius * cam.zoom });
  }

  private reportPositions(cam: Phaser.Cameras.Scene2D.Camera) {
    this.onStructuresPositioned(
      this.structures.map((s) => {
        const p = this.worldToScreen(cam, s.x, s.y);
        return {
          key: s.key,
          name: s.name,
          accent: s.accent,
          x: p.x,
          y: p.y,
          radius: s.hitRadius * cam.zoom,
        };
      }),
    );

    // the committed hover's screen anchor also needs refreshing every frame so
    // the preview card keeps tracking during camera pan/zoom easing
    if (this.hoveredKey) {
      const s = this.structures.find((st) => st.key === this.hoveredKey);
      if (s) this.emitHoverAnchor(s, cam);
    }
  }

  // ---------------------------------------------------------------- bridges

  private buildBridges() {
    const g = this.add.graphics().setDepth(-10);
    const hubAccent = Phaser.Display.Color.ValueToColor(THEME.hudmeta.accent);

    THEME.pods.forEach((pod) => {
      const podPos = this.getPodPosition(pod);
      const dist = Math.hypot(podPos.x, podPos.y);
      const nx = podPos.x / dist;
      const ny = podPos.y / dist;

      // The pod ring is squashed vertically (isoSquash) for the isometric read, so
      // pods near the top/bottom of the ring sit much closer to Hudmeta than pods
      // near the sides. Fixed pixel insets can then overlap almost entirely (e.g.
      // Dev Lab at the top), collapsing the bridge to a near-invisible sliver — so
      // insets are capped to a safe fraction of the actual hub-to-pod distance.
      const rawHubInset = THEME.layout.hudmetaSize * 1.4;
      const rawPodInset = THEME.layout.podSize * 1.3;
      const maxTotalInset = dist * 0.8;
      const insetScale = Math.min(1, maxTotalInset / (rawHubInset + rawPodInset));
      const hubInset = rawHubInset * insetScale;
      const podInset = rawPodInset * insetScale;

      const hubEdge = new Phaser.Math.Vector2(nx * hubInset, ny * hubInset);
      const podEdge = new Phaser.Math.Vector2(podPos.x - nx * podInset, podPos.y - ny * podInset);

      const curveLen = dist - hubInset - podInset;
      const perp = new Phaser.Math.Vector2(-ny, nx);
      const bowMagnitude = Math.min(Phaser.Math.Between(40, 75), curveLen * 0.9);
      const bow = bowMagnitude * (Phaser.Math.Between(0, 1) === 0 ? -1 : 1);
      const mid = new Phaser.Math.Vector2(
        (hubEdge.x + podEdge.x) / 2 + perp.x * bow,
        (hubEdge.y + podEdge.y) / 2 + perp.y * bow,
      );

      const curve = new Phaser.Curves.QuadraticBezier(hubEdge, mid, podEdge);
      this.bridgeCurves.set(pod.key, curve);

      const points = curve.getPoints(48);
      const podColor = Phaser.Display.Color.ValueToColor(pod.accent);
      for (let i = 0; i < points.length - 1; i++) {
        const blend = Phaser.Display.Color.Interpolate.ColorWithColor(podColor, hubAccent, points.length, i);
        const col = Phaser.Display.Color.GetColor(blend.r, blend.g, blend.b);
        g.lineStyle(5, col, 0.16);
        g.lineBetween(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
        g.lineStyle(1.5, col, 0.6);
        g.lineBetween(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
      }

      if (this.reducedMotion) return;

      const dot = this.add
        .image(hubEdge.x, hubEdge.y, 'particle-glow')
        .setTint(pod.accent)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.7)
        .setDepth(-9)
        .setAlpha(0);

      const proxy = { t: 0 };
      this.tweens.add({
        targets: proxy,
        t: 1,
        duration: Phaser.Math.Between(3400, 4800),
        delay: Phaser.Math.Between(0, 2200),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          const pt = curve.getPoint(proxy.t);
          dot.setPosition(pt.x, pt.y);
          dot.setAlpha(Phaser.Math.Clamp(Math.min(proxy.t, 1 - proxy.t) * 6, 0, 0.85));
        },
      });
    });
  }

  // ------------------------------------------------------------- agents

  private scheduleNextAgent() {
    const delay = Phaser.Math.Between(8000, 15000);
    this.agentTimer = this.time.delayedCall(delay, () => {
      this.spawnAgent();
      this.scheduleNextAgent();
    });
  }

  private spawnAgent() {
    const pod = Phaser.Utils.Array.GetRandom(THEME.pods);
    const curve = this.bridgeCurves.get(pod.key);
    if (!curve) return;

    const toHub = Math.random() < 0.5;
    const proxy = { t: toHub ? 1 : 0 };
    const start = curve.getPoint(proxy.t);

    const sprite = this.add
      .image(start.x, start.y, 'agent-diamond')
      .setTint(pod.accent)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(15)
      .setScale(0.85)
      .setAlpha(0);

    this.tweens.add({ targets: sprite, alpha: 1, duration: 260 });
    this.tweens.add({
      targets: proxy,
      t: toHub ? 0 : 1,
      duration: 2400,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const pt = curve.getPoint(proxy.t);
        sprite.setPosition(pt.x, pt.y);
      },
      onComplete: () => {
        this.tweens.add({
          targets: sprite,
          alpha: 0,
          scale: 0.4,
          duration: 320,
          onComplete: () => sprite.destroy(),
        });
      },
    });
  }

  // ------------------------------------------------------------ background

  private buildStarfield() {
    this.starLayer = this.add.container(0, 0).setDepth(-80);
    this.starLayer.setScrollFactor(0.35);
    const range = 2200;
    for (let i = 0; i < 360; i++) {
      const x = Phaser.Math.Between(-range, range);
      const y = Phaser.Math.Between(-range, range);
      const scale = Phaser.Math.FloatBetween(0.12, 0.55);
      const alpha = Phaser.Math.FloatBetween(0.2, 0.85);
      const star = this.add.image(x, y, 'soft-dot').setScale(scale).setAlpha(alpha);
      if (Math.random() < 0.3) star.setTint(THEME.colors.starBright);
      else star.setTint(THEME.colors.starDim);
      this.starLayer.add(star);
    }
  }

  private buildNebula() {
    this.nebulaLayer = this.add.container(0, 0).setDepth(-100);
    this.nebulaLayer.setScrollFactor(0.12);
    const palette = [THEME.colors.nebulaA, THEME.colors.nebulaB];
    for (let i = 0; i < 5; i++) {
      const x = Phaser.Math.Between(-1600, 1600);
      const y = Phaser.Math.Between(-1200, 1200);
      const scale = Phaser.Math.FloatBetween(1.6, 3.2);
      const blob = this.add
        .image(x, y, 'nebula-blob')
        .setScale(scale)
        .setAlpha(Phaser.Math.FloatBetween(0.08, 0.16))
        .setTint(palette[i % palette.length]);
      this.nebulaLayer.add(blob);
    }
  }

  // -------------------------------------------------------------- camera

  private setupCamera() {
    const cam = this.cameras.main;
    const R = THEME.layout.podRadius;
    const fitSpan = R * 2 * THEME.layout.isoSquash + 480;
    const w = this.scale.width || 800;
    const h = this.scale.height || 600;
    const fitZoom = Math.min(w, h) / fitSpan;
    const zoom = Phaser.Math.Clamp(fitZoom, MIN_ZOOM, MAX_ZOOM);

    cam.setZoom(zoom);
    cam.centerOn(0, 0);
    this.targetZoom = zoom;
    this.targetScrollX = cam.scrollX;
    this.targetScrollY = cam.scrollY;
    this.defaultCameraStop = { x: cam.scrollX, y: cam.scrollY, zoom };

    const bound = R + 900;
    cam.setBounds(-bound, -bound, bound * 2, bound * 2);

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      cam.setSize(gameSize.width, gameSize.height);
    });
  }

  /** Computes the scroll needed to center on a world point at a given zoom by
   *  delegating to the camera's own centerOn (rather than hand-deriving the
   *  formula), then restores the camera's current live position so nothing
   *  visibly snaps — only the smoothing target changes. */
  private scrollForCenteredView(cam: Phaser.Cameras.Scene2D.Camera, x: number, y: number, zoom: number): CameraStop {
    const liveX = cam.scrollX;
    const liveY = cam.scrollY;
    const liveZoom = cam.zoom;

    cam.setZoom(zoom);
    cam.centerOn(x, y);
    const stop: CameraStop = { x: cam.scrollX, y: cam.scrollY, zoom };

    cam.setZoom(liveZoom);
    cam.scrollX = liveX;
    cam.scrollY = liveY;

    return stop;
  }

  /** Starts the intro at `time` (the same wall-clock-accurate value `update()`
   *  receives every frame). Progression is driven directly off that value in
   *  `advanceIntro()` rather than `this.time.delayedCall` — under this scene's
   *  particle/tween load, Phaser's Clock-driven timers can end up running far
   *  slower than real time (its per-frame delta gets smoothed/clamped when the
   *  actual frame rate drops), which silently stalls a delayedCall-based
   *  sequence. Tying it to `time` instead keeps it exactly in sync with the
   *  camera's own easing, which already uses that same clock. */
  private startIntroSequence(time: number) {
    const cam = this.cameras.main;
    const closeZoom = Phaser.Math.Clamp(this.defaultCameraStop.zoom * 2, MIN_ZOOM, MAX_ZOOM);

    this.introLegs = [
      this.scrollForCenteredView(cam, 0, 0, closeZoom),
      ...THEME.pods.map((pod) => {
        const pos = this.getPodPosition(pod);
        return this.scrollForCenteredView(cam, pos.x, pos.y, closeZoom);
      }),
    ];

    this.introActive = true;
    this.introLegIndex = 0;
    this.introLegStartTime = time;

    const first = this.introLegs[0];
    cam.setZoom(first.zoom);
    cam.scrollX = first.x;
    cam.scrollY = first.y;
    this.targetZoom = first.zoom;
    this.targetScrollX = first.x;
    this.targetScrollY = first.y;
  }

  private advanceIntro(time: number) {
    if (!this.introActive) return;
    if (time - this.introLegStartTime < INTRO_LEG_MS) return;

    this.introLegIndex++;
    this.introLegStartTime = time;

    if (this.introLegIndex >= this.introLegs.length) {
      this.targetZoom = this.defaultCameraStop.zoom;
      this.targetScrollX = this.defaultCameraStop.x;
      this.targetScrollY = this.defaultCameraStop.y;
      this.introActive = false;
      return;
    }

    const leg = this.introLegs[this.introLegIndex];
    this.targetZoom = leg.zoom;
    this.targetScrollX = leg.x;
    this.targetScrollY = leg.y;
  }

  private cancelIntro() {
    if (!this.introActive) return;
    this.introActive = false;
    this.targetZoom = this.defaultCameraStop.zoom;
    this.targetScrollX = this.defaultCameraStop.x;
    this.targetScrollY = this.defaultCameraStop.y;
  }

  private setupInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.cancelIntro();
      this.isDragging = true;
      this.dragStart = { x: p.x, y: p.y };
      this.dragStartScroll = { x: this.targetScrollX, y: this.targetScrollY };
      this.pointerDownAt = { x: p.x, y: p.y };
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging || !p.isDown) return;
      const zoom = this.cameras.main.zoom;
      const dx = (p.x - this.dragStart.x) / zoom;
      const dy = (p.y - this.dragStart.y) / zoom;
      this.targetScrollX = this.dragStartScroll.x - dx;
      this.targetScrollY = this.dragStartScroll.y - dy;
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.isDragging = false;
      const dist = Phaser.Math.Distance.Between(this.pointerDownAt.x, this.pointerDownAt.y, p.x, p.y);
      if (dist < CLICK_DRAG_THRESHOLD) {
        // resolved fresh (not from the debounced hover candidate) so a click
        // is accurate even on the very first frame the pointer reaches a pod
        const wp = this.cameras.main.getWorldPoint(p.x, p.y);
        const clicked = this.nearestStructureAt(wp.x, wp.y);
        if (clicked) {
          this.navigatingAway = true;
          this.setHoveredKey(null, this.cameras.main);
          this.onPodClick(clicked);
        }
      }
    });
    this.input.on('pointerupoutside', () => {
      this.isDragging = false;
    });

    this.input.on('wheel', (_p: Phaser.Input.Pointer, _go: unknown, _dx: number, dy: number) => {
      this.cancelIntro();
      this.targetZoom = Phaser.Math.Clamp(this.targetZoom - dy * 0.0012, MIN_ZOOM, MAX_ZOOM);
    });
  }
}

export { INTRO_SESSION_KEY };
