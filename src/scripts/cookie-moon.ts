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
  MeshDepthMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Quaternion,
  RedFormat,
  RepeatWrapping,
  RGBAFormat,
  RGBADepthPacking,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";
import { CSS3DObject, CSS3DRenderer } from "three/addons/renderers/CSS3DRenderer.js";

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
  const chipFades: {
    name: "writing" | "about";
    mesh: InstancedMesh;
    texture: DataTexture;
    data: Uint8Array;
    opacity: number;
  }[] = [];
  const chipSlots = new Map<number, { mesh: InstancedMesh; index: number }>();
  // Keep the full cookie in the overview; only clear the patch being read.
  const chipRegions = chips.map((chip) => {
    const side = Math.sign(chip.z);
    const onText = Math.abs(chip.x + side * 0.55) < 1.08 && Math.abs(chip.y - side * 0.55) < 1.15;
    return onText ? (side === 1 ? "writing" : "about") : "rim";
  });
  for (const name of ["rim", "writing", "about"] as const) {
    const indices = chipRegions.flatMap((region, index) => region === name ? [index] : []);
    const data = new Uint8Array([255, 255, 255, 255]);
    const texture = name === "rim" ? null : new DataTexture(data, 1, 1, RGBAFormat);
    if (texture) texture.needsUpdate = true;
    const chocolate = new InstancedMesh(
      chipGeometry,
      new MeshStandardMaterial({
        color: "#292929",
        roughness: 0.85,
        alphaMap: texture,
        transparent: !!texture,
        depthWrite: !texture,
      }),
      indices.length,
    );
    chocolate.castShadow = chocolate.receiveShadow = true;
    if (texture && name !== "rim") {
      // The same alpha map fades the shadow, so invisible chips leave no shadow.
      chocolate.customDepthMaterial = new MeshDepthMaterial({
        depthPacking: RGBADepthPacking,
        alphaHash: true,
      });
      chipFades.push({ name, mesh: chocolate, texture, data, opacity: 1 });
    }
    indices.forEach((chipIndex, index) => chipSlots.set(chipIndex, { mesh: chocolate, index }));
    cookie.add(chocolate);
  }
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
    const slot = chipSlots.get(i)!;
    slot.mesh.setMatrixAt(slot.index, matrix);
    slot.mesh.setColorAt(slot.index, new Color().setScalar(0.7 + random() * 0.5));
  }
  cookie.rotation.set(0.12, -0.25, -0.12);
  return { cookie, grainTexture, chipFades };
}

export function mountCookieMoon(host: HTMLElement) {
  const canvas = host.querySelector<HTMLCanvasElement>("canvas")!;
  const viewport = host.querySelector<HTMLElement>("[data-cookie-viewport]")!;
  const face = host.querySelector<HTMLElement>("[data-cookie-face]")!;
  const returnButton = host.querySelector<HTMLButtonElement>(".cookie-return")!;
  const announcement = host.querySelector<HTMLElement>("[data-cookie-announcement]")!;
  const hint = host.querySelector<HTMLElement>("[data-cookie-hint]")!;
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
  const camera = new PerspectiveCamera(38, 1, 0.1, 120);
  camera.position.set(0, 0.05, 7.4);
  const { cookie, grainTexture, chipFades } = makeCookie();
  const homeRotation = cookie.quaternion.clone();
  scene.add(cookie);
  // Keep real links attached to the cookie in the same coordinate system.
  const htmlRenderer = new CSS3DRenderer();
  htmlRenderer.domElement.className = "cookie-html";
  viewport.appendChild(htmlRenderer.domElement);
  const faceObject = new CSS3DObject(face);
  faceObject.position.set(0, 0, 0.6);
  faceObject.scale.setScalar(0.0095);
  cookie.add(faceObject);
  type Destination = "home" | "writing" | "about";
  const surfaces = (["writing", "about"] as const).map((name) => {
    const element = host.querySelector<HTMLElement>(`[data-cookie-surface="${name}"]`)!;
    const object = new CSS3DObject(element);
    const back = name === "about";
    object.position.set(back ? 0.55 : -0.55, back ? -0.55 : 0.55, back ? -0.58 : 0.58);
    object.rotation.y = back ? Math.PI : 0;
    // Surface styles render at 2× size, then scale down for crisper 3D text.
    object.scale.setScalar(0.0021);
    cookie.add(object);
    return { name, element, object };
  });
  const facePosition = new Vector3();
  const faceNormal = new Vector3();
  const faceToCamera = new Vector3();
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
  const starCount = 1800;
  const starRadius = 80;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  for (let i = 0; i < starPositions.length; i += 3) {
    // Uniform directions cover the whole sky without clustering at the poles.
    const height = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const ringRadius = Math.sqrt(1 - height * height) * starRadius;
    starPositions[i] = Math.cos(angle) * ringRadius;
    starPositions[i + 1] = height * starRadius;
    starPositions[i + 2] = Math.sin(angle) * ringRadius;
    const brightness = 0.45 + random() * 0.55;
    starColors.set([brightness, brightness, brightness], i);
  }
  starsGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(starPositions, 3),
  );
  starsGeometry.setAttribute("color", new Float32BufferAttribute(starColors, 3));
  const starsMaterial = new PointsMaterial({
    color: "#93baff",
    vertexColors: true,
    size: 1.4,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  const stars = new Points(starsGeometry, starsMaterial);
  scene.add(stars);

  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.65;
  controls.autoRotateSpeed = 0.35;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let paused = reducedMotion.matches;
  let faceHovered = false;
  let faceFocused = false;
  let visible = true;
  let disposed = false;
  let frame = 0;
  let lastTime = 0;
  let baseDistance = 7.4;
  let needsRender = true;
  let entrance: { start: number | null; duration: number; fromY: number } | null = reducedMotion.matches
    ? null
    : { start: null, duration: 850, fromY: 0 };
  let destination: Destination = "home";
  let leaving: {
    start: number;
    duration: number;
    fromPosition: Vector3;
    toPosition: Vector3;
    fromTarget: Vector3;
    toTarget: Vector3;
    mode: "zoom" | "out";
    fromChips: number[];
  } | null = null;
  let exitTimer: number | undefined;
  let flight: {
    start: number;
    duration: number;
    fromPosition: Vector3;
    toPosition: Vector3;
    fromTarget: Vector3;
    toTarget: Vector3;
    fromUp: Vector3;
    toUp: Vector3;
    arc: Quaternion;
    fromCookie: Quaternion;
    toCookie: Quaternion;
    fromChips: number[];
    toChips: number[];
  } | null = null;
  const flightRotation = new Quaternion();
  const flightDirection = new Vector3();

  function requestRender() {
    needsRender = true;
  }
  function fadeChips(from: number[], to: number[], progress: number) {
    const eased = progress * progress * (3 - 2 * progress);
    chipFades.forEach((batch, index) => {
      batch.opacity = from[index] + (to[index] - from[index]) * eased;
      const alpha = Math.round(batch.opacity * 255);
      if (batch.data[1] === alpha) return;
      batch.data[1] = alpha;
      batch.texture.needsUpdate = true;
      batch.mesh.visible = alpha > 0;
      renderer.shadowMap.needsUpdate = true;
      requestRender();
    });
  }

  function updateMotion() {
    controls.autoRotate = !paused && !faceHovered && !faceFocused && destination === "home" && !flight && !leaving && !entrance;
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
    const zoomRatio = camera.position.distanceTo(controls.target) / baseDistance;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    baseDistance = 7.4 / Math.min(camera.aspect, 1);
    controls.minDistance = baseDistance * 0.7;
    controls.maxDistance = baseDistance * 1.6;
    if (destination === "home" && !flight) {
      camera.position.sub(controls.target).setLength(baseDistance * zoomRatio).add(controls.target);
    }
    if (entrance && entrance.start === null) {
      // Start the whole cookie, including its HTML buttons, below the viewport.
      entrance.fromY = -camera.position.distanceTo(controls.target) * Math.tan((camera.fov * Math.PI) / 360) - 2.4;
      cookie.position.y = entrance.fromY;
    }
    renderer.setSize(width, height, false);
    htmlRenderer.setSize(width, height);
    requestRender();
    if (leaving) return;
    if (destination !== "home" || flight) flyTo(destination, true);
    else controls.update(0);
  }
  function zoom(factor: number) {
    if (destination !== "home" || flight) return;
    camera.position.sub(controls.target).setLength(
      Math.max(
        controls.minDistance,
        Math.min(controls.maxDistance, camera.position.length() * factor),
      ),
    ).add(controls.target);
    controls.update(0);
  }
  function reset() {
    flyTo("home");
  }
  function finishEntrance() {
    if (!entrance) return;
    entrance = null;
    cookie.position.y = 0;
    delete host.dataset.entering;
    renderer.shadowMap.needsUpdate = true;
    updateMotion();
    requestRender();
  }
  function finishFlight() {
    flight = null;
    delete host.dataset.traveling;
    controls.enabled = destination === "home";
    controls.enableDamping = true;
    updateMotion();
    announcement.textContent = destination === "home"
      ? "Back at the whole cookie. Choose Writing or About to explore."
      : `${destination === "writing" ? "Writing" : "About"}. You have arrived on the cookie’s surface. Press Escape to fly back.`;
    // Render visibility before moving keyboard focus into the destination.
    renderScene();
    const focusTarget = destination === "home"
      ? face.querySelector<HTMLButtonElement>("button")
      : surfaces.find((surface) => surface.name === destination)?.element.querySelector<HTMLElement>("h2");
    focusTarget?.focus({ preventScroll: true });
    requestRender();
  }
  function flyTo(next: Destination, immediate = false) {
    finishEntrance();
    faceHovered = false;
    faceFocused = false;
    // Flush any remaining orbit damping before taking over the camera.
    controls.autoRotate = false;
    controls.enableDamping = false;
    if (controls.enabled) controls.update(0);
    controls.enabled = false;
    paused = true;
    destination = next;
    host.dataset.destination = next;
    host.dataset.traveling = "true";
    announcement.textContent = next === "home" ? "Flying back to the whole cookie." : `Flying to ${next === "writing" ? "Writing" : "About"}.`;
    returnButton.hidden = next === "home";
    hint.textContent = next === "home"
      ? "Pick a place to fly to · Drag to explore"
      : `${next === "writing" ? "01 / Writing" : "02 / About"} · Escape to fly back`;
    buttons.forEach((button) => {
      button.disabled = next !== "home" && button.dataset.cookieAction !== "reset";
    });
    const toTarget = new Vector3();
    const toPosition = new Vector3(0, 0.05, baseDistance);
    const toUp = new Vector3(0, 1, 0);
    if (next !== "home") {
      const surface = surfaces.find((entry) => entry.name === next)!;
      surface.element.hidden = false;
      surface.element.style.display = "";
      surface.object.getWorldPosition(toTarget);
      const normal = new Vector3(0, 0, 1).transformDirection(surface.object.matrixWorld);
      toUp.set(0, 1, 0).transformDirection(surface.object.matrixWorld);
      const tanFov = Math.tan((camera.fov * Math.PI) / 360);
      const width = surface.element.offsetWidth * surface.object.scale.x;
      const height = surface.element.offsetHeight * surface.object.scale.y;
      const distance = Math.max(height / (2 * tanFov * 0.78), width / (2 * tanFov * camera.aspect * 0.8), 2.5);
      toPosition.copy(toTarget).addScaledVector(normal, distance);
    }
    flight = {
      start: performance.now(),
      duration: immediate || reducedMotion.matches ? 0 : 1700,
      fromPosition: camera.position.clone(),
      toPosition,
      fromTarget: controls.target.clone(),
      toTarget,
      fromUp: camera.up.clone(),
      toUp,
      arc: new Quaternion().setFromUnitVectors(camera.position.clone().normalize(), toPosition.clone().normalize()),
      fromCookie: cookie.quaternion.clone(),
      toCookie: next === "home" ? homeRotation.clone() : cookie.quaternion.clone(),
      fromChips: chipFades.map((batch) => batch.opacity),
      toChips: chipFades.map((batch) => batch.name === next ? 0 : 1),
    };
    updateMotion();
    if (flight.duration === 0) {
      camera.position.copy(toPosition);
      camera.up.copy(toUp);
      controls.target.copy(toTarget);
      camera.lookAt(toTarget);
      cookie.quaternion.copy(flight.toCookie);
      fadeChips(flight.fromChips, flight.toChips, 1);
      renderer.shadowMap.needsUpdate = true;
      finishFlight();
    }
    requestRender();
  }
  function onAction(event: Event) {
    finishEntrance();
    const link = (event.target as Element).closest<HTMLAnchorElement>("a[data-cookie-exit]");
    if (link) {
      const click = event as MouseEvent;
      // Preserve ordinary link behavior for new tabs, downloads and reduced motion.
      if (event.defaultPrevented || click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey ||
        (link.target && link.target !== "_self") || link.hasAttribute("download") || reducedMotion.matches) return;
      const url = new URL(link.href);
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      if (!leaving) exitTo(url.href, link);
      return;
    }
    if (leaving) return;
    const travelButton = (event.target as Element).closest<HTMLButtonElement>("[data-cookie-destination]");
    if (travelButton) {
      const next = travelButton.dataset.cookieDestination;
      if (next === "home" || next === "writing" || next === "about") flyTo(next);
      return;
    }
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
    finishEntrance();
    if (destination !== "home" || flight) return;
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
    finishEntrance();
    paused = true;
    updateMotion();
  }
  function onFacePointerEnter() {
    faceHovered = true;
    updateMotion();
    requestRender();
  }
  function onFacePointerLeave() {
    faceHovered = false;
    updateMotion();
    requestRender();
  }
  function onFaceFocusIn() {
    faceFocused = true;
    updateMotion();
    requestRender();
  }
  function onFaceFocusOut(event: FocusEvent) {
    if (event.relatedTarget instanceof Node && face.contains(event.relatedTarget)) return;
    faceFocused = false;
    updateMotion();
    requestRender();
  }
  function renderFace() {
    for (const { object, element, active } of [
      { object: faceObject, element: face, active: destination === "home" && !flight },
      ...surfaces.map((surface) => ({ ...surface, active: destination === surface.name })),
    ]) {
      object.getWorldPosition(facePosition);
      faceNormal.set(0, 0, 1).transformDirection(object.matrixWorld);
      faceToCamera.copy(camera.position).sub(facePosition).normalize();
      // HTML has no WebGL depth buffer: hide it before the surface turns away.
      object.visible = active && faceNormal.dot(faceToCamera) > 0.35;
      element.inert = !object.visible || !!flight || !!entrance;
      element.hidden = !object.visible;
    }
    htmlRenderer.render(scene, camera);
  }
  function renderScene() {
    // A distant sky follows camera translation, keeping its directions and size
    // stable while the cookie moves closer or the camera flies around it.
    stars.position.copy(camera.position);
    renderer.render(scene, camera);
    renderFace();
  }
  function exitTo(href: string, link: HTMLAnchorElement) {
    controls.enabled = false;
    controls.autoRotate = false;
    const zoomIn = link.dataset.cookieExit === "zoom";
    const direction = camera.position.clone().sub(controls.target).normalize();
    const toTarget = controls.target.clone();
    if (zoomIn) {
      // Aim at the selected post's screen position on the HTML surface plane.
      const surface = surfaces.find((entry) => entry.name === destination)!;
      const bounds = viewport.getBoundingClientRect();
      const postBounds = link.getBoundingClientRect();
      const ray = new Vector3(
        ((postBounds.left + postBounds.width / 2 - bounds.left) / bounds.width) * 2 - 1,
        1 - ((postBounds.top + postBounds.height / 2 - bounds.top) / bounds.height) * 2,
        0.5,
      ).unproject(camera).sub(camera.position).normalize();
      const normal = new Vector3(0, 0, 1).transformDirection(surface.object.matrixWorld);
      surface.object.getWorldPosition(toTarget);
      const distance = toTarget.clone().sub(camera.position).dot(normal) / ray.dot(normal);
      toTarget.copy(camera.position).addScaledVector(ray, distance);
    }
    const toPosition = zoomIn
      ? toTarget.clone().addScaledVector(direction, camera.position.distanceTo(controls.target) * 0.55)
      : camera.position.clone().addScaledVector(direction, 1.35);
    leaving = {
      start: performance.now(),
      duration: zoomIn ? 560 : 480,
      fromPosition: camera.position.clone(),
      toPosition,
      fromTarget: controls.target.clone(),
      toTarget,
      mode: zoomIn ? "zoom" : "out",
      fromChips: chipFades.map((batch) => batch.opacity),
    };
    host.dataset.leaving = leaving.mode;
    host.setAttribute("aria-busy", "true");
    viewport.inert = true;
    returnButton.disabled = true;
    buttons.forEach((button) => { button.disabled = true; });
    announcement.textContent = zoomIn ? "Opening the article." : `Opening ${destination === "writing" ? "Writing" : "About"}.`;
    // A timer completes navigation even if the tab stops receiving animation frames.
    exitTimer = window.setTimeout(() => window.location.assign(href), leaving.duration);
    requestRender();
  }
  function cancelExit() {
    if (!leaving) return;
    window.clearTimeout(exitTimer);
    camera.position.copy(leaving.fromPosition);
    controls.target.copy(leaving.fromTarget);
    camera.lookAt(controls.target);
    fadeChips(leaving.fromChips, leaving.fromChips, 1);
    leaving = null;
    viewport.style.opacity = "";
    viewport.inert = false;
    delete host.dataset.leaving;
    host.removeAttribute("aria-busy");
    announcement.textContent = "Back on the cookie. Choose a link to continue exploring.";
    returnButton.disabled = false;
    buttons.forEach((button) => {
      button.disabled = destination !== "home" && button.dataset.cookieAction !== "reset";
    });
    controls.enabled = destination === "home";
    updateMotion();
    requestRender();
  }
  function onPageShow(event: PageTransitionEvent) {
    if (event.persisted) cancelExit();
  }
  function onPageHide(event: PageTransitionEvent) {
    if (event.persisted) window.clearTimeout(exitTimer);
    else dispose();
  }
  function onEscape(event: KeyboardEvent) {
    if (event.key === "Escape" && leaving) {
      event.preventDefault();
      cancelExit();
      return;
    }
    if (event.key === "Escape" && (destination !== "home" || flight)) {
      event.preventDefault();
      flyTo("home");
    }
  }
  function onMotionPreference() {
    paused = reducedMotion.matches;
    if (reducedMotion.matches) finishEntrance();
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
      if (entrance) {
        entrance.start ??= time;
        const progress = Math.min((time - entrance.start) / entrance.duration, 1);
        const eased = 1 - (1 - progress) ** 3;
        cookie.position.y = entrance.fromY * (1 - eased);
        renderer.shadowMap.needsUpdate = true;
        requestRender();
        if (progress === 1) finishEntrance();
      }
      if (leaving) {
        const progress = Math.max(0, Math.min((time - leaving.start) / leaving.duration, 1));
        const eased = 1 - (1 - progress) ** 3;
        camera.position.lerpVectors(leaving.fromPosition, leaving.toPosition, eased);
        controls.target.lerpVectors(leaving.fromTarget, leaving.toTarget, eased);
        camera.lookAt(controls.target);
        if (leaving.mode === "out") fadeChips(leaving.fromChips, chipFades.map(() => 1), eased);
        const fade = leaving.mode === "zoom" ? Math.max(0, (progress - 0.4) / 0.6) : progress;
        viewport.style.opacity = String(1 - fade * fade);
        requestRender();
      }
      if (flight) {
        const progress = Math.max(0, Math.min((time - flight.start) / flight.duration, 1));
        const eased = progress * progress * (3 - 2 * progress);
        fadeChips(flight.fromChips, flight.toChips, Math.min(progress * 1.8, 1));
        flightRotation.identity().slerp(flight.arc, eased);
        flightDirection.copy(flight.fromPosition).normalize().applyQuaternion(flightRotation);
        const radius = flight.fromPosition.length() * (1 - eased) + flight.toPosition.length() * eased;
        camera.position.copy(flightDirection).multiplyScalar(radius + Math.sin(Math.PI * eased) * 1.1);
        controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased);
        camera.up.lerpVectors(flight.fromUp, flight.toUp, eased).normalize();
        camera.lookAt(controls.target);
        if (destination === "home") {
          cookie.quaternion.slerpQuaternions(flight.fromCookie, flight.toCookie, eased);
          renderer.shadowMap.needsUpdate = true;
        }
        requestRender();
        if (progress === 1) finishFlight();
      }
      const changed = controls.enabled && controls.update(
        lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0,
      );
      if (changed || needsRender) {
        renderScene();
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
  document.addEventListener("keydown", onEscape);
  canvas.addEventListener("keydown", onKey);
  face.addEventListener("pointerenter", onFacePointerEnter);
  face.addEventListener("pointerleave", onFacePointerLeave);
  face.addEventListener("focusin", onFaceFocusIn);
  face.addEventListener("focusout", onFaceFocusOut);
  controls.addEventListener("start", onStart);
  controls.addEventListener("change", requestRender);
  reducedMotion.addEventListener("change", onMotionPreference);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("pagehide", onPageHide);

  function dispose() {
    if (disposed) return;
    cancelExit();
    disposed = true;
    delete host.dataset.entering;
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    themeObserver.disconnect();
    visibilityObserver.disconnect();
    host.removeEventListener("click", onAction);
    document.removeEventListener("keydown", onEscape);
    canvas.removeEventListener("keydown", onKey);
    face.removeEventListener("pointerenter", onFacePointerEnter);
    face.removeEventListener("pointerleave", onFacePointerLeave);
    face.removeEventListener("focusin", onFaceFocusIn);
    face.removeEventListener("focusout", onFaceFocusOut);
    reducedMotion.removeEventListener("change", onMotionPreference);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("pagehide", onPageHide);
    controls.dispose();
    scene.traverse((object) => {
      if (object instanceof Mesh || object instanceof Points) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => material.dispose());
        if (object instanceof Mesh) object.customDepthMaterial?.dispose();
        if (object instanceof InstancedMesh) object.dispose();
      }
    });
    grainTexture.dispose();
    chipFades.forEach((batch) => batch.texture.dispose());
    sunlight.shadow.dispose();
    renderer.dispose();
    face.hidden = true;
    faceObject.removeFromParent();
    viewport.appendChild(face);
    for (const surface of surfaces) {
      surface.element.hidden = true;
      surface.object.removeFromParent();
      viewport.appendChild(surface.element);
    }
    htmlRenderer.domElement.remove();
  }
  import.meta.hot?.dispose(dispose);
  document.addEventListener("astro:before-swap", dispose, { once: true });
  resize();
  controls.saveState();
  updateMotion();
  updateTheme();
  buttons.forEach((button) => {
    button.disabled = false;
  });
  status.hidden = true;
  face.hidden = false;
  host.dataset.state = "ready";
  if (entrance) host.dataset.entering = "true";
  frame = requestAnimationFrame(animate);
}
