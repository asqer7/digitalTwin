import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Spring } from './spring.js';

const PALETTE = {
  solid: {
    bg: 0xf0eee6,
    shell: 0xcdccc7,
    frame: 0xa6a5a0,
    core: 0x8c8b86,
    board: 0x5e5d59,
    accent: 0xd97757,
    edge: 0x141413,
    edgeOpacity: 0.26,
    grid: 0x141413,
    gridOpacity: 0.06,
    ring: 0x141413,
    ringOpacity: 0.16,
  },
  wire: {
    bg: 0x030606,
    fill: 0x040a0a,
    accent: 0x19f5dc,
    edge: 0x19f5dc,
    edgeOpacity: 0.95,
    grid: 0x19f5dc,
    gridOpacity: 0.05,
    ring: 0x19f5dc,
    ringOpacity: 0.55,
  },
};

const FLOOR_Y = -1.75;
const VIEW = 6.6;
const ISO_DIST = 20;
const ISO = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(ISO_DIST);

// Assembly: [id, name, group, kind, size, rest position, exploded offset, tilt [axis, rad]]
const PARTS = [
  ['top', 'Top cap', 'Shell', 'shell', [2, 0.2, 2], [0, 0.9, 0], [0, 0.62, 0]],
  ['base', 'Base plate', 'Shell', 'shell', [2, 0.2, 2], [0, -0.9, 0], [0, -0.3, 0]],
  ['px', 'Panel east', 'Panels', 'shell', [0.08, 1.6, 1.6], [0.94, 0, 0], [0.5, 0.02, 0], ['z', -0.07]],
  ['pz', 'Panel south', 'Panels', 'shell', [1.6, 1.6, 0.08], [0, 0, 0.94], [0, 0.02, 0.5], ['x', 0.07]],
  ['nx', 'Panel west', 'Panels', 'shell', [0.08, 1.6, 1.6], [-0.94, 0, 0], [-0.42, 0.02, 0], ['z', 0.06]],
  ['nz', 'Panel north', 'Panels', 'shell', [1.6, 1.6, 0.08], [0, 0, -0.94], [0, 0.02, -0.42], ['x', -0.06]],
  ['f1', 'Pillar A', 'Frame', 'frame', [0.2, 1.6, 0.2], [0.9, 0, 0.9], [0.2, 0, 0.2]],
  ['f2', 'Pillar B', 'Frame', 'frame', [0.2, 1.6, 0.2], [-0.9, 0, 0.9], [-0.14, 0, 0.2]],
  ['f3', 'Pillar C', 'Frame', 'frame', [0.2, 1.6, 0.2], [0.9, 0, -0.9], [0.2, 0, -0.14]],
  ['f4', 'Pillar D', 'Frame', 'frame', [0.2, 1.6, 0.2], [-0.9, 0, -0.9], [-0.14, 0, -0.14]],
  ['cu', 'Upper module', 'Core', 'core', [1.46, 0.68, 1.46], [0, 0.4, 0], [0, 0.3, 0]],
  ['bd', 'Control board', 'Core', 'board', [1.56, 0.05, 1.56], [0, 0, 0], [0, 0.08, 0]],
  ['cl', 'Lower module', 'Core', 'core', [1.46, 0.68, 1.46], [0, -0.4, 0], [0, -0.1, 0]],
];

// Card anchors: part, local point, local outward normal
const ANCHORS = {
  top: { part: 'top', point: [0, 0.145, 0], normal: [0, 1, 0] },
  left: { part: 'pz', point: [0, 0, 0.05], normal: [0, 0, 1] },
  front: { part: 'px', point: [0.05, 0, 0], normal: [1, 0, 0] },
};

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.copy(ISO);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.rotateSpeed = 0.75;
  controls.panSpeed = 0.9;
  controls.zoomSpeed = 1.15;
  controls.minZoom = 0.45;
  controls.maxZoom = 4;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = 1.48;
  controls.screenSpacePanning = true;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

  // Lights tuned for classic isometric shading: top brightest, left face mid, right face darker.
  const ambient = new THREE.AmbientLight(0xffffff, 0.9);
  const hemi = new THREE.HemisphereLight(0xfdfcf8, 0xc4c2bb, 0.7);
  const key = new THREE.DirectionalLight(0xfffaf3, 2.1);
  key.position.set(2.5, 10, 6);
  key.castShadow = true;
  // Shadow map sized to the assembly only: 6.4 units over 4096 texels keeps slot and module
  // shadows smooth. normalBias pushes lookups off the surface along its normal, which removes the
  // acne that crawled across faces lit at grazing angles while the assembly bobs.
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.camera.left = key.shadow.camera.bottom = -3.2;
  key.shadow.camera.right = key.shadow.camera.top = 3.2;
  key.shadow.camera.near = 5;
  key.shadow.camera.far = 20;
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.014;
  const fill = new THREE.DirectionalLight(0xe8eef5, 0.35);
  fill.position.set(8, 2, -3);
  scene.add(ambient, hemi, key, fill);

  // Floor: shadow catcher, grid, and a pad ring with rotating ticks.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.14 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(28, 56);
  grid.material.vertexColors = false;
  grid.material.transparent = true;
  grid.material.depthWrite = false;
  grid.position.y = FLOOR_Y - 0.001;
  scene.add(grid);

  const pad = new THREE.Group();
  pad.position.y = FLOOR_Y + 0.002;
  const ringMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.05, 2.075, 160), ringMat);
  ring.rotation.x = -Math.PI / 2;
  const tickPts = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const r0 = 2.22;
    const r1 = i % 8 === 0 ? 2.42 : 2.3;
    tickPts.push(Math.cos(a) * r0, 0, Math.sin(a) * r0, Math.cos(a) * r1, 0, Math.sin(a) * r1);
  }
  const tickGeo = new THREE.BufferGeometry();
  tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(tickPts, 3));
  const tickMat = new THREE.LineBasicMaterial({ transparent: true, depthWrite: false });
  const ticks = new THREE.LineSegments(tickGeo, tickMat);
  const pulseMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 });
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.98, 1.0, 160), pulseMat);
  pulse.rotation.x = -Math.PI / 2;
  pad.add(ring, ticks, pulse);
  scene.add(pad);

  // Assembly
  const root = new THREE.Group();
  const bob = new THREE.Group();
  root.add(bob);
  scene.add(root);
  root.visible = false;

  const parts = [];
  const pickables = [];

  function addBox(part, kind, size, pos = [0, 0, 0]) {
    const geo = new THREE.BoxGeometry(...size);
    const solid =
      kind === 'accent'
        ? new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0, emissiveIntensity: 0.55 })
        : new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.04 });
    // Push faces back a hair so outline edges never z-fight with the surface they sit on.
    solid.polygonOffset = true;
    solid.polygonOffsetFactor = 1;
    solid.polygonOffsetUnits = 1;
    const wire = new THREE.MeshBasicMaterial({ polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const mesh = new THREE.Mesh(geo, solid);
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.part = part;
    const edgesGeo = new THREE.EdgesGeometry(geo);
    const edges = new THREE.LineSegments(edgesGeo, part.edgeMat);
    const xray = new THREE.LineSegments(edgesGeo, part.xrayMat);
    xray.renderOrder = 2;
    mesh.add(edges, xray);
    part.group.add(mesh);
    part.meshes.push({ mesh, kind, solid, wire, xray });
    pickables.push(mesh);
    return mesh;
  }

  PARTS.forEach(([id, name, group, kind, size, pos, ex, tilt], index) => {
    const part = {
      id,
      name,
      group: new THREE.Group(),
      groupName: group,
      kind,
      size,
      index,
      rest: new THREE.Vector3(...pos),
      ex: new THREE.Vector3(...ex),
      tilt,
      meshes: [],
      edgeMat: new THREE.LineBasicMaterial({ transparent: true }),
      xrayMat: new THREE.LineBasicMaterial({ transparent: true, depthTest: false, depthWrite: false }),
      s: new Spring(0, { stiffness: 150, damping: 13 }),
      scale: new Spring(1, { stiffness: 210, damping: 17 }),
      glow: new Spring(0, { stiffness: 260, damping: 26 }),
    };
    addBox(part, kind, size);

    // Surface detail so the decomposed view reads as hardware.
    if (id === 'top') {
      addBox(part, 'frame', [1.12, 0.045, 1.12], [0, 0.122, 0]);
      addBox(part, 'accent', [0.16, 0.02, 0.16], [0.7, 0.11, 0.7]);
    }
    if (id === 'px' || id === 'nx' || id === 'pz' || id === 'nz') {
      const alongX = id === 'pz' || id === 'nz';
      const out = id === 'px' || id === 'pz' ? 1 : -1;
      for (let i = 0; i < 4; i++) {
        const y = 0.42 - i * 0.12;
        const slot = alongX ? [0.9, 0.035, 0.03] : [0.03, 0.035, 0.9];
        const p = alongX ? [0, y, out * 0.05] : [out * 0.05, y, 0];
        addBox(part, 'frame', slot, p);
      }
      const badge = alongX ? [0.32, 0.12, 0.025] : [0.025, 0.12, 0.32];
      addBox(part, 'frame', badge, alongX ? [0.48, -0.55, out * 0.05] : [out * 0.05, -0.55, 0.48]);
    }
    if (kind === 'core') {
      addBox(part, 'accent', [0.9, 0.045, 0.02], [0, 0.18, 0.74]);
      addBox(part, 'accent', [0.02, 0.045, 0.9], [0.74, 0.18, 0]);
      // Band sits 0.03 inside the module's top or bottom face. Flush faces z-fight and flicker.
      addBox(part, 'frame', [1.5, 0.08, 1.5], [0, id === 'cu' ? 0.27 : -0.27, 0]);
    }
    if (kind === 'board') {
      addBox(part, 'core', [0.34, 0.07, 0.34], [-0.3, 0.06, -0.25]);
      addBox(part, 'core', [0.22, 0.06, 0.44], [0.32, 0.055, 0.1]);
      addBox(part, 'accent', [0.08, 0.05, 0.08], [-0.55, 0.05, 0.55]);
    }

    part.group.position.copy(part.rest);
    bob.add(part.group);
    parts.push(part);
  });
  const partById = Object.fromEntries(parts.map((p) => [p.id, p]));

  // Post-processing for the wireframe glow.
  // MSAA render target: the composer otherwise renders wireframe lines without antialiasing.
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.62, 0.4, 0.08);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let theme = 'solid';
  const tmpColor = new THREE.Color();
  const white = new THREE.Color(0xffffff);

  function setTheme(next) {
    theme = next;
    const P = PALETTE[next];
    const wire = next === 'wire';
    renderer.setClearColor(P.bg, 1);
    floor.visible = !wire;
    grid.material.color.setHex(P.grid);
    grid.material.opacity = P.gridOpacity;
    ringMat.color.setHex(P.ring);
    ringMat.opacity = P.ringOpacity;
    tickMat.color.setHex(P.ring);
    tickMat.opacity = P.ringOpacity * 0.7;
    pulseMat.color.setHex(P.accent);
    for (const part of parts) {
      part.edgeMat.color.setHex(P.edge);
      part.edgeMat.opacity = P.edgeOpacity;
      part.xrayMat.color.setHex(P.edge);
      part.xrayMat.opacity = 0.075;
      for (const m of part.meshes) {
        m.xray.visible = wire;
        if (wire) {
          m.wire.color.setHex(m.kind === 'accent' ? P.accent : P.fill);
          m.mesh.material = m.wire;
          m.mesh.castShadow = false;
        } else {
          const base = m.kind === 'accent' ? P.accent : P[m.kind];
          m.solid.color.setHex(base);
          if (m.kind === 'accent') m.solid.emissive.setHex(P.accent);
          m.mesh.material = m.solid;
          m.mesh.castShadow = true;
        }
      }
    }
  }

  // Interaction state
  // Hover bounce: damping ratio about 0.65 gives one soft overshoot instead of a rattle.
  const rootScale = new Spring(1, { stiffness: 240, damping: 20 });
  let focused = false;
  let focusId = null;
  let saved = null;
  let exploded = false;
  let hovered = null;
  let overAssembly = false;
  let selected = null;
  let pressed = false;
  let pulseT = 1;

  // Camera move used by focus and reset: interpolates the orbit in spherical space on a spring.
  const camAnim = { active: false, p: new Spring(0, { stiffness: 115, damping: 18 }), from: null, to: null };
  const sph = new THREE.Spherical();
  function cameraState() {
    sph.setFromVector3(camera.position.clone().sub(controls.target));
    return { theta: sph.theta, phi: sph.phi, radius: sph.radius, target: controls.target.clone(), zoom: camera.zoom };
  }
  function moveCamera(to) {
    const from = cameraState();
    const d = THREE.MathUtils.euclideanModulo(to.theta - from.theta + Math.PI, Math.PI * 2) - Math.PI;
    camAnim.from = from;
    camAnim.to = { ...to, theta: from.theta + d };
    camAnim.p.set(0);
    camAnim.p.t = 1;
    camAnim.active = true;
  }

  controls.addEventListener('start', () => {
    camAnim.active = false;
  });

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const bounds = new THREE.Box3();
  function aim(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  }
  function pick(clientX, clientY) {
    if (!root.visible) return null;
    aim(clientX, clientY);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.part : null;
  }
  // Assembly-level hover uses the bounding box, so moving across seams between parts does not
  // switch the hover off and on and retrigger the bounce.
  function overBounds(clientX, clientY) {
    if (!root.visible) return false;
    aim(clientX, clientY);
    bounds.setFromObject(bob);
    return raycaster.ray.intersectsBox(bounds);
  }

  const hooks = { onPick: null, onHover: null };
  let down = null;
  let hoverOffTimer = 0;
  function setHovered(part) {
    if (part) {
      clearTimeout(hoverOffTimer);
      hoverOffTimer = 0;
      if (part !== hovered) {
        hovered = part;
        hooks.onHover?.(part.id);
      }
    } else if (hovered && !hoverOffTimer) {
      hoverOffTimer = setTimeout(() => {
        hovered = null;
        hoverOffTimer = 0;
        hooks.onHover?.(null);
      }, 90);
    }
  }
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button };
    if (e.button === 0 && pick(e.clientX, e.clientY)) pressed = true;
  });
  window.addEventListener('pointerup', (e) => {
    pressed = false;
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 450;
    const btn = down.button;
    down = null;
    if (e.target !== canvas || btn !== 0 || moved > 5 || !quick) return;
    const part = pick(e.clientX, e.clientY);
    hooks.onPick?.(part ? part.id : null);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (down && e.buttons) {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) pressed = false;
      return;
    }
    const part = pick(e.clientX, e.clientY);
    overAssembly = !!part || overBounds(e.clientX, e.clientY);
    canvas.style.cursor = part ? 'pointer' : '';
    setHovered(part);
  });
  canvas.addEventListener('pointerleave', () => {
    overAssembly = false;
    canvas.style.cursor = '';
    setHovered(null);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Public actions
  const UP = new THREE.Vector3(0, 1, 0);
  const FACE = { top: [0, 1, 0], base: [0, -1, 0], px: [1, 0, 0], nx: [-1, 0, 0], pz: [0, 0, 1], nz: [0, 0, -1] };

  // View direction (target to camera) that turns the given part toward the viewer in a 3/4 view.
  function viewFor(part) {
    const cur = camera.position.clone().sub(controls.target).normalize();
    const curH = new THREE.Vector3(cur.x, 0, cur.z).normalize();
    if (!part) return curH.applyAxisAngle(UP, 0.38).add(new THREE.Vector3(0, 0.78, 0)).normalize();
    if (part.id === 'top') return curH.multiplyScalar(0.55).add(UP).normalize();
    if (part.id === 'base') return curH.add(new THREE.Vector3(0, 0.3, 0)).normalize();
    const n = FACE[part.id] ? new THREE.Vector3(...FACE[part.id]) : new THREE.Vector3(part.rest.x, 0, part.rest.z);
    if (n.lengthSq() < 1e-3) n.copy(curH).applyAxisAngle(UP, 0.4);
    n.normalize();
    const side = new THREE.Vector3(-n.z, 0, n.x);
    if (side.dot(curH) < 0) side.negate();
    return n.add(side.multiplyScalar(0.42)).add(new THREE.Vector3(0, 0.74, 0)).normalize();
  }

  function focus(id) {
    const part = id ? partById[id] : null;
    if (!focused) saved = cameraState();
    focused = true;
    focusId = id ?? null;
    sph.setFromVector3(viewFor(part));
    const target = new THREE.Vector3();
    if (part) part.group.getWorldPosition(target).multiplyScalar(0.55);
    moveCamera({
      theta: sph.theta,
      phi: THREE.MathUtils.clamp(sph.phi, controls.minPolarAngle + 0.05, controls.maxPolarAngle - 0.05),
      radius: ISO_DIST,
      target,
      zoom: saved.zoom * (part ? 1.5 : 1.35),
    });
  }

  function unfocus() {
    if (!focused) return;
    focused = false;
    focusId = null;
    if (saved) moveCamera(saved);
    saved = null;
  }

  function setExploded(on) {
    exploded = on;
    const order = on ? parts : [...parts].reverse();
    order.forEach((p, i) => setTimeout(() => (p.s.t = exploded ? 1 : 0), i * 26));
  }

  function select(id) {
    selected = id ? partById[id] : null;
  }

  function highlight(id) {
    clearTimeout(hoverOffTimer);
    hoverOffTimer = 0;
    hovered = id ? partById[id] : null;
  }

  function resetView() {
    focused = false;
    focusId = null;
    saved = null;
    sph.setFromVector3(ISO);
    moveCamera({ theta: sph.theta, phi: sph.phi, radius: ISO_DIST, target: new THREE.Vector3(), zoom: 1 });
  }

  function intro() {
    root.visible = true;
    parts.forEach((p, i) => {
      p.s.set(2.6 + (i % 3) * 0.3);
      p.scale.set(0.001);
      setTimeout(() => {
        p.s.t = exploded ? 1 : 0;
        p.scale.t = 1;
      }, 120 + i * 55);
    });
    rootScale.set(0.9);
    rootScale.t = 1;
  }

  function outro() {
    parts.forEach((p, i) => {
      setTimeout(() => {
        p.s.t = 2.2;
        p.scale.t = 0.001;
      }, (parts.length - i) * 18);
    });
    setTimeout(() => {
      if (parts.every((p) => p.scale.t < 0.01)) root.visible = false;
    }, 900);
    unfocus();
    selected = null;
  }

  function ping() {
    pulseT = 0;
  }

  // Layout
  let width = 1;
  let height = 1;
  function resize() {
    width = canvas.clientWidth || 1;
    height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    const aspect = width / height;
    camera.left = (-VIEW * aspect) / 2;
    camera.right = (VIEW * aspect) / 2;
    camera.top = VIEW / 2;
    camera.bottom = -VIEW / 2;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // Anchors projected to stage pixels each frame
  const anchorOut = {};
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  function computeAnchors() {
    camDir.copy(camera.position).sub(controls.target).normalize();
    for (const key in ANCHORS) {
      const a = ANCHORS[key];
      const part = partById[a.part];
      part.group.updateWorldMatrix(true, false);
      v.set(...a.point).applyMatrix4(part.group.matrixWorld);
      nm.getNormalMatrix(part.group.matrixWorld);
      n.set(...a.normal).applyMatrix3(nm).normalize();
      const facing = n.dot(camDir);
      v.project(camera);
      anchorOut[key] = {
        x: (v.x * 0.5 + 0.5) * width,
        y: (-v.y * 0.5 + 0.5) * height,
        facing,
        part: a.part,
        visible: root.visible && part.scale.x > 0.5,
      };
    }
    return anchorOut;
  }

  // Frame loop
  let last = performance.now();
  let frameCb = null;
  const glowCol = new THREE.Color();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    const t = now / 1000;

    if (camAnim.active) {
      const p = camAnim.p.step(dt);
      const { from, to } = camAnim;
      const lerp = THREE.MathUtils.lerp;
      sph.set(lerp(from.radius, to.radius, p), lerp(from.phi, to.phi, p), lerp(from.theta, to.theta, p));
      controls.target.lerpVectors(from.target, to.target, p);
      camera.position.setFromSpherical(sph).add(controls.target);
      camera.zoom = Math.max(0.2, lerp(from.zoom, to.zoom, p));
      camera.updateProjectionMatrix();
      if (camAnim.p.resting) camAnim.active = false;
    }
    controls.update();

    rootScale.t = pressed ? 0.975 : overAssembly && root.visible ? 1.012 : 1;
    const rs = rootScale.step(dt);
    root.scale.setScalar(rs);
    bob.position.y = Math.sin(t * 1.15) * 0.03;

    for (const p of parts) {
      const s = p.s.step(dt);
      const sc = Math.max(0.001, p.scale.step(dt));
      p.group.position.copy(p.rest).addScaledVector(p.ex, s);
      p.group.scale.setScalar(sc);
      if (p.tilt) p.group.rotation[p.tilt[0]] = p.tilt[1] * Math.min(s, 1.4);
      p.glow.t = p === selected ? 1 : p === hovered ? 0.55 : 0;
      const g = p.glow.step(dt);
      const P = PALETTE[theme];
      if (theme === 'wire') {
        glowCol.setHex(P.edge).lerp(white, g * 0.55);
        p.edgeMat.color.copy(glowCol);
        p.edgeMat.opacity = P.edgeOpacity;
        for (const m of p.meshes) {
          if (m.kind !== 'accent') m.wire.color.setHex(P.fill).lerp(tmpColor.setHex(P.accent), g * 0.08);
        }
      } else {
        p.edgeMat.color.setHex(P.edge).lerp(tmpColor.setHex(P.accent), g);
        p.edgeMat.opacity = P.edgeOpacity + g * 0.6;
        for (const m of p.meshes) {
          if (m.kind !== 'accent') m.solid.emissive.setHex(P.accent).multiplyScalar(g * 0.28);
        }
      }
    }

    ticks.rotation.y = t * 0.06;
    const rv = root.visible ? 1 : 0.4;
    ring.scale.setScalar(1 + (rs - 1) * 1.5);
    ringMat.opacity = PALETTE[theme].ringOpacity * rv;
    if (pulseT < 1) {
      pulseT = Math.min(1, pulseT + dt / 1.4);
      const e = 1 - Math.pow(1 - pulseT, 3);
      pulse.scale.setScalar(1.2 + e * 4.5);
      pulseMat.opacity = (1 - pulseT) * 0.9;
    } else {
      pulseMat.opacity = 0;
    }

    if (theme === 'wire') composer.render(dt);
    else renderer.render(scene, camera);
    frameCb?.();
  });

  setTheme('solid');

  return {
    hooks,
    parts: parts.map((p) => ({ id: p.id, name: p.name, group: p.groupName, kind: p.kind, size: p.size })),
    setTheme,
    focus,
    unfocus,
    get focused() {
      return focused;
    },
    get focusId() {
      return focusId;
    },
    setExploded,
    get exploded() {
      return exploded;
    },
    select,
    highlight,
    resetView,
    intro,
    outro,
    ping,
    computeAnchors,
    onFrame(cb) {
      frameCb = cb;
    },
    stats() {
      const az = THREE.MathUtils.radToDeg(controls.getAzimuthalAngle());
      const el = 90 - THREE.MathUtils.radToDeg(controls.getPolarAngle());
      return { az: (az + 360) % 360, el, zoom: camera.zoom };
    },
  };
}
