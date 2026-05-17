import { supabase, isSupabaseConfigured } from './supabase.js';
import { applySavedTheme, setThemeLight } from './theme.js';

const $ = (s) => document.querySelector(s);

const state = { mode: 'signin' };

function setMode(mode) {
  state.mode = mode;
  $('#heading').textContent = mode === 'signin' ? 'Welcome back' : 'Create an account';
  $('#submitBtn').textContent = mode === 'signin' ? 'Sign In' : 'Sign Up';
  $('#switchText').innerHTML = mode === 'signin'
    ? `Don't have an account? <button id="switchBtn" class="link">Sign Up</button>`
    : `Already have an account? <button id="switchBtn" class="link">Sign In</button>`;
  $('#switchBtn').onclick = () => setMode(mode === 'signin' ? 'signup' : 'signin');
  $('#error').textContent = '';
}

$('#authForm').onsubmit = async (e) => {
  e.preventDefault();
  const email = $('#email').value.trim();
  const password = $('#password').value;
  $('#submitBtn').disabled = true;
  $('#error').textContent = '';
  try {
    // Use the configured supabase client (falls back to the built-in defaults if env vars aren't set)
    if (state.mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
    }
    // on success, redirect back to app root
    window.location.href = '/';
  } catch (err) {
    $('#error').textContent = err?.message || String(err);
  } finally {
    $('#submitBtn').disabled = false;
  }
};

// initialize
setMode('signin');

// optional: prefill email from query param ?email=
try {
  const params = new URLSearchParams(window.location.search);
  const e = params.get('email');
  if (e) $('#email').value = e;
} catch(e) {}

// Apply saved theme so auth page respects user's choice
applySavedTheme();

// Add a small theme toggle for the auth page
const themeToggle = document.createElement('button');
themeToggle.className = 'link-small';
themeToggle.style.marginLeft = '12px';
themeToggle.textContent = document.documentElement.classList.contains('light-mode') ? 'Use dark' : 'Use light';
themeToggle.onclick = () => {
  const isLight = document.documentElement.classList.toggle('light-mode');
  setThemeLight(isLight);
  themeToggle.textContent = isLight ? 'Use dark' : 'Use light';
};
document.querySelector('.auth-actions')?.appendChild(themeToggle);
