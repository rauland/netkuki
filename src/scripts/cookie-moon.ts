import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  Euler,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Points,
  PointLight,
  PointsMaterial,
  Quaternion,
  Raycaster,
  RepeatWrapping,
  RGBAFormat,
  RGBADepthPacking,
  Scene,
  ShaderChunk,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";
import { CSS3DObject, CSS3DRenderer } from "three/addons/renderers/CSS3DRenderer.js";
import { DecalGeometry } from "three/addons/geometries/DecalGeometry.js";

// A fixed seed keeps the same cookie when a reader returns or changes theme.
// How far each reading panel sits from the middle. The back one stays closer in:
// its text runs into the corner that the cookie's curve pulls away from.
const surfaceOffset = (side: number) => side * (side === 1 ? 0.55 : 0.35);

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
      const readingX = Math.max(0, Math.min(1, (1.1 - Math.abs(sx + surfaceOffset(side))) / 0.26));
      const readingY = Math.max(0, Math.min(1, (1.16 - Math.abs(sy - surfaceOffset(side))) / 0.25));
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
    const onText = Math.abs(chip.x + surfaceOffset(side)) < 1.08 && Math.abs(chip.y - surfaceOffset(side)) < 1.15;
    return onText ? (side === 1 ? "writing" : "about") : "rim";
  }) as ("rim" | "writing" | "about" | "treat")[];
  // Five chips that twinkle, two on the front and three round the back. Tapping all
  // five turns the cookie rainbow. They stay off the reading panels and clear of the
  // printed lettering (these areas follow the lettering in mountCookieMoon).
  const flagKeepOut = [
    { side: 1, left: -1.05, right: 0.35, top: 0.25, bottom: -0.35 },
    { side: -1, left: -0.1, right: 1.3, top: 0.25, bottom: -0.35 },
  ];
  const treatChips: number[] = [];
  for (const [side, count] of [[1, 2], [-1, 3]] as const) {
    const candidates = chips
      .flatMap((chip, index) => Math.sign(chip.z) === side && chipRegions[index] === "rim" &&
        Math.hypot(chip.x, chip.y) < radius * 0.8 &&
        !flagKeepOut.some((area) => area.side === side &&
          chip.x > area.left && chip.x < area.right && chip.y < area.top && chip.y > area.bottom)
        ? [index] : [])
      .sort((a, b) => chips[b].size - chips[a].size);
    const chosen: number[] = [];
    // Start with the biggest, then take whichever is farthest from those already chosen.
    while (chosen.length < count && chosen.length < candidates.length) {
      const spread = (index: number) => Math.min(...chosen.map((other) =>
        Math.hypot(chips[index].x - chips[other].x, chips[index].y - chips[other].y)));
      chosen.push(candidates.filter((index) => !chosen.includes(index))
        .reduce((best, index) => spread(index) > spread(best) ? index : best));
    }
    treatChips.push(...chosen);
  }
  for (const index of treatChips) chipRegions[index] = "treat";
  for (const name of ["rim", "writing", "about", "treat"] as const) {
    const indices = chipRegions.flatMap((region, index) => region === name ? [index] : []);
    const data = new Uint8Array([255, 255, 255, 255]);
    const texture = name === "rim" || name === "treat" ? null : new DataTexture(data, 1, 1, RGBAFormat);
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
    if (texture && (name === "writing" || name === "about")) {
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
  const treats: { mesh: InstancedMesh; index: number; position: Vector3; rotation: Quaternion; scale: Vector3; normal: Vector3 }[] = [];
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
    if (chipRegions[i] === "treat") {
      treats.push({ ...slot, position: position.clone(), rotation: rotation.clone(), scale: scale.clone(), normal: normal.clone() });
    }
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
  return { cookie, grainTexture, crumbTexture, chipFades, setPalette, setReadingFocus, setRainbow, treats };
}

const sprinkleColors = ["#f58ab8", "#6fbcef", "#ffc94d", "#9b87f5", "#ffffff"];

/** A tiny server rack beside the Notes sign, its lights blinking in three rhythms. */
function makeServerRack() {
  const rack = new Group();
  const metal = new MeshStandardMaterial({ color: "#2b313b", metalness: 0.6, roughness: 0.45 });
  const trim = new MeshStandardMaterial({ color: "#4a5361", metalness: 0.6, roughness: 0.4 });
  const lights = ["#3dff8a", "#3dff8a", "#5aa8ff"].map((emissive) =>
    new MeshStandardMaterial({ color: "#0b1410", emissive, emissiveIntensity: 1.6 }));
  const body = new Mesh(new BoxGeometry(0.17, 0.3, 0.13), metal);
  body.position.y = 0.15;
  rack.add(body);
  const unitGeometry = new BoxGeometry(0.15, 0.05, 0.006);
  const lightGeometry = new BoxGeometry(0.012, 0.012, 0.006);
  for (let shelf = 0; shelf < 4; shelf++) {
    const y = 0.06 + shelf * 0.064;
    const unit = new Mesh(unitGeometry, trim);
    unit.position.set(0, y, 0.066);
    rack.add(unit);
    for (let led = 0; led < 3; led++) {
      const light = new Mesh(lightGeometry, lights[(shelf + led) % 3]);
      light.position.set(0.03 + led * 0.02, y, 0.07);
      rack.add(light);
    }
  }
  rack.traverse((object) => {
    if (object instanceof Mesh) object.castShadow = object.receiveShadow = true;
  });
  rack.scale.setScalar(0.8);
  function update(time: number) {
    lights.forEach((light, index) => {
      light.emissiveIntensity = Math.sin(time / (170 + index * 110) + index * 2) > -0.3 ? 1.6 : 0.15;
    });
  }
  /** As the visitor flies in, the lights race and flare brighter. */
  function exit(progress: number, time: number) {
    lights.forEach((light, index) => {
      light.emissiveIntensity = (Math.sin(time / 40 + index * 2) > 0 ? 2 : 0.6) + progress * 4;
    });
  }
  return { group: rack, update, exit, reset: () => {} };
}

/** A little rocket beside the About sign, like the one on the Fly buttons. */
function makeRocket() {
  const rocket = new Group();
  const hull = new MeshStandardMaterial({ color: "#eef1f6", metalness: 0.3, roughness: 0.35 });
  const accent = new MeshStandardMaterial({ color: "#2563b8", metalness: 0.2, roughness: 0.4 });
  const dark = new MeshStandardMaterial({ color: "#2b313b", metalness: 0.6, roughness: 0.45 });
  const glass = new MeshStandardMaterial({ color: "#9cc8ff", emissive: "#3b7bd6", emissiveIntensity: 0.6, roughness: 0.15 });
  const body = new Mesh(new CylinderGeometry(0.045, 0.05, 0.22, 24), hull);
  body.position.y = 0.16;
  const nose = new Mesh(new ConeGeometry(0.045, 0.1, 24), accent);
  nose.position.y = 0.32;
  const nozzle = new Mesh(new CylinderGeometry(0.03, 0.038, 0.04, 20), dark);
  nozzle.position.y = 0.04;
  const porthole = new Mesh(new CylinderGeometry(0.018, 0.018, 0.012, 20), glass);
  porthole.rotation.x = Math.PI / 2;
  porthole.position.set(0, 0.2, 0.046);
  rocket.add(body, nose, nozzle, porthole);
  const finGeometry = new BoxGeometry(0.006, 0.09, 0.05);
  for (let fin = 0; fin < 3; fin++) {
    const angle = (fin / 3) * Math.PI * 2 + Math.PI / 3;
    const mesh = new Mesh(finGeometry, accent);
    mesh.position.set(Math.sin(angle) * 0.06, 0.08, Math.cos(angle) * 0.06);
    mesh.rotation.y = angle;
    rocket.add(mesh);
  }
  rocket.traverse((object) => {
    if (object instanceof Mesh) object.castShadow = object.receiveShadow = true;
  });
  // The engine only lights for a launch.
  const flame = new Group();
  const outer = new Mesh(
    new ConeGeometry(0.045, 0.24, 16),
    new MeshBasicMaterial({ color: "#ff9d3c", transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }),
  );
  const inner = new Mesh(
    new ConeGeometry(0.022, 0.13, 12),
    new MeshBasicMaterial({ color: "#fff3cf", toneMapped: false }),
  );
  // The group is flipped below, so these offsets push the cones down out of the nozzle.
  outer.position.y = 0.12;
  inner.position.y = 0.065;
  flame.add(outer, inner);
  flame.rotation.x = Math.PI;
  flame.position.y = 0.02;
  flame.visible = false;
  rocket.add(flame);
  // An orange glow from the engine lights the dough and the smoke. It always exists,
  // at zero when unlit, so turning it on never makes the scene recompile its shaders.
  const glow = new PointLight("#ff8a3d", 0, 1.4, 2);
  glow.position.y = -0.04;
  rocket.add(glow);
  function exit(progress: number, time: number) {
    flame.visible = true;
    const flicker = Math.sin(time / 23) * 0.5 + Math.sin(time / 9) * 0.5;
    flame.scale.set(1 + flicker * 0.08, 0.8 + Math.min(progress * 3, 1) * 0.6 + flicker * 0.2, 1 + flicker * 0.08);
    glow.intensity = 2.5 + flicker * 0.8;
  }
  function reset() {
    flame.visible = false;
    glow.intensity = 0;
  }
  return { group: rocket, update: (_time: number) => {}, exit, reset };
}

/** A frosted donut planet, tilted so its icing and hole catch the light. */
function makeDonut(random: () => number) {
  const donut = new Group();
  const dough = new Mesh(
    new TorusGeometry(0.17, 0.08, 20, 40),
    new MeshStandardMaterial({ color: "#d8924e", roughness: 0.75 }),
  );
  // A flattened, slightly raised torus covers the top half like poured icing.
  const icing = new Mesh(
    new TorusGeometry(0.17, 0.083, 20, 40),
    new MeshStandardMaterial({ color: "#f79cc3", roughness: 0.38 }),
  );
  icing.scale.z = 0.62;
  icing.position.z = 0.032;
  donut.add(dough, icing);
  const sprinkleGeometry = new CapsuleGeometry(0.009, 0.034, 3, 6);
  for (let i = 0; i < 18; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 0.17 + (random() - 0.5) * 0.09;
    const sprinkle = new Mesh(
      sprinkleGeometry,
      new MeshStandardMaterial({ color: sprinkleColors[i % sprinkleColors.length], roughness: 0.5 }),
    );
    sprinkle.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.083);
    sprinkle.rotation.set(Math.PI / 2, random() * Math.PI, 0);
    donut.add(sprinkle);
  }
  return donut;
}

/** A pistachio macaron moon: two domed shells around a cream filling. */
function makeMacaron() {
  const macaron = new Group();
  const shellMaterial = new MeshStandardMaterial({ color: "#a8dcb8", roughness: 0.62 });
  const shellGeometry = new SphereGeometry(0.17, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const footGeometry = new CylinderGeometry(0.168, 0.162, 0.026, 32);
  for (const side of [1, -1]) {
    const shell = new Mesh(shellGeometry, shellMaterial);
    shell.scale.set(1, 0.48, 1);
    shell.position.y = side * 0.045;
    if (side < 0) shell.rotation.x = Math.PI;
    // The ruffled "foot" where each shell rose in the oven.
    const foot = new Mesh(footGeometry, new MeshStandardMaterial({ color: "#93cba3", roughness: 0.9 }));
    foot.position.y = side * 0.034;
    macaron.add(shell, foot);
  }
  const filling = new Mesh(
    new CylinderGeometry(0.15, 0.15, 0.042, 32),
    new MeshStandardMaterial({ color: "#fff1d2", roughness: 0.55 }),
  );
  macaron.add(filling);
  return macaron;
}

/**
 * Daytime bakery planets on tilted orbits around the cookie. Each sheds
 * sprinkles that hang in space where they fell and shrink away.
 */
function makeBakeryPlanets() {
  const random = seededRandom(311);
  const system = new Group();
  const sprinkleGeometry = new CapsuleGeometry(0.0075, 0.027, 3, 6);
  const color = new Color();
  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const scale = new Vector3();
  const planets = [
    // tilt sets each orbit plane; the near (+z) side dips below the cookie.
    { body: makeDonut(random), radius: 2.85, tilt: new Euler(0.3, 0, -0.38), period: 42, direction: 1, phase: 1.25, spin: new Vector3(0.4, 0.9, 0.2) },
    { body: makeMacaron(), radius: 3.3, tilt: new Euler(0.22, 0, 0.46), period: 58, direction: -1, phase: 2.3, spin: new Vector3(0.6, 0.3, 0.8) },
  ].map((planet) => {
    planet.body.traverse((object) => {
      if (object instanceof Mesh) object.castShadow = true;
    });
    planet.body.scale.setScalar(0.5);
    system.add(planet.body);
    const trail = new InstancedMesh(sprinkleGeometry, new MeshStandardMaterial({ roughness: 0.5 }), 80);
    trail.frustumCulled = false;
    const births = new Float32Array(trail.count).fill(-Infinity);
    const spots = Array.from({ length: trail.count }, () => new Vector3());
    const turns = Array.from({ length: trail.count }, () => new Quaternion());
    for (let i = 0; i < trail.count; i++) {
      trail.setMatrixAt(i, matrix.makeScale(0, 0, 0));
      trail.setColorAt(i, color.set(sprinkleColors[i % sprinkleColors.length]));
    }
    system.add(trail);
    return { ...planet, orbit: new Quaternion().setFromEuler(planet.tilt), trail, births, spots, turns, next: 0, lastEmit: 0 };
  });
  const trailLife = 3.2;
  function update(clock: number) {
    for (const planet of planets) {
      const angle = planet.phase + planet.direction * (clock / planet.period) * Math.PI * 2;
      planet.body.position
        .set(Math.cos(angle) * planet.radius, 0, Math.sin(angle) * planet.radius)
        .applyQuaternion(planet.orbit);
      planet.body.rotation.set(planet.spin.x * clock, planet.spin.y * clock, planet.spin.z * clock);
      if (clock - planet.lastEmit > 0.045 || clock < planet.lastEmit) {
        planet.lastEmit = clock;
        const slot = planet.next;
        planet.next = (slot + 1) % planet.trail.count;
        planet.births[slot] = clock;
        planet.spots[slot].copy(planet.body.position).add(
          scale.set(random() - 0.5, random() - 0.5, random() - 0.5).multiplyScalar(0.1),
        );
        planet.turns[slot].setFromEuler(new Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI));
      }
      for (let i = 0; i < planet.trail.count; i++) {
        const age = clock - planet.births[i];
        const life = age < 0 ? 0 : 1 - age / trailLife;
        const size = life > 0 ? life * life * (3 - 2 * life) : 0;
        matrix.compose(planet.spots[i], planet.turns[i], scale.setScalar(size));
        planet.trail.setMatrixAt(i, matrix);
      }
      planet.trail.instanceMatrix.needsUpdate = true;
    }
  }
  /** Clear the trails, e.g. when the planets reappear after a flight. */
  function resetTrails() {
    for (const planet of planets) planet.births.fill(-Infinity);
  }
  const materials = new Set<MeshStandardMaterial>();
  system.traverse((object) => {
    if (object instanceof Mesh) materials.add(object.material);
  });
  /** Off: the planets still cast shadows but leave no colour or depth behind. */
  function setDrawn(drawn: boolean) {
    materials.forEach((material) => {
      material.colorWrite = drawn;
      material.depthWrite = drawn;
    });
  }
  return { system, update, resetTrails, setDrawn };
}

export function mountCookieMoon(host: HTMLElement) {
  const canvas = host.querySelector<HTMLCanvasElement>("canvas")!;
  const viewport = host.querySelector<HTMLElement>("[data-cookie-viewport]")!;
  const face = host.querySelector<HTMLElement>("[data-cookie-face]")!;
  const backFace = host.querySelector<HTMLElement>("[data-cookie-face-back]")!;
  const returnButton = host.querySelector<HTMLButtonElement>(".cookie-return")!;
  const turnButton = host.querySelector<HTMLButtonElement>("[data-cookie-turn]")!;
  const announcement = host.querySelector<HTMLElement>("[data-cookie-announcement]")!;
  const hint = host.querySelector<HTMLElement>("[data-cookie-hint]")!;
  const bottomBar = host.querySelector<HTMLElement>(".cookie-bottom-bar")!;
  const status = host.querySelector<HTMLElement>("[data-cookie-status]")!;
  const buttons = host.querySelectorAll<HTMLButtonElement>(
    "[data-cookie-action]",
  );
  const resetButton = host.querySelector<HTMLButtonElement>('[data-cookie-action="reset"]')!;
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
      "The 3D view isn’t available in this browser. Explore Notes or About above.";
    host.dataset.state = "unavailable";
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  // The HTML layer sits above the main canvas, so planets are drawn on their own
  // canvas above it, masked by the cookie's depth where they pass behind.
  const planetCanvas = document.createElement("canvas");
  planetCanvas.className = "cookie-planets";
  planetCanvas.setAttribute("aria-hidden", "true");
  const planetRenderer = new WebGLRenderer({ canvas: planetCanvas, alpha: true, antialias: true, powerPreference: "low-power" });
  planetRenderer.setPixelRatio(renderer.getPixelRatio());
  planetRenderer.outputColorSpace = SRGBColorSpace;
  planetRenderer.toneMapping = ACESFilmicToneMapping;
  planetRenderer.toneMappingExposure = 1.25;
  planetRenderer.autoClear = false;
  planetRenderer.setClearColor(0x000000, 0);
  // The planets only need the cookie's rough shape to hide behind, so the depth
  // pass uses a low-poly ellipsoid instead of the full, finely detailed cookie.
  const depthScene = new Scene();
  const depthProxy = new Mesh(
    new SphereGeometry(2.1, 40, 20).scale(1, 1, 0.36 / 2.1),
    new MeshBasicMaterial({ colorWrite: false }),
  );
  depthProxy.matrixAutoUpdate = false;
  depthScene.add(depthProxy);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 120);
  camera.position.set(0, 0.05, 7.4);
  const { cookie, grainTexture, crumbTexture, chipFades, setPalette, setReadingFocus, setRainbow, treats } = makeCookie();
  // How eaten each twinkling chip is (0 whole, 1 gone), and any bite or regrowth in progress.
  const treatStates = treats.map(() => ({ amount: 0, from: 0, to: 0, start: null as number | null }));
  const treatMatrix = new Matrix4();
  const sparkleCanvas = document.createElement("canvas");
  sparkleCanvas.width = sparkleCanvas.height = 64;
  const sparkleContext = sparkleCanvas.getContext("2d")!;
  const glow = sparkleContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, "#ffffffcc");
  glow.addColorStop(0.18, "#fff4d666");
  glow.addColorStop(1, "#fff4d600");
  sparkleContext.fillStyle = glow;
  sparkleContext.fillRect(0, 0, 64, 64);
  // A thin four-pointed star over the glow.
  sparkleContext.fillStyle = "#ffffff";
  for (const [x, y] of [[1, 0], [0, 1]]) {
    sparkleContext.beginPath();
    sparkleContext.moveTo(32 - 30 * x, 32 - 30 * y);
    sparkleContext.lineTo(32 + 2.5 * y, 32 + 2.5 * x);
    sparkleContext.lineTo(32 + 30 * x, 32 + 30 * y);
    sparkleContext.lineTo(32 - 2.5 * y, 32 - 2.5 * x);
    sparkleContext.fill();
  }
  const sparkleTexture = new CanvasTexture(sparkleCanvas);
  const sparklePosition = new Vector3();
  const sparkleNormal = new Vector3();
  const sparkleToCamera = new Vector3();
  const treatPoint = new Vector3();
  sparkleTexture.colorSpace = SRGBColorSpace;
  const sparkles = treats.map((treat) => {
    const sparkle = new Sprite(new SpriteMaterial({
      map: sparkleTexture,
      blending: AdditiveBlending,
      depthWrite: false,
      // Drawn over the cookie rather than into it, so the flat star never cuts through
      // the chip or dough; updateSparkles hides it whenever its chip faces away.
      depthTest: false,
      transparent: true,
      // Full brightness: tone mapping would dull the glint to grey on the pale dough.
      toneMapped: false,
    }));
    // Centred on the dark chip, where a glint stands out on every palette.
    sparkle.position.copy(treat.position).addScaledVector(treat.normal, 0.08);
    sparkle.visible = false;
    sparkle.renderOrder = 1;
    cookie.add(sparkle);
    return sparkle;
  });
  const treatPosition = new Vector3();
  const treatScale = new Vector3();
  for (const texture of [grainTexture, crumbTexture]) {
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  }
  const homeRotation = cookie.quaternion.clone();
  scene.add(cookie);
  const planets = makeBakeryPlanets();
  scene.add(planets.system);
  let planetClock = 0;
  let planetFrame = 0;
  let daylight = false;
  // Keep real links attached to the cookie in the same coordinate system.
  const htmlRenderer = new CSS3DRenderer();
  htmlRenderer.domElement.className = "cookie-html";
  viewport.appendChild(htmlRenderer.domElement);
  viewport.appendChild(planetCanvas);
  // "Notes" and "About" are printed on the dough, just in front of where each sign springs
  // up. The lettering is pressed onto the dough's own bumps, so the cookie hides it
  // naturally as it turns; an invisible HTML button laid over it takes clicks and focus.
  const letteringScale = 0.00475;
  const letteringSize = { width: 1.25, height: 0.4 };
  const letterings = [
    // The lettering's centre, on bare dough. The back side's space is turned around,
    // so About's (-0.6, -0.05) here is (0.6, -0.05) on the cookie.
    { x: -0.35, y: -0.05 },
    { x: -0.6, y: -0.05 },
  ];
  cookie.updateMatrixWorld(true);
  const biscuit = cookie.children.find((child) => child instanceof Mesh && !(child instanceof InstancedMesh)) as Mesh;
  const flagSides = [face, backFace].map((element, index) => {
    const lettering = letterings[index];
    const pivot = new Group();
    pivot.rotation.y = index * Math.PI;
    cookie.add(pivot);
    element.style.width = `${letteringSize.width / letteringScale}px`;
    element.style.height = `${letteringSize.height / letteringScale}px`;
    // CSS3DObject forces pointer-events on; only the button should catch the pointer.
    element.style.pointerEvents = "none";
    const object = new CSS3DObject(element);
    // Just above the dough, which domes up towards the middle of the cookie.
    const dough = 0.36 * Math.sqrt(Math.max(0, 1 - (lettering.x ** 2 + lettering.y ** 2) / 2.1 ** 2));
    object.position.set(lettering.x, lettering.y, dough + 0.03);
    object.scale.setScalar(letteringScale);
    pivot.add(object);
    return { element, object, pivot };
  });
  const poleMaterial = new MeshStandardMaterial({ color: "#dfe3ea", metalness: 0.55, roughness: 0.32 });
  // Each word is printed straight onto the dough: plain, bold lettering in a colour that
  // stands out from the dough, white on the baked cookie and ink on the pale moon.
  const prints: {
    label: string;
    canvas: HTMLCanvasElement;
    texture: CanvasTexture;
    material: MeshStandardMaterial;
    hovered: boolean;
  }[] = [];
  const printEvents = new AbortController();
  function paintPrint(print: (typeof prints)[number]) {
    const { canvas, label } = print;
    const { width, height } = canvas;
    const context = canvas.getContext("2d")!;
    context.clearRect(0, 0, width, height);
    context.font = `700 ${height * 0.8}px ${getComputedStyle(face.querySelector("button")!).fontFamily}`;
    context.letterSpacing = `${height * 0.02}px`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    // Hovered or focused, it lights up like a link: a blue that stands out from the dough,
    // deep on the pale moon and light on the baked cookie, with a soft glow around it.
    const dark = document.documentElement.classList.contains("dark");
    const link = dark ? "#2563b8" : "#3d8bff";
    context.shadowColor = print.hovered ? link : "transparent";
    context.shadowBlur = height * 0.12;
    context.fillStyle = print.hovered ? link : dark ? "#1c293b" : "#fffaf0";
    context.fillText(label, width / 2, height / 2);
    context.shadowColor = "transparent";
    print.material.emissiveIntensity = print.hovered ? 0.45 : 0.2;
    print.texture.needsUpdate = true;
  }
  for (const [index, side] of flagSides.entries()) {
    const button = side.element.querySelector<HTMLElement>("button")!;
    const lettering = letterings[index];
    const canvas = document.createElement("canvas");
    // Drawn large and filtered at the steepest angles the GPU allows, so it stays sharp
    // when the cookie turns and the lettering is seen side-on.
    canvas.width = 2048;
    canvas.height = Math.round((2048 * letteringSize.height) / letteringSize.width);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const material = new MeshStandardMaterial({
      map: texture,
      emissive: "#ffffff",
      emissiveMap: texture,
      // A faint glow so the lighting never muddies the lettering.
      emissiveIntensity: 0.2,
      roughness: 0.8,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
    // Project the word straight down onto the dough, so it follows every bump.
    side.pivot.updateMatrixWorld(true);
    const geometry = new DecalGeometry(
      biscuit,
      side.pivot.localToWorld(new Vector3(lettering.x, lettering.y, 0.36)),
      new Euler().setFromQuaternion(side.pivot.getWorldQuaternion(new Quaternion())),
      new Vector3(letteringSize.width, letteringSize.height, 0.6),
    );
    // The decal comes out in world space; keep it in the cookie's, so it turns with it.
    geometry.applyMatrix4(cookie.matrixWorld.clone().invert());
    const decal = new Mesh(geometry, material);
    decal.receiveShadow = true;
    cookie.add(decal);
    const print = { label: button.textContent!.trim(), canvas, texture, material, hovered: false };
    prints.push(print);
    paintPrint(print);
    // The button is invisible, so hovering or focusing it lights up the lettering instead.
    const highlight = (on: boolean) => () => {
      print.hovered = on;
      paintPrint(print);
      requestRender();
    };
    for (const [type, on] of [["pointerenter", true], ["pointerleave", false], ["focus", true], ["blur", false]] as const) {
      button.addEventListener(type, highlight(on), { signal: printEvents.signal });
    }
  }
  // Repaint once the display font has loaded, in case the first paint used a fallback.
  document.fonts.ready.then(() => {
    prints.forEach(paintPrint);
    requestRender();
  });
  type Destination = "home" | "writing" | "about";
  // Flying to Notes or About lands at eye level on the dough, where the reading panel
  // stands as a sign and a landmark stands beside it. x and y are on the cookie's face.
  const landings = {
    writing: { side: 1, sign: { x: -0.55, y: 0.2 }, landmark: { x: 0.05, y: 0.65 }, model: makeServerRack() },
    about: { side: -1, sign: { x: 0.5, y: 0.25 }, landmark: { x: -0.2, y: 0.65 }, model: makeRocket() },
  };
  // How far from the sign the camera lands; the sign is scaled to fill the view from here.
  const landingDistance = 1;
  const signGap = 0.05;
  cookie.updateMatrixWorld(true);
  const dough = cookie.children.find((child) => child instanceof Mesh && !(child instanceof InstancedMesh))!;
  const doughRay = new Raycaster();
  /** The point on the dough's surface at x, y on one face, in the cookie's own space. */
  function doughPoint(x: number, y: number, side: number) {
    doughRay.set(
      cookie.localToWorld(new Vector3(x, y, side * 2)),
      new Vector3(0, 0, -side).transformDirection(cookie.matrixWorld),
    );
    const hit = doughRay.intersectObject(dough, false)[0];
    return hit ? cookie.worldToLocal(hit.point.clone()) : new Vector3(x, y, side * 0.3);
  }
  /** Standing upright on one face, turned towards a visitor arriving from below. */
  function standing(side: number) {
    const up = new Vector3(0, 0, side);
    const facing = new Vector3(0, -1, 0);
    const right = new Vector3().crossVectors(up, facing);
    return { up, facing, right, rotation: new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right, up, facing)) };
  }
  const surfaces = (["writing", "about"] as const).map((name) => {
    const element = host.querySelector<HTMLElement>(`[data-cookie-surface="${name}"]`)!;
    const object = new CSS3DObject(element);
    const landing = landings[name];
    const basis = standing(landing.side);
    const base = doughPoint(landing.sign.x, landing.sign.y, landing.side);
    object.quaternion.copy(basis.rotation);
    object.position.copy(base);
    // Surface styles render at 2× size; standSign scales them to the view.
    object.scale.setScalar(0.0021);
    cookie.add(object);
    const posts = [-1, 1].map(() => {
      const post = new Mesh(new CylinderGeometry(0.012, 0.014, 1, 12), poleMaterial);
      post.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), basis.up);
      post.castShadow = true;
      post.visible = false;
      cookie.add(post);
      return post;
    });
    const model = landing.model.group;
    model.position.copy(doughPoint(landing.landmark.x, landing.landmark.y, landing.side)).addScaledVector(basis.up, -0.01);
    model.quaternion.copy(basis.rotation);
    cookie.add(model);
    return { name, element, object, base, basis, posts, width: 0, height: 0, model: landing.model, modelBase: model.position.clone(), update: landing.model.update };
  });
  const launchSite = surfaces.find((surface) => surface.name === "about")!;
  const smokeMaterial = new MeshStandardMaterial({ color: "#e4e6eb", roughness: 1, transparent: true, opacity: 0.85, depthWrite: false });
  const smoke = new InstancedMesh(new IcosahedronGeometry(1, 1), smokeMaterial, 140);
  smoke.frustumCulled = false;
  cookie.add(smoke);
  const puffs = Array.from({ length: smoke.count }, () => ({ born: -Infinity, position: new Vector3(), drift: new Vector3(), size: 0 }));
  let nextPuff = 0;
  let lastPuff = 0;
  const puffMatrix = new Matrix4();
  const puffPosition = new Vector3();
  const puffScale = new Vector3();
  const puffTurn = new Quaternion();
  /** Puff smoke from the nozzle while spawning, and age every puff: they swell, drift and thin away. */
  function updateSmoke(time: number, spawning: boolean) {
    const { basis, model, modelBase } = launchSite;
    // Spawn by elapsed time, not per frame, so a slow device still gets a thick cloud.
    const due = spawning ? Math.min(6, Math.floor((time - lastPuff) / 14)) : 0;
    if (due > 0) lastPuff = time;
    for (let spawned = 0; spawned < due; spawned++) {
      const puff = puffs[nextPuff];
      nextPuff = (nextPuff + 1) % puffs.length;
      // Near the pad the smoke rolls out across the dough; higher up it trails behind.
      const onPad = model.group.position.distanceTo(modelBase) < 0.2;
      const angle = Math.random() * Math.PI * 2;
      puff.born = time;
      puff.position.copy(model.group.position).addScaledVector(basis.up, 0.02);
      puff.drift.copy(basis.right).multiplyScalar(Math.cos(angle))
        .addScaledVector(basis.facing, Math.sin(angle))
        .multiplyScalar(onPad ? 0.2 + Math.random() * 0.35 : 0.06)
        .addScaledVector(basis.up, onPad ? 0.03 + Math.random() * 0.06 : -0.1);
      puff.size = (onPad ? 0.06 : 0.04) * (0.7 + Math.random() * 0.6);
    }
    for (const [index, puff] of puffs.entries()) {
      const age = (time - puff.born) / 1700;
      const alive = age >= 0 && age < 1;
      puffPosition.copy(puff.position).addScaledVector(puff.drift, alive ? 1 - (1 - age) ** 2 : 0);
      puffScale.setScalar(alive ? puff.size * (0.5 + 3 * age) * (1 - age ** 4) : 0);
      smoke.setMatrixAt(index, puffMatrix.compose(puffPosition, puffTurn, puffScale));
    }
    smoke.instanceMatrix.needsUpdate = true;
  }
  // Instances start as full-size spheres in the cookie's middle; shrink them away until a launch.
  updateSmoke(0, false);
  /** Size the sign and stand it on its posts, its foot just above the dough. */
  const signTilt = new Quaternion();
  const signUp = new Vector3();
  const signHinge = new Vector3(1, 0, 0);
  const postAxis = new Vector3(0, 1, 0);
  /**
   * Tip the whole sign, board and posts, about its foot: 0 stands it upright, -π/2 lays it
   * on its back on the dough, and a little past 0 leans it towards the visitor.
   */
  function poseSign(surface: (typeof surfaces)[number], lean: number) {
    signUp.copy(surface.basis.up).multiplyScalar(Math.cos(lean)).addScaledVector(surface.basis.facing, Math.sin(lean));
    surface.object.quaternion.copy(surface.basis.rotation).multiply(signTilt.setFromAxisAngle(signHinge, lean));
    surface.object.position.copy(surface.base)
      .addScaledVector(surface.basis.up, signGap)
      .addScaledVector(signUp, surface.height / 2);
    // Posts run from just under the dough to the middle of the board, behind it.
    const length = signGap + surface.height / 2 + 0.03;
    surface.posts.forEach((post, index) => {
      post.scale.set(1, length, 1);
      post.quaternion.setFromUnitVectors(postAxis, signUp);
      post.position.copy(surface.base)
        .addScaledVector(surface.basis.right, (index ? 1 : -1) * surface.width * 0.3)
        .addScaledVector(signUp, length / 2 - 0.03);
    });
    renderer.shadowMap.needsUpdate = true;
  }
  function standSign(surface: (typeof surfaces)[number], scale: number) {
    const width = surface.element.offsetWidth * scale;
    const height = surface.element.offsetHeight * scale;
    surface.object.scale.setScalar(scale);
    surface.width = width;
    surface.height = height;
    poseSign(surface, 0);
  }
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
    // Notes links fly into the server rack; About's link launches the rocket.
    mode: "server" | "rocket";
    surface: (typeof surfaces)[number];
    up: Vector3;
  } | null = null;
  const leavingPoint = new Vector3();
  const leavingShake = new Vector3();
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
    fromCookie: Quaternion;
    toCookie: Quaternion;
    fromChips: number[];
    toChips: number[];
  } | null = null;
  const flightRotation = new Quaternion();
  // Going from one side to the other lifts off to the whole cookie first, then lands.
  let queuedDestination: Destination | null = null;
  // On landing the sign lies flat until the camera is nearly down, then springs upright.
  let signWaiting: (typeof surfaces)[number] | null = null;
  let signSpring: { surface: (typeof surfaces)[number]; start: number } | null = null;
  // A nudge to turn the cookie over, shown until the visitor has seen About's flag.
  let backSeen = false;
  try {
    backSeen = sessionStorage.getItem("netkuki-back-seen") === "true";
  } catch {}
  let turnTimer: number | undefined;
  let turning: { start: number; from: number } | null = null;
  let skipping = false;
  const flightDirection = new Vector3();

  function requestRender() {
    needsRender = true;
  }
  const placeHashes: Record<Destination, string> = { home: "", writing: "#notes", about: "#about" };
  function placeFromHash(): Destination {
    if (window.location.hash === placeHashes.writing) return "writing";
    return window.location.hash === placeHashes.about ? "about" : "home";
  }
  /** Fly somewhere the visitor chose, leaving a history entry for Back to return to. */
  function travelTo(next: Destination) {
    if (window.location.hash !== placeHashes[next]) {
      history.pushState(null, "", placeHashes[next] || window.location.pathname + window.location.search);
    }
    flyTo(next);
  }
  function onPopState() {
    const next = placeFromHash();
    if (next === destination) return;
    cancelExit();
    flyTo(next);
  }
  function hideTurnHint() {
    window.clearTimeout(turnTimer);
    turnButton.hidden = true;
  }
  /** Offer the turn after a short look around, unless the back has already been found. */
  function scheduleTurnHint(delay = 6000) {
    hideTurnHint();
    if (backSeen) return;
    turnTimer = window.setTimeout(() => {
      if (destination === "home" && !flight && !leaving && !turning && !backSeen) turnButton.hidden = false;
    }, delay);
  }
  function markBackSeen() {
    if (backSeen) return;
    backSeen = true;
    hideTurnHint();
    try {
      sessionStorage.setItem("netkuki-back-seen", "true");
    } catch {}
  }
  /** Spin the cookie half a turn so its back, and About's flag, face the visitor. */
  function turnOver() {
    hideTurnHint();
    finishEntrance();
    paused = true;
    updateMotion();
    turning = { start: performance.now(), from: cookie.rotation.y };
    showReset();
    announcement.textContent = "Turning the cookie over.";
    requestRender();
  }
  function updateTurning(time: number) {
    if (!turning) return;
    const progress = reducedMotion.matches ? 1 : Math.max(0, Math.min((time - turning.start) / 1200, 1));
    cookie.rotation.y = turning.from + Math.PI * progress * progress * (3 - 2 * progress);
    renderer.shadowMap.needsUpdate = true;
    requestRender();
    if (progress < 1) return;
    turning = null;
    renderScene();
    backFace.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    announcement.textContent = "The other side of the cookie. About is here.";
  }
  function skipFlight() {
    if (!flight || flight.duration === 0) return;
    // The next frame then sees a finished flight and lands the normal way.
    flight.start = -Infinity;
    skipping = true;
    requestRender();
  }
  function onFlightKey(event: KeyboardEvent) {
    if (event.repeat || ["Escape", "Tab", "Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
    skipFlight();
  }
  function restingHint() {
    return destination === "home"
      ? "Pick a place to fly to · Drag to explore"
      : `${destination === "writing" ? "Notes" : "About"} · Escape to fly back`;
  }
  /** A little note that floats up from the tapped chip: five tiny cookies, one filled per find. */
  function popProgress(event: PointerEvent, found: number) {
    const bounds = host.getBoundingClientRect();
    const pop = document.createElement("p");
    pop.className = "cookie-pop";
    // The live announcement already tells screen readers.
    pop.setAttribute("aria-hidden", "true");
    const dots = document.createElement("span");
    dots.className = "cookie-pop-dots";
    for (let i = 0; i < treats.length; i++) {
      const dot = document.createElement("span");
      dot.className = i < found ? "status-dot" : "status-dot is-left";
      dots.append(dot);
    }
    const left = treats.length - found;
    pop.append(dots, left === 0 ? "Rainbow time!" : `${left} more to find`);
    // Keep the note inside the cookie's frame near the edges.
    pop.style.left = `${Math.min(Math.max(event.clientX - bounds.left, 90), bounds.width - 90)}px`;
    pop.style.top = `${Math.max(event.clientY - bounds.top - 18, 56)}px`;
    host.append(pop);
    pop.addEventListener("animationend", () => pop.remove());
    window.setTimeout(() => pop.remove(), 3000);
  }
  function setTreat(index: number, to: number) {
    const state = treatStates[index];
    state.from = state.amount;
    state.to = to;
    state.start = performance.now();
    requestRender();
  }
  function updateTreats(time: number) {
    for (const [index, state] of treatStates.entries()) {
      if (state.start === null) continue;
      const progress = reducedMotion.matches ? 1 : Math.max(0, Math.min((time - state.start) / 420, 1));
      const eased = progress * progress * (3 - 2 * progress);
      state.amount = state.from + (state.to - state.from) * eased;
      const treat = treats[index];
      // A bite hops the chip off the dough before it disappears.
      const hop = state.to > state.from ? Math.sin(Math.PI * Math.min(progress * 1.6, 1)) * 0.14 : 0;
      treatPosition.copy(treat.position).addScaledVector(treat.normal, hop);
      treatScale.copy(treat.scale).multiplyScalar(Math.max(1 - state.amount, 0.0001) * (1 + hop * 2));
      treat.mesh.setMatrixAt(treat.index, treatMatrix.compose(treatPosition, treat.rotation, treatScale));
      treat.mesh.instanceMatrix.needsUpdate = true;
      renderer.shadowMap.needsUpdate = true;
      requestRender();
      if (progress === 1) state.start = null;
    }
  }
  /** Each chip flares briefly in turn, so only one or two twinkle at a time. */
  function updateSparkles(time: number) {
    const shown = destination === "home" && !flight && !leaving && !entrance && rainbowStart === null;
    for (const [index, sparkle] of sparkles.entries()) {
      // Only a chip turned towards the camera can catch the light.
      sparkle.getWorldPosition(sparklePosition);
      sparkleNormal.copy(treats[index].normal).transformDirection(cookie.matrixWorld);
      const facing = sparkleNormal.dot(sparkleToCamera.copy(camera.position).sub(sparklePosition).normalize()) > 0.3;
      const whole = facing && treatStates[index].to === 0 && treatStates[index].amount < 0.01;
      // With reduced motion, a steady faint glint instead of a flare.
      const phase = ((time + index * 1370) % 4800) / 700;
      const flare = reducedMotion.matches ? 0.45 : phase < 1 ? Math.sin(Math.PI * phase) : 0;
      const visible = shown && whole && flare > 0;
      if (visible) {
        sparkle.scale.setScalar(0.5 * flare);
        sparkle.material.rotation = reducedMotion.matches ? 0 : phase * 0.9;
        sparkle.material.opacity = Math.min(1, flare * 1.4);
      }
      if (visible || sparkle.visible !== visible) requestRender();
      sparkle.visible = visible;
    }
  }
  function endRainbow() {
    rainbowStart = null;
    setRainbow(0, 0);
    delete host.dataset.rainbow;
    // The twinkling chips grow back, ready for another go.
    treats.forEach((_, index) => setTreat(index, 0));
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
  /** The twinkling chip under the pointer, if there is a whole one. */
  function treatAt(event: PointerEvent) {
    if (flight || entrance || leaving || rainbowStart !== null) return -1;
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
    const index = treats.findIndex((treat) => hit?.object === treat.mesh && hit.instanceId === treat.index);
    if (index !== -1) return treatStates[index].to === 0 ? index : -1;
    // Chips are small on a phone, so a touch close to a whole, facing chip counts too.
    const reach = event.pointerType === "mouse" ? 12 : 30;
    let nearest = -1;
    let nearestDistance = reach;
    for (const [candidate, treat] of treats.entries()) {
      if (treatStates[candidate].to !== 0) continue;
      treatPoint.copy(treat.position).applyMatrix4(cookie.matrixWorld);
      sparkleNormal.copy(treat.normal).transformDirection(cookie.matrixWorld);
      if (sparkleNormal.dot(sparkleToCamera.copy(camera.position).sub(treatPoint).normalize()) < 0.3) continue;
      treatPoint.project(camera);
      const distance = Math.hypot(
        bounds.left + (treatPoint.x + 1) / 2 * bounds.width - event.clientX,
        bounds.top + (1 - treatPoint.y) / 2 * bounds.height - event.clientY,
      );
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }
    return nearest;
  }
  /** How far a press can move and still count as a tap; a fingertip wobbles more than a mouse. */
  function tapSlop(event: PointerEvent) {
    return event.pointerType === "mouse" ? 6 : 12;
  }
  function onChipPointerDown(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0) {
      chipPress = null;
      return;
    }
    chipPress = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
  }
  function onChipPointerMove(event: PointerEvent) {
    if (chipPress && Math.hypot(event.clientX - chipPress.x, event.clientY - chipPress.y) > tapSlop(event)) {
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
      Math.hypot(event.clientX - press.x, event.clientY - press.y) > tapSlop(event)) return;
    const index = treatAt(event);
    if (index === -1) return;
    setTreat(index, 1);
    const found = treatStates.filter((state) => state.to === 1).length;
    if (found < treats.length) {
      popProgress(event, found);
      announcement.textContent = `${found} of ${treats.length} twinkling chips found.`;
      return;
    }
    rainbowStart = performance.now();
    window.clearTimeout(rainbowTimer);
    rainbowTimer = window.setTimeout(endRainbow, 10000);
    host.dataset.rainbow = "true";
    popProgress(event, found);
    announcement.textContent = "You found all five twinkling chips! Rainbow colours for ten seconds.";
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
    const motionLabel = paused ? "Start rotation" : "Pause rotation";
    motionButton.setAttribute("aria-label", motionLabel);
    motionButton.title = motionLabel;
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
    planetRenderer.setSize(width, height, false);
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
  /** Offer Reset once the visitor has turned or zoomed the view away from its start. */
  function showReset() {
    if (destination === "home" && !flight) resetButton.hidden = false;
  }
  function reset() {
    travelTo("home");
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
    const skipped = skipping;
    skipping = false;
    if (queuedDestination) {
      const next = queuedDestination;
      queuedDestination = null;
      flyTo(next, skipped);
      return;
    }
    delete host.dataset.traveling;
    hint.textContent = restingHint();
    controls.enabled = destination === "home";
    controls.enableDamping = true;
    updateMotion();
    announcement.textContent = destination === "home"
      ? "Back at the whole cookie. Choose Notes, or turn the cookie over to find About."
      : `${destination === "writing" ? "Notes" : "About"}. You have arrived on the cookie’s surface. Press Escape to fly back.`;
    // Render visibility before moving keyboard focus into the destination.
    renderScene();
    const focusTarget = destination === "home"
      ? face.querySelector<HTMLButtonElement>("button")
      : surfaces.find((surface) => surface.name === destination)?.element.querySelector<HTMLElement>("h2");
    focusTarget?.focus({ preventScroll: true });
    if (destination === "home") scheduleTurnHint();
    requestRender();
  }
  function flyTo(next: Destination, immediate = false) {
    const changingSides = destination !== "home" && next !== "home" && destination !== next;
    const liftingOff = changingSides && !immediate && !reducedMotion.matches;
    queuedDestination = liftingOff ? next : null;
    signWaiting = null;
    signSpring = null;
    hideTurnHint();
    resetButton.hidden = true;
    turning = null;
    skipping = false;
    const arrival = next;
    if (liftingOff) next = "home";
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
    announcement.textContent = arrival === "home" ? "Flying back to the whole cookie." : `Flying to ${arrival === "writing" ? "Notes" : "About"}.`;
    returnButton.hidden = next === "home";
    hint.textContent = "Flying · Click or tap to land";
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
      const tanFov = Math.tan((camera.fov * Math.PI) / 360);
      // Keep the reading panel between the floating return button and hint,
      // while the cookie itself still fills the entire canvas behind them.
      const bounds = viewport.getBoundingClientRect();
      const top = Math.max(12, returnButton.getBoundingClientRect().bottom - bounds.top + 12);
      const bottom = Math.min(bounds.height - 12, bottomBar.getBoundingClientRect().top - bounds.top - 12);
      const availableHeight = Math.max(1, bottom - top);
      // Fill the view from a fixed distance, so the camera always lands at eye level.
      standSign(surface, Math.min(
        (2 * tanFov * landingDistance * (availableHeight / bounds.height)) / surface.element.offsetHeight,
        (2 * tanFov * landingDistance * camera.aspect * 0.8) / surface.element.offsetWidth,
      ));
      surface.object.getWorldPosition(toTarget);
      const normal = new Vector3(0, 0, 1).transformDirection(surface.object.matrixWorld);
      toUp.set(0, 1, 0).transformDirection(surface.object.matrixWorld);
      const centerOffset = (top + availableHeight / 2) / bounds.height - 0.5;
      toTarget.addScaledVector(toUp, centerOffset * 2 * tanFov * landingDistance);
      toPosition.copy(toTarget).addScaledVector(normal, landingDistance);
      if (!immediate && !reducedMotion.matches) {
        poseSign(surface, -Math.PI / 2);
        signWaiting = surface;
      }
    }
    flight = {
      start: performance.now(),
      // A lift-off is the first half of a longer trip, so it moves quicker.
      duration: immediate || reducedMotion.matches ? 0 : liftingOff ? 1100 : 1700,
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
      // The text stands on a sign now, so no chips need clearing out of the way.
      toChips: chipFades.map(() => 1),
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
      if (!leaving) exitTo(url.href);
      return;
    }
    if (leaving) return;
    if ((event.target as Element).closest("[data-cookie-turn]")) {
      turnOver();
      return;
    }
    const travelButton = (event.target as Element).closest<HTMLButtonElement>("[data-cookie-destination]");
    if (travelButton) {
      const next = travelButton.dataset.cookieDestination;
      if (next === "home" || next === "writing" || next === "about") travelTo(next);
      return;
    }
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "[data-cookie-action]",
    );
    switch (button?.dataset.cookieAction) {
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
      showReset();
      renderer.shadowMap.needsUpdate = true;
      requestRender();
    } else if (["+", "=", "-", "r", "R", " "].includes(event.key)) {
      event.preventDefault();
      if (event.key === "r" || event.key === "R") reset();
      else if (event.key === " ") {
        paused = !paused;
        orbitPaused = paused;
        updateMotion();
      } else {
        zoom(event.key === "-" ? 1.14 : 0.88);
        showReset();
      }
    }
  }
  function onStart() {
    finishEntrance();
    paused = true;
    updateMotion();
    // They're exploring; offer the turn again later if they don't find the back.
    scheduleTurnHint(9000);
    showReset();
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
    if (event.relatedTarget instanceof Node && (event.currentTarget as Node).contains(event.relatedTarget)) return;
    faceFocused = false;
    updateMotion();
    requestRender();
  }
  function facesCamera(object: CSS3DObject) {
    object.getWorldPosition(facePosition);
    faceNormal.set(0, 0, 1).transformDirection(object.matrixWorld);
    faceToCamera.copy(camera.position).sub(facePosition).normalize();
    // HTML has no WebGL depth buffer: hide it before the surface turns away.
    return faceNormal.dot(faceToCamera) > 0.35;
  }
  function renderFace() {
    // HTML always draws over the 3D scene, so a sign seen mid-flight would show through the
    // cookie. It stays hidden while it waits, flat on the dough, for the camera to come down.
    for (const { object, element, active } of [
      ...flagSides.map((side) => ({ ...side, active: destination === "home" && !flight })),
      ...surfaces.map((surface) => ({ ...surface, active: destination === surface.name && signWaiting !== surface })),
    ]) {
      object.visible = active && facesCamera(object);
      element.inert = !object.visible || !!flight || !!entrance;
      element.hidden = !object.visible;
    }
    if (flagSides[1].object.visible) markBackSeen();
    htmlRenderer.render(scene, camera);
  }
  function renderScene() {
    // A distant sky follows camera translation, keeping its directions and size
    // stable while the cookie moves closer or the camera flies around it.
    stars.position.copy(camera.position);
    scene.updateMatrixWorld();
    for (const surface of surfaces) {
      // Posts wait out of sight with their board, then spring up with it.
      const postsVisible = destination === surface.name && !leaving && signWaiting !== surface;
      if (surface.posts[0].visible !== postsVisible) {
        surface.posts.forEach((post) => { post.visible = postsVisible; });
        renderer.shadowMap.needsUpdate = true;
      }
    }
    planets.setDrawn(false);
    renderer.render(scene, camera);
    planets.setDrawn(true);
    renderPlanets();
    renderFace();
  }
  function renderPlanets() {
    planetRenderer.clear();
    if (!planets.system.visible) return;
    // First lay down the cookie's depth, then draw only the planets against it.
    depthProxy.matrix.copy(cookie.matrixWorld);
    planetRenderer.render(depthScene, camera);
    const starsVisible = stars.visible;
    stars.visible = false;
    cookie.visible = false;
    planetRenderer.render(scene, camera);
    cookie.visible = true;
    stars.visible = starsVisible;
  }
  function exitTo(href: string) {
    controls.enabled = false;
    controls.autoRotate = false;
    const surface = surfaces.find((entry) => entry.name === destination)!;
    const up = surface.basis.up.clone().transformDirection(cookie.matrixWorld);
    const facing = surface.basis.facing.clone().transformDirection(cookie.matrixWorld);
    const server = surface.name === "writing";
    const toTarget = controls.target.clone();
    const toPosition = camera.position.clone();
    if (server) {
      // Glide up to the rack's front panel, close enough for its lights to fill the view
      // but outside the camera's near plane, so the panel never clips open.
      surface.model.group.getWorldPosition(toTarget).addScaledVector(up, 0.12);
      toPosition.copy(toTarget).addScaledVector(facing, 0.17);
    }
    leaving = {
      start: performance.now(),
      duration: server ? 1250 : 2200,
      fromPosition: camera.position.clone(),
      toPosition,
      fromTarget: controls.target.clone(),
      toTarget,
      mode: server ? "server" : "rocket",
      surface,
      up,
    };
    host.dataset.leaving = leaving.mode;
    host.setAttribute("aria-busy", "true");
    viewport.inert = true;
    returnButton.disabled = true;
    buttons.forEach((button) => { button.disabled = true; });
    announcement.textContent = server ? "Heading into the server. Opening the page." : "Blasting off. Opening About.";
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
    // Back from the page: the rocket is home on its pad again.
    leaving.surface.model.group.position.copy(leaving.surface.modelBase);
    leaving.surface.model.reset();
    puffs.forEach((puff) => { puff.born = -Infinity; });
    updateSmoke(performance.now(), false);
    renderer.shadowMap.needsUpdate = true;
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
    if (event.key === "Escape" && flight && destination === "home") {
      event.preventDefault();
      skipFlight();
    } else if (event.key === "Escape" && destination !== "home") {
      event.preventDefault();
      travelTo("home");
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
    prints.forEach(paintPrint);
    ambient.intensity = dark ? 1.65 : 2.2;
    rim.intensity = dark ? 3.5 : 1.6;
    sunlight.intensity = dark ? 3.2 : 2.8;
    stars.visible = dark;
    daylight = !dark;
    starsMaterial.opacity = 0.55;
    requestRender();
  }
  function animate(time: number) {
    if (disposed) return;
    if (visible && !document.hidden) {
      updateRainbow(time);
      updateTurning(time);
      updateTreats(time);
      updateSparkles(time);
      for (const surface of surfaces) {
        if (!leaving) surface.update(time);
        if (destination === surface.name && !flight) requestRender();
      }
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
        const { surface } = leaving;
        if (leaving.mode === "server") {
          // Ease in and out, turning to face the rack a little ahead of arriving at it.
          const eased = progress * progress * (3 - 2 * progress);
          camera.position.lerpVectors(leaving.fromPosition, leaving.toPosition, eased);
          controls.target.lerpVectors(leaving.fromTarget, leaving.toTarget, Math.min(1, eased * 1.5));
        } else {
          // Ignition: the engine lights and the rocket shudders on the pad. Then it accelerates
          // away, and the camera rises a little, shakes, and tilts to follow.
          const ignition = 0.22;
          const climb = Math.max(0, (progress - ignition) / (1 - ignition));
          const lift = 2.6 * climb ** 2.2;
          const shudder = climb === 0 ? 0.004 : 0;
          surface.model.group.position.copy(surface.modelBase)
            .addScaledVector(surface.basis.up, lift)
            .addScaledVector(surface.basis.right, (Math.random() - 0.5) * shudder);
          updateSmoke(time, progress < 0.85);
          surface.model.group.getWorldPosition(leavingPoint).addScaledVector(leaving.up, 0.18);
          controls.target.lerpVectors(leaving.fromTarget, leavingPoint, Math.min(1, progress * 2.5));
          const shake = (1 - climb) * 0.006;
          camera.position.copy(leaving.fromPosition)
            .addScaledVector(leaving.up, lift * 0.2)
            .add(leavingShake.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
          renderer.shadowMap.needsUpdate = true;
        }
        camera.lookAt(controls.target);
        surface.model.exit(progress, time);
        const fade = Math.max(0, (progress - (leaving.mode === "server" ? 0.6 : 0.72)) / (leaving.mode === "server" ? 0.4 : 0.28));
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
        camera.up.lerpVectors(flight.fromUp, flight.toUp, eased).normalize();
        controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased);
        camera.lookAt(controls.target);
        if (destination === "home") {
          cookie.quaternion.slerpQuaternions(flight.fromCookie, flight.toCookie, eased);
          renderer.shadowMap.needsUpdate = true;
        }
        if (signWaiting && progress >= 0.78) {
          signSpring = { surface: signWaiting, start: time };
          signWaiting = null;
        }
        requestRender();
        if (progress === 1) finishFlight();
      }
      if (signSpring) {
        // A damped spring: up from flat, a little past upright, and a wobble to rest.
        const seconds = (time - signSpring.start) / 1000;
        const settled = seconds > 1.3;
        poseSign(signSpring.surface, settled ? 0 : (-Math.PI / 2) * Math.exp(-5 * seconds) * Math.cos(9 * seconds));
        if (settled) signSpring = null;
        requestRender();
      }
      // Planets only orbit by day, around the whole cookie, and freeze with Pause.
      const planetsShown = daylight && destination === "home" && !flight && !leaving;
      if (planets.system.visible !== planetsShown) {
        planets.system.visible = planetsShown;
        if (!planetsShown) planets.resetTrails();
        renderer.shadowMap.needsUpdate = true;
        requestRender();
      }
      if (planetsShown && (!orbitPaused || planetClock === 0)) {
        planetClock += lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0.001;
        planets.system.position.copy(cookie.position);
        planets.update(planetClock);
        // Planet shadows drift slowly; refreshing every third frame is invisible.
        if (planetFrame++ % 3 === 0) renderer.shadowMap.needsUpdate = true;
        requestRender();
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
  host.addEventListener("pointerdown", skipFlight);
  document.addEventListener("keydown", onEscape);
  document.addEventListener("keydown", onFlightKey);
  window.addEventListener("popstate", onPopState);
  canvas.addEventListener("keydown", onKey);
  canvas.addEventListener("pointerdown", onChipPointerDown);
  canvas.addEventListener("pointermove", onChipPointerMove);
  canvas.addEventListener("pointerup", onChipPointerUp);
  canvas.addEventListener("pointercancel", onChipPointerCancel);
  for (const { element } of flagSides) {
    element.addEventListener("pointerenter", onFacePointerEnter);
    element.addEventListener("pointerleave", onFacePointerLeave);
    element.addEventListener("focusin", onFaceFocusIn);
    element.addEventListener("focusout", onFaceFocusOut);
  }
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
    window.clearTimeout(turnTimer);
    turnButton.hidden = true;
    host.querySelectorAll(".cookie-pop").forEach((pop) => pop.remove());
    delete host.dataset.rainbow;
    delete host.dataset.entering;
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    themeObserver.disconnect();
    visibilityObserver.disconnect();
    host.removeEventListener("click", onAction);
    host.removeEventListener("pointerdown", skipFlight);
    document.removeEventListener("keydown", onEscape);
    document.removeEventListener("keydown", onFlightKey);
    window.removeEventListener("popstate", onPopState);
    canvas.removeEventListener("keydown", onKey);
    canvas.removeEventListener("pointerdown", onChipPointerDown);
    canvas.removeEventListener("pointermove", onChipPointerMove);
    canvas.removeEventListener("pointerup", onChipPointerUp);
    canvas.removeEventListener("pointercancel", onChipPointerCancel);
    for (const { element } of flagSides) {
      element.removeEventListener("pointerenter", onFacePointerEnter);
      element.removeEventListener("pointerleave", onFacePointerLeave);
      element.removeEventListener("focusin", onFaceFocusIn);
      element.removeEventListener("focusout", onFaceFocusOut);
    }
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
    sparkles.forEach((sparkle) => sparkle.material.dispose());
    sparkleTexture.dispose();
    printEvents.abort();
    prints.forEach((print) => print.texture.dispose());
    grainTexture.dispose();
    crumbTexture.dispose();
    chipFades.forEach((batch) => batch.texture.dispose());
    sunlight.shadow.dispose();
    renderer.dispose();
    depthProxy.geometry.dispose();
    depthProxy.material.dispose();
    planetRenderer.dispose();
    planetCanvas.remove();
    for (const { element, object } of flagSides) {
      element.hidden = true;
      object.removeFromParent();
      viewport.appendChild(element);
    }
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
  // A shared link, a reload or Back from an article lands straight on that side.
  if (placeFromHash() !== "home") flyTo(placeFromHash(), true);
  else scheduleTurnHint();
  if (entrance) host.dataset.entering = "true";
  frame = requestAnimationFrame(animate);
}
