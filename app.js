// ================================================
//  AutoSpark — Lava Rápido Pro
//  app.js — Main Application Logic
// ================================================

// ============ DATA STORE ============
const DB = {
  get: (key) => { try { return JSON.parse(localStorage.getItem('as_' + key)) || null; } catch { return null; } },
  set: (key, val) => localStorage.setItem('as_' + key, JSON.stringify(val)),
  getList: (key) => DB.get(key) || [],
};

// ============ INITIAL DATA SEED ============
function seedData() {
  if (!DB.get('seeded')) {
    DB.set('services_catalog', [
      { id: 's1', name: 'Lavagem Simples', desc: 'Exterior com água e sabão', price: 25, time: 20, icon: '🚿', active: true },
      { id: 's2', name: 'Lavagem Completa', desc: 'Exterior + interior aspirado', price: 45, time: 35, icon: '✨', active: true },
      { id: 's3', name: 'Lavagem Premium', desc: 'Ext + int + pano seco + cheiro', price: 65, time: 45, icon: '⭐', active: true },
      { id: 's4', name: 'Enceramento', desc: 'Cera de carnaúba aplicada', price: 80, time: 60, icon: '💎', active: true },
      { id: 's5', name: 'Polimento', desc: 'Polimento completo da lataria', price: 120, time: 90, icon: '🔆', active: true },
      { id: 's6', name: 'Higienização Interna', desc: 'Limpeza profunda do interior', price: 95, time: 75, icon: '🧹', active: true },
    ]);

    DB.set('stock', [
      { id: 'st1', name: 'Água (caixa d\'água)', unit: 'L', qty: 500, min: 100, cat: 'limpeza' },
      { id: 'st2', name: 'Shampoo Automotivo', unit: 'L', qty: 8, min: 2, cat: 'limpeza' },
      { id: 'st3', name: 'Cera de Carnaúba', unit: 'kg', qty: 1.5, min: 0.5, cat: 'protecao' },
      { id: 'st4', name: 'Pano Microfibra', unit: 'un', qty: 12, min: 5, cat: 'acabamento' },
      { id: 'st5', name: 'Silicone Liquido', unit: 'L', qty: 3, min: 1, cat: 'acabamento' },
      { id: 'st6', name: 'Detergente Desengraxante', unit: 'L', qty: 0.8, min: 2, cat: 'limpeza' },
    ]);

    DB.set('seeded', true);
  }
}

// ============ NAVIGATION ============
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');

  const renders = {
    'dashboard': renderDashboard,
    'fila': renderFila,
    'novo-servico': renderNewServiceForm,
    'clientes': renderClients,
    'servicos': renderServicesCatalog,
    'pagamentos': renderPayments,
    'historico': renderHistory,
    'estoque': renderStock,
    'relatorio': renderReport,
  };
  renders[page]?.();
}

// ============ CLOCK ============
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('current-time').textContent = `${h}:${m}:${s}`;
  const days = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  document.getElementById('sidebar-date').textContent =
    `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
}

// ============ HELPERS ============
const currency = (v) => `R$ ${parseFloat(v).toFixed(2).replace('.', ',')}`;
const todayStr = () => new Date().toISOString().split('T')[0];
const timeStr = (d = new Date()) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
const dateTimeStr = (d = new Date()) => `${d.toLocaleDateString('pt-BR')} ${timeStr(d)}`;
const uid = () => Math.random().toString(36).substr(2, 9);

function toast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.className = 'toast', 3000);
}

function formatPlate(el) {
  let v = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (v.length > 3) v = v.slice(0,3) + '-' + v.slice(3,7);
  el.value = v;
}

// ============ PLATE SEARCH ============
function searchByPlate(plate) {
  const clean = plate.replace('-', '').toUpperCase();
  if (clean.length < 3) { document.getElementById('plate-hint').textContent = ''; return; }
  const clients = DB.getList('clients');
  const found = clients.find(c => c.placa.replace('-','').toUpperCase() === clean);
  const hint = document.getElementById('plate-hint');
  if (found) {
    hint.style.color = 'var(--green)';
    hint.textContent = `✓ ${found.nome} — ${found.modelo} ${found.cor}`;
    document.getElementById('ns-cliente').value = found.nome;
    document.getElementById('ns-telefone').value = found.telefone || '';
    document.getElementById('ns-modelo').value = found.modelo;
    document.getElementById('ns-cor').value = found.cor || '';
  } else {
    hint.style.color = 'var(--text-3)';
    hint.textContent = clean.length >= 7 ? 'Placa não cadastrada — será salva ao confirmar' : '';
  }
}

// ============ DASHBOARD ============
function renderDashboard() {
  const today = todayStr();
  const services = DB.getList('service_orders').filter(s => s.date === today);
  const done = services.filter(s => s.status === 'done');
  const queue = services.filter(s => s.status !== 'done' && s.status !== 'cancelled');
  const inProgress = services.filter(s => s.status === 'progress');
  const clients = DB.getList('clients');

  document.getElementById('stat-carros').textContent = done.length;
  const fat = done.reduce((sum, s) => sum + s.price, 0);
  document.getElementById('stat-faturamento').textContent = currency(fat);
  document.getElementById('stat-fila').textContent = queue.length;
  document.getElementById('stat-em-andamento').textContent = `${inProgress.length} em andamento`;
  document.getElementById('stat-clientes').textContent = clients.length;

  // Badge fila
  document.getElementById('nav-badge-fila').textContent = queue.length;

  // Queue preview
  const qp = document.getElementById('queue-preview');
  if (queue.length === 0) {
    qp.innerHTML = '<div class="empty-state-sm">Nenhum veículo na fila</div>';
  } else {
    qp.innerHTML = queue.slice(0, 5).map(s => `
      <div class="queue-item-sm">
        <div class="qi-status-dot ${s.status}"></div>
        <span class="qi-plate">${s.placa}</span>
        <span class="qi-model">${s.modelo}</span>
        <span class="qi-service">${s.serviceName}</span>
      </div>`).join('');
  }

  // Chart
  const catalog = DB.getList('services_catalog');
  const chartEl = document.getElementById('services-chart');
  const counts = {};
  done.forEach(s => counts[s.serviceName] = (counts[s.serviceName] || 0) + 1);
  const max = Math.max(1, ...Object.values(counts));
  if (Object.keys(counts).length === 0) {
    chartEl.innerHTML = '<div class="empty-state-sm">Sem dados hoje</div>';
  } else {
    chartEl.innerHTML = Object.entries(counts).map(([name, cnt]) => `
      <div class="chart-bar-item">
        <div class="chart-bar-label"><span>${name}</span><span>${cnt} ${cnt === 1 ? 'vez' : 'vezes'}</span></div>
        <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${(cnt/max*100)}%"></div></div>
      </div>`).join('');
  }

  // Recent services
  const rs = document.getElementById('recent-services');
  const recent = [...done].sort((a,b) => b.createdAt - a.createdAt).slice(0, 8);
  if (recent.length === 0) {
    rs.innerHTML = '<div class="empty-state-sm">Nenhum serviço registrado hoje</div>';
  } else {
    rs.innerHTML = recent.map(s => `
      <div class="recent-service-row">
        <span class="rs-time">${timeStr(new Date(s.createdAt))}</span>
        <span class="rs-plate">${s.placa}</span>
        <div class="rs-info">
          <div class="rs-model">${s.modelo}</div>
          <div class="rs-service">${s.serviceName}</div>
        </div>
        <span class="rs-price">${currency(s.price)}</span>
      </div>`).join('');
  }
}

// ============ FILA ============
function renderFila() {
  const today = todayStr();
  const orders = DB.getList('service_orders').filter(s => s.date === today);

  const waiting = orders.filter(s => s.status === 'waiting');
  const progress = orders.filter(s => s.status === 'progress');
  const done = orders.filter(s => s.status === 'done');

  document.getElementById('count-waiting').textContent = waiting.length;
  document.getElementById('count-progress').textContent = progress.length;
  document.getElementById('count-done').textContent = done.length;
  document.getElementById('nav-badge-fila').textContent = waiting.length + progress.length;

  const renderCard = (s, showActions = true) => {
    const actions = showActions ? `
      <div class="fila-card-actions">
        ${s.status === 'waiting' ? `<button class="btn btn-green btn-sm" onclick="updateOrderStatus('${s.id}', 'progress')">▶ Iniciar</button>` : ''}
        ${s.status === 'progress' ? `<button class="btn btn-primary btn-sm" onclick="updateOrderStatus('${s.id}', 'done')">✓ Concluir</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="cancelOrder('${s.id}')">✕</button>
      </div>` : `<div class="badge badge-done" style="margin-top:8px">Concluído</div>`;
    return `
      <div class="fila-card" id="card-${s.id}">
        <div class="fila-card-top">
          <span class="fila-card-plate">${s.placa}</span>
          <span class="fila-card-time">${timeStr(new Date(s.createdAt))}</span>
        </div>
        <div class="fila-card-model">${s.modelo}</div>
        <div class="fila-card-client">${s.cliente || 'Cliente não informado'} ${s.payment ? '· ' + capitalize(s.payment) : ''}</div>
        <div class="fila-card-service">${s.serviceIcon || '🚗'} ${s.serviceName}</div>
        <div class="fila-card-price">${currency(s.price)}</div>
        ${s.obs ? `<div style="font-size:11px;color:var(--text-3);margin-bottom:8px">📝 ${s.obs}</div>` : ''}
        ${actions}
      </div>`;
  };

  const wEl = document.getElementById('fila-waiting');
  wEl.innerHTML = waiting.length ? waiting.map(s => renderCard(s)).join('') : '<div class="empty-state-sm">Nenhum veículo aguardando</div>';

  const pEl = document.getElementById('fila-progress');
  pEl.innerHTML = progress.length ? progress.map(s => renderCard(s)).join('') : '<div class="empty-state-sm">Nenhum em andamento</div>';

  const dEl = document.getElementById('fila-done');
  dEl.innerHTML = done.length ? [...done].reverse().slice(0,6).map(s => renderCard(s, false)).join('') : '<div class="empty-state-sm">Nenhum concluído hoje</div>';
}

function updateOrderStatus(id, newStatus) {
  const orders = DB.getList('service_orders');
  const idx = orders.findIndex(o => o.id === id);
  if (idx < 0) return;
  orders[idx].status = newStatus;
  if (newStatus === 'done') orders[idx].completedAt = Date.now();
  DB.set('service_orders', orders);
  renderFila();
  renderDashboard();
  toast(`Status atualizado: ${newStatus === 'progress' ? 'Em Andamento' : 'Concluído'}!`, 'success');
}

function cancelOrder(id) {
  if (!confirm('Cancelar este serviço?')) return;
  const orders = DB.getList('service_orders');
  const idx = orders.findIndex(o => o.id === id);
  if (idx < 0) return;
  orders[idx].status = 'cancelled';
  DB.set('service_orders', orders);
  renderFila();
  renderDashboard();
  toast('Serviço cancelado', 'error');
}

// ============ NEW SERVICE FORM ============
let selectedServiceId = null;

function renderNewServiceForm() {
  const catalog = DB.getList('services_catalog').filter(s => s.active);
  const container = document.getElementById('service-selector');
  container.innerHTML = catalog.map(s => `
    <label class="service-option">
      <input type="radio" name="ns-service" value="${s.id}" onchange="selectService('${s.id}', '${s.name}', ${s.price})">
      <div class="service-option-card">
        <div class="soc-icon">${s.icon}</div>
        <div class="soc-name">${s.name}</div>
        <div class="soc-desc">${s.desc}</div>
        <div class="soc-meta">
          <span class="soc-price">${currency(s.price)}</span>
          <span class="soc-time">⏱ ${s.time} min</span>
        </div>
      </div>
    </label>`).join('');
  selectedServiceId = null;
  updateSummary(null, 0);
}

function selectService(id, name, price) {
  selectedServiceId = id;
  updateSummary(name, price);
}

function updateSummary(name, price) {
  document.getElementById('summary-service').textContent = name || '—';
  document.getElementById('summary-total').textContent = currency(price);
}

function submitService() {
  const placa = document.getElementById('ns-placa').value.trim();
  const modelo = document.getElementById('ns-modelo').value.trim();
  const cliente = document.getElementById('ns-cliente').value.trim();
  const telefone = document.getElementById('ns-telefone').value.trim();
  const cor = document.getElementById('ns-cor').value.trim();
  const obs = document.getElementById('ns-obs').value.trim();
  const payment = document.querySelector('input[name="payment"]:checked')?.value || 'dinheiro';

  if (!placa) { toast('Informe a placa do veículo', 'error'); return; }
  if (!modelo) { toast('Informe o modelo do veículo', 'error'); return; }
  if (!selectedServiceId) { toast('Selecione um serviço', 'error'); return; }

  const catalog = DB.getList('services_catalog');
  const svc = catalog.find(s => s.id === selectedServiceId);

  // Auto-register client if new plate
  if (placa && cliente) {
    const clients = DB.getList('clients');
    const existing = clients.find(c => c.placa.toUpperCase() === placa.toUpperCase());
    if (!existing) {
      clients.push({ id: uid(), nome: cliente, telefone, placa: placa.toUpperCase(), modelo, cor, createdAt: Date.now() });
      DB.set('clients', clients);
    }
  }

  const order = {
    id: uid(),
    date: todayStr(),
    createdAt: Date.now(),
    placa: placa.toUpperCase(),
    modelo,
    cliente,
    telefone,
    cor,
    serviceId: svc.id,
    serviceName: svc.name,
    serviceIcon: svc.icon,
    price: svc.price,
    payment,
    obs,
    status: 'waiting',
  };

  const orders = DB.getList('service_orders');
  orders.push(order);
  DB.set('service_orders', orders);

  // Clear form
  document.getElementById('ns-placa').value = '';
  document.getElementById('ns-cliente').value = '';
  document.getElementById('ns-telefone').value = '';
  document.getElementById('ns-modelo').value = '';
  document.getElementById('ns-cor').value = '';
  document.getElementById('ns-obs').value = '';
  document.getElementById('plate-hint').textContent = '';
  document.querySelectorAll('input[name="ns-service"]').forEach(r => r.checked = false);
  document.querySelectorAll('.service-option-card').forEach(c => c.style.borderColor = '');
  selectedServiceId = null;
  updateSummary(null, 0);

  toast(`${placa.toUpperCase()} adicionado à fila!`, 'success');
  navigate('fila');
}

// ============ CLIENTS ============
function renderClients(filter = '') {
  let clients = DB.getList('clients');
  const orders = DB.getList('service_orders');

  if (filter) {
    const f = filter.toLowerCase();
    clients = clients.filter(c =>
      c.nome?.toLowerCase().includes(f) ||
      c.placa?.toLowerCase().includes(f) ||
      c.telefone?.includes(f)
    );
  }

  const tbody = document.getElementById('clients-table-body');
  const empty = document.getElementById('clients-empty');

  if (clients.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = clients.map(c => {
    const cOrders = orders.filter(o => o.placa === c.placa && o.status === 'done');
    const total = cOrders.reduce((sum, o) => sum + o.price, 0);
    return `<tr>
      <td>${c.nome || '—'}</td>
      <td><span class="td-plate">${c.placa}</span></td>
      <td>${c.modelo} ${c.cor ? `<span style="color:var(--text-3);font-size:12px">(${c.cor})</span>` : ''}</td>
      <td>${c.telefone || '—'}</td>
      <td>${cOrders.length}</td>
      <td class="td-price">${currency(total)}</td>
      <td>
        <div class="table-actions">
          <button class="icon-btn" onclick="editClient('${c.id}')" title="Editar">✏️</button>
          <button class="icon-btn danger" onclick="deleteClient('${c.id}')" title="Excluir">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterClients(val) { renderClients(val); }

function openClientModal(id = null) {
  const modal = document.getElementById('modal-client');
  document.getElementById('modal-client-title').textContent = id ? 'Editar Cliente' : 'Novo Cliente';
  if (id) {
    const c = DB.getList('clients').find(x => x.id === id);
    if (c) {
      document.getElementById('mc-nome').value = c.nome || '';
      document.getElementById('mc-telefone').value = c.telefone || '';
      document.getElementById('mc-placa').value = c.placa || '';
      document.getElementById('mc-modelo').value = c.modelo || '';
      document.getElementById('mc-cor').value = c.cor || '';
      document.getElementById('mc-ano').value = c.ano || '';
    }
    modal.dataset.editId = id;
  } else {
    ['mc-nome','mc-telefone','mc-placa','mc-modelo','mc-cor','mc-ano'].forEach(id => document.getElementById(id).value = '');
    delete modal.dataset.editId;
  }
  modal.classList.add('open');
}

function editClient(id) { openClientModal(id); }

function saveClient() {
  const nome = document.getElementById('mc-nome').value.trim();
  const placa = document.getElementById('mc-placa').value.trim().toUpperCase();
  const modelo = document.getElementById('mc-modelo').value.trim();
  if (!nome || !placa || !modelo) { toast('Preencha nome, placa e modelo', 'error'); return; }

  const clients = DB.getList('clients');
  const modal = document.getElementById('modal-client');
  const editId = modal.dataset.editId;

  if (editId) {
    const idx = clients.findIndex(c => c.id === editId);
    if (idx >= 0) {
      clients[idx] = { ...clients[idx], nome, placa, modelo,
        telefone: document.getElementById('mc-telefone').value.trim(),
        cor: document.getElementById('mc-cor').value.trim(),
        ano: document.getElementById('mc-ano').value.trim() };
    }
  } else {
    clients.push({ id: uid(), nome, placa, modelo,
      telefone: document.getElementById('mc-telefone').value.trim(),
      cor: document.getElementById('mc-cor').value.trim(),
      ano: document.getElementById('mc-ano').value.trim(),
      createdAt: Date.now() });
  }
  DB.set('clients', clients);
  closeModal('modal-client');
  renderClients();
  toast('Cliente salvo!', 'success');
}

function deleteClient(id) {
  if (!confirm('Excluir este cliente?')) return;
  const clients = DB.getList('clients').filter(c => c.id !== id);
  DB.set('clients', clients);
  renderClients();
  toast('Cliente removido', 'info');
}

// ============ SERVICES CATALOG ============
function renderServicesCatalog() {
  const catalog = DB.getList('services_catalog');
  const grid = document.getElementById('services-catalog');
  grid.innerHTML = catalog.map(s => `
    <div class="service-catalog-card">
      <div class="scc-icon">${s.icon}</div>
      <div class="scc-name">${s.name}</div>
      <div class="scc-desc">${s.desc}</div>
      <div class="scc-footer">
        <span class="scc-price">${currency(s.price)}</span>
        <span class="scc-time">⏱ ${s.time} min</span>
      </div>
      <div class="scc-actions">
        <button class="btn btn-ghost btn-sm" onclick="editService('${s.id}')">Editar</button>
        <button class="btn btn-sm ${s.active ? 'btn-ghost' : 'btn-green'}" onclick="toggleService('${s.id}')">
          ${s.active ? 'Desativar' : 'Ativar'}
        </button>
        <button class="btn btn-red btn-sm" onclick="deleteService('${s.id}')">✕</button>
      </div>
      ${!s.active ? '<div class="badge badge-cancelled" style="position:absolute;top:12px;right:12px">Inativo</div>' : ''}
    </div>`).join('');
}

let editingServiceId = null;

function openServiceModal(id = null) {
  editingServiceId = id;
  document.getElementById('modal-service-title').textContent = id ? 'Editar Serviço' : 'Novo Serviço';
  if (id) {
    const s = DB.getList('services_catalog').find(x => x.id === id);
    if (s) {
      document.getElementById('msv-nome').value = s.name;
      document.getElementById('msv-desc').value = s.desc;
      document.getElementById('msv-preco').value = s.price;
      document.getElementById('msv-tempo').value = s.time;
      document.getElementById('msv-icon').value = s.icon;
    }
  } else {
    ['msv-nome','msv-desc','msv-preco','msv-tempo','msv-icon'].forEach(id => document.getElementById(id).value = '');
  }
  document.getElementById('modal-service').classList.add('open');
}

function editService(id) { openServiceModal(id); }

function saveService() {
  const name = document.getElementById('msv-nome').value.trim();
  const price = parseFloat(document.getElementById('msv-preco').value);
  if (!name || isNaN(price)) { toast('Preencha nome e preço', 'error'); return; }

  const catalog = DB.getList('services_catalog');
  const svc = {
    name,
    desc: document.getElementById('msv-desc').value.trim(),
    price,
    time: parseInt(document.getElementById('msv-tempo').value) || 30,
    icon: document.getElementById('msv-icon').value.trim() || '🚗',
    active: true,
  };

  if (editingServiceId) {
    const idx = catalog.findIndex(s => s.id === editingServiceId);
    if (idx >= 0) catalog[idx] = { ...catalog[idx], ...svc };
  } else {
    catalog.push({ id: uid(), ...svc });
  }
  DB.set('services_catalog', catalog);
  closeModal('modal-service');
  renderServicesCatalog();
  toast('Serviço salvo!', 'success');
}

function toggleService(id) {
  const catalog = DB.getList('services_catalog');
  const idx = catalog.findIndex(s => s.id === id);
  if (idx >= 0) catalog[idx].active = !catalog[idx].active;
  DB.set('services_catalog', catalog);
  renderServicesCatalog();
}

function deleteService(id) {
  if (!confirm('Excluir este serviço?')) return;
  DB.set('services_catalog', DB.getList('services_catalog').filter(s => s.id !== id));
  renderServicesCatalog();
  toast('Serviço removido', 'info');
}

// ============ PAYMENTS ============
function renderPayments() {
  const today = todayStr();
  const orders = DB.getList('service_orders').filter(o => o.date === today && o.status !== 'cancelled');
  const done = orders.filter(o => o.status === 'done');

  const totals = { dinheiro: 0, debito: 0, credito: 0, pix: 0 };
  done.forEach(o => { if (totals.hasOwnProperty(o.payment)) totals[o.payment] += o.price; });
  const total = Object.values(totals).reduce((a, b) => a + b, 0);

  document.getElementById('ps-dinheiro').textContent = currency(totals.dinheiro);
  document.getElementById('ps-debito').textContent = currency(totals.debito);
  document.getElementById('ps-credito').textContent = currency(totals.credito);
  document.getElementById('ps-pix').textContent = currency(totals.pix);
  document.getElementById('ps-total').textContent = currency(total);

  const tbody = document.getElementById('payments-table-body');
  const empty = document.getElementById('payments-empty');

  if (orders.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  const statusMap = { waiting: '<span class="badge badge-waiting">Aguardando</span>', progress: '<span class="badge badge-progress">Em andamento</span>', done: '<span class="badge badge-done">Pago</span>', cancelled: '<span class="badge badge-cancelled">Cancelado</span>' };

  tbody.innerHTML = [...orders].reverse().map(o => `
    <tr>
      <td>${timeStr(new Date(o.createdAt))}</td>
      <td><span class="td-plate">${o.placa}</span></td>
      <td>${o.cliente || '—'}</td>
      <td>${o.serviceName}</td>
      <td>${capitalize(o.payment || 'dinheiro')}</td>
      <td class="td-price">${currency(o.price)}</td>
      <td>${statusMap[o.status] || o.status}</td>
    </tr>`).join('');
}

// ============ HISTORY ============
function renderHistory() {
  const dateEl = document.getElementById('history-date');
  const dateFilter = dateEl.value;
  const search = document.getElementById('history-search').value.toLowerCase();

  let orders = DB.getList('service_orders');
  if (dateFilter) orders = orders.filter(o => o.date === dateFilter);
  if (search) orders = orders.filter(o =>
    o.placa?.toLowerCase().includes(search) ||
    o.cliente?.toLowerCase().includes(search) ||
    o.serviceName?.toLowerCase().includes(search)
  );

  orders = [...orders].reverse();
  const tbody = document.getElementById('history-table-body');
  const empty = document.getElementById('history-empty');

  if (orders.length === 0) { tbody.innerHTML = ''; empty.style.display = 'flex'; return; }
  empty.style.display = 'none';

  const statusMap = { waiting: 'badge-waiting', progress: 'badge-progress', done: 'badge-done', cancelled: 'badge-cancelled' };
  const statusLabel = { waiting: 'Aguardando', progress: 'Em andamento', done: 'Concluído', cancelled: 'Cancelado' };

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td style="font-size:12px;color:var(--text-3)">${new Date(o.createdAt).toLocaleDateString('pt-BR')} ${timeStr(new Date(o.createdAt))}</td>
      <td><span class="td-plate">${o.placa}</span></td>
      <td>${o.modelo}</td>
      <td>${o.cliente || '—'}</td>
      <td>${o.serviceIcon || ''} ${o.serviceName}</td>
      <td>${capitalize(o.payment || 'dinheiro')}</td>
      <td class="td-price">${currency(o.price)}</td>
      <td><span class="badge ${statusMap[o.status]}">${statusLabel[o.status]}</span></td>
    </tr>`).join('');
}

function filterHistory(val) { renderHistory(); }

// ============ STOCK ============
function renderStock() {
  const stock = DB.getList('stock');
  const alertsEl = document.getElementById('stock-alerts');
  const low = stock.filter(s => s.qty <= s.min);

  alertsEl.innerHTML = low.map(s => `
    <div class="stock-alert">
      ⚠️ <strong>${s.name}</strong> está abaixo do estoque mínimo! (${s.qty} ${s.unit} / mínimo: ${s.min} ${s.unit})
    </div>`).join('');

  const grid = document.getElementById('stock-grid');
  grid.innerHTML = stock.map(s => {
    const pct = Math.min(100, Math.round(s.qty / (s.min * 3) * 100));
    const color = s.qty <= s.min ? 'var(--red)' : s.qty <= s.min * 2 ? 'var(--yellow)' : 'var(--green)';
    return `
    <div class="stock-card ${s.qty <= s.min ? 'low-stock' : ''}">
      <div class="sc-header">
        <div>
          <div class="sc-name">${s.name}</div>
          <div class="sc-cat">${s.cat}</div>
        </div>
        <div class="table-actions">
          <button class="icon-btn" onclick="editStock('${s.id}')">✏️</button>
          <button class="icon-btn" onclick="addStockQty('${s.id}')">+</button>
          <button class="icon-btn danger" onclick="deleteStock('${s.id}')">🗑</button>
        </div>
      </div>
      <div>
        <span class="sc-qty">${s.qty}</span>
        <span class="sc-unit"> ${s.unit}</span>
      </div>
      <div class="sc-progress-label">
        <span>Mínimo: ${s.min} ${s.unit}</span>
        <span>${pct}%</span>
      </div>
      <div class="sc-progress-track">
        <div class="sc-progress-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="sc-actions">
        <button class="btn btn-ghost btn-sm" onclick="addStockQty('${s.id}')">+ Repor Estoque</button>
      </div>
    </div>`;
  }).join('');
}

let editingStockId = null;

function openStockModal(id = null) {
  editingStockId = id;
  document.getElementById('modal-stock-title').textContent = id ? 'Editar Item' : 'Novo Item de Estoque';
  if (id) {
    const s = DB.getList('stock').find(x => x.id === id);
    if (s) {
      document.getElementById('mst-nome').value = s.name;
      document.getElementById('mst-unidade').value = s.unit;
      document.getElementById('mst-qty').value = s.qty;
      document.getElementById('mst-min').value = s.min;
      document.getElementById('mst-cat').value = s.cat;
    }
  } else {
    ['mst-nome','mst-qty','mst-min'].forEach(id => document.getElementById(id).value = '');
  }
  document.getElementById('modal-stock').classList.add('open');
}

function editStock(id) { openStockModal(id); }

function addStockQty(id) {
  const qty = prompt('Quantidade a adicionar:');
  if (!qty || isNaN(qty)) return;
  const stock = DB.getList('stock');
  const idx = stock.findIndex(s => s.id === id);
  if (idx >= 0) { stock[idx].qty = Math.round((stock[idx].qty + parseFloat(qty)) * 100) / 100; }
  DB.set('stock', stock);
  renderStock();
  toast('Estoque atualizado!', 'success');
}

function saveStock() {
  const name = document.getElementById('mst-nome').value.trim();
  const qty = parseFloat(document.getElementById('mst-qty').value);
  const min = parseFloat(document.getElementById('mst-min').value);
  if (!name || isNaN(qty) || isNaN(min)) { toast('Preencha todos os campos obrigatórios', 'error'); return; }

  const stock = DB.getList('stock');
  const item = {
    name,
    unit: document.getElementById('mst-unidade').value,
    qty,
    min,
    cat: document.getElementById('mst-cat').value,
  };

  if (editingStockId) {
    const idx = stock.findIndex(s => s.id === editingStockId);
    if (idx >= 0) stock[idx] = { ...stock[idx], ...item };
  } else {
    stock.push({ id: uid(), ...item });
  }
  DB.set('stock', stock);
  closeModal('modal-stock');
  renderStock();
  toast('Item salvo!', 'success');
}

function deleteStock(id) {
  if (!confirm('Remover este item?')) return;
  DB.set('stock', DB.getList('stock').filter(s => s.id !== id));
  renderStock();
  toast('Item removido', 'info');
}

// ============ REPORT ============
function renderReport() {
  const dateEl = document.getElementById('report-date');
  if (!dateEl.value) dateEl.value = todayStr();
  loadReport();
}

function loadReport() {
  const date = document.getElementById('report-date').value || todayStr();
  const orders = DB.getList('service_orders').filter(o => o.date === date);
  const done = orders.filter(o => o.status === 'done');
  const fat = done.reduce((sum, o) => sum + o.price, 0);
  const ticket = done.length > 0 ? fat / done.length : 0;

  // Count new clients on that day
  const newClients = DB.getList('clients').filter(c => {
    const d = new Date(c.createdAt);
    return d.toISOString().split('T')[0] === date;
  }).length;

  document.getElementById('rpt-veiculos').textContent = done.length;
  document.getElementById('rpt-faturamento').textContent = currency(fat);
  document.getElementById('rpt-ticket').textContent = currency(ticket);
  document.getElementById('rpt-novos').textContent = newClients;

  // Services breakdown
  const svcs = {};
  done.forEach(o => {
    if (!svcs[o.serviceName]) svcs[o.serviceName] = { cnt: 0, total: 0 };
    svcs[o.serviceName].cnt++;
    svcs[o.serviceName].total += o.price;
  });

  const svcEl = document.getElementById('rpt-services-breakdown');
  svcEl.innerHTML = Object.entries(svcs).length
    ? Object.entries(svcs).sort((a,b) => b[1].cnt - a[1].cnt).map(([name, d]) => `
        <div class="breakdown-item">
          <div><div>${name}</div><div class="breakdown-count">${d.cnt} ${d.cnt === 1 ? 'serviço' : 'serviços'}</div></div>
          <div class="breakdown-value">${currency(d.total)}</div>
        </div>`).join('')
    : '<div class="empty-state-sm">Sem dados</div>';

  // Payment breakdown
  const pmts = { dinheiro: 0, debito: 0, credito: 0, pix: 0 };
  done.forEach(o => { if (pmts.hasOwnProperty(o.payment)) pmts[o.payment] += o.price; });
  const pmtLabels = { dinheiro: '💵 Dinheiro', debito: '💳 Débito', credito: '💳 Crédito', pix: '📱 PIX' };
  const pmtEl = document.getElementById('rpt-payment-breakdown');
  pmtEl.innerHTML = Object.entries(pmts).filter(([,v]) => v > 0).map(([k, v]) => `
    <div class="breakdown-item">
      <div>${pmtLabels[k]}</div>
      <div class="breakdown-value">${currency(v)}</div>
    </div>`).join('') || '<div class="empty-state-sm">Sem pagamentos</div>';

  // Table
  const tbody = document.getElementById('rpt-table-body');
  tbody.innerHTML = done.length
    ? done.map(o => `<tr>
        <td>${timeStr(new Date(o.createdAt))}</td>
        <td><span class="td-plate">${o.placa}</span></td>
        <td>${o.modelo}</td>
        <td>${o.cliente || '—'}</td>
        <td>${o.serviceName}</td>
        <td>${capitalize(o.payment || 'dinheiro')}</td>
        <td class="td-price">${currency(o.price)}</td>
      </tr>`).join('')
    : '<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:24px">Nenhum serviço concluído nesta data</td></tr>';
}

function generateReport() {
  const date = document.getElementById('report-date').value || todayStr();
  const orders = DB.getList('service_orders').filter(o => o.date === date && o.status === 'done');
  const fat = orders.reduce((sum, o) => sum + o.price, 0);
  const dateFormatted = new Date(date + 'T12:00').toLocaleDateString('pt-BR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  const svcs = {};
  orders.forEach(o => {
    if (!svcs[o.serviceName]) svcs[o.serviceName] = { cnt: 0, total: 0 };
    svcs[o.serviceName].cnt++;
    svcs[o.serviceName].total += o.price;
  });

  const pmts = { dinheiro: 0, debito: 0, credito: 0, pix: 0 };
  orders.forEach(o => { if (pmts.hasOwnProperty(o.payment)) pmts[o.payment] += o.price; });

  const html = `<!DOCTYPE html><html><head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #1a1a2e; max-width: 800px; margin: 0 auto; padding: 40px; }
    h1 { color: #0ea5c9; font-size: 32px; letter-spacing: 4px; text-transform: uppercase; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #666; border-bottom: 2px solid #0ea5c9; padding-bottom: 8px; margin-top: 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #0ea5c9; }
    .stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 24px; }
    .stat { text-align: center; background: #f0f9ff; border-radius: 8px; padding: 16px; }
    .stat-v { font-size: 28px; font-weight: 900; color: #0ea5c9; }
    .stat-l { font-size: 11px; text-transform: uppercase; color: #666; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #0ea5c9; color: white; padding: 10px; text-align: left; }
    td { padding: 9px 10px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) td { background: #f8fafc; }
    .breakdown { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 24px 0; }
    .bd-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    .bd-val { font-weight: 700; color: #059669; }
    .plate { font-family: monospace; font-weight: bold; background: #e0f2fe; padding: 2px 6px; border-radius: 4px; color: #0ea5c9; }
    .footer { margin-top: 48px; text-align: center; font-size: 12px; color: #9ca3af; padding-top: 16px; border-top: 1px solid #e5e7eb; }
    @media print { body { padding: 20px; } }
  </style></head><body>
  <div class="header">
    <div><h1>⚡ AutoSpark</h1><div style="font-size:13px;color:#666">Sistema de Lava Rápido</div></div>
    <div style="text-align:right"><div style="font-size:16px;font-weight:700">Relatório Diário</div><div style="font-size:13px;color:#666">${dateFormatted}</div></div>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-v">${orders.length}</div><div class="stat-l">Veículos</div></div>
    <div class="stat"><div class="stat-v">${currency(fat)}</div><div class="stat-l">Faturamento</div></div>
    <div class="stat"><div class="stat-v">${currency(orders.length > 0 ? fat/orders.length : 0)}</div><div class="stat-l">Ticket Médio</div></div>
    <div class="stat"><div class="stat-v">${orders.length}</div><div class="stat-l">Serviços</div></div>
  </div>
  <div class="breakdown">
    <div>
      <h2>Serviços Realizados</h2>
      ${Object.entries(svcs).map(([n,d]) => `<div class="bd-item"><span>${n} (${d.cnt}x)</span><span class="bd-val">${currency(d.total)}</span></div>`).join('') || '<p>Sem dados</p>'}
    </div>
    <div>
      <h2>Formas de Pagamento</h2>
      ${Object.entries(pmts).filter(([,v])=>v>0).map(([k,v]) => `<div class="bd-item"><span>${capitalize(k)}</span><span class="bd-val">${currency(v)}</span></div>`).join('') || '<p>Sem dados</p>'}
    </div>
  </div>
  <h2>Detalhamento de Serviços</h2>
  <table>
    <thead><tr><th>Horário</th><th>Placa</th><th>Veículo</th><th>Cliente</th><th>Serviço</th><th>Pgto</th><th>Valor</th></tr></thead>
    <tbody>
      ${orders.length
        ? orders.map(o => `<tr>
            <td>${timeStr(new Date(o.createdAt))}</td>
            <td><span class="plate">${o.placa}</span></td>
            <td>${o.modelo}</td>
            <td>${o.cliente||'—'}</td>
            <td>${o.serviceName}</td>
            <td>${capitalize(o.payment||'dinheiro')}</td>
            <td style="font-weight:700;color:#059669">${currency(o.price)}</td>
          </tr>`).join('')
        : '<tr><td colspan="7" style="text-align:center;color:#999;padding:20px">Nenhum serviço registrado</td></tr>'}
    </tbody>
  </table>
  <div class="footer">Relatório gerado em ${new Date().toLocaleString('pt-BR')} · AutoSpark Lava Rápido Pro</div>
  </body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

// ============ MODALS ============
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ============ UTILS ============
function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  seedData();
  updateClock();
  setInterval(updateClock, 1000);

  // Set today's date on history filter
  document.getElementById('history-date').value = '';
  document.getElementById('report-date').value = todayStr();

  navigate('dashboard');
});

// Auto-refresh dashboard every 30s
setInterval(() => {
  if (document.querySelector('.page.active')?.id === 'page-dashboard') renderDashboard();
  if (document.querySelector('.page.active')?.id === 'page-fila') renderFila();
}, 30000);
