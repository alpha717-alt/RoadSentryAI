const app = document.querySelector('#app');
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
let currentPosition = null;
let activeFile = null;
let leafletMap = null;
let userMarker = null;
let watchId = null;
let routeMap = null;
let routeUserMarker = null;
let routeEndMarker = null;
let routeLayers = [];
const reports = [];
try {
  const storedReports = JSON.parse(localStorage.getItem('roadsentry-reports') || '[]');
  if (Array.isArray(storedReports)) reports.push(...storedReports.filter(report => Number.isFinite(report.latitude) && Number.isFinite(report.longitude)));
} catch {}

app.innerHTML = `
  <header class="navbar">
    <a class="brand" href="#overview" aria-label="RoadSentry home">RoadSentry <span>AI</span></a>
    <nav aria-label="Primary navigation"><a href="#report">Report a road issue</a><a href="#route-planner">Find a route</a><a href="#map-section">Live map</a></nav>
    <button class="nav-locate" id="nav-locate" type="button">◎ <span>Share my location</span></button>
  </header>
  <main>
    <section class="hero" id="overview">
      <div class="hero-content">
        <p class="eyebrow">COMMUNITY ROAD REPORTING</p>
        <h1>Spot it.<br><span>Report it.</span></h1>
        <p class="tagline">Help make every journey safer.</p>
        <p>Share a road photo and its location. Reports help communities and road teams see where repairs may be needed.</p>
        <a class="button button-light" href="#report">Create a report <span aria-hidden="true">↓</span></a>
      </div>
      <div class="hero-art" aria-hidden="true"><div class="sun"></div><div class="hill hill-back"></div><div class="hill hill-front"></div><div class="road"><i></i><i></i><i></i></div><div class="pin"><span>!</span></div></div>
    </section>

    <section class="section report-section" id="report">
      <div class="section-heading"><div><p class="eyebrow">QUICK ROAD REPORT</p><h2>What did you spot?</h2></div><span class="privacy-note">Your photo is analyzed in this browser and is not sent to an AI service.</span></div>
      <div class="report-grid">
        <div class="upload-card card">
          <div class="card-heading"><span class="step">01</span><div><h3>Add a photo</h3><p>Choose a clear image of the road issue.</p></div></div>
          <label class="upload-zone" id="upload-zone" for="image-input" tabindex="0">
            <input id="image-input" type="file" accept="image/*" hidden>
            <div class="upload-placeholder" id="upload-placeholder"><span class="upload-icon">＋</span><strong>Choose an image</strong><span>JPG, PNG, WEBP · up to 5 MB</span></div>
            <img id="image-preview" alt="Selected road image preview" hidden>
          </label>
          <p class="field-message" id="upload-message" role="status">Images are checked on your device before analysis.</p>
          <button class="button button-primary full-width" id="analyze-button" type="button" disabled>Analyze road image <span aria-hidden="true">↗</span></button>
          <p class="ai-note" id="ai-status" aria-live="polite">On-device pothole detector · model downloads when you analyze your first image.</p>
        </div>
        <div class="location-card card">
          <div class="card-heading"><span class="step">02</span><div><h3>Pin the location</h3><p>Add where you found the issue.</p></div></div>
          <div class="location-status" id="location-status" role="status"><span class="status-dot"></span><span>Location not shared</span></div>
          <button class="button button-outline full-width" id="locate-button" type="button"><span aria-hidden="true">◎</span> Use my live location</button>
          <div class="coordinates" id="coordinates"><span>Latitude <strong>—</strong></span><span>Longitude <strong>—</strong></span></div>
          <div class="mini-map" id="mini-map" aria-label="Map showing your current location"><div id="real-map"></div><div class="map-empty" id="map-empty"><span>◎</span><strong>Your location will appear here</strong><small>Allow location access when prompted</small></div></div>
          <div class="location-actions"><button id="stop-location" type="button" class="text-button" disabled>Stop sharing location</button><span id="accuracy-label">Location is only used for this report.</span></div>
        </div>
      </div>
      <div class="result-card card" id="result-card" hidden aria-live="polite"></div>
      <div class="submit-row"><div class="privacy-note"><span>🔒</span> Location sharing starts only when you choose it.</div><button class="button button-primary" id="submit-report" type="button" disabled>Save report <span aria-hidden="true">→</span></button></div>
      <p class="submit-message" id="submit-message" role="status"></p>
    </section>

    <section class="section route-section" id="route-planner">
      <div class="section-heading"><div><p class="eyebrow">POTHOLE-AWARE ROUTING</p><h2>Find a route</h2></div><span class="privacy-note">Compares alternate OpenStreetMap routes with hazards mapped nearby.</span></div>
      <div class="route-controls card">
        <div class="route-control-copy"><h3>Where are you going?</h3><p>Start from your shared live location. Enter a destination to compare routes.</p></div>
        <label class="route-destination-label" for="route-destination">Destination</label>
        <div class="route-form"><input id="route-destination" type="text" autocomplete="street-address" placeholder="Enter an address or place"><button class="button button-primary" id="find-route-button" type="button">Compare routes <span aria-hidden="true">→</span></button></div>
        <label class="route-consent"><input id="route-consent" type="checkbox"><span>When I compare routes, I agree to share my current coordinates and destination with OpenStreetMap search, OSRM routing, and OpenStreetMap hazard data services.</span></label>
        <p class="route-disclaimer">Live traffic isn’t included. Pothole records on OpenStreetMap may be incomplete; “0 known” does not mean the road has no potholes. Reports saved here are stored only in this browser, not shared with other users.</p>
      </div>
      <p class="route-status" id="route-status" role="status">Share your location, enter a destination, then choose Compare routes.</p>
      <div id="route-results" class="route-results" hidden></div>
      <div id="route-map" aria-label="Map showing alternative routes and mapped potholes"></div>
      <p class="route-attribution">Routing: OSRM · Map and hazard data: © OpenStreetMap contributors</p>
    </section>
    <section class="section map-section" id="map-section">
      <div class="section-heading"><div><p class="eyebrow">ROAD WATCH</p><h2>Live location map</h2></div><span class="live-badge"><i></i> Ready for reports</span></div>
      <p class="map-intro">Your position appears here only after you enable location sharing. Reports you create on this device are shown as pins.</p>
      <div id="map" aria-label="Interactive map showing your location and local reports"></div>
      <div class="map-legend"><span><i class="legend-you"></i> Your location</span><span><i class="legend-report"></i> Your reports</span></div>
    </section>
    <section class="section how-section" id="workflow"><p class="eyebrow">THREE SIMPLE STEPS</p><h2>Better roads start with a report.</h2><div class="steps"><article><span>01</span><h3>Take a photo</h3><p>Capture the pothole, crack, or other road damage.</p></article><article><span>02</span><h3>Pin the spot</h3><p>Use your current location to place the issue on the map.</p></article><article><span>03</span><h3>Share the report</h3><p>Save the report on this device for review and follow-up.</p></article></div></section>
  </main>
  <footer class="footer"><a class="brand" href="#overview">RoadSentry <span>AI</span></a><span>Safer streets, one report at a time.</span><a href="#overview">Back to top ↑</a></footer>
`;

function setStatus(message, type = '') {
  const status = document.querySelector('#location-status');
  status.className = `location-status ${type}`;
  status.querySelector('span:last-child').textContent = message;
}
function updateLocation(position) {
  currentPosition = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy };
  document.querySelector('#coordinates').innerHTML = `<span>Latitude <strong>${currentPosition.latitude.toFixed(6)}</strong></span><span>Longitude <strong>${currentPosition.longitude.toFixed(6)}</strong></span>`;
  document.querySelector('#accuracy-label').textContent = `Approx. ${Math.round(currentPosition.accuracy)} m accuracy`;
  setStatus('Live location is on', 'is-live');
  document.querySelector('#stop-location').disabled = false;
  document.querySelector('#map-empty').hidden = true;
  document.querySelector('#submit-report').disabled = !activeFile;
  if (window.L) {
    if (!leafletMap) initMap();
    if (routeMap) {
      const routePoint = [currentPosition.latitude, currentPosition.longitude];
      if (!routeUserMarker) routeUserMarker = L.marker(routePoint).addTo(routeMap).bindPopup('Your current location');
      else routeUserMarker.setLatLng(routePoint);
      if (!routeLayers.length) routeMap.setView(routePoint, 13);
    }
    const point = [currentPosition.latitude, currentPosition.longitude];
    if (!userMarker) userMarker = L.marker(point).addTo(leafletMap).bindPopup('Your current location');
    else userMarker.setLatLng(point);
    leafletMap.setView(point, 15);
  }
}
function startLocation() {
  if (!navigator.geolocation) { setStatus('Location is not supported by this browser', 'is-error'); return; }
  if (!window.isSecureContext) { setStatus('Location needs a secure HTTPS page', 'is-error'); return; }
  setStatus('Finding your location…', 'is-waiting');
  navigator.geolocation.getCurrentPosition(position => {
    updateLocation(position);
    if (watchId === null) watchId = navigator.geolocation.watchPosition(updateLocation, locationError, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  }, locationError, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
}
function locationError(error) {
  const messages = { 1: 'Location access was denied. You can allow it in browser settings.', 2: 'Your location is unavailable right now. Try again.', 3: 'Location request timed out. Try again.' };
  setStatus(messages[error.code] || 'Could not get your location. Try again.', 'is-error');
}
function stopLocation() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  currentPosition = null;
  document.querySelector('#coordinates').innerHTML = '<span>Latitude <strong>—</strong></span><span>Longitude <strong>—</strong></span>';
  document.querySelector('#accuracy-label').textContent = 'Location is only used for this report.';
  document.querySelector('#stop-location').disabled = true;
  document.querySelector('#map-empty').hidden = false;
  setStatus('Location sharing stopped', '');
  if (userMarker && leafletMap) { leafletMap.removeLayer(userMarker); userMarker = null; }
  if (routeUserMarker && routeMap) { routeMap.removeLayer(routeUserMarker); routeUserMarker = null; }
  document.querySelector('#submit-report').disabled = true;
}
function initMap() {
  const mapElement = document.querySelector('#map');
  if (!window.L || !mapElement || leafletMap) return;
  leafletMap = L.map('real-map', { scrollWheelZoom: false }).setView([20, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(leafletMap);
  if (currentPosition) updateLocation({ coords: currentPosition });
  reports.forEach(addReportMarker);
  setTimeout(() => leafletMap.invalidateSize(), 100);
}
async function setImage(file) {
  const message = document.querySelector('#upload-message');
  const preview = document.querySelector('#image-preview');
  const placeholder = document.querySelector('#upload-placeholder');
  const analyzeButton = document.querySelector('#analyze-button');
  const submitButton = document.querySelector('#submit-report');
  const resultCard = document.querySelector('#result-card');
  const supportedImageExtensions = new Set(['.jpg', '.jpeg', '.jpe', '.jfif', '.png', '.apng', '.webp', '.gif', '.bmp', '.dib', '.avif', '.heic', '.heif', '.tif', '.tiff', '.svg']);
  const resetSelection = () => {
    if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
    delete preview.dataset.objectUrl;
    preview.removeAttribute('src');
    preview.hidden = true;
    placeholder.hidden = false;
    activeFile = null;
    analyzeButton.disabled = true;
    submitButton.disabled = true;
    resultCard.hidden = true;
  };
  if (!file) return;
  if (file.size >= MAX_IMAGE_BYTES) {
    resetSelection();
    message.textContent = 'That image is 5 MB or larger. Choose an image under 5 MB.';
    message.className = 'field-message error';
    return;
  }
  const extension = file.name.includes('.') ? `.${file.name.split('.').pop().toLowerCase()}` : '';
  const isImage = file.type.toLowerCase().startsWith('image/') || supportedImageExtensions.has(extension);
  if (!isImage || file.type.toLowerCase() === 'application/pdf' || extension === '.pdf' || extension === '.json') {
    resetSelection();
    message.textContent = 'Choose an image such as JPG, PNG, WEBP, GIF, HEIC, or AVIF. PDF and JSON files are not supported.';
    message.className = 'field-message error';
    return;
  }
  if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
  const objectUrl = URL.createObjectURL(file);
  preview.dataset.objectUrl = objectUrl;
  preview.onload = () => {
    activeFile = file;
    preview.hidden = false;
    placeholder.hidden = true;
    message.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    message.className = 'field-message';
    analyzeButton.disabled = false;
    submitButton.disabled = !currentPosition;
    resultCard.hidden = true;
  };
  preview.onerror = () => {
    resetSelection();
    message.textContent = 'This image format could not be opened by your browser. Try saving it as JPG, PNG, or WEBP.';
    message.className = 'field-message error';
  };
  preview.src = objectUrl;
}
let detectorSessionPromise = null;
const DETECTOR_MODEL_URL = 'https://huggingface.co/peterhdd/pothole-detection-yolov8/resolve/main/best.onnx';
const MODEL_INPUT_SIZE = 640;

async function loadDetector() {
  if (!window.ort) throw new Error('The on-device AI runtime could not load. Check your internet connection and reload.');
  if (!detectorSessionPromise) {
    detectorSessionPromise = window.ort.InferenceSession.create(DETECTOR_MODEL_URL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    }).catch(error => {
      detectorSessionPromise = null;
      throw error;
    });
  }
  return detectorSessionPromise;
}

function makeDetectorInput(image) {
  const size = MODEL_INPUT_SIZE;
  const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);
  const left = Math.floor((size - width) / 2);
  const top = Math.floor((size - height) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = 'rgb(114,114,114)';
  context.fillRect(0, 0, size, size);
  context.drawImage(image, left, top, width, height);
  const pixels = context.getImageData(0, 0, size, size).data;
  const data = new Float32Array(3 * size * size);
  for (let i = 0; i < size * size; i++) {
    data[i] = pixels[i * 4] / 255;
    data[size * size + i] = pixels[i * 4 + 1] / 255;
    data[2 * size * size + i] = pixels[i * 4 + 2] / 255;
  }
  return { tensor: new window.ort.Tensor('float32', data, [1, 3, size, size]), scale, left, top, imageWidth: image.naturalWidth, imageHeight: image.naturalHeight };
}

function decodePotholeOutput(output, transform) {
  const dims = output.dims;
  const values = output.data;
  let channels, candidates, transposed;
  if (dims.length !== 3) throw new Error('The downloaded model returned an unsupported result.');
  if (dims[1] <= dims[2]) { channels = dims[1]; candidates = dims[2]; transposed = true; }
  else { candidates = dims[1]; channels = dims[2]; transposed = false; }
  if (channels < 5) throw new Error('The pothole model result is incomplete.');
  const get = (candidate, channel) => transposed ? values[channel * candidates + candidate] : values[candidate * channels + channel];
  const detections = [];
  const threshold = 0.25;
  for (let i = 0; i < candidates; i++) {
    const confidence = get(i, 4);
    if (!Number.isFinite(confidence) || confidence < threshold) continue;
    const cx = get(i, 0), cy = get(i, 1), boxWidth = get(i, 2), boxHeight = get(i, 3);
    const x1 = Math.max(0, (cx - boxWidth / 2 - transform.left) / transform.scale);
    const y1 = Math.max(0, (cy - boxHeight / 2 - transform.top) / transform.scale);
    const x2 = Math.min(transform.imageWidth, (cx + boxWidth / 2 - transform.left) / transform.scale);
    const y2 = Math.min(transform.imageHeight, (cy + boxHeight / 2 - transform.top) / transform.scale);
    if (x2 > x1 && y2 > y1) detections.push({ confidence, x1, y1, x2, y2 });
  }
  detections.sort((a, b) => b.confidence - a.confidence);
  const kept = [];
  for (const candidate of detections) {
    const area = (candidate.x2 - candidate.x1) * (candidate.y2 - candidate.y1);
    const overlaps = kept.some(other => {
      const iw = Math.max(0, Math.min(candidate.x2, other.x2) - Math.max(candidate.x1, other.x1));
      const ih = Math.max(0, Math.min(candidate.y2, other.y2) - Math.max(candidate.y1, other.y1));
      const intersection = iw * ih;
      const otherArea = (other.x2 - other.x1) * (other.y2 - other.y1);
      return intersection / (area + otherArea - intersection) > 0.45;
    });
    if (!overlaps) kept.push(candidate);
    if (kept.length === 20) break;
  }
  return kept;
}

async function analyzeImage() {
  if (!activeFile) return;
  const status = document.querySelector('#ai-status');
  const button = document.querySelector('#analyze-button');
  const preview = document.querySelector('#image-preview');
  button.disabled = true;
  button.textContent = 'Loading on-device model…';
  status.textContent = 'Downloading the pothole detector to this browser (about 45 MB on first use). Your photo stays on this device.';
  try {
    const session = await loadDetector();
    status.textContent = 'Checking the image on this device…';
    const input = makeDetectorInput(preview);
    const results = await session.run({ [session.inputNames[0]]: input.tensor });
    const output = results[session.outputNames[0]];
    const detections = decodePotholeOutput(output, input);
    const card = document.querySelector('#result-card');
    if (detections.length) {
      const best = detections[0];
      const areaPercent = ((best.x2 - best.x1) * (best.y2 - best.y1) / (input.imageWidth * input.imageHeight) * 100).toFixed(1);
      card.innerHTML = `<div><span class="step">ON-DEVICE AI RESULT</span><h3>${detections.length} possible pothole${detections.length === 1 ? '' : 's'} detected</h3><p>The largest detection covers about ${areaPercent}% of the image. Check the photo and outlined area yourself; this estimate is not the pothole’s real-world size.</p></div><span class="confidence">${Math.round(best.confidence * 100)}% model confidence</span>`;
      status.textContent = 'Analysis ran in this browser. Results can be wrong; please review the photo.';
    } else {
      card.innerHTML = '<div><span class="step">ON-DEVICE AI RESULT</span><h3>No pothole detected</h3><p>The model did not find a pothole with enough confidence. This does not prove the road is clear; try a closer, well-lit photo.</p></div><span class="confidence">No confident detection</span>';
      status.textContent = 'Analysis ran in this browser. Results can be wrong; please review the photo.';
    }
    card.hidden = false;
  } catch (error) {
    status.textContent = error.message || 'On-device analysis failed. Check your connection and try again.';
  } finally {
    button.disabled = !activeFile;
    button.innerHTML = 'Analyze road image <span aria-hidden="true">↗</span>';
  }
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function addReportMarker(report) {
  if (!window.L || !leafletMap) return;
  L.circleMarker([report.latitude, report.longitude], { radius: 9, color: '#c74837', fillColor: '#f27660', fillOpacity: .9, weight: 3 }).addTo(leafletMap).bindPopup(`<strong>${escapeHtml(report.name)}</strong><br>Saved on this device`);
}
function saveReport() {
  if (!activeFile || !currentPosition) return;
  reports.push({ latitude: currentPosition.latitude, longitude: currentPosition.longitude, name: activeFile.name });
  try { localStorage.setItem('roadsentry-reports', JSON.stringify(reports)); } catch { }
  addReportMarker(reports[reports.length - 1]);
  document.querySelector('#submit-message').textContent = `Report saved on this device at ${currentPosition.latitude.toFixed(5)}, ${currentPosition.longitude.toFixed(5)}. No server is connected to share it with a road authority.`;
  document.querySelector('#submit-report').textContent = 'Report saved ✓';
  document.querySelector('#submit-report').disabled = true;
}

function initRouteMap() {
  const element = document.querySelector('#route-map');
  if (!window.L || !element || routeMap) return;
  routeMap = L.map(element, { scrollWheelZoom: false }).setView(currentPosition ? [currentPosition.latitude, currentPosition.longitude] : [20, 0], currentPosition ? 13 : 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(routeMap);
  if (currentPosition) {
    routeUserMarker = L.marker([currentPosition.latitude, currentPosition.longitude]).addTo(routeMap).bindPopup('Your current location');
  }
  setTimeout(() => routeMap.invalidateSize(), 100);
}
function routePointSegmentDistance(point, start, end) {
  const latitude = point[1] * Math.PI / 180;
  const scaleX = 111320 * Math.cos(latitude);
  const scaleY = 110540;
  const px = point[0] * scaleX, py = point[1] * scaleY;
  const ax = start[0] * scaleX, ay = start[1] * scaleY;
  const bx = end[0] * scaleX, by = end[1] * scaleY;
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function routeIncludesHazard(route, hazard) {
  const coords = route.geometry.coordinates;
  for (let i = 1; i < coords.length; i++) {
    if (routePointSegmentDistance([hazard.lon, hazard.lat], coords[i - 1], coords[i]) <= 25) return true;
  }
  return false;
}
async function findMappedHazards(routes) {
  const all = routes.flatMap(route => route.geometry.coordinates);
  const lons = all.map(point => point[0]), lats = all.map(point => point[1]);
  const south = Math.min(...lats), north = Math.max(...lats), west = Math.min(...lons), east = Math.max(...lons);
  if (north - south > 0.55 || east - west > 0.55) return null;
  const bbox = `${south},${west},${north},${east}`;
  const query = `[out:json][timeout:20];(node["hazard"="hole"](${bbox});way["hazard"="hole"](${bbox});node["hazard"="pothole"](${bbox});way["hazard"="pothole"](${bbox});node["man_made"="pothole"](${bbox});way["man_made"="pothole"](${bbox}););out center;`;
  const response = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: `data=${encodeURIComponent(query)}` });
  if (!response.ok) throw new Error('OpenStreetMap hazard lookup is temporarily unavailable.');
  const data = await response.json();
  return (data.elements || []).map(item => ({ lat: item.lat ?? item.center?.lat, lon: item.lon ?? item.center?.lon })).filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lon));
}
async function geocodeDestination(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Destination search is temporarily unavailable. Try again later.');
  const results = await response.json();
  if (!results.length) throw new Error('I couldn’t find that destination. Try adding the city or area name.');
  return { latitude: Number(results[0].lat), longitude: Number(results[0].lon), name: results[0].display_name };
}
async function fetchAlternativeRoutes(origin, destination) {
  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?alternatives=3&overview=full&geometries=geojson&steps=false`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('The route service is busy. Please try again shortly.');
  const result = await response.json();
  if (result.code !== 'Ok' || !result.routes?.length) throw new Error('No driving route was found between these places.');
  return result.routes;
}
function drawRouteAlternatives(routes, destination, hazards) {
  if (!routeMap) initRouteMap();
  routeLayers.forEach(layer => routeMap.removeLayer(layer));
  routeLayers = [];
  if (routeEndMarker) routeMap.removeLayer(routeEndMarker);
  routeEndMarker = L.marker([destination.latitude, destination.longitude]).addTo(routeMap).bindPopup('Destination');
  const ranked = routes.map((route, index) => {
    const osmCount = hazards ? hazards.filter(hazard => routeIncludesHazard(route, hazard)).length : null;
    const localCount = reports.filter(report => routeIncludesHazard(route, { lat: report.latitude, lon: report.longitude })).length;
    return { route, index, osmCount, localCount, total: osmCount === null ? null : osmCount + localCount };
  });
  ranked.sort((a, b) => a.total === null || b.total === null ? a.route.duration - b.route.duration : a.total - b.total || a.route.duration - b.route.duration);
  const recommendedIndex = ranked[0].index;
  routes.forEach((route, index) => {
    const layer = L.geoJSON(route.geometry, { style: { color: index === recommendedIndex ? '#1b7058' : '#82928c', weight: index === recommendedIndex ? 7 : 5, opacity: index === recommendedIndex ? .95 : .65, dashArray: index === recommendedIndex ? null : '8 7' } }).addTo(routeMap);
    layer.bindPopup(index === recommendedIndex ? 'Fewest mapped potholes (among routes shown)' : 'Alternative route');
    routeLayers.push(layer);
  });
  const bounds = L.featureGroup([...routeLayers, routeEndMarker, ...(routeUserMarker ? [routeUserMarker] : [])]).getBounds();
  if (bounds.isValid()) routeMap.fitBounds(bounds.pad(.12));
  const results = document.querySelector('#route-results');
  results.innerHTML = ranked.map((item, rank) => {
    const trafficText = 'Traffic: not available';
    const potholeText = item.total === null ? 'Mapped pothole data unavailable' : `${item.total} known nearby pothole${item.total === 1 ? '' : 's'}${item.localCount ? ` (${item.localCount} saved here)` : ''}`;
    return `<article class="route-option ${rank === 0 ? 'is-recommended' : ''}"><div><span class="route-tag">${rank === 0 ? 'LOWEST MAPPED POTHOLE COUNT' : `ALTERNATIVE ${rank}`}</span><h3>Route ${rank + 1}</h3><p>${potholeText}</p></div><div class="route-metrics"><strong>${(item.route.duration / 60).toFixed(0)} min</strong><span>${(item.route.distance / 1000).toFixed(1)} km</span><small>${trafficText}</small></div></article>`;
  }).join('');
  results.hidden = false;
  setTimeout(() => routeMap.invalidateSize(), 100);
  return ranked[0];
}
async function compareRoutes() {
  const status = document.querySelector('#route-status');
  const button = document.querySelector('#find-route-button');
  const destinationText = document.querySelector('#route-destination').value.trim();
  if (!currentPosition) { status.textContent = 'First tap “Use my live location” and allow location access.'; return; }
  if (!destinationText) { status.textContent = 'Enter a destination first.'; return; }
  if (!document.querySelector('#route-consent').checked) { status.textContent = 'Please check the box to allow your start and destination to be sent to OpenStreetMap services for routing.'; return; }
  button.disabled = true;
  document.querySelector('#route-results').hidden = true;
  status.textContent = 'Finding your destination and comparing routes… Your location and destination are being sent to OpenStreetMap services.';
  try {
    const destination = await geocodeDestination(destinationText);
    const routes = await fetchAlternativeRoutes(currentPosition, destination);
    status.textContent = 'Checking OpenStreetMap for mapped pothole hazards near the route…';
    let hazards;
    try { hazards = await findMappedHazards(routes); }
    catch (error) { hazards = null; }
    const recommendation = drawRouteAlternatives(routes, destination, hazards);
    status.textContent = hazards === null ? 'Routes are ready, but mapped pothole information was unavailable. The fastest route is shown first.' : `Compared ${routes.length} route option${routes.length === 1 ? '' : 's'} to ${destination.name}. The recommendation uses mapped hazards only, not live traffic.`;
  } catch (error) {
    status.textContent = error.message || 'Could not compare routes. Check your connection and try again.';
  } finally { button.disabled = false; }
}
document.querySelector('#image-input').addEventListener('change', event => {
  setImage(event.target.files?.[0]);
  event.target.value = '';
});
document.querySelector('#upload-zone').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); document.querySelector('#image-input').click(); } });
document.querySelector('#locate-button').addEventListener('click', startLocation);
document.querySelector('#nav-locate').addEventListener('click', startLocation);
document.querySelector('#stop-location').addEventListener('click', stopLocation);
document.querySelector('#analyze-button').addEventListener('click', analyzeImage);
document.querySelector('#find-route-button').addEventListener('click', compareRoutes);
document.querySelector('#submit-report').addEventListener('click', saveReport);
window.addEventListener('load', () => { initMap(); initRouteMap(); });
window.addEventListener('hashchange', () => { if (location.hash === '#map-section' && leafletMap) setTimeout(() => leafletMap.invalidateSize(), 100); if (location.hash === '#route-planner' && routeMap) setTimeout(() => routeMap.invalidateSize(), 100); });

