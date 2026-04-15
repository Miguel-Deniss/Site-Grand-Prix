const STORAGE_KEYS = {
  vehicles: "flowtrack_vehicles",
  needs: "flowtrack_needs",
  history: "flowtrack_history"
};

const MAP_CONFIG = {
  center: [-2.565, -44.370],
  zoom: 14
};

const OPERATING_TEAMS = [
  { id: "team_1", name: "Equipe de Inspeção Operacional" },
  { id: "team_2", name: "Equipe de Apoio em Campo" },
  { id: "team_3", name: "Equipe de Atendimento de Ocorrências" },
  { id: "team_4", name: "Equipe de Mobilidade Portuária" },
  { id: "team_5", name: "Equipe de Supervisão de Pátio" }
];

const AVERAGE_SPEED_KMH = 28;

let state = {
  vehicles: [],
  needs: [],
  history: []
};

let map = null;
let mapLayers = [];
let selectedNeedMarker = null;
let selectedNeedPoint = null;
let activeRouteLine = null;

function generateId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("pt-BR");
}

function urgencyWeight(urgency) {
  return {
    CRITICA: 4,
    ALTA: 3,
    MEDIA: 2,
    BAIXA: 1
  }[urgency] || 0;
}

function statusBadge(text, cls) {
  return `<span class="badge ${cls}">${text}</span>`;
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.vehicles, JSON.stringify(state.vehicles));
  localStorage.setItem(STORAGE_KEYS.needs, JSON.stringify(state.needs));
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(state.history));
}

function loadState() {
  const vehicles = JSON.parse(localStorage.getItem(STORAGE_KEYS.vehicles) || "null");
  const needs = JSON.parse(localStorage.getItem(STORAGE_KEYS.needs) || "null");
  const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || "null");

  if (vehicles && needs && history) {
    state.vehicles = vehicles;
    state.needs = needs;
    state.history = history;
  } else {
    seedInitialData();
    saveState();
  }
}

function seedInitialData() {
  state.vehicles = [
    {
      id: "vehicle_1",
      code: "Veículo 01",
      type: "Caminhonete Operacional",
      plate: "QWE-1010",
      status: "DISPONIVEL",
      latitude: -2.558,
      longitude: -44.370,
      teamId: "team_1"
    },
    {
      id: "vehicle_2",
      code: "Veículo 02",
      type: "Van de Apoio",
      plate: "QWE-2020",
      status: "EM_ROTA",
      latitude: -2.563,
      longitude: -44.364,
      teamId: "team_3"
    },
    {
      id: "vehicle_3",
      code: "Veículo 03",
      type: "Utilitário",
      plate: "QWE-3030",
      status: "DISPONIVEL",
      latitude: -2.566,
      longitude: -44.373,
      teamId: "team_2"
    },
    {
      id: "vehicle_4",
      code: "Veículo 04",
      type: "Caminhonete 4x4",
      plate: "QWE-4040",
      status: "MANUTENCAO",
      latitude: -2.575,
      longitude: -44.376,
      teamId: ""
    },
    {
      id: "vehicle_5",
      code: "Veículo 05",
      type: "Carro de Inspeção",
      plate: "QWE-5050",
      status: "DISPONIVEL",
      latitude: -2.570,
      longitude: -44.368,
      teamId: "team_4"
    },
    {
      id: "vehicle_6",
      code: "Veículo 06",
      type: "Utilitário Leve",
      plate: "QWE-6060",
      status: "DISPONIVEL",
      latitude: -2.572,
      longitude: -44.374,
      teamId: "team_5"
    }
  ];

  state.needs = [
    {
      id: "need_1",
      title: "Falha em comunicação no setor A",
      description: "Equipe relatou instabilidade de comunicação operacional.",
      sector: "Setor A",
      latitude: -2.560,
      longitude: -44.367,
      urgency: "ALTA",
      status: "ABERTA",
      assignedVehicleId: "",
      createdAt: new Date().toISOString()
    },
    {
      id: "need_2",
      title: "Inspeção emergencial em acesso",
      description: "Necessária verificação imediata de via operacional.",
      sector: "Acesso Norte",
      latitude: -2.557,
      longitude: -44.373,
      urgency: "CRITICA",
      status: "ABERTA",
      assignedVehicleId: "",
      createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString()
    },
    {
      id: "need_3",
      title: "Apoio de equipe em reconhecimento",
      description: "Solicitação de apoio para deslocamento rápido.",
      sector: "Reconhecimento",
      latitude: -2.565,
      longitude: -44.365,
      urgency: "MEDIA",
      status: "EM_ATENDIMENTO",
      assignedVehicleId: "vehicle_2",
      createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString()
    },
    {
      id: "need_4",
      title: "Transporte interno de supervisor",
      description: "Necessário deslocamento entre áreas operacionais.",
      sector: "Pátio Central",
      latitude: -2.568,
      longitude: -44.371,
      urgency: "BAIXA",
      status: "ABERTA",
      assignedVehicleId: "",
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
    }
  ];

  state.history = [
    {
      id: "history_1",
      needId: "need_3",
      vehicleId: "vehicle_2",
      urgency: "MEDIA",
      dispatchedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      completedAt: null,
      responseTimeMinutes: null
    }
  ];
}

function getVehicleById(id) {
  return state.vehicles.find((item) => item.id === id);
}

function getNeedById(id) {
  return state.needs.find((item) => item.id === id);
}

function getTeamNameById(id) {
  const team = OPERATING_TEAMS.find((item) => item.id === id);
  return team ? team.name : "-";
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function estimateTravelTimeMinutes(distanceKm) {
  const hours = distanceKm / AVERAGE_SPEED_KMH;
  return Math.max(1, Math.round(hours * 60));
}

function formatTravelTime(distanceKm) {
  const minutes = estimateTravelTimeMinutes(distanceKm);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${remainingMinutes} min`;
}

function getBestVehicleForNeed(needId) {
  const need = getNeedById(needId);
  if (!need) return null;

  const availableVehicles = state.vehicles.filter((vehicle) => vehicle.status === "DISPONIVEL");

  if (!availableVehicles.length) {
    return {
      bestVehicle: null,
      nearestVehicles: []
    };
  }

  const ranked = availableVehicles
    .map((vehicle) => {
      const distanceKm = haversineDistance(
        vehicle.latitude,
        vehicle.longitude,
        need.latitude,
        need.longitude
      );

      return {
        vehicle,
        distanceKm,
        estimatedTimeMinutes: estimateTravelTimeMinutes(distanceKm),
        estimatedTimeLabel: formatTravelTime(distanceKm)
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return {
    bestVehicle: ranked[0] || null,
    nearestVehicles: ranked.slice(0, 3)
  };
}

function getRebalanceSuggestions() {
  const urgentNeeds = state.needs.filter(
    (need) => need.status === "ABERTA" && ["ALTA", "CRITICA"].includes(need.urgency)
  );

  return urgentNeeds.slice(0, 3).map((need) => {
    const bestInfo = getBestVehicleForNeed(need.id);

    return {
      needTitle: need.title,
      vehicleCode: bestInfo?.bestVehicle ? bestInfo.bestVehicle.vehicle.code : "Nenhum disponível",
      eta: bestInfo?.bestVehicle ? bestInfo.bestVehicle.estimatedTimeLabel : "-",
      reason: "Prioridade alta no painel operacional"
    };
  });
}

function renderTeamOptions() {
  const vehicleTeamSelect = document.getElementById("vehicleTeamId");
  vehicleTeamSelect.innerHTML = `<option value="">Nenhuma</option>`;

  OPERATING_TEAMS.forEach((team) => {
    vehicleTeamSelect.innerHTML += `<option value="${team.id}">${team.name}</option>`;
  });
}

function renderDashboard() {
  const dashboardCards = document.getElementById("dashboardCards");

  const totalVehicles = state.vehicles.length;
  const availableVehicles = state.vehicles.filter((v) => v.status === "DISPONIVEL").length;
  const routeVehicles = state.vehicles.filter((v) => v.status === "EM_ROTA").length;
  const maintenanceVehicles = state.vehicles.filter((v) => v.status === "MANUTENCAO").length;

  const openNeeds = state.needs.filter((n) => n.status !== "CONCLUIDA");
  const totalOpenNeeds = openNeeds.length;
  const urgencyCounts = {
    BAIXA: openNeeds.filter((n) => n.urgency === "BAIXA").length,
    MEDIA: openNeeds.filter((n) => n.urgency === "MEDIA").length,
    ALTA: openNeeds.filter((n) => n.urgency === "ALTA").length,
    CRITICA: openNeeds.filter((n) => n.urgency === "CRITICA").length
  };

  dashboardCards.innerHTML = `
    <div class="card"><div class="label">Total de veículos</div><div class="value">${totalVehicles}</div><div class="sub">Disponíveis: ${availableVehicles}</div></div>
    <div class="card"><div class="label">Veículos em rota</div><div class="value">${routeVehicles}</div><div class="sub">Manutenção: ${maintenanceVehicles}</div></div>
    <div class="card"><div class="label">Necessidades abertas</div><div class="value">${totalOpenNeeds}</div><div class="sub">Críticas: ${urgencyCounts.CRITICA} | Altas: ${urgencyCounts.ALTA}</div></div>
    <div class="card"><div class="label">Urgências</div><div class="value">${urgencyCounts.ALTA + urgencyCounts.CRITICA}</div><div class="sub">Média: ${urgencyCounts.MEDIA} | Baixa: ${urgencyCounts.BAIXA}</div></div>
  `;

  renderOpenNeedsList();
  renderRebalanceSuggestions();
}

function renderOpenNeedsList() {
  const container = document.getElementById("openNeedsList");
  const sortedNeeds = [...state.needs]
    .filter((n) => n.status !== "CONCLUIDA")
    .sort((a, b) => urgencyWeight(b.urgency) - urgencyWeight(a.urgency));

  if (!sortedNeeds.length) {
    container.innerHTML = `<div class="empty-state">Nenhuma necessidade aberta.</div>`;
    return;
  }

  container.innerHTML = sortedNeeds
    .map((need) => {
      const suggestion = getBestVehicleForNeed(need.id);
      const best = suggestion?.bestVehicle;

      return `
        <div class="item-card">
          <h5>${need.title}</h5>
          <p><strong>Setor:</strong> ${need.sector}</p>
          <p><strong>Urgência:</strong> ${statusBadge(need.urgency, need.urgency.toLowerCase())}</p>
          <p><strong>Status:</strong> ${statusBadge(need.status.replace("_", " "), need.status.toLowerCase())}</p>
          <p><strong>Melhor veículo:</strong> ${
            best ? `${best.vehicle.code} (${best.distanceKm.toFixed(2)} km)` : "Nenhum disponível"
          }</p>
          <p><strong>Tempo estimado:</strong> ${best ? best.estimatedTimeLabel : "-"}</p>
        </div>
      `;
    })
    .join("");
}

function renderRebalanceSuggestions() {
  const container = document.getElementById("rebalanceSuggestions");
  const suggestions = getRebalanceSuggestions();

  if (!suggestions.length) {
    container.innerHTML = `<div class="empty-state">Nenhuma sugestão no momento.</div>`;
    return;
  }

  container.innerHTML = suggestions
    .map(
      (item) => `
      <div class="item-card">
        <h5>${item.needTitle}</h5>
        <p><strong>Veículo sugerido:</strong> ${item.vehicleCode}</p>
        <p><strong>Tempo estimado:</strong> ${item.eta}</p>
        <p>${item.reason}</p>
      </div>
    `
    )
    .join("");
}

function renderVehicles() {
  const tbody = document.getElementById("vehiclesTableBody");

  if (!state.vehicles.length) {
    tbody.innerHTML = `<tr><td colspan="6">Nenhum veículo cadastrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.vehicles
    .map((vehicle) => {
      return `
        <tr>
          <td>${vehicle.code}</td>
          <td>${vehicle.type}</td>
          <td>${vehicle.plate}</td>
          <td>${statusBadge(vehicle.status.replace("_", " "), vehicle.status.toLowerCase())}</td>
          <td>${getTeamNameById(vehicle.teamId)}</td>
          <td>
            <div class="actions">
              <button class="small-btn" onclick="editVehicle('${vehicle.id}')">Editar</button>
              <button class="small-btn danger" onclick="deleteVehicle('${vehicle.id}')">Excluir</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderNeeds() {
  const container = document.getElementById("needsCards");

  if (!state.needs.length) {
    container.innerHTML = `<div class="empty-state">Nenhuma necessidade cadastrada.</div>`;
    return;
  }

  const sortedNeeds = [...state.needs].sort((a, b) => urgencyWeight(b.urgency) - urgencyWeight(a.urgency));

  container.innerHTML = sortedNeeds
    .map((need) => {
      const assignedVehicle = getVehicleById(need.assignedVehicleId);
      const bestInfo = getBestVehicleForNeed(need.id);
      const best = bestInfo?.bestVehicle;

      return `
        <div class="item-card">
          <h5>${need.title}</h5>
          <p>${need.description}</p>
          <p><strong>Setor:</strong> ${need.sector}</p>
          <p><strong>Urgência:</strong> ${statusBadge(need.urgency, need.urgency.toLowerCase())}</p>
          <p><strong>Status:</strong> ${statusBadge(need.status.replace("_", " "), need.status.toLowerCase())}</p>
          <p><strong>Veículo designado:</strong> ${assignedVehicle ? assignedVehicle.code : "-"}</p>
          <p><strong>Sugestão automática:</strong> ${
            best ? `${best.vehicle.code} (${best.distanceKm.toFixed(2)} km)` : "Nenhum veículo disponível"
          }</p>
          <p><strong>Tempo estimado:</strong> ${best ? best.estimatedTimeLabel : "-"}</p>
          <div class="item-actions">
            <button class="small-btn" onclick="editNeed('${need.id}')">Editar</button>
            <button class="small-btn" onclick="drawBestRoute('${need.id}')">Ver rota</button>
            ${
              need.status === "ABERTA" && best
                ? `<button class="small-btn success" onclick="dispatchNeed('${need.id}', '${best.vehicle.id}')">Despachar melhor veículo</button>`
                : ""
            }
            ${
              need.status === "EM_ATENDIMENTO"
                ? `<button class="small-btn warning" onclick="completeNeed('${need.id}')">Concluir</button>`
                : ""
            }
            <button class="small-btn danger" onclick="deleteNeed('${need.id}')">Excluir</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderHistory() {
  const tbody = document.getElementById("historyTableBody");

  if (!state.history.length) {
    tbody.innerHTML = `<tr><td colspan="6">Nenhum histórico registrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = [...state.history]
    .sort((a, b) => new Date(b.dispatchedAt) - new Date(a.dispatchedAt))
    .map((item) => {
      const need = getNeedById(item.needId);
      const vehicle = getVehicleById(item.vehicleId);

      return `
        <tr>
          <td>${need ? need.title : "-"}</td>
          <td>${vehicle ? vehicle.code : "-"}</td>
          <td>${item.urgency ? statusBadge(item.urgency, item.urgency.toLowerCase()) : "-"}</td>
          <td>${formatDate(item.dispatchedAt)}</td>
          <td>${formatDate(item.completedAt)}</td>
          <td>${item.responseTimeMinutes != null ? `${item.responseTimeMinutes} min` : "-"}</td>
        </tr>
      `;
    })
    .join("");
}

function createDivIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div class="custom-marker" style="background:${color};"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10]
  });
}

function updateSelectedMapPointBox() {
  const box = document.getElementById("selectedMapPoint");
  if (!box) return;

  if (!selectedNeedPoint) {
    box.textContent = "Clique no mapa para definir a localização da necessidade.";
    return;
  }

  box.innerHTML = `
    Ponto selecionado com sucesso no mapa.
  `;
}

function initializeMap() {
  const mapElement = document.getElementById("mapArea");
  if (!mapElement) return;

  if (map) {
    setTimeout(() => map.invalidateSize(), 250);
    return;
  }

  map = L.map("mapArea", {
    preferCanvas: true
  }).setView(MAP_CONFIG.center, MAP_CONFIG.zoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  map.on("click", (e) => {
    const lat = Number(e.latlng.lat.toFixed(6));
    const lng = Number(e.latlng.lng.toFixed(6));

    selectedNeedPoint = { lat, lng };

    document.getElementById("needLatitude").value = lat;
    document.getElementById("needLongitude").value = lng;
    updateSelectedMapPointBox();

    if (selectedNeedMarker && map.hasLayer(selectedNeedMarker)) {
      map.removeLayer(selectedNeedMarker);
    }

    selectedNeedMarker = L.marker([lat, lng], {
      icon: createDivIcon("#111827")
    }).addTo(map);

    selectedNeedMarker
      .bindPopup(`
        <strong>Local da necessidade</strong><br>
        Ponto marcado com sucesso.
      `)
      .openPopup();
  });

  setTimeout(() => {
    map.invalidateSize();
    map.setView(MAP_CONFIG.center, MAP_CONFIG.zoom);
  }, 300);
}

function clearMapLayers() {
  if (!map) return;

  mapLayers.forEach((layer) => {
    if (map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
  });

  mapLayers = [];

  if (activeRouteLine && map.hasLayer(activeRouteLine)) {
    map.removeLayer(activeRouteLine);
    activeRouteLine = null;
  }
}

function renderMap() {
  const mapElement = document.getElementById("mapArea");
  if (!mapElement) return;

  initializeMap();
  if (!map) return;

  clearMapLayers();

  const bounds = [];

  state.vehicles.forEach((vehicle) => {
    const colorMap = {
      DISPONIVEL: "#16a34a",
      EM_ROTA: "#2563eb",
      MANUTENCAO: "#64748b"
    };

    const marker = L.marker([vehicle.latitude, vehicle.longitude], {
      icon: createDivIcon(colorMap[vehicle.status] || "#2563eb")
    }).bindPopup(`
      <strong>${vehicle.code}</strong><br>
      Tipo: ${vehicle.type}<br>
      Status: ${vehicle.status}<br>
      Placa: ${vehicle.plate}<br>
      Equipe: ${getTeamNameById(vehicle.teamId)}
    `);

    marker.addTo(map);
    mapLayers.push(marker);
    bounds.push([vehicle.latitude, vehicle.longitude]);
  });

  state.needs.forEach((need) => {
    const colorMap = {
      BAIXA: "#facc15",
      MEDIA: "#f59e0b",
      ALTA: "#ef4444",
      CRITICA: "#7f1d1d"
    };

    const bestInfo = getBestVehicleForNeed(need.id);
    const eta = bestInfo?.bestVehicle ? bestInfo.bestVehicle.estimatedTimeLabel : "-";

    const marker = L.marker([need.latitude, need.longitude], {
      icon: createDivIcon(colorMap[need.urgency] || "#ef4444")
    }).bindPopup(`
      <strong>${need.title}</strong><br>
      Setor: ${need.sector}<br>
      Urgência: ${need.urgency}<br>
      Status: ${need.status}<br>
      Tempo estimado do melhor veículo: ${eta}<br>
      <button class="route-btn" onclick="drawBestRoute('${need.id}')">Ver rota do melhor veículo</button>
    `);

    marker.addTo(map);
    mapLayers.push(marker);
    bounds.push([need.latitude, need.longitude]);
  });

  if (selectedNeedPoint) {
    if (selectedNeedMarker && map.hasLayer(selectedNeedMarker)) {
      map.removeLayer(selectedNeedMarker);
    }

    selectedNeedMarker = L.marker([selectedNeedPoint.lat, selectedNeedPoint.lng], {
      icon: createDivIcon("#111827")
    }).addTo(map);
  }

  if (bounds.length) {
    map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] });
  } else {
    map.setView(MAP_CONFIG.center, MAP_CONFIG.zoom);
  }

  setTimeout(() => map.invalidateSize(), 200);
}

function drawBestRoute(needId) {
  const need = getNeedById(needId);
  const bestInfo = getBestVehicleForNeed(needId);

  if (!need || !bestInfo || !bestInfo.bestVehicle) {
    alert("Não há veículo disponível para essa necessidade.");
    return;
  }

  const vehicle = bestInfo.bestVehicle.vehicle;

  if (activeRouteLine && map.hasLayer(activeRouteLine)) {
    map.removeLayer(activeRouteLine);
  }

  activeRouteLine = L.polyline(
    [
      [vehicle.latitude, vehicle.longitude],
      [need.latitude, need.longitude]
    ],
    {
      color: "#2563eb",
      weight: 5,
      opacity: 0.85
    }
  ).addTo(map);

  map.fitBounds(activeRouteLine.getBounds(), { padding: [50, 50] });

  activeRouteLine.bindPopup(`
    <strong>Rota sugerida</strong><br>
    Veículo: ${vehicle.code}<br>
    Necessidade: ${need.title}<br>
    Distância estimada: ${bestInfo.bestVehicle.distanceKm.toFixed(2)} km<br>
    Tempo estimado: ${bestInfo.bestVehicle.estimatedTimeLabel}
  `).openPopup();
}

function renderAll() {
  renderTeamOptions();
  renderDashboard();
  renderVehicles();
  renderNeeds();
  renderHistory();
  updateSelectedMapPointBox();

  const needsSection = document.getElementById("needs");
  if (needsSection && needsSection.classList.contains("active")) {
    setTimeout(() => {
      initializeMap();
      renderMap();
    }, 150);
  }
}

function clearVehicleForm() {
  document.getElementById("vehicleForm").reset();
  document.getElementById("vehicleId").value = "";
  document.getElementById("vehicleFormTitle").textContent = "Cadastrar Veículo";
  document.getElementById("cancelVehicleEdit").classList.add("hidden");
}

function clearNeedForm() {
  document.getElementById("needForm").reset();
  document.getElementById("needId").value = "";
  document.getElementById("needLatitude").value = "";
  document.getElementById("needLongitude").value = "";
  selectedNeedPoint = null;

  if (map && selectedNeedMarker && map.hasLayer(selectedNeedMarker)) {
    map.removeLayer(selectedNeedMarker);
    selectedNeedMarker = null;
  }

  document.getElementById("needFormTitle").textContent = "Cadastrar Necessidade";
  document.getElementById("cancelNeedEdit").classList.add("hidden");
  updateSelectedMapPointBox();
}

function editVehicle(id) {
  const vehicle = getVehicleById(id);
  if (!vehicle) return;

  document.getElementById("vehicleId").value = vehicle.id;
  document.getElementById("vehicleCode").value = vehicle.code;
  document.getElementById("vehicleType").value = vehicle.type;
  document.getElementById("vehiclePlate").value = vehicle.plate;
  document.getElementById("vehicleStatus").value = vehicle.status;
  document.getElementById("vehicleTeamId").value = vehicle.teamId || "";
  document.getElementById("vehicleFormTitle").textContent = "Editar Veículo";
  document.getElementById("cancelVehicleEdit").classList.remove("hidden");
}

function editNeed(id) {
  const need = getNeedById(id);
  if (!need) return;

  document.getElementById("needId").value = need.id;
  document.getElementById("needTitle").value = need.title;
  document.getElementById("needSector").value = need.sector;
  document.getElementById("needDescription").value = need.description;
  document.getElementById("needUrgency").value = need.urgency;
  document.getElementById("needStatus").value = need.status;
  document.getElementById("needLatitude").value = need.latitude;
  document.getElementById("needLongitude").value = need.longitude;

  selectedNeedPoint = {
    lat: need.latitude,
    lng: need.longitude
  };

  updateSelectedMapPointBox();

  if (map) {
    if (selectedNeedMarker && map.hasLayer(selectedNeedMarker)) {
      map.removeLayer(selectedNeedMarker);
    }

    selectedNeedMarker = L.marker([need.latitude, need.longitude], {
      icon: createDivIcon("#111827")
    }).addTo(map);

    map.setView([need.latitude, need.longitude], 15);
  }

  document.getElementById("needFormTitle").textContent = "Editar Necessidade";
  document.getElementById("cancelNeedEdit").classList.remove("hidden");
}

function deleteVehicle(id) {
  const vehicleLinkedNeed = state.needs.some((need) => need.assignedVehicleId === id && need.status !== "CONCLUIDA");
  if (vehicleLinkedNeed) {
    alert("Este veículo está ligado a uma necessidade em andamento.");
    return;
  }

  state.vehicles = state.vehicles.filter((item) => item.id !== id);
  saveState();
  renderAll();
}

function deleteNeed(id) {
  state.needs = state.needs.filter((item) => item.id !== id);
  state.history = state.history.filter((item) => item.needId !== id);
  saveState();
  renderAll();
}

function dispatchNeed(needId, vehicleId) {
  const need = getNeedById(needId);
  const vehicle = getVehicleById(vehicleId);

  if (!need || !vehicle) return;

  if (vehicle.status !== "DISPONIVEL") {
    alert("Somente veículos disponíveis podem ser despachados.");
    return;
  }

  vehicle.status = "EM_ROTA";
  need.status = "EM_ATENDIMENTO";
  need.assignedVehicleId = vehicle.id;

  state.history.push({
    id: generateId("history"),
    needId: need.id,
    vehicleId: vehicle.id,
    urgency: need.urgency,
    dispatchedAt: new Date().toISOString(),
    completedAt: null,
    responseTimeMinutes: null
  });

  saveState();
  renderAll();
}

function completeNeed(needId) {
  const need = getNeedById(needId);
  if (!need) return;

  const historyEntry = [...state.history]
    .reverse()
    .find((item) => item.needId === need.id && !item.completedAt);

  if (!historyEntry) {
    alert("Nenhum despacho ativo encontrado para esta necessidade.");
    return;
  }

  need.status = "CONCLUIDA";

  const vehicle = getVehicleById(need.assignedVehicleId);
  if (vehicle) {
    vehicle.status = "DISPONIVEL";
  }

  historyEntry.completedAt = new Date().toISOString();
  historyEntry.responseTimeMinutes = Math.round(
    (new Date(historyEntry.completedAt) - new Date(historyEntry.dispatchedAt)) / 60000
  );

  saveState();
  renderAll();
}

function initMenu() {
  const buttons = document.querySelectorAll(".menu-btn");
  const sections = document.querySelectorAll(".section");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      sections.forEach((section) => section.classList.remove("active"));

      button.classList.add("active");
      document.getElementById(button.dataset.section).classList.add("active");

      if (button.dataset.section === "needs") {
        setTimeout(() => {
          initializeMap();
          renderMap();
          if (map) map.invalidateSize();
        }, 250);
      }
    });
  });
}

function initForms() {
  document.getElementById("vehicleForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const id = document.getElementById("vehicleId").value;
    const currentVehicle = id ? getVehicleById(id) : null;

    const payload = {
      id: id || generateId("vehicle"),
      code: document.getElementById("vehicleCode").value,
      type: document.getElementById("vehicleType").value,
      plate: document.getElementById("vehiclePlate").value,
      status: document.getElementById("vehicleStatus").value,
      latitude: currentVehicle?.latitude ?? MAP_CONFIG.center[0],
      longitude: currentVehicle?.longitude ?? MAP_CONFIG.center[1],
      teamId: document.getElementById("vehicleTeamId").value
    };

    if (id) {
      const index = state.vehicles.findIndex((item) => item.id === id);
      state.vehicles[index] = payload;
    } else {
      state.vehicles.push(payload);
    }

    saveState();
    clearVehicleForm();
    renderAll();
  });

  document.getElementById("needForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const lat = document.getElementById("needLatitude").value;
    const lng = document.getElementById("needLongitude").value;

    if (!lat || !lng) {
      alert("Selecione o ponto da necessidade no mapa.");
      return;
    }

    const id = document.getElementById("needId").value;
    const previousNeed = id ? getNeedById(id) : null;
    const newStatus = document.getElementById("needStatus").value;

    const payload = {
      id: id || generateId("need"),
      title: document.getElementById("needTitle").value,
      sector: document.getElementById("needSector").value,
      description: document.getElementById("needDescription").value,
      urgency: document.getElementById("needUrgency").value,
      status: newStatus,
      latitude: Number(lat),
      longitude: Number(lng),
      assignedVehicleId: previousNeed?.assignedVehicleId || "",
      createdAt: previousNeed?.createdAt || new Date().toISOString()
    };

    if (id) {
      const index = state.needs.findIndex((item) => item.id === id);
      state.needs[index] = payload;

      if (previousNeed && previousNeed.status === "EM_ATENDIMENTO" && newStatus === "CONCLUIDA") {
        completeNeed(id);
        clearNeedForm();
        return;
      }
    } else {
      state.needs.push(payload);
    }

    saveState();
    clearNeedForm();
    renderAll();
  });

  document.getElementById("cancelVehicleEdit").addEventListener("click", clearVehicleForm);
  document.getElementById("cancelNeedEdit").addEventListener("click", clearNeedForm);

  document.getElementById("resetDataBtn").addEventListener("click", () => {
    const confirmed = confirm("Deseja realmente resetar todos os dados?");
    if (!confirmed) return;

    localStorage.removeItem(STORAGE_KEYS.vehicles);
    localStorage.removeItem(STORAGE_KEYS.needs);
    localStorage.removeItem(STORAGE_KEYS.history);

    seedInitialData();
    saveState();
    clearVehicleForm();
    clearNeedForm();
    renderAll();
  });
}

function init() {
  loadState();
  initMenu();
  initForms();
  clearVehicleForm();
  clearNeedForm();
  renderTeamOptions();
  renderAll();
}

window.editVehicle = editVehicle;
window.editNeed = editNeed;
window.deleteVehicle = deleteVehicle;
window.deleteNeed = deleteNeed;
window.dispatchNeed = dispatchNeed;
window.completeNeed = completeNeed;
window.drawBestRoute = drawBestRoute;

document.addEventListener("DOMContentLoaded", init);