(() => {
  'use strict';

  const workspace = document.getElementById('workspace');
  const eventList = document.getElementById('eventList');
  const simState = document.getElementById('simState');
  const sendBtn = document.getElementById('sendBtn');
  const packet = document.getElementById('packet');

  if (!workspace) return;

  // Velocidad pensada para feria: suficientemente lenta para seguir el recorrido,
  // pero sin hacer eterna la demostración. Cada salto dura aprox. 1.2 segundos.
  const HOP_MS = 1150;
  const PAUSE_MS = 120;
  const FINAL_HIDE_MS = 750;

  const baseLinks = [
    ['pc1', 'r1'],
    ['r1', 'sw1'],
    ['r1', 'ap'],
    ['sw1', 'srv']
  ];

  const knownLinks = [];
  let mapConnectPick = null;
  let fastRunning = false;

  const style = document.createElement('style');
  style.textContent = `
    .packet.returning,
    .topology-ping-packet.returning {
      background: #f7c948 !important;
      color: #09213a !important;
      box-shadow: 0 0 0 8px rgba(247, 201, 72, .18), 0 14px 24px rgba(247, 201, 72, .25) !important;
    }
    .links line.fast-active,
    .extra-link.fast-active {
      stroke: #e53935 !important;
      stroke-width: 5 !important;
      opacity: 1 !important;
      stroke-dasharray: 9 7 !important;
      animation: fastDash .9s linear infinite;
    }
    .links line.fast-return,
    .extra-link.fast-return {
      stroke: #f7c948 !important;
    }
    .node.fast-hop {
      outline: 3px solid rgba(229,57,53,.38) !important;
      box-shadow: 0 0 0 9px rgba(229,57,53,.09) !important;
    }
    .node.fast-return-hop {
      outline: 3px solid rgba(247,201,72,.55) !important;
      box-shadow: 0 0 0 9px rgba(247,201,72,.15) !important;
    }
    @keyframes fastDash { to { stroke-dashoffset: -32; } }
  `;
  document.head.appendChild(style);

  function node(id) {
    return document.getElementById(id);
  }

  function label(id) {
    const n = node(id);
    return n?.dataset.name || n?.querySelector('strong')?.textContent || id;
  }

  function getPercent(id) {
    const n = node(id);
    if (!n) return { x: 50, y: 50 };
    return {
      x: parseFloat(n.style.getPropertyValue('--x')) || 50,
      y: parseFloat(n.style.getPropertyValue('--y')) || 50
    };
  }

  function samePair(link, a, b) {
    return (link.a === a && link.b === b) || (link.a === b && link.b === a);
  }

  function visibleLineFor(a, b) {
    const direct = document.querySelector(`.links line[data-extra-link="${a}-${b}"], .links line[data-extra-link="${b}-${a}"], .links line[data-a="${a}"][data-b="${b}"], .links line[data-a="${b}"][data-b="${a}"]`);
    if (direct) return direct;
    const index = baseLinks.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
    return index >= 0 ? document.querySelectorAll('.links line')[index] : null;
  }

  function rememberLink(a, b) {
    if (!a || !b || a === b || knownLinks.some(link => samePair(link, a, b))) return;
    const line = visibleLineFor(a, b) || Array.from(document.querySelectorAll('.links line.extra-link, .links line')).find(l => !l.dataset.a && !l.dataset.b);
    if (line) {
      line.dataset.a = a;
      line.dataset.b = b;
    }
    knownLinks.push({ a, b, line });
  }

  function refreshKnownLinks() {
    baseLinks.forEach(([a, b], index) => {
      const line = document.querySelectorAll('.links line')[index];
      if (line) {
        line.dataset.a ||= a;
        line.dataset.b ||= b;
        line.dataset.extraLink ||= `${a}-${b}`;
      }
      rememberLink(a, b);
    });

    document.querySelectorAll('.links line[data-a][data-b]').forEach(line => {
      rememberLink(line.dataset.a, line.dataset.b);
    });
  }

  function buildGraph() {
    refreshKnownLinks();
    const graph = {};
    workspace.querySelectorAll('.node').forEach(n => { graph[n.id] = []; });
    knownLinks.forEach(({ a, b }) => {
      if (!graph[a]) graph[a] = [];
      if (!graph[b]) graph[b] = [];
      graph[a].push(b);
      graph[b].push(a);
    });
    return graph;
  }

  function shortestPath(start, end) {
    if (!start || !end || start === end) return [];
    const graph = buildGraph();
    const queue = [[start]];
    const seen = new Set([start]);

    while (queue.length) {
      const path = queue.shift();
      const last = path[path.length - 1];
      for (const next of graph[last] || []) {
        if (seen.has(next)) continue;
        const candidate = [...path, next];
        if (next === end) return candidate;
        seen.add(next);
        queue.push(candidate);
      }
    }
    return [];
  }

  function cleanFastClasses() {
    document.querySelectorAll('.fast-active,.fast-return').forEach(el => el.classList.remove('fast-active', 'fast-return'));
    document.querySelectorAll('.fast-hop,.fast-return-hop').forEach(el => el.classList.remove('fast-hop', 'fast-return-hop'));
  }

  function addEvent(title, text, type = 'normal') {
    if (!eventList) return;
    const item = document.createElement('div');
    item.className = `event ${type}`;
    const n = Math.min(eventList.children.length + 1, 99);
    item.innerHTML = `<span>${String(n).padStart(2, '0')}</span><p><strong>${title}</strong><small>${text}</small></p>`;
    eventList.appendChild(item);
    eventList.scrollTop = eventList.scrollHeight;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function placeVisual(visual, id, instant = false) {
    const p = getPercent(id);
    visual.style.transition = instant ? 'none' : `left ${HOP_MS}ms cubic-bezier(.2,.9,.25,1), top ${HOP_MS}ms cubic-bezier(.2,.9,.25,1), transform ${HOP_MS}ms ease`;
    visual.style.left = `${p.x}%`;
    visual.style.top = `${p.y}%`;
  }

  function linkBetween(a, b) {
    const remembered = knownLinks.find(link => samePair(link, a, b));
    return remembered?.line || visibleLineFor(a, b);
  }

  async function animatePath(path, visual, phase) {
    const returning = phase === 'Respuesta';
    visual.classList.toggle('returning', returning);

    for (let i = 1; i < path.length; i += 1) {
      const from = path[i - 1];
      const to = path[i];
      const line = linkBetween(from, to);
      const target = node(to);

      line?.classList.add('fast-active');
      if (returning) line?.classList.add('fast-return');
      target?.classList.add(returning ? 'fast-return-hop' : 'fast-hop');

      if (simState) simState.textContent = returning ? `Respuesta: ${label(from)} → ${label(to)}` : `Envío: ${label(from)} → ${label(to)}`;
      placeVisual(visual, to);
      await sleep(HOP_MS + PAUSE_MS);

      line?.classList.remove('fast-active', 'fast-return');
      target?.classList.remove('fast-hop', 'fast-return-hop');
    }
  }

  async function runFastSimulation(start, end, visual, options = {}) {
    if (fastRunning) return;
    const path = shortestPath(start, end);
    const feedback = document.querySelector('.compact-ping-feedback');

    if (path.length < 2) {
      if (feedback) {
        feedback.textContent = 'No hay ruta entre esos equipos. Primero crea una conexión.';
        feedback.className = 'compact-ping-feedback bad';
      }
      if (simState) simState.textContent = 'Sin ruta disponible';
      return;
    }

    fastRunning = true;
    cleanFastClasses();
    if (eventList && options.clearEvents !== false) eventList.innerHTML = '';

    if (options.button) {
      options.button.disabled = true;
      options.button.textContent = options.runningLabel || 'Transmitiendo…';
    }

    visual.classList.add('active');
    visual.classList.remove('returning', 'delivered');
    if (options.text) visual.textContent = options.text;
    placeVisual(visual, start, true);

    addEvent('Ida', `${label(start)} envía información hacia ${label(end)}.`, 'info');
    await sleep(180);
    await animatePath(path, visual, 'Enviando');

    addEvent('Llegada', `${label(end)} recibió la información.`, 'success');
    await sleep(420);

    addEvent('Vuelta', `${label(end)} responde por la misma ruta.`, 'info');
    if (options.returnText) visual.textContent = options.returnText;
    await animatePath([...path].reverse(), visual, 'Respuesta');

    addEvent('Completado', `${label(start)} recibió la respuesta.`, 'success');
    if (simState) simState.textContent = 'Ida y vuelta completadas';
    visual.classList.remove('returning');
    visual.classList.add('delivered');

    if (feedback && options.isPing) {
      feedback.textContent = `Ping completado: ${path.map(label).join(' → ')} → ${label(start)}`;
      feedback.className = 'compact-ping-feedback ok';
    }

    await sleep(FINAL_HIDE_MS);
    visual.classList.remove('active', 'delivered');

    if (options.button) {
      options.button.disabled = false;
      options.button.textContent = options.doneLabel || 'Enviar nuevamente';
    }

    fastRunning = false;
  }

  function interceptMainPacket(event) {
    const btn = event.target.closest('#sendBtn');
    if (!btn || !packet) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const start = document.getElementById('originSelect')?.value || 'pc1';
    const end = document.getElementById('destinationSelect')?.value || 'srv';
    const protocol = document.getElementById('protocol')?.value || 'ICMP';
    document.getElementById('packetStatus') && (document.getElementById('packetStatus').textContent = 'Enviando →');
    runFastSimulation(start, end, packet, {
      button: btn,
      runningLabel: 'Enviando…',
      doneLabel: 'Enviar paquete',
      text: protocol,
      returnText: 'ACK'
    });
  }

  function interceptPing(event) {
    const btn = event.target.closest('#extraPing');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const visual = document.getElementById('extraPingPacket');
    if (!visual) return;
    const start = document.getElementById('extraOrigin')?.value || 'pc1';
    const end = document.getElementById('extraDestination')?.value || 'srv';
    runFastSimulation(start, end, visual, {
      button: btn,
      runningLabel: 'Ping…',
      doneLabel: 'Ping',
      text: 'PING',
      returnText: 'PONG',
      isPing: true
    });
  }

  function rememberLinkFromControls() {
    const a = document.getElementById('linkFrom')?.value;
    const b = document.getElementById('linkTo')?.value;
    window.setTimeout(() => rememberLink(a, b), 80);
  }

  function trackMapConnection(event) {
    const nodeBtn = event.target.closest('.node');
    const connectBtn = document.getElementById('extraConnect');
    if (!nodeBtn || !connectBtn?.classList.contains('active')) return;

    if (!mapConnectPick) {
      mapConnectPick = nodeBtn.id;
      return;
    }

    const a = mapConnectPick;
    const b = nodeBtn.id;
    mapConnectPick = null;
    window.setTimeout(() => rememberLink(a, b), 90);
  }

  function simplifyUiText() {
    const pingHint = document.querySelector('.compact-ping-feedback');
    if (pingHint) pingHint.textContent = 'Ping muestra ida y vuelta: pregunta si el equipo responde.';

    const truth = document.getElementById('netTruthText');
    if (truth) truth.textContent = 'El mensaje sale de un equipo, pasa por los dispositivos conectados y vuelve cuando recibe respuesta.';

    const note = document.querySelector('.cable-help-note');
    if (note) note.innerHTML = '<b>Cableado:</b> para la feria basta elegir un cable y conectar dos equipos para ver el recorrido.';
  }

  document.addEventListener('click', interceptMainPacket, true);
  document.addEventListener('click', interceptPing, true);
  document.addEventListener('click', event => {
    if (event.target.closest('#extraCreateLink')) rememberLinkFromControls();
    if (event.target.closest('#extraConnect')) mapConnectPick = null;
    trackMapConnection(event);
  }, true);

  const observer = new MutationObserver(() => {
    refreshKnownLinks();
    simplifyUiText();
  });
  observer.observe(workspace, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-a', 'data-b', 'style', 'class'] });

  refreshKnownLinks();
  simplifyUiText();
  window.setTimeout(() => { refreshKnownLinks(); simplifyUiText(); }, 400);
  window.setTimeout(() => { refreshKnownLinks(); simplifyUiText(); }, 1000);
})();
