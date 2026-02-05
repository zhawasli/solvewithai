// public/script.js

let attachedFile = null;     // File object (upload OR camera capture)
let cameraStream = null;

document.addEventListener("DOMContentLoaded", () => {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Buttons
  document.getElementById("solveBtn")?.addEventListener("click", solve);
  document.getElementById("clearBtn")?.addEventListener("click", clearAll);

  // Upload
  const fileInput = document.getElementById("fileInput");
  document.getElementById("uploadBtn")?.addEventListener("click", () => fileInput.click());
  fileInput?.addEventListener("change", () => {
    if (fileInput.files && fileInput.files[0]) {
      attachedFile = fileInput.files[0];
      showPreview(attachedFile);
    }
  });

  // Remove
  document.getElementById("removeFileBtn")?.addEventListener("click", () => {
    attachedFile = null;
    if (fileInput) fileInput.value = "";
    hidePreview();
  });

  // Camera
  document.getElementById("cameraBtn")?.addEventListener("click", openCamera);
  document.getElementById("closeCameraBtn")?.addEventListener("click", closeCamera);
  document.getElementById("snapBtn")?.addEventListener("click", snapPhoto);

  // Enter = solve, Shift+Enter newline
  const questionEl = document.getElementById("question");
  questionEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      solve();
    }
  });
});

function escapeHtml(str) {
  return (str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setAnswerHTML(html) {
  const el = document.getElementById("answer");
  if (!el) return;
  el.innerHTML = html;
  if (window.MathJax?.typeset) MathJax.typeset();
}

function clearAll() {
  const q = document.getElementById("question");
  if (q) q.value = "";
  attachedFile = null;
  document.getElementById("fileInput").value = "";
  hidePreview();
  setAnswerHTML("Your answer will appear here.");
}

// ---------- Preview ----------
function showPreview(file) {
  const wrap = document.getElementById("previewWrap");
  const img = document.getElementById("previewImg");
  const name = document.getElementById("previewName");
  const removeBtn = document.getElementById("removeFileBtn");

  wrap.style.display = "block";
  removeBtn.style.display = "inline-flex";
  name.textContent = file.name;

  if (file.type.startsWith("image/")) {
    img.style.display = "block";
    img.src = URL.createObjectURL(file);
  } else {
    img.style.display = "none";
  }
}

function hidePreview() {
  const wrap = document.getElementById("previewWrap");
  const img = document.getElementById("previewImg");
  const name = document.getElementById("previewName");
  const removeBtn = document.getElementById("removeFileBtn");

  wrap.style.display = "none";
  removeBtn.style.display = "none";
  name.textContent = "";
  img.src = "";
}

// ---------- Camera ----------
async function openCamera() {
  const modal = document.getElementById("cameraModal");
  const video = document.getElementById("cameraVideo");

  modal.style.display = "block";

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = cameraStream;
  } catch (e) {
    setAnswerHTML("Camera access denied. You can still upload a photo instead.");
    modal.style.display = "none";
  }
}

function closeCamera() {
  const modal = document.getElementById("cameraModal");
  modal.style.display = "none";

  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
}

function snapPhoto() {
  const video = document.getElementById("cameraVideo");
  const canvas = document.getElementById("cameraCanvas");

  const w = video.videoWidth;
  const h = video.videoHeight;

  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, w, h);

  canvas.toBlob((blob) => {
    if (!blob) return;
    attachedFile = new File([blob], "camera-photo.png", { type: "image/png" });
    showPreview(attachedFile);
    closeCamera();
  }, "image/png");
}

// ---------- Graph helpers ----------
function extractExprFromQuestion(q) {
  const m = (q || "").match(/y\s*=\s*([^\n\r;]+)/i);
  return m ? m[1].trim() : "";
}

function normalizeExpr(expr) {
  let s = (expr || "").trim();
  s = s.replace(/^y\s*=\s*/i, "");
  s = s.replaceAll("^", "**");

  // functions
  s = s.replaceAll(/sqrt\s*\(/gi, "Math.sqrt(");
  s = s.replaceAll(/sin\s*\(/gi, "Math.sin(");
  s = s.replaceAll(/cos\s*\(/gi, "Math.cos(");
  s = s.replaceAll(/tan\s*\(/gi, "Math.tan(");

  // pi
  s = s.replaceAll(/π/gi, "Math.PI");
  s = s.replaceAll(/\bpi\b/gi, "Math.PI");

  // implicit multiplication
  s = s
    .replace(/(\d)\s*x/gi, "$1*x")
    .replace(/(\d)\s*\(/g, "$1*(")
    .replace(/x\s*\(/gi, "x*(")
    .replace(/\)\s*x/gi, ")*x")
    .replace(/\)\s*(\d)/g, ")*$1");

  return s;
}

function renderGraphInto(containerId, expr, xMin = -10, xMax = 10) {
  if (!window.Plotly) return;

  const safe = normalizeExpr(expr);
  if (!safe) return;

  const xs = [];
  const ys = [];
  const n = 300;
  const step = (xMax - xMin) / n;

  let f;
  try {
    f = new Function("x", `return (${safe});`);
  } catch {
    document.getElementById(containerId).innerHTML = "Could not graph this expression.";
    return;
  }

  for (let i = 0; i <= n; i++) {
    const x = xMin + i * step;
    xs.push(x);
    let y = null;
    try {
      const v = f(x);
      y = Number.isFinite(v) ? v : null;
    } catch {
      y = null;
    }
    ys.push(y);
  }

  Plotly.newPlot(
    containerId,
    [{
      x: xs, y: ys,
      type: "scatter",
      mode: "lines",
      line: { color: "#ffffff", width: 4 }, // white
      name: "y"
    }],
    {
      autosize: true,
      margin: { t: 10, r: 10, b: 50, l: 55 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      xaxis: {
        title: { text: "x", font: { color: "#ffffff" } },
        tickfont: { color: "#ffffff" },
        gridcolor: "rgba(255,255,255,0.15)",
        zerolinecolor: "rgba(255,255,255,0.4)",
        linecolor: "#ffffff"
      },
      yaxis: {
        title: { text: "y", font: { color: "#ffffff" } },
        tickfont: { color: "#ffffff" },
        gridcolor: "rgba(255,255,255,0.15)",
        zerolinecolor: "rgba(255,255,255,0.4)",
        linecolor: "#ffffff",
        autorange: true
      }
    },
    { displayModeBar: false, responsive: true }
  );
}

// ---------- UI builder (Answer first + separate dropdowns) ----------
function buildAnswerUI(sol, originalQuestion) {
  const finalAnswer = sol?.finalAnswer ? escapeHtml(sol.finalAnswer) : "—";
  const steps = Array.isArray(sol?.steps) ? sol.steps : [];
  const examples = Array.isArray(sol?.examples) ? sol.examples : [];
  const visual = sol?.visual || { type: "none" };

  const stepsHtml = steps.length ? steps.map((s, i) => `
    <div class="item">
      <div class="itemTitle">Step ${i + 1}${s.title ? ` — ${escapeHtml(s.title)}` : ""}</div>
      <div class="itemText">${escapeHtml(s.text || "")}</div>
    </div>
  `).join("") : `<div class="muted">No steps returned.</div>`;

  const examplesHtml = examples.length ? examples.slice(0, 1).map(ex => `
    <div class="item">
      <div class="itemTitle">Similar example</div>
      <div class="itemText"><b>Problem:</b> ${escapeHtml(ex.problem || "")}</div>
      <div class="itemText"><b>Answer:</b> ${escapeHtml(ex.answer || "")}</div>
    </div>
  `).join("") : `<div class="muted">No examples returned.</div>`;

  // Graph dropdown separate:
  const qLower = (originalQuestion || "").toLowerCase();
  const askedGraph = qLower.includes("graph") || qLower.includes("plot") || qLower.includes("y =");

  let graphExpr = "";
  if (visual.type === "graph" && visual.expr) graphExpr = visual.expr;
  if (!graphExpr && askedGraph) graphExpr = extractExprFromQuestion(originalQuestion);

  const graphDetails = graphExpr ? `
    <details id="graphDetails" class="panel details">
      <summary class="summaryBtn">Show graph</summary>
      <div class="detailsBody">
        <div id="plot" style="height:340px;"></div>
      </div>
    </details>
  ` : "";

  const html = `
    <div class="stack">
      <div class="panel">
        <div class="panelLabel">Final Answer</div>
        <div class="final">${finalAnswer}</div>
      </div>

      ${graphDetails}

      <details class="panel details" open>
        <summary class="summaryBtn">Show explanation</summary>
        <div class="detailsBody">
          <div class="panel">
            <div class="panelLabel">Steps</div>
            ${stepsHtml}
          </div>
          <div class="panel" style="margin-top:12px;">
            <div class="panelLabel">Examples</div>
            ${examplesHtml}
          </div>
        </div>
      </details>
    </div>
  `;

  setAnswerHTML(html);

  // Render graph only when "Show graph" opened
  const gd = document.getElementById("graphDetails");
  if (gd && graphExpr) {
    gd.addEventListener("toggle", () => {
      if (gd.open) setTimeout(() => renderGraphInto("plot", graphExpr, -10, 10), 50);
    });
  }
}

// ---------- Solve (send text + optional file) ----------
async function solve() {
  const question = (document.getElementById("question")?.value || "").trim();
  const level = document.getElementById("level")?.value || "middle";
  const solveBtn = document.getElementById("solveBtn");

  if (!question && !attachedFile) {
    setAnswerHTML("Type a question or upload a photo 🙂");
    return;
  }

  setAnswerHTML("Thinking… ⏳");
  if (solveBtn) solveBtn.disabled = true;

  try {
    const form = new FormData();
    form.append("question", question);
    form.append("level", level);
    if (attachedFile) form.append("photo", attachedFile);

    const response = await fetch("/solve", { method: "POST", body: form });
    const data = await response.json();

    if (data.solution) buildAnswerUI(data.solution, question);
    else setAnswerHTML(`<div style="white-space:pre-wrap; line-height:1.6;">${escapeHtml(data.answer || "No response.")}</div>`);
  } catch {
    setAnswerHTML("Couldn’t reach the server. Make sure it’s running.");
  } finally {
    if (solveBtn) solveBtn.disabled = false;
  }
}
