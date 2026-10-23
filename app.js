const app = document.querySelector('#app');
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
let currentPosition = null;
let activeFile = null;
let leafletMap = null;
let userMarker = null;
let watchId = null;
const reports = [];

app.innerHTML = `
  <header class="navbar">
    <a class="brand" href="#overview" aria-label="RoadSentry home">RoadSentry <span>AI</span></a>
    <nav aria-label="Primary navigation"><a href="#report">Report a road issue</a><a href="#map-section">Live map</a></nav>
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
      <div class="section-heading"><div><p class="eyebrow">QUICK ROAD REPORT</p><h2>What did you spot?</h2></div><span class="privacy-note">Your photo stays on this device unless an AI service is connected.</span></div>
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
          <p class="ai-note" id="ai-status" aria-live="polite">AI detection service is not connected yet.</p>
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
function setImage(file) {
  const message = document.querySelector('#upload-message');
  if (!file) return;
  if (!file.type.startsWith('image/')) { message.textContent = 'Please choose an image file.'; message.className = 'field-message error'; return; }
  if (file.size >= MAX_IMAGE_BYTES) { message.textContent = 'That image is 5 MB or larger. Choose an image under 5 MB.'; message.className = 'field-message error'; return; }
  activeFile = file;
  const preview = document.querySelector('#image-preview');
  if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
  preview.dataset.objectUrl = URL.createObjectURL(file);
  preview.src = preview.dataset.objectUrl;
  preview.hidden = false;
  document.querySelector('#upload-placeholder').hidden = true;
  message.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  message.className = 'field-message';
  document.querySelector('#analyze-button').disabled = false;
  document.querySelector('#submit-report').disabled = !currentPosition;
  document.querySelector('#result-card').hidden = true;
}
async function analyzeImage() {
  if (!activeFile) return;
  const status = document.querySelector('#ai-status');
  const button = document.querySelector('#analyze-button');
  button.disabled = true; button.textContent = 'Checking for AI service…';
  status.textContent = 'Looking for a configured detection service…';
  try {
    const body = new FormData(); body.append('image', activeFile);
    if (currentPosition) { body.append('latitude', currentPosition.latitude); body.append('longitude', currentPosition.longitude); }
    const response = await fetch('/api/detect', { method: 'POST', body });
    if (!response.ok) throw new Error(response.status === 404 ? 'AI detection service is not connected. Add a /api/detect service to enable pothole predictions.' : `AI service returned error ${response.status}.`);
    const result = await response.json();
    if (!result || !result.label) throw new Error('AI service returned no detection result.');
    document.querySelector('#result-card').innerHTML = `<div><span class="step">AI RESULT</span><h3>${escapeHtml(result.label)}</h3><p>${escapeHtml(result.description || 'Review this result before saving your report.')}</p></div><span class="confidence">${Number.isFinite(result.confidence) ? `${Math.round(result.confidence * 100)}% confidence` : 'Detection result'}</span>`;
    document.querySelector('#result-card').hidden = false;
    status.textContent = 'AI analysis complete. Please review the result.';
  } catch (error) { status.textContent = error.message.includes('Failed to fetch') ? 'AI detection service is not connected yet. The image has not been uploaded.' : error.message; }
  finally { button.disabled = !activeFile; button.innerHTML = 'Analyze road image <span aria-hidden="true">↗</span>'; }
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function addReportMarker(report) {
  if (!window.L || !leafletMap) return;
  L.circleMarker([report.latitude, report.longitude], { radius: 9, color: '#c74837', fillColor: '#f27660', fillOpacity: .9, weight: 3 }).addTo(leafletMap).bindPopup(`<strong>${escapeHtml(report.name)}</strong><br>Saved on this device`);
}
function saveReport() {
  if (!activeFile || !currentPosition) return;
  reports.push({ latitude: currentPosition.latitude, longitude: currentPosition.longitude, name: activeFile.name });
  addReportMarker(reports[reports.length - 1]);
  document.querySelector('#submit-message').textContent = `Report saved on this device at ${currentPosition.latitude.toFixed(5)}, ${currentPosition.longitude.toFixed(5)}. No server is connected to share it with a road authority.`;
  document.querySelector('#submit-report').textContent = 'Report saved ✓';
  document.querySelector('#submit-report').disabled = true;
}

document.querySelector('#image-input').addEventListener('change', event => setImage(event.target.files[0]));
document.querySelector('#upload-zone').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); document.querySelector('#image-input').click(); } });
document.querySelector('#locate-button').addEventListener('click', startLocation);
document.querySelector('#nav-locate').addEventListener('click', startLocation);
document.querySelector('#stop-location').addEventListener('click', stopLocation);
document.querySelector('#analyze-button').addEventListener('click', analyzeImage);
document.querySelector('#submit-report').addEventListener('click', saveReport);
window.addEventListener('load', initMap);
window.addEventListener('hashchange', () => { if (location.hash === '#map-section' && leafletMap) setTimeout(() => leafletMap.invalidateSize(), 100); });
