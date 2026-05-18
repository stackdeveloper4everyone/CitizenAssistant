import * as THREE from "three";

const canvas = document.getElementById("webgl-canvas");
const loaderEl = document.getElementById("sceneLoader");

if (!canvas) {
  throw new Error("WebGL canvas not found");
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mouse = { x: 0, y: 0 };
const target = { x: 0, y: 0 };
let animationId = 0;
let isVisible = true;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x040a12, 0.045);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 0, 7.5);

const world = new THREE.Group();
scene.add(world);

const ambient = new THREE.AmbientLight(0x6ec8ff, 0.35);
scene.add(ambient);

const keyLight = new THREE.SpotLight(0x7ef0d4, 3.2, 28, 0.42, 0.65, 1.1);
keyLight.position.set(6, 8, 9);
scene.add(keyLight);

const rimLight = new THREE.SpotLight(0x4aa8ff, 2.4, 24, 0.55, 0.5, 1);
rimLight.position.set(-7, -3, 5);
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0xffd9a0, 0.45);
fillLight.position.set(2, -6, 4);
scene.add(fillLight);

const distortionUniforms = {
  uTime: { value: 0 },
  uIntensity: { value: prefersReducedMotion ? 0.08 : 0.22 },
  uColorA: { value: new THREE.Color("#0a7d71") },
  uColorB: { value: new THREE.Color("#4ad4ff") },
};

const distortionMaterial = new THREE.ShaderMaterial({
  uniforms: distortionUniforms,
  vertexShader: `
    uniform float uTime;
    uniform float uIntensity;
    varying vec3 vNormalW;
    varying vec3 vViewDir;
    void main() {
      vec3 pos = position;
      float wave = sin(pos.x * 2.2 + uTime * 1.1) * cos(pos.y * 2.6 + uTime * 0.9);
      wave += sin(pos.z * 1.7 - uTime * 1.3) * 0.6;
      pos += normal * wave * uIntensity;
      vec4 worldPos = modelMatrix * vec4(pos, 1.0);
      vNormalW = normalize(mat3(modelMatrix) * normal);
      vViewDir = normalize(cameraPosition - worldPos.xyz);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    varying vec3 vNormalW;
    varying vec3 vViewDir;
    void main() {
      float fresnel = pow(1.0 - max(dot(normalize(vNormalW), normalize(vViewDir)), 0.0), 2.4);
      vec3 base = mix(uColorA, uColorB, fresnel);
      float glow = smoothstep(0.2, 1.0, fresnel);
      gl_FragColor = vec4(base + glow * 0.18, 0.88);
    }
  `,
  transparent: true,
  side: THREE.DoubleSide,
});

const heroMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 64), distortionMaterial);
world.add(heroMesh);

const knotMesh = new THREE.Mesh(
  new THREE.TorusKnotGeometry(1.05, 0.22, 220, 32, 2, 5),
  new THREE.MeshPhysicalMaterial({
    color: 0x0e4a6e,
    metalness: 0.85,
    roughness: 0.18,
    transparent: true,
    opacity: 0.42,
    wireframe: true,
  })
);
knotMesh.rotation.x = Math.PI * 0.35;
world.add(knotMesh);

const ring = new THREE.Mesh(
  new THREE.TorusGeometry(2.35, 0.03, 16, 120),
  new THREE.MeshBasicMaterial({ color: 0x7ef0d4, transparent: true, opacity: 0.35 })
);
ring.rotation.x = Math.PI * 0.5;
world.add(ring);

const particleCount = prefersReducedMotion ? 600 : 1400;
const particlePositions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i += 1) {
  const radius = 2.4 + Math.random() * 4.8;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
  particlePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
  particlePositions[i * 3 + 2] = radius * Math.cos(phi);
}
const particles = new THREE.Points(
  new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(particlePositions, 3)),
  new THREE.PointsMaterial({
    color: 0x9be8ff,
    size: prefersReducedMotion ? 0.02 : 0.035,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
world.add(particles);

function hideLoader() {
  if (!loaderEl) {
    return;
  }
  loaderEl.classList.add("is-hidden");
  window.setTimeout(() => {
    loaderEl.remove();
  }, 700);
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function onPointerMove(event) {
  const x = (event.clientX / window.innerWidth) * 2 - 1;
  const y = -(event.clientY / window.innerHeight) * 2 + 1;
  target.x = x;
  target.y = y;
}

function lerp(current, goal, alpha) {
  return current + (goal - current) * alpha;
}

const clock = new THREE.Clock();

function animate() {
  animationId = window.requestAnimationFrame(animate);
  if (!isVisible) {
    return;
  }

  const elapsed = clock.getElapsedTime();
  mouse.x = lerp(mouse.x, target.x, 0.06);
  mouse.y = lerp(mouse.y, target.y, 0.06);

  distortionUniforms.uTime.value = elapsed;
  world.rotation.y = elapsed * 0.14 + mouse.x * 0.45;
  world.rotation.x = elapsed * 0.08 + mouse.y * 0.28;
  knotMesh.rotation.z = elapsed * 0.35;
  ring.rotation.z = -elapsed * 0.22;
  particles.rotation.y = elapsed * 0.05;

  keyLight.position.x = 6 + mouse.x * 2.2;
  keyLight.position.y = 8 + mouse.y * 1.8;
  rimLight.position.x = -7 - mouse.x * 1.6;

  renderer.render(scene, camera);
}

window.addEventListener("pointermove", onPointerMove, { passive: true });
window.addEventListener("resize", onResize);
document.addEventListener("visibilitychange", () => {
  isVisible = document.visibilityState === "visible";
  if (isVisible) {
    clock.getDelta();
    animate();
  }
});

onResize();
hideLoader();
window.dispatchEvent(new CustomEvent("nagrikmira-scene-ready"));
animate();
