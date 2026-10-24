import {
  ACESFilmicToneMapping,
  BufferGeometry,
  Color,
  DataTexture,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Quaternion,
  RedFormat,
  RepeatWrapping,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";

// A fixed seed keeps the same cookie when a reader returns or changes theme.
function seededRandom(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function makeCookie() {
  const random = seededRandom(1847);
  const noise = new ImprovedNoise();
  const radius = 2.1;
  const halfThickness = 0.36;
  const cookie = new Group();
  const chips: { x: number; y: number; z: number; size: number }[] = [];
  for (const side of [1, -1]) {
    for (
      let attempt = 0;
      attempt < 600 && chips.length < (side === 1 ? 32 : 56);
      attempt++
    ) {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * radius * 0.91;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      if (
        chips.some(
          (chip) =>
            Math.sign(chip.z) === side &&
            Math.hypot(chip.x - x, chip.y - y) < 0.39,
        )
      )
        continue;
      chips.push({
        x,
        y,
        z: side * halfThickness * Math.sqrt(1 - (distance / radius) ** 2),
        size: 0.09 + random() * 0.075,
      });
    }
  }

  const geometry = new SphereGeometry(radius, 128, 96);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const surfaceColor = new Color("#b9b9b9");
  const edgeColor = new Color("#707070");
  const color = new Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    const grain = noise.noise(x * 5.2, y * 5.2, z * 5.2);
    const fineGrain = noise.noise(x * 27, y * 27, z * 27);
    const edge = Math.hypot(x, y) / radius;
    const variation = 1 + noise.noise(x * 2.8, y * 2.8, z * 2.8) * 0.018;
    let surfaceZ =
      (z / radius) * halfThickness + grain * 0.033 + fineGrain * 0.01;
    // Baked hollows seat the chocolate in the surface instead of floating above it.
    for (const chip of chips) {
      if (Math.sign(chip.z) !== Math.sign(z)) continue;
      const distanceSquared = (x - chip.x) ** 2 + (y - chip.y) ** 2;
      surfaceZ -=
        Math.sign(z) *
        Math.exp(-distanceSquared / (chip.size * 1.4) ** 2) *
        0.035;
    }
    positions.setXYZ(i, x * variation, y * variation, surfaceZ);
    const baking = Math.min(
      0.85,
      Math.max(0, (edge - 0.6) * 0.8 + grain * 0.3 + fineGrain * 0.07),
    );
    color.copy(surfaceColor).lerp(edgeColor, baking);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const textureSize = 256;
  const grainData = new Uint8Array(textureSize * textureSize);
  for (let i = 0; i < grainData.length; i++) {
    const x = i % textureSize,
      y = Math.floor(i / textureSize);
    grainData[i] = 105 + random() * 95 + noise.noise(x / 13, y / 13, 3) * 40;
  }
  const grainTexture = new DataTexture(
    grainData,
    textureSize,
    textureSize,
    RedFormat,
  );
  grainTexture.wrapS = grainTexture.wrapT = RepeatWrapping;
  grainTexture.repeat.set(5, 3);
  grainTexture.needsUpdate = true;
  const biscuit = new Mesh(
    geometry,
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.93,
      bumpMap: grainTexture,
      bumpScale: 0.055,
    }),
  );
  biscuit.castShadow = biscuit.receiveShadow = true;
  cookie.add(biscuit);

  const chipGeometry = new IcosahedronGeometry(1, 1);
  const chipPositions = chipGeometry.getAttribute("position");
  for (let i = 0; i < chipPositions.count; i++) {
    const x = chipPositions.getX(i),
      y = chipPositions.getY(i),
      z = chipPositions.getZ(i);
    const shape = 1 + noise.noise(x * 4, y * 4, z * 4) * 0.22;
    chipPositions.setXYZ(i, x * shape, y * shape, z * shape);
  }
  chipGeometry.computeVertexNormals();
  const chocolate = new InstancedMesh(
    chipGeometry,
    new MeshStandardMaterial({ color: "#292929", roughness: 0.85 }),
    chips.length,
  );
  chocolate.castShadow = chocolate.receiveShadow = true;
  const matrix = new Matrix4();
  const normal = new Vector3();
  const rotation = new Quaternion();
  const facing = new Vector3(0, 0, 1);
  const scale = new Vector3();
  const position = new Vector3();
  for (let i = 0; i < chips.length; i++) {
    const chip = chips[i];
    normal
      .set(
        chip.x / radius ** 2,
        chip.y / radius ** 2,
        chip.z / halfThickness ** 2,
      )
      .normalize();
    rotation.setFromUnitVectors(facing, normal);
    rotation.multiply(
      new Quaternion().setFromAxisAngle(facing, random() * Math.PI * 2),
    );
    position.set(chip.x, chip.y, chip.z).addScaledVector(normal, 0.015);
    scale.set(
      chip.size * (0.9 + random() * 0.4),
      chip.size * (0.85 + random() * 0.4),
      chip.size * 0.55,
    );
    matrix.compose(position, rotation, scale);
    chocolate.setMatrixAt(i, matrix);
    chocolate.setColorAt(i, new Color().setScalar(0.7 + random() * 0.5));
  }
  cookie.add(chocolate);
  cookie.rotation.set(0.12, -0.25, -0.12);
  return { cookie, grainTexture };
}

export function mountCookieMoon(host: HTMLElement) {
  const canvas = host.querySelector<HTMLCanvasElement>("canvas")!;
  const viewport = host.querySelector<HTMLElement>("[data-cookie-viewport]")!;
  const status = host.querySelector<HTMLElement>("[data-cookie-status]")!;
  const buttons = host.querySelectorAll<HTMLButtonElement>(
    "[data-cookie-action]",
  );
  const motionButton = host.querySelector<HTMLButtonElement>(
    '[data-cookie-action="motion"]',
  )!;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch {
    status.textContent =
      "The 3D view isn’t available in this browser. Explore Writing or About above.";
    host.dataset.state = "unavailable";
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, 0.05, 7.4);
  const { cookie, grainTexture } = makeCookie();
  scene.add(cookie);
  const ambient = new HemisphereLight("#ffffff", "#333333", 2.1);
  scene.add(ambient);
  const sunlight = new DirectionalLight("#ffffff", 3.2);
  sunlight.position.set(-4, 5, 6);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  Object.assign(sunlight.shadow.camera, {
    left: -3,
    right: 3,
    top: 3,
    bottom: -3,
    near: 0.5,
    far: 18,
  });
  sunlight.shadow.bias = -0.0005;
  sunlight.shadow.normalBias = 0.018;
  scene.add(sunlight);
  const rim = new DirectionalLight("#ffffff", 3.5);
  rim.position.set(4, 1, -3);
  scene.add(rim);
  const fill = new DirectionalLight("#ffffff", 0.7);
  fill.position.set(3, -2, 4);
  scene.add(fill);

  const random = seededRandom(92);
  const starsGeometry = new BufferGeometry();
  const starPositions = new Float32Array(130 * 3);
  for (let i = 0; i < starPositions.length; i += 3) {
    starPositions[i] = (random() - 0.5) * 24;
    starPositions[i + 1] = (random() - 0.5) * 16;
    starPositions[i + 2] = -5 - random() * 6;
  }
  starsGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(starPositions, 3),
  );
  const starsMaterial = new PointsMaterial({
    color: "#93baff",
    size: 0.018,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  scene.add(new Points(starsGeometry, starsMaterial));

  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.65;
  controls.autoRotateSpeed = 0.22;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let paused = reducedMotion.matches;
  let visible = true;
  let disposed = false;
  let frame = 0;
  let lastTime = 0;
  let baseDistance = 7.4;
  let needsRender = true;

  function requestRender() {
    needsRender = true;
  }

  function updateMotion() {
    controls.autoRotate = !paused;
    motionButton.textContent = paused ? "Play" : "Pause";
    motionButton.setAttribute(
      "aria-label",
      paused ? "Start rotation" : "Pause rotation",
    );
    motionButton.setAttribute("aria-pressed", String(paused));
  }
  function resize() {
    const { width, height } = viewport.getBoundingClientRect();
    if (!width || !height) return;
    const zoomRatio = camera.position.length() / baseDistance;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    baseDistance = 7.4 / Math.min(camera.aspect, 1);
    controls.minDistance = baseDistance * 0.7;
    controls.maxDistance = baseDistance * 1.6;
    camera.position.setLength(baseDistance * zoomRatio);
    renderer.setSize(width, height, false);
    requestRender();
    controls.update(0);
  }
  function zoom(factor: number) {
    camera.position.setLength(
      Math.max(
        controls.minDistance,
        Math.min(controls.maxDistance, camera.position.length() * factor),
      ),
    );
    controls.update(0);
  }
  function reset() {
    controls.reset();
    camera.position.set(0, 0.05, baseDistance);
    cookie.rotation.set(0.12, -0.25, -0.12);
    renderer.shadowMap.needsUpdate = true;
    requestRender();
    controls.update(0);
  }
  function onAction(event: Event) {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "[data-cookie-action]",
    );
    switch (button?.dataset.cookieAction) {
      case "zoom-in":
        zoom(0.88);
        break;
      case "zoom-out":
        zoom(1.14);
        break;
      case "motion":
        paused = !paused;
        updateMotion();
        break;
      case "reset":
        reset();
        break;
    }
  }
  function onKey(event: KeyboardEvent) {
    const turns: Record<string, [number, number]> = {
      ArrowLeft: [0, -0.12],
      ArrowRight: [0, 0.12],
      ArrowUp: [-0.12, 0],
      ArrowDown: [0.12, 0],
    };
    if (turns[event.key]) {
      event.preventDefault();
      paused = true;
      updateMotion();
      cookie.rotation.x += turns[event.key][0];
      cookie.rotation.y += turns[event.key][1];
      renderer.shadowMap.needsUpdate = true;
      requestRender();
    } else if (["+", "=", "-", "r", "R", " "].includes(event.key)) {
      event.preventDefault();
      if (event.key === "r" || event.key === "R") reset();
      else if (event.key === " ") {
        paused = !paused;
        updateMotion();
      } else zoom(event.key === "-" ? 1.14 : 0.88);
    }
  }
  function onStart() {
    paused = true;
    updateMotion();
  }
  function onMotionPreference() {
    paused = reducedMotion.matches;
    updateMotion();
  }
  function updateTheme() {
    const dark = document.documentElement.classList.contains("dark");
    ambient.intensity = dark ? 1.65 : 2.2;
    rim.intensity = dark ? 3.5 : 1.6;
    sunlight.intensity = dark ? 3.2 : 2.8;
    starsMaterial.opacity = dark ? 0.55 : 0.18;
    starsMaterial.color.set(dark ? "#93baff" : "#4679bc");
    requestRender();
  }
  function animate(time: number) {
    if (disposed) return;
    if (visible && !document.hidden) {
      const changed = controls.update(
        lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0,
      );
      if (changed || needsRender) {
        renderer.render(scene, camera);
        needsRender = false;
      }
    }
    lastTime = time;
    frame = requestAnimationFrame(animate);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(viewport);
  const themeObserver = new MutationObserver(updateTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  visibilityObserver.observe(host);
  host.addEventListener("click", onAction);
  canvas.addEventListener("keydown", onKey);
  controls.addEventListener("start", onStart);
  controls.addEventListener("change", requestRender);
  reducedMotion.addEventListener("change", onMotionPreference);

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    themeObserver.disconnect();
    visibilityObserver.disconnect();
    host.removeEventListener("click", onAction);
    canvas.removeEventListener("keydown", onKey);
    reducedMotion.removeEventListener("change", onMotionPreference);
    controls.dispose();
    scene.traverse((object) => {
      if (object instanceof Mesh || object instanceof Points) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    grainTexture.dispose();
    sunlight.shadow.dispose();
    renderer.dispose();
  }
  import.meta.hot?.dispose(dispose);
  window.addEventListener(
    "pagehide",
    (event) => {
      if (!event.persisted) dispose();
    },
    { once: true },
  );
  document.addEventListener("astro:before-swap", dispose, { once: true });
  resize();
  controls.saveState();
  updateMotion();
  updateTheme();
  buttons.forEach((button) => {
    button.disabled = false;
  });
  status.hidden = true;
  host.dataset.state = "ready";
  frame = requestAnimationFrame(animate);
}
