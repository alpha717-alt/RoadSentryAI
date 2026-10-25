const app = document.querySelector('#app');
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
let currentPosition = null;
let emergencyContact = localStorage.getItem('roadsentry-emergency-contact') || '';
let activeFile = null;
let leafletMap = null;
let overviewMap = null;
let userMarker = null;
let overviewUserMarker = null;
let hasCenteredOnLocation = false;
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

    <section class="section emergency-section" id="emergency-contact">
      <div class="section-heading">
        <div><p class="eyebrow">EMERGENCY CONTACT</p><h2>Need help after a crash?</h2></div>
        <span class="privacy-note">Your contact number is saved only in this browser.</span>
      </div>
      <div class="emergency-card card">
        <p class="emergency-explainer">This website does not detect crashes from the hardware. If you need help, save a trusted contact and prepare a text with your fresh location.</p>
        <div class="emergency-form">
          <label class="emergency-field" for="emergency-phone">Trusted contact phone number
            <input id="emergency-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+1 555 123 4567">
          </label>
          <button class="button button-outline" id="save-emergency-contact" type="button">Save contact</button>
          <button class="button button-primary" id="prepare-emergency-text" type="button">Get location and prepare text</button>
          <a class="button button-primary" id="open-emergency-sms" href="#" hidden>Open SMS draft</a>
        </div>
        <p class="emergency-status" id="emergency-status" role="status" aria-live="polite">No message is sent automatically. Review the draft in your messaging app and press Send.</p>
      </div>
    </section>

    <section class="section route-section" id="route-planner">
      <div class="section-heading"><div><p class="eyebrow">POTHOLE-AWARE ROUTING</p><h2>Find a route</h2></div><span class="privacy-note">Compares alternate OpenStreetMap routes with hazards mapped nearby.</span></div>
      <div class="route-controls card">
        <div class="route-control-copy"><h3>Where are you going?</h3><p>We’ll request a fresh, high-accuracy GPS fix for every comparison. Check the live start pin before choosing a route.</p></div>
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

function normalizeEmergencyPhone(value) { return String(value || '').replace(/[\s().-]/g, ''); }
function saveEmergencyContact() {
  const phone = normalizeEmergencyPhone(document.querySelector('#emergency-phone').value);
  const status = document.querySelector('#emergency-status');
  if (!/^\+?[0-9]{7,15}$/.test(phone)) { status.textContent = 'Enter a valid phone number with country code, such as +1 555 123 4567.'; return; }
  emergencyContact = phone;
  localStorage.setItem('roadsentry-emergency-contact', phone);
  document.querySelector('#open-emergency-sms').hidden = true;
  status.textContent = 'Contact saved on this device. No message has been sent.';
}
function prepareEmergencyText() {
  const status = document.querySelector('#emergency-status'), draft = document.querySelector('#open-emergency-sms');
  draft.hidden = true;
  if (!emergencyContact) { status.textContent = 'Save a trusted contact first.'; return; }
  if (!navigator.geolocation || !window.isSecureContext) { status.textContent = 'A secure page and browser location support are needed to get your current location.'; return; }
  status.textContent = 'Requesting a fresh location. Allow the browser prompt to continue.';
  navigator.geolocation.getCurrentPosition(position => {
    const { latitude, longitude, accuracy } = position.coords;
    if (![latitude, longitude].every(Number.isFinite) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) { status.textContent = 'The browser returned an invalid location. Try again.'; return; }
    const mapUrl = 'https://maps.google.com/?q=' + encodeURIComponent(latitude + ',' + longitude);
    const accuracyText = Number.isFinite(accuracy) ? ' (location accuracy about ±' + Math.round(accuracy) + ' m)' : '';
    const message = 'I have faced a crash. Help needed. My current location: ' + mapUrl + accuracyText;
    draft.href = 'sms:' + emergencyContact + '?body=' + encodeURIComponent(message);
    draft.hidden = false;
    status.textContent = 'Text draft is ready. Open it, check the contact and location, then press Send.';
  }, error => {
    status.textContent = error.code === 1 ? 'Location permission was denied. Allow location access and try again.' : 'Could not get your current location. Move to a place with GPS or network signal and try again.';
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
}

const detectionOverlay = document.createElement('canvas');
detectionOverlay.id = 'detection-overlay';
detectionOverlay.setAttribute('aria-hidden', 'true');
Object.assign(detectionOverlay.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', zIndex: '2' });
detectionOverlay.hidden = true;
document.querySelector('#upload-zone').append(detectionOverlay);

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
    if (overviewMap) {
      if (!overviewUserMarker) overviewUserMarker = L.marker(point).addTo(overviewMap).bindPopup('Your current location');
      else overviewUserMarker.setLatLng(point);
    }
    if (!hasCenteredOnLocation) {
      leafletMap.setView(point, 15);
      if (overviewMap) overviewMap.setView(point, 15);
      hasCenteredOnLocation = true;
    }
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
  if (overviewUserMarker && overviewMap) { overviewMap.removeLayer(overviewUserMarker); overviewUserMarker = null; }
  hasCenteredOnLocation = false;
  if (routeUserMarker && routeMap) { routeMap.removeLayer(routeUserMarker); routeUserMarker = null; }
  document.querySelector('#submit-report').disabled = true;
}
function initMap() {
  const mapElement = document.querySelector('#map');
  if (!window.L || !mapElement || leafletMap || overviewMap) return;
  leafletMap = L.map('real-map', { scrollWheelZoom: false }).setView([20, 0], 2);
  overviewMap = L.map('map', { scrollWheelZoom: false }).setView([20, 0], 2);
  const tileLayer = () => L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' });
  tileLayer().addTo(leafletMap);
  tileLayer().addTo(overviewMap);
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
    detectionOverlay.hidden = true;
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
  activeFile = null;
  analyzeButton.disabled = true;
  submitButton.disabled = true;
  resultCard.hidden = true;
  detectionOverlay.hidden = true;
  detectionOverlay.getContext('2d')?.clearRect(0, 0, detectionOverlay.width, detectionOverlay.height);
  document.querySelector('#submit-message').textContent = '';
  submitButton.textContent = 'Save report →';
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
    detectionOverlay.width = input.imageWidth;
    detectionOverlay.height = input.imageHeight;
    const overlayContext = detectionOverlay.getContext('2d');
    overlayContext.strokeStyle = '#e54838';
    overlayContext.lineWidth = Math.max(3, Math.round(Math.min(input.imageWidth, input.imageHeight) * .006));
    overlayContext.shadowColor = '#ffffff';
    overlayContext.shadowBlur = Math.max(2, Math.round(Math.min(input.imageWidth, input.imageHeight) * .004));
    detections.forEach(detection => overlayContext.strokeRect(detection.x1, detection.y1, detection.x2 - detection.x1, detection.y2 - detection.y1));
    detectionOverlay.hidden = detections.length === 0;
    const card = document.querySelector('#result-card');
    if (detections.length) {
      const best = detections[0];
      const areaPercent = ((best.x2 - best.x1) * (best.y2 - best.y1) / (input.imageWidth * input.imageHeight) * 100).toFixed(1);
      card.innerHTML = `<div><span class="ai-result-label">ON-DEVICE AI RESULT</span><h3>${detections.length} possible pothole${detections.length === 1 ? '' : 's'} detected</h3><p>The largest detection covers about ${areaPercent}% of the image. Check the photo and outlined area yourself; this estimate is not the pothole’s real-world size.</p></div><span class="confidence">${Math.round(best.confidence * 100)}% model confidence</span>`;
      status.textContent = 'Analysis ran in this browser. Results can be wrong; please review the photo.';
    } else {
      card.innerHTML = '<div><span class="ai-result-label">ON-DEVICE AI RESULT</span><h3>No pothole detected</h3><p>The model did not find a pothole with enough confidence. This does not prove the road is clear; try a closer, well-lit photo.</p></div><span class="confidence">No confident detection</span>';
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
  const popup = `<strong>${escapeHtml(report.name)}</strong><br>Saved on this device`;
  const options = { radius: 9, color: '#c74837', fillColor: '#f27660', fillOpacity: .9, weight: 3 };
  L.circleMarker([report.latitude, report.longitude], options).addTo(leafletMap).bindPopup(popup);
  if (overviewMap) L.circleMarker([report.latitude, report.longitude], options).addTo(overviewMap).bindPopup(popup);
}
function saveReport() {
  if (!activeFile || !currentPosition) return;
  reports.push({ createdAt: new Date().toISOString(), latitude: currentPosition.latitude, longitude: currentPosition.longitude, name: activeFile.name });
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
function drawRouteAlternatives(routes, destination, hazards, origin) {
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
  const fastest = [...ranked].sort((a, b) => a.route.duration - b.route.duration)[0];
  let recommended = fastest;
  const detourLimitSeconds = Math.min(5 * 60, fastest.route.duration * 0.15);
  if (hazards !== null && fastest.total !== null) {
    const saferOptions = ranked
      .filter(item => item.total < fastest.total && item.route.duration <= fastest.route.duration + detourLimitSeconds)
      .sort((a, b) => a.total - b.total || a.route.duration - b.route.duration);
    if (saferOptions.length) recommended = saferOptions[0];
  }
  const rankedForDisplay = [recommended, ...ranked.filter(item => item !== recommended).sort((a, b) => a.route.duration - b.route.duration)];
  const recommendedIndex = recommended.index;
  routes.forEach((route, index) => {
    const layer = L.geoJSON(route.geometry, { style: { color: index === recommendedIndex ? '#1b7058' : '#82928c', weight: index === recommendedIndex ? 7 : 5, opacity: index === recommendedIndex ? .95 : .65, dashArray: index === recommendedIndex ? null : '8 7' } }).addTo(routeMap);
    layer.bindPopup(index === recommendedIndex ? (recommended === fastest ? 'Fastest route selected' : 'Lower-hazard route within detour limit') : 'Alternative route');
    routeLayers.push(layer);
  });
  const bounds = L.featureGroup([...routeLayers, routeEndMarker, ...(routeUserMarker ? [routeUserMarker] : [])]).getBounds();
  if (bounds.isValid()) routeMap.fitBounds(bounds.pad(.12));
  const results = document.querySelector('#route-results');
  results.innerHTML = rankedForDisplay.map((item, rank) => {
    const trafficText = 'Traffic: not available';
    const potholeText = item.total === null ? 'Mapped pothole data unavailable' : `${item.total} known nearby pothole${item.total === 1 ? '' : 's'}${item.localCount ? ` (${item.localCount} saved here)` : ''}`;
    const extraMinutes = Math.max(0, Math.ceil((item.route.duration - fastest.route.duration) / 60));
    const routeLabel = rank === 0
      ? item === fastest ? (item.total === null ? 'FASTEST ROUTE AVAILABLE' : 'FASTEST ROUTE') : `FEWER MAPPED HAZARDS · +${extraMinutes} MIN`
      : item === fastest ? 'FASTEST ROUTE' : `ALTERNATIVE ${rank}`;
    return `<article class="route-option ${rank === 0 ? 'is-recommended' : ''}"><div><span class="route-tag">${routeLabel}</span><h3>Route ${rank + 1}</h3><p>${potholeText}</p></div><div class="route-metrics"><strong>${(item.route.duration / 60).toFixed(0)} min</strong><span>${(item.route.distance / 1000).toFixed(1)} km</span><small>${trafficText}</small></div></article>`;
  }).join('');
  const routeMapUrl='https://www.google.com/maps/dir/?api=1&origin='+origin.latitude+','+origin.longitude+'&destination='+destination.latitude+','+destination.longitude+'&travelmode=driving';const routeSummary=document.createElement('article');routeSummary.className='route-option route-location-summary';routeSummary.innerHTML='<div><span class="route-tag">ROUTE DETAILS</span><p><strong>Start:</strong> Live location ('+origin.latitude.toFixed(5)+', '+origin.longitude.toFixed(5)+')</p><p><strong>Destination:</strong> '+escapeHtml(destination.name)+'</p>'+(routes[0].distance>500000?'<p class="route-warning">Very long trip — check your GPS location and destination.</p>':'')+'</div><div class="route-metrics"><a class="button button-outline" href="'+routeMapUrl+'" target="_blank" rel="noopener">Open in Google Maps</a><small>Google Maps receives these locations when opened.</small></div>';results.append(routeSummary);results.hidden=false;
  setTimeout(() => routeMap.invalidateSize(), 100);
  return recommended;
}
function getFreshRoutePosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(position => {
      const { latitude, longitude, accuracy } = position.coords;
      if (![latitude, longitude, accuracy].every(Number.isFinite)) { reject(new Error('Your browser returned an invalid GPS location. Try again.')); return; }
      if (accuracy > 5000) { reject(new Error(`GPS accuracy is about ${Math.round(accuracy)} m. Move to an open area and try again for a reliable route.`)); return; }
      updateLocation(position);
      resolve({ latitude, longitude, accuracy });
    }, error => {
      const message = error.code === 1 ? 'Location access was denied. Allow it, then try again.' : 'Could not refresh your location. Check GPS and try again.';
      reject(new Error(message));
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  });
}
async function compareRoutes() {
  const status = document.querySelector('#route-status');
  const button = document.querySelector('#find-route-button');
  const destinationText = document.querySelector('#route-destination').value.trim();
  if (!destinationText) { status.textContent = 'Enter a destination first.'; return; }
  if (!document.querySelector('#route-consent').checked) { status.textContent = 'Please check the box to allow your start and destination to be sent to OpenStreetMap services for routing.'; return; }
  button.disabled = true;
  document.querySelector('#route-results').hidden = true;
  status.textContent = 'Refreshing your live location…';
  try {
    const origin = await getFreshRoutePosition();
    status.textContent = 'Finding your destination and comparing routes… Your current coordinates and destination are sent to OpenStreetMap services.';
    const destination = await geocodeDestination(destinationText);
    const routes = await fetchAlternativeRoutes(origin, destination);
    status.textContent = 'Checking OpenStreetMap for mapped pothole hazards near the route…';
    let hazards;
    try { hazards = await findMappedHazards(routes); }
    catch (error) { hazards = null; }
    const recommended = drawRouteAlternatives(routes, destination, hazards, origin);
    const fastest = routes.reduce((best, route) => route.duration < best.duration ? route : best, routes[0]);
    const startText = `Live GPS start: ${origin.latitude.toFixed(5)}, ${origin.longitude.toFixed(5)} (about ${Math.round(origin.accuracy)} m accuracy)`;
    const longRouteWarning = routes[0].distance > 500000 ? ' This is a very long trip; confirm the live location and destination are right.' : '';
    const recommendationText = hazards === null
      ? 'Mapped hazard data was unavailable, so the fastest route stays selected.'
      : recommended.route === fastest
        ? 'The fastest route stays selected; no route with fewer mapped hazards fit the detour limit (up to 15% or 5 minutes).'
        : `The lower-hazard route adds ${Math.ceil((recommended.route.duration - fastest.duration) / 60)} minutes, within the detour limit; the fastest option is shown for comparison.`;
    status.textContent = `${startText}. Compared ${routes.length} route option${routes.length === 1 ? '' : 's'} to ${destination.name}. ${recommendationText} Live traffic isn’t included.${longRouteWarning}`;
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
document.querySelector('#emergency-phone').value = emergencyContact;
document.querySelector('#save-emergency-contact').addEventListener('click', saveEmergencyContact);
document.querySelector('#prepare-emergency-text').addEventListener('click', prepareEmergencyText);
if (emergencyContact) document.querySelector('#emergency-status').textContent = 'Contact saved on this device. No message has been sent.';
window.addEventListener('load', () => { initMap(); initRouteMap(); });
window.addEventListener('hashchange', () => { if (location.hash === '#map-section' && leafletMap) setTimeout(() => leafletMap.invalidateSize(), 100); if (location.hash === '#route-planner' && routeMap) setTimeout(() => routeMap.invalidateSize(), 100); });

const recommendedIdeas = document.createElement('section');
recommendedIdeas.className = 'section how-section';
recommendedIdeas.id = 'recommendations';
recommendedIdeas.innerHTML = '<div class="section-heading"><div><p class="eyebrow">RECOMMENDED NEXT STEPS</p><h2>What’s next for safer roads?</h2></div><span class="privacy-note">Future improvements — not available yet.</span></div><div class="steps"><article><span>01</span><h3>Live traffic</h3><p>Add real-time congestion data so routes can account for traffic and more realistic travel times.</p></article><article><span>02</span><h3>Shared road reports</h3><p>Let people contribute pothole reports to a shared map, with privacy safeguards and moderation.</p></article><article><span>03</span><h3>Community-checked AI</h3><p>Let people confirm or correct pothole detections to build a more useful, trusted report history.</p></article></div>';
document.querySelector('main').append(recommendedIdeas);


const backup = document.createElement('section');
backup.className = 'section report-backup';
backup.innerHTML = '<div class="card"><h2>Keep a copy of your reports</h2><p>Reports are saved in this browser. Download a CSV backup to keep them.</p><button class="button button-outline" id="download-reports" type="button">Download reports (CSV)</button><p id="download-status" role="status" aria-live="polite"></p></div>';
document.querySelector('main').append(backup);
const downloadButton = document.querySelector('#download-reports');
function refreshBackupButton() { downloadButton.disabled = reports.length === 0; }
refreshBackupButton();
document.querySelector('#submit-report').addEventListener('click', () => setTimeout(refreshBackupButton, 0));
downloadButton.addEventListener('click', () => {
  if (!reports.length) return;
  const cell = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
  const rows = [['date','latitude','longitude','image'], ...reports.map(r => [r.createdAt || '',r.latitude,r.longitude,r.name])];
  const blob = new Blob([rows.map(row => row.map(cell).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = 'roadsentry-reports-' + new Date().toISOString().slice(0,10) + '.csv'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  document.querySelector('#download-status').textContent = 'Downloaded ' + reports.length + ' report' + (reports.length === 1 ? '' : 's') + '.';
});
