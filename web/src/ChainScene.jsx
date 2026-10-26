import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { api, fmt } from "./api.js";

// Three.js: the last N blocks as a rotating 3D chain of phosphor cubes.
// Click a cube to open that block. Draggable orbit.
export default function ChainScene({ openWin, closeWin, setStatus }) {
  const mount = useRef(null);
  const state = useRef({});
  const [info, setInfo] = useState("loading blocks…");

  useEffect(() => {
    let disposed = false;
    const el = mount.current;
    const W = el.clientWidth, H = el.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05140c);
    scene.fog = new THREE.Fog(0x05140c, 18, 60);

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
    camera.position.set(0, 10, 26);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    el.appendChild(renderer.domElement);

    // lights
    scene.add(new THREE.AmbientLight(0x335544, 1.2));
    const key = new THREE.PointLight(0x66ffaa, 60, 100);
    key.position.set(0, 18, 12);
    scene.add(key);

    const group = new THREE.Group();
    scene.add(group);

    // grid floor
    const grid = new THREE.GridHelper(80, 40, 0x0f5a3c, 0x0a3324);
    grid.position.y = -6;
    scene.add(grid);

    const ray = new THREE.Raycaster();
    const mouse = { x: 0, y: 0, down: false, moved: false, px: 0, py: 0 };
    state.current = { group, camera, renderer, mouse, ray, cubes: [], tip: null };

    // orbit-ish drag control (custom, light)
    let rotY = 0, rotX = 0.25;

    const onDown = (e) => { mouse.down = true; mouse.moved = false; mouse.px = e.clientX; mouse.py = e.clientY; };
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      if (mouse.down) {
        rotY += (e.clientX - mouse.px) * 0.006;
        rotX = Math.max(-0.9, Math.min(1.2, rotX + (e.clientY - mouse.py) * 0.004));
        mouse.moved = mouse.moved || Math.abs(e.clientX - mouse.px) + Math.abs(e.clientY - mouse.py) > 6;
        mouse.px = e.clientX; mouse.py = e.clientY;
      }
    };
    const onUp = (e) => {
      if (mouse.down && !mouse.moved) {
        ray.setFromCamera(new THREE.Vector2(mouse.x, mouse.y), camera);
        const hits = ray.intersectObjects(state.current.cubes.map((c) => c.mesh));
        if (hits.length) {
          const cube = state.current.cubes.find((c) => c.mesh === hits[0].object);
          if (cube) openWin("block", { id: cube.height });
        }
      }
      mouse.down = false;
    };

    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    let raf;
    const clock = new THREE.Clock();
    const draw = () => {
      const t = clock.getElapsedTime();
      if (!mouse.down) rotY += 0.0016;
      group.rotation.y = rotY;
      group.rotation.x = rotX;
      // pulse the newest cube
      state.current.cubes.forEach((c, i) => {
        if (c.isTip) {
          const s = 1 + Math.sin(t * 3) * 0.08;
          c.mesh.scale.setScalar(s);
          c.glow.material.opacity = 0.5 + Math.sin(t * 3) * 0.3;
        }
      });
      renderer.render(scene, camera);
      raf = requestAnimationFrame(draw);
    };

    const build = async () => {
      try {
        const data = await api("blocks?limit=24");
        const blocks = (data.blocks || []).slice().reverse();
        if (disposed) return;
        const N = blocks.length;
        const spacing = 1.55;
        const startX = -((N - 1) * spacing) / 2;
        const geo = new THREE.BoxGeometry(1, 1, 1);
        blocks.forEach((b, i) => {
          const isTip = i === N - 1;
          const edges = new THREE.EdgesGeometry(geo);
          const lineColor = isTip ? 0x66ffaa : 0x2fae7d;
          const mesh = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: lineColor, transparent: true, opacity: isTip ? 1 : 0.85 })
          );
          const x = startX + i * spacing;
          mesh.position.set(x, Math.sin(i * 0.6) * 0.8, Math.cos(i * 0.6) * 0.8);
          const fill = new THREE.Mesh(
            geo,
            new THREE.MeshBasicMaterial({ color: 0x07231a, transparent: true, opacity: 0.92 })
          );
          fill.position.copy(mesh.position);
          fill.userData.height = b.height;
          mesh.userData.height = b.height;

          let glow = null;
          if (isTip) {
            glow = new THREE.Mesh(
              new THREE.BoxGeometry(1.25, 1.25, 1.25),
              new THREE.MeshBasicMaterial({ color: 0x66ffaa, transparent: true, opacity: 0.35 })
            );
            glow.position.copy(mesh.position);
            group.add(glow);
          }

          // connector to previous
          if (i > 0) {
            const prev = state.current.cubes[i - 1].mesh.position;
            const g = new THREE.BufferGeometry().setFromPoints([prev, mesh.position]);
            const link = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x1c5f45 }));
            group.add(link);
          }

          group.add(fill);
          group.add(mesh);
          state.current.cubes.push({ mesh: fill, glow, height: b.height, isTip });
        });
        setInfo(N + " blocks loaded — tip #" + blocks[N - 1].height + " (" + fmt.age(blocks[N - 1].time) + " ago)");
        setStatus && setStatus("drag to rotate · click a block to open it");
      } catch (e) {
        setInfo("cannot load blocks: " + e.message);
      }
    };
    build();
    const refresh = setInterval(build, 60000);
    draw();

    return () => {
      disposed = true;
      clearInterval(refresh);
      cancelAnimationFrame(raf);
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      renderer.dispose();
      el.contains(renderer.domElement) && el.removeChild(renderer.domElement);
    };
  }, []); // eslint-disable-line

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div ref={mount} style={{ flex: 1, minHeight: 200, cursor: "grab" }} />
      <div className="term" style={{ margin: "0 8px 8px", maxHeight: 90 }}>{"> " + info}</div>
    </div>
  );
}
