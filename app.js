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
  if (!selectedRG) {
    return { highlighted: searchMatches, muted: [] };
  }
  return {
    highlighted: searchMatches.filter(row => row.RG === selectedRG),
    muted: searchMatches.filter(row => row.RG !== selectedRG)
  };
}

function markerStyle(isHighlighted, hasSelectedRG) {
  if (!hasSelectedRG) {
    return {
      radius: 7,
      color: '#2783de',
      fillColor: '#2783de',
      fillOpacity: 0.84,
      weight: 1.5
    };
  }

  if (isHighlighted) {
    return {
      radius: 8,
      color: '#2783de',
      fillColor: '#2783de',
      fillOpacity: 0.88,
      weight: 2
    };
  }

  return {
    radius: 6,
    color: '#b6b1aa',
    fillColor: '#b6b1aa',
    fillOpacity: 0.42,
    weight: 1
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
  markerByName = new Map();

  const selectedRG = getSelectedRG();
  const hasSelectedRG = Boolean(selectedRG);
  const combined = [...split.muted, ...split.highlighted];

  for (const row of combined) {
    const isHighlighted = !hasSelectedRG || row.RG === selectedRG;
    const marker = L.circleMarker([row.Latitude, row.Longitude], markerStyle(isHighlighted, hasSelectedRG));
    marker.bindPopup(popupHtml(row));
    clusterGroup.addLayer(marker);
    markerByName.set(row.Name, marker);
  }
}

function renderList(split) {
  const list = document.getElementById('resultList');
  const summary = document.getElementById('summary');
  const emptyState = document.getElementById('emptyState');
  list.innerHTML = '';

  const selectedRG = getSelectedRG();
  const combined = [...split.highlighted, ...split.muted];
  const highlightedCount = split.highlighted.length;

  if (selectedRG) {
    summary.textContent = `${combined.length} Treffer, davon ${highlightedCount} in RG ${selectedRG}`;
  } else {
    summary.textContent = `${combined.length} Treffer`;
  }

  emptyState.hidden = combined.length !== 0;

  for (const row of combined) {
    const li = document.createElement('li');
    li.className = 'result-card';
    if (selectedRG && row.RG === selectedRG) {
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
  const combined = [...split.highlighted, ...split.muted];
  if (combined.length === 0) {
    return;
  }
  if (combined.length === 1) {
    map.setView([combined[0].Latitude, combined[0].Longitude], 15);
    return;
  }
  const bounds = L.latLngBounds(combined.map(row => [row.Latitude, row.Longitude]));
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
