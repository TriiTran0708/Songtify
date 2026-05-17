import { supabase, isSupabaseConfigured } from './supabase.js';

/*
  Supabase favorites table schema (run in Supabase SQL editor):

  create table favorites (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) not null,
    track_id text not null,
    track jsonb not null,
    created_at timestamptz default now(),
    unique (user_id, track_id)
  );

  Notes:
  - Grant Row Level Security as needed and enable RLS, then add policies to allow
    authenticated users to insert/delete their own rows (using auth.uid()).
  - For development you can allow public inserts, but do not use service_role keys on client.

*/

const $ = (sel) => document.querySelector(sel);
const grid = $('#grid');
const audio = $('#audio');

const state = {
  isNight: localStorage.getItem('theme') !== 'light',
  queue: [],
  index: 0,
  user: null,
  authMode: 'signin',
  favorites: JSON.parse(localStorage.getItem('favorites') || '[]'),
  showFavorites: false,
  currentQuery: ''
};

/* ---------------- Auth ---------------- */
async function initAuth() {
  // Initialize auth listener even if VITE env vars are not set — the client may be using
  // the fallback project/key provided in src/supabase.js.
  const { data: { session } } = await supabase.auth.getSession();
  updateUserUI(session?.user ?? null);
  if (session?.user) await loadFavoritesFromSupabase(session.user);
  supabase.auth.onAuthStateChange(async (_event, session) => {
    const user = session?.user ?? null;
    updateUserUI(user);
    if (user) await loadFavoritesFromSupabase(user);
    else {
      // if signed out, restore locally saved favorites
      state.favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    }
  });
}

async function loadFavoritesFromSupabase(user) {
  if (!user || !isSupabaseConfigured) return;
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('track')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('Failed to load favorites from Supabase', error);
      return;
    }
    const tracks = (data || []).map(r => r.track).filter(Boolean);
    state.favorites = tracks;
    localStorage.setItem('favorites', JSON.stringify(state.favorites));
    if (state.showFavorites) renderGrid(state.favorites);
  } catch (err) { console.warn('loadFavoritesFromSupabase err', err); }
}

async function saveFavoriteToSupabase(user, track) {
  if (!user || !isSupabaseConfigured) return;
  try {
    const payload = { user_id: user.id, track_id: String(track.id), track };
    const { error } = await supabase.from('favorites').upsert(payload, { onConflict: ['user_id', 'track_id'] });
    if (error) console.warn('saveFavoriteToSupabase error', error);
  } catch (err) { console.warn('saveFavoriteToSupabase err', err); }
}

async function removeFavoriteFromSupabase(user, track) {
  if (!user || !isSupabaseConfigured) return;
  try {
    const { error } = await supabase.from('favorites').delete().match({ user_id: user.id, track_id: String(track.id) });
    if (error) console.warn('removeFavoriteFromSupabase error', error);
  } catch (err) { console.warn('removeFavoriteFromSupabase err', err); }
}

function updateUserUI(user) {
  state.user = user;
  const nav = $('#authNav');
  nav.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'auth-container';
  container.style.position = 'relative';

  const avatarBtn = document.createElement('button');
  avatarBtn.className = 'auth-icon-btn glass';
  avatarBtn.id = 'authAvatarBtn';
  avatarBtn.type = 'button';
  avatarBtn.textContent = '👤';
  avatarBtn.setAttribute('aria-haspopup', 'true');
  avatarBtn.setAttribute('aria-expanded', 'false');

  const menu = document.createElement('div');
  menu.className = 'auth-menu hidden';
  menu.style.position = 'absolute';
  menu.style.right = '0';
  menu.style.top = '44px';
  menu.style.minWidth = '160px';
  menu.style.zIndex = '50';
  menu.style.padding = '8px';
  menu.style.borderRadius = '8px';
  menu.style.boxShadow = '0 6px 18px rgba(0,0,0,.12)';
  menu.style.background = 'var(--card-bg, #ffffff)';

  if (user) {
    menu.innerHTML = `
      <div class="menu-email muted">${escapeHtml(user.email || '')}</div>
      <button id="signOutBtn" class="btn-link">Sign out</button>
    `;
  } else {
    menu.innerHTML = `
      <button id="signInBtn" class="btn-link">Sign In</button>
      <button id="signUpBtn" class="btn-link">Sign Up</button>
    `;
  }

  avatarBtn.onclick = (e) => {
    e.stopPropagation();
    const hidden = menu.classList.toggle('hidden');
    avatarBtn.setAttribute('aria-expanded', (!hidden).toString());
  };

  // Ensure single global handler
  if (window._authMenuHandler) document.removeEventListener('click', window._authMenuHandler);
  window._authMenuHandler = (ev) => {
    if (!container.contains(ev.target)) {
      if (!menu.classList.contains('hidden')) menu.classList.add('hidden');
      avatarBtn.setAttribute('aria-expanded', 'false');
    }
  };
  document.addEventListener('click', window._authMenuHandler);

  container.appendChild(avatarBtn);
  container.appendChild(menu);
  nav.appendChild(container);

  if (user) {
    const out = menu.querySelector('#signOutBtn');
    if (out) out.onclick = (e) => { e.stopPropagation(); supabase.auth.signOut(); };
  } else {
    const inBtn = menu.querySelector('#signInBtn');
    const upBtn = menu.querySelector('#signUpBtn');
    if (inBtn) inBtn.onclick = (e) => { e.stopPropagation(); showModal('signin'); menu.classList.add('hidden'); };
    if (upBtn) upBtn.onclick = (e) => { e.stopPropagation(); showModal('signup'); menu.classList.add('hidden'); };
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
  if (error) $('#authError').textContent = error.message;
  else $('#authModal').classList.add('hidden');
};

/* ---------------- Theme ---------------- */
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

/* ---------------- iTunes API ---------------- */
async function searchITunes(term, limit = 40) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&limit=${limit}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.results
    .filter(r => r.previewUrl)
    .map(r => ({
      id: String(r.trackId),
      title: r.trackName,
      artist: r.artistName,
      artwork: r.artworkUrl100.replace('100x100', '400x400'),
      preview: r.previewUrl,
    }));
}

async function loadTracks(query = 'trending hits') {
  state.showFavorites = false;
  renderSkeleton();
  try {
    const tracks = await searchITunes(query);
    renderGrid(tracks);
  } catch (e) {
    grid.innerHTML = '<p class="error">Không thể tải nhạc. Hãy thử lại sau.</p>';
  }
}

function renderSkeleton() {
  grid.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const d = document.createElement('div');
    d.className = 'card skeleton';
    grid.appendChild(d);
  }
}

/* ---------------- Favorites Management ---------------- */
function toggleFavorite(track) {
  const idx = state.favorites.findIndex(f => String(f.id) === String(track.id));
  if (idx > -1) {
    state.favorites.splice(idx, 1);
  } else {
    state.favorites.unshift(track);
  }

  // Persist: if user signed in and supabase configured, sync to DB; else fallback to localStorage
  const user = state.user;
  if (user && isSupabaseConfigured) {
    if (idx > -1) removeFavoriteFromSupabase(user, track);
    else saveFavoriteToSupabase(user, track);
  } else {
    localStorage.setItem('favorites', JSON.stringify(state.favorites));
  }

  if (state.showFavorites) {
    renderGrid(state.favorites);
  } else {
    const cards = document.querySelectorAll(`[data-id="${track.id}"]`);
    cards.forEach(card => {
      const btn = card.querySelector('.fav-btn');
      if (btn) btn.classList.toggle('active', idx === -1);
    });
  }
}

$('#favToggleBtn').onclick = () => {
  state.showFavorites = !state.showFavorites;
  // Update navbar button style
  const favBtn = $('#favToggleBtn');
  if (state.showFavorites) {
    favBtn.style.color = '#ff4757';
    favBtn.style.borderColor = '#ff4757';
    favBtn.textContent = '💖';
    $('#sectionTitle').textContent = 'Nhạc yêu thích';
    renderGrid(state.favorites);
  } else {
    favBtn.style.color = 'inherit';
    favBtn.style.borderColor = 'hsl(var(--border) / .15)';
    favBtn.textContent = '❤️';
    $('#sectionTitle').textContent = state.currentQuery ? `Kết quả: ${state.currentQuery}` : 'Thịnh hành';
    if (state.currentQuery) loadTracks(state.currentQuery);
    else loadTracks();
  }
};

/* ---------------- Rendering ---------------- */
function renderGrid(tracks) {
  grid.innerHTML = '';
  if (!tracks || tracks.length === 0) {
    grid.innerHTML = `<p class="empty-msg">${state.showFavorites ? 'Chưa có bài hát yêu thích nào.' : 'Không tìm thấy kết quả.'}</p>`;
    return;
  }
  tracks.forEach((t, i) => {
    const isFav = state.favorites.some(f => f.id === t.id);
    const c = document.createElement('div');
    c.className = 'card';
    c.setAttribute('data-id', t.id);
    c.innerHTML = `
      <img src="${t.artwork}" alt="${t.title}" loading="lazy" />
      <div class="play-overlay"><span>▶</span></div>
      <button class="fav-btn ${isFav ? 'active' : ''}" title="Yêu thích">❤️</button>
      <div class="info">
        <div class="t">${escapeHtml(t.title)}</div>
        <div class="a">${escapeHtml(t.artist)}</div>
      </div>`;
    
    c.onclick = (e) => {
      if (e.target.closest('.fav-btn')) return;
      play(tracks, i);
    };

    c.querySelector('.fav-btn').onclick = (e) => {
      e.stopPropagation();
      toggleFavorite(t);
    };
    
    grid.appendChild(c);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] || c));
}

/* ---------------- Player ---------------- */
function play(queue, idx) {
  state.queue = queue; 
  state.index = idx;
  const t = queue[idx];
  audio.src = t.preview; 
  audio.play().catch(e => console.warn("Playback error:", e));
  $('#player').classList.remove('hidden');
  $('#pArt').src = t.artwork; 
  $('#pTitle').textContent = t.title; 
  $('#pArtist').textContent = t.artist;
}

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

function fmt(s) { 
  if (isNaN(s)) return '0:00';
  const min = Math.floor(s/60);
  const sec = Math.floor(s%60).toString().padStart(2, '0');
  return `${min}:${sec}`; 
}

/* ---------------- Visualizer ---------------- */
let ctx, analyser, src, dataArr;
function initViz() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = ctx.createAnalyser();
    src = ctx.createMediaElementSource(audio);
    src.connect(analyser); 
    analyser.connect(ctx.destination);
    dataArr = new Uint8Array(analyser.frequencyBinCount);
    loop();
  } catch(e) {}
}
function loop() {
  requestAnimationFrame(loop);
  const canv = $('#visualizer');
  const cctx = canv.getContext('2d');
  if (analyser) {
    analyser.getByteFrequencyData(dataArr);
    cctx.clearRect(0, 0, canv.width, canv.height);
    const styles = getComputedStyle(document.documentElement);
    const primary = styles.getPropertyValue('--primary').trim();
    cctx.fillStyle = `hsl(${primary})`;
    const bars = 48;
    const barWidth = canv.width / bars;
    for(let i=0; i<bars; i++) {
        const v = dataArr[i] / 255;
        const h = v * canv.height;
        cctx.fillRect(i * barWidth, canv.height - h, barWidth - 2, h);
    }
  }
}
audio.onplay = () => {
  initViz();
  if (ctx?.state === 'suspended') ctx.resume();
};

/* ---------------- Search & Init ---------------- */
$('#searchInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const q = e.target.value.trim();
    state.currentQuery = q;
    if (q) {
      $('#sectionTitle').textContent = `Kết quả: ${q}`;
      loadTracks(q);
    } else {
      $('#sectionTitle').textContent = 'Thịnh hành';
      loadTracks();
    }
  }
});

initAuth(); 
initTheme(); 
loadTracks();
