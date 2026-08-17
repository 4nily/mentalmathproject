// app.js
// everything except the question data lives in here

const STORAGE_KEYS = {
  profile: 'cn_profile_name',
  history: 'cn_history_v1',
  leaderboard: 'cn_leaderboard_v1',
  lastTier: 'cn_last_tier',
};

// -- small helpers --

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }
function on(el, evt, fn) { el.addEventListener(evt, fn); }
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) { return fallback; }
}

// -- profile / local name --

function getProfileName() { return load(STORAGE_KEYS.profile, null); }

function ensureProfile() {
  const name = getProfileName();
  $('#profileName').textContent = name || 'set a name';
  return name;
}

function openNameModal() {
  const modal = $('#nameModal');
  $('#nameInput').value = getProfileName() || '';
  modal.classList.remove('hidden');
  $('#nameInput').focus();
}
function closeNameModal() { $('#nameModal').classList.add('hidden'); }

on($('#profileChip'), 'click', openNameModal);
on($('#saveNameBtn'), 'click', () => {
  const val = $('#nameInput').value.trim();
  if (val) {
    save(STORAGE_KEYS.profile, val);
    ensureProfile();
  }
  closeNameModal();
});
on($('#nameInput'), 'keydown', (e) => { if (e.key === 'Enter') $('#saveNameBtn').click(); });

// -- tab navigation --

function showView(id) {
  $all('.view').forEach(v => v.classList.remove('active'));
  $(`#view-${id}`).classList.add('active');
  $all('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === id));
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  if (id === 'history') renderHistory();
  if (id === 'leaderboard') renderLeaderboard();
}

$all('.tab').forEach(tab => on(tab, 'click', () => showView(tab.dataset.view)));
on($('#jumpToPractice'), 'click', () => showView('practice'));

// -- typing animation on the home hero --

(function heroTyping() {
  const el = $('#heroTyping');
  const lines = ['47 × 8 = ?', '√144 = ?', '15% of 240 = ?', 'sin(30°) = ?', '9² − 17 = ?'];
  let li = 0, ci = 0, deleting = false;
  function tick() {
    const line = lines[li];
    if (!deleting) {
      ci++;
      el.textContent = line.slice(0, ci);
      if (ci === line.length) { deleting = true; setTimeout(tick, 1400); return; }
    } else {
      ci--;
      el.textContent = line.slice(0, ci);
      if (ci === 0) { deleting = false; li = (li + 1) % lines.length; }
    }
    setTimeout(tick, deleting ? 35 : 65);
  }
  tick();
})();

// -- band + tier picker cards --

function tierCardHTML(band, tier) {
  return `<button class="tier-card" data-band="${band.id}" data-tier="${tier.id}">
    <span class="tier-name ${tier.rank || tier.id}">${tier.name}</span>
    <span class="tier-desc">${tier.desc}</span>
  </button>`;
}

function renderBandList(containerId) {
  const container = $(containerId);
  container.innerHTML = BANDS.map(band => `
    <div class="band-block">
      <div class="band-head">
        <h3>${band.name}</h3>
        <span>4 tiers</span>
      </div>
      <p class="band-blurb">${band.blurb}</p>
      <div class="tier-row">
        ${band.tiers.map(t => tierCardHTML(band, t)).join('')}
      </div>
    </div>
  `).join('');
  container.querySelectorAll('.tier-card').forEach(card => {
    on(card, 'click', () => {
      showView('practice');
      startRun(card.dataset.band, card.dataset.tier);
    });
  });
}

renderBandList('#bandList');
renderBandList('#setupBandList');

// -- the actual 10-question run --

let run = null; // { band, tier, questions: [{expr, answer, decimals}], index, results: [], startTimes: [] }

function generateSet(tier) {
  const qs = [];
  let guard = 0;
  while (qs.length < 10 && guard < 500) {
    guard++;
    qs.push(tier.gen());
  }
  return qs;
}

function startRun(bandId, tierId) {
  const found = findTier(bandId, tierId);
  if (!found) return;
  save(STORAGE_KEYS.lastTier, { bandId, tierId });

  run = {
    band: found.band,
    tier: found.tier,
    questions: generateSet(found.tier),
    index: 0,
    results: [],
    runStart: performance.now(),
    qStart: performance.now(),
  };

  $('#practiceSetup').classList.add('hidden');
  $('#practiceResults').classList.add('hidden');
  $('#practiceRun').classList.remove('hidden');
  $('#runTierLabel').textContent = `${found.band.name} · ${found.tier.name}`;
  clearScratch();
  showQuestion();
  startClock();
}

function showQuestion() {
  const q = run.questions[run.index];
  $('#questionExpression').textContent = q.expr;
  $('#runCount').textContent = `Question ${run.index + 1} / 10`;
  $('#progressFill').style.width = `${((run.index) / 10) * 100}%`;
  $('#answerFeedback').textContent = '';
  $('#answerFeedback').className = 'feedback';
  $('#answerInput').value = '';
  $('#answerInput').focus();
  run.qStart = performance.now();
}

let clockHandle = null;
function startClock() {
  stopClock();
  clockHandle = setInterval(() => {
    const elapsed = (performance.now() - run.runStart) / 1000;
    $('#elapsedTime').textContent = elapsed.toFixed(1) + 's';
    if (run.results.length > 0) {
      const totalAnswered = run.results.reduce((s, r) => s + r.time, 0);
      $('#avgTime').textContent = (totalAnswered / run.results.length).toFixed(1) + 's';
    }
  }, 100);
}
function stopClock() { if (clockHandle) clearInterval(clockHandle); clockHandle = null; }

function isClose(given, correct, decimals) {
  if (decimals) {
    const tol = Math.pow(10, -decimals) * 0.6;
    return Math.abs(given - correct) <= tol;
  }
  return given === correct;
}

on($('#answerForm'), 'submit', (e) => {
  e.preventDefault();
  if (!run) return;
  const raw = $('#answerInput').value.trim();
  if (raw === '') return;
  const given = parseFloat(raw);
  const q = run.questions[run.index];
  const timeSec = (performance.now() - run.qStart) / 1000;
  const correct = !isNaN(given) && isClose(given, q.answer, q.decimals);

  run.results.push({
    expr: q.expr,
    given: raw,
    answer: q.answer,
    correct,
    time: timeSec,
  });

  const fb = $('#answerFeedback');
  if (correct) {
    fb.textContent = `correct — ${timeSec.toFixed(1)}s`;
    fb.className = 'feedback correct';
  } else {
    fb.textContent = `answer was ${q.answer} — ${timeSec.toFixed(1)}s`;
    fb.className = 'feedback wrong';
  }

  run.index++;
  if (run.index >= 10) {
    setTimeout(finishRun, 550);
  } else {
    setTimeout(showQuestion, 550);
  }
});

on($('#quitRun'), 'click', () => {
  if (!confirm("End this set early? It won't be saved to your history.")) return;
  stopClock();
  run = null;
  $('#practiceRun').classList.add('hidden');
  $('#practiceSetup').classList.remove('hidden');
});

function finishRun() {
  stopClock();
  $('#progressFill').style.width = '100%';

  const results = run.results;
  const correctCount = results.filter(r => r.correct).length;
  const totalTime = results.reduce((s, r) => s + r.time, 0);
  const avgTime = totalTime / results.length;
  const fastest = results.reduce((a, b) => (a.time < b.time ? a : b));
  const slowest = results.reduce((a, b) => (a.time > b.time ? a : b));

  const session = {
    id: Date.now(),
    bandId: run.band.id,
    bandName: run.band.name,
    tierId: run.tier.id,
    tierName: run.tier.name,
    date: new Date().toISOString(),
    score: correctCount,
    total: 10,
    avgTime,
    totalTime,
    results,
  };

  const history = load(STORAGE_KEYS.history, []);
  history.unshift(session);
  save(STORAGE_KEYS.history, history.slice(0, 300));

  maybeSubmitToLeaderboard(session);

  renderResults(session, fastest, slowest);

  $('#practiceRun').classList.add('hidden');
  $('#practiceResults').classList.remove('hidden');
  run = null;
}

function renderResults(session, fastest, slowest) {
  const pct = Math.round((session.score / session.total) * 100);
  const ringColor = pct >= 80 ? 'var(--mint)' : pct >= 50 ? 'var(--amber)' : 'var(--coral)';

  const rows = session.results.map((r, i) => `
    <tr class="${r.correct ? 'row-correct' : 'row-wrong'}">
      <td>${i + 1}</td>
      <td>${r.expr}</td>
      <td>${r.given}</td>
      <td>${r.answer}</td>
      <td class="${r.correct ? 'tag-correct' : 'tag-wrong'}">${r.correct ? 'correct' : 'wrong'}</td>
      <td>${r.time.toFixed(1)}s</td>
    </tr>
  `).join('');

  $('#practiceResults').innerHTML = `
    <div class="results-top">
      <div class="score-ring" style="border-color:${ringColor}; color:${ringColor}">
        <span class="num">${session.score}/${session.total}</span>
        <span class="den">${pct}%</span>
      </div>
      <div class="results-stats">
        <div class="rstat"><span class="v">${session.avgTime.toFixed(1)}s</span><span class="l">avg / question</span></div>
        <div class="rstat"><span class="v">${session.totalTime.toFixed(1)}s</span><span class="l">total time</span></div>
        <div class="rstat"><span class="v">${fastest.time.toFixed(1)}s</span><span class="l">fastest</span></div>
        <div class="rstat"><span class="v">${slowest.time.toFixed(1)}s</span><span class="l">slowest</span></div>
        <div class="rstat"><span class="v">${session.bandName.split('·')[0].trim()}</span><span class="l">${session.tierName}</span></div>
      </div>
    </div>
    <table class="breakdown-table">
      <thead><tr><th>#</th><th>question</th><th>your answer</th><th>correct answer</th><th>result</th><th>time</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="results-actions">
      <button class="btn btn-primary" id="retrySame">Redo this tier (new set) ↻</button>
      <button class="btn btn-ghost" id="backToTiers">Pick a different tier</button>
      <button class="btn btn-ghost" id="viewHistoryBtn">View history</button>
    </div>
  `;

  on($('#retrySame'), 'click', () => {
    $('#practiceResults').classList.add('hidden');
    $('#practiceRun').classList.remove('hidden');
    startRun(session.bandId, session.tierId);
  });
  on($('#backToTiers'), 'click', () => {
    $('#practiceResults').classList.add('hidden');
    $('#practiceSetup').classList.remove('hidden');
  });
  on($('#viewHistoryBtn'), 'click', () => showView('history'));
}

// -- scratch paper (type or draw) --

function clearScratch() {
  $('#scratchText').value = '';
  const canvas = $('#scratchCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
on($('#clearScratch'), 'click', clearScratch);

$all('.mini-tab').forEach(tab => on(tab, 'click', () => {
  $all('.mini-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  const isDraw = tab.dataset.mode === 'draw';
  $('#scratchText').classList.toggle('hidden', isDraw);
  $('#scratchDrawWrap').classList.toggle('hidden', !isDraw);
}));

$all('.side-tab').forEach(tab => on(tab, 'click', () => {
  $all('.side-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  $('#panel-scratch').classList.toggle('hidden', tab.dataset.panel !== 'scratch');
  $('#panel-graph').classList.toggle('hidden', tab.dataset.panel !== 'graph');
}));

(function setupDrawing() {
  const canvas = $('#scratchCanvas');
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let color = '#eaf3ff';
  let erasing = false;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const prev = document.createElement('canvas');
    prev.width = canvas.width; prev.height = canvas.height;
    prev.getContext('2d').drawImage(canvas, 0, 0);
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);
    ctx.drawImage(prev, 0, 0, rect.width, rect.height);
  }
  window.addEventListener('resize', () => {}); // keep simple, no resize redraw needed for fixed layout

  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - rect.left) * (canvas.width / rect.width), y: (t.clientY - rect.top) * (canvas.height / rect.height) };
  }

  function start(e) {
    drawing = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.preventDefault();
  }
  function move(e) {
    if (!drawing) return;
    const p = pos(e);
    ctx.lineWidth = erasing ? 18 : 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = erasing ? '#0a1a2f' : color;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    e.preventDefault();
  }
  function end() { drawing = false; }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  $all('.swatch').forEach(sw => on(sw, 'click', () => {
    $all('.swatch').forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    color = sw.dataset.color;
    erasing = false;
  }));
  on($('#eraserBtn'), 'click', () => { erasing = !erasing; $('#eraserBtn').textContent = erasing ? 'erasing…' : 'eraser'; });
})();

// -- graphing calculator --

function compileExpr(raw) {
  let expr = raw.toLowerCase().replace(/\s+/g, '');
  if (expr === '') throw new Error('empty');
  if (!/^[0-9x+\-*/^().,a-z]*$/.test(expr)) throw new Error('bad characters');
  const allowed = ['sin', 'cos', 'tan', 'sqrt', 'abs', 'log', 'ln', 'exp', 'pi', 'e', 'x'];
  const words = expr.match(/[a-z]+/g) || [];
  for (const w of words) if (!allowed.includes(w)) throw new Error('unknown token: ' + w);
  expr = expr.replace(/\^/g, '**').replace(/\bln\(/g, 'log(');
  const body = expr
    .replace(/\bsin\(/g, 'Math.sin(')
    .replace(/\bcos\(/g, 'Math.cos(')
    .replace(/\btan\(/g, 'Math.tan(')
    .replace(/\bsqrt\(/g, 'Math.sqrt(')
    .replace(/\babs\(/g, 'Math.abs(')
    .replace(/\blog\(/g, 'Math.log(')
    .replace(/\bexp\(/g, 'Math.exp(')
    .replace(/\bpi\b/g, 'Math.PI')
    .replace(/\be\b/g, 'Math.E');
  return new Function('x', `return (${body});`);
}

let graphView = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
let plottedFns = [];
const plotColors = ['#ffb454', '#4da3ff', '#ff7a8d'];

function drawGrid(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(120,175,255,0.1)';
  ctx.lineWidth = 1;
  const { xMin, xMax, yMin, yMax } = graphView;
  const xToPx = x => ((x - xMin) / (xMax - xMin)) * w;
  const yToPx = y => h - ((y - yMin) / (yMax - yMin)) * h;

  const stepX = niceStep((xMax - xMin) / 10);
  for (let gx = Math.ceil(xMin / stepX) * stepX; gx <= xMax; gx += stepX) {
    ctx.beginPath(); ctx.moveTo(xToPx(gx), 0); ctx.lineTo(xToPx(gx), h); ctx.stroke();
  }
  const stepY = niceStep((yMax - yMin) / 8);
  for (let gy = Math.ceil(yMin / stepY) * stepY; gy <= yMax; gy += stepY) {
    ctx.beginPath(); ctx.moveTo(0, yToPx(gy)); ctx.lineTo(w, yToPx(gy)); ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(234,243,255,0.4)';
  ctx.beginPath(); ctx.moveTo(0, yToPx(0)); ctx.lineTo(w, yToPx(0)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(xToPx(0), 0); ctx.lineTo(xToPx(0), h); ctx.stroke();
  return { xToPx, yToPx };
}
function niceStep(rough) {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.abs(rough) || 1)));
  const norm = rough / pow;
  let step;
  if (norm < 1.5) step = 1; else if (norm < 3.5) step = 2; else if (norm < 7.5) step = 5; else step = 10;
  return step * pow;
}

function renderGraph() {
  const canvas = $('#graphCanvas');
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d');
  const { xToPx, yToPx } = drawGrid(ctx, w, h);

  plottedFns.forEach((fn, i) => {
    ctx.strokeStyle = plotColors[i % plotColors.length];
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    const steps = w;
    for (let px = 0; px <= steps; px++) {
      const x = graphView.xMin + (px / steps) * (graphView.xMax - graphView.xMin);
      let y;
      try { y = fn.fn(x); } catch (e) { y = NaN; }
      if (typeof y !== 'number' || !isFinite(y)) { started = false; continue; }
      const py = yToPx(y);
      if (py < -1000 || py > h + 1000) { started = false; continue; }
      if (!started) { ctx.moveTo(xToPx(x), py); started = true; }
      else ctx.lineTo(xToPx(x), py);
    }
    ctx.stroke();
  });
}

on($('#plotBtn'), 'click', () => {
  const raw = $('#graphExpr').value;
  try {
    const fn = compileExpr(raw);
    fn(1); // sanity check
    plottedFns.push({ raw, fn });
    if (plottedFns.length > 3) plottedFns.shift();
    renderGraph();
  } catch (e) {
    alert("Couldn't read that expression: " + e.message);
  }
});
on($('#graphExpr'), 'keydown', (e) => { if (e.key === 'Enter') $('#plotBtn').click(); });
on($('#clearPlots'), 'click', () => { plottedFns = []; renderGraph(); });
on($('#zoomIn'), 'click', () => { zoomGraph(0.7); });
on($('#zoomOut'), 'click', () => { zoomGraph(1.4); });
on($('#resetView'), 'click', () => { graphView = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 }; renderGraph(); });
function zoomGraph(factor) {
  const cx = (graphView.xMin + graphView.xMax) / 2;
  const cy = (graphView.yMin + graphView.yMax) / 2;
  const hw = (graphView.xMax - graphView.xMin) / 2 * factor;
  const hh = (graphView.yMax - graphView.yMin) / 2 * factor;
  graphView = { xMin: cx - hw, xMax: cx + hw, yMin: cy - hh, yMax: cy + hh };
  renderGraph();
}
renderGraph();

// -- history tab --

function renderHistory() {
  const container = $('#historyList');
  const history = load(STORAGE_KEYS.history, []);
  if (history.length === 0) {
    container.innerHTML = `<div class="empty-state">No sets finished yet. Go rack up some numbers on the Practice tab.</div>`;
    return;
  }
  container.innerHTML = history.map(s => `
    <div class="history-row" data-id="${s.id}">
      <div class="hr-left">
        <span class="hr-tier">${s.bandName} · ${s.tierName}</span>
        <span class="hr-date">${new Date(s.date).toLocaleString()}</span>
      </div>
      <div class="hr-stats">
        <span><b>${s.score}/${s.total}</b> correct</span>
        <span><b>${s.avgTime.toFixed(1)}s</b> avg</span>
        <span><b>${s.totalTime.toFixed(1)}s</b> total</span>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.history-row').forEach(row => {
    on(row, 'click', () => {
      const s = history.find(h => String(h.id) === row.dataset.id);
      if (!s) return;
      const fastest = s.results.reduce((a, b) => (a.time < b.time ? a : b));
      const slowest = s.results.reduce((a, b) => (a.time > b.time ? a : b));
      showView('practice');
      $('#practiceSetup').classList.add('hidden');
      $('#practiceRun').classList.add('hidden');
      $('#practiceResults').classList.remove('hidden');
      renderResults(s, fastest, slowest);
    });
  });
}

// -- leaderboard (local demo data + your runs) --

const SEED_NAMES = ['jrod', 'mathgremlin', 'k.chen', 'squareroot99', 'A.Patel', 'notabot', 'quickcalc', 'sammy_b', 'derivative_dan', 'ninexnine'];

function seedLeaderboard() {
  const existing = load(STORAGE_KEYS.leaderboard, null);
  if (existing) return existing;
  const board = {};
  BANDS.forEach(band => {
    band.tiers.forEach(tier => {
      const key = `${band.id}:${tier.id}`;
      board[key] = SEED_NAMES.map(name => {
        const accuracy = randInt(60, 100);
        const avgTime = fmt(tier.targetAvg * (0.6 + Math.random() * 0.7));
        return { name, accuracy, avgTime, score: leaderboardScore(accuracy, avgTime), you: false };
      });
    });
  });
  save(STORAGE_KEYS.leaderboard, board);
  return board;
}

function leaderboardScore(accuracyPct, avgTime) {
  // accuracy dominates; speed is a tiebreaker-ish secondary factor
  return Math.round(accuracyPct * 10 - avgTime * 4);
}

function maybeSubmitToLeaderboard(session) {
  const name = getProfileName();
  if (!name) return; // no name set, skip silently — leaderboard is opt-in via naming yourself
  const board = seedLeaderboard();
  const key = `${session.bandId}:${session.tierId}`;
  const accuracy = (session.score / session.total) * 100;
  const entry = { name, accuracy, avgTime: fmt(session.avgTime), score: leaderboardScore(accuracy, session.avgTime), you: true };
  const list = board[key] || [];
  const filtered = list.filter(e => !(e.you && e.name === name));
  filtered.push(entry);
  filtered.sort((a, b) => b.score - a.score);
  board[key] = filtered.slice(0, 25);
  save(STORAGE_KEYS.leaderboard, board);
}

let lbSelectedKey = null;

function renderLeaderboard() {
  const board = seedLeaderboard();
  const select = $('#lbTierSelect');
  if (!lbSelectedKey) lbSelectedKey = `${BANDS[0].id}:${BANDS[0].tiers[0].id}`;

  select.innerHTML = BANDS.map(band => band.tiers.map(tier => {
    const key = `${band.id}:${tier.id}`;
    return `<button class="lb-tier-btn ${key === lbSelectedKey ? 'active' : ''}" data-key="${key}">${band.name.split('·')[0].trim()} ${tier.name}</button>`;
  }).join('')).join('');

  select.querySelectorAll('.lb-tier-btn').forEach(btn => on(btn, 'click', () => {
    lbSelectedKey = btn.dataset.key;
    renderLeaderboard();
  }));

  const rows = (board[lbSelectedKey] || []).slice().sort((a, b) => b.score - a.score);
  const myName = getProfileName();
  $('#lbBody').innerHTML = rows.map((r, i) => `
    <tr class="${r.you && r.name === myName ? 'lb-you' : ''}">
      <td>${i + 1}</td>
      <td>${r.name}${r.you ? ' (you)' : ''}</td>
      <td>${Math.round(r.accuracy)}%</td>
      <td>${r.avgTime.toFixed ? r.avgTime.toFixed(1) : r.avgTime}s</td>
      <td>${r.score}</td>
    </tr>
  `).join('');
}

// -- resources tab --

function renderResources() {
  $('#resourceGrid').innerHTML = RESOURCES.map(r => `
    <a class="resource-card" href="${r.url}" target="_blank" rel="noopener">
      <h4>${r.title}</h4>
      <p>${r.body}</p>
      <span>${r.url.replace('https://', '')} →</span>
    </a>
  `).join('');
}
renderResources();

// -- contact form --

on($('#contactForm'), 'submit', (e) => {
  e.preventDefault();
  const name = $('#cName').value.trim();
  const email = $('#cEmail').value.trim();
  const msg = $('#cMsg').value.trim();
  const subject = encodeURIComponent(`Mental Math App — message from ${name}`);
  const body = encodeURIComponent(`${msg}\n\n— ${name} (${email})`);
  window.location.href = `mailto:hello@example.com?subject=${subject}&body=${body}`;
});

// -- boot --

ensureProfile();

const lastTier = load(STORAGE_KEYS.lastTier, null);
if (lastTier && findTier(lastTier.bandId, lastTier.tierId)) {
  // nothing auto-starts, just kept for potential future "continue" affordance
}
