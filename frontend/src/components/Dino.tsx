import React, { useEffect, useRef, useState } from "react";
import { getSchoolItems, getSchoolWeeks, SchoolItem } from "../lib/supabase";

function speak(text: string, rate = 1) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = rate;
    window.speechSynthesis.speak(u);
  } catch {}
}

type Cactus = { x: number; w: number; h: number; passed: boolean };

export default function Dino() {
  const W = 700, H = 220;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [weeks, setWeeks] = useState<string[]>([]);
  const [week, setWeek] = useState<string>("Lesson 8");
  const [items, setItems] = useState<SchoolItem[]>([]);
  const [hint, setHint] = useState<{ en: string; es?: string } | null>(null);

  // load words
  useEffect(() => { getSchoolWeeks().then(ws => { setWeeks(ws); if (ws.length && !week) setWeek(ws[0]) }) }, []);
  useEffect(() => { if (week) getSchoolItems(week).then(setItems) }, [week]);

  // world/state (units: px and px/s)
  const groundY = 170;
  const dinoX = 60;
  const dino = useRef({ y: groundY, vy: 0, width: 26, height: 28, onGround: true });
  const cacti = useRef<Cactus[]>([]);
  const speed = useRef(220); // px/s
  const bgOffset = useRef(0);
  const lastTime = useRef<number | null>(null);
  const lastSpawn = useRef(0);
  const raf = useRef<number | null>(null);

  const reset = () => {
    setScore(0); setGameOver(false); setHint(null);
    dino.current = { y: groundY, vy: 0, width: 26, height: 28, onGround: true };
    cacti.current = []; speed.current = 220; bgOffset.current = 0; lastTime.current = null; lastSpawn.current = 0;
  };

  // controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (gameOver) { reset(); setRunning(true); return; }
        if (dino.current.onGround) { dino.current.vy = -420; dino.current.onGround = false; }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gameOver]);

  // loop with delta time
  useEffect(() => {
    if (!running) return;
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return;

    const loop = (t: number) => {
      if (lastTime.current == null) lastTime.current = t;
      const dt = Math.min(0.033, (t - lastTime.current) / 1000); // clamp to 33ms
      lastTime.current = t;

      // speed up slowly
      speed.current = Math.min(420, speed.current + 2 * dt * 60);
      bgOffset.current = (bgOffset.current + speed.current * dt) % 40;

      // physics dino
      dino.current.vy += 1500 * dt; // gravity
      dino.current.y += dino.current.vy * dt;
      if (dino.current.y >= groundY) { dino.current.y = groundY; dino.current.vy = 0; dino.current.onGround = true; }

      // spawn cactus
      lastSpawn.current += dt;
      const spawnEvery = 1.1 + Math.random() * 0.6;
      if (lastSpawn.current > spawnEvery) {
        lastSpawn.current = 0;
        const w = 16 + Math.random() * 12; const h = 22 + Math.random() * 16;
        cacti.current.push({ x: W + 10, w, h, passed: false });
      }

      // clear
      ctx.clearRect(0, 0, W, H);

      // background ground pattern
      ctx.strokeStyle = "#ddd"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, groundY + 10); ctx.lineTo(W, groundY + 10); ctx.stroke();
      ctx.strokeStyle = "#eee"; // dashed lines move via bgOffset
      for (let x = -bgOffset.current; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, groundY + 12); ctx.lineTo(x + 20, groundY + 12); ctx.stroke();
      }
      // clouds
      ctx.fillStyle = "#e5e7eb"; const cloudY = 40; const cloudSpeed = speed.current * 0.2;
      const cloudOffset = (bgOffset.current * cloudSpeed / speed.current) % (W + 80);
      for (let x = -cloudOffset; x < W; x += 160) {
        ctx.beginPath(); ctx.arc(x + 20, cloudY + 6, 10, 0, Math.PI * 2); ctx.arc(x + 34, cloudY + 10, 12, 0, Math.PI * 2); ctx.arc(x + 52, cloudY + 6, 10, 0, Math.PI * 2); ctx.fill();
      }

      // update/draw cacti
      ctx.fillStyle = "#2f2f2f";
      for (let i = cacti.current.length - 1; i >= 0; i--) {
        const c = cacti.current[i];
        c.x -= speed.current * dt;
        // cactus sprite simple
        ctx.fillRect(c.x, groundY - c.h, 6, c.h);
        ctx.fillRect(c.x - 5, groundY - Math.min(12, c.h * 0.6), 16, 6);
        // collision (use smaller hitbox for fairness)
        const bx = dinoX - dino.current.width / 2, by = dino.current.y - dino.current.height;
        const collide = bx + dino.current.width * 0.7 > c.x && bx + dino.current.width * 0.3 < c.x + 6 && by + dino.current.height * 0.9 > groundY - c.h;
        if (collide) { setGameOver(true); setRunning(false); }
        if (!c.passed && c.x + 6 < dinoX) {
          c.passed = true; setScore((s) => s + 1);
          if (items.length) {
            const it = items[Math.floor(Math.random() * items.length)];
            setHint({ en: it.word, es: it.es ?? undefined }); speak(it.word, 0.96);
            setTimeout(() => setHint(null), 1800);
          }
        }
        if (c.x + c.w < -20) cacti.current.splice(i, 1);
      }

      // dino sprite
      ctx.fillStyle = "#3b3b3b";
      const dx = dinoX - dino.current.width / 2; const dy = dino.current.y - dino.current.height;
      ctx.fillRect(dx, dy, dino.current.width, dino.current.height);
      // eye
      ctx.fillStyle = "#fff"; ctx.fillRect(dx + dino.current.width - 8, dy + 4, 4, 4);

      if (!gameOver) raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [running, items]);

  return (
    <section>
      <h2>Juego Dino</h2>
      <div style={{ marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
        <label>Semana:</label>
        <select value={week} onChange={(e) => setWeek(e.target.value)}>
          {[week, ...weeks.filter((w) => w !== week)].map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        <button onClick={() => { reset(); setRunning(true); }}>Iniciar</button>
        {gameOver && <span style={{ color: "#b91c1c" }}>Game Over — presiona Espacio</span>}
        <div style={{ marginLeft: "auto" }}>Puntaje: <strong>{score}</strong></div>
      </div>
      <canvas ref={canvasRef} width={W} height={H} style={{ border: "1px solid #e5e7eb", borderRadius: 8, background: "#fafafa" }} />
      {hint && (
        <div style={{ marginTop: 8, padding: 8, border: "1px solid #e5e7eb", background: "#f8fafc", borderRadius: 8 }}>
          <strong>{hint.en}</strong>{hint.es ? <span style={{ color: "#334155" }}> — {hint.es}</span> : null}
        </div>
      )}
      <div style={{ marginTop: 8, color: "#475569" }}>
        Controles: Espacio/↑ para saltar. Evita los cactus. Cada cactus superado muestra y pronuncia una palabra.
      </div>
    </section>
  );
}
