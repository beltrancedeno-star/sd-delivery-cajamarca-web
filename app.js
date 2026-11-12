/* ============================================================
   SD Delivery — app.js
   Interactions: Navbar, Scroll Reveal, Counter, Form, Mobile Menu
   ============================================================ */

'use strict';

const isValidPhoneNumber = value => {
  const phone = value.trim();
  const digits = phone.replace(/\D/g, '');
  return /^\+?[\d\s()-]+$/.test(phone) && digits.length >= 7 && digits.length <= 15;
};

// ---- NAVBAR SCROLL ----
(function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  const onScroll = () => {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // initial
})();

// ---- MOBILE MENU ----
(function initMobileMenu() {
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const mobileMenu   = document.getElementById('mobile-menu');
  if (!hamburgerBtn || !mobileMenu) return;

  let isOpen = false;

  const toggle = () => {
    isOpen = !isOpen;
    hamburgerBtn.classList.toggle('active', isOpen);
    hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
    mobileMenu.classList.toggle('open', isOpen);
    mobileMenu.setAttribute('aria-hidden', String(!isOpen));
  };

  hamburgerBtn.addEventListener('click', toggle);

  // Close on link click
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      if (isOpen) toggle();
    });
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (isOpen && !hamburgerBtn.contains(e.target) && !mobileMenu.contains(e.target)) {
      toggle();
    }
  });
})();

// ---- SMOOTH SCROLL for nav links ----
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    const offset = 80; // navbar height
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    window.scrollTo({ top, behavior });
  });
});

// ---- SCROLL REVEAL ----
(function initScrollReveal() {
  const elements = document.querySelectorAll('[data-reveal], [data-reveal-right]');
  if (!elements.length) return;

  if (!window.IntersectionObserver) {
    // Fallback: show all
    elements.forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -50px 0px'
  });

  elements.forEach(el => observer.observe(el));
})();

// ---- ANIMATED COUNTERS ----
(function initCounters() {
  const statItems = document.querySelectorAll('.stat-item[data-counter]');
  if (!statItems.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    statItems.forEach(el => {
      const counter = el.querySelector('.counter');
      if (counter) counter.textContent = el.dataset.counter;
    });
    return;
  }

  const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

  const animateCounter = (el) => {
    const target  = parseInt(el.dataset.counter, 10);
    const counter = el.querySelector('.counter');
    if (!counter) return;

    const duration = 1800;
    const startTime = performance.now();

    const tick = (now) => {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const value    = Math.round(easeOutQuart(progress) * target);
      counter.textContent = value;
      if (progress < 1) requestAnimationFrame(tick);
      else counter.textContent = target;
    };

    requestAnimationFrame(tick);
  };

  if (!window.IntersectionObserver) {
    statItems.forEach(animateCounter);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  statItems.forEach(el => observer.observe(el));
})();

// ---- PARTNER FORM ----
(function initPartnerForm() {
  const form    = document.getElementById('partner-form');
  const success = document.getElementById('form-success');
  if (!form || !success) return;
  const status = document.getElementById('partner-submit-status');
  const fallback = document.getElementById('partner-whatsapp-fallback');

  const showError = (input, msg) => {
    input.style.borderColor = 'var(--clr-red)';
    let err = input.parentNode.querySelector('.form-error-msg');
    if (!err) {
      err = document.createElement('span');
      err.className = 'form-error-msg';
      err.style.cssText = 'font-size:0.75rem;color:var(--clr-red);margin-top:2px;display:block;';
      input.parentNode.appendChild(err);
    }
    err.textContent = msg;
  };

  const clearError = (input) => {
    input.style.borderColor = '';
    const err = input.parentNode.querySelector('.form-error-msg');
    if (err) err.remove();
  };

  const validate = () => {
    let valid = true;

    const businessName = form.querySelector('#business-name');
    const contactName  = form.querySelector('#contact-name');
    const phone        = form.querySelector('#phone');

    if (!businessName.value.trim()) {
      showError(businessName, 'El nombre del negocio es requerido');
      valid = false;
    } else { clearError(businessName); }

    if (!contactName.value.trim()) {
      showError(contactName, 'Tu nombre es requerido');
      valid = false;
    } else { clearError(contactName); }

    if (!phone.value.trim()) {
      showError(phone, 'El número de WhatsApp es requerido');
      valid = false;
    } else if (!isValidPhoneNumber(phone.value)) {
      showError(phone, 'Ingresa un número válido, de 7 a 15 dígitos');
      valid = false;
    } else { clearError(phone); }

    return valid;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate()) return;

    // Prepare the business inquiry for WhatsApp.
    const businessName = form.querySelector('#business-name').value;
    const contactName  = form.querySelector('#contact-name').value;
    const phone        = form.querySelector('#phone').value;
    const businessType = form.querySelector('#business-type').value;
    const message      = form.querySelector('#message').value;

    const waMsg = encodeURIComponent(
      `Hola SD Delivery! 👋\n` +
      `Quiero asociar mi negocio:\n` +
      `📦 Negocio: ${businessName}\n` +
      `👤 Contacto: ${contactName}\n` +
      `📱 Teléfono: ${phone}\n` +
      `🏪 Tipo: ${businessType || 'No especificado'}\n` +
      `💬 ${message || 'Sin comentarios adicionales.'}`
    );

    const whatsappUrl = `https://wa.me/51957107660?text=${waMsg}`;
    const opened = window.open(whatsappUrl, '_blank');
    if (opened) opened.opener = null;

    if (opened) {
      form.hidden = true;
      success.hidden = false;
      status.textContent = '';
      fallback.hidden = true;
    } else {
      status.textContent = 'WhatsApp no se abrió. Tus datos siguen en el formulario; puedes reintentar o usar este enlace.';
      fallback.href = whatsappUrl;
      fallback.hidden = false;
    }
  });

  // Live validation on blur
  form.querySelectorAll('.form-input[required]').forEach(input => {
    input.addEventListener('blur', () => {
      if (!input.value.trim()) {
        showError(input, 'Este campo es requerido');
      } else {
        clearError(input);
      }
    });
    input.addEventListener('input', () => {
      if (input.value.trim()) clearError(input);
    });
  });
})();

// ---- STORE SEARCH AND CATEGORY FILTERS ----
(function initStoreDirectory() {
  const grid = document.getElementById('stores-grid');
  const search = document.getElementById('store-search');
  const empty = document.getElementById('stores-empty');
  if (!grid || !search || !empty) return;

  const stores = [
    { name: '300 Burger', category: 'restaurant', label: 'Hamburguesas', image: '300-burger.jpg' },
    { name: 'Ajies', category: 'restaurant', label: 'Cevichería', image: 'ajies.png' },
    { name: 'Akore Pizza', category: 'pizza', label: 'Pizzería', image: 'akore.jpg' },
    { name: 'Bambino', category: 'cafe', label: 'Cafetería', image: 'bambino.png' },
    { name: 'Bembos', category: 'restaurant', label: 'Hamburguesas', image: 'bembos.png' },
    { name: 'BemxSport Sublimaciones', category: 'market', label: 'Personalización y sublimación', image: 'bemx-sport.png' },
    { name: 'Boticas Perú', category: 'pharmacy', label: 'Farmacia', image: 'boticas-peru.png' },
    { name: 'Bunker Fast Food', category: 'restaurant', label: 'Comida rápida', image: 'bunker.jpg' },
    { name: 'Caporal', category: 'pollos', label: 'Pollería y restaurante', image: 'caporal.jpg' },
    { name: 'Carretero', category: 'restaurant', label: 'Hamburguesas artesanales', image: 'carretero.jpg' },
    { name: 'Cascanuez', category: 'cafe', label: 'Pastelería y postres', image: 'cascanuez.jpg' },
    { name: 'Chefsito', category: 'restaurant', label: 'Cevichería', image: 'chefsito.jpg' },
    { name: 'Chifa Central', category: 'chifa', label: 'Chifa', image: 'chifa-central.jpg' },
    { name: 'Chifa Miluana', category: 'chifa', label: 'Chifa', image: 'chifa-miluana.jpg' },
    { name: 'Concha Marina', category: 'restaurant', label: 'Restaurante marino', image: 'concha-marina.jpg' },
    { name: 'Boticas Diana', category: 'pharmacy', label: 'Farmacia', image: 'diana-boticas.jpg' },
    { name: 'Dubai', category: 'pollos', label: 'Restaurante y pollería', image: 'dubai.jpg' },
    { name: 'El Quijote', category: 'pizza', label: 'Pizzería artesanal', image: 'el-quijote.jpg' },
    { name: 'El Turco', category: 'restaurant', label: 'Restaurante y cevichería', image: 'el-turco.jpg' },
    { name: 'Falabella', category: 'market', label: 'Tienda por departamento', image: 'falabella.png', shopping: true },
    { name: 'Ferretería Medina', category: 'market', label: 'Ferretería', image: 'ferreteria-medina.png', shopping: true },
    { name: 'Fogón Dorado', category: 'pollos', label: 'Pollos y parrilladas', image: 'fogon-dorado.png' },
    { name: 'Inkafarma', category: 'pharmacy', label: 'Farmacia', image: 'inkafarma.png', shopping: true },
    { name: 'KFC', category: 'pollos', label: 'Pollos y comida rápida', image: 'kfc.jpg' },
    { name: 'Kofetin', category: 'cafe', label: 'Sándwiches y café', image: 'kofetin.jpg', menu: { pdf: 'carta-kofetin-2026.pdf' } },
    { name: 'La Chola', category: 'restaurant', label: 'Restaurante', image: 'la-chola.jpg' },
    { name: 'La Gran Estación', category: 'pollos', label: 'Pollería', image: 'la-gran-estacion.jpg' },
    { name: 'Las Chamas', category: 'restaurant', label: 'Restaurante', image: 'las-chamas.png' },
    { name: 'Manos Piuranas', category: 'restaurant', label: 'Cevichería', image: 'manos-piuranas.jpg' },
    { name: 'Medileny Chicken', category: 'pollos', label: 'Pollería', image: 'medileny.jpg' },
    { name: 'Metro', category: 'market', label: 'Supermercado', image: 'metro.png', shopping: true },
    { name: 'Mi Farma', category: 'pharmacy', label: 'Farmacia', image: 'mi-farma.jpg', shopping: true },
    { name: 'Mr. Grill', category: 'pollos', label: 'Parrillas', image: 'mr-grill.png' },
    { name: 'Obsesion', category: 'cafe', label: 'Casa de té, panadería y pastelería', image: 'obsesion.png' },
    { name: 'Olano Distribuciones', category: 'market', label: 'Distribuciones', image: 'olano.jpg', shopping: true },
    { name: 'Pizza Hut', category: 'pizza', label: 'Pizzería', image: 'pizza-hut.jpg' },
    { name: 'Plaza Vea', category: 'market', label: 'Supermercado', image: 'plaza-vea.png', shopping: true },
    { name: 'Popeyes', category: 'pollos', label: 'Pollo y comida rápida', image: 'popeyes.png' },
    { name: 'Promart', category: 'market', label: 'Hogar y construcción', image: 'promart.png', shopping: true },
    { name: 'Roma Pizzas', category: 'pizza', label: 'Pizzería', image: 'roma.png' },
    { name: 'Super Chicken', category: 'pollos', label: 'Pollería', image: 'super-chicken.jpg' },
    { name: 'Shalom', category: 'service', label: 'Envíos y transporte', image: 'shalom.png', service: true },
    { name: 'Starbucks', category: 'cafe', label: 'Café', image: 'starbucks.jpg' },
    { name: 'Vigos Fusión', category: 'pizza', label: 'Pizzas, pastas y parrillas', image: 'vigos-fusion.jpg' },
    { name: 'Vigos Pizza', category: 'pizza', label: 'Pizzería', image: 'vigos-pizza.jpg' },
    { name: 'Warique de Chelo', category: 'restaurant', label: 'Restaurante', image: 'warique-de-chelo.png' },
    { name: 'Zarco', category: 'restaurant', label: 'Restaurante', image: 'zarco.jpg' }
  ];

  const menuFilePattern = /^[a-z0-9][a-z0-9_-]*\.(pdf|jpe?g|png|webp)$/i;
  const menuMarkup = store => {
    if (!store.menu) return '';

    const slug = store.name.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const basePath = `assets/menus/${slug}/`;
    const pdf = typeof store.menu.pdf === 'string' && menuFilePattern.test(store.menu.pdf) && /\.pdf$/i.test(store.menu.pdf)
      ? `<a class="store-menu-link" href="${basePath}${encodeURIComponent(store.menu.pdf)}" target="_blank" rel="noopener">Ver carta PDF</a>`
      : '';
    const images = Array.isArray(store.menu.images) ? store.menu.images.filter(file => {
      const valid = typeof file === 'string' && menuFilePattern.test(file) && /\.(jpe?g|png|webp)$/i.test(file);
      if (!valid) console.error(`Archivo de carta inválido para ${store.name}. Usa JPG, PNG o WebP con un nombre simple.`);
      return valid;
    }) : [];
    const gallery = images.length
      ? `<details class="store-menu-gallery">
          <summary>Ver carta en fotos (${images.length})</summary>
          <div class="store-menu-pages">${images.map((file, index) => {
            const url = `${basePath}${encodeURIComponent(file)}`;
            return `<a class="store-menu-page" href="${url}" target="_blank" rel="noopener">
              <img src="${url}" alt="Página ${index + 1} de la carta de ${store.name}" loading="lazy" />
              <span>Página ${index + 1}</span>
            </a>`;
          }).join('')}</div>
        </details>`
      : '';

    if (store.menu.pdf && !pdf) console.error(`Archivo PDF inválido para ${store.name}. Usa un nombre simple con extensión .pdf.`);
    return pdf || gallery ? `<div class="store-menu">${pdf}${gallery}</div>` : '';
  };

  grid.innerHTML = stores.map(store => {
    const buttonLabel = store.service ? 'Consultar servicio por WhatsApp' : store.shopping ? 'Comprar con SD Delivery' : 'Pedir con SD Delivery';
    const menu = menuMarkup(store);
    return `<article class="store-card" data-category="${store.category}" data-store-name="${store.name}">
      <div class="store-logo-wrap"><img src="assets/stores/${store.image}" alt="${store.name}" loading="lazy" /></div>
      <div class="store-card-body"><span class="store-category">${store.label}</span><h3>${store.name}</h3>
        ${menu}
        <button class="store-order-btn" type="button" data-order-store="${store.name}">${buttonLabel}</button>
      </div>
    </article>`;
  }).join('');

  const cards = Array.from(grid.querySelectorAll('.store-card'));
  const filters = Array.from(document.querySelectorAll('.store-filter'));
  const orderStore = document.getElementById('order-store');
  if (orderStore) {
    stores.forEach(store => {
      const option = document.createElement('option');
      option.value = store.name;
      option.textContent = store.name;
      orderStore.appendChild(option);
    });
  }

  grid.querySelectorAll('[data-order-store]').forEach(button => {
    button.addEventListener('click', () => {
      if (!orderStore) return;
      orderStore.value = button.dataset.orderStore;
      orderStore.dispatchEvent(new Event('change', { bubbles: true }));
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      document.getElementById('order-request').scrollIntoView({ behavior });
      window.setTimeout(() => orderStore.focus({ preventScroll: true }), 350);
    });
  });

  let activeCategory = 'all';

  const update = () => {
    const term = search.value.trim().toLocaleLowerCase('es');
    let visibleCount = 0;

    cards.forEach(card => {
      const categoryMatches = activeCategory === 'all' || card.dataset.category === activeCategory;
      const nameMatches = card.textContent.toLocaleLowerCase('es').includes(term);
      const visible = categoryMatches && nameMatches;
      card.hidden = !visible;
      if (visible) visibleCount++;
    });

    empty.hidden = visibleCount > 0;
  };

  filters.forEach(button => {
    button.addEventListener('click', () => {
      activeCategory = button.dataset.filter;
      filters.forEach(filter => {
        const selected = filter === button;
        filter.classList.toggle('active', selected);
        filter.setAttribute('aria-pressed', String(selected));
      });
      update();
    });
  });

  search.addEventListener('input', update);
})();

// ---- DELIVERY LOCATION MAP ----
(function initDeliveryMap() {
  const mapElement = document.getElementById('delivery-map');
  if (!mapElement) return;

  const status = document.getElementById('map-status');
  const estimate = document.getElementById('route-estimate');
  const googleLink = document.getElementById('google-map-link');
  const points = {
    A: { latitude: document.getElementById('order-origin-latitude'), longitude: document.getElementById('order-origin-longitude'), label: 'Tienda (A)' },
    B: { latitude: document.getElementById('order-latitude'), longitude: document.getElementById('order-longitude'), label: 'Entrega (B)' }
  };
  const locationButton = document.getElementById('use-current-location');
  const orderForm = document.getElementById('order-form');
  const configuredRouteApiKey = window.SD_DELIVERY_CONFIG && window.SD_DELIVERY_CONFIG.geoapifyApiKey;
  const geoapifyApiKey = typeof configuredRouteApiKey === 'string' ? configuredRouteApiKey.trim() : '';
  const privacyNote = document.getElementById('map-privacy-note');
  const routeAttribution = document.getElementById('route-provider-attribution');
  if (!window.L) {
    status.textContent = 'No se pudo cargar el mapa. El mapa es opcional: envía el pedido con la dirección escrita y confirma la tarifa por WhatsApp.';
    return;
  }

  if (geoapifyApiKey) {
    privacyNote.textContent = 'Para estimar la ruta, se envían las coordenadas A y B a Geoapify. Revisa su política de privacidad y configura la clave para aceptar solicitudes solo desde el dominio publicado.';
    routeAttribution.hidden = false;
  }

  const map = L.map(mapElement, { scrollWheelZoom: false }).setView([-7.16, -78.51], 14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  }).addTo(map);
  const markers = { A: null, B: null };
  let routeLine = null;
  let activePoint = 'A';
  let routeRequest = 0;

  const fareFor = distanceKm => {
    if (distanceKm <= 2) return 5;
    if (distanceKm <= 3) return 6;
    return Math.round(distanceKm * 200) / 100;
  };

  const calculateRoute = async () => {
    const origin = points.A;
    const destination = points.B;
    if (!origin.latitude.value || !origin.longitude.value || !destination.latitude.value || !destination.longitude.value) {
      estimate.textContent = 'Distancia y tarifa estimada: pendientes de marcar ambos puntos.';
      return;
    }
    const requestId = ++routeRequest;
    estimate.textContent = 'Calculando distancia por ruta…';
    const routeUrl = geoapifyApiKey
      ? (() => {
          const url = new URL('https://api.geoapify.com/v1/routing');
          url.searchParams.set('waypoints', `${origin.latitude.value},${origin.longitude.value}|${destination.latitude.value},${destination.longitude.value}`);
          url.searchParams.set('mode', 'drive');
          url.searchParams.set('format', 'geojson');
          url.searchParams.set('units', 'metric');
          url.searchParams.set('apiKey', geoapifyApiKey);
          return url.toString();
        })()
      : `https://router.project-osrm.org/route/v1/driving/${origin.longitude.value},${origin.latitude.value};${destination.longitude.value},${destination.latitude.value}?overview=full&geometries=geojson`;
    try {
      const response = await fetch(routeUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error('route unavailable');
      const data = await response.json();
      if (requestId !== routeRequest) return;
      let geometry;
      let distanceMeters;
      if (geoapifyApiKey) {
        const feature = data.features?.[0];
        if (!feature || !Number.isFinite(feature.properties?.distance)) throw new Error('route not found');
        geometry = feature.geometry;
        distanceMeters = feature.properties.distance;
      } else {
        if (data.code !== 'Ok' || !data.routes?.length) throw new Error('route not found');
        geometry = data.routes[0].geometry;
        distanceMeters = data.routes[0].distance;
      }
      const distanceKm = distanceMeters / 1000;
      const fare = fareFor(distanceKm);
      if (routeLine) routeLine.remove();
      routeLine = L.geoJSON(geometry, { style: { color: '#e8192c', weight: 5, opacity: 0.85 } }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [28, 28] });
      estimate.dataset.distanceKm = distanceKm.toFixed(3);
      estimate.dataset.fare = fare.toFixed(2);
      estimate.textContent = `Ruta aproximada: ${distanceKm.toFixed(1)} km · Tarifa estimada: S/ ${fare.toFixed(2)}. El total puede variar según el servicio.`;
    } catch {
      if (requestId !== routeRequest) return;
      estimate.dataset.distanceKm = '';
      estimate.dataset.fare = '';
      estimate.textContent = 'No pudimos calcular la ruta en este momento. La distancia y la tarifa se confirman por WhatsApp.';
    }
  };

  const setLocation = (key, latlng, zoom = 17) => {
    const lat = Number(latlng.lat);
    const lng = Number(latlng.lng);
    const point = points[key];
    point.latitude.value = lat.toFixed(6);
    point.longitude.value = lng.toFixed(6);
    if (!markers[key]) {
      markers[key] = L.marker([lat, lng], { draggable: true }).addTo(map).bindTooltip(point.label, { permanent: true, direction: 'top' });
    } else markers[key].setLatLng([lat, lng]);
    markers[key].off('dragend').on('dragend', event => setLocation(key, event.target.getLatLng(), map.getZoom()));
    map.setView([lat, lng], zoom);
    if (key === 'B') {
      googleLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
      googleLink.hidden = false;
    }
    status.textContent = `${point.label} marcado: ${lat.toFixed(5)}, ${lng.toFixed(5)}. Puedes mover el pin o elegir otro punto.`;
    calculateRoute();
  };

  map.on('click', event => setLocation(activePoint, event.latlng));
  document.getElementById('select-origin-point')?.addEventListener('click', event => {
    activePoint = 'A';
    document.getElementById('select-origin-point').classList.add('active');
    document.getElementById('select-origin-point').setAttribute('aria-pressed', 'true');
    document.getElementById('select-destination-point').classList.remove('active');
    document.getElementById('select-destination-point').setAttribute('aria-pressed', 'false');
    status.textContent = 'Toca el mapa para marcar la tienda de origen (A).';
  });
  document.getElementById('select-destination-point')?.addEventListener('click', () => {
    activePoint = 'B';
    document.getElementById('select-destination-point').classList.add('active');
    document.getElementById('select-destination-point').setAttribute('aria-pressed', 'true');
    document.getElementById('select-origin-point').classList.remove('active');
    document.getElementById('select-origin-point').setAttribute('aria-pressed', 'false');
    status.textContent = 'Toca el mapa para marcar la dirección de entrega (B).';
  });
  locationButton?.addEventListener('click', () => {
    if (!navigator.geolocation) {
      status.textContent = 'Este navegador no permite obtener la ubicación. Selecciona el punto B y tócalo en el mapa.';
      return;
    }
    locationButton.disabled = true;
    activePoint = 'B';
    document.getElementById('select-destination-point')?.classList.add('active');
    document.getElementById('select-destination-point')?.setAttribute('aria-pressed', 'true');
    document.getElementById('select-origin-point')?.classList.remove('active');
    document.getElementById('select-origin-point')?.setAttribute('aria-pressed', 'false');
    status.textContent = 'Buscando tu ubicación para marcar la entrega (B)…';
    navigator.geolocation.getCurrentPosition(position => {
      setLocation('B', { lat: position.coords.latitude, lng: position.coords.longitude });
      locationButton.disabled = false;
    }, error => {
      status.textContent = error.code === 1
        ? 'No se autorizó la ubicación. Selecciona B y toca el mapa para marcar la entrega.'
        : 'No pudimos obtener la ubicación. Selecciona B y marca el punto de entrega en el mapa.';
      locationButton.disabled = false;
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });
  orderForm?.addEventListener('change', event => {
    if (event.target.id === 'order-store') {
      routeRequest++;
      points.A.latitude.value = '';
      points.A.longitude.value = '';
      if (markers.A) { markers.A.remove(); markers.A = null; }
      if (routeLine) { routeLine.remove(); routeLine = null; }
      estimate.dataset.distanceKm = '';
      estimate.dataset.fare = '';
      estimate.textContent = 'Local cambiado. Marca la ubicación del local elegido (A) y luego el destino del cliente (B).';
    }
  });
  window.addEventListener('resize', () => map.invalidateSize());
  window.setTimeout(() => map.invalidateSize(), 150);
})();

// ---- ASSISTED ORDER TO WHATSAPP ----
(function initOrderForm() {
  const form = document.getElementById('order-form');
  if (!form) return;
  const status = document.getElementById('order-submit-status');
  const fallback = document.getElementById('order-whatsapp-fallback');
  const phone = document.getElementById('order-customer-phone');

  const validatePhone = () => {
    phone.setCustomValidity(phone.value.trim() && !isValidPhoneNumber(phone.value)
      ? 'Ingresa un número válido, de 7 a 15 dígitos.'
      : '');
  };
  phone.addEventListener('input', validatePhone);

  form.addEventListener('submit', event => {
    event.preventDefault();
    validatePhone();
    if (!form.reportValidity()) return;
    const value = id => document.getElementById(id)?.value.trim() || '';
    const originLat = value('order-origin-latitude');
    const originLng = value('order-origin-longitude');
    const destinationLat = value('order-latitude');
    const destinationLng = value('order-longitude');
    const routeEstimate = document.getElementById('route-estimate');
    const routeKm = routeEstimate.dataset.distanceKm;
    const routeFare = routeEstimate.dataset.fare;
    const destinationMapUrl = destinationLat && destinationLng
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${destinationLat},${destinationLng}`)}`
      : '';
    const lines = [
      'Hola SD Delivery, quiero hacer un pedido:',
      `Tienda/restaurante: ${value('order-store')}`,
      `Nombre: ${value('order-customer-name')}`,
      `Teléfono de contacto: ${value('order-customer-phone')}`,
      `Productos y cantidades: ${value('order-items')}`,
      `Dirección y referencia: ${value('order-address')}`,
      `Forma de pago preferida: ${value('order-payment') || 'A coordinar por WhatsApp'}`,
      `Punto A (tienda): ${originLat && originLng ? `${originLat}, ${originLng}` : 'Sin marcar'}`,
      `Punto B (cliente): ${destinationLat && destinationLng ? `${destinationLat}, ${destinationLng}` : 'Sin marcar'}`,
      `Ruta y distancia: ${routeKm ? `${Number(routeKm).toFixed(1)} km aprox.` : 'Pendiente de confirmar'}`,
      `Tarifa estimada: ${routeFare ? `S/ ${Number(routeFare).toFixed(2)}` : 'Pendiente de confirmar por WhatsApp'}`,
      `Ubicación del cliente en Google Maps: ${destinationMapUrl || 'No marcada; confirmar con la dirección indicada'}`,
      `Notas: ${value('order-notes') || 'Sin notas adicionales'}`
    ];
    const whatsappUrl = `https://wa.me/51957107660?text=${encodeURIComponent(lines.join('\n'))}`;
    const opened = window.open(whatsappUrl, '_blank');
    if (opened) opened.opener = null;
    if (opened) {
      status.textContent = 'Se abrió WhatsApp con tu pedido. Revísalo y pulsa Enviar para confirmar la solicitud.';
      fallback.hidden = true;
    } else {
      status.textContent = 'WhatsApp no se abrió automáticamente. Puedes reintentar con este enlace.';
      fallback.href = whatsappUrl;
      fallback.hidden = false;
    }
  });
})();

// ---- ACTIVE NAV LINK on scroll ----
(function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  if (!sections.length || !navLinks.length) return;

  const onScroll = () => {
    let current = '';
    sections.forEach(section => {
      const top = section.getBoundingClientRect().top;
      if (top < 120) current = section.id;
    });
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      link.style.color = href === `#${current}` ? 'var(--clr-red)' : '';
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
})();

// ---- HERO PARALLAX (subtle) ----
(function initParallax() {
  const heroGlow = document.querySelector('.hero-glow');
  const heroMoto = document.querySelector('.hero-moto-svg');
  if (!heroGlow || !heroMoto) return;

  // Disable on mobile
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.innerWidth < 768) return;

  window.addEventListener('mousemove', (e) => {
    const { clientX, clientY } = e;
    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;
    const dx = (clientX - cx) / cx;
    const dy = (clientY - cy) / cy;

    heroGlow.style.transform = `translate(${dx * 15}px, ${dy * 10}px)`;
    heroMoto.style.transform = `translateY(${-6 + dy * -8}px)`;
  }, { passive: true });
})();

// ---- FEATURE CARD TILT ----
(function initCardTilt() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.innerWidth < 768) return;

  document.querySelectorAll('.feature-card, .step-card, .testimonial-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width  - 0.5) * 10;
      const y = ((e.clientY - rect.top)  / rect.height - 0.5) * -10;
      card.style.transform = `perspective(600px) rotateY(${x}deg) rotateX(${y}deg) translateY(-6px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      setTimeout(() => card.style.transition = '', 400);
    });
  });
})();

// ---- WHATSAPP FLOAT: show after delay ----
(function initWhatsAppFloat() {
  const btn = document.querySelector('.whatsapp-float');
  if (!btn) return;

  btn.style.opacity = '0';
  btn.style.transform = 'translateY(20px) scale(0.8)';
  btn.style.transition = 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';

  setTimeout(() => {
    btn.style.opacity = '1';
    btn.style.transform = '';
  }, 2000);
})();

console.log('%c🚀 SD Delivery — Cajamarca, Perú', 'color:#E8192C;font-size:1.2rem;font-weight:900;font-family:Montserrat,sans-serif;');
console.log('%cHecho con ❤️ para impulsar el comercio local.', 'color:#A0A0A0;font-size:0.85rem;');
