(() => {
  const config = window.ROAD_SENTRY_CONFIG || {};
  const ready = Boolean(config.url && config.anonKey && window.supabase?.createClient);
  let client = null;
  let communityMap = null;
  let communityLayer = null;
  let sending = false;
  let bypassSubmit = false;
  const reportSection = document.createElement('section');
  reportSection.className = 'section community-section';
  reportSection.id = 'community-reports';
  reportSection.innerHTML = '<div class="section-heading"><div><p class="eyebrow">COMMUNITY REPORTS</p><h2>Reports shared by everyone</h2></div><button class="button button-outline" id="refresh-community" type="button">Refresh map</button></div><p class="privacy-note" id="community-status" role="status" aria-live="polite"></p><div id="community-map" aria-label="Map of public pothole reports" style="height:380px;border-radius:20px;overflow:hidden;background:#d9ebe5"></div><p class="route-attribution">Public reports include the photo and precise coordinates. Please do not upload faces, license plates, or other private details.</p>';
  const mapSection = document.querySelector('#map-section');
  mapSection?.after(reportSection);
  const submitRow = document.querySelector('.submit-row');
  const consent = document.createElement('label');
  consent.className = 'community-consent';
  consent.style.cssText = ready ? 'display:flex;align-items:flex-start;gap:10px;flex-basis:100%;font-size:.9rem;line-height:1.5;margin:.75rem 0' : 'display:none';
  consent.innerHTML = '<input id="public-report-consent" type="checkbox"><span>I agree to publish this photo and its exact location on the shared map, where anyone can view it.</span>';
  submitRow?.prepend(consent);
  const status = document.querySelector('#community-status');
  const say = text => { if (status) status.textContent = text; };
  if (!window.L) say('The map library did not load. Reload the page to try again.');
  else {
    communityMap = L.map('community-map', { scrollWheelZoom: false }).setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(communityMap);
    communityLayer = L.featureGroup().addTo(communityMap);
    setTimeout(() => communityMap.invalidateSize(), 150);
  }
  if (!ready) {
    say('Shared reporting is not connected yet. Your current reports stay on this device; no photo or location is uploaded.');
    return;
  }
  client = window.supabase.createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  const escape = value => String(value || '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  const getPublicUrl = path => client.storage.from('road-reports').getPublicUrl(path).data.publicUrl;
  async function loadCommunityReports() {
    if (!communityMap) return;
    say('Loading shared reports…');
    const { data, error } = await client.from('road_reports').select('id,created_at,latitude,longitude,photo_path,photo_name').order('created_at', { ascending: false }).limit(300);
    if (error) { say('Could not load shared reports. Check the backend setup and try Refresh map.'); return; }
    communityLayer.clearLayers();
    (data || []).forEach(report => {
      const photoUrl = getPublicUrl(report.photo_path);
      const date = new Date(report.created_at).toLocaleString();
      const popup = '<div style="max-width:230px"><img src="' + escape(photoUrl) + '" alt="Community road report" style="display:block;width:100%;height:auto;border-radius:8px"><strong>' + escape(report.photo_name) + '</strong><br><small>' + escape(date) + '</small><br><small>Publicly shared road photo and location</small></div>';
      L.marker([report.latitude, report.longitude]).bindPopup(popup, { maxWidth: 250 }).addTo(communityLayer);
    });
    if (data?.length) { const bounds = communityLayer.getBounds(); if (bounds.isValid()) communityMap.fitBounds(bounds.pad(.16), { maxZoom: 14 }); }
    say((data?.length || 0) + ' public report' + ((data?.length || 0) === 1 ? '' : 's') + ' loaded. The map refreshes automatically every 45 seconds.');
  }
  document.querySelector('#refresh-community')?.addEventListener('click', loadCommunityReports);
  loadCommunityReports();
  setInterval(loadCommunityReports, 45000);
  const saveButton = document.querySelector('#submit-report');
  saveButton?.addEventListener('click', async event => {
    if (bypassSubmit || sending) return;
    if (!document.querySelector('#public-report-consent')?.checked) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const values = [...document.querySelectorAll('#coordinates strong')].map(item => Number(item.textContent));
    const preview = document.querySelector('#image-preview');
    if (values.length !== 2 || !values.every(Number.isFinite) || !preview?.naturalWidth) { say('Choose an image and get your live location before sharing.'); return; }
    sending = true;
    saveButton.disabled = true;
    say('Preparing the image and connecting securely…');
    let uploadedPath = null;
    try {
      let { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session) {
        const { data, error } = await client.auth.signInAnonymously();
        if (error) throw error;
        sessionData = { session: data.session };
      }
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1600 / Math.max(preview.naturalWidth, preview.naturalHeight));
      canvas.width = Math.max(1, Math.round(preview.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(preview.naturalHeight * scale));
      canvas.getContext('2d').drawImage(preview, 0, 0, canvas.width, canvas.height);
      const photo = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare this image for sharing.')), 'image/jpeg', .82));
      if (photo.size > 5 * 1024 * 1024) throw new Error('The prepared photo is still over 5 MB. Choose a smaller image.');
      const userId = sessionData.session.user.id;
      const reportId = crypto.randomUUID();
      uploadedPath = userId + '/' + reportId + '.jpg';
      say('Uploading the photo and public map pin…');
      const { error: uploadError } = await client.storage.from('road-reports').upload(uploadedPath, photo, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;
      const originalName = document.querySelector('#upload-message')?.textContent.split(' · ')[0] || 'Road report.jpg';
      const { error: insertError } = await client.from('road_reports').insert({ id: reportId, latitude: values[0], longitude: values[1], photo_path: uploadedPath, photo_name: originalName, created_by: userId });
      if (insertError) throw insertError;
      say('Shared successfully. Anyone visiting the site can now see this photo and its exact map location.');
      document.querySelector('#public-report-consent').checked = false;
      saveButton.disabled = false;
      bypassSubmit = true;
      saveButton.click();
      bypassSubmit = false;
      await loadCommunityReports();
    } catch (error) {
      if (uploadedPath) { try { await client.storage.from('road-reports').remove([uploadedPath]); } catch {} }
      console.error('Shared report failed:', error);
      say(error.message || 'Sharing failed. Check your connection and backend setup, then try again.');
    } finally {
      bypassSubmit = false;
      sending = false;
      if (!document.querySelector('#submit-message')?.textContent.startsWith('Report saved')) saveButton.disabled = false;
    }
  }, true);
})();
