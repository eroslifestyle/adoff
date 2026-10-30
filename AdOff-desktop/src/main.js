// AdOff VPN — Desktop Client
// ponytail: bridge Tauri stub, mock UI state

const { invoke } = window.__TAURI__.core;

// ── State ────────────────────────────────────────────────────────────────────
let state = {
  license: null,
  bearerToken: null,
  connected: false,
  connecting: false,
  selectedServer: null,
};

// ── DOM refs ─────────────────────────────────────────────────────────────────
const statusCircle = document.getElementById('statusCircle');
const statusIcon = document.getElementById('statusIcon');
const statusLabel = document.getElementById('statusLabel');
const statusDetail = document.getElementById('statusDetail');
const connectBtn = document.getElementById('connectBtn');
const licenseStatus = document.getElementById('licenseStatus');
const licenseBadge = document.getElementById('licenseBadge');
const serverList = document.getElementById('serverList');

// ── Tauri bridge ─────────────────────────────────────────────────────────────
/**
 * verify_license — chiama GET /api/verify-mobile-license
 * @param {string} token — token licenza dall'extension
 * @returns {{ valid, plan, expires_at, account_id, bearer_token }}
 */
async function verifyLicense(token) {
  return invoke('verify_license', { token });
}

/**
 * get_vpn_servers — chiama GET /vpn/servers
 * @param {string} bearerToken
 * @returns {Array<{ id, name, country, country_code, load, premium_only }>}
 */
async function getVpnServers(bearerToken) {
  return invoke('get_vpn_servers', { bearerToken });
}

/**
 * get_vpn_config — chiama GET /vpn/config
 * @param {string} bearerToken
 * @param {string} accountId
 * @param {string} serverId
 * @param {string} deviceId
 * @returns {{ config, server, port, protocol }}
 */
async function getVpnConfig(bearerToken, accountId, serverId, deviceId) {
  return invoke('get_vpn_config', { bearerToken, accountId, serverId, deviceId });
}

/**
 * create_vpn_account — chiama POST /vpn/create
 * @param {string} bearerToken
 * @returns {{ account_id, device_id, created }}
 */
async function createVpnAccount(bearerToken) {
  return invoke('create_vpn_account', { bearerToken });
}

// ── UI helpers ───────────────────────────────────────────────────────────────
function updateStatusUI() {
  if (state.connecting) {
    statusCircle.className = 'status-circle connecting';
    statusIcon.textContent = '◌';
    statusLabel.textContent = 'Connessione...';
    connectBtn.textContent = 'Annulla';
    connectBtn.disabled = false;
  } else if (state.connected) {
    statusCircle.className = 'status-circle connected';
    statusIcon.textContent = '⏻';
    statusLabel.textContent = 'Connesso';
    connectBtn.textContent = 'Disconnetti';
    connectBtn.disabled = false;
    statusDetail.textContent = state.selectedServer
      ? `Server: ${state.selectedServer.name}`
      : '';
  } else {
    statusCircle.className = 'status-circle';
    statusIcon.textContent = '⏻';
    statusLabel.textContent = 'Disconnesso';
    connectBtn.textContent = 'Connetti';
    connectBtn.disabled = !state.selectedServer || !state.bearerToken;
    statusDetail.textContent = '';
  }
}

function updateLicenseUI() {
  if (state.license) {
    if (state.license.valid) {
      licenseBadge.className = 'license-badge active';
      licenseStatus.textContent = `${state.license.plan} ✓`;
    } else {
      licenseBadge.className = 'license-badge';
      licenseStatus.textContent = 'Licenza non valida';
    }
  }
}

function renderServerList(servers) {
  // ponytail: placeholder — real rendering quando API risponde
  console.log('Servers:', servers);
}

// ── Event handlers ───────────────────────────────────────────────────────────
serverList.addEventListener('click', (e) => {
  const item = e.target.closest('.server-item');
  if (!item) return;

  document.querySelectorAll('.server-item').forEach(el => el.classList.remove('selected'));
  item.classList.add('selected');

  state.selectedServer = {
    id: item.dataset.id,
    name: item.querySelector('.server-name').textContent,
  };

  updateStatusUI();
});

connectBtn.addEventListener('click', async () => {
  if (state.connecting) {
    state.connecting = false;
    updateStatusUI();
    return;
  }

  if (state.connected) {
    // ponytail: disconnect stub
    state.connected = false;
    updateStatusUI();
    return;
  }

  if (!state.selectedServer || !state.bearerToken) return;

  state.connecting = true;
  updateStatusUI();

  // Simula connessione (stub reale chiama VPN backend)
  setTimeout(() => {
    state.connecting = false;
    state.connected = true;
    updateStatusUI();
  }, 1500);
});

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  // ponytail: in produzione legge il token dalla license salvata
  // Per ora usa un placeholder — l'utente inserisce manualmente o
  // lo legge da ~/.config/adoff-vpn/licenza.json
  const savedToken = localStorage.getItem('adoff_license_token');
  if (savedToken) {
    try {
      const result = await verifyLicense(savedToken);
      state.license = result;
      state.bearerToken = result.bearer_token;
      updateLicenseUI();
      updateStatusUI();

      // Carica server reali se licenza valida
      if (result.valid && result.bearer_token) {
        const servers = await getVpnServers(result.bearer_token);
        renderServerList(servers);
      }
    } catch (err) {
      console.error('License verify failed:', err);
      licenseStatus.textContent = 'Verifica fallita';
    }
  } else {
    licenseStatus.textContent = 'Nessuna licenza';
    connectBtn.disabled = true;
  }
}

init();
