import { supabase, isSupabaseConfigured } from './supabase.js';

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
  isNight: localStorage.getItem('theme') !== 'light',
  queue: [],
  index: 0,
  user: null,
  authMode: 'signin'
};

/* ---------------- Auth ---------------- */
async function initAuth() {
  if (!isSupabaseConfigured) return;

  const { data: { session } } = await supabase.auth.getSession();
  updateUserUI(session?.user ?? null);

  supabase.auth.onAuthStateChange((_event, session) => {
    updateUserUI(session?.user ?? null);
  });
}

function updateUserUI(user) {
  state.user = user;
  const nav = $('#authNav');
  if (user) {
    nav.innerHTML = `
      <div class="user-info">
        <span class="user-email">${user.email}</span>
        <button id="signOutBtn" class="auth-icon-btn glass">🚪</button>
      </div>
    `;
    $('#signOutBtn').onclick = () => supabase.auth.signOut();
  } else {
    nav.innerHTML = `<button id="authBtn" class="auth-icon-btn glass">👤</button>`;
    $('#authBtn').onclick = () => showModal('signin');
  }
}

function showModal(mode) {
  state.authMode = mode;
  $('#authModal').classList.remove('hidden');
  $('#modalTitle').textContent = mode === 'signin' ? 'Welcome Back' : 'Create Account';
  $('#submitAuth').textContent = mode === 'signin' ? 'Sign In' : 'Sign Up';
  $('#toggleAuthText').innerHTML = mode === 'signin' 
    ? `Don't have an account? <button id="toggleAuthBtn" class="link">Sign Up</button>`
    : `Already have an account? <button id="toggleAuthBtn" class="link">Sign In</button>`;
  
  $('#toggleAuthBtn').onclick = () => showModal(mode === 'signin' ? 'signup' : 'signin');
  $('#authError').textContent = '';
}

$('#closeModal').onclick = () => $('#authModal').classList.add('hidden');

$('#authForm').onsubmit = async (e) => {
  e.preventDefault();
  const email = $('#authEmail').value;
  const password = $('#authPassword').value;
  
  const { error } = state.authMode === 'signin' 
    ? await supabase.auth.signInWithPassword({ email, password })
    : await supabase.auth.signUp({ email, password });

  if (error) {
    $('#authError').textContent = error.message;
  } else {
    if (state.authMode === 'signup') alert('Check your email!');
    $('#authModal').classList.add('hidden');
  }
};

/* ---------------- Theme & Background ---------------- */
function initTheme() {
  const checkbox = $('#themeCheckbox');
  checkbox.checked = state.isNight;
  
  const updateTheme = (isNight) => {
    state.isNight = isNight;
    localStorage.setItem('theme', isNight ? 'dark' : 'light');
    document.documentElement.classList.toggle('light-mode', !isNight);
  };

  checkbox.onchange = (e) => updateTheme(e.target.checked);
  updateTheme(checkbox.checked);
}

function renderBackground() {
  const bg = $('#bg');
  bg.innerHTML = '';
  const count = state.mood === 'hype' ? 4 : (state.mood === 'focus' ? 80 : 60);
  
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    if (state.mood === 'chill') {
      el.className = 'drop';
      el.style.left = Math.random() * 100 + '%';
      el.style.animationDuration = (0.8 + Math.random() * 0.8) + 's';
      el.style.animationDelay = (Math.random() * 1.2) + 's';
    } else if (state.mood === 'focus') {
      el.className = 'star';
      el.style.top = Math.random() * 100 + '%';
      el.style.left = Math.random() * 100 + '%';
      el.style.animationDuration = (3 + Math.random() * 4) + 's';
    } else {
      if (i >= 4) break;
      el.className = 'orb';
      const sz = 280 + Math.random() * 220;
      el.style.width = sz + 'px'; el.style.height = sz + 'px';
      el.style.top = Math.random() * 80 + '%';
      el.style.left = Math.random() * 80 + '%';
    }
    bg.appendChild(el);
  }
}

/* ---------------- Tracks ---------------- */
async function loadMoodTracks() {
  const m = MOODS.find(x => x.id === state.mood);
  const q = m.queries[Math.floor(Math.random() * m.queries.length)];
  grid.innerHTML = '<div class="loader">Loading...</div>';
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=24`);
    const data = await res.json();
    const tracks = data.results.map(r => ({
      id: r.trackId, title: r.trackName, artist: r.artistName, preview: r.previewUrl,
      artwork: r.artworkUrl100.replace('100x100', '400x400')
    }));
    renderGrid(tracks);
  } catch (e) { grid.innerHTML = 'Error loading tracks.'; }
}

function renderGrid(tracks) {
  grid.innerHTML = '';
  tracks.forEach((t, i) => {
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML = `<img src="${t.artwork}" /><div class="play-overlay"><span>▶</span></div>
      <div class="info"><div class="t">${t.title}</div><div class="a">${t.artist}</div></div>`;
    c.onclick = () => play(tracks, i);
    grid.appendChild(c);
  });
}

function play(queue, idx) {
  state.queue = queue; state.index = idx;
  const t = queue[idx];
  audio.src = t.preview; audio.play();
  $('#player').classList.remove('hidden');
  $('#pArt').src = t.artwork; $('#pTitle').textContent = t.title; $('#pArtist').textContent = t.artist;
}

/* ---------------- Player Controls ---------------- */
$('#playBtn').onclick = () => audio.paused ? audio.play() : audio.pause();
$('#nextBtn').onclick = () => play(state.queue, (state.index + 1) % state.queue.length);
$('#prevBtn').onclick = () => play(state.queue, (state.index - 1 + state.queue.length) % state.queue.length);

audio.ontimeupdate = () => {
  if (!audio.duration) return;
  $('#progress').value = (audio.currentTime / audio.duration) * 1000;
  $('#curTime').textContent = fmt(audio.currentTime);
};
$('#progress').oninput = (e) => audio.currentTime = (e.target.value / 1000) * audio.duration;
audio.onended = () => $('#nextBtn').click();
function fmt(s) { return Math.floor(s/60) + ':' + Math.floor(s%60).toString().padStart(2, '0'); }

/* ---------------- Visualizer ---------------- */
let ctx, analyser, src, dataArr;
function initViz() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = ctx.createAnalyser();
  src = ctx.createMediaElementSource(audio);
  src.connect(analyser); analyser.connect(ctx.destination);
  dataArr = new Uint8Array(analyser.frequencyBinCount);
  loop();
}
function loop() {
  requestAnimationFrame(loop);
  const canv = $('#visualizer');
  const cctx = canv.getContext('2d');
  if (analyser) {
    analyser.getByteFrequencyData(dataArr);
    cctx.clearRect(0,0,canv.width,canv.height);
    cctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary');
    for(let i=0; i<48; i++) {
      const h = (dataArr[i]/255) * canv.height;
      cctx.fillRect(i*8, canv.height-h, 5, h);
    }
  }
}
audio.onplay = initViz;

/* ---------------- Init ---------------- */
function setMood(id) {
  state.mood = id; localStorage.setItem('mood', id);
  document.documentElement.setAttribute('data-mood', id);
  const m = MOODS.find(x => x.id === id);
  $('#moodEyebrow').textContent = `Today's vibe · ${m.emoji} ${m.label}`;
  renderBackground(); loadMoodTracks();
  renderMoodButtons();
}

function renderMoodButtons() {
  const wrap = $('#moodSelector'); wrap.innerHTML = '';
  MOODS.forEach(m => {
    const b = document.createElement('button');
    b.className = `mood-btn ${state.mood === m.id ? 'active' : ''}`;
    b.innerHTML = `<span class="emoji">${m.emoji}</span><div><b>${m.label}</b><br><small>${m.tag}</small></div>`;
    b.onclick = () => setMood(m.id);
    wrap.appendChild(b);
  });
}

initAuth(); initTheme(); setMood(state.mood);
