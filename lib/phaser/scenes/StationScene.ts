import Phaser from 'phaser';
import { THEME, toCssHex, type PodDef, type PodKey } from '../theme';

const MIN_ZOOM = THEME.camera.minZoom;
const MAX_ZOOM = THEME.camera.maxZoom;
const CLICK_DRAG_THRESHOLD = 6;

/** Frame-rate-independent exponential smoothing: converges toward `target` at a
 *  constant real-time rate regardless of the current frame delta. */
function expDecay(current: number, target: number, decay: number, dt: number): number {
  const diff = target - current;
  if (Math.abs(diff) < 0.01) return target;
  return current + diff * (1 - Math.exp(-decay * dt));
}

export interface StationSceneCallbacks {
  onPodClick: (key: PodKey) => void;
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

/** Soft radial-fade circle, reused (at different sizes/tints) for glow dots, motes and nebula blobs. */
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

export default class StationScene extends Phaser.Scene {
  private targetZoom = 1;
  private targetScrollX = 0;
  private targetScrollY = 0;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private dragStartScroll = { x: 0, y: 0 };

  private bridgeCurves = new Map<string, Phaser.Curves.QuadraticBezier>();
  private starLayer!: Phaser.GameObjects.Container;
  private nebulaLayer!: Phaser.GameObjects.Container;
  private tooltipBg!: Phaser.GameObjects.Graphics;
  private tooltipText!: Phaser.GameObjects.Text;
  private hudmetaRing?: Phaser.GameObjects.Image;
  private hudmetaSweep?: Phaser.GameObjects.Image;
  private agentTimer?: Phaser.Time.TimerEvent;
  private onPodClick: (key: PodKey) => void;

  constructor(callbacks?: StationSceneCallbacks) {
    super('StationScene');
    this.onPodClick = callbacks?.onPodClick ?? (() => {});
  }

  create() {
    this.cameras.main.setBackgroundColor(THEME.colors.voidBg);

    this.generateTextures();
    this.buildNebula();
    this.buildStarfield();
    this.buildBridges();
    this.createStructure(
      THEME.hudmeta.key,
      THEME.hudmeta.name,
      0,
      0,
      THEME.layout.hudmetaSize,
      THEME.hudmeta.accent,
      true,
    );
    THEME.pods.forEach((pod) => {
      const { x, y } = this.getPodPosition(pod);
      this.createStructure(pod.key, pod.name, x, y, THEME.layout.podSize, pod.accent, false);
    });
    this.buildTooltip();
    this.setupCamera();
    this.setupInput();
    this.scheduleNextAgent();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
  }

  update(time: number, delta: number) {
    const cam = this.cameras.main;
    // cap dt so a stalled tab / GC pause doesn't cause a sudden camera jump on resume
    const dt = Math.min(delta / 1000, 0.1);
    cam.zoom = expDecay(cam.zoom, this.targetZoom, THEME.camera.zoomDecay, dt);
    cam.scrollX = expDecay(cam.scrollX, this.targetScrollX, THEME.camera.scrollDecay, dt);
    cam.scrollY = expDecay(cam.scrollY, this.targetScrollY, THEME.camera.scrollDecay, dt);

    const t = time * 0.00003;
    this.starLayer.x = Math.sin(t) * 24;
    this.starLayer.y = Math.cos(t * 0.8) * 16;

    const tn = time * 0.000012;
    this.nebulaLayer.x = Math.sin(tn) * 40;
    this.nebulaLayer.y = Math.cos(tn * 0.7) * 26;

    if (this.hudmetaRing) this.hudmetaRing.rotation += delta * 0.00025;
    if (this.hudmetaSweep) this.hudmetaSweep.rotation += delta * 0.0009;
  }

  private cleanup() {
    this.agentTimer?.remove();
    this.tweens.killAll();
  }

  // ---------------------------------------------------------------- textures

  private generateTextures() {
    drawSoftBlob(this, 'soft-dot', 18);
    drawSoftBlob(this, 'nebula-blob', 260);
    drawDiamond(this, 'agent-diamond', 22);
    drawStructureTexture(this, 'hudmeta-body', THEME.layout.hudmetaSize, THEME.hudmeta.accent, THEME.hudmeta.core);
    THEME.pods.forEach((pod) => drawStructureTexture(this, `${pod.key}-body`, THEME.layout.podSize, pod.accent, pod.core));
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

  private createStructure(
    key: string,
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
    } else {
      this.buildMotes(x, y, size, accent);
    }

    this.tweens.add({
      targets: breathe,
      scale: { from: 0.94, to: 1.08 },
      duration: Phaser.Math.Between(3000, 5000),
      delay: Phaser.Math.Between(0, 2200),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const label = this.add
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

    const hitRadius = size * 1.05;
    container.setSize(hitRadius * 2, hitRadius * 2);
    container.setInteractive(new Phaser.Geom.Circle(0, 0, hitRadius), Phaser.Geom.Circle.Contains);

    container.on('pointerover', () => {
      glowImages.forEach((img) => {
        this.tweens.add({
          targets: img,
          alpha: Math.min((img.__baseAlpha ?? 0.2) * 2.2, 0.65),
          scaleX: (img.__baseScale ?? 1) * 1.05,
          scaleY: (img.__baseScale ?? 1) * 1.05,
          duration: 180,
        });
      });
      this.tweens.add({ targets: main, scale: 1.06, duration: 180 });
      this.showTooltip(name, x, label.y - 22);
      this.input.setDefaultCursor('pointer');
    });

    container.on('pointerout', () => {
      glowImages.forEach((img) => {
        this.tweens.add({
          targets: img,
          alpha: img.__baseAlpha ?? 0.2,
          scaleX: img.__baseScale ?? 1,
          scaleY: img.__baseScale ?? 1,
          duration: 220,
        });
      });
      this.tweens.add({ targets: main, scale: 1, duration: 220 });
      this.hideTooltip();
      this.input.setDefaultCursor('default');
    });

    // click (not drag) opens the full data panel — a click is a down/up pair
    // with minimal pointer travel, distinguishing it from a camera-pan drag
    let clickStart = { x: 0, y: 0 };
    container.on('pointerdown', (p: Phaser.Input.Pointer) => {
      clickStart = { x: p.x, y: p.y };
    });
    container.on('pointerup', (p: Phaser.Input.Pointer) => {
      const dist = Phaser.Math.Distance.Between(clickStart.x, clickStart.y, p.x, p.y);
      if (dist < CLICK_DRAG_THRESHOLD) {
        this.onPodClick(key as PodKey);
      }
    });

    return container;
  }

  private buildMotes(x: number, y: number, size: number, accent: number) {
    const emitter = this.add.particles(x, y, 'soft-dot', {
      x: { min: -size * 0.6, max: size * 0.6 },
      y: { min: size * 0.25, max: size * 0.65 },
      lifespan: { min: 3200, max: 5200 },
      speedY: { min: -16, max: -6 },
      speedX: { min: -5, max: 5 },
      scale: { start: 0.32, end: 0 },
      alpha: { start: 0.5, end: 0 },
      frequency: 950,
      quantity: 1,
      tint: accent,
      blendMode: 'ADD',
    });
    emitter.setDepth(6);
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

      const dot = this.add
        .image(hubEdge.x, hubEdge.y, 'soft-dot')
        .setTint(pod.accent)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.85)
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

  // ------------------------------------------------------------ tooltip

  private buildTooltip() {
    this.tooltipBg = this.add.graphics().setDepth(30).setVisible(false);
    this.tooltipText = this.add
      .text(0, 0, '', {
        fontFamily: '"Orbitron", "Trebuchet MS", sans-serif',
        fontSize: '12px',
        color: '#eafcff',
        align: 'center',
      })
      .setOrigin(0.5, 1)
      .setDepth(31)
      .setVisible(false);
  }

  private showTooltip(name: string, x: number, y: number) {
    this.tooltipText.setText([name.toUpperCase(), 'STATUS: NOMINAL']).setPosition(x, y).setVisible(true);
    const b = this.tooltipText.getBounds();
    const pad = 8;
    this.tooltipBg.clear();
    this.tooltipBg.fillStyle(0x040608, 0.8);
    this.tooltipBg.lineStyle(1, 0x66e8ff, 0.5);
    this.tooltipBg.fillRoundedRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2, 6);
    this.tooltipBg.strokeRoundedRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2, 6);
    this.tooltipBg.setVisible(true);
  }

  private hideTooltip() {
    this.tooltipText.setVisible(false);
    this.tooltipBg.setVisible(false);
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

    const bound = R + 900;
    cam.setBounds(-bound, -bound, bound * 2, bound * 2);

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      cam.setSize(gameSize.width, gameSize.height);
    });
  }

  private setupInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStart = { x: p.x, y: p.y };
      this.dragStartScroll = { x: this.targetScrollX, y: this.targetScrollY };
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging || !p.isDown) return;
      const zoom = this.cameras.main.zoom;
      const dx = (p.x - this.dragStart.x) / zoom;
      const dy = (p.y - this.dragStart.y) / zoom;
      this.targetScrollX = this.dragStartScroll.x - dx;
      this.targetScrollY = this.dragStartScroll.y - dy;
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });
    this.input.on('pointerupoutside', () => {
      this.isDragging = false;
    });

    this.input.on('wheel', (_p: Phaser.Input.Pointer, _go: unknown, _dx: number, dy: number) => {
      this.targetZoom = Phaser.Math.Clamp(this.targetZoom - dy * 0.0012, MIN_ZOOM, MAX_ZOOM);
    });
  }
}
