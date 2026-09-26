// ecsite 運用コンソール — 画面のボタン操作だけでAPI一式を検証するための管理画面。
// フレームワーク不使用、fetch APIのみで完結させている(このダッシュボード自体は学習用の検証ツールのため)。

const state = {
  products: [],
  members: [],
  orders: [],
  cart: [],
  history: [],
};

const el = (id) => document.getElementById(id);

/* ---------- トースト通知 ---------- */
function showToast(message, kind = 'default') {
  const region = el('toast-region');
  const toast = document.createElement('div');
  toast.className = `toast ${kind === 'error' ? 'toast-error' : kind === 'success' ? 'toast-success' : ''}`;
  toast.textContent = message;
  region.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

/* ---------- 共通fetchラッパー ---------- */
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;
  if (!res.ok) {
    const message = body?.error?.message || `リクエストに失敗しました (${res.status})`;
    throw new Error(message);
  }
  return body;
}

/* ---------- ヘルスチェック ---------- */
async function refreshHealth() {
  const pill = el('health-pill');
  const label = el('health-label');
  try {
    const data = await api('/health');
    pill.className = 'pill pill-ok';
    label.textContent = `正常稼働中 (DB: ${data.db})`;
  } catch (err) {
    pill.className = 'pill pill-error';
    label.textContent = '接続できません';
  }
}

/* ---------- 商品 ---------- */
async function refreshProducts() {
  const data = await api('/api/products?pageSize=50');
  state.products = data.items;
  renderProducts();
  renderOrderProductOptions();
  renderCartProductOptions();
  renderHistoryProductOptions();
}

function formatYen(cents) {
  return `¥${cents.toLocaleString('ja-JP')}`;
}

function renderProducts() {
  const tbody = el('products-tbody');
  el('products-count').textContent = `${state.products.length}件`;
  if (state.products.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">商品がまだ登録されていません</td></tr>';
    return;
  }
  tbody.innerHTML = state.products
    .map(
      (p) => `
      <tr data-id="${p.id}">
        <td>${escapeHtml(p.name)}</td>
        <td class="mono">${formatYen(p.priceCents)}</td>
        <td class="mono">${p.stock}</td>
        <td><button class="icon-btn" data-action="delete-product" data-id="${p.id}">削除</button></td>
      </tr>`
    )
    .join('');
}

function renderOrderProductOptions() {
  const select = el('order-product-select');
  const current = select.value;
  select.innerHTML =
    '<option value="">商品を選択してください</option>' +
    state.products
      .filter((p) => p.isActive)
      .map((p) => `<option value="${p.id}">${escapeHtml(p.name)} — ${formatYen(p.priceCents)}(在庫${p.stock})</option>`)
      .join('');
  select.value = current;
}

function renderCartProductOptions() {
  const select = el('cart-product-select');
  const current = select.value;
  select.innerHTML =
    '<option value="">商品を選択してください</option>' +
    state.products
      .filter((p) => p.isActive)
      .map((p) => `<option value="${p.id}">${escapeHtml(p.name)} — ${formatYen(p.priceCents)}</option>`)
      .join('');
  select.value = current;
}

function renderHistoryProductOptions() {
  const select = el('history-product-select');
  const current = select.value;
  select.innerHTML =
    '<option value="">商品を選択してください</option>' +
    state.products
      .filter((p) => p.isActive)
      .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
      .join('');
  select.value = current;
}

/* ---------- 会員 ---------- */
async function refreshMembers() {
  const data = await api('/api/members?pageSize=50');
  state.members = data.items;
  renderMembers();
  renderOrderMemberOptions();
  renderCartMemberOptions();
  renderHistoryMemberOptions();
}

function renderMembers() {
  const tbody = el('members-tbody');
  el('members-count').textContent = `${state.members.length}件`;
  if (state.members.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="3">会員がまだ登録されていません</td></tr>';
    return;
  }
  tbody.innerHTML = state.members
    .map(
      (m) => `
      <tr>
        <td>${escapeHtml(m.name)}</td>
        <td class="mono">${escapeHtml(m.email)}</td>
        <td class="mono">${formatDate(m.createdAt)}</td>
      </tr>`
    )
    .join('');
}

function renderOrderMemberOptions() {
  const select = el('order-member-select');
  const current = select.value;
  select.innerHTML =
    '<option value="">会員を選択してください</option>' +
    state.members.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}(${escapeHtml(m.email)})</option>`).join('');
  select.value = current;
}

function renderCartMemberOptions() {
  const select = el('cart-member-select');
  const current = select.value;
  select.innerHTML =
    '<option value="">会員を選択してください</option>' +
    state.members.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}(${escapeHtml(m.email)})</option>`).join('');
  select.value = current;
}

function renderHistoryMemberOptions() {
  const select = el('history-member-select');
  const current = select.value;
  select.innerHTML =
    '<option value="">会員を選択してください</option>' +
    state.members.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}(${escapeHtml(m.email)})</option>`).join('');
  select.value = current;
}

/* ---------- 注文(非同期処理の可視化がこの画面の核) ---------- */
async function refreshOrders() {
  const data = await api('/api/orders?pageSize=30');
  state.orders = data.items;
  renderOrders();
}

function renderOrders() {
  const tbody = el('orders-tbody');
  if (state.orders.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">注文がまだありません</td></tr>';
    return;
  }
  tbody.innerHTML = state.orders
    .map((o) => {
      const member = state.members.find((m) => m.id === o.memberId);
      const elapsedMs = new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime();
      const isSettled = o.status === 'PAID' || o.status === 'CANCELLED' || o.status === 'SHIPPED';
      const elapsedLabel = isSettled
        ? `<span class="elapsed-chip done">${(elapsedMs / 1000).toFixed(2)}秒で確定</span>`
        : `<span class="elapsed-chip">処理待ち…</span>`;
      return `
      <tr data-id="${o.id}">
        <td class="mono">${o.id.slice(0, 8)}…</td>
        <td>${member ? escapeHtml(member.name) : '(不明)'}</td>
        <td class="mono">${formatYen(o.totalCents)}</td>
        <td><span class="status-badge status-${o.status}">${o.status}</span></td>
        <td>${elapsedLabel}</td>
      </tr>`;
    })
    .join('');
}

/* ---------- カート ---------- */
async function refreshCart() {
  const memberId = el('cart-member-select').value;
  if (!memberId) {
    state.cart = [];
    renderCart();
    return;
  }
  state.cart = await api(`/api/cart/${memberId}`);
  renderCart();
}

function renderCart() {
  const tbody = el('cart-tbody');
  el('cart-count').textContent = `${state.cart.length}件`;
  const memberId = el('cart-member-select').value;
  if (!memberId) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">会員を選択してください</td></tr>';
    return;
  }
  if (state.cart.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">カートは空です</td></tr>';
    return;
  }
  tbody.innerHTML = state.cart
    .map((item) => {
      const product = state.products.find((p) => p.id === item.productId);
      return `
      <tr data-product-id="${item.productId}">
        <td>${product ? escapeHtml(product.name) : '(不明な商品)'}</td>
        <td class="mono">${item.quantity}</td>
        <td class="mono">${formatDate(item.addedAt)}</td>
        <td><button class="icon-btn" data-action="delete-cart-item" data-product-id="${item.productId}">削除</button></td>
      </tr>`;
    })
    .join('');
}

/* ---------- 閲覧履歴 ---------- */
async function refreshHistory() {
  const memberId = el('history-member-select').value;
  if (!memberId) {
    state.history = [];
    renderHistory();
    return;
  }
  state.history = await api(`/api/browsing-history/${memberId}`);
  renderHistory();
}

function renderHistory() {
  const tbody = el('history-tbody');
  el('history-count').textContent = `${state.history.length}件`;
  const memberId = el('history-member-select').value;
  if (!memberId) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="2">会員を選択してください</td></tr>';
    return;
  }
  if (state.history.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="2">閲覧履歴はまだありません</td></tr>';
    return;
  }
  tbody.innerHTML = state.history
    .map((item) => {
      const product = state.products.find((p) => p.id === item.productId);
      return `
      <tr>
        <td>${product ? escapeHtml(product.name) : '(不明な商品)'}</td>
        <td class="mono">${formatDate(item.viewedAt)}</td>
      </tr>`;
    })
    .join('');
}

/* ---------- ユーティリティ ---------- */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatDate(iso) {
  return new Date(iso).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/* ---------- フォーム送信 ---------- */
el('product-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  try {
    await api('/api/products', {
      method: 'POST',
      body: JSON.stringify({
        name: fd.get('name'),
        priceCents: Number(fd.get('priceCents')),
        stock: Number(fd.get('stock')),
      }),
    });
    form.reset();
    showToast('商品を登録しました', 'success');
    await refreshProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

el('member-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  try {
    await api('/api/members', {
      method: 'POST',
      body: JSON.stringify({
        name: fd.get('name'),
        email: fd.get('email'),
        password: fd.get('password'),
      }),
    });
    form.reset();
    showToast('会員を登録しました', 'success');
    await refreshMembers();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

el('order-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const memberId = fd.get('memberId');
  const productId = fd.get('productId');
  const quantity = Number(fd.get('quantity'));

  if (!memberId || !productId) {
    showToast('会員と商品を選択してください', 'error');
    return;
  }

  try {
    await api('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ memberId, items: [{ productId, quantity }] }),
    });
    showToast('注文を受け付けました。SQS経由で非同期に確定処理されます', 'success');
    await Promise.all([refreshOrders(), refreshProducts()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
});

el('cart-add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const memberId = el('cart-member-select').value;
  if (!memberId) {
    showToast('対象会員を選択してください', 'error');
    return;
  }
  const form = e.target;
  const fd = new FormData(form);
  const productId = fd.get('productId');
  const quantity = Number(fd.get('quantity'));
  if (!productId) {
    showToast('商品を選択してください', 'error');
    return;
  }
  try {
    await api(`/api/cart/${memberId}`, {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    });
    form.reset();
    showToast('カートに追加しました', 'success');
    await refreshCart();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

el('history-record-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const memberId = el('history-member-select').value;
  if (!memberId) {
    showToast('対象会員を選択してください', 'error');
    return;
  }
  const form = e.target;
  const fd = new FormData(form);
  const productId = fd.get('productId');
  if (!productId) {
    showToast('商品を選択してください', 'error');
    return;
  }
  try {
    await api(`/api/browsing-history/${memberId}`, {
      method: 'POST',
      body: JSON.stringify({ productId }),
    });
    showToast('閲覧履歴を記録しました', 'success');
    await refreshHistory();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

/* ---------- 対象会員切り替え ---------- */
el('cart-member-select').addEventListener('change', () => {
  refreshCart().catch((err) => showToast(err.message, 'error'));
});
el('history-member-select').addEventListener('change', () => {
  refreshHistory().catch((err) => showToast(err.message, 'error'));
});

/* ---------- 削除操作(イベント委譲) ---------- */
el('products-tbody').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="delete-product"]');
  if (!btn) return;
  try {
    await api(`/api/products/${btn.dataset.id}`, { method: 'DELETE' });
    showToast('商品を削除しました', 'success');
    await refreshProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

el('cart-tbody').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="delete-cart-item"]');
  if (!btn) return;
  const memberId = el('cart-member-select').value;
  try {
    await api(`/api/cart/${memberId}/${btn.dataset.productId}`, { method: 'DELETE' });
    showToast('カートから削除しました', 'success');
    await refreshCart();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

/* ---------- 全体更新・自動ポーリング ---------- */
async function refreshAll() {
  await Promise.all([refreshHealth(), refreshProducts(), refreshMembers()]);
  await refreshOrders(); // 会員一覧が揃ってから注文の会員名解決を行う
}

el('refresh-all').addEventListener('click', () => {
  refreshAll().catch((err) => showToast(err.message, 'error'));
});

let pollTimer = null;
function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    refreshOrders().catch(() => {});
    refreshProducts().catch(() => {});
  }, 2000);
}
function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
el('poll-toggle').addEventListener('change', (e) => {
  if (e.target.checked) startPolling();
  else stopPolling();
});

/* ---------- 初期化 ---------- */
refreshAll()
  .then(() => startPolling())
  .catch((err) => showToast(err.message, 'error'));