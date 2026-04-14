const STORAGE_KEY = 'vale-portsync-ai-v2';

const defaultState = {
  currentPage: 'inicio',
  systemName: 'Vale PortSync AI',
  vehicleCounter: 13,
  requestCounter: 4,
  vehicles: [
    { id: 'V01', location: 'Via A1', status: 'Em rota', available: false, capacity: 35, currentLoad: 18, cargoType: 'Minério de ferro', eta: 15 },
    { id: 'V02', location: 'Pátio Norte', status: 'Disponível', available: true, capacity: 40, currentLoad: 0, cargoType: 'Livre', eta: 8 },
    { id: 'V03', location: 'Via C2', status: 'Em rota', available: false, capacity: 30, currentLoad: 24, cargoType: 'Pelotas', eta: 12 },
    { id: 'V04', location: 'Base', status: 'Disponível', available: true, capacity: 28, currentLoad: 0, cargoType: 'Livre', eta: 10 }
  ],
  requests: [
    {
      id: 'REQ-003', origin: 'Pátio 1', destination: 'Cais 7', priority: 'Alta', cargoType: 'Minério de ferro',
      weight: 26, notes: 'Entrega prioritária', preferredVehicle: '', vehicleId: 'V02', score: 94,
      status: 'Em análise', createdAt: new Date().toISOString()
    }
  ],
  cargoRecords: [
    {
      id: 'CG-001', vehicleId: 'V12', cargoType: 'Minério de ferro', weight: 32.4, origin: 'Área de Recuperação',
      destination: 'Pier III', status: 'Em trânsito', eta: '10:49', confidence: 98.7, notes: 'Registro automático por sensores.'
    }
  ],
  events: [
    { type: 'danger', title: 'Bloqueio parcial na Via C3', time: 'há 4 min' },
    { type: 'warning', title: 'Congestionamento no Pátio 2', time: 'há 9 min' },
    { type: 'success', title: 'Rota alternativa liberada pela IA', time: 'há 1 min' }
  ]
};

let state = loadState();
let map;
let mapLayers = [];

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...structuredClone(defaultState), ...saved } : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function tagClass(status) {
  if (status === 'Disponível' || status === 'Entregue') return 'green';
  if (status === 'Em rota' || status === 'Em análise' || status === 'Registrada' || status === 'Em trânsito') return 'blue';
  if (status === 'Aguardando' || status === 'Aguardando descarga') return 'yellow';
  return 'red';
}

function iconForEvent(type) {
  return ({ danger: '⛔', warning: '⚠️', success: '✅', info: 'ℹ️' }[type] || '•');
}

function getLastRequest() {
  return state.requests[state.requests.length - 1] || null;
}

function getLastCargo() {
  return state.cargoRecords[state.cargoRecords.length - 1] || null;
}

function computeRecommendation(request) {
  if (!request) return [];

  return state.vehicles.map(vehicle => {
    let score = 50;
    if (vehicle.available) score += 22;
    if (vehicle.capacity >= Number(request.weight || 0)) score += 12;
    if (vehicle.cargoType === request.cargoType || vehicle.cargoType === 'Livre') score += 10;
    if (request.priority === 'Alta') score += 6;
    score -= Math.min(vehicle.eta || 0, 20);
    if (request.preferredVehicle && request.preferredVehicle === vehicle.id) score += 10;
    return { ...vehicle, score: Math.max(10, Math.min(99, score)) };
  }).sort((a, b) => b.score - a.score);
}

function setPage(page) {
  state.currentPage = page;
  saveState();
  document.querySelectorAll('.page').forEach(section => {
    section.classList.toggle('active', section.dataset.page === page);
  });
  document.querySelectorAll('[data-page-btn]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pageBtn === page);
  });
  const titles = {
    inicio: ['Início', 'Visão geral do sistema e resumo das operações'],
    mapa: ['Mapa Operacional', 'Base geográfica real com camadas operacionais'],
    solicitacao: ['Solicitação', 'Cadastro de novas demandas operacionais'],
    decisao: ['Decisão IA', 'Recomendação automática com base nos dados'],
    resultados: ['Resultados', 'Frota e indicadores cadastrados'],
    carga: ['Carga Monitorada', 'Registro e acompanhamento das cargas']
  };
  document.querySelector('[data-role="header-title"]').textContent = titles[page][0];
  document.querySelector('[data-role="header-subtitle"]').textContent = titles[page][1];
  if (page === 'mapa' && map) {
    setTimeout(() => map.invalidateSize(), 50);
  }
}

function renderEvents() {
  const el = document.getElementById('events-list');
  el.innerHTML = state.events.map(event => `
    <div class="timeline-item">
      <div class="timeline-bullet ${event.type === 'danger' ? 'tag red' : event.type === 'warning' ? 'tag yellow' : event.type === 'success' ? 'tag green' : 'tag blue'}" style="width:34px;height:34px;padding:0;display:grid;place-items:center;border-radius:50%;">${iconForEvent(event.type)}</div>
      <div class="timeline-content">
        <strong>${escapeHtml(event.title)}</strong>
        <span>${escapeHtml(event.time)}</span>
      </div>
    </div>
  `).join('');
}

function renderOverview() {
  const lastRequest = getLastRequest();
  const lastCargo = getLastCargo();
  const activeVehicles = state.vehicles.filter(v => v.status === 'Em rota').length;
  const availableVehicles = state.vehicles.filter(v => v.available).length;

  document.querySelectorAll('[data-role="system-name"], [data-role="hero-system-name"]').forEach(el => el.textContent = state.systemName);
  document.querySelector('[data-role="kpi-active-vehicles"]').textContent = activeVehicles;
  document.querySelector('[data-role="kpi-available-vehicles"]').textContent = availableVehicles;
  document.querySelector('[data-role="kpi-cargo-count"]').textContent = state.cargoRecords.length;
  document.querySelector('[data-role="metric-requests"]').textContent = state.requests.length;
  document.querySelector('[data-role="metric-vehicles"]').textContent = state.vehicles.length;
  document.querySelector('[data-role="metric-last-cargo"]').textContent = lastCargo ? `${lastCargo.id} / ${lastCargo.vehicleId}` : 'Nenhuma';

  const recText = document.querySelector('[data-role="last-recommendation-text"]');
  const recId = document.querySelector('[data-role="last-request-id"]');
  if (lastRequest) {
    recText.textContent = `${lastRequest.vehicleId || 'Sem veículo'} recomendado para ${lastRequest.origin} → ${lastRequest.destination} com ${lastRequest.score || 0}% de confiança.`;
    recId.textContent = lastRequest.id;
  } else {
    recText.textContent = 'Nenhuma análise recente.';
    recId.textContent = 'Sem solicitação';
  }
}

function renderRequestPage() {
  const select = document.getElementById('preferredVehicle');
  select.innerHTML = '<option value="">Seleção automática</option>' + state.vehicles.map(v => `<option value="${v.id}">${v.id} — ${escapeHtml(v.location)}</option>`).join('');

  const lastRequest = getLastRequest();
  const rankingBody = document.getElementById('request-ranking-body');
  const box = document.getElementById('request-recommendation-box');

  if (!lastRequest) {
    rankingBody.innerHTML = '';
    box.className = 'empty';
    box.textContent = 'Cadastre uma solicitação para ver a recomendação.';
    return;
  }

  const ranking = computeRecommendation(lastRequest);
  const best = ranking[0];
  box.className = 'card';
  box.innerHTML = `
    <h3 style="margin-top:0;">IA recomenda ${escapeHtml(best.id)} com ${best.score}% de confiança</h3>
    <p style="margin-bottom:0;">Solicitação ${escapeHtml(lastRequest.id)} • ${escapeHtml(lastRequest.origin)} → ${escapeHtml(lastRequest.destination)} • ${escapeHtml(lastRequest.cargoType)}</p>
  `;

  rankingBody.innerHTML = ranking.map(vehicle => `
    <tr>
      <td><strong>${escapeHtml(vehicle.id)}</strong></td>
      <td>${escapeHtml(vehicle.location)}</td>
      <td>${vehicle.eta} min</td>
      <td>
        <div>${vehicle.score}%</div>
        <div class="score"><div style="width:${vehicle.score}%"></div></div>
      </td>
      <td><span class="tag ${tagClass(vehicle.status)}">${escapeHtml(vehicle.status)}</span></td>
    </tr>
  `).join('');
}

function renderDecision() {
  const lastRequest = getLastRequest();
  if (!lastRequest) return;
  document.querySelector('[data-role="decision-request-id"]').textContent = lastRequest.id;
  document.querySelector('[data-role="decision-route"]').textContent = `${lastRequest.origin} → ${lastRequest.destination}`;
  document.querySelector('[data-role="decision-vehicle"]').textContent = lastRequest.vehicleId || '-';
  document.querySelector('[data-role="decision-score"]').textContent = `${lastRequest.score || 0}%`;
  document.querySelector('[data-role="decision-cargo"]').textContent = `${lastRequest.cargoType} / ${lastRequest.weight} t`;
  document.getElementById('decision-summary').className = 'card';
  document.getElementById('decision-summary').innerHTML = `
    <h3 style="margin-top:0;">Ação recomendada</h3>
    <p>A IA selecionou o veículo <strong>${escapeHtml(lastRequest.vehicleId || '-')}</strong> para atender a solicitação <strong>${escapeHtml(lastRequest.id)}</strong>.</p>
    <p>Motivos principais: prioridade ${escapeHtml(lastRequest.priority)}, compatibilidade com a carga ${escapeHtml(lastRequest.cargoType)} e melhor equilíbrio entre disponibilidade, capacidade e ETA.</p>
  `;
}

function renderVehicles() {
  const tbody = document.getElementById('vehicles-table-body');
  tbody.innerHTML = state.vehicles.map(vehicle => `
    <tr>
      <td><strong>${escapeHtml(vehicle.id)}</strong></td>
      <td>${escapeHtml(vehicle.location)}</td>
      <td><span class="tag ${tagClass(vehicle.status)}">${escapeHtml(vehicle.status)}</span></td>
      <td>${vehicle.currentLoad} / ${vehicle.capacity}</td>
      <td>${vehicle.eta} min</td>
    </tr>
  `).join('');
}

function renderCargo() {
  const vehicleSelect = document.getElementById('cargoVehicleId');
  vehicleSelect.innerHTML = state.vehicles.map(v => `<option value="${v.id}">${v.id} — ${escapeHtml(v.location)}</option>`).join('');

  const tbody = document.getElementById('cargo-table-body');
  tbody.innerHTML = state.cargoRecords.map(cargo => `
    <tr>
      <td><strong>${escapeHtml(cargo.id)}</strong></td>
      <td>${escapeHtml(cargo.vehicleId)}</td>
      <td>${escapeHtml(cargo.cargoType)}</td>
      <td>${cargo.weight}</td>
      <td><span class="tag ${tagClass(cargo.status)}">${escapeHtml(cargo.status)}</span></td>
      <td>${escapeHtml(cargo.destination)}</td>
    </tr>
  `).join('');
}

function initMap() {
  map = L.map('real-map').setView([-2.5608, -44.3755], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'legend-box');
    div.innerHTML = `
      <strong>Legenda</strong>
      <div class="legend-row"><span class="legend-dot" style="background:#2563eb"></span> Origem</div>
      <div class="legend-row"><span class="legend-dot" style="background:#10b981"></span> Destino</div>
      <div class="legend-row"><span class="legend-dot" style="background:#f59e0b"></span> Veículo recomendado</div>
      <div class="legend-row"><span class="legend-line" style="background:#2563eb"></span> Rota principal</div>
      <div class="legend-row"><span class="legend-line" style="background:#10b981"></span> Rota alternativa</div>
    `;
    return div;
  };
  legend.addTo(map);

  updateMap();
}

function clearMapLayers() {
  mapLayers.forEach(layer => map.removeLayer(layer));
  mapLayers = [];
}

function updateMap() {
  if (!map) return;
  clearMapLayers();
  const lastRequest = getLastRequest();
  const recommendedId = lastRequest?.vehicleId || 'V02';

  document.querySelector('[data-role="map-origin"]').textContent = lastRequest?.origin || 'Pátio 1';
  document.querySelector('[data-role="map-destination"]').textContent = lastRequest?.destination || 'Cais 7';
  document.querySelector('[data-role="map-recommended-vehicle"]').textContent = recommendedId;

  const origin = [-2.548, -44.382];
  const mid1 = [-2.5535, -44.374];
  const dest = [-2.5655, -44.3595];
  const alt1 = [-2.557, -44.387];
  const alt2 = [-2.5705, -44.3725];
  const blockage = [-2.5574, -44.371];
  const vehiclePoint = [-2.5545, -44.3795];

  const originMarker = L.circleMarker(origin, { radius: 9, color: '#2563eb', fillColor: '#2563eb', fillOpacity: 1 }).bindPopup(`Origem: ${lastRequest?.origin || 'Pátio 1'}`);
  const destMarker = L.circleMarker(dest, { radius: 9, color: '#10b981', fillColor: '#10b981', fillOpacity: 1 }).bindPopup(`Destino: ${lastRequest?.destination || 'Cais 7'}`);
  const blockMarker = L.circleMarker(blockage, { radius: 7, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }).bindPopup('Bloqueio operacional');
  const vehicleMarker = L.circleMarker(vehiclePoint, { radius: 8, color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 1 }).bindPopup(`Veículo recomendado: ${recommendedId}`);

  const mainRoute = L.polyline([origin, mid1, dest], { color: '#2563eb', weight: 5, opacity: 0.85 });
  const altRoute = L.polyline([origin, alt1, alt2, dest], { color: '#10b981', weight: 5, opacity: 0.85, dashArray: '10 8' });

  mapLayers.push(originMarker, destMarker, blockMarker, vehicleMarker, mainRoute, altRoute);
  mapLayers.forEach(layer => layer.addTo(map));
}

function addRequest(form) {
  const data = new FormData(form);
  const request = {
    id: `REQ-${String(state.requestCounter).padStart(3, '0')}`,
    origin: data.get('origin')?.toString().trim() || 'Não informado',
    destination: data.get('destination')?.toString().trim() || 'Não informado',
    priority: data.get('priority')?.toString() || 'Média',
    cargoType: data.get('cargoType')?.toString() || 'Carga geral',
    weight: Number(data.get('weight') || 0),
    notes: data.get('notes')?.toString().trim() || '',
    preferredVehicle: data.get('preferredVehicle')?.toString() || '',
    status: 'Em análise',
    createdAt: new Date().toISOString()
  };

  const recommendation = computeRecommendation(request);
  request.vehicleId = recommendation?.[0]?.id || '';
  request.score = recommendation?.[0]?.score || 0;

  state.requestCounter += 1;
  state.requests.push(request);
  state.events.unshift({ type: 'info', title: `Nova solicitação ${request.id} criada`, time: 'agora' });
  state.events = state.events.slice(0, 6);
  saveState();
  form.reset();
  renderAll();
  setPage('decisao');
}

function addCargo(form) {
  const data = new FormData(form);
  const cargo = {
    id: `CG-${String(state.cargoRecords.length + 1).padStart(3, '0')}`,
    vehicleId: data.get('vehicleId')?.toString() || 'Sem veículo',
    cargoType: data.get('cargoType')?.toString() || 'Carga geral',
    weight: Number(data.get('weight') || 0),
    origin: data.get('origin')?.toString() || 'Não informado',
    destination: data.get('destination')?.toString() || 'Não informado',
    status: data.get('status')?.toString() || 'Registrada',
    eta: data.get('eta')?.toString() || '--:--',
    confidence: Number(data.get('confidence') || 95),
    notes: data.get('notes')?.toString() || ''
  };

  state.cargoRecords.push(cargo);
  const vehicle = state.vehicles.find(v => v.id === cargo.vehicleId);
  if (vehicle) {
    vehicle.currentLoad = cargo.weight;
    vehicle.cargoType = cargo.cargoType;
    vehicle.location = cargo.origin;
    vehicle.status = cargo.status === 'Entregue' ? 'Disponível' : 'Em rota';
    vehicle.available = cargo.status === 'Entregue';
  }
  state.events.unshift({ type: 'success', title: `Carga ${cargo.id} vinculada ao ${cargo.vehicleId}`, time: 'agora' });
  state.events = state.events.slice(0, 6);
  saveState();
  form.reset();
  renderAll();
}

function addVehicle(form) {
  const data = new FormData(form);
  const status = data.get('status')?.toString() || 'Disponível';
  const vehicle = {
    id: `V${String(state.vehicleCounter).padStart(2, '0')}`,
    location: data.get('location')?.toString() || 'Base',
    status,
    available: status === 'Disponível',
    capacity: Number(data.get('capacity') || 0),
    currentLoad: Number(data.get('currentLoad') || 0),
    cargoType: data.get('cargoType')?.toString() || 'Livre',
    eta: Number(data.get('eta') || 10)
  };
  state.vehicleCounter += 1;
  state.vehicles.push(vehicle);
  state.events.unshift({ type: 'info', title: `Veículo ${vehicle.id} cadastrado`, time: 'agora' });
  state.events = state.events.slice(0, 6);
  saveState();
  form.reset();
  renderAll();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vale-portsync-dados.json';
  a.click();
  URL.revokeObjectURL(url);
}

function resetData() {
  state = structuredClone(defaultState);
  saveState();
  renderAll();
  setPage('inicio');
}

function renderAll() {
  renderOverview();
  renderEvents();
  renderRequestPage();
  renderDecision();
  renderVehicles();
  renderCargo();
  updateMap();
}

function bindEvents() {
  document.querySelectorAll('[data-page-btn]').forEach(btn => btn.addEventListener('click', () => setPage(btn.dataset.pageBtn)));
  document.querySelectorAll('[data-go-page]').forEach(btn => btn.addEventListener('click', () => setPage(btn.dataset.goPage)));
  document.getElementById('request-form').addEventListener('submit', event => {
    event.preventDefault();
    addRequest(event.currentTarget);
  });
  document.getElementById('cargo-form').addEventListener('submit', event => {
    event.preventDefault();
    addCargo(event.currentTarget);
  });
  document.getElementById('vehicle-form').addEventListener('submit', event => {
    event.preventDefault();
    addVehicle(event.currentTarget);
  });
  document.getElementById('export-data-btn').addEventListener('click', exportData);
  document.getElementById('reset-data-btn').addEventListener('click', resetData);
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  initMap();
  renderAll();
  setPage(state.currentPage || 'inicio');
});
