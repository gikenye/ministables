"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    THREE?: any;
  }
}

const THREE_CDN =
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";

export function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animationId: number | null = null;
    let meteorIntervalId: number | null = null;
    let renderer: any = null;
    let scene: any = null;
    let camera: any = null;
    let starGeometry: any = null;
    let starMaterial: any = null;
    let meteorGeometry: any = null;
    let meteorMaterial: any = null;
    let starMesh: any = null;
    const meteors: any[] = [];

    const setupScene = () => {
      const canvas = canvasRef.current;
      if (!canvas || !window.THREE) return;

      const THREE = window.THREE;
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      camera.position.z = 5;

      // Starfield
      starGeometry = new THREE.BufferGeometry();
      const starCount = 1500;
      const posArray = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount * 3; i += 1) {
        posArray[i] = (Math.random() - 0.5) * 15;
      }
      starGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(posArray, 3)
      );
      starMaterial = new THREE.PointsMaterial({
        size: 0.005,
        color: 0x10b981,
      });
      starMesh = new THREE.Points(starGeometry, starMaterial);
      scene.add(starMesh);

      // Meteors
      meteorGeometry = new THREE.SphereGeometry(0.01, 8, 8);
      meteorMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const createMeteor = () => {
        if (!scene) return;
        const meteor = new THREE.Mesh(meteorGeometry, meteorMaterial);
        meteor.position.set(
          Math.random() * 10 - 5,
          Math.random() * 10 - 5,
          Math.random() * -5
        );
        meteor.userData = {
          vx: 0.05 + Math.random() * 0.05,
          vy: -0.05 - Math.random() * 0.05,
        };
        scene.add(meteor);
        meteors.push(meteor);
      };
      meteorIntervalId = window.setInterval(createMeteor, 2000);

      const animate = () => {
        animationId = requestAnimationFrame(animate);
        if (starMesh) {
          starMesh.rotation.y += 0.0005;
        }
        for (let i = meteors.length - 1; i >= 0; i -= 1) {
          const meteor = meteors[i];
          meteor.position.x += meteor.userData.vx;
          meteor.position.y += meteor.userData.vy;
          if (meteor.position.y < -5) {
            scene.remove(meteor);
            meteors.splice(i, 1);
          }
        }
        if (renderer && scene && camera) {
          renderer.render(scene, camera);
        }
      };
      animate();

      const handleResize = () => {
        if (!renderer || !camera) return;
        const width = window.innerWidth;
        const height = window.innerHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height);
      };

      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
      };
    };

    let cleanupResize: (() => void) | undefined;
    let cancelled = false;

    const loadThree = () =>
      new Promise<void>((resolve, reject) => {
        if (window.THREE) {
          resolve();
          return;
        }
        const existing = document.querySelector<HTMLScriptElement>(
          'script[data-threejs="true"]'
        );
        if (existing) {
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener("error", () => reject(), { once: true });
          return;
        }
        const script = document.createElement("script");
        script.src = THREE_CDN;
        script.async = true;
        script.defer = true;
        script.dataset.threejs = "true";
        script.onload = () => resolve();
        script.onerror = () => reject();
        document.head.appendChild(script);
      });

    loadThree()
      .then(() => {
        if (cancelled) return;
        cleanupResize = setupScene();
      })
      .catch(() => {
        // Ignore background failures to avoid blocking the app.
      });

    return () => {
      cancelled = true;
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (meteorIntervalId) {
        window.clearInterval(meteorIntervalId);
      }
      if (cleanupResize) {
        cleanupResize();
      }
      if (scene) {
        for (const meteor of meteors) {
          scene.remove(meteor);
        }
      }
      if (starGeometry) starGeometry.dispose();
      if (starMaterial) starMaterial.dispose();
      if (meteorGeometry) meteorGeometry.dispose();
      if (meteorMaterial) meteorMaterial.dispose();
      if (renderer) renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="space-background"
      aria-hidden="true"
    />
  );
}
