import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { GunDef } from "../game/data";
import { buildGunModel } from "../game/models";

export default function GunPreview({ gun }: { gun: GunDef }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0.35, 3.3);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1410, 1.4));
    const key = new THREE.DirectionalLight(0xffe2b8, 3);
    key.position.set(2, 3, 2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x7fb8ff, 2.2);
    rim.position.set(-3, 1, -2);
    scene.add(rim);

    const { group } = buildGunModel(gun);
    const pivot = new THREE.Group();
    group.rotation.y = Math.PI / 2;
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    group.position.sub(center);
    const size = box.getSize(new THREE.Vector3());
    const scale = 1.9 / Math.max(size.x, size.z, 0.001);
    pivot.scale.setScalar(scale);
    pivot.add(group);
    scene.add(pivot);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.3, 48), new THREE.MeshBasicMaterial({ color: 0xe0a961, transparent: true, opacity: 0.08 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.4;
    scene.add(floor);

    const resize = () => {
      const r = host.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / Math.max(1, r.height);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let drag = false;
    let lastX = 0;
    let spin = 0.4;
    let manual = 0;
    const down = (e: PointerEvent) => {
      drag = true;
      lastX = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      manual += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
    };
    const up = () => {
      drag = false;
    };
    host.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    let frame = 0;
    const clock = new THREE.Clock();
    const loop = () => {
      frame = requestAnimationFrame(loop);
      const dt = clock.getDelta();
      if (!drag) spin += dt * 0.35;
      pivot.rotation.y = spin + manual;
      pivot.rotation.x = Math.sin(clock.elapsedTime * 0.7) * 0.05;
      pivot.position.y = Math.sin(clock.elapsedTime * 1.2) * 0.03;
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      host.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [gun]);

  return <div ref={hostRef} className="gun-preview" aria-label={`${gun.name} 3D preview, drag to rotate`} />;
}
