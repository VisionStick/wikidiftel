(() => {
  const workspace = document.getElementById('workspace');
  const devicePanel = document.querySelector('.device-panel');
  const WIKI_DIFTEL_URL = 'https://visionstick.github.io/wikidiftel/';

  function updateWikiDiftelLinks() {
    document.querySelectorAll('a[href="https://diftel.josnic.cl/"]').forEach(link => {
      link.href = WIKI_DIFTEL_URL;
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });
  }

  updateWikiDiftelLinks();

  if (!workspace || !devicePanel) return;

  devicePanel.classList.add('device-panel-live');

  const firstTitle = devicePanel.querySelector('.panel-title');
  const liveBlock = document.createElement('section');
  liveBlock.className = 'live-topology-panel';
  liveBlock.innerHTML = `
    <div class="live-panel-head">
      <div>
        <strong>Dispositivos en la red</strong>
        <small>Se actualiza al crear, editar o eliminar equipos.</small>
      </div>
      <span id="liveDeviceCount">0</span>
    </div>

    <div class="live-summary-grid" aria-label="Resumen de topología">
      <div><small>Equipos</small><strong id="liveTotalDevices">0</strong></div>
      <div><small>Finales</small><strong id="liveEndDevices">0</strong></div>
      <div><small>Enlaces</small><strong id="liveTotalLinks">0</strong></div>
    </div>

    <div class="live-device-list" id="liveDeviceList"></div>

    <p class="live-panel-note">Haz clic para seleccionar. Doble clic en el equipo del mapa para editar IP, máscara y gateway.</p>
  `;

  if (firstTitle) {
    firstTitle.insertAdjacentElement('afterend', liveBlock);
  } else {
    devicePanel.prepend(liveBlock);
  }

  const liveDeviceList = document.getElementById('liveDeviceList');
  const liveDeviceCount = document.getElementById('liveDeviceCount');
  const liveTotalDevices = document.getElementById('liveTotalDevices');
  const liveEndDevices = document.getElementById('liveEndDevices');
  const liveTotalLinks = document.getElementById('liveTotalLinks');

  const kindInfo = {
    pc: { label: 'PC', name: 'PC' },
    laptop: { label: 'NB', name: 'Notebook' },
    phone: { label: 'CEL', name: 'Celular' },
    server: { label: 'SV', name: 'Servidor' },
    switch: { label: 'SW', name: 'Switch' },
    router: { label: 'R', name: 'Router' },
    ap: { label: 'AP', name: 'Access Point' }
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function inferKind(node) {
    if (node.dataset.kind) return node.dataset.kind;
    if (node.id === 'srv' || node.classList.contains('server')) return 'server';
    if (node.id === 'sw1' || node.classList.contains('switch')) return 'switch';
    if (node.id === 'r1' || node.classList.contains('router')) return 'router';
    if (node.id === 'ap' || node.classList.contains('ap')) return 'ap';
    if (node.classList.contains('phone')) return 'phone';
    if (node.classList.contains('laptop')) return 'laptop';
    return 'pc';
  }

  function getNodes() {
    return Array.from(workspace.querySelectorAll('.node'));
  }

  function getLinksCount() {
    const lines = Array.from(workspace.querySelectorAll('svg.links line'));
    return lines.filter(line => !line.dataset.hidden).length;
  }

  function getNodeData(node) {
    const kind = inferKind(node);
    return {
      id: node.id,
      kind,
      code: kindInfo[kind]?.label || 'IP',
      typeName: kindInfo[kind]?.name || 'Dispositivo',
      name: node.dataset.name || node.querySelector('strong')?.textContent || node.id,
      ip: node.dataset.ip || node.querySelector('small')?.textContent || 'Sin IP',
      mask: node.dataset.mask || '255.255.255.0',
      gateway: node.dataset.gateway || 'Sin gateway',
      active: node.classList.contains('extra-selected') || node.classList.contains('selected') || node.classList.contains('hop-active')
    };
  }

  function removeObsoleteRoute() {
    document.getElementById('routeChooser')?.remove();
  }

  function renderDevices() {
    removeObsoleteRoute();

    const nodes = getNodes();
    const endKinds = new Set(['pc', 'laptop', 'phone', 'server']);
    const endCount = nodes.filter(node => endKinds.has(inferKind(node))).length;
    const linkCount = getLinksCount();

    liveDeviceCount.textContent = String(nodes.length);
    liveTotalDevices.textContent = String(nodes.length);
    liveEndDevices.textContent = String(endCount);
    liveTotalLinks.textContent = String(linkCount);

    liveDeviceList.innerHTML = nodes.map(node => {
      const data = getNodeData(node);
      return `
        <button type="button" class="live-device-card ${escapeHtml(data.kind)} ${data.active ? 'active' : ''}" data-node-id="${escapeHtml(data.id)}">
          <span class="live-device-type">${escapeHtml(data.code)}</span>
          <span class="live-device-main">
            <strong>${escapeHtml(data.name)}</strong>
            <small>${escapeHtml(data.ip)}</small>
          </span>
          <span class="live-device-meta">
            <em>${escapeHtml(data.mask)}</em>
            <em>GW ${escapeHtml(data.gateway)}</em>
          </span>
        </button>`;
    }).join('');
  }

  function focusNode(id, openInspector = false) {
    const node = document.getElementById(id);
    if (!node) return;

    const eventName = openInspector ? 'dblclick' : 'click';
    node.dispatchEvent(new MouseEvent(eventName, {
      bubbles: true,
      cancelable: true,
      view: window
    }));

    node.classList.add('sidebar-pulse');
    setTimeout(() => node.classList.remove('sidebar-pulse'), 650);
    setTimeout(renderDevices, 80);
  }

  liveDeviceList.addEventListener('click', event => {
    const card = event.target.closest('.live-device-card');
    if (!card) return;
    focusNode(card.dataset.nodeId, false);
  });

  liveDeviceList.addEventListener('dblclick', event => {
    const card = event.target.closest('.live-device-card');
    if (!card) return;
    focusNode(card.dataset.nodeId, true);
  });

  let renderTimer = null;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderDevices, 80);
  }

  const observer = new MutationObserver(scheduleRender);
  observer.observe(workspace, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-name', 'data-ip', 'data-mask', 'data-gateway', 'data-kind']
  });

  const panelObserver = new MutationObserver(() => {
    removeObsoleteRoute();
  });
  panelObserver.observe(devicePanel, { childList: true, subtree: true });

  document.addEventListener('click', event => {
    if (event.target.closest('.node, .compact-action, .compact-device-grid, .floating-inspector, .live-device-card')) {
      scheduleRender();
    }
  }, true);

  window.addEventListener('resize', scheduleRender);

  renderDevices();
  setTimeout(renderDevices, 250);
  setTimeout(renderDevices, 800);
  setTimeout(updateWikiDiftelLinks, 1000);
})();
