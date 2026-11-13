import { onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { onDisconnect, onValue, ref, serverTimestamp, set, update } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
import { auth, db, firebaseConfigured, missingFirebaseFields } from './firebase-config.js';

const form = document.getElementById('driver-form');
const toggleButton = document.getElementById('driver-toggle');
const message = document.getElementById('driver-message');
const liveIndicator = document.getElementById('gps-live');
const coordinates = document.getElementById('gps-coordinates');
const stateInput = document.getElementById('driver-state');

let shiftActive = false;
let driverRef = null;
let watchId = null;
let wakeLock = null;
let stopStateListener = null;

const setMessage = (text, kind = 'info') => {
  message.textContent = text;
  message.dataset.kind = kind;
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

  shiftActive = false;
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (stopStateListener) {
    stopStateListener();
    stopStateListener = null;
  }
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
    driverRef = ref(db, `drivers/${user.uid}`);
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

    shiftActive = true;
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
    toggleButton.textContent = 'Iniciar Turno y Activar GPS';
    toggleButton.disabled = false;
    setMessage('No se pudo iniciar. Comprueba Firebase, el permiso GPS y la conexión.', 'error');
  }
};

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (shiftActive) {
    await endShift();
    return;
  }
  if (!form.reportValidity()) return;
  await startShift();
});

stateInput.addEventListener('change', async () => {
  if (!shiftActive || !driverRef) return;
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
