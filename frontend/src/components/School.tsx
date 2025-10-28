import React, { useEffect, useMemo, useState } from "react";
import { SchoolItem, getSchoolItems, getSchoolWeeks } from "../lib/supabase";

function speak(text: string, opts?: { rate?: number }) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    if (opts?.rate) u.rate = opts.rate;
    window.speechSynthesis.speak(u);
  } catch {}
}

async function speakRepeat(text: string, repeat = 2, rate = 0.85, gapMs = 900) {
  for (let i = 0; i < repeat; i++) {
    speak(text, { rate });
    await new Promise((res) => setTimeout(res, gapMs));
  }
}

type Mode = "spelling" | "dictation";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[’']/g, "'")
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function School() {
  const [weeks, setWeeks] = useState<string[]>([]);
  const [week, setWeek] = useState<string>("Lesson 8");
  const [items, setItems] = useState<SchoolItem[]>([]);
  const [mode, setMode] = useState<Mode>("spelling");

  // practice
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [errors, setErrors] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [dys, setDys] = useState<boolean>(() => localStorage.getItem("dyslexic") === "1");
  const [showHint, setShowHint] = useState(false);
  const [hintCountdown, setHintCountdown] = useState(0);

  // exam / list
  const [examActive, setExamActive] = useState(false);
  const [examQueue, setExamQueue] = useState<SchoolItem[]>([]);
  const [examIndex, setExamIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState<{ item: SchoolItem; ok: boolean; answer: string }[]>([]);
  const [listActive, setListActive] = useState(false);

  useEffect(() => {
    getSchoolWeeks().then((ws) => {
      setWeeks(ws);
      if (ws.length && !week) setWeek(ws[0]);
    });
  }, []);
  useEffect(() => {
    if (week) getSchoolItems(week).then(setItems);
  }, [week]);

  // autoclose hint in 5s
  useEffect(() => {
    if (!showHint) return;
    setHintCountdown(5);
    const id = setInterval(() => {
      setHintCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          setShowHint(false);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [showHint, idx, examIndex]);

  const current = useMemo(() => items[idx], [items, idx]);
  // Para máxima compatibilidad en impresión/export, usamos '_' para ocultar vocales
  const hint = useMemo(() => (current ? current.word.replace(/[aeiou]/gi, " _ ") : ""), [current]);
  const styles = dys ? { letterSpacing: "0.06em", wordSpacing: "0.16em" } : {};

  const check = () => {
    if (!current) return;
    const target = mode === "dictation" && current.sentence ? current.sentence : current.word;
    const ok = normalize(answer) === normalize(target);
    if (ok) {
      setScore((s) => s + (mode === "dictation" && current.sentence ? 2 : 1));
      setFeedback("Bien hecho!");
      setAnswer("");
      setIdx((i) => (i + 1) % Math.max(items.length, 1));
      setShowHint(false);
    } else {
      setErrors((e) => e + 1);
      setFeedback("Casi. Intentalo de nuevo. Escucha otra vez o usa pista.");
    }
  };

  // exam helpers
  const examCurrent = examQueue[examIndex];
  const examDone = examActive && examAnswers.length === examQueue.length && examQueue.length > 0;
  const examWrong = examAnswers.filter((a) => !a.ok);
  const startExam = () => {
    const pool = items.length > 10 ? shuffle(items).slice(0, 10) : [...items];
    setExamQueue(pool);
    setExamIndex(0);
    setExamAnswers([]);
    setExamActive(true);
    setAnswer("");
    setFeedback("");
    setErrors(0);
    setScore(0);
    setShowHint(false);
  };
  const submitExamAnswer = () => {
    if (!examCurrent) return;
    const target = mode === "dictation" && examCurrent.sentence ? examCurrent.sentence : examCurrent.word;
    const ok = normalize(answer) === normalize(target);
    setExamAnswers((prev) => [...prev, { item: examCurrent, ok, answer }]);
    if (!ok) setErrors((e) => e + 1);
    else setScore((s) => s + (mode === "dictation" && examCurrent.sentence ? 2 : 1));
    setAnswer("");
    setFeedback(ok ? "Correcto" : "Casi. Quedara en la lista de repaso.");
    if (examIndex + 1 < examQueue.length) {
      setExamIndex((i) => i + 1);
      setShowHint(false);
    }
  };

  const Tab = ({
    active,
    children,
    onClick,
  }: {
    active: boolean;
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      style={{
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid " + (active ? "#0ea5e9" : "#cbd5e1"),
        background: active ? "#e0f2fe" : "#fff",
        color: "#0f172a",
      }}
    >
      {children}
    </button>
  );

  const weekArrows = (() => {
    const i = Math.max(weeks.indexOf(week), 0);
    const prev = i > 0 ? weeks[i - 1] : null;
    const next = i >= 0 && i < weeks.length - 1 ? weeks[i + 1] : null;
    return (
      <>
        <button onClick={() => prev && setWeek(prev)} disabled={!prev}>
          ◀
        </button>
        <select value={week} onChange={(e) => setWeek(e.target.value)}>
          {[week, ...weeks.filter((w) => w !== week)].map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        <button onClick={() => next && setWeek(next)} disabled={!next}>
          ▶
        </button>
      </>
    );
  })();

  return (
    <section>
      <h2>Escuela</h2>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <Tab active={!examActive && !listActive && mode === "spelling"} onClick={() => { setExamActive(false); setListActive(false); setMode("spelling") }}>Spelling</Tab>
        <Tab active={!examActive && !listActive && mode === "dictation"} onClick={() => { setExamActive(false); setListActive(false); setMode("dictation") }}>Dictation</Tab>
        <Tab active={listActive} onClick={() => { setExamActive(false); setListActive(true) }}>Lista</Tab>
        <Tab active={examActive} onClick={() => { setListActive(false); startExam() }}>Examen</Tab>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <label>Semana:</label>
        {weekArrows}
        <label style={{ marginLeft: 12 }}>
          <input
            type="checkbox"
            checked={dys}
            onChange={(e) => {
              setDys(e.target.checked);
              localStorage.setItem("dyslexic", e.target.checked ? "1" : "0");
            }}
          />
          &nbsp;Modo lectura (espaciado + pistas)
        </label>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span>
            Puntaje: <strong>{score}</strong>
          </span>
          <span>
            Errores: <strong>{errors}</strong>
          </span>
          {examActive && !examDone && <span> Pregunta {examIndex + 1}/{examQueue.length}</span>}
          {examActive && examDone && <span> Examen finalizado</span>}
        </div>
      </div>

      {examActive ? (
        examDone ? (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, maxWidth: 960 }}>
            <h3>Resumen del examen</h3>
            <div style={{ marginBottom: 8 }}>
              Correctas: <strong>{examAnswers.filter((a) => a.ok).length}</strong> · Incorrectas: <strong>{examWrong.length}</strong>
            </div>
            {examWrong.length > 0 ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ marginBottom: 6, color: "#334155" }}>Palabras a reforzar:</div>
                <ul>
                  {examWrong.map((w, i) => (
                    <li key={i}>
                      {w.item.word} {w.item.sentence ? <em>- {w.item.sentence}</em> : null} (tu: "{w.answer}")
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      setExamQueue(examWrong.map((w) => w.item));
                      setExamIndex(0);
                      setExamAnswers([]);
                      setAnswer("");
                      setErrors(0);
                      setScore(0);
                      setShowHint(false);
                    }}
                  >
                    Reintentar solo fallos
                  </button>
                  <button onClick={startExam}>Nuevo examen</button>
                  <button onClick={() => setExamActive(false)}>Salir</button>
                </div>
              </div>
            ) : (
              <div style={{ color: "#065f46" }}>Excelente! Todas correctas.</div>
            )}
          </div>
        ) : examCurrent ? (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, maxWidth: 960, display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: "#475569", marginBottom: 6 }}>
                {examCurrent.kind} #{examCurrent.idx}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, ...styles }}>
                {mode === "spelling" ? examCurrent.word.replace(/[aeiou]/gi, " _ ") : "Escucha y escribe"}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => speak(mode === "dictation" && examCurrent.sentence ? examCurrent.sentence : examCurrent.word)}>
                  Escuchar {mode === "dictation" && examCurrent.sentence ? "oracion" : "palabra"}
                </button>
                <button onClick={() => setShowHint(true)}>Pista</button>
              </div>
              <div style={{ marginTop: 12 }}>
                <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Escribe aqui" style={{ padding: 8, width: 280 }} />
                <button onClick={submitExamAnswer} style={{ marginLeft: 8 }}>
                  Responder
                </button>
              </div>
              {feedback && <div style={{ marginTop: 8 }}>{feedback}</div>}
            </div>
            <div style={{ border: "1px dashed #94a3b8", borderRadius: 8, padding: 12, background: "#f8fafc", color: "#0f172a", display: showHint ? "block" : "none" }}>
              <div style={{ fontSize: 12, color: "#334155", marginBottom: 6 }}>Pista</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{examCurrent.word}</div>
              {examCurrent.es && <div style={{ marginTop: 6, color: "#334155" }}>Espanol: <strong>{examCurrent.es}</strong></div>}
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setShowHint(false)}>Ocultar pista</button>
                {hintCountdown > 0 && <span style={{ color: "#334155" }}>Se oculta en {hintCountdown}s</span>}
              </div>
            </div>
          </div>
        ) : null
      ) : current ? (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, maxWidth: 960, display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 6 }}>
              {current.kind} #{current.idx}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, ...styles }}>{mode === "spelling" ? hint : "Escucha y escribe"}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => speak(mode === "dictation" && current.sentence ? current.sentence : current.word)}>
                Escuchar {mode === "dictation" && current.sentence ? "oracion" : "palabra"}
              </button>
              <button onClick={() => setShowHint(true)}>Pista</button>
              {mode === "dictation" && current.sentence && <button onClick={() => speak(current.word)}>Pista: palabra</button>}
            </div>
            <div style={{ marginTop: 12 }}>
              <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Escribe aqui" style={{ padding: 8, width: 280 }} />
              <button onClick={check} style={{ marginLeft: 8 }}>Comprobar</button>
            </div>
            {feedback && <div style={{ marginTop: 8 }}>{feedback}</div>}
          </div>
          <div style={{ border: "1px dashed #94a3b8", borderRadius: 8, padding: 12, background: "#f8fafc", color: "#0f172a", display: showHint ? "block" : "none" }}>
            <div style={{ fontSize: 12, color: "#334155", marginBottom: 6 }}>Pista</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{current.word}</div>
            {current.es && <div style={{ marginTop: 6, color: "#334155" }}>Espanol: <strong>{current.es}</strong></div>}
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setShowHint(false)}>Ocultar pista</button>
              {hintCountdown > 0 && <span style={{ color: "#334155" }}>Se oculta en {hintCountdown}s</span>}
            </div>
          </div>
        </div>
      ) : (
        <p>No hay items cargados para esta semana.</p>
      )}

      {!examActive && listActive && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, maxWidth: 960, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Lista de la semana</h3>
            <button style={{ marginLeft: "auto" }} onClick={() => exportListPdf(week, items)}>
              Exportar PDF
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "6px 4px" }}>#</th>
                <th style={{ padding: "6px 4px" }}>Palabra</th>
                <th style={{ padding: "6px 4px" }}>Espanol</th>
                <th style={{ padding: "6px 4px" }}>Oracion</th>
                <th style={{ padding: "6px 4px" }}>Audio</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "6px 4px", color: "#475569" }}>{it.idx}</td>
                  <td style={{ padding: "6px 4px", fontWeight: 600 }}>{it.word}</td>
                  <td style={{ padding: "6px 4px", color: "#334155" }}>{it.es ?? ""}</td>
                  <td style={{ padding: "6px 4px", color: "#64748b" }}>{it.sentence ?? ""}</td>
                  <td style={{ padding: "6px 4px", display: "flex", gap: 6 }}>
                    <button onClick={() => speak(it.word)}>▶ Palabra</button>
                    <button onClick={() => it.sentence && speak(it.sentence!)} disabled={!it.sentence}>▶ Oración</button>
                    <button onClick={() => speakRepeat(it.sentence || it.word, 2, 0.85)} title="Repetir x2 lento">x2 lento</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function exportListPdf(week: string, items: SchoolItem[]) {
  try {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = items
      .map(
        (it) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${it.idx}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:600">${it.word}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${it.es ?? ""}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#475569">${it.sentence ?? ""}</td>
      </tr>`
      )
      .join("");
    const practiceRows = items
      .map((it) => {
        const h = it.word.replace(/[aeiou]/gi, " _ ");
        return `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${it.idx}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb"><strong>${h}</strong></td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${it.es ?? ""}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb">______________________________</td>
      </tr>`;
      })
      .join("");
    const html = `<!doctype html><html><head>
      <meta charset="utf-8" />
      <title>Lista ${week}</title>
      <style>
        body{font-family:system-ui,Arial,sans-serif;padding:24px}
        h1{font-size:20px;margin:0 0 12px}
        table{width:100%;border-collapse:collapse}
        th{text-align:left;border-bottom:1px solid #94a3b8;padding:6px 8px}
        .page-break{page-break-before:always}
      </style>
    </head><body>
      <h1>Lista - ${week}</h1>
      <table>
        <thead><tr><th>#</th><th>Palabra</th><th>Espanol</th><th>Oracion</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="page-break"></div>
      <h1>Practica - ${week}</h1>
      <table>
        <thead><tr><th>#</th><th>Pista</th><th>Espanol</th><th>Respuesta</th></tr></thead>
        <tbody>${practiceRows}</tbody>
      </table>
      <script>window.onload=()=>{window.print(); setTimeout(()=>window.close(), 300);}</script>
    </body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  } catch {}
}

