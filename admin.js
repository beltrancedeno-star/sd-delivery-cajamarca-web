import { onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { onValue, push, ref, serverTimestamp, set, update } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
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
const driverWorkspace = document.querySelector('.admin-workspace');
const ordersWorkspace = document.getElementById('admin-orders-workspace');
const orderForm = document.getElementById('admin-order-form');
const orderMessage = document.getElementById('admin-order-message');
const orderDriverInput = document.getElementById('order-driver');
const orderList = document.getElementById('admin-order-list');
const markers = new Map();
const ACTIVE_ORDER_STATES = new Set(['Asignado', 'En reparto']);
let map = null;
let stopDriverListener = null;
let stopOrderListener = null;
let adminUid = null;
let driverSnapshot = null;
let driverRecords = {};
let orderRecords = {};

const setLockMessage = (text, kind = 'error') => {
  lockMessage.textContent = text;
  lockMessage.dataset.kind = kind;
};

const setAdminStatus = (text, kind = 'info') => {
  adminStatus.textContent = text;
  adminStatus.dataset.kind = kind;
};

const setOrderMessage = (text, kind = 'info') => {
  orderMessage.textContent = text;
  orderMessage.dataset.kind = kind;
};

const hasActiveOrder = driverId => Object.values(orderRecords).some(order =>
  order && order.driverUid === driverId && ACTIVE_ORDER_STATES.has(order.status)
);

const getAvailableDrivers = () => Object.entries(driverRecords)
  .filter(([id, driver]) => driver
    && driver.activo === true
    && driver.estado === 'Disponible'
    && !hasActiveOrder(id))
  .sort((left, right) => String(left[1].nombre || '').localeCompare(String(right[1].nombre || ''), 'es'));

const updateOrderDriverOptions = () => {
  const selectedUid = orderDriverInput.value;
  orderDriverInput.replaceChildren(new Option('Guardar sin asignar', ''));
  getAvailableDrivers().forEach(([id, driver]) => {
    orderDriverInput.add(new Option(`${driver.nombre || 'Repartidor'} · ${driver.placa || 'Sin placa'}`, id));
  });
  if (Array.from(orderDriverInput.options).some(option => option.value === selectedUid)) {
    orderDriverInput.value = selectedUid;
  }
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
    empty.textContent = 'Aún no hay repartidores registrados.';
    driverList.append(empty);
    return;
  }

  drivers.forEach(({ id, data }) => {
    const row = document.createElement('li');
    row.className = 'driver-row';
    const isActive = data.activo === true;
    const ageSeconds = (Date.now() - Number(data.ultimaActualizacion || 0)) / 1000;
    row.dataset.stale = String(!Number.isFinite(ageSeconds) || ageSeconds > 120);
    row.dataset.active = String(isActive);

    const heading = document.createElement('div');
    heading.className = 'driver-row-heading';
    const name = document.createElement('span');
    name.className = 'driver-row-name';
    name.textContent = data.nombre || 'Repartidor';
    const plate = document.createElement('span');
    plate.className = 'driver-row-plate';
    plate.textContent = data.placa || 'Sin placa';
    heading.append(name, plate);

    const connection = document.createElement('p');
    connection.className = 'driver-row-connection';
    connection.dataset.active = String(isActive);
    connection.textContent = isActive ? 'Turno activo' : 'Fuera de turno';

    const state = document.createElement('p');
    state.className = 'driver-row-state';
    state.dataset.state = data.estado || '';
    state.textContent = data.estado || 'Estado desconocido';

    const signal = document.createElement('p');
    signal.className = 'driver-row-signal';
    signal.textContent = `Última señal ${signalAge(data.ultimaActualizacion)}`;
    row.append(heading, connection, state, signal);

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

    const activeOrder = Object.values(orderRecords).find(order =>
      order && order.driverUid === id && ACTIVE_ORDER_STATES.has(order.status)
    );
    if (activeOrder) {
      const assigned = document.createElement('p');
      assigned.className = 'driver-row-signal';
      assigned.textContent = `Pedido activo: ${activeOrder.store || 'Pedido'} (${activeOrder.status})`;
      row.append(assigned);
    } else if (isActive) {
      const nextState = data.estado === 'En reparto' ? 'Disponible' : 'En reparto';
      const statusButton = document.createElement('button');
      statusButton.className = 'driver-status-button';
      statusButton.dataset.nextState = nextState;
      statusButton.type = 'button';
      statusButton.textContent = nextState === 'En reparto' ? 'Marcar ocupado' : 'Liberar repartidor';
      statusButton.setAttribute('aria-label', `${statusButton.textContent}: ${data.nombre || 'repartidor'}`);
      statusButton.addEventListener('click', async () => {
        statusButton.disabled = true;
        try {
          await set(ref(db, `drivers/${id}/estado`), nextState);
          setAdminStatus(`${data.nombre || 'El repartidor'} ahora está ${nextState.toLowerCase()}.`, 'success');
        } catch (error) {
          console.error(`No se pudo cambiar el estado de ${data.nombre || id}:`, error);
          setAdminStatus('No se pudo cambiar el estado. Comprueba los permisos y la conexión.', 'error');
          statusButton.disabled = false;
        }
      });
      row.append(statusButton);
    }

    driverList.append(row);
  });
};

const renderDrivers = snapshot => {
  driverSnapshot = snapshot;
  const records = snapshot.val() || {};
  driverRecords = records;
  const entries = Object.entries(records)
    .map(([id, data]) => ({ id, data: data || {} }))
    .filter(({ data }) => typeof data.nombre === 'string' && typeof data.placa === 'string');
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const active = entries.filter(({ data }) => data.activo === true);
  const todayCount = active.filter(({ data }) => Number(data.inicioTurno) >= startOfDay.getTime()).length;
  const availableCount = active.filter(({ id, data }) => data.estado === 'Disponible' && !hasActiveOrder(id)).length;
  const deliveryCount = active.filter(({ data }) => data.estado === 'En reparto').length;

  document.getElementById('count-today').textContent = String(todayCount);
  document.getElementById('count-available').textContent = String(availableCount);
  document.getElementById('count-delivery').textContent = String(deliveryCount);

  const located = active.filter(({ data }) => Number.isFinite(data.lat) && Number.isFinite(data.lng));
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

  renderDriverList(entries.sort((left, right) => String(left.data.nombre || '').localeCompare(String(right.data.nombre || ''), 'es')));
};

const assignOrder = async (orderId, driverId) => {
  const order = orderRecords[orderId];
  const driver = driverRecords[driverId];
  if (!order || !['Pendiente', 'Rechazado'].includes(order.status)) return;
  if (!driver || driver.activo !== true || driver.estado !== 'Disponible' || hasActiveOrder(driverId)) {
    setAdminStatus('Ese repartidor ya no está disponible. Actualiza la lista e intenta de nuevo.', 'error');
    return;
  }

  const updates = {
    [`orders/${orderId}/status`]: 'Asignado',
    [`orders/${orderId}/driverUid`]: driverId,
    [`orders/${orderId}/driverName`]: driver.nombre || 'Repartidor',
    [`orders/${orderId}/assignedAt`]: serverTimestamp(),
    [`orders/${orderId}/updatedAt`]: serverTimestamp(),
    [`drivers/${driverId}/estado`]: 'En reparto'
  };

  try {
    await update(ref(db), updates);
    setAdminStatus(`Pedido asignado a ${driver.nombre || 'un repartidor'}.`, 'success');
  } catch (error) {
    console.error('No se pudo asignar el pedido:', error);
    setAdminStatus('No se pudo asignar el pedido. Comprueba los permisos y la conexión.', 'error');
  }
};

const cancelOrder = async orderId => {
  const order = orderRecords[orderId];
  if (!order || ['Entregado', 'Cancelado'].includes(order.status)) return;

  const updates = {
    [`orders/${orderId}/status`]: 'Cancelado',
    [`orders/${orderId}/driverUid`]: '',
    [`orders/${orderId}/updatedAt`]: serverTimestamp()
  };
  if (order.driverUid && ACTIVE_ORDER_STATES.has(order.status)) {
    updates[`drivers/${order.driverUid}/estado`] = 'Disponible';
  }

  try {
    await update(ref(db), updates);
    setAdminStatus('Pedido cancelado.', 'success');
  } catch (error) {
    console.error('No se pudo cancelar el pedido:', error);
    setAdminStatus('No se pudo cancelar el pedido. Comprueba los permisos y la conexión.', 'error');
  }
};

const renderOrderList = () => {
  const orders = Object.entries(orderRecords)
    .filter(([, order]) => order && typeof order.store === 'string')
    .sort((left, right) => Number(right[1].createdAt || 0) - Number(left[1].createdAt || 0));
  orderList.replaceChildren();

  if (!orders.length) {
    const empty = document.createElement('li');
    empty.className = 'driver-list-empty';
    empty.textContent = 'Todavía no hay pedidos registrados.';
    orderList.append(empty);
    return;
  }

  orders.forEach(([id, order]) => {
    const item = document.createElement('li');
    item.className = 'admin-order-card';

    const heading = document.createElement('div');
    heading.className = 'admin-order-heading';
    const title = document.createElement('strong');
    title.textContent = `${order.store} · #${id.slice(-6).toUpperCase()}`;
    const status = document.createElement('span');
    status.className = 'admin-order-status';
    status.dataset.status = order.status || '';
    status.textContent = order.status || 'Estado desconocido';
    heading.append(title, status);
    item.append(heading);

    const customer = document.createElement('p');
    customer.textContent = `Cliente: ${order.customerName || '—'} · ${order.phone || '—'}`;
    const items = document.createElement('p');
    items.textContent = `Pedido: ${order.items || '—'}`;
    const address = document.createElement('p');
    address.textContent = `Entrega: ${order.address || '—'}`;
    const assignment = document.createElement('p');
    assignment.textContent = `Repartidor: ${order.driverName || 'Sin asignar'}`;
    const payment = document.createElement('p');
    payment.textContent = `Pago: ${order.payment || '—'} · Tarifa: ${order.fare || '—'}`;
    const created = document.createElement('p');
    created.className = 'admin-order-meta';
    const timestamp = Number(order.createdAt);
    created.textContent = Number.isFinite(timestamp) && timestamp > 0
      ? `Registrado: ${new Date(timestamp).toLocaleString('es-PE')}`
      : 'Fecha no disponible';
    item.append(customer, items, address, payment, assignment, created);
    if (order.notes) {
      const notes = document.createElement('p');
      notes.textContent = `Notas: ${order.notes}`;
      item.append(notes);
    }

    if (order.phone) {
      const digits = String(order.phone).replace(/\D/g, '');
      if (digits.length >= 7 && digits.length <= 15) {
        const whatsapp = document.createElement('a');
        whatsapp.className = 'driver-whatsapp';
        whatsapp.href = `https://wa.me/${digits.startsWith('51') ? digits : `51${digits}`}`;
        whatsapp.target = '_blank';
        whatsapp.rel = 'noopener noreferrer';
        whatsapp.textContent = 'Contactar cliente';
        item.append(whatsapp);
      }
    }

    if (['Pendiente', 'Rechazado'].includes(order.status)) {
      const assignmentControls = document.createElement('div');
      assignmentControls.className = 'admin-order-actions';
      const select = document.createElement('select');
      select.className = 'admin-order-driver-select';
      select.setAttribute('aria-label', `Repartidor para pedido de ${order.customerName || 'cliente'}`);
      select.add(new Option('Selecciona un repartidor', ''));
      getAvailableDrivers().forEach(([driverId, driver]) => {
        select.add(new Option(`${driver.nombre || 'Repartidor'} · ${driver.placa || 'Sin placa'}`, driverId));
      });
      const assignButton = document.createElement('button');
      assignButton.className = 'admin-order-action-button';
      assignButton.type = 'button';
      assignButton.textContent = 'Asignar';
      assignButton.disabled = select.options.length < 2;
      assignButton.addEventListener('click', async () => {
        if (!select.value) return;
        assignButton.disabled = true;
        await assignOrder(id, select.value);
        if (assignButton.isConnected) assignButton.disabled = false;
      });
      assignmentControls.append(select, assignButton);
      item.append(assignmentControls);
    }

    if (!['Entregado', 'Cancelado'].includes(order.status)) {
      const cancelButton = document.createElement('button');
      cancelButton.className = 'admin-order-action-button admin-order-cancel';
      cancelButton.type = 'button';
      cancelButton.textContent = 'Cancelar pedido';
      cancelButton.addEventListener('click', async () => {
        cancelButton.disabled = true;
        await cancelOrder(id);
        if (cancelButton.isConnected) cancelButton.disabled = false;
      });
      item.append(cancelButton);
    }

    orderList.append(item);
  });
};

const listenForOrders = () => {
  if (stopOrderListener) stopOrderListener();
  stopOrderListener = onValue(ref(db, 'orders'), snapshot => {
    orderRecords = snapshot.val() || {};
    renderOrderList();
    updateOrderDriverOptions();
    if (driverSnapshot) renderDrivers(driverSnapshot);
  }, error => {
    console.error('Firebase denegó o interrumpió la lectura de pedidos:', error);
    setAdminStatus('No se pudieron cargar los pedidos.', 'error');
    const empty = document.createElement('li');
    empty.className = 'driver-list-empty';
    empty.textContent = 'Firebase no autorizó la lectura de pedidos. Revisa las reglas de la base de datos.';
    orderList.replaceChildren(empty);
  });
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

orderForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!orderForm.reportValidity()) return;

  const phone = document.getElementById('order-phone').value.trim();
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 7 || phoneDigits.length > 15) {
    setOrderMessage('Ingresa un número de WhatsApp válido, de 7 a 15 dígitos.', 'error');
    return;
  }

  const driverId = orderDriverInput.value;
  const driver = driverId ? driverRecords[driverId] : null;
  if (driverId && (!driver || driver.activo !== true || driver.estado !== 'Disponible' || hasActiveOrder(driverId))) {
    setOrderMessage('El repartidor seleccionado ya no está disponible. Actualiza la lista.', 'error');
    updateOrderDriverOptions();
    return;
  }

  const orderRef = push(ref(db, 'orders'));
  const value = id => document.getElementById(id).value.trim();
  const order = {
    store: value('order-store'),
    customerName: value('order-customer-name'),
    phone,
    items: value('order-items'),
    address: value('order-address'),
    payment: value('order-payment'),
    fare: value('order-fare'),
    notes: value('order-notes'),
    status: driverId ? 'Asignado' : 'Pendiente',
    driverUid: driverId,
    driverName: driver ? driver.nombre || 'Repartidor' : '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: adminUid
  };
  if (driverId) order.assignedAt = serverTimestamp();
  const updates = {
    [`orders/${orderRef.key}`]: order
  };
  if (driverId) updates[`drivers/${driverId}/estado`] = 'En reparto';

  const submitButton = orderForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    await update(ref(db), updates);
    orderForm.reset();
    updateOrderDriverOptions();
    setOrderMessage(driverId ? 'Pedido guardado y asignado.' : 'Pedido guardado como pendiente de asignación.', 'success');
  } catch (error) {
    console.error('No se pudo guardar el pedido:', error);
    setOrderMessage('No se pudo guardar. Comprueba los permisos y la conexión.', 'error');
  } finally {
    submitButton.disabled = false;
  }
});

document.getElementById('show-drivers-view').addEventListener('click', () => {
  driverWorkspace.hidden = false;
  ordersWorkspace.hidden = true;
  document.getElementById('show-drivers-view').setAttribute('aria-pressed', 'true');
  document.getElementById('show-orders-view').setAttribute('aria-pressed', 'false');
  if (map) map.invalidateSize();
});

document.getElementById('show-orders-view').addEventListener('click', () => {
  driverWorkspace.hidden = true;
  ordersWorkspace.hidden = false;
  document.getElementById('show-drivers-view').setAttribute('aria-pressed', 'false');
  document.getElementById('show-orders-view').setAttribute('aria-pressed', 'true');
  updateOrderDriverOptions();
});

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
    listenForOrders();
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
  if (stopOrderListener) {
    stopOrderListener();
    stopOrderListener = null;
  }
  markers.forEach(marker => map.removeLayer(marker));
  markers.clear();
  driverList.replaceChildren();
  orderList.replaceChildren();
  orderRecords = {};
  driverRecords = {};
  driverSnapshot = null;
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

document.getElementById('retry-admin-read').addEventListener('click', () => {
  listenForDrivers();
  listenForOrders();
});

if (sessionStorage.getItem(PIN_SESSION_KEY) === 'true') {
  await connectAdmin();
} else if (!firebaseConfigured) {
  setLockMessage(`Falta configurar en firebase-config.js: ${missingFirebaseFields.join(', ')}.`, 'warning');
}
