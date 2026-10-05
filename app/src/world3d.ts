import gsap from 'gsap';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { reduced, d } from './motion';
import type { Cue } from './sound';
import { BOX, type View } from './world';

/**
 * The 3D orchard: toon-shaded, ink-outlined, one continuous world.
 * Outside the wall is the open field (the transparent chain). Behind it,
 * 120 identical trees (the shielded pool). The camera cranes over the wall
 * instead of cutting between scenes. Same API as the 2D world, so the
 * scenes don't know which one they're driving.
 */

type V3 = THREE.Vector3;
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
type Box = { x: number; y: number; w: number; h: number };
type Area = 'auto' | 'hero';
type Shot = { pos: V3; look: V3 };
const shot = (p: [number, number, number], l: [number, number, number]): Shot => ({ pos: v3(...p), look: v3(...l) });

// ---------------------------------------------------------------- Layout
const FIELD = v3(-2.6, 0, 4.4);
const STALL = v3(7, 0, 3.6);
const SCALE_AT = v3(4.7, 0, 6.8);
const BOARD_AT = v3(5.6, 0, 2.2);
const TOWER = v3(-7.5, 0, 10.5);
const STRANGER = v3(2.5, 0, 2.3);
const TREE_SCALE = 1.3;
const CROWN = 2.4 * TREE_SCALE;
const ROWS = 10;
const COLS = 12;
const GAP = 4.6;
const rowZ = (r: number) => -5.2 - r * GAP;
const colX = (c: number) => (c - (COLS - 1) / 2) * GAP;

const SHOTS = new Map<Box, Shot>([
  [BOX.hero, shot([0, 3.2, 12.5], [0, 4.1, -3])],
  [BOX.gate, shot([0.3, 1.6, 5.4], [0, 1.4, 0])],
  [BOX.gateTight, shot([0, 1.5, 3.2], [0, 1.4, 0])],
  [BOX.wall, shot([2.2, 1.9, 8.8], [1.3, 1.3, 0.8])],
  [BOX.field, shot([0.8, 3, 14], [-1.4, 2, 3.6])],
  [BOX.stall, shot([2.8, 3.2, 14], [3, 1.3, 2.5])],
  [BOX.orchard, shot([0, 15, 9], [0, 0.5, -16])],
  [BOX.low, shot([0, 1.4, -1.2], [0, 2.6, -16])],
  [BOX.golden, shot([-16, 25, 14], [0, 0, -20])],
]);

// ---------------------------------------------------------------- Shared shading
const uTime = { value: 0 };
const toonRamp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]), 4, 1);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

const toon = (color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}) =>
  new THREE.MeshToonMaterial({ color, gradientMap: toonRamp, ...extra });

/** Vertex tweaks: wind sway above `base` height and inverted-hull outline push. */
function shade<T extends THREE.Material>(mat: T, opt: { wind?: number; base?: number; outline?: number }) {
  const { wind = 0, base = 1.1, outline = 0 } = opt;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader =
      'uniform float uTime;\n' +
      sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        ${outline ? `transformed += normalize(normal) * ${outline.toFixed(3)};` : ''}
        ${
          wind
            ? `{
          #ifdef USE_INSTANCING
            vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          #else
            vec3 ip = vec3(0.0);
          #endif
          vec3 wp = (modelMatrix * vec4(ip, 1.0)).xyz;
          float h = max(position.y - ${base.toFixed(2)}, 0.0);
          transformed.x += sin(uTime * 1.3 + wp.x * 0.55 + wp.z * 0.35) * ${wind.toFixed(3)} * h;
          transformed.z += cos(uTime * 1.05 + wp.x * 0.3 - wp.z * 0.2) * ${(wind * 0.6).toFixed(3)} * h;
        }`
            : ''
        }`,
      );
  };
  mat.customProgramCacheKey = () => `w${wind}b${base}o${outline}`;
  return mat;
}

const inkMat = (color: THREE.ColorRepresentation, outline: number, wind = 0, base = 1.1) =>
  shade(new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }), { outline, wind, base });

/** Add an ink outline shell to a mesh. */
function ink(mesh: THREE.Mesh, width = 0.03, color: THREE.ColorRepresentation = 0x241a1f) {
  const o = new THREE.Mesh(mesh.geometry, inkMat(color, width));
  o.position.copy(mesh.position);
  o.rotation.copy(mesh.rotation);
  o.scale.copy(mesh.scale);
  mesh.parent?.add(o);
  return o;
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], at?: [number, number, number], parent?: THREE.Object3D) {
  const m = new THREE.Mesh(geo, mat);
  if (at) m.position.set(...at);
  m.castShadow = true;
  m.receiveShadow = true;
  parent?.add(m);
  return m;
}

// ---------------------------------------------------------------- Canvas textures
function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d')!;
  draw(c);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function brickTex() {
  return canvasTex(256, 128, (c) => {
    c.fillStyle = '#E6D3B6';
    c.fillRect(0, 0, 256, 128);
    const cols = ['#B9553D', '#AD4C36', '#C3603F', '#A34532'];
    for (let r = 0; r < 8; r++) {
      const off = r % 2 ? 16 : 0;
      for (let x = -32; x < 256; x += 32) {
        c.fillStyle = cols[(r * 7 + x) & 3];
        c.fillRect(x + off + 1.5, r * 16 + 1.5, 29, 13);
        c.fillStyle = 'rgba(255,230,200,.18)';
        c.fillRect(x + off + 1.5, r * 16 + 1.5, 29, 3);
      }
    }
    c.strokeStyle = 'rgba(60,20,10,.25)';
    c.lineWidth = 1;
  });
}

function plankTex() {
  return canvasTex(128, 256, (c) => {
    c.fillStyle = '#8A5A34';
    c.fillRect(0, 0, 128, 256);
    for (let x = 0; x < 128; x += 32) {
      c.fillStyle = x % 64 ? '#93613A' : '#7F512E';
      c.fillRect(x + 1, 0, 30, 256);
      c.fillStyle = '#4A2E18';
      c.fillRect(x, 0, 2, 256);
    }
  });
}

function awningTex() {
  return canvasTex(256, 64, (c) => {
    for (let x = 0; x < 256; x += 32) {
      c.fillStyle = (x / 32) % 2 ? '#F7EEDC' : '#D2563F';
      c.fillRect(x, 0, 32, 64);
    }
  });
}

function textTex(text: string, w: number, h: number, opt: { bg?: string; fg?: string; font?: string; border?: string } = {}) {
  const tex = canvasTex(w, h, () => {});
  const redraw = (t: string) => {
    const cv = tex.image as HTMLCanvasElement;
    const c = cv.getContext('2d')!;
    c.clearRect(0, 0, w, h);
    if (opt.bg) {
      c.fillStyle = opt.bg;
      c.fillRect(0, 0, w, h);
    }
    if (opt.border) {
      c.strokeStyle = opt.border;
      c.lineWidth = h * 0.08;
      c.strokeRect(0, 0, w, h);
    }
    c.fillStyle = opt.fg ?? '#3A2A1E';
    c.font = opt.font ?? `700 ${Math.round(h * 0.46)}px Fraunces, Georgia, serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(t, w / 2, h / 2 + h * 0.03);
    tex.needsUpdate = true;
  };
  redraw(text);
  document.fonts?.ready.then(() => redraw(text));
  return { tex, redraw };
}

// ---------------------------------------------------------------- Trees
function treeGeometries() {
  const trunkParts = [
    new THREE.CylinderGeometry(0.15, 0.24, 1.7, 8).translate(0, 0.85, 0),
    new THREE.CylinderGeometry(0.06, 0.1, 0.9, 6).rotateZ(0.75).translate(-0.3, 1.5, 0),
    new THREE.CylinderGeometry(0.06, 0.1, 0.8, 6).rotateZ(-0.65).translate(0.28, 1.6, 0.05),
  ];
  const blobs: [number, number, number, number][] = [
    [0, 2.4, 0, 1.02],
    [-0.68, 2.05, 0.25, 0.74],
    [0.7, 2.1, -0.1, 0.76],
    [0.12, 2.92, 0.15, 0.68],
    [0, 2.1, -0.62, 0.72],
    [0.22, 2.0, 0.64, 0.64],
  ];
  const canopy = mergeGeometries(blobs.map(([x, y, z, r]) => new THREE.SphereGeometry(r, 12, 8).translate(x, y, z)));
  const fruitAt: [number, number, number][] = [];
  const dirs: [number, number, number][] = [
    [0.6, -0.3, 0.75],
    [-0.7, 0.1, 0.7],
    [0.2, 0.5, 0.85],
    [-0.3, -0.5, 0.8],
    [0.85, 0.2, 0.4],
    [-0.85, -0.1, 0.4],
    [0.1, -0.2, 1],
  ];
  dirs.forEach((dv, i) => {
    const [bx, by, bz, br] = blobs[i % blobs.length];
    const n = v3(...dv).normalize();
    fruitAt.push([bx + n.x * br * 0.96, by + n.y * br * 0.96, bz + n.z * br * 0.96]);
  });
  // Peaches and eggplants hang alternately on every tree.
  const peaches = fruitAt.filter((_, i) => i % 2 === 0);
  const eggs = fruitAt.filter((_, i) => i % 2 === 1);
  const peach = mergeGeometries(peaches.map(([x, y, z]) => new THREE.SphereGeometry(0.15, 10, 8).scale(1, 0.95, 1).translate(x, y - 0.04, z)));
  const egg = mergeGeometries(eggs.map(([x, y, z]) => new THREE.SphereGeometry(0.1, 10, 8).scale(1, 2.1, 1).translate(x, y - 0.2, z)));
  const cap = mergeGeometries(eggs.map(([x, y, z]) => new THREE.ConeGeometry(0.085, 0.1, 7).rotateX(Math.PI).translate(x, y - 0.02, z)));
  const k = TREE_SCALE;
  return {
    trunk: mergeGeometries(trunkParts).scale(k, k, k),
    canopy: canopy.scale(k, k, k),
    peach: peach.scale(k, k, k),
    egg: egg.scale(k, k, k),
    cap: cap.scale(k, k, k),
  };
}

type TreeMats = { trunk: THREE.Material; trunkInk: THREE.Material; canopy: THREE.Material; canopyInk: THREE.Material; peach: THREE.Material; egg: THREE.Material; cap: THREE.Material };
function treeMats(): TreeMats {
  return {
    trunk: toon(0x6e4a2f),
    trunkInk: inkMat(0x2a1a12, 0.035),
    canopy: shade(toon(0x5fae5a), { wind: 0.04, base: 1.6 }),
    canopyInk: inkMat(0x1c3a22, 0.055, 0.04, 1.6),
    peach: shade(toon(0xffa47c, { emissive: 0x3a1408 }), { wind: 0.04, base: 1.6 }),
    egg: shade(toon(0x6a34a0, { emissive: 0x14061f }), { wind: 0.04, base: 1.6 }),
    cap: shade(toon(0x4c8f3e), { wind: 0.04, base: 1.6 }),
  };
}

class TreeSet {
  group = new THREE.Group();
  meshes: THREE.InstancedMesh[];
  canopy: THREE.InstancedMesh;
  base: THREE.Matrix4[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  constructor(geo: ReturnType<typeof treeGeometries>, mats: TreeMats, public count: number) {
    const mk = (g: THREE.BufferGeometry, mt: THREE.Material, shadow: boolean) => {
      const im = new THREE.InstancedMesh(g, mt, count);
      im.castShadow = shadow;
      im.receiveShadow = shadow;
      im.frustumCulled = false;
      this.group.add(im);
      return im;
    };
    const trunk = mk(geo.trunk, mats.trunk, true);
    const trunkInk = mk(geo.trunk, mats.trunkInk, false);
    this.canopy = mk(geo.canopy, mats.canopy, true);
    const canopyInk = mk(geo.canopy, mats.canopyInk, false);
    const peach = mk(geo.peach, mats.peach, false);
    const egg = mk(geo.egg, mats.egg, false);
    const cap = mk(geo.cap, mats.cap, false);
    this.meshes = [trunk, trunkInk, this.canopy, canopyInk, peach, egg, cap];
    for (let i = 0; i < count; i++) this.base.push(new THREE.Matrix4());
  }
  set(i: number, x: number, y: number, z: number, s: number, opt: { sy?: number; ry?: number; rx?: number; rz?: number; store?: boolean } = {}) {
    this.e.set(opt.rx ?? 0, opt.ry ?? 0, opt.rz ?? 0);
    this.q.setFromEuler(this.e);
    this.m.compose(v3(x, y, z), this.q, v3(s, opt.sy ?? s, s));
    if (opt.store) this.base[i].copy(this.m);
    for (const im of this.meshes) im.setMatrixAt(i, this.m);
  }
  setMatrix(i: number, m: THREE.Matrix4) {
    for (const im of this.meshes) im.setMatrixAt(i, m);
  }
  commit() {
    for (const im of this.meshes) im.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- Sparkles
const SPARK_VERT = `
attribute float aSize; attribute float aAlpha; attribute float aShape; attribute vec3 aColor;
varying float vAlpha; varying float vShape; varying vec3 vColor;
uniform float uPR;
void main() {
  vAlpha = aAlpha; vShape = aShape; vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPR * (260.0 / max(0.1, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;
const SPARK_FRAG = `
varying float vAlpha; varying float vShape; varying vec3 vColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = length(p);
  float a;
  if (vShape < 0.5) {
    float cross = max(0.0, 1.0 - abs(p.x) * 7.0) * max(0.0, 1.0 - abs(p.y) * 1.1) + max(0.0, 1.0 - abs(p.y) * 7.0) * max(0.0, 1.0 - abs(p.x) * 1.1);
    a = clamp(cross + smoothstep(0.45, 0.0, r), 0.0, 1.0);
  } else if (vShape < 1.5) {
    a = smoothstep(1.0, 0.15, r);
  } else {
    vec2 q = vec2(p.x * 1.7, p.y);
    a = smoothstep(1.0, 0.75, length(q));
  }
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a * vAlpha);
}`;

type Emit = {
  n: number;
  color: THREE.ColorRepresentation | THREE.ColorRepresentation[];
  speed?: number;
  up?: number;
  spread?: number;
  life?: number;
  size?: number;
  gravity?: number;
  drag?: number;
  shape?: 0 | 1 | 2;
  vel?: V3;
  radius?: number;
  additive?: boolean;
};

class Sparkles {
  max = 1400;
  pos = new Float32Array(this.max * 3);
  vel = new Float32Array(this.max * 3);
  col = new Float32Array(this.max * 3);
  size = new Float32Array(this.max);
  alpha = new Float32Array(this.max);
  shape = new Float32Array(this.max);
  life = new Float32Array(this.max);
  maxLife = new Float32Array(this.max);
  grav = new Float32Array(this.max);
  drag = new Float32Array(this.max);
  baseSize = new Float32Array(this.max);
  next = 0;
  geo = new THREE.BufferGeometry();
  points: THREE.Points;
  constructor(scene: THREE.Scene, pr: number, additive: boolean) {
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo.setAttribute('aShape', new THREE.BufferAttribute(this.shape, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: SPARK_VERT,
      fragmentShader: SPARK_FRAG,
      uniforms: { uPR: { value: pr } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
  }
  emit(at: V3, o: Emit) {
    if (reduced) o = { ...o, n: Math.ceil(o.n / 4) };
    const cols = (Array.isArray(o.color) ? o.color : [o.color]).map((c) => new THREE.Color(c));
    for (let k = 0; k < o.n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = (o.speed ?? 2) * (0.35 + Math.random() * 0.8);
      const sx = Math.sin(ph) * Math.cos(th);
      const sy = Math.abs(Math.cos(ph));
      const sz = Math.sin(ph) * Math.sin(th);
      const spread = o.spread ?? 1;
      const rr = o.radius ?? 0;
      this.pos[i * 3] = at.x + (Math.random() - 0.5) * rr * 2;
      this.pos[i * 3 + 1] = at.y + (Math.random() - 0.5) * rr;
      this.pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * rr * 2;
      this.vel[i * 3] = (o.vel?.x ?? 0) + sx * sp * spread;
      this.vel[i * 3 + 1] = (o.vel?.y ?? 0) + (sy * sp + (o.up ?? 0)) * (spread < 1 ? 1 : 1);
      this.vel[i * 3 + 2] = (o.vel?.z ?? 0) + sz * sp * spread;
      const c = cols[k % cols.length];
      this.col.set([c.r, c.g, c.b], i * 3);
      this.baseSize[i] = (o.size ?? 0.25) * (0.5 + Math.random() * 0.9);
      this.shape[i] = o.shape ?? 0;
      this.maxLife[i] = this.life[i] = (o.life ?? 1.2) * (0.6 + Math.random() * 0.7);
      this.grav[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 1.4;
    }
  }
  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        if (this.alpha[i] !== 0) {
          this.alpha[i] = 0;
          this.size[i] = 0;
        }
        continue;
      }
      this.life[i] -= dt;
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      this.alpha[i] = Math.min(1, t * 2.2) * (0.75 + 0.25 * Math.sin((1 - t) * 40 + i));
      this.size[i] = this.baseSize[i] * (0.4 + 0.6 * t);
    }
    for (const n of ['position', 'aSize', 'aAlpha', 'aColor', 'aShape']) (this.geo.getAttribute(n) as THREE.BufferAttribute).needsUpdate = true;
  }
}

// ---------------------------------------------------------------- Light pillar + shockwave
function pillarMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0xfff1c4) }, uTime },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uOpacity; uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
      void main(){
        float fade = pow(1.0 - vUv.y, 1.6);
        float edge = 0.55 + 0.45 * sin(vUv.x * 6.2831 * 3.0 + uTime * 4.0);
        float ground = smoothstep(0.0, 0.04, vUv.y);
        gl_FragColor = vec4(uColor, uOpacity * fade * edge * ground);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

// ---------------------------------------------------------------- World
export function createWorld3d(host: HTMLElement, stage: HTMLElement, panel: HTMLElement, fx: (cue: Cue) => void = () => {}) {
  const mobile = matchMedia('(max-width: 820px)').matches || (navigator.hardwareConcurrency ?? 8) <= 4;
  let pr = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.className = 'gl';
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const HORIZON = new THREE.Color(0xf6dcbc);
  scene.fog = new THREE.Fog(HORIZON, 34, 150);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 600);

  // ---------- Sky ----------
  const skyU = {
    top: { value: new THREE.Color(0x5aa7e8) },
    mid: { value: new THREE.Color(0xa9d3f2) },
    horizon: { value: HORIZON.clone() },
    sunDir: { value: v3(0.35, 0.18, -0.92).normalize() },
    sunCol: { value: new THREE.Color(0xfff0c8) },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(420, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: skyU,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 c = mix(horizon, mid, smoothstep(0.0, 0.18, h));
          c = mix(c, top, smoothstep(0.18, 0.65, h));
          float s = max(dot(normalize(vDir), sunDir), 0.0);
          c += sunCol * (pow(s, 600.0) * 1.4 + pow(s, 18.0) * 0.35);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  scene.add(sky);

  // Anime cumulus: clusters of soft toon spheres.
  const clouds: THREE.Group[] = [];
  const cloudMat = toon(0xffffff, { emissive: 0xbfd4ea, emissiveIntensity: 0.35, fog: false });
  for (let i = 0; i < 15; i++) {
    const g = new THREE.Group();
    const n = 5 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const r = 6 + Math.random() * 7;
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), cloudMat);
      s.position.set((k - n / 2) * 7 + Math.random() * 4, Math.random() * 5 - (Math.abs(k - n / 2) > 2 ? 3 : 0), Math.random() * 6);
      s.scale.y = 0.75;
      g.add(s);
    }
    // A low band along the horizon, and a few big ones drifting higher up.
    const high = i >= 9;
    g.position.set(-260 + (i % 9) * 65 + Math.random() * 30, high ? 120 + Math.random() * 70 : 48 + Math.random() * 40, high ? -200 - Math.random() * 60 : -230 - Math.random() * 90);
    if (high) g.scale.setScalar(1.4);
    scene.add(g);
    clouds.push(g);
  }

  // ---------- Light ----------
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6d8a4a, 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.6);
  sun.position.set(14, 22, 16);
  sun.target.position.set(0, 0, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 90 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ---------- Ground ----------
  const ground = mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), toon(0x8cc865));
  ground.castShadow = false;
  scene.add(ground);
  const pathMat = toon(0xe8d2a2);
  const pathOut = mesh(new THREE.PlaneGeometry(2.6, 30).rotateX(-Math.PI / 2), pathMat, [0, 0.012, 15]);
  const pathIn = mesh(new THREE.PlaneGeometry(2.4, 40).rotateX(-Math.PI / 2), pathMat, [0, 0.012, -20]);
  pathOut.castShadow = pathIn.castShadow = false;
  scene.add(pathOut, pathIn);

  // Grass tufts and flowers, swaying.
  const tuftGeo = mergeGeometries([
    new THREE.ConeGeometry(0.05, 0.42, 4).translate(0, 0.21, 0),
    new THREE.ConeGeometry(0.045, 0.34, 4).rotateZ(0.35).translate(0.06, 0.16, 0),
    new THREE.ConeGeometry(0.045, 0.36, 4).rotateZ(-0.35).translate(-0.06, 0.17, 0.02),
  ]);
  const tuftCount = mobile ? 450 : 1000;
  const tufts = new THREE.InstancedMesh(tuftGeo, shade(toon(0x6fb24f), { wind: 0.5, base: 0 }), tuftCount);
  tufts.frustumCulled = false;
  const tmp = new THREE.Object3D();
  for (let i = 0; i < tuftCount; i++) {
    let x = 0;
    let z = 0;
    do {
      x = (Math.random() - 0.5) * 70;
      z = Math.random() < 0.55 ? 1 + Math.random() * 30 : -1.2 - Math.random() * 42;
    } while (Math.abs(x) < 1.6);
    tmp.position.set(x, 0, z);
    tmp.rotation.y = Math.random() * Math.PI;
    tmp.scale.setScalar(0.7 + Math.random() * 0.8);
    tmp.updateMatrix();
    tufts.setMatrixAt(i, tmp.matrix);
  }
  scene.add(tufts);
  const flowerCount = mobile ? 160 : 260;
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 5).translate(0, 0.28, 0), shade(toon(0xffffff), { wind: 0.4, base: 0 }), flowerCount);
  flowers.frustumCulled = false;
  const fcols = [0xffffff, 0xffd3e2, 0xfff1a8, 0xd9c8ff].map((c) => new THREE.Color(c));
  for (let i = 0; i < flowerCount; i++) {
    let x = 0;
    do x = (Math.random() - 0.5) * 60;
    while (Math.abs(x) < 1.8);
    tmp.position.set(x, 0, Math.random() < 0.6 ? 1 + Math.random() * 24 : -2 - Math.random() * 36);
    tmp.scale.setScalar(0.8 + Math.random() * 0.6);
    tmp.updateMatrix();
    flowers.setMatrixAt(i, tmp.matrix);
    flowers.setColorAt(i, fcols[i % fcols.length]);
  }
  scene.add(flowers);

  // ---------- Wall + gate ----------
  const wall = new THREE.Group();
  scene.add(wall);
  const WALL_H = 3.3;
  const brick = brickTex();
  brick.wrapS = brick.wrapT = THREE.RepeatWrapping;
  const seg = (x0: number, x1: number) => {
    const len = x1 - x0;
    const t = brick.clone();
    t.needsUpdate = true;
    t.repeat.set(len / 2.2, WALL_H / 1.1);
    const m = mesh(new THREE.BoxGeometry(len, WALL_H, 0.7), toon(0xffffff, { map: t }), [(x0 + x1) / 2, WALL_H / 2, 0], wall);
    ink(m, 0.025, 0x3a1810);
    const cope = mesh(new THREE.BoxGeometry(len + 0.1, 0.2, 0.92), toon(0xc8664a), [(x0 + x1) / 2, WALL_H + 0.1, 0], wall);
    ink(cope, 0.02, 0x3a1810);
  };
  seg(-48, -1.95);
  seg(1.95, 48);
  // Lintel over the gate
  const brickRep = (rx: number, ry: number) => {
    const t = brick.clone();
    t.needsUpdate = true;
    t.repeat.set(rx, ry);
    return t;
  };
  const lintelTex = brickRep(1.8, 0.55);
  const pillarTex = brickRep(0.45, 3.7);
  mesh(new THREE.BoxGeometry(3.9, 0.6, 0.7), toon(0xffffff, { map: lintelTex }), [0, WALL_H - 0.3, 0], wall);
  mesh(new THREE.BoxGeometry(4.0, 0.2, 0.92), toon(0xc8664a), [0, WALL_H + 0.1, 0], wall);
  for (const sx of [-1, 1]) {
    const p = mesh(new THREE.BoxGeometry(0.9, 4.1, 1.0), toon(0xffffff, { map: pillarTex }), [sx * 1.5, 2.05, 0], wall);
    ink(p, 0.025, 0x3a1810);
    const cap = mesh(new THREE.BoxGeometry(1.15, 0.22, 1.25), toon(0xc8664a), [sx * 1.5, 4.2, 0], wall);
    ink(cap, 0.02, 0x3a1810);
    const ball = mesh(new THREE.SphereGeometry(0.3, 16, 12), toon(0xd27a5a), [sx * 1.5, 4.55, 0], wall);
    ink(ball, 0.025, 0x3a1810);
  }

  // Doors hinge at the pillars.
  const plank = plankTex();
  const doorMat = toon(0xffffff, { map: plank });
  const ironMat = toon(0x2e2a28);
  const makeDoor = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 1.05, 0, 0.12);
    const door = mesh(new THREE.BoxGeometry(1.05, 2.75, 0.12), doorMat, [-side * 0.525, 1.375, 0], pivot);
    ink(door, 0.02, 0x2a160b);
    for (const y of [0.6, 2.1]) mesh(new THREE.BoxGeometry(1.05, 0.09, 0.15), ironMat, [-side * 0.525, y, 0.01], pivot);
    // Iron hasp at the meeting edge; the padlock hangs through its staple.
    const plate = mesh(new THREE.BoxGeometry(0.2, 0.5, 0.035), ironMat, [-side * 0.93, 1.42, 0.08], pivot);
    ink(plate, 0.012, 0x0c0a09);
    for (const ry of [1.24, 1.6]) mesh(new THREE.SphereGeometry(0.022, 8, 6), toon(0x8c8a88), [-side * 0.93, ry, 0.1], pivot);
    if (side === 1) {
      const staple = mesh(new THREE.TorusGeometry(0.06, 0.016, 8, 16, Math.PI), ironMat, [-0.93, 1.43, 0.11], pivot);
      staple.rotation.y = Math.PI / 2;
    }
    wall.add(pivot);
    return pivot;
  };
  const doorL = makeDoor(-1);
  const doorR = makeDoor(1);

  // Padlock and key: polished metal with real reflections, ink-outlined like the rest.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const brassPBR = new THREE.MeshStandardMaterial({ color: 0xd4a03c, metalness: 1, roughness: 0.28, envMap: env, envMapIntensity: 1.3 });
  const brassDark = new THREE.MeshStandardMaterial({ color: 0x9c6e22, metalness: 1, roughness: 0.42, envMap: env });
  const steelPBR = new THREE.MeshStandardMaterial({ color: 0xdfe6ec, metalness: 1, roughness: 0.16, envMap: env, envMapIntensity: 1.4 });
  const voidMat = new THREE.MeshBasicMaterial({ color: 0x0a0806 });
  const roundRect = (w: number, h: number, r: number) => {
    const sh = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    sh.moveTo(x + r, y);
    sh.lineTo(x + w - r, y);
    sh.quadraticCurveTo(x + w, y, x + w, y + r);
    sh.lineTo(x + w, y + h - r);
    sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    sh.lineTo(x + r, y + h);
    sh.quadraticCurveTo(x, y + h, x, y + h - r);
    sh.lineTo(x, y + r);
    sh.quadraticCurveTo(x, y, x + r, y);
    return sh;
  };
  const LOCK_AT = v3(0, 1.18, 0.36);
  const lock = new THREE.Group();
  lock.position.copy(LOCK_AT);
  const bodyGeo = new THREE.ExtrudeGeometry(roundRect(0.46, 0.4, 0.1), { depth: 0.13, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 5, curveSegments: 18 }).center();
  const lockBody = mesh(bodyGeo, brassPBR, [0, 0, 0], lock);
  ink(lockBody, 0.01, 0x2a1a08);
  const faceGeo = new THREE.ExtrudeGeometry(roundRect(0.34, 0.28, 0.06), { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3 }).center();
  mesh(faceGeo, brassDark, [0, -0.01, 0.1], lock);
  const holeShape = new THREE.Shape();
  holeShape.absarc(0, 0.025, 0.034, 0, Math.PI * 2, false);
  const slotShape = new THREE.Shape();
  slotShape.moveTo(-0.018, 0.01);
  slotShape.lineTo(0.018, 0.01);
  slotShape.lineTo(0.03, -0.075);
  slotShape.lineTo(-0.03, -0.075);
  slotShape.closePath();
  const keyhole = new THREE.Mesh(new THREE.ShapeGeometry([holeShape, slotShape]), voidMat);
  keyhole.position.set(0, -0.01, 0.112);
  lock.add(keyhole);
  mesh(new THREE.TorusGeometry(0.052, 0.012, 10, 28), steelPBR, [0, 0.015, 0.11], lock);
  for (const [rx, ry] of [[-0.15, 0.11], [0.15, 0.11], [-0.15, -0.13], [0.15, -0.13]]) mesh(new THREE.SphereGeometry(0.02, 12, 10), steelPBR, [rx, ry, 0.1], lock);
  // Chrome U-shackle: legs into the body, a round arch above.
  const shackle = new THREE.Group();
  const arch: THREE.Vector3[] = [v3(-0.13, 0.05, 0), v3(-0.13, 0.22, 0)];
  for (let a = 0; a <= 16; a++) {
    const t = Math.PI - (a / 16) * Math.PI;
    arch.push(v3(Math.cos(t) * 0.13, 0.22 + Math.sin(t) * 0.13, 0));
  }
  arch.push(v3(0.13, 0.22, 0), v3(0.13, 0.12, 0));
  const shackleM = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arch, false, 'catmullrom', 0.1), 64, 0.034, 14, false), steelPBR, [0, 0, 0], shackle);
  ink(shackleM, 0.008, 0x1d2228);
  lock.add(shackle);
  wall.add(lock);

  // Key: brass with an ornate trefoil bow.
  const key = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.26, 12).rotateX(Math.PI / 2), brassPBR, [0, 0, -0.02], key);
  mesh(new THREE.BoxGeometry(0.018, 0.07, 0.03), brassPBR, [0, -0.045, -0.12], key);
  mesh(new THREE.BoxGeometry(0.018, 0.04, 0.025), brassPBR, [0, -0.03, -0.075], key);
  const bow = new THREE.Group();
  bow.position.z = 0.15;
  mesh(new THREE.TorusGeometry(0.05, 0.016, 10, 24), brassPBR, [0, 0.05, 0], bow);
  for (const a of [Math.PI / 2, Math.PI * (7 / 6), Math.PI * (11 / 6)]) mesh(new THREE.TorusGeometry(0.034, 0.012, 8, 18), brassPBR, [Math.cos(a) * 0.06, 0.05 + Math.sin(a) * 0.06, 0], bow);
  mesh(new THREE.SphereGeometry(0.022, 12, 10), brassPBR, [0, 0.05, 0], bow);
  key.add(bow);
  key.visible = false;
  wall.add(key);

  // ---------- Trees ----------
  const geo = treeGeometries();
  const orchard = new TreeSet(geo, treeMats(), ROWS * COLS);
  scene.add(orchard.group);
  const userRow = 3;
  const userCol = 6 + Math.floor(Math.random() * 2) - (Math.random() < 0.5 ? 2 : 0);
  const userIdx = userRow * COLS + userCol;
  const slots: { x: number; z: number }[] = [];
  const treeRy: number[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const x = colX(c) + (Math.random() - 0.5) * 0.3;
      const z = rowZ(r) + (Math.random() - 0.5) * 0.3;
      slots.push({ x, z });
      treeRy[i] = Math.random() * 6.28;
      orchard.set(i, x, 0, z, i === userIdx ? 0 : 1, { store: true, ry: treeRy[i] });
    }
  orchard.commit();
  const slot = slots[userIdx];
  const pools = new THREE.InstancedMesh(new THREE.CircleGeometry(1.45, 24).rotateX(-Math.PI / 2), toon(0x6aa84f), slots.length);
  slots.forEach((p, i) => {
    tmp.position.set(p.x, 0.02, p.z);
    tmp.rotation.set(0, 0, 0);
    tmp.scale.setScalar(1);
    tmp.updateMatrix();
    pools.setMatrixAt(i, tmp.matrix);
  });
  pools.receiveShadow = true;
  scene.add(pools);

  // The player's tree has its own materials so it can glow.
  const heroMats = treeMats();
  const glowables = [heroMats.trunk, heroMats.canopy, heroMats.peach, heroMats.egg, heroMats.cap] as THREE.MeshToonMaterial[];
  glowables.forEach((m) => (m.emissive = new THREE.Color(0xfff2c0)));
  const hero = new TreeSet(geo, heroMats, 1);
  scene.add(hero.group);
  const H = { x: FIELD.x, y: 0, z: FIELD.z, s: 0, sy: 1, ry: 0.4, shake: 0, glow: 0 };
  const applyHero = () => {
    const j = H.shake;
    hero.set(0, H.x + (Math.random() - 0.5) * 0.12 * j, H.y, H.z + (Math.random() - 0.5) * 0.12 * j, H.s, {
      sy: H.s * H.sy,
      ry: H.ry,
      rz: (Math.random() - 0.5) * 0.08 * j,
    });
    hero.commit();
    glowables.forEach((m) => (m.emissiveIntensity = H.glow * 1.4));
  };

  // ---------- Signs, stall, characters ----------
  const sign = new THREE.Group();
  sign.position.set(FIELD.x + 1.7, 0, FIELD.z + 0.6);
  sign.rotation.y = -0.35;
  mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.1, 8), toon(0x6b4423), [0, 0.55, 0], sign);
  const signText = textTex('0.50 ZEC', 256, 112, { bg: '#E7C48A', border: '#6B4423' });
  const board = mesh(new THREE.BoxGeometry(1.1, 0.48, 0.07), [toon(0x8a5a34), toon(0x8a5a34), toon(0x8a5a34), toon(0x8a5a34), new THREE.MeshBasicMaterial({ map: signText.tex }), toon(0x8a5a34)], [0, 1.15, 0], sign);
  ink(board, 0.02, 0x2a160b);
  sign.scale.setScalar(0);
  scene.add(sign);

  const stall = new THREE.Group();
  stall.position.copy(STALL);
  stall.rotation.y = -0.45;
  const wood = toon(0x8a5a34);
  const counter = mesh(new THREE.BoxGeometry(2.2, 1, 0.9), wood, [0, 0.5, 0], stall);
  ink(counter, 0.02, 0x2a160b);
  for (const [px, pz] of [[-1, -0.35], [1, -0.35], [-1, 0.35], [1, 0.35]]) mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), wood, [px, 1.2, pz], stall);
  const awn = mesh(new THREE.BoxGeometry(2.5, 0.08, 1.3), [wood, wood, toon(0xffffff, { map: awningTex() }), wood, wood, wood], [0, 2.45, 0.1], stall);
  awn.rotation.x = 0.18;
  ink(awn, 0.02, 0x3a1810);
  const exText = textTex('EXCHANGE', 512, 96, { fg: '#F7EEDC', font: '600 52px Inter, system-ui, sans-serif' });
  const exPlate = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.36), new THREE.MeshBasicMaterial({ map: exText.tex, transparent: true }));
  exPlate.position.set(0, 0.62, 0.46);
  stall.add(exPlate);
  const stallSign = new THREE.Group();
  stallSign.position.set(1.6, 0, 0.3);
  mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.2, 8), wood, [0, 0.6, 0], stallSign);
  const stallText = textTex('0.20 ZEC', 256, 112, { bg: '#E7C48A', border: '#6B4423' });
  const stallBoard = mesh(new THREE.BoxGeometry(1, 0.44, 0.06), [wood, wood, wood, wood, new THREE.MeshBasicMaterial({ map: stallText.tex }), wood], [0, 1.25, 0], stallSign);
  ink(stallBoard, 0.02, 0x2a160b);
  stallSign.scale.setScalar(0);
  stall.add(stallSign);
  stall.scale.setScalar(0);
  scene.add(stall);

  // ---------- The exchange: scale, price board, the Watcher's searchlight ----------
  const scaleG = new THREE.Group();
  scaleG.position.copy(SCALE_AT);
  scaleG.rotation.y = -0.3;
  const metal = toon(0x9aa6b2);
  const brass = toon(0xe0aa45, { emissive: 0x2a1600 });
  mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.16, 24), metal, [0, 0.08, 0], scaleG);
  const post = mesh(new THREE.CylinderGeometry(0.11, 0.14, 1.15, 12), metal, [0, 0.7, 0], scaleG);
  ink(post, 0.02, 0x1d2228);
  const dish = new THREE.Group();
  dish.position.y = 1.28;
  const dishM = mesh(new THREE.CylinderGeometry(0.85, 0.62, 0.12, 28), brass, [0, 0, 0], dish);
  ink(dishM, 0.025, 0x3a2408);
  scaleG.add(dish);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.3, 28), toon(0xfff4dc));
  dial.position.set(0, 0.7, 0.16);
  scaleG.add(dial);
  const needle = new THREE.Group();
  needle.position.set(0, 0.7, 0.17);
  const nm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.24, 0.01).translate(0, 0.1, 0), new THREE.MeshBasicMaterial({ color: 0xc8473b }));
  needle.add(nm);
  scaleG.add(needle);
  scaleG.scale.setScalar(0);
  scene.add(scaleG);

  // Split-flap price board, high above the field so everyone can read it.
  const boardCanvas = (amount: string, sub: string) =>
    canvasTex(512, 220, (c) => {
      c.fillStyle = '#1C2328';
      c.fillRect(0, 0, 512, 220);
      c.fillStyle = '#2A343B';
      c.fillRect(0, 108, 512, 4);
      c.fillStyle = '#FFE6A8';
      c.font = '800 96px Inter, system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(amount, 256, 82);
      c.fillStyle = '#6FD3E8';
      c.font = '700 30px "JetBrains Mono", ui-monospace, monospace';
      c.fillText(sub, 256, 172);
    });
  const priceBoard = new THREE.Group();
  priceBoard.position.copy(BOARD_AT);
  priceBoard.rotation.y = -0.3;
  for (const sx of [-1.75, 1.75]) mesh(new THREE.CylinderGeometry(0.09, 0.11, 4.8, 10), metal, [sx, 2.4, 0], priceBoard);
  const frameM = mesh(new THREE.BoxGeometry(3.9, 1.85, 0.2), toon(0x2e3a42), [0, 4.55, 0], priceBoard);
  ink(frameM, 0.03, 0x0a0e10);
  const flap = new THREE.Group();
  flap.position.set(0, 4.55, 0.12);
  const flapMat = new THREE.MeshBasicMaterial({ map: boardCanvas('-- ZEC', 'WAITING') });
  const flapFace = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.55), flapMat);
  flap.add(flapFace);
  priceBoard.add(flap);
  priceBoard.scale.setScalar(0);
  scene.add(priceBoard);
  const setBoard = (amount: string, sub: string) => {
    flapMat.map?.dispose();
    flapMat.map = boardCanvas(amount, sub);
    flapMat.needsUpdate = true;
  };

  // The Watcher's tower: a lamp with an eye, sweeping the open field.
  const tower = new THREE.Group();
  tower.position.copy(TOWER);
  const dark = toon(0x2a3138);
  for (const [lx, lz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
    const leg = mesh(new THREE.CylinderGeometry(0.07, 0.09, 6.2, 8), dark, [lx * 0.7, 3.1, lz * 0.7], tower);
    leg.rotation.set(lz * -0.08, 0, lx * 0.08);
  }
  const deck = mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.18, 16), dark, [0, 6.2, 0], tower);
  ink(deck, 0.03, 0x0a0e10);
  const lamp = new THREE.Group();
  lamp.position.set(0, 6.85, 0);
  const housing = mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.9, 20).rotateX(Math.PI / 2), dark, [0, 0, 0], lamp);
  ink(housing, 0.03, 0x0a0e10);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: 0xe9fbff }));
  lens.position.z = 0.46;
  lamp.add(lens);
  const iris = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), new THREE.MeshBasicMaterial({ color: 0x2bb7d6 }));
  iris.position.z = 0.47;
  lamp.add(iris);
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), new THREE.MeshBasicMaterial({ color: 0x0b1418 }));
  pupil.position.z = 0.48;
  lamp.add(pupil);
  tower.add(lamp);
  tower.scale.setScalar(0);
  scene.add(tower);

  const beamGeo = new THREE.ConeGeometry(1.5, 1, 32, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x6fd3e8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam3 = new THREE.Mesh(beamGeo, beamMat);
  scene.add(beam3);
  const spotDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1.55, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x9fe8f7, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  scene.add(spotDisc);
  const lampWorld = v3();
  const aimAt = v3(0, 0, 10);
  const aim = (t: V3) => {
    aimAt.copy(t);
    lamp.getWorldPosition(lampWorld);
    beam3.position.copy(lampWorld);
    beam3.lookAt(t);
    beam3.scale.set(1, 1, lampWorld.distanceTo(t));
    spotDisc.position.set(t.x, 0.04, t.z);
    tower.updateMatrixWorld();
    lamp.lookAt(t);
  };

  // Fruit prop used for passing and unshielding.
    const peachMat = toon(0xffa47c, { emissive: 0x3a1408 });
  const blushMat = toon(0xff7a6b);
  const eggMat = toon(0x6a34a0, { emissive: 0x14061f });
  const capMat = toon(0x4c8f3e);
  type FruitKind = 'peach' | 'egg';
  const makeFruit = (kind: FruitKind = 'peach') => {
    const g = new THREE.Group();
    if (kind === 'peach') {
      const b = mesh(new THREE.SphereGeometry(0.24, 22, 18), peachMat, [0, 0, 0], g);
      b.scale.set(1, 0.95, 1);
      ink(b, 0.025, 0x5a2410);
      const cheek = mesh(new THREE.SphereGeometry(0.17, 16, 12), blushMat, [0.09, 0.03, 0.12], g);
      cheek.scale.set(1, 1, 0.55);
      // The crease
      mesh(new THREE.TorusGeometry(0.235, 0.008, 6, 32, Math.PI).rotateY(Math.PI / 2), toon(0xd9705a), [0, 0, 0], g);
      mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.1, 6), toon(0x4a3220), [0, 0.26, 0], g);
      const leaf = mesh(new THREE.SphereGeometry(0.09, 8, 6), capMat, [0.1, 0.28, 0], g);
      leaf.scale.set(1.5, 0.3, 0.7);
    } else {
      const b = mesh(new THREE.CapsuleGeometry(0.15, 0.32, 8, 16), eggMat, [0, -0.06, 0], g);
      b.rotation.z = 0.35;
      ink(b, 0.025, 0x1c0a2a);
      const cap = mesh(new THREE.ConeGeometry(0.16, 0.14, 8).rotateX(Math.PI), capMat, [-0.09, 0.2, 0], g);
      cap.rotation.z = 0.35;
      ink(cap, 0.015, 0x123018);
      mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.12, 6), capMat, [-0.12, 0.3, 0], g).rotation.z = 0.35;
    }
    g.scale.setScalar(0);
    scene.add(g);
    return g;
  };

  // Stranger: hooded, faceless, glowing eyes.
  const stranger = new THREE.Group();
  stranger.position.copy(STRANGER);
  stranger.rotation.y = -0.4;
  const robeMat = toon(0x2e2540);
  const robe = mesh(
    new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.55, 0), new THREE.Vector2(0.46, 0.5), new THREE.Vector2(0.32, 1.15), new THREE.Vector2(0.25, 1.42), new THREE.Vector2(0, 1.5)], 20),
    robeMat,
    [0, 0, 0],
    stranger,
  );
  ink(robe, 0.03, 0x0e0a14);
  const hood = mesh(new THREE.SphereGeometry(0.34, 18, 14), robeMat, [0, 1.62, -0.05], stranger);
  ink(hood, 0.03, 0x0e0a14);
  mesh(new THREE.SphereGeometry(0.25, 16, 12), toon(0x0d0a12), [0, 1.6, 0.12], stranger);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd86b });
  const eyes = [-1, 1].map((sx) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat);
    e.position.set(sx * 0.08, 1.63, 0.34);
    e.scale.y = 0.6;
    stranger.add(e);
    return e;
  });
  stranger.scale.setScalar(0);
  scene.add(stranger);

  // Bramble: a round little orchard hedgehog with a green scarf and a satchel.
  const gardener = new THREE.Group();
  const GARDENER = v3();
  const G_SCALE = 1.7;
  const gardenShot: Shot = { pos: v3(), look: v3() };
  const placeGardener = () => {
    GARDENER.set(slot.x + GAP / 2, 0, slot.z + GAP / 2);
    gardener.position.copy(GARDENER);
    gardener.rotation.y = 0.25;
    gardenShot.pos.set(GARDENER.x + 1.2, 11.5, GARDENER.z + 5);
    gardenShot.look.set(GARDENER.x - 0.9, 0.8, GARDENER.z - 1.8);
  };
  const gBody = new THREE.Group();
  gardener.add(gBody);
  const fur = toon(0x8a5530);
  const cream = toon(0xf6dfbd);
  const body = mesh(new THREE.SphereGeometry(0.44, 26, 20), fur, [0, 0.52, 0], gBody);
  body.scale.set(1, 0.98, 0.96);
  ink(body, 0.025, 0x2a160b);
  const belly = mesh(new THREE.SphereGeometry(0.32, 22, 16), cream, [0, 0.47, 0.22], gBody);
  belly.scale.set(1, 1.08, 0.62);
  // Spines: one merged mesh of cones fanned over the back and crown.
  const spineGeos: THREE.BufferGeometry[] = [];
  const up = v3(0, 1, 0);
  for (let i = 0; i < 46; i++) {
    const a = (i * 2.399963) % (Math.PI * 2);
    const yv = 1 - (i / 45) * 1.7;
    const dir = v3(Math.cos(a) * Math.sqrt(Math.max(0, 1 - yv * yv)), yv, Math.sin(a) * Math.sqrt(Math.max(0, 1 - yv * yv)));
    if (dir.z > 0.35 || dir.y < -0.55) continue;
    const g = new THREE.ConeGeometry(0.075, 0.34, 6).translate(0, 0.17, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize()));
    g.translate(dir.x * 0.38, 0.52 + dir.y * 0.38, dir.z * 0.38);
    spineGeos.push(g);
  }
  const spines = mesh(mergeGeometries(spineGeos), toon(0x5a321b), [0, 0, 0], gBody);
  ink(spines, 0.018, 0x1e0f06);
  const muzzle = mesh(new THREE.SphereGeometry(0.15, 18, 14), cream, [0, 0.6, 0.38], gBody);
  muzzle.scale.set(1.1, 0.82, 1.15);
  mesh(new THREE.SphereGeometry(0.055, 12, 10), toon(0x1a1012), [0, 0.65, 0.55], gBody);
  for (const sx of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.07, 14, 12), toon(0x1f1418), [sx * 0.15, 0.79, 0.35], gBody);
    eye.scale.set(0.9, 1.4, 0.5);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hl.position.set(sx * 0.15 + 0.022, 0.83, 0.39);
    gBody.add(hl);
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), new THREE.MeshBasicMaterial({ color: 0xf59aa0, transparent: true, opacity: 0.75 }));
    blush.position.set(sx * 0.26, 0.64, 0.34);
    blush.rotation.y = sx * 0.55;
    gBody.add(blush);
    const ear = mesh(new THREE.SphereGeometry(0.085, 12, 10), fur, [sx * 0.25, 0.95, 0.12], gBody);
    ear.scale.set(1, 1.1, 0.6);
    mesh(new THREE.SphereGeometry(0.05, 10, 8), toon(0xf0a9a0), [sx * 0.25, 0.95, 0.16], gBody).scale.set(1, 1.1, 0.4);
    const foot = mesh(new THREE.SphereGeometry(0.09, 12, 10), toon(0x6b4128), [sx * 0.17, 0.07, 0.16], gBody);
    foot.scale.set(1, 0.6, 1.5);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 6, 12, Math.PI), new THREE.MeshBasicMaterial({ color: 0x4a2418 }));
  smile.position.set(0, 0.55, 0.5);
  smile.rotation.z = Math.PI;
  gBody.add(smile);
  const scarf = mesh(new THREE.TorusGeometry(0.3, 0.065, 10, 28).rotateX(Math.PI / 2), toon(0x3f9a5c), [0, 0.38, 0.02], gBody);
  scarf.scale.set(1, 1, 0.95);
  ink(scarf, 0.015, 0x123018);
  const hat = new THREE.Group(); // the scarf's loose tail, fluttering
  hat.position.set(0.2, 0.36, 0.25);
  const tail = mesh(new THREE.BoxGeometry(0.1, 0.24, 0.04).translate(0, -0.12, 0), toon(0x3f9a5c), [0, 0, 0], hat);
  ink(tail, 0.012, 0x123018);
  gBody.add(hat);
  const satchel = mesh(new THREE.BoxGeometry(0.22, 0.18, 0.1), toon(0xb07a42), [-0.42, 0.36, 0.12], gBody);
  satchel.rotation.y = -0.5;
  ink(satchel, 0.015, 0x3a2410);
  const armL = new THREE.Group();
  armL.position.set(-0.36, 0.5, 0.18);
  mesh(new THREE.SphereGeometry(0.075, 12, 10), fur, [0, -0.05, 0.03], armL);
  gBody.add(armL);
  const armR = new THREE.Group();
  armR.position.set(0.36, 0.5, 0.18);
  mesh(new THREE.SphereGeometry(0.075, 12, 10), fur, [0, -0.08, 0.04], armR);
  gBody.add(armR);
  gardener.scale.setScalar(0);
  scene.add(gardener);
  placeGardener();
  const basketWorld = () => gBody.localToWorld(v3(0, 0.62, 0.62));

  // ---------- FX ----------
  const sparks = new Sparkles(scene, pr, true);
  const dust = new Sparkles(scene, pr, false);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 34, 32, 1, true).translate(0, 17, 0), pillarMaterial());
  pillar.visible = false;
  scene.add(pillar);
  const pillarU = (pillar.material as THREE.ShaderMaterial).uniforms.uOpacity;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  ring.position.y = 0.05;
  scene.add(ring);

  const overlay = (cls: string) => {
    const el = document.createElement('div');
    el.className = cls;
    host.append(el);
    return el;
  };
  const flashEl = overlay('fx-flash');
  const speedEl = overlay('fx-speed');

  function flash(strength = 1) {
    if (reduced) return;
    gsap.fromTo(flashEl, { opacity: 0.9 * strength }, { opacity: 0, duration: 0.7, ease: 'power2.out' });
  }
  function speedLines(on: boolean) {
    if (reduced) return;
    gsap.to(speedEl, { opacity: on ? 1 : 0, duration: on ? 0.25 : 0.6 });
  }
  function beam(at: { x: number; z: number }, hold = 1.4, width = 1) {
    pillar.position.set(at.x, 0, at.z);
    pillar.visible = true;
    pillar.scale.set(0.05, 1, 0.05);
    gsap.killTweensOf([pillar.scale, pillarU]);
    const tl = gsap.timeline({ onComplete: () => (pillar.visible = false) });
    tl.to(pillarU, { value: 0.85, duration: 0.25 }, 0)
      .to(pillar.scale, { x: width, z: width, duration: 0.5, ease: 'expo.out' }, 0)
      .to(pillar.scale, { x: 0.02, z: 0.02, duration: 0.6, ease: 'power3.in' }, hold)
      .to(pillarU, { value: 0, duration: 0.6 }, hold);
    return tl;
  }
  function shock(at: { x: number; z: number }, size = 6) {
    ring.position.set(at.x, 0.05, at.z);
    const m = ring.material as THREE.MeshBasicMaterial;
    gsap.killTweensOf([ring.scale, m]);
    ring.scale.setScalar(0.2);
    m.opacity = 0.95;
    gsap.to(ring.scale, { x: size, y: size, z: size, duration: 1.1, ease: 'expo.out' });
    gsap.to(m, { opacity: 0, duration: 1.1, ease: 'power2.out' });
  }

  // Ripple: nearby orchard trees bounce in sequence.
  const ripple = { active: false, t: 0, x: 0, z: 0 };
  const wobbles = new Map<number, number>();
  const rq = new THREE.Quaternion();
  const rs = v3();
  const rp = v3();
  // Shell game: trees hop to each other's spots so nobody can follow the new one.
  let shuffling: { idx: number[]; from: { x: number; z: number }[]; to: { x: number; z: number }[]; t: number } | null = null;
  const SHUFFLE_DUR = 2.2;
  function updateShuffle() {
    if (!shuffling) return false;
    const { idx, from, to, t } = shuffling;
    idx.forEach((i, k) => {
      const delay = (k % 6) * 0.12 + Math.floor(k / 6) * 0.05;
      const u = Math.min(1, Math.max(0, (t * SHUFFLE_DUR - delay) / 1.1));
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      const x = from[k].x + (to[k].x - from[k].x) * e;
      const z = from[k].z + (to[k].z - from[k].z) * e;
      const y = Math.sin(u * Math.PI) * 1.8;
      const squash = u > 0.92 ? Math.sin(((u - 0.92) / 0.08) * Math.PI) * 0.18 : 0;
      if (i === userIdx) {
        Object.assign(H, { x, y, z, sy: 1 - squash + (u > 0 && u < 0.9 ? 0.12 : 0) });
        heroDirty = true;
      } else orchard.set(i, x, y, z, 1 + squash * 0.4, { sy: 1 - squash + (u > 0 && u < 0.9 ? 0.12 : 0), ry: treeRy[i] + u * Math.PI * 2 });
    });
    orchard.commit();
    return true;
  }

  async function shuffle() {
    if (reduced) return;
    const idx = slots
      .map((p, i) => ({ i, d: Math.hypot(p.x - slot.x, p.z - slot.z) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 16)
      .map((o) => o.i);
    const from = idx.map((i) => ({ x: slots[i].x, z: slots[i].z }));
    // A permutation where (almost) every tree ends somewhere new, the newcomer included.
    let to = from.slice();
    for (let tries = 0; tries < 20; tries++) {
      to = from.slice().sort(() => Math.random() - 0.5);
      if (to.every((p, k) => p !== from[k])) break;
    }
    shuffling = { idx, from, to, t: 0 };
    ripple.active = false;
    [0, 350, 700, 1050].forEach((ms) => setTimeout(() => fx('jump'), ms));
    const st = { t: 0 };
    await gsap.to(st, { t: 1, duration: SHUFFLE_DUR, ease: 'none', onUpdate: () => shuffling && (shuffling.t = st.t) });
    idx.forEach((i, k) => {
      slots[i].x = to[k].x;
      slots[i].z = to[k].z;
      if (i !== userIdx) orchard.set(i, to[k].x, 0, to[k].z, 1, { store: true, ry: treeRy[i] });
    });
    orchard.commit();
    Object.assign(H, { x: slot.x, y: 0, z: slot.z, sy: 1 });
    heroDirty = true;
    shuffling = null;
    fx('boing');
    bump = 0.08;
    dust.emit(v3(slot.x, 0.2, slot.z), { n: 30, color: [0xc9b48a, 0x8cc865], speed: 3, up: 1, gravity: 4, size: 0.18, life: 0.9, shape: 1, radius: 6 });
  }

  function updateOrchardAnim(dt: number) {
    if (updateShuffle()) return;
    if (!ripple.active && wobbles.size === 0) return;
    if (ripple.active) {
      ripple.t += dt;
      if (ripple.t > 3) ripple.active = false;
    }
    const now = uTime.value;
    for (let i = 0; i < orchard.count; i++) {
      if (i === userIdx) continue;
      const s = slots[i];
      let k = 0;
      if (ripple.active) {
        const dist = Math.hypot(s.x - ripple.x, s.z - ripple.z);
        const ph = ripple.t - dist * 0.09;
        if (ph > 0 && ph < 0.55) k = Math.sin((ph / 0.55) * Math.PI);
      }
      const w0 = wobbles.get(i);
      let b = 0;
      if (w0 !== undefined) {
        const e = now - w0;
        if (e > 1.4) wobbles.delete(i);
        else b = Math.sin(e * 15) * Math.exp(-e * 3.6) * 0.28;
      }
      if (k === 0 && b === 0 && !ripple.active && w0 === undefined) continue;
      orchard.base[i].decompose(rp, rq, rs);
      const ry = new THREE.Euler().setFromQuaternion(rq).y;
      orchard.set(i, rp.x, 0, rp.z, (1 - 0.04 * k) * (1 - b * 0.5), { sy: (1 + 0.16 * k) * (1 + b), ry });
    }
    orchard.commit();
  }

  // ---------- Camera ----------
  const cam = { pos: SHOTS.get(BOX.hero)!.pos.clone(), look: SHOTS.get(BOX.hero)!.look.clone() };
  let area: Area = 'hero';
  let current: View = 'outside';
  const view = { ox: 0, oy: 0, tan: 0, ready: false };

  function freeRect() {
    const W = stage.clientWidth;
    const Hh = stage.clientHeight;
    if (area === 'hero') return { x: 0, y: Hh * 0.46, w: W, h: Hh * 0.54 };
    if (panel.hidden) return { x: 0, y: 0, w: W, h: Hh };
    const sr = stage.getBoundingClientRect();
    const r = panel.getBoundingClientRect();
    if (r.width < W * 0.6) {
      const left = r.right - sr.left;
      return { x: left, y: 0, w: Math.max(200, W - left), h: Hh };
    }
    const top = r.top - sr.top;
    return { x: 0, y: 0, w: W, h: Math.max(150, top) };
  }

  function updateView(snap: boolean) {
    const W = Math.max(1, stage.clientWidth);
    const Hh = Math.max(1, stage.clientHeight);
    const f = freeRect();
    // Shots are composed for a 16:10 frame. Widen the lens so that frame fits
    // inside the free area, then slide the principal point to its centre.
    const tanV = Math.tan(THREE.MathUtils.degToRad(19));
    const tanH = tanV * 1.6;
    const want = Math.max((tanV * Hh) / f.h, (tanH * Hh) / f.w);
    const ox = W / 2 - (f.x + f.w / 2);
    const oy = Hh / 2 - (f.y + f.h / 2);
    const k = snap || !view.ready ? 1 : 0.12;
    view.tan += (want - view.tan) * k;
    view.ox += (ox - view.ox) * k;
    view.oy += (oy - view.oy) * k;
    view.ready = true;
    camera.aspect = W / Hh;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(view.tan));
    camera.setViewOffset(W, Hh, view.ox, view.oy, W, Hh);
    camera.updateProjectionMatrix();
  }

  function resize() {
    renderer.setSize(stage.clientWidth, stage.clientHeight, false);
    updateView(true);
  }
  new ResizeObserver(resize).observe(stage);

  let camTween: gsap.core.Tween | null = null;
  function frame(box: Box, opts: { dur?: number; ease?: string; area?: Area; view?: View } = {}) {
    const target = box === BOX.orchard && gardenerOn ? gardenShot : SHOTS.get(box);
    area = opts.area ?? 'auto';
    if (!target) return Promise.resolve();
    return flyTo(target, opts.dur ?? 1.6, opts.ease);
  }

  function flyTo(t: Shot, dur: number, ease = 'power3.inOut', lift = 0) {
    camTween?.kill();
    const p0 = cam.pos.clone();
    const l0 = cam.look.clone();
    if (dur === 0) {
      cam.pos.copy(t.pos);
      cam.look.copy(t.look);
      return Promise.resolve();
    }
    if (reduced) {
      return new Promise<void>((done) => {
        gsap.to(renderer.domElement, {
          opacity: 0.2,
          duration: 0.15,
          onComplete: () => {
            cam.pos.copy(t.pos);
            cam.look.copy(t.look);
            gsap.to(renderer.domElement, { opacity: 1, duration: 0.25, onComplete: () => done() });
          },
        });
      });
    }
    if (dur >= 1.4) fx('whoosh');
    const autoLift = lift || Math.min(6, p0.distanceTo(t.pos) * 0.18);
    const p = { t: 0 };
    camTween = gsap.to(p, {
      t: 1,
      duration: dur,
      ease,
      onUpdate: () => {
        cam.pos.lerpVectors(p0, t.pos, p.t);
        cam.pos.y += Math.sin(p.t * Math.PI) * autoLift;
        cam.look.lerpVectors(l0, t.look, p.t);
      },
    });
    return camTween.then(() => undefined);
  }

  // ---------- Loop ----------
  const timer = new THREE.Timer();
  let raf = 0;
  let idleT = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    uTime.value += dt;
    idleT += dt;
    updateView(false);
    // A breath of handheld drift keeps the frame alive when nothing moves.
    const drift = reduced ? 0 : 1;
    camera.position.set(cam.pos.x + Math.sin(idleT * 0.21) * 0.08 * drift, cam.pos.y + Math.sin(idleT * 0.33) * 0.05 * drift, cam.pos.z);
    camera.lookAt(cam.look);
    for (const c of clouds) {
      c.position.x += dt * 0.8;
      if (c.position.x > 320) c.position.x = -320;
    }
    if (gardener.scale.x > 0 && !reduced) {
      const ph = (idleT % 2.4) / 2.4;
      if (ph < 0.18) {
        // Hop
        const k = ph / 0.18;
        gBody.position.y = Math.sin(k * Math.PI) * 0.45;
        gBody.scale.set(0.94, 1.08, 0.94);
      } else if (ph < 0.26) {
        // Land: squash
        const k = (ph - 0.18) / 0.08;
        gBody.position.y = 0;
        const sq = Math.sin(k * Math.PI) * 0.16;
        gBody.scale.set(1 + sq, 1 - sq, 1 + sq);
      } else {
        gBody.position.y = 0;
        gBody.scale.set(1, 1, 1);
      }
      hat.rotation.z = 0.08 + Math.sin(idleT * 1.1) * 0.04;
    }
    if (bump > 0.001) {
      camera.position.y += Math.sin(idleT * 48) * bump;
      bump *= Math.exp(-dt * 9);
    }
    if (stranger.scale.x > 0 && !reduced) {
      const blink = Math.sin(idleT * 0.9) > 0.985 ? 0.05 : 0.6;
      eyes.forEach((e) => (e.scale.y = blink));
    }
    if (H.shake > 0 || H.glow > 0 || heroDirty) {
      applyHero();
      heroDirty = H.shake > 0;
    }
    updateOrchardAnim(dt);
    sparks.update(dt);
    dust.update(dt);
    if (fireflies && Math.random() < dt * 6) {
      sparks.emit(v3((Math.random() - 0.5) * 30, 0.5 + Math.random() * 3, -4 - Math.random() * 28), { n: 1, color: 0xffe08a, speed: 0.15, life: 3, size: 0.22, drag: 0.2, shape: 1 });
    }
    renderer.render(scene, camera);
    adapt(dt);
  };
  // Adaptive quality: if frames run long, drop resolution, then shadows.
  let slowFrames = 0;
  let sampled = 0;
  let tier = 0;
  const adapt = (dt: number) => {
    if (tier >= 2 || document.hidden) return;
    sampled++;
    if (dt > 0.03) slowFrames++;
    if (sampled < 90) return;
    if (slowFrames > 45) {
      tier++;
      if (tier === 1) {
        pr = Math.max(1, pr * 0.7);
        renderer.setPixelRatio(pr);
        resize();
      } else {
        sun.castShadow = false;
      }
    }
    sampled = slowFrames = 0;
  };
  let heroDirty = true;
  let fireflies = false;
  let bump = 0;
  resize();
  loop();
  if (import.meta.env.DEV) Object.assign(window, { __three: { renderer, scene, sun, camera } });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) {
      timer.reset();
      loop();
    }
  });

  const tweenHero = (vars: gsap.TweenVars) => gsap.to(H, { ...vars, onUpdate: () => (heroDirty = true) });
  const sizeFor = (amount: number) => 0.5 + (0.55 * (Math.log10(amount) + 2)) / 3;

  // ---------- Gate ----------
  function doors(open: boolean, dur = 1) {
    gsap.to(doorL.rotation, { y: open ? 1.8 : 0, duration: d(dur), ease: 'power3.inOut' });
    return gsap.to(doorR.rotation, { y: open ? -1.8 : 0, duration: d(dur), ease: 'power3.inOut' }).then(() => undefined);
  }
  function rattle() {
    if (reduced) return Promise.resolve();
    const tl = gsap.timeline();
    tl.to([doorL.rotation, doorR.rotation], { y: (i: number) => (i ? -0.04 : 0.04), duration: 0.06, repeat: 7, yoyo: true, ease: 'none' })
      .to([doorL.rotation, doorR.rotation], { y: 0, duration: 0.06 })
      .to(lock.rotation, { z: 0.35, duration: 0.08, repeat: 5, yoyo: true }, 0)
      .to(lock.rotation, { z: 0, duration: 0.1 });
    return tl.then(() => undefined);
  }
  function setLocked(locked: boolean) {
    gsap.killTweensOf([lock.position, lock.rotation, lock.scale, shackle.position, key.position, key.rotation]);
    lock.visible = locked;
    lock.position.copy(LOCK_AT);
    lock.rotation.set(0, 0, 0);
    lock.scale.setScalar(1);
    shackle.position.y = 0;
    key.visible = false;
    key.rotation.set(0, 0, 0);
  }
  function turnKey() {
    setLocked(true);
    key.visible = true;
    const keyIn = v3(LOCK_AT.x, LOCK_AT.y + 0.005, LOCK_AT.z + 0.15);
    key.position.set(keyIn.x, keyIn.y, keyIn.z + 0.5);
    key.rotation.set(0, 0, 0);
    const tl = gsap.timeline();
    tl.to(key.position, { z: keyIn.z, duration: d(0.7), ease: 'power3.out' })
      .to(key.rotation, { z: Math.PI / 2, duration: d(0.45), ease: 'back.out(2)' }, '+=0.15')
      .add('clunk')
      .call(() => {
        sparks.emit(v3(LOCK_AT.x, LOCK_AT.y + 0.25, LOCK_AT.z + 0.1), { n: 36, color: [0xffffff, 0xfff1c4, 0xf2c14e], speed: 2.4, size: 0.12, life: 0.7 });
        bump = 0.06;
      }, [], 'clunk')
      .to(shackle.position, { y: 0.11, duration: d(0.35), ease: 'back.out(3)' }, 'clunk')
      .to([lock.position, key.position], { y: '-=1.1', duration: d(0.7), ease: 'bounce.out' }, 'clunk+=0.45')
      .to([lock.rotation, key.rotation], { x: 0.5, duration: d(0.7) }, 'clunk+=0.45')
      .to([lock.scale, key.scale], { x: 0, y: 0, z: 0, duration: d(0.3) }, 'clunk+=0.8')
      .call(() => {
        key.visible = false;
        lock.visible = false;
        key.scale.setScalar(1);
      });
    return tl;
  }

  // ---------- Field ----------
  function showSign(label: string, animate: boolean) {
    signText.redraw(label);
    gsap.killTweensOf(sign.scale);
    if (!animate) return sign.scale.setScalar(1);
    gsap.fromTo(sign.scale, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1, duration: d(0.8), delay: 0.5, ease: 'elastic.out(1, 0.5)' });
  }

  function plantField(amount: number, label: string) {
    gsap.killTweensOf(H);
    Object.assign(H, { x: FIELD.x, y: 0, z: FIELD.z, s: 0, sy: 1, ry: 0.4, shake: 0, glow: 0 });
    heroDirty = true;
    fx('thud');
    dust.emit(v3(FIELD.x, 0.1, FIELD.z), { n: 40, color: [0x7a5230, 0x9a6a3e, 0x5a3a20], speed: 3.2, up: 1.5, gravity: 7, drag: 0.8, size: 0.16, life: 1.1, shape: 1 });
    sparks.emit(v3(FIELD.x, 1, FIELD.z), { n: 26, color: [0xd8ffb0, 0xfff1c4], speed: 1.8, up: 1.4, size: 0.18, life: 1.3 });
    shock(FIELD, 3);
    setTimeout(() => fx('rustle'), 250);
    tweenHero({ s: sizeFor(amount), duration: d(1.6), ease: 'elastic.out(1, 0.5)' });
    showSign(label, true);
    return new Promise<void>((r) => setTimeout(r, reduced ? 100 : 1100));
  }
  function setFieldSize(amount: number, label: string) {
    signText.redraw(label);
    tweenHero({ s: sizeFor(amount), duration: d(0.4), ease: 'power2.out' });
  }
  function showField(amount: number, label: string) {
    gsap.killTweensOf(H);
    Object.assign(H, { x: FIELD.x, y: 0, z: FIELD.z, s: sizeFor(amount), sy: 1, ry: 0.4, shake: 0, glow: 0 });
    heroDirty = true;
    gsap.killTweensOf(sign.rotation);
    sign.rotation.set(0, -0.35, 0);
    showSign(label, false);
  }
  function hideField() {
    gsap.killTweensOf(H);
    H.s = 0;
    heroDirty = true;
    gsap.killTweensOf(sign.scale);
    sign.scale.setScalar(0);
  }
  function setUserPlanted(on: boolean) {
    gsap.killTweensOf(H);
    Object.assign(H, { x: slot.x, y: 0, z: slot.z, s: on ? 1 : 0, sy: 1, ry: 1.1, shake: 0, glow: 0 });
    heroDirty = true;
  }

  /** A comet of light streaking from a to b along a high arc, shedding sparkles. */
  function comet(a: V3, b: V3, height: number, dur: number, color = [0xfff1c4, 0xffd36b, 0xffc2d6]) {
    const p = { t: 0 };
    const c = v3((a.x + b.x) / 2, Math.max(a.y, b.y) + height, (a.z + b.z) / 2);
    const at = v3();
    return gsap
      .to(p, {
        t: 1,
        duration: d(dur),
        ease: 'power2.inOut',
        onUpdate: () => {
          const u = 1 - p.t;
          at.set(u * u * a.x + 2 * u * p.t * c.x + p.t * p.t * b.x, u * u * a.y + 2 * u * p.t * c.y + p.t * p.t * b.y, u * u * a.z + 2 * u * p.t * c.z + p.t * p.t * b.z);
          sparks.emit(at, { n: 5, color, speed: 0.6, size: 0.3, life: 0.9, drag: 2 });
          sparks.emit(at, { n: 1, color: 0xffffff, speed: 0.05, size: 1.1, life: 0.18, shape: 1 });
        },
      })
      .then(() => undefined);
  }

  /** Sparkles spiralling in to a point from a ring. */
  function converge(at: V3, n: number, radius: number, dur: number) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const from = v3(at.x + Math.cos(a) * radius, at.y + (Math.random() - 0.3) * 2.5, at.z + Math.sin(a) * radius);
      const vel = at.clone().sub(from).divideScalar(dur * 0.7);
      vel.add(v3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(radius * 0.6));
      sparks.emit(from, { n: 1, color: [0xfff1c4, 0xffd36b, 0xffc2d6][i % 3], speed: 0, vel, drag: 0.6, size: 0.35, life: dur });
    }
  }

  async function shield() {
    // 1. The gate swings in; the camera finds the tree.
    doors(true, 1.6);
    flyTo(shot([FIELD.x + 4.4, 2.6, FIELD.z + 8], [FIELD.x, 2.2, FIELD.z]), 1.6);
    gsap.to(sign.rotation, { x: -1.45, duration: d(0.8), delay: 0.4, ease: 'bounce.out' });
    gsap.to(sign.scale, { x: 0, y: 0, z: 0, duration: d(0.4), delay: 1.4 });
    await wait(1.0);
    // 2. Tremble. The ground cracks.
    speedLines(true);
    tweenHero({ shake: 1, duration: 0.25 });
    fx('rustle');
    for (let k = 0; k < 4; k++)
      setTimeout(() => dust.emit(v3(FIELD.x, 0.05, FIELD.z), { n: 22, color: [0x7a5230, 0x9a6a3e, 0x5a3a20], speed: 3.5, up: 2, gravity: 8, drag: 0.7, size: 0.15, life: 1.1, shape: 1, radius: 0.5 }), k * 220);
    shock(FIELD, 2.5);
    await wait(0.9);
    // 3. Torn free, glowing, spinning up into the light.
    fx('whoosh');
    beam(FIELD, 1.6, 1.3);
    tweenHero({ y: 1.6, duration: d(1.2), ease: 'expo.out' });
    tweenHero({ glow: 1, duration: d(1.0), ease: 'power2.in' });
    tweenHero({ ry: H.ry + Math.PI * 3, duration: d(1.6), ease: 'power2.in' });
    for (let k = 0; k < 6; k++) setTimeout(() => sparks.emit(v3(FIELD.x, 1.5 + k * 0.6, FIELD.z), { n: 14, color: [0xfff1c4, 0xffd36b], speed: 1.4, up: 2, size: 0.22, life: 1 }), k * 160);
    await wait(1.3);
    // 4. It bursts into light.
    tweenHero({ sy: 2.4, s: H.s * 0.2, duration: d(0.18), ease: 'power3.in' });
    await wait(0.18);
    flash(1);
    speedLines(false);
    tweenHero({ s: 0, shake: 0, duration: 0.05 });
    sparks.emit(v3(FIELD.x, CROWN, FIELD.z), { n: 260, color: [0xffffff, 0xfff1c4, 0xffd36b, 0xffc2d6], speed: 6, up: 1, size: 0.3, life: 1.6, drag: 1.6 });
    sparks.emit(v3(FIELD.x, CROWN, FIELD.z), { n: 70, color: [0xffc2d6, 0xfff1c4], speed: 2.5, up: 0.5, gravity: 0.6, size: 0.26, life: 2.6, drag: 1, shape: 2 });
    // 5. The light arcs over the wall; the camera cranes after it.
    const slotTop = v3(slot.x, CROWN, slot.z);
    const arrive = flyTo(shot([slot.x + 5.5, 8.5, slot.z + 13], [slot.x, 2.4, slot.z]), 2.8, 'power3.inOut');
    await comet(v3(FIELD.x, CROWN, FIELD.z), slotTop, 9, 2.2);
    current = 'inside';
    // 6. A pillar falls on the empty slot; the light gathers; the tree appears.
    beam(slot, 1.2, 1.1);
    pillar.position.set(slot.x, 0, slot.z);
    converge(slotTop, 80, 3.2, 0.8);
    await arrive;
    await wait(0.4);
    flash(0.7);
    fx('shimmer');
    Object.assign(H, { x: slot.x, y: 0, z: slot.z, s: 0, sy: 1, ry: 1.1, glow: 1, shake: 0 });
    heroDirty = true;
    tweenHero({ s: 1, duration: d(1.2), ease: 'elastic.out(1, 0.45)' });
    tweenHero({ glow: 0, duration: d(2.2), delay: 0.6, ease: 'power2.out' });
    shock(v3(slot.x, 0, slot.z), 9);
    sparks.emit(slotTop, { n: 120, color: [0xffffff, 0xfff1c4, 0xffd36b], speed: 5, up: 1, size: 0.28, life: 1.4 });
    sparks.emit(slotTop, { n: 90, color: [0xffc2d6, 0xffe3ec, 0xfff1c4], speed: 3, up: 1.5, gravity: 0.5, size: 0.3, life: 3, drag: 0.9, shape: 2 });
    Object.assign(ripple, { active: !reduced, t: 0, x: slot.x, z: slot.z });
    fx('rustle');
    await wait(1.3);
    // Now the shell game: the trees around it swap places.
    flyTo(shot([slot.x + 3, 13, slot.z + 13], [slot.x, 1.5, slot.z]), 1);
    await wait(0.6);
    await shuffle();
    await wait(0.4);
    area = 'auto';
    await flyTo(SHOTS.get(BOX.orchard)!, 2.6);
  }

  // ---------- Taps ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(e: MouseEvent) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hitHero = ray.intersectObject(hero.canopy)[0];
    const hit = ray.intersectObject(orchard.canopy)[0];
    if (hitHero && H.s > 0 && (!hit || hitHero.distance < hit.distance)) return userIdx;
    return hit?.instanceId ?? -1;
  }

  const qTex = textTex('?', 128, 128, { fg: '#FFFFFF', font: '900 110px Fraunces, Georgia, serif' });
  function question(at: V3) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: qTex.tex, transparent: true, depthWrite: false }));
    sp.position.copy(at);
    sp.scale.setScalar(0.9);
    scene.add(sp);
    gsap.fromTo(sp.position, { y: at.y }, { y: at.y + 1.2, duration: 1.2, ease: 'expo.out' });
    gsap.to(sp.material, { opacity: 0, duration: 0.5, delay: 0.8, onComplete: () => scene.remove(sp) });
  }

  function onTreeTap(cb: (i: number) => void) {
    const handler = (e: MouseEvent) => {
      const i = pick(e);
      if (i < 0) return;
      const s = i === userIdx ? { x: H.x, z: H.z } : slots[i];
      if (i !== userIdx) wobbles.set(i, uTime.value);
      else glowUserBoing();
      fx('boing');
      fx('rustle');
      dust.emit(v3(s.x, CROWN, s.z), { n: 16, color: [0x4f9a4c, 0x6fb24f, 0x3e7d3e], speed: 2, up: 0.5, gravity: 2, drag: 1.2, size: 0.14, life: 1.4, shape: 2 });
      question(v3(s.x, CROWN + 1.8, s.z));
      cb(i);
    };
    renderer.domElement.addEventListener('click', handler);
    renderer.domElement.classList.add('is-tappable');
    return () => {
      renderer.domElement.removeEventListener('click', handler);
      renderer.domElement.classList.remove('is-tappable');
    };
  }

  function glowUserBoing() {
    gsap.timeline({ onUpdate: () => (heroDirty = true) }).to(H, { sy: 1.25, duration: 0.1 }).to(H, { sy: 1, duration: 0.7, ease: 'elastic.out(1.2, 0.3)' });
  }

  function focusUser() {
    area = 'auto';
    return flyTo(shot([slot.x + 3, 12, slot.z + 13], [slot.x, 2.4, slot.z]), 1.4);
  }
  function glowUser() {
    beam(v3(slot.x, 0, slot.z), 1.8, 1.2);
    sparks.emit(v3(slot.x, CROWN, slot.z), { n: 70, color: [0xfff1c4, 0xffd36b, 0xffffff], speed: 2.5, up: 1, size: 0.26, life: 1.6 });
    const tl = gsap.timeline({ onUpdate: () => (heroDirty = true) });
    tl.to(H, { glow: 1, duration: d(0.5), ease: 'power2.out' })
      .to(H, { sy: 1.08, duration: d(0.25), yoyo: true, repeat: 1, ease: 'power2.inOut' }, 0)
      .to(H, { glow: 0, duration: d(1.4), delay: 1.4 });
    return tl;
  }

  // ---------- Fruit ----------
  function arcFruit(f: THREE.Object3D, a: V3, b: V3, height: number, dur: number, trail = true) {
    const p = { t: 0 };
    const c = v3((a.x + b.x) / 2, Math.max(a.y, b.y) + height, (a.z + b.z) / 2);
    return gsap
      .to(p, {
        t: 1,
        duration: d(dur),
        ease: 'power1.inOut',
        onUpdate: () => {
          const u = 1 - p.t;
          f.position.set(u * u * a.x + 2 * u * p.t * c.x + p.t * p.t * b.x, u * u * a.y + 2 * u * p.t * c.y + p.t * p.t * b.y, u * u * a.z + 2 * u * p.t * c.z + p.t * p.t * b.z);
          f.rotation.z -= 0.15;
          if (trail) sparks.emit(f.position, { n: 2, color: [0xffd36b, 0xfff1c4], speed: 0.3, size: 0.18, life: 0.6 });
        },
      })
      .then(() => undefined);
  }
  function land(f: THREE.Object3D, at: V3) {
    fx('pluck');
    bump = Math.max(bump, 0.05);
    sparks.emit(at, { n: 30, color: [0xffd36b, 0xfff1c4, 0xffffff], speed: 2.6, up: 0.8, size: 0.2, life: 0.8 });
    dust.emit(at, { n: 10, color: [0xf2a03a, 0xffc66b], speed: 1.8, up: 1.2, gravity: 6, size: 0.1, life: 0.7, shape: 1 });
    return gsap
      .timeline()
      .to(f.scale, { x: 1.35, y: 0.65, z: 1.35, duration: d(0.07) })
      .to(f.scale, { x: 1, y: 1, z: 1, duration: d(0.6), ease: 'elastic.out(1.1, 0.35)' });
  }

  const pop = (o: THREE.Object3D, on: boolean, k = 1) => {
    gsap.killTweensOf(o.scale);
    if (reduced || !on) return o.scale.setScalar(on ? k : 0);
    gsap.fromTo(o.scale, { x: 0, y: 0, z: 0 }, { x: k, y: k, z: k, duration: 0.8, ease: 'elastic.out(1, 0.45)' });
  };

  /** Exchange scene at rest: props up, or the final 'caught in the light' state. */
  function setExchange(on: boolean, label?: string) {
    [stall, scaleG, priceBoard, tower].forEach((o) => o.scale.setScalar(on ? 1 : 0));
    stallSign.scale.setScalar(0);
    gsap.killTweensOf([beamMat, spotDisc.material]);
    beamMat.opacity = on && label ? 0.2 : 0;
    (spotDisc.material as THREE.MeshBasicMaterial).opacity = on && label ? 0.35 : 0;
    if (stallFruit) {
      scene.remove(stallFruit);
      stallFruit = null;
    }
    if (on && label) {
      setBoard(label, 'PUBLIC AGAIN');
      const f = makeFruit();
      f.scale.setScalar(1);
      f.position.copy(dishTop());
      stallFruit = f;
      aim(SCALE_AT);
    } else setBoard('-- ZEC', 'WAITING');
    needle.rotation.z = on && label ? -1.1 : 0;
  }
  const dishTop = () => dish.getWorldPosition(v3()).add(v3(0, 0.26, 0));

  async function unshieldFruit(label: string) {
    setExchange(false);
    current = 'inside';
    // 1. A fruit ripens on some tree in the orchard, glows, and lifts off.
    const pool = slots.filter((p, i) => i !== userIdx && Math.abs(p.x) < 8 && p.z > -17);
    const src = pool[Math.floor(Math.random() * pool.length)];
    await flyTo(shot([src.x + 3, 9.5, src.z + 10.5], [src.x, 2.4, src.z]), 1.4);
    const f = makeFruit(Math.random() < 0.5 ? 'peach' : 'egg');
    const top = v3(src.x + 0.6, CROWN - 0.2, src.z + 0.9);
    f.position.copy(top);
    fx('boing');
    await gsap.to(f.scale, { x: 1.2, y: 1.2, z: 1.2, duration: d(0.6), ease: 'elastic.out(1, 0.45)' });
    beam(src, 1.2, 0.8);
    fx('whoosh');
    for (let k = 0; k < 5; k++) setTimeout(() => sparks.emit(f.position, { n: 10, color: [0xfff1c4, 0xffd36b], speed: 1.2, up: 1.5, size: 0.2, life: 0.9 }), k * 130);
    gsap.to(f.rotation, { y: Math.PI * 4, duration: d(1), ease: 'power2.in' });
    await gsap.to(f.position, { y: top.y + 1.8, duration: d(0.9), ease: 'expo.out' });
    flash(0.55);
    sparks.emit(f.position, { n: 120, color: [0xffffff, 0xfff1c4, 0xffd36b, 0xffc2d6], speed: 4.5, up: 0.5, size: 0.26, life: 1.3 });
    f.visible = false;

    // 2. It streaks over the wall as a comet; the exchange rises to meet it.
    [stall, scaleG, priceBoard, tower].forEach((o, i) => setTimeout(() => pop(o, true), 300 + i * 140));
    const dt = dishTop();
    const cam = flyTo(shot([1.6, 5, 15.5], [4.2, 2.3, 5.4]), 2.6);
    current = 'outside';
    await comet(f.position.clone(), dt.clone().add(v3(0, 0.3, 0)), 9, 2.2);
    converge(dt, 50, 2, 0.6);
    await wait(0.55);

    // 3. It appears on the scale.
    flash(0.35);
    f.position.copy(dt);
    f.rotation.set(0, 0, 0);
    f.visible = true;
    f.scale.setScalar(0);
    gsap.to(f.scale, { x: 1, y: 1, z: 1, duration: d(0.7), ease: 'elastic.out(1, 0.45)' });
    land(f, dt);
    fx('boing');
    bump = 0.09;
    gsap.timeline().to(dish.position, { y: 1.1, duration: d(0.1) }).to(dish.position, { y: 1.28, duration: d(0.9), ease: 'elastic.out(1.2, 0.3)' });
    gsap.to(needle.rotation, { z: -1.1, duration: d(1.1), ease: 'elastic.out(1, 0.35)' });
    stallFruit = f;
    await cam;
    await wait(0.3);

    // 4. The price board flips to the amount.
    fx('flip');
    await gsap.to(flap.rotation, { x: Math.PI / 2, duration: d(0.18), ease: 'power2.in' });
    setBoard(label, 'PUBLIC AGAIN');
    await gsap.fromTo(flap.rotation, { x: -Math.PI / 2 }, { x: 0, duration: d(0.5), ease: 'back.out(2.2)' });

    // 5. The Watcher's searchlight sweeps the field and locks on.
    const sweep = { t: 0 };
    const p0 = v3(-4, 0, 12);
    const p1 = v3(7, 0, 11);
    const p2 = SCALE_AT.clone();
    aim(p0);
    gsap.to(beamMat, { opacity: 0.2, duration: d(0.3) });
    gsap.to(spotDisc.material, { opacity: 0.35, duration: d(0.3) });
    await gsap.to(sweep, {
      t: 1,
      duration: d(1.7),
      ease: 'power2.inOut',
      onUpdate: () => {
        const u = 1 - sweep.t;
        aim(v3(u * u * p0.x + 2 * u * sweep.t * p1.x + sweep.t * sweep.t * p2.x, 0, u * u * p0.z + 2 * u * sweep.t * p1.z + sweep.t * sweep.t * p2.z));
      },
    });
    fx('spot');
    bump = 0.07;
    gsap.fromTo(spotDisc.scale, { x: 1.6, y: 1, z: 1.6 }, { x: 1, y: 1, z: 1, duration: d(0.5), ease: 'back.out(3)' });
    gsap.fromTo(beamMat, { opacity: 0.45 }, { opacity: 0.2, duration: d(0.8) });
    await wait(0.8);
  }
  let stallFruit: THREE.Object3D | null = null;
  let gardenerOn = false;

  function setStall(on: boolean, label?: string) {
    setExchange(on, label);
  }

  async function showGardener(on: boolean): Promise<void> {
    gardenerOn = on;
    gsap.killTweensOf([gardener.scale, gardener.position, gardener.rotation]);
    if (on && gardener.scale.x === 0) {
      placeGardener();
      if (!reduced) {
        gardener.scale.setScalar(G_SCALE);
        const from = GARDENER.clone().add(v3(-7, 0, 2.5));
        gardener.position.copy(from);
        fx('whoosh');
        const trail = { t: 0 };
        gsap.to(trail, {
          t: 1,
          duration: 0.75,
          ease: 'power3.out',
          onUpdate: () => {
            gardener.position.lerpVectors(from, GARDENER, trail.t);
            dust.emit(v3(gardener.position.x, 0.15, gardener.position.z), { n: 3, color: [0xc9b48a, 0xe2cfa2], speed: 1, up: 0.8, gravity: 3, size: 0.2, life: 0.6, shape: 1 });
          },
        });
        gsap.fromTo(gardener.rotation, { y: -Math.PI * 4 }, { y: 0.25, duration: 0.8, ease: 'power3.out' });
        setTimeout(() => {
          fx('boing');
          sparks.emit(v3(GARDENER.x, 1.4, GARDENER.z), { n: 24, color: [0xffffff, 0xfff1c4], speed: 2, size: 0.2, life: 0.8 });
        }, 800);
        await new Promise<void>((r) => setTimeout(r, 900));
        return;
      }
    }
    const k = on ? G_SCALE : 0;
    await gsap.to(gardener.scale, { x: k, y: k, z: k, duration: d(0.6), ease: on ? 'back.out(2)' : 'power2.in' });
  }
  function wave() {
    if (reduced) return;
    gsap.timeline().to(armR.position, { y: 0.95, duration: 0.25, ease: 'back.out(2)' }).to(armR.position, { x: 0.46, duration: 0.15, repeat: 5, yoyo: true }).to(armR.position, { x: 0.36, y: 0.5, duration: 0.35 });
  }

  async function passFruit(dir: 'send' | 'receive') {
    const tree = v3(slot.x + 0.6, CROWN - 0.3, slot.z + 0.9);
    const bask = basketWorld();
    const [a, b] = dir === 'send' ? [tree, bask] : [bask, tree];
    const f = makeFruit();
    f.position.copy(a);
    // Frame the aisle: the player's tree and the Gardener both in shot.
    flyTo(gardenShot, 1.2);
    await wait(0.6);
    if (dir === 'receive') wave();
    await gsap.to(f.scale, { x: 1, y: 1, z: 1, duration: d(0.45), ease: 'elastic.out(1, 0.45)' });
    await gsap.timeline().to(f.scale, { y: 0.75, x: 1.15, z: 1.15, duration: d(0.12) }).to(f.scale, { y: 1.15, x: 0.92, z: 0.92, duration: d(0.12) });
    await arcFruit(f, a, b, 5, 2);
    await land(f, b);
    if (dir === 'send') wave();
    await gsap.to(f.scale, { x: 0, y: 0, z: 0, duration: d(0.35), delay: 0.4, ease: 'power2.in' });
    scene.remove(f);
  }

  // ---------- Golden hour ----------
  const GOLD = { top: new THREE.Color(0x6a7fd6), mid: new THREE.Color(0xf3a6a0), horizon: new THREE.Color(0xffc27a), sun: new THREE.Color(0xffb35c), fog: new THREE.Color(0xffc68a) };
  const DAY = { top: skyU.top.value.clone(), mid: skyU.mid.value.clone(), horizon: skyU.horizon.value.clone(), sun: sun.color.clone(), fog: (scene.fog as THREE.Fog).color.clone() };
  function setGolden(on: boolean, k = on ? 1 : 0) {
    const src = DAY;
    skyU.top.value.copy(src.top).lerp(GOLD.top, k);
    skyU.mid.value.copy(src.mid).lerp(GOLD.mid, k);
    skyU.horizon.value.copy(src.horizon).lerp(GOLD.horizon, k);
    sun.color.copy(src.sun).lerp(GOLD.sun, k);
    (scene.fog as THREE.Fog).color.copy(src.fog).lerp(GOLD.fog, k);
    fireflies = k > 0.5;
  }
  async function golden() {
    flyTo(SHOTS.get(BOX.low)!, 0);
    const p = { k: 0 };
    gsap.to(p, { k: 1, duration: d(3.5), ease: 'power1.inOut', onUpdate: () => setGolden(true, p.k) });
    await flyTo(SHOTS.get(BOX.golden)!, 4.2, 'power2.inOut');
  }

  // ---------- Misc ----------
  const sapling = v3(3.2, 0, -7.8);
  function insideSapling(on: boolean) {
    if (on) {
      beam(sapling, 1.6, 0.8);
      sparks.emit(v3(sapling.x, 3.5, sapling.z), { n: 50, color: [0xfff1c4, 0xffd36b], speed: 2, up: 1, size: 0.3, life: 1.6 });
    }
    return gsap.to({}, { duration: 0.01 });
  }

  function setStranger(on: boolean) {
    gsap.killTweensOf(stranger.scale);
    if (on && stranger.scale.x === 0) dust.emit(v3(STRANGER.x, 0.6, STRANGER.z), { n: 40, color: [0x2e2540, 0x4a3a66, 0x15101e], speed: 1.6, up: 1, size: 0.35, life: 1.2, shape: 1, drag: 1.2 });
    return gsap.to(stranger.scale, { x: on ? 1 : 0, y: on ? 1 : 0, z: on ? 1 : 0, duration: d(0.6), ease: on ? 'back.out(1.6)' : 'power2.in' });
  }
  function strangerLaugh() {
    if (reduced) return;
    gsap.fromTo(stranger.position, { y: 0 }, { y: 0.08, duration: 0.08, repeat: 9, yoyo: true, ease: 'none' });
    eyes.forEach((e) => gsap.fromTo(e.scale, { x: 1, y: 0.6 }, { x: 1.8, y: 1.4, duration: 0.15, repeat: 5, yoyo: true }));
    dust.emit(v3(STRANGER.x, 1.4, STRANGER.z), { n: 30, color: [0x2e2540, 0x4a3a66], speed: 1.2, up: 1, size: 0.4, life: 1.4, shape: 1 });
  }

  function show(v: View) {
    current = v;
    return Promise.resolve();
  }

  function wait(s: number) {
    return new Promise<void>((r) => setTimeout(r, reduced ? Math.min(s * 1000, 150) : s * 1000));
  }

  function reset() {
    setLocked(true);
    doorL.rotation.y = doorR.rotation.y = 0;
    stranger.scale.setScalar(0);
    hideField();
    setStall(false);
    gardener.scale.setScalar(0);
    setGolden(false);
  }

  return {
    BOX,
    get view() {
      return current;
    },
    show,
    frame,
    refresh: (_d?: number) => updateView(true),
    doors,
    rattle,
    setLocked,
    turnKey,
    stranger: setStranger,
    strangerLaugh,
    plantField,
    setFieldSize,
    showField,
    hideField,
    insideSapling,
    setUserPlanted,
    shield,
    onTreeTap,
    glowUser,
    focusUser,
    userIndex: userIdx,
    unshieldFruit,
    setStall,
    gardener: showGardener,
    passFruit,
    golden,
    setGolden: (on: boolean) => setGolden(on),
    reset,
  };
}
