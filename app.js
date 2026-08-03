const rgColorMap = {
  BAR: '#2783de',
  DAT: '#46A171',
  GRO: '#D5803B',
  HER: '#E56458',
  HES: '#8B5CF6',
  JAR: '#14B8A6',
  LIN: '#F59E0B',
  MEI: '#6366F1',
  MUN: '#10B981',
  NOR: '#0EA5E9',
  RAD: '#EF4444',
  SEE: '#EC4899',
  SEF: '#84CC16',
  SHO: '#F97316',
  SIE: '#06B6D4',
  WEI: '#A855F7',
  WER: '#22C55E',
  WEY: '#3B82F6',
  WIL: '#F43F5E'
};

const fallbackColors = [
  '#5E9FE8',
  '#EAC26B',
  '#72BC8F',
  '#BF8EDA',
  '#DE9255',
  '#DF84A8',
  '#4FB9C9',
  '#E97366'
];

function colorForRG(rg) {
  if (rgColorMap[rg]) return rgColorMap[rg];

  let hash = 0;
  for (const ch of (rg || '')) {
    hash = ((hash << 5) - hash) + ch.charCodeAt(0);
    hash |= 0;
  }
  return fallbackColors[Math.abs(hash) % fallbackColors.length];
}

const map = L.map('map', { zoomControl: true }).setView([51.2, 10.4], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap-Mitwirkende'
}).addTo(map);

const clusterGroup = L.markerClusterGroup({
  showCoverageOnHover: false,
  spiderfyOnMaxZoom: true,
  maxClusterRadius: 45
});
const filteredLayerGroup = L.featureGroup();
map.addLayer(clusterGroup);

let allRows = [];
let markerByName = new Map();

function loadData() {
  Papa.parse('data/standorte.csv', {
    download: true,
    header: true,
    delimiter: ';',
    skipEmptyLines: true,
    complete: (results) => {
      allRows = results.data
        .map(row => ({
          ...row,
          Latitude: Number.parseFloat(row.Latitude),
          Longitude: Number.parseFloat(row.Longitude),
          RG: (row.RG || '').trim(),
          Name: (row.Name || '').trim(),
          AdresseVoll: (row.AdresseVoll || '').trim()
        }))
        .filter(row => Number.isFinite(row.Latitude) && Number.isFinite(row.Longitude));

      populateRGFilter(allRows);
      applyFilters();
    },
    error: () => {
      document.getElementById('summary').textContent = 'CSV konnte nicht geladen werden.';
    }
  });
}

function populateRGFilter(rows) {
  const select = document.getElementById('rgFilter');
  const rgs = [...new Set(rows.map(row => row.RG).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
  for (const rg of rgs) {
    const option = document.createElement('option');
    option.value = rg;
    option.textContent = rg;
    select.appendChild(option);
  }
}

function getSelectedRG() {
  return document.getElementById('rgFilter').value.trim();
}

function getQuery() {
  return document.getElementById('searchInput').value.trim().toLowerCase();
}

function matchesQuery(row, query) {
  if (!query) return true;
  const haystack = [row.Name, row.RG, row.StrasseHausnummer, row.PLZ, row.Ort, row.AdresseVoll]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function splitRows(rows, selectedRG, query) {
  const searchMatches = rows.filter(row => matchesQuery(row, query));
  const visible = selectedRG
    ? searchMatches.filter(row => row.RG === selectedRG)
    : searchMatches;

  return {
    visible,
    selectedRG,
    isFiltered: Boolean(selectedRG)
  };
}

function setActiveLayer(isFiltered) {
  if (isFiltered) {
    if (map.hasLayer(clusterGroup)) {
      map.removeLayer(clusterGroup);
    }
    if (!map.hasLayer(filteredLayerGroup)) {
      map.addLayer(filteredLayerGroup);
    }
    return filteredLayerGroup;
  }

  if (map.hasLayer(filteredLayerGroup)) {
    map.removeLayer(filteredLayerGroup);
  }
  if (!map.hasLayer(clusterGroup)) {
    map.addLayer(clusterGroup);
  }
  return clusterGroup;
}

function markerStyle(row, isFiltered) {
  const color = colorForRG(row.RG);

  if (!isFiltered) {
    return {
      radius: 7,
      color,
      fillColor: color,
      fillOpacity: 0.84,
      weight: 1.5
    };
  }

  return {
    radius: 8,
    color,
    fillColor: color,
    fillOpacity: 0.9,
    weight: 2
  };
}

function popupHtml(row) {
  const destination = encodeURIComponent(row.AdresseVoll || `${row.StrasseHausnummer}, ${row.PLZ} ${row.Ort}`);
  const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
  return `
    <div class="popup-title">${escapeHtml(row.Name)}</div>
    <div class="popup-meta">RG ${escapeHtml(row.RG)}</div>
    <div>${escapeHtml(row.AdresseVoll)}</div>
    <a class="popup-link" href="${routeUrl}" target="_blank" rel="noopener noreferrer">Route öffnen</a>
  `;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderMarkers(split) {
  clusterGroup.clearLayers();
  filteredLayerGroup.clearLayers();
  markerByName = new Map();

  const activeLayer = setActiveLayer(split.isFiltered);

  for (const row of split.visible) {
    const marker = L.circleMarker([row.Latitude, row.Longitude], markerStyle(row, split.isFiltered));
    marker.bindPopup(popupHtml(row));
    activeLayer.addLayer(marker);
    markerByName.set(row.Name, marker);
  }
}

function renderList(split) {
  const list = document.getElementById('resultList');
  const summary = document.getElementById('summary');
  const emptyState = document.getElementById('emptyState');
  list.innerHTML = '';

  if (split.selectedRG) {
    summary.textContent = `${split.visible.length} Treffer in RG ${split.selectedRG}`;
  } else {
    summary.textContent = `${split.visible.length} Treffer`;
  }

  emptyState.hidden = split.visible.length !== 0;

  for (const row of split.visible) {
    const li = document.createElement('li');
    li.className = 'result-card';
    if (split.isFiltered) {
      li.classList.add('is-highlighted');
    }

    li.innerHTML = `
      <div class="result-title">${escapeHtml(row.Name)}</div>
      <div class="result-meta">RG ${escapeHtml(row.RG)} · ${escapeHtml(row.PLZ)} ${escapeHtml(row.Ort)}</div>
      <div class="result-address">${escapeHtml(row.AdresseVoll)}</div>
    `;

    li.addEventListener('click', () => {
      const marker = markerByName.get(row.Name);
      map.setView([row.Latitude, row.Longitude], 16, { animate: true });
      if (marker) {
        marker.openPopup();
      }
    });

    list.appendChild(li);
  }
}

function fitToRows(split) {
  if (split.visible.length === 0) {
    return;
  }
  if (split.visible.length === 1) {
    map.setView([split.visible[0].Latitude, split.visible[0].Longitude], 15);
    return;
  }
  const bounds = L.latLngBounds(split.visible.map(row => [row.Latitude, row.Longitude]));
  map.fitBounds(bounds, { padding: [28, 28] });
}

function applyFilters(refit = false) {
  const selectedRG = getSelectedRG();
  const query = getQuery();
  const split = splitRows(allRows, selectedRG, query);
  renderMarkers(split);
  renderList(split);
  if (refit) {
    fitToRows(split);
  }
}

document.getElementById('searchInput').addEventListener('input', () => applyFilters(false));
document.getElementById('rgFilter').addEventListener('change', () => applyFilters(true));
document.getElementById('resetBtn').addEventListener('click', () => {
  document.getElementById('searchInput').value = '';
  document.getElementById('rgFilter').value = '';
  applyFilters(true);
});
document.getElementById('fitBtn').addEventListener('click', () => applyFilters(true));

loadData();
