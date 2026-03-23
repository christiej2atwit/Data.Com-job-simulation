async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadUsers() {
  try {
    const users = await fetchJSON('/api/users');
    const sel = document.getElementById('toUser');
    sel.innerHTML = users.map(u => `<option value="${u.id}">${u.name} — ${u.role}</option>`).join('');
  } catch (e) {
    console.error('Failed to load users', e);
  }
}

function renderFeed(items) {
  const feed = document.getElementById('feed');
  if (!items.length) {
    feed.innerHTML = '<p>No kudos yet — be the first!</p>';
    return;
  }
  feed.innerHTML = items.map(i => {
    const d = new Date(i.timestamp);
    return `<div class="kudo"><div class="meta"><strong>${i.fromUserName}</strong> → <strong>${i.toUserName}</strong> <span class="time">${d.toLocaleString()}</span></div><div class="msg">${escapeHtml(i.message)}</div></div>`;
  }).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
}

async function loadFeed() {
  try {
    const items = await fetchJSON('/api/kudos');
    renderFeed(items);
  } catch (e) {
    console.error('Failed to load feed', e);
  }
}

document.getElementById('kudosForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const toUserId = document.getElementById('toUser').value;
  const fromUserName = document.getElementById('fromName').value.trim();
  const message = document.getElementById('message').value.trim();
  try {
    await fetchJSON('/api/kudos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUserId, fromUserName, message })
    });
    document.getElementById('message').value = '';
    loadFeed();
  } catch (e) {
    alert('Failed to send kudos');
    console.error(e);
  }
});

// init
loadUsers();
loadFeed();
setInterval(loadFeed, 10000);

// Expose a small helper for debugging in browser console
window.__kudos_reload = loadFeed;
