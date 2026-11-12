import { onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { onValue, ref } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
import { auth, db, firebaseConfigured, missingFirebaseFields } from './firebase-config.js';

const ADMIN_PIN = '2026';
const PIN_SESSION_KEY = 'sd-delivery-admin-unlocked';
const lockScreen = document.getElementById('admin-lock');
const lockForm = document.getElementById('admin-pin-form');
const lockMessage = document.getElementById('admin-lock-message');
const dashboard = document.getElementById('admin-dashboard');
const adminStatus = document.getElementById('admin-status');
const uidCard = document.getElementById('admin-uid-card');
const uidText = document.getElementById('admin-uid');
const driverList = document.getElementById('driver-list');
const markers = new Map();
let map = null;
let stopDriverListener = null;
let adminUid = null;

const setLockMessage = (text, kind = 'error') => {
  lockMessage.textContent = text;
  lockMessage.dataset.kind = kind;
};

const setAdminStatus = (text, kind = 'info') => {
  adminStatus.textContent = text;
  adminStatus.dataset.kind = kind;
};

const getAnonymousUser = () => new Promise((resolve, reject) => {
  const unsubscribe = onAuthStateChanged(auth, async user => {
    unsubscribe();
    if (user) {
      resolve(user);
      return;
    }

    try {
      resolve((await signInAnonymously(auth)).user);
    } catch (error) {
      reject(error);
    }
  }, error => {
    unsubscribe();
    reject(error);
  });
});

const ensureMap = () => {
  if (map) {
    map.invalidateSize();
    return;
  }
  if (!window.L) throw new Error('No se pudo cargar Leaflet para mostrar el mapa.');

  map = window.L.map('live-map').setView([-7.1638, -78.5003], 14);
  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
  }).addTo(map);
};

const makePopup = driver => {
  const popup = document.createElement('div');
  const name = document.createElement('strong');
  const plate = document.createElement('p');
  const state = document.createElement('p');
  name.textContent = driver.nombre || 'Repartidor';
  plate.textContent = `Placa: ${driver.placa || '—'}`;
  state.textContent = `Estado: ${driver.estado || '—'}`;
  popup.append(name, plate, state);
  return popup;
};

const signalAge = timestamp => {
  const lastUpdate = Number(timestamp);
  if (!Number.isFinite(lastUpdate) || lastUpdate <= 0) return 'sin señal registrada';
  const seconds = Math.max(0, Math.floor((Date.now() - lastUpdate) / 1000));
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours} h`;
};

const renderDriverList = drivers => {
  driverList.replaceChildren();
  if (!drivers.length) {
    const empty = document.createElement('li');
    empty.className = 'driver-list-empty';
    empty.textContent = 'No hay repartidores conectados en este momento.';
    driverList.append(empty);
    return;
  }

  drivers.forEach(({ id, data }) => {
    const row = document.createElement('li');
    row.className = 'driver-row';
    const ageSeconds = (Date.now() - Number(data.ultimaActualizacion || 0)) / 1000;
    row.dataset.stale = String(!Number.isFinite(ageSeconds) || ageSeconds > 120);

    const heading = document.createElement('div');
    heading.className = 'driver-row-heading';
    const name = document.createElement('span');
    name.className = 'driver-row-name';
    name.textContent = data.nombre || 'Repartidor';
    const plate = document.createElement('span');
    plate.className = 'driver-row-plate';
    plate.textContent = data.placa || 'Sin placa';
    heading.append(name, plate);

    const state = document.createElement('p');
    state.className = 'driver-row-state';
    state.dataset.state = data.estado || '';
    state.textContent = data.estado || 'Estado desconocido';

    const signal = document.createElement('p');
    signal.className = 'driver-row-signal';
    signal.textContent = `Última señal ${signalAge(data.ultimaActualizacion)}`;
    row.append(heading, state, signal);

    const phone = String(data.telefono || '').replace(/\D/g, '');
    if (phone.length >= 7 && phone.length <= 15) {
      const internationalPhone = phone.startsWith('51') ? phone : `51${phone}`;
      const contact = document.createElement('a');
      contact.className = 'driver-whatsapp';
      contact.href = `https://wa.me/${internationalPhone}`;
      contact.target = '_blank';
      contact.rel = 'noopener noreferrer';
      contact.textContent = 'Escribir por WhatsApp';
      row.append(contact);
    }

    driverList.append(row);
  });
};

const renderDrivers = snapshot => {
  const records = snapshot.val() || {};
  const entries = Object.entries(records).map(([id, data]) => ({ id, data: data || {} }));
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const active = entries.filter(({ data }) => data.activo === true);
  const todayCount = active.filter(({ data }) => Number(data.inicioTurno) >= startOfDay.getTime()).length;
  const availableCount = active.filter(({ data }) => data.estado === 'Disponible').length;
  const deliveryCount = active.filter(({ data }) => data.estado === 'En reparto').length;

  document.getElementById('count-today').textContent = String(todayCount);
  document.getElementById('count-available').textContent = String(availableCount);
  document.getElementById('count-delivery').textContent = String(deliveryCount);

  const located = active.filter(({ data }) => Number.isFinite(Number(data.lat)) && Number.isFinite(Number(data.lng)));
  const visibleIds = new Set(located.map(({ id }) => id));
  markers.forEach((marker, id) => {
    if (!visibleIds.has(id)) {
      map.removeLayer(marker);
      markers.delete(id);
    }
  });

  located.forEach(({ id, data }) => {
    const position = [Number(data.lat), Number(data.lng)];
    let marker = markers.get(id);
    if (!marker) {
      marker = window.L.marker(position).addTo(map);
      markers.set(id, marker);
    } else {
      marker.setLatLng(position);
    }
    marker.bindPopup(makePopup(data));
  });

  renderDriverList(active.sort((left, right) => String(left.data.nombre || '').localeCompare(String(right.data.nombre || ''), 'es')));
};

const listenForDrivers = () => {
  if (stopDriverListener) stopDriverListener();
  setAdminStatus('Escuchando repartidores…');
  stopDriverListener = onValue(ref(db, 'drivers'), snapshot => {
    renderDrivers(snapshot);
    setAdminStatus('Datos en tiempo real', 'success');
    uidCard.hidden = true;
  }, error => {
    console.error('Firebase denegó o interrumpió la lectura de drivers:', error);
    uidCard.hidden = false;
    setAdminStatus('Firebase no autorizó la lectura.', 'error');
    const empty = document.createElement('li');
    empty.className = 'driver-list-empty';
    empty.textContent = 'Para autorizar este administrador, agrega admins/UID = true en Firebase Realtime Database y pulsa Reintentar.';
    driverList.replaceChildren(empty);
  });
};

const connectAdmin = async () => {
  if (!firebaseConfigured) {
    setLockMessage(`Completa en firebase-config.js: ${missingFirebaseFields.join(', ')}.`, 'error');
    return;
  }

  lockScreen.hidden = true;
  dashboard.hidden = false;
  try {
    ensureMap();
    const user = await getAnonymousUser();
    adminUid = user.uid;
    uidText.textContent = adminUid;
    uidCard.hidden = false;
    listenForDrivers();
  } catch (error) {
    console.error('No se pudo conectar el panel de administración:', error);
    setAdminStatus('No se pudo conectar con Firebase.', 'error');
  }
};

lockForm.addEventListener('submit', async event => {
  event.preventDefault();
  const pin = document.getElementById('admin-pin').value;
  if (pin !== ADMIN_PIN) {
    setLockMessage('PIN incorrecto.');
    return;
  }

  sessionStorage.setItem(PIN_SESSION_KEY, 'true');
  await connectAdmin();
});

document.getElementById('admin-lock-button').addEventListener('click', () => {
  sessionStorage.removeItem(PIN_SESSION_KEY);
  if (stopDriverListener) {
    stopDriverListener();
    stopDriverListener = null;
  }
  markers.forEach(marker => map.removeLayer(marker));
  markers.clear();
  driverList.replaceChildren();
  dashboard.hidden = true;
  lockScreen.hidden = false;
  document.getElementById('admin-pin').value = '';
  setLockMessage('Panel bloqueado.', 'success');
});

document.getElementById('copy-admin-uid').addEventListener('click', async () => {
  if (!adminUid) return;
  try {
    await navigator.clipboard.writeText(adminUid);
    setAdminStatus('UID copiado.', 'success');
  } catch (error) {
    console.error('No se pudo copiar el UID:', error);
    setAdminStatus('No se pudo copiar. Selecciona el UID y cópialo manualmente.', 'error');
  }
});

document.getElementById('retry-admin-read').addEventListener('click', listenForDrivers);

if (sessionStorage.getItem(PIN_SESSION_KEY) === 'true') {
  await connectAdmin();
} else if (!firebaseConfigured) {
  setLockMessage(`Falta configurar en firebase-config.js: ${missingFirebaseFields.join(', ')}.`, 'warning');
}
