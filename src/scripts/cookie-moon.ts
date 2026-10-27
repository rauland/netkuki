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
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshDepthMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Quaternion,
  Raycaster,
  RepeatWrapping,
  RGBAFormat,
  RGBADepthPacking,
  Scene,
  ShaderChunk,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
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

  const geometry = new SphereGeometry(radius, 192, 144);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const dayColors = new Float32Array(positions.count * 3);
  const surfaceColor = new Color("#b9b9b9");
  const edgeColor = new Color("#707070");
  const daySurfaceColor = new Color("#a0612e");
  const dayEdgeColor = new Color("#633618");
  const dayBackSurfaceColor = new Color("#bd8349");
  const dayBackEdgeColor = new Color("#7b4926");
  const backColor = new Color();
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
    color.copy(daySurfaceColor).lerp(dayEdgeColor, baking);
    // Lift the back's brown palette, blending gently around the edge.
    const backBlend = Math.max(0, Math.min(1, -z / (radius * 0.35)));
    backColor.copy(dayBackSurfaceColor).lerp(dayBackEdgeColor, baking);
    color.lerp(backColor, backBlend * backBlend * (3 - 2 * backBlend));
    dayColors.set([color.r, color.g, color.b], i * 3);
  }
  const cookieColors = new Float32BufferAttribute(colors, 3);
  geometry.setAttribute("color", cookieColors);
  geometry.computeVertexNormals();

  // Retain the coarse grain and random sequence so existing chip placement stays stable.
  const grainSize = 256;
  const coarseGrain = new Uint8Array(grainSize * grainSize);
  for (let i = 0; i < coarseGrain.length; i++) {
    const x = i % grainSize,
      y = Math.floor(i / grainSize);
    coarseGrain[i] = 105 + random() * 95 + noise.noise(x / 13, y / 13, 3) * 40;
  }
  const textureSize = 1024;
  const grainData = new Uint8Array(textureSize * textureSize * 4);
  const crumbData = new Uint8Array(textureSize * textureSize * 4);
  const longitudeCos = new Float32Array(textureSize);
  const longitudeSin = new Float32Array(textureSize);
  for (let x = 0; x < textureSize; x++) {
    const angle = (x / (textureSize - 1)) * Math.PI * 2;
    longitudeCos[x] = Math.cos(angle);
    longitudeSin[x] = Math.sin(angle);
  }
  for (let y = 0; y < textureSize; y++) {
    const latitude = (y / (textureSize - 1)) * Math.PI;
    const ring = Math.sin(latitude) * radius;
    const sy = -Math.cos(latitude) * radius;
    const grainY = (y / (textureSize - 1)) * grainSize;
    const y0 = Math.floor(grainY) % grainSize;
    const y1 = (y0 + 1) % grainSize;
    const fy = grainY - Math.floor(grainY);
    for (let x = 0; x < textureSize; x++) {
      // Sample on the original sphere to keep the fine relief continuous at the UV seam.
      const sx = -longitudeCos[x] * ring;
      const sz = longitudeSin[x] * ring;
      const crumb = noise.noise(sx * 21, sy * 21, sz * 21);
      const fine = noise.noise(sx * 73, sy * 73, sz * 73);
      const pores = Math.max(0, noise.noise(sx * 42 + 17, sy * 42, sz * 42) - 0.12);
      const crackField = noise.noise(sx * 5.4 + crumb * 0.16, sy * 5.4, sz * 5.4);
      const crackMask = Math.max(0, noise.noise(sx * 1.7 + 8, sy * 1.7, sz * 1.7));
      const cracks = Math.max(0, 1 - Math.abs(crackField) * 22) ** 2 * crackMask;
      const grainX = (x / (textureSize - 1)) * grainSize;
      const x0 = Math.floor(grainX) % grainSize;
      const x1 = (x0 + 1) % grainSize;
      const fx = grainX - Math.floor(grainX);
      const row0 = coarseGrain[y0 * grainSize + x0] * (1 - fx) + coarseGrain[y0 * grainSize + x1] * fx;
      const row1 = coarseGrain[y1 * grainSize + x0] * (1 - fx) + coarseGrain[y1 * grainSize + x1] * fx;
      const speckle = (row0 * (1 - fy) + row1 * fy - 150) * 0.2 * (ring / radius);
      const index = (y * textureSize + x) * 4;
      // Build feathered masks; the flight animation controls when they soften the detail.
      const side = sz >= 0 ? 1 : -1;
      const readingX = Math.max(0, Math.min(1, (1.1 - Math.abs(sx + side * 0.55)) / 0.26));
      const readingY = Math.max(0, Math.min(1, (1.16 - Math.abs(sy - side * 0.55)) / 0.25));
      const readingMask = readingX * readingX * (3 - 2 * readingX) * readingY * readingY * (3 - 2 * readingY);
      // Red holds shallow crumb, pores and cracks; green varies the surface roughness.
      grainData[index] = Math.max(0, Math.min(255, 148 + crumb * 28 + fine * 13 + speckle - pores * 95 - cracks * 110));
      grainData[index + 1] = Math.max(0, Math.min(255, 235 + crumb * 18 + pores * 20));
      // The unused channels hold separate reading masks for the front and back.
      grainData[index + 2] = side === 1 ? Math.round(readingMask * 255) : 0;
      grainData[index + 3] = side === -1 ? Math.round(readingMask * 255) : 0;
      // Visible baked flecks complement the relief under the scene's soft lighting.
      const tone = Math.max(110, Math.min(255, 232 + crumb * 34 + fine * 12 - pores * 120 - cracks * 150));
      crumbData[index] = crumbData[index + 1] = crumbData[index + 2] = tone;
      crumbData[index + 3] = 255;
    }
  }
  const grainTexture = new DataTexture(
    grainData,
    textureSize,
    textureSize,
    RGBAFormat,
  );
  const crumbTexture = new DataTexture(crumbData, textureSize, textureSize, RGBAFormat);
  for (const texture of [grainTexture, crumbTexture]) {
    texture.wrapS = RepeatWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
  }
  const biscuit = new Mesh(
    geometry,
    new MeshStandardMaterial({
      vertexColors: true,
      map: crumbTexture,
      // Keep the overall palette while the colour map adds darker pores and cracks.
      color: new Color().setScalar(1 / 0.9),
      roughness: 0.93,
      roughnessMap: grainTexture,
      bumpMap: grainTexture,
      bumpScale: 0.14,
    }),
  );
  // Blend only the reading area's fine detail, leaving the overview fully textured.
  const readingFocus = { value: new Vector2(0, 0) };
  const rainbowStrength = { value: 0 };
  const rainbowPhase = { value: 0 };
  biscuit.material.onBeforeCompile = (shader) => {
    shader.uniforms.cookieReadingFocus = readingFocus;
    shader.uniforms.cookieRainbowStrength = rainbowStrength;
    shader.uniforms.cookieRainbowPhase = rainbowPhase;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 cookiePosition;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\ncookiePosition = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        uniform vec2 cookieReadingFocus;
        uniform float cookieRainbowStrength;
        uniform float cookieRainbowPhase;
        varying vec3 cookiePosition;`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        float cookieHue = cookiePosition.x * 0.2 + cookiePosition.y * 0.15 + cookieRainbowPhase;
        vec3 cookieRainbow = 0.52 + 0.48 * cos(6.2831853 * (cookieHue + vec3(0.0, 0.666667, 0.333333)));
        diffuseColor.rgb = mix(diffuseColor.rgb, cookieRainbow * sampledDiffuseColor.rgb, cookieRainbowStrength);`)
      .replace("#include <map_fragment>", ShaderChunk.map_fragment.replace(
        "diffuseColor *= sampledDiffuseColor;",
        `float cookieColourMix = 0.96 * dot(texture2D(bumpMap, vMapUv).ba, cookieReadingFocus);
         sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(223.0 / 255.0), cookieColourMix);
         diffuseColor *= sampledDiffuseColor;`,
      ))
      .replace("#include <bumpmap_pars_fragment>", ShaderChunk.bumpmap_pars_fragment.replace(
        "return vec2( dBx, dBy );",
        `float cookieBumpMix = 0.96 * dot(texture2D(bumpMap, vBumpMapUv).ba, cookieReadingFocus);
         return vec2(dBx, dBy) * (1.0 - cookieBumpMix);`,
      ))
      .replace("#include <roughnessmap_fragment>", ShaderChunk.roughnessmap_fragment.replace(
        "roughnessFactor *= texelRoughness.g;",
        `float cookieRoughnessMix = 0.96 * dot(texelRoughness.ba, cookieReadingFocus);
         roughnessFactor *= mix(texelRoughness.g, 235.0 / 255.0, cookieRoughnessMix);`,
      ));
  };
  biscuit.castShadow = biscuit.receiveShadow = true;
  cookie.add(biscuit);

  const chipGeometry = new IcosahedronGeometry(1, 2);
  const chipPositions = chipGeometry.getAttribute("position");
  for (let i = 0; i < chipPositions.count; i++) {
    const x = chipPositions.getX(i),
      y = chipPositions.getY(i),
      z = chipPositions.getZ(i);
    const shape = 1 + noise.noise(x * 4, y * 4, z * 4) * 0.22 + noise.noise(x * 17, y * 17, z * 17) * 0.035;
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
  const chocolateMaterials: MeshStandardMaterial[] = [];
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
    const material = new MeshStandardMaterial({
      color: "#292929",
      roughness: 0.85,
      roughnessMap: grainTexture,
      bumpMap: grainTexture,
      bumpScale: 0.004,
      alphaMap: texture,
      transparent: !!texture,
      depthWrite: !texture,
    });
    chocolateMaterials.push(material);
    const chocolate = new InstancedMesh(chipGeometry, material, indices.length);
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
  function setPalette(dark: boolean) {
    cookieColors.copyArray(dark ? colors : dayColors);
    cookieColors.needsUpdate = true;
    chocolateMaterials.forEach((material) => material.color.set(dark ? "#292929" : "#2b130b"));
  }
  function setReadingFocus(front: number, back: number) {
    readingFocus.value.set(front, back);
  }
  function setRainbow(strength: number, phase: number) {
    rainbowStrength.value = strength;
    rainbowPhase.value = phase;
  }
  // A back chip beside the About paragraph stays clear of the return button and text.
  const secretIndex = chips.reduce((best, chip, index) => {
    if (chip.z >= 0 || chipRegions[index] !== "rim") return best;
    return best < 0 || Math.hypot(chip.x + 0.85, chip.y + 0.31) <
      Math.hypot(chips[best].x + 0.85, chips[best].y + 0.31) ? index : best;
  }, -1);
  const secretChip = chipSlots.get(secretIndex)!;
  return { cookie, grainTexture, crumbTexture, chipFades, setPalette, setReadingFocus, setRainbow, secretChip };
}

export function mountCookieMoon(host: HTMLElement) {
  const canvas = host.querySelector<HTMLCanvasElement>("canvas")!;
  const viewport = host.querySelector<HTMLElement>("[data-cookie-viewport]")!;
  const face = host.querySelector<HTMLElement>("[data-cookie-face]")!;
  const returnButton = host.querySelector<HTMLButtonElement>(".cookie-return")!;
  const announcement = host.querySelector<HTMLElement>("[data-cookie-announcement]")!;
  const hint = host.querySelector<HTMLElement>("[data-cookie-hint]")!;
  const bottomBar = host.querySelector<HTMLElement>(".cookie-bottom-bar")!;
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
  const { cookie, grainTexture, crumbTexture, chipFades, setPalette, setReadingFocus, setRainbow, secretChip } = makeCookie();
  for (const texture of [grainTexture, crumbTexture]) {
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  }
  const homeRotation = cookie.quaternion.clone();
  scene.add(cookie);
  // Keep real links attached to the cookie in the same coordinate system.
  const htmlRenderer = new CSS3DRenderer();
  htmlRenderer.domElement.className = "cookie-html";
  viewport.appendChild(htmlRenderer.domElement);
  const faceObject = new CSS3DObject(face);
  faceObject.position.set(0, 0, 0.6);
  // The button styles render at 2× size for sharper text in the 3D view.
  faceObject.scale.setScalar(0.00475);
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
  let orbitPaused = reducedMotion.matches;
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
  let rainbowStart: number | null = null;
  let rainbowTimer: number | undefined;
  let chipPress: { id: number; x: number; y: number; dragged: boolean } | null = null;
  const chipRaycaster = new Raycaster();
  const chipPointer = new Vector2();
  const cookieMeshes = cookie.children.filter((object) => object instanceof Mesh);
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
    sideOrbit: {
      center: Vector3;
      axis: Vector3;
      fromDirection: Vector3;
      angle: number;
      fromRadius: number;
      toRadius: number;
      fromHeight: number;
      toHeight: number;
    } | null;
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
  function endRainbow() {
    rainbowStart = null;
    setRainbow(0, 0);
    delete host.dataset.rainbow;
    requestRender();
  }
  function updateRainbow(time: number) {
    if (rainbowStart === null) return;
    const elapsed = Math.max(0, time - rainbowStart);
    if (elapsed >= 10000) {
      endRainbow();
      return;
    }
    const blend = Math.min(elapsed / 300, (10000 - elapsed) / 600, 1);
    setRainbow(blend * blend * (3 - 2 * blend), reducedMotion.matches ? 0 : elapsed / 4000);
    requestRender();
  }
  function isSecretChip(event: PointerEvent) {
    if (flight || entrance || leaving) return false;
    const bounds = canvas.getBoundingClientRect();
    chipPointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      1 - ((event.clientY - bounds.top) / bounds.height) * 2,
    );
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    chipRaycaster.setFromCamera(chipPointer, camera);
    // Pick the nearest visible surface, so the biscuit blocks clicks from the front.
    const hit = chipRaycaster.intersectObjects(cookieMeshes.filter((mesh) => mesh.visible), false)[0];
    return hit?.object === secretChip.mesh && hit.instanceId === secretChip.index;
  }
  function onChipPointerDown(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0) {
      chipPress = null;
      return;
    }
    chipPress = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
  }
  function onChipPointerMove(event: PointerEvent) {
    if (chipPress && Math.hypot(event.clientX - chipPress.x, event.clientY - chipPress.y) > 6) {
      chipPress.dragged = true;
    }
  }
  function onChipPointerCancel() {
    chipPress = null;
  }
  function onChipPointerUp(event: PointerEvent) {
    const press = chipPress;
    chipPress = null;
    if (!press || press.id !== event.pointerId || press.dragged ||
      Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6 || !isSecretChip(event)) return;
    rainbowStart = performance.now();
    window.clearTimeout(rainbowTimer);
    rainbowTimer = window.setTimeout(endRainbow, 10000);
    host.dataset.rainbow = "true";
    announcement.textContent = "You found the rainbow cookie! Rainbow colours for ten seconds.";
    requestRender();
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
    setReadingFocus(
      1 - chipFades.find((batch) => batch.name === "writing")!.opacity,
      1 - chipFades.find((batch) => batch.name === "about")!.opacity,
    );
  }

  function updateMotion() {
    host.dataset.motion = orbitPaused ? "paused" : "playing";
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
    const changingSides = destination !== "home" && next !== "home" && destination !== next;
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
      : `${next === "writing" ? "Writing" : "About"} · Escape to fly back`;
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
      // Keep the reading panel between the floating return button and hint,
      // while the cookie itself still fills the entire canvas behind them.
      const bounds = viewport.getBoundingClientRect();
      const top = Math.max(12, returnButton.getBoundingClientRect().bottom - bounds.top + 12);
      const bottom = Math.min(bounds.height - 12, bottomBar.getBoundingClientRect().top - bounds.top - 12);
      const availableHeight = Math.max(1, bottom - top);
      surface.element.style.maxHeight = "";
      const style = getComputedStyle(surface.element);
      const naturalMaxHeight = parseFloat(style.maxHeight);
      const minimumScale = Math.min(bounds.width * 0.8 / surface.element.offsetWidth, 14 / parseFloat(style.fontSize));
      // On shorter screens, scroll the panel rather than shrinking its text indefinitely.
      surface.element.style.maxHeight = `${Math.min(naturalMaxHeight, availableHeight / minimumScale)}px`;
      const width = surface.element.offsetWidth * surface.object.scale.x;
      const height = surface.element.offsetHeight * surface.object.scale.y;
      const distance = Math.max(height / (2 * tanFov * (availableHeight / bounds.height)), width / (2 * tanFov * camera.aspect * 0.8), 2.5);
      const centerOffset = (top + availableHeight / 2) / bounds.height - 0.5;
      toTarget.addScaledVector(toUp, centerOffset * 2 * tanFov * distance);
      toPosition.copy(toTarget).addScaledVector(normal, distance);
    }
    let sideOrbit = null;
    if (changingSides) {
      // Opposite faces need a side-on orbit, not the shortest arc over a pole.
      // Keeping the cookie's up axis fixed also prevents lookAt from rolling.
      const center = cookie.getWorldPosition(new Vector3());
      const axis = new Vector3(0, 1, 0).applyQuaternion(cookie.quaternion).normalize();
      const fromRadial = camera.position.clone().sub(center);
      const toRadial = toPosition.clone().sub(center);
      const fromHeight = fromRadial.dot(axis);
      const toHeight = toRadial.dot(axis);
      fromRadial.addScaledVector(axis, -fromHeight);
      toRadial.addScaledVector(axis, -toHeight);
      const fromRadius = fromRadial.length();
      const toRadius = toRadial.length();
      fromRadial.normalize();
      toRadial.normalize();
      let angle = Math.atan2(axis.dot(new Vector3().crossVectors(fromRadial, toRadial)), fromRadial.dot(toRadial));
      if (Math.abs(Math.abs(angle) - Math.PI) < 0.001) angle = next === "about" ? Math.PI : -Math.PI;
      sideOrbit = { center, axis, fromDirection: fromRadial, angle, fromRadius, toRadius, fromHeight, toHeight };
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
      sideOrbit,
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
        orbitPaused = paused;
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
        orbitPaused = paused;
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
    orbitPaused = reducedMotion.matches;
    if (reducedMotion.matches) finishEntrance();
    updateMotion();
  }
  function updateTheme() {
    const dark = document.documentElement.classList.contains("dark");
    setPalette(dark);
    ambient.intensity = dark ? 1.65 : 2.2;
    rim.intensity = dark ? 3.5 : 1.6;
    sunlight.intensity = dark ? 3.2 : 2.8;
    stars.visible = dark;
    starsMaterial.opacity = 0.55;
    requestRender();
  }
  function animate(time: number) {
    if (disposed) return;
    if (visible && !document.hidden) {
      updateRainbow(time);
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
        if (flight.sideOrbit) {
          const orbit = flight.sideOrbit;
          const radius = orbit.fromRadius * (1 - eased) + orbit.toRadius * eased;
          const height = orbit.fromHeight * (1 - eased) + orbit.toHeight * eased;
          flightDirection.copy(orbit.fromDirection).applyAxisAngle(orbit.axis, orbit.angle * eased);
          camera.position.copy(orbit.center)
            .addScaledVector(flightDirection, radius + Math.sin(Math.PI * eased) * 0.35)
            .addScaledVector(orbit.axis, height);
          camera.up.copy(orbit.axis);
        } else {
          flightRotation.identity().slerp(flight.arc, eased);
          flightDirection.copy(flight.fromPosition).normalize().applyQuaternion(flightRotation);
          const radius = flight.fromPosition.length() * (1 - eased) + flight.toPosition.length() * eased;
          camera.position.copy(flightDirection).multiplyScalar(radius + Math.sin(Math.PI * eased) * 1.1);
          camera.up.lerpVectors(flight.fromUp, flight.toUp, eased).normalize();
        }
        controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased);
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
  canvas.addEventListener("pointerdown", onChipPointerDown);
  canvas.addEventListener("pointermove", onChipPointerMove);
  canvas.addEventListener("pointerup", onChipPointerUp);
  canvas.addEventListener("pointercancel", onChipPointerCancel);
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
    window.clearTimeout(rainbowTimer);
    delete host.dataset.rainbow;
    delete host.dataset.entering;
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    themeObserver.disconnect();
    visibilityObserver.disconnect();
    host.removeEventListener("click", onAction);
    document.removeEventListener("keydown", onEscape);
    canvas.removeEventListener("keydown", onKey);
    canvas.removeEventListener("pointerdown", onChipPointerDown);
    canvas.removeEventListener("pointermove", onChipPointerMove);
    canvas.removeEventListener("pointerup", onChipPointerUp);
    canvas.removeEventListener("pointercancel", onChipPointerCancel);
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
    crumbTexture.dispose();
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
