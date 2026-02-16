// ============================================
// Campus360 — Auth JS (login.html)
// ============================================

const API_BASE = 'php/auth.php';

// --- Tab Switching ---
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    const formId = tab.dataset.tab === 'login' ? 'loginForm' : 'signupForm';
    document.getElementById(formId).classList.add('active');
    clearMessage();
  });
});

// --- Message display ---
function showMessage(text, type = 'error') {
  const el = document.getElementById('authMessage');
  el.textContent = text;
  el.className = 'auth-message ' + type;
}

function clearMessage() {
  const el = document.getElementById('authMessage');
  el.className = 'auth-message';
  el.textContent = '';
}

// --- Login ---
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage();
  const btn = e.target.querySelector('.auth-submit');
  btn.disabled = true;
  btn.textContent = 'Logging in...';

  try {
    const formData = new FormData();
    formData.append('action', 'login');
    formData.append('identifier', document.getElementById('loginIdentifier').value.trim());
    formData.append('password', document.getElementById('loginPassword').value);

    const res = await fetch(API_BASE, { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      showMessage('Login successful! Redirecting...', 'success');
      setTimeout(() => { window.location.href = 'index.html'; }, 800);
    } else {
      showMessage(data.error || 'Login failed');
    }
  } catch (err) {
    showMessage('Network error. Make sure WAMP is running.');
  }

  btn.disabled = false;
  btn.textContent = 'Login';
});

// --- Signup ---
document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage();
  const btn = e.target.querySelector('.auth-submit');
  btn.disabled = true;
  btn.textContent = 'Creating account...';

  try {
    const formData = new FormData();
    formData.append('action', 'signup');
    formData.append('name', document.getElementById('signupName').value.trim());
    formData.append('username', document.getElementById('signupUsername').value.trim());
    formData.append('regno', document.getElementById('signupRegno').value.trim());
    formData.append('email', document.getElementById('signupEmail').value.trim());
    formData.append('password', document.getElementById('signupPassword').value);

    const res = await fetch(API_BASE, { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      showMessage('Account created! Redirecting...', 'success');
      setTimeout(() => { window.location.href = 'index.html'; }, 800);
    } else {
      showMessage(data.error || 'Signup failed');
    }
  } catch (err) {
    showMessage('Network error. Make sure WAMP is running.');
  }

  btn.disabled = false;
  btn.textContent = 'Create Account';
});

// --- Check if already logged in ---
(async function checkSession() {
  try {
    const res = await fetch(API_BASE + '?action=check');
    const data = await res.json();
    if (data.loggedIn) {
      window.location.href = 'index.html';
    }
  } catch (e) {
    // Not connected to server — stay on login page
  }
})();
