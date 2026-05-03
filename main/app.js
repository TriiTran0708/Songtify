// SoundScape — Vanilla JS edition
// Uses iTunes Search API (free, CORS-enabled) for 30s preview tracks.

const MOODS = [
  { id: 'chill', label: 'Chill', emoji: '😌', tag: 'Drift into purple rain',
    queries: ['lofi chill', 'chillhop', 'lofi beats', 'chill ambient'] },
  { id: 'focus', label: 'Focus', emoji: '📚', tag: 'Quiet mind, deep work',
    queries: ['focus instrumental', 'study music', 'ambient focus', 'piano focus'] },
  { id: 'hype',  label: 'Hype',  emoji: '🎉', tag: 'Neon nights, loud beats',
    queries: ['edm party', 'hype hip hop', 'electronic dance', 'pop party'] },
];

const $ = (sel) => document.querySelector(sel);
const grid = $('#grid');
const audio = $('#audio');

const state = {
  mood: localStorage.getItem('mood') || 'chill',
  queue: [],
  index: 0,
};

/* ---------------- Mood UI ---------------- */
function renderMoods() {
  const wrap = $('#moodSelector');
  wrap.innerHTML = '';
  MOODS.forEach((m) => {
    const btn = document.createElement('button');
    btn.className = 'mood-btn' + (state.mood === m.id ? ' active' : '');
    btn.innerHTML = `<span class="emoji">${m.emoji}</span>
      <span><span class="label">${m.label}</span><br><span class="tag">${m.tag}</span></span>`;
    btn.onclick = () => setMood(m.id);
    wrap.appendChild(btn);
  });
}

function setMood(id) {
  state.mood = id;
  localStorage.setItem('mood', id);
  document.documentElement.setAttribute('data-mood', id);
  const m = MOODS.find((x) => x.id === id);
  $('#moodEyebrow').textContent = `Today's vibe · ${m.emoji} ${m.label}`;
  $('#sectionTitle').textContent = `${m.label} picks`;
  renderMoods();
  renderBackground();
  loadMoodTracks();
}

/* ---------------- Background animations ---------------- */
function renderBackground() {
  const bg = $('#bg');
  bg.innerHTML = '';
  if (state.mood === 'chill') {
    for (let i = 0; i < 60; i++) {
      const d = document.createElement('span');
      d.className = 'drop';
      d.style.left = Math.random() * 100 + '%';
      d.style.animationDuration = (0.8 + Math.random() * 0.8) + 's';
      d.style.animationDelay = (Math.random() * 1.2) + 's';
      d.style.opacity = (0.2 + Math.random() * 0.5).toString();
      bg.appendChild(d);
    }
  } else if (state.mood === 'focus') {
    for (let i = 0; i < 80; i++) {
      const s = document.createElement('span');
      s.className = 'star';
      const sz = Math.random() < 0.9 ? 1 : 2;
      s.style.width = sz + 'px';
      s.style.height = sz + 'px';
      s.style.top = Math.random() * 100 + '%';
      s.style.left = Math.random() * 100 + '%';
      s.style.animationDuration = (3 + Math.random() * 4) + 's';
      s.style.animationDelay = (Math.random() * 4) + 's';
      bg.appendChild(s);
    }
  } else if (state.mood === 'hype') {
    const colors = ['hsl(320 100% 60% / .6)', 'hsl(60 100% 55% / .5)', 'hsl(180 100% 60% / .4)'];
    for (let i = 0; i < 4; i++) {
      const o = document.createElement('span');
      o.className = 'orb';
      const sz = 280 + Math.random() * 220;
      o.style.width = sz + 'px';
      o.style.height = sz + 'px';
      o.style.background = colors[i % colors.length];
      o.style.top = (Math.random() * 80) + '%';
      o.style.left = (Math.random() * 80) + '%';
      o.style.animationDelay = i + 's';
      bg.appendChild(o);
    }
  }
}

/* ---------------- iTunes Search ---------------- */
async function searchITunes(term, limit = 24) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&limit=${limit}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.results
    .filter((r) => r.previewUrl)
    .map((r) => ({
      id: String(r.trackId),
      title: r.trackName,
      artist: r.artistName,
      artwork: (r.artworkUrl100 || '').replace('100x100', '400x400'),
      preview: r.previewUrl,
    }));
}

async function loadMoodTracks() {
  const m = MOODS.find((x) => x.id === state.mood);
  const q = m.queries[Math.floor(Math.random() * m.queries.length)];
  renderSkeleton();
  try {
    const tracks = await searchITunes(q, 24);
    renderGrid(tracks);
  } catch (e) {
    grid.innerHTML = `<p style="color:hsl(var(--muted))">Couldn't load tracks. Try again later.</p>`;
  }
}

function renderSkeleton() {
  grid.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const d = document.createElement('div');
    d.className = 'card';
    d.style.aspectRatio = '1/1';
    d.style.opacity = '.4';
    grid.appendChild(d);
  }
}

function renderGrid(tracks) {
  grid.innerHTML = '';
  tracks.forEach((t, i) => {
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML = `
      <img src="${t.artwork}" alt="${t.title}" loading="lazy" />
      <div class="play-overlay"><span>▶</span></div>
      <div class="info">
        <div class="t">${escapeHtml(t.title)}</div>
        <div class="a">${escapeHtml(t.artist)}</div>
      </div>`;
    c.onclick = () => playFromQueue(tracks, i);
    grid.appendChild(c);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

/* ---------------- Player ---------------- */
function playFromQueue(queue, idx) {
  state.queue = queue;
  state.index = idx;
  const t = queue[idx];
  audio.src = t.preview;
  audio.play().catch(() => {});
  $('#player').classList.remove('hidden');
  $('#pArt').src = t.artwork;
  $('#pTitle').textContent = t.title;
  $('#pArtist').textContent = t.artist;
}

$('#playBtn').onclick = () => audio.paused ? audio.play() : audio.pause();
$('#nextBtn').onclick = () => {
  if (!state.queue.length) return;
  state.index = (state.index + 1) % state.queue.length;
  playFromQueue(state.queue, state.index);
};
$('#prevBtn').onclick = () => {
  if (!state.queue.length) return;
  state.index = (state.index - 1 + state.queue.length) % state.queue.length;
  playFromQueue(state.queue, state.index);
};
audio.addEventListener('play', () => ($('#playBtn').textContent = '⏸'));
audio.addEventListener('pause', () => ($('#playBtn').textContent = '▶'));
audio.addEventListener('ended', () => $('#nextBtn').click());
audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return;
  $('#progress').value = (audio.currentTime / audio.duration) * 1000;
  $('#curTime').textContent = fmt(audio.currentTime);
  $('#durTime').textContent = fmt(audio.duration);
});
$('#progress').oninput = (e) => {
  if (audio.duration) audio.currentTime = (e.target.value / 1000) * audio.duration;
};
$('#volume').oninput = (e) => (audio.volume = e.target.value / 100);
audio.volume = 0.8;

function fmt(s) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

/* ---------------- Visualizer (Web Audio API) ---------------- */
let audioCtx, analyser, source;
function initVisualizer() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    source = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
  } catch (e) { /* ignore */ }
}
audio.addEventListener('play', () => {
  initVisualizer();
  if (audioCtx?.state === 'suspended') audioCtx.resume();
});

const canvas = $('#visualizer');
const cctx = canvas.getContext('2d');
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
}
window.addEventListener('resize', resizeCanvas);

const data = new Uint8Array(64);
function drawViz() {
  requestAnimationFrame(drawViz);
  if (!canvas.clientWidth) return;
  if (canvas.width !== canvas.clientWidth * (devicePixelRatio || 1)) resizeCanvas();
  const w = canvas.width, h = canvas.height;
  cctx.clearRect(0, 0, w, h);
  if (analyser) analyser.getByteFrequencyData(data);
  else for (let i = 0; i < 64; i++) data[i] = 0;

  const styles = getComputedStyle(document.documentElement);
  const primary = styles.getPropertyValue('--primary').trim();
  const accent = styles.getPropertyValue('--accent').trim();
  const grad = cctx.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0, `hsl(${primary})`);
  grad.addColorStop(1, `hsl(${accent})`);
  cctx.fillStyle = grad;

  const bars = 48, gap = 3;
  const bw = (w - gap * (bars - 1)) / bars;
  for (let i = 0; i < bars; i++) {
    const v = data[i] / 255;
    const bh = Math.max(2, v * h);
    cctx.fillRect(i * (bw + gap), h - bh, bw, bh);
  }
}
drawViz();

/* ---------------- Search form ---------------- */
$('#searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $('#searchInput').value.trim();
  if (!q) { loadMoodTracks(); return; }
  $('#sectionTitle').textContent = `Results for "${q}"`;
  renderSkeleton();
  try {
    const tracks = await searchITunes(q, 24);
    renderGrid(tracks);
  } catch {}
});

/* ---------------- Init ---------------- */
document.documentElement.setAttribute('data-mood', state.mood);
renderMoods();
renderBackground();
setMood(state.mood);
