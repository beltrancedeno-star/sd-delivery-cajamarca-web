import { onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { equalTo, onDisconnect, onValue, orderByChild, query, ref, serverTimestamp, set, update } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
import { auth, db, firebaseConfigured, missingFirebaseFields } from './firebase-config.js';

const form = document.getElementById('driver-form');
const toggleButton = document.getElementById('driver-toggle');
const message = document.getElementById('driver-message');
const liveIndicator = document.getElementById('gps-live');
const coordinates = document.getElementById('gps-coordinates');
const stateInput = document.getElementById('driver-state');
const orderPanel = document.getElementById('driver-orders-panel');
const orderList = document.getElementById('driver-order-list');
const ACTIVE_ORDER_STATES = new Set(['Asignado', 'En reparto']);

let shiftActive = false;
let driverRef = null;
let watchId = null;
let wakeLock = null;
let stopStateListener = null;
let stopOrderListener = null;
let assignedOrders = {};
let driverUid = null;

const setMessage = (text, kind = 'info') => {
  message.textContent = text;
  message.dataset.kind = kind;
};

const hasActiveOrder = () => Object.values(assignedOrders).some(order =>
  order && ACTIVE_ORDER_STATES.has(order.status)
);

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

const acquireWakeLock = async () => {
  if (!('wakeLock' in navigator)) {
    setMessage('Turno activo. Este navegador no admite mantener la pantalla encendida.', 'warning');
    return;
  }

  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    }, { once: true });
  } catch (error) {
    console.error('No se pudo activar el bloqueo de pantalla:', error);
    setMessage('El GPS está activo, pero el navegador no permitió mantener la pantalla encendida.', 'warning');
  }
};

const releaseWakeLock = async () => {
  if (!wakeLock) return;
  const lock = wakeLock;
  wakeLock = null;
  try {
    await lock.release();
  } catch (error) {
    console.error('No se pudo liberar el bloqueo de pantalla:', error);
  }
};

const endShift = async (reason = 'Turno finalizado.', kind = 'success') => {
  if (!driverRef || !shiftActive) return;

  const pendingOrder = hasActiveOrder();
  shiftActive = false;
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (stopStateListener) {
    stopStateListener();
    stopStateListener = null;
  }
  if (stopOrderListener && !pendingOrder) {
    stopOrderListener();
    stopOrderListener = null;
  }
  if (!pendingOrder) assignedOrders = {};
  orderPanel.hidden = !pendingOrder;
  await releaseWakeLock();

  try {
    await update(driverRef, {
      activo: false,
      lat: null,
      lng: null,
      ultimaActualizacion: serverTimestamp()
    });
    await onDisconnect(driverRef).cancel();
    setMessage(reason, kind);
  } catch (error) {
    console.error('No se pudo cerrar el turno en Firebase:', error);
    setMessage('El GPS local se detuvo, pero no se pudo confirmar el cierre en Firebase. Revisa la conexión.', 'error');
  }

  liveIndicator.hidden = true;
  coordinates.textContent = 'Coordenadas: turno finalizado';
  toggleButton.textContent = 'Iniciar Turno y Activar GPS';
  toggleButton.disabled = false;
};

const handlePosition = async position => {
  if (!shiftActive || !driverRef) return;

  const { latitude, longitude } = position.coords;
  coordinates.textContent = `Coordenadas: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  try {
    await update(driverRef, {
      lat: latitude,
      lng: longitude,
      ultimaActualizacion: serverTimestamp()
    });
    setMessage('Ubicación actualizada correctamente.', 'success');
  } catch (error) {
    console.error('No se pudo transmitir la ubicación:', error);
    setMessage('No se pudo enviar la ubicación. Revisa tu conexión y los permisos de Firebase.', 'error');
  }
};

const handlePositionError = async error => {
  const reasons = {
    1: 'No se concedió permiso de ubicación. El turno se cerrará.',
    2: 'No se pudo determinar tu ubicación. El turno se cerrará.',
    3: 'Se agotó el tiempo para obtener ubicación. El turno se cerrará.'
  };
  await endShift(reasons[error.code] || 'Falló el GPS. El turno se cerrará.', 'error');
};

const updateOrderStatus = async (orderId, action) => {
  const order = assignedOrders[orderId];
  if (!order || !driverUid) return;

  const nextStatus = {
    accept: order.status === 'Asignado' ? 'En reparto' : null,
    reject: order.status === 'Asignado' ? 'Rechazado' : null,
    complete: order.status === 'En reparto' ? 'Entregado' : null
  }[action];
  if (!nextStatus) return;

  const updates = {
    [`orders/${orderId}/status`]: nextStatus,
    [`orders/${orderId}/updatedAt`]: serverTimestamp()
  };
  if (action === 'reject' || action === 'complete') {
    updates[`orders/${orderId}/driverUid`] = '';
    updates[`drivers/${driverUid}/estado`] = 'Disponible';
  }

  try {
    await update(ref(db), updates);
    setMessage(
      action === 'reject' ? 'Pedido rechazado. Ya puedes recibir otra asignación.'
        : action === 'complete' ? 'Entrega completada.'
          : 'Pedido aceptado. Estado actualizado a En reparto.',
      'success'
    );
  } catch (error) {
    console.error('No se pudo actualizar el pedido asignado:', error);
    setMessage('No se pudo actualizar el pedido. Comprueba la conexión e inténtalo de nuevo.', 'error');
  }
};

const renderAssignedOrders = () => {
  const orders = Object.entries(assignedOrders)
    .filter(([, order]) => order && ACTIVE_ORDER_STATES.has(order.status));
  orderList.replaceChildren();

  if (!orders.length) {
    const empty = document.createElement('li');
    empty.className = 'driver-list-empty';
    empty.textContent = 'No tienes pedidos asignados.';
    orderList.append(empty);
    return;
  }

  orders.forEach(([id, order]) => {
    const item = document.createElement('li');
    item.className = 'driver-order-card';

    const title = document.createElement('h3');
    title.textContent = `${order.store || 'Pedido'} · #${id.slice(-6).toUpperCase()}`;
    const status = document.createElement('p');
    status.className = 'driver-order-status';
    status.dataset.status = order.status;
    status.textContent = `Estado: ${order.status}`;
    const customer = document.createElement('p');
    customer.textContent = `Cliente: ${order.customerName || '—'} · ${order.phone || '—'}`;
    const details = document.createElement('p');
    details.textContent = `Pedido: ${order.items || '—'}`;
    const address = document.createElement('p');
    address.textContent = `Entrega: ${order.address || '—'}`;
    item.append(title, status, customer, details, address);
    if (order.payment) {
      const payment = document.createElement('p');
      payment.textContent = `Pago: ${order.payment}`;
      item.append(payment);
    }
    if (order.fare) {
      const fare = document.createElement('p');
      fare.textContent = `Tarifa: ${order.fare}`;
      item.append(fare);
    }
    if (order.notes) {
      const notes = document.createElement('p');
      notes.textContent = `Notas: ${order.notes}`;
      item.append(notes);
    }

    const phone = String(order.phone || '').replace(/\D/g, '');
    if (phone.length >= 7 && phone.length <= 15) {
      const contact = document.createElement('a');
      contact.className = 'driver-whatsapp';
      contact.href = `https://wa.me/${phone.startsWith('51') ? phone : `51${phone}`}`;
      contact.target = '_blank';
      contact.rel = 'noopener noreferrer';
      contact.textContent = 'Contactar cliente';
      item.append(contact);
    }

    const actions = document.createElement('div');
    actions.className = 'driver-order-actions';
    const addAction = (action, label, className = '') => {
      const button = document.createElement('button');
      button.className = `driver-order-action-button ${className}`.trim();
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', async () => {
        actions.querySelectorAll('button').forEach(actionButton => {
          actionButton.disabled = true;
        });
        await updateOrderStatus(id, action);
        if (actions.isConnected) {
          actions.querySelectorAll('button').forEach(actionButton => {
            actionButton.disabled = false;
          });
        }
      });
      actions.append(button);
    };

    if (order.status === 'Asignado') {
      addAction('accept', 'Aceptar pedido');
      addAction('reject', 'Rechazar pedido', 'driver-order-reject');
    } else {
      addAction('complete', 'Marcar como entregado');
    }
    item.append(actions);
    orderList.append(item);
  });
};

const listenForAssignedOrders = uid => {
  if (stopOrderListener) stopOrderListener();
  const assignedQuery = query(ref(db, 'orders'), orderByChild('driverUid'), equalTo(uid));
  stopOrderListener = onValue(assignedQuery, snapshot => {
    assignedOrders = snapshot.val() || {};
    renderAssignedOrders();
    if (hasActiveOrder() && stateInput.value !== 'En reparto') {
      stateInput.value = 'En reparto';
      if (shiftActive && driverRef) {
        update(driverRef, {
          estado: 'En reparto',
          ultimaActualizacion: serverTimestamp()
        }).catch(error => {
          console.error('No se pudo mantener ocupado al repartidor con un pedido activo:', error);
          setMessage('Hay un pedido activo, pero no se pudo actualizar tu estado.', 'error');
        });
      }
    }
  }, error => {
    console.error('No se pudieron cargar los pedidos asignados:', error);
    orderList.replaceChildren();
    const unavailable = document.createElement('li');
    unavailable.className = 'driver-list-empty';
    unavailable.textContent = 'No se pudieron cargar tus pedidos. Comprueba los permisos de Firebase.';
    orderList.append(unavailable);
    setMessage('No se pudieron cargar los pedidos asignados.', 'error');
  });
};

const startShift = async () => {
  if (!firebaseConfigured) {
    setMessage(`Falta configurar en firebase-config.js: ${missingFirebaseFields.join(', ')}.`, 'error');
    return;
  }

  if (!window.isSecureContext) {
    setMessage('No se pudo abrir la versión segura. Entra por https://sddelivery.online/driver para activar el GPS.', 'error');
    return;
  }

  if (!navigator.geolocation) {
    setMessage('Este navegador no ofrece geolocalización.', 'error');
    return;
  }

  const name = document.getElementById('driver-name').value.trim();
  const plate = document.getElementById('driver-plate').value.trim().toUpperCase();
  const phone = document.getElementById('driver-phone').value.trim();
  const phoneDigits = phone.replace(/\D/g, '');

  if (name.length < 2 || plate.length < 3 || phoneDigits.length < 7 || phoneDigits.length > 15) {
    setMessage('Revisa el nombre, la placa y el número de WhatsApp antes de iniciar.', 'error');
    return;
  }

  toggleButton.disabled = true;
  setMessage('Conectando con Firebase…');

  try {
    const user = await getAnonymousUser();
    driverUid = user.uid;
    driverRef = ref(db, `drivers/${user.uid}`);
    if (hasActiveOrder()) stateInput.value = 'En reparto';
    const record = {
      nombre: name,
      placa: plate,
      telefono: phone,
      estado: stateInput.value,
      activo: true,
      inicioTurno: serverTimestamp(),
      ultimaActualizacion: serverTimestamp()
    };

    await onDisconnect(driverRef).update({
      activo: false,
      lat: null,
      lng: null,
      ultimaActualizacion: serverTimestamp()
    });
    await set(driverRef, record);
    stopStateListener = onValue(ref(db, `drivers/${user.uid}/estado`), snapshot => {
      const status = snapshot.val();
      if (['Disponible', 'En reparto', 'En pausa'].includes(status)) {
        stateInput.value = status;
      }
    }, error => {
      console.error('No se pudo sincronizar el estado del repartidor:', error);
    });
    listenForAssignedOrders(user.uid);

    shiftActive = true;
    orderPanel.hidden = false;
    liveIndicator.hidden = false;
    coordinates.textContent = 'Coordenadas: esperando primera señal GPS…';
    toggleButton.textContent = 'Finalizar Turno';
    toggleButton.disabled = false;
    setMessage('Turno iniciado. Esperando señal GPS…');
    watchId = navigator.geolocation.watchPosition(handlePosition, handlePositionError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 20000
    });
    await acquireWakeLock();
  } catch (error) {
    console.error('No se pudo iniciar el turno:', error);
    if (driverRef) {
      try {
        await update(driverRef, {
          activo: false,
          ultimaActualizacion: serverTimestamp()
        });
      } catch (cleanupError) {
        console.error('No se pudo revertir el registro parcial del turno:', cleanupError);
      }
    }
    driverRef = null;
    shiftActive = false;
    if (stopStateListener) {
      stopStateListener();
      stopStateListener = null;
    }
    if (stopOrderListener) {
      stopOrderListener();
      stopOrderListener = null;
    }
    assignedOrders = {};
    orderPanel.hidden = true;
    toggleButton.textContent = 'Iniciar Turno y Activar GPS';
    toggleButton.disabled = false;
    setMessage('No se pudo iniciar. Comprueba Firebase, el permiso GPS y la conexión.', 'error');
  }
};

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (shiftActive) {
    if (hasActiveOrder()) {
      setMessage('Primero acepta, rechaza o completa tu pedido activo antes de finalizar el turno.', 'warning');
      return;
    }
    await endShift();
    return;
  }
  if (!form.reportValidity()) return;
  await startShift();
});

stateInput.addEventListener('change', async () => {
  if (!shiftActive || !driverRef) return;
  if (hasActiveOrder() && stateInput.value !== 'En reparto') {
    stateInput.value = 'En reparto';
    setMessage('Tu estado se mantiene en En reparto mientras tengas un pedido activo.', 'warning');
    return;
  }
  try {
    await update(driverRef, {
      estado: stateInput.value,
      ultimaActualizacion: serverTimestamp()
    });
    setMessage('Estado actualizado.', 'success');
  } catch (error) {
    console.error('No se pudo actualizar el estado:', error);
    setMessage('No se pudo actualizar el estado en Firebase.', 'error');
  }
});

document.addEventListener('visibilitychange', async () => {
  if (shiftActive && document.visibilityState === 'visible' && !wakeLock) {
    await acquireWakeLock();
  }
});

window.addEventListener('pagehide', () => {
  if (!shiftActive || !driverRef) return;
  update(driverRef, {
    activo: false,
    lat: null,
    lng: null,
    ultimaActualizacion: serverTimestamp()
  }).catch(error => console.error('El cierre se completará con onDisconnect:', error));
});

if (!firebaseConfigured) {
  setMessage(`Para conectar Firebase, completa: ${missingFirebaseFields.join(', ')} en firebase-config.js.`, 'warning');
}
