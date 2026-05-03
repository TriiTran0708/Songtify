/* ============================================================
   SONGTIFY - Web version (HTML/CSS/JS)
   - Auth (localStorage)
   - Music player (HTML5 Audio, mp3 lưu IndexedDB qua blob URL)
   - Search, Like, Rating
   - AI DJ (Gemini API gọi trực tiếp - cần key)
   - Audio Manager (clip start/end, metadata)
   ============================================================ */

/* ---------- Storage helpers (localStorage) ---------- */
const LS = {
  get(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
  del(k) { localStorage.removeItem(k); },
};
const loadUsers = () => LS.get('songtify.users', {});
const saveUser = (email, password, name) => {
  const users = loadUsers();
  if (users[email]) return false;
  users[email] = { password, name };
  LS.set('songtify.users', users);
  return true;
};
const loadLastEmail = () => LS.get('songtify.session', { last_email: '' }).last_email;
const saveLastEmail = (email) => LS.set('songtify.session', { last_email: email });
const loadSongData = () => LS.get('songtify.song_data', {});
const saveSongData = (d) => LS.set('songtify.song_data', d);
const getApiKey = () => LS.get('songtify.gemini_key', '');
const setApiKey = (k) => LS.set('songtify.gemini_key', k);

/* ---------- IndexedDB for MP3 blobs ---------- */
const DB_NAME = 'songtify-db';
const STORE = 'tracks';
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbPut(name, blob) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, name);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function dbGet(name) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(name);
    r.onsuccess = () => res(r.result || null);
    r.onerror = () => rej(r.error);
  });
}
async function dbDelete(name) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(name);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function dbRename(oldName, newName) {
  const blob = await dbGet(oldName);
  if (!blob) return;
  await dbPut(newName, blob);
  await dbDelete(oldName);
}
async function dbList() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).getAllKeys();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => rej(r.error);
  });
}

/* ---------- DOM refs ---------- */
const $ = (id) => document.getElementById(id);
const authScreen = $('authScreen');
const loginPanel = $('loginPanel');
const signupPanel = $('signupPanel');
const mainApp = $('mainApp');
const audioEl = $('audio');

/* ---------- Toast ---------- */
function toast(msg, ms = 1800) {
  const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast._h); toast._h = setTimeout(() => t.classList.add('hidden'), ms);
}

/* ---------- AUTH wiring ---------- */
$('goSignup').onclick = () => { loginPanel.classList.add('hidden'); signupPanel.classList.remove('hidden'); };
$('goLogin').onclick = () => { signupPanel.classList.add('hidden'); loginPanel.classList.remove('hidden'); };

$('btnLogin').onclick = () => {
  const email = $('loginEmail').value.trim();
  const pw = $('loginPassword').value;
  if (!email || !pw) return toast('Please fill in all fields.');
  const users = loadUsers();
  if (users[email] && users[email].password === pw) {
    saveLastEmail(email);
    enterApp();
  } else toast('Incorrect email or password.');
};
$('btnSignup').onclick = () => {
  const email = $('signupEmail').value.trim();
  const pw = $('signupPassword').value;
  const name = $('signupName').value.trim();
  if (!email || !pw || !name) return toast('Please fill in all fields.');
  if (saveUser(email, pw, name)) {
    toast('Account created! Please log in.');
    $('goLogin').click();
  } else toast('This email is already registered.');
};
[ 'loginEmail', 'loginPassword' ].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') $('btnLogin').click(); }));

/* Auto-login */
window.addEventListener('DOMContentLoaded', async () => {
  const last = loadLastEmail();
  if (last) {
    $('loginEmail').value = last;
    enterApp();
  }
});

/* ---------- Enter main app ---------- */
async function enterApp() {
  authScreen.classList.add('hidden');
  mainApp.classList.remove('hidden');
  // profile
  const email = loadLastEmail();
  const u = loadUsers()[email];
  $('profileName').textContent = u?.name || 'User';
  $('profileEmail').textContent = `Email: ${email}`;
  // gemini key
  $('geminiKey').value = getApiKey();
  await refreshAll();
}

/* ---------- Tabs ---------- */
document.querySelectorAll('.sb-btn[data-tab]').forEach(btn => {
  btn.onclick = () => switchTab(btn.dataset.tab);
});
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('hidden', t.dataset.tab !== name));
  document.querySelectorAll('.sb-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  if (name === 'liked') renderLiked();
  if (name === 'audio') { refreshSelectors(); }
}

/* ---------- Logout ---------- */
$('btnLogout').onclick = () => {
  saveLastEmail('');
  audioEl.pause();
  mainApp.classList.add('hidden');
  authScreen.classList.remove('hidden');
  loginPanel.classList.remove('hidden');
  signupPanel.classList.add('hidden');
  $('loginPassword').value = '';
};

/* ---------- Upload ---------- */
$('btnUpload').onclick = () => $('fileInput').click();
$('fileInput').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const name = file.name.toLowerCase().endsWith('.mp3') ? file.name : file.name + '.mp3';
  await dbPut(name, file);
  toast('Uploaded!');
  await refreshAll();
  e.target.value = '';
};

/* ---------- Delete song (sidebar quick) ---------- */
$('btnDeleteSong').onclick = async () => {
  const files = await dbList();
  if (!files.length) return toast('No songs.');
  const name = prompt('Tên bài hát muốn xóa:\n' + files.join('\n'));
  if (!name) return;
  if (!files.includes(name)) return toast('Không tìm thấy bài: ' + name);
  if (!confirm(`Delete ${name}?`)) return;
  await dbDelete(name);
  const data = loadSongData(); delete data[name]; saveSongData(data);
  toast('Deleted.');
  await refreshAll();
};

/* ---------- Render songs ---------- */
async function refreshAll() {
  await renderHome();
  renderLiked();
  refreshSelectors();
}

async function getFiles() {
  const list = await dbList();
  return list.sort();
}

async function renderHome() {
  const files = await getFiles();
  const wrap = $('homeList');
  wrap.innerHTML = '';
  if (!files.length) {
    wrap.innerHTML = '<p class="muted">No music. Upload some MP3!</p>';
    return;
  }
  const data = loadSongData();
  files.forEach(name => wrap.appendChild(songItem(name, data[name] || {}, () => renderHome())));
  filterHome();
}
function renderLiked() {
  const wrap = $('likedList'); wrap.innerHTML = '';
  const data = loadSongData();
  const liked = Object.entries(data).filter(([_, d]) => d.liked).map(([n]) => n);
  if (!liked.length) { wrap.innerHTML = '<p class="muted">No liked songs.</p>'; return; }
  liked.sort().forEach(name => wrap.appendChild(songItem(name, data[name] || {}, renderLiked)));
}

function songItem(filename, info, reload) {
  const el = document.createElement('div');
  el.className = 'song-item';
  el.dataset.name = filename;
  const display = (info.custom_title || filename.replace(/\.mp3$/i, ''));
  el.innerHTML = `
    <span class="icon">♫</span>
    <span class="name">${escapeHTML(display)}</span>
    <select class="rating">
      <option value="0">Rate</option>
      <option value="1">★</option>
      <option value="2">★★</option>
      <option value="3">★★★</option>
      <option value="4">★★★★</option>
      <option value="5">★★★★★</option>
    </select>
    <button class="like ${info.liked ? 'liked' : ''}">${info.liked ? '♥' : '♡'}</button>
    <button class="play">▶</button>
  `;
  const rating = el.querySelector('.rating');
  rating.value = String(info.rating || 0);
  rating.onclick = e => e.stopPropagation();
  rating.onchange = () => {
    const d = loadSongData(); d[filename] = { ...(d[filename] || {}), rating: Number(rating.value) };
    saveSongData(d);
  };
  const likeBtn = el.querySelector('.like');
  likeBtn.onclick = (e) => {
    e.stopPropagation();
    const d = loadSongData(); d[filename] = { ...(d[filename] || {}), liked: !(d[filename]?.liked) };
    saveSongData(d); reload && reload();
  };
  el.querySelector('.play').onclick = (e) => { e.stopPropagation(); playSong(filename); };
  el.onclick = () => playSong(filename);
  return el;
}
function escapeHTML(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ---------- Search filter ---------- */
$('searchInput').addEventListener('input', filterHome);
function filterHome() {
  const q = $('searchInput').value.toLowerCase().trim();
  document.querySelectorAll('#homeList .song-item').forEach(el => {
    el.style.display = el.dataset.name.toLowerCase().includes(q) ? '' : 'none';
  });
}

/* ---------- Player ---------- */
let currentSong = null;
let clipPreviewEnd = null; // seconds
async function playSong(filename, startSec = 0) {
  const blob = await dbGet(filename);
  if (!blob) return toast('File không tìm thấy!');
  if (audioEl.dataset.url) URL.revokeObjectURL(audioEl.dataset.url);
  const url = URL.createObjectURL(blob);
  audioEl.dataset.url = url;
  audioEl.src = url;
  audioEl.currentTime = startSec || 0;
  audioEl.play();
  $('btnPlay').textContent = '⏸';
  const info = loadSongData()[filename] || {};
  $('nowPlaying').textContent = info.custom_title || filename.replace(/\.mp3$/i, '');
  currentSong = filename;
  clipPreviewEnd = null;
}
$('btnPlay').onclick = () => {
  if (!audioEl.src) return;
  if (audioEl.paused) { audioEl.play(); $('btnPlay').textContent = '⏸'; }
  else { audioEl.pause(); $('btnPlay').textContent = '▶'; }
};
audioEl.addEventListener('timeupdate', () => {
  const d = audioEl.duration || 0, c = audioEl.currentTime || 0;
  $('seekBar').max = d || 100;
  $('seekBar').value = c;
  $('timeLabel').textContent = `${fmt(c)} / ${fmt(d)}`;
  if (clipPreviewEnd != null && c >= clipPreviewEnd) {
    audioEl.pause(); $('btnPlay').textContent = '▶';
    clipPreviewEnd = null; $('editorStatus').textContent = 'Clip preview finished.';
  }
});
audioEl.addEventListener('ended', () => $('btnPlay').textContent = '▶');
$('seekBar').addEventListener('input', () => { audioEl.currentTime = Number($('seekBar').value); });
$('volBar').addEventListener('input', () => { audioEl.volume = Number($('volBar').value) / 100; });
audioEl.volume = 0.7;
function fmt(s) { s = Math.floor(s || 0); const m = Math.floor(s / 60), r = s % 60; return `${m}:${String(r).padStart(2, '0')}`; }

/* ---------- AI DJ (Gemini direct) ---------- */
$('saveKey').onclick = () => { setApiKey($('geminiKey').value.trim()); toast('Đã lưu key.'); };
$('btnSendAI').onclick = sendAI;
$('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendAI(); });

function appendChat(sender, text, cls) {
  const div = document.createElement('div'); div.className = 'chat-msg';
  div.innerHTML = `<b class="${cls}">${sender}:</b> ${escapeHTML(text)}`;
  $('chatHistory').appendChild(div);
  $('chatHistory').scrollTop = $('chatHistory').scrollHeight;
  return div;
}

async function sendAI() {
  const prompt = $('chatInput').value.trim();
  if (!prompt) return;
  const key = getApiKey();
  if (!key) return toast('Hãy dán Gemini API Key vào ô phía trên và nhấn Lưu.');
  appendChat('Bạn', prompt, 'user');
  $('chatInput').value = '';
  $('chatInput').disabled = true;
  const thinking = appendChat('AI DJ', '...đang suy nghĩ...', 'ai');

  const files = await getFiles();
  let context = "Bạn là AI DJ của Songtify. Trả lời ngắn gọn bằng tiếng Việt.";
  if (files.length) context += `\nList nhạc hiện có: [${files.join(', ')}]. Chỉ gợi ý bài trong này khi user hỏi.`;
  if (currentSong) context += `\nĐang phát: '${currentSong}'.`;
  const fullPrompt = `${context}\nUser: ${prompt}\nAI:`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: fullPrompt }] }] })
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || 'Gemini error');
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '(Không có phản hồi)';
    thinking.innerHTML = `<b class="ai">AI DJ:</b> ${escapeHTML(text)}`;
  } catch (err) {
    thinking.innerHTML = `<b class="ai">AI DJ:</b> Lỗi: ${escapeHTML(err.message)}`;
  } finally {
    $('chatInput').disabled = false; $('chatInput').focus();
    $('chatHistory').scrollTop = $('chatHistory').scrollHeight;
  }
}

/* ---------- Audio Manager ---------- */
async function refreshSelectors() {
  const files = await getFiles();
  const fill = (sel) => {
    const cur = sel.value;
    sel.innerHTML = files.map(f => `<option>${escapeHTML(f)}</option>`).join('');
    if (files.includes(cur)) sel.value = cur;
  };
  fill($('editorSelect'));
  fill($('manageSelect'));
  applyClipValues();
  onManageChange();
}
$('editorSelect').onchange = applyClipValues;
$('manageSelect').onchange = onManageChange;

function applyClipValues() {
  const f = $('editorSelect').value;
  const has = !!f;
  ['clipStart','clipEnd'].forEach(id => $(id).disabled = !has);
  if (!has) {
    $('clipStart').value = 0; $('clipEnd').value = 0;
    $('editorStatus').textContent = 'Upload a track to start editing.';
    return;
  }
  const d = loadSongData()[f] || {};
  let s = +d.clip_start || 0, e = +d.clip_end || 0;
  if (e <= s) e = s + 30;
  $('clipStart').value = s; $('clipEnd').value = e;
  $('editorStatus').textContent = (d.clip_start != null || d.clip_end != null)
    ? `Clip range loaded: ${s.toFixed(2)}s - ${e.toFixed(2)}s`
    : 'Define a new clip range and save it.';
}
function onManageChange() {
  const f = $('manageSelect').value;
  const has = !!f;
  ['manageTitle','manageDuration','btnApplyMeta','btnDeleteAudio'].forEach(id => $(id).disabled = !has);
  if (!has) { $('manageTitle').value=''; $('manageDuration').value=0; $('manageStatus').textContent='Add a track to begin managing audio.'; return; }
  const base = f.replace(/\.mp3$/i,'');
  const d = loadSongData()[f] || {};
  $('manageTitle').value = d.custom_title || base;
  $('manageDuration').value = +d.custom_duration || 0;
  $('manageStatus').textContent = `Ready to manage ${base}.`;
}

$('btnSaveClip').onclick = () => {
  const f = $('editorSelect').value; if (!f) return toast('Select a track.');
  const s = +$('clipStart').value, e = +$('clipEnd').value;
  if (s >= e) return toast('End time must be greater than start.');
  const d = loadSongData(); d[f] = { ...(d[f]||{}), clip_start: s, clip_end: e };
  saveSongData(d); $('editorStatus').textContent = `Clip saved: ${s.toFixed(2)}s - ${e.toFixed(2)}s`;
};
$('btnPreviewClip').onclick = () => {
  const f = $('editorSelect').value; if (!f) return toast('Select a track.');
  const s = +$('clipStart').value, e = +$('clipEnd').value;
  if (s >= e) return toast('End must be > start.');
  clipPreviewEnd = e;
  playSong(f, s);
  $('editorStatus').textContent = `Previewing clip ${s.toFixed(2)}s - ${e.toFixed(2)}s`;
};
$('btnClearClip').onclick = () => {
  const f = $('editorSelect').value; if (!f) return;
  const d = loadSongData(); if (d[f]) { delete d[f].clip_start; delete d[f].clip_end; saveSongData(d); }
  $('editorStatus').textContent = 'Clip data cleared.'; applyClipValues();
};

$('btnApplyMeta').onclick = async () => {
  const f = $('manageSelect').value; if (!f) return toast('Select a track.');
  const newTitle = $('manageTitle').value.trim(); if (!newTitle) return toast('Enter a title.');
  const newFile = newTitle.toLowerCase().endsWith('.mp3') ? newTitle : `${newTitle}.mp3`;
  const data = loadSongData();
  let target = f;
  if (newFile !== f) {
    const all = await dbList();
    if (all.includes(newFile)) return toast('Another track already uses that name.');
    await dbRename(f, newFile);
    data[newFile] = data[f] || {}; delete data[f]; target = newFile;
  }
  data[target] = { ...(data[target]||{}), custom_title: newTitle, custom_duration: +$('manageDuration').value };
  saveSongData(data);
  $('manageStatus').textContent = `Metadata saved for ${newTitle}.`;
  await refreshAll();
};
$('btnDeleteAudio').onclick = async () => {
  const f = $('manageSelect').value; if (!f) return;
  if (!confirm(`Delete ${f}?`)) return;
  await dbDelete(f);
  const d = loadSongData(); delete d[f]; saveSongData(d);
  $('manageStatus').textContent = `${f} deleted.`;
  await refreshAll();
};
$('btnUploadAudio').onclick = () => $('fileInput').click();
