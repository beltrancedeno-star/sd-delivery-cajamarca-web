# SD Delivery — versión de trabajo

Abre `index.html` en un navegador para revisar la página.

## Catálogo

La sección de tiendas muestra 47 comercios y servicios aliados, con búsqueda y filtros por categoría. Cada botón lleva al formulario de pedido y selecciona el local. Los logos están en `assets/stores/` y la lista editable está en `app.js`, dentro de `initStoreDirectory`.

Para sumar o actualizar un aliado, agrega su logo a `assets/stores/` y una entrada en esa lista. Los pedidos seguirán llegando al WhatsApp central, donde SD Delivery coordina las compras y los traslados.

### Cartas y catálogos

SD Delivery administra la publicación: por cada comercio, coloca sus archivos en `assets/menus/<nombre-del-comercio>/` y agrega `menu: { pdf: 'carta.pdf', url: 'https://...', images: ['pagina-1.jpg', 'pagina-2.jpg'] }` en su entrada de `app.js`. El nombre de la carpeta se genera desde el nombre del comercio en minúsculas, sin tildes y con guiones (por ejemplo, `300 Burger` → `300-burger`). Se admiten archivos PDF, enlaces externos HTTPS y varias imágenes JPG, PNG o WebP; las tarjetas muestran enlaces solo para los formatos configurados. No hay un panel de carga en la web: esta versión estática requiere copiar los archivos al proyecto y volver a publicar el sitio. La Chola, Kofetin y Fogón Dorado tienen cartas PDF; KFC, Pizza Hut y Bembos enlazan a sus cartas oficiales.

## Contacto y operación

- WhatsApp y teléfono: +51 957 107 660
- Dirección: Jirón Chepén 1142, urbanización La Perlita, Cajamarca
- Facebook, Instagram y TikTok: perfiles proporcionados por SD Delivery
- El video de la moto está en `assets/moto-delivery.mp4` y muestra `assets/moto-delivery-poster.jpg` como portada. El video se carga al iniciar la reproducción del usuario para ahorrar datos.

El formulario de pedido solicita el comercio, nombre, teléfono, productos y cantidades, dirección, forma de pago preferida y notas. En el mapa se marca el punto A (tienda seleccionada) y el punto B (entrega del cliente); con ambos puntos se estima por ruta vehicular usando OSRM y se aplica el tarifario publicado. El mapa es opcional: si no se pueden marcar los puntos, el pedido puede enviarse con la dirección escrita y la tarifa se confirma por WhatsApp. Para más de 3 km, el cálculo es distancia de ruta × S/ 2, redondeado a céntimos. El resumen incluye coordenadas, distancia y tarifa estimada en WhatsApp. El cliente debe revisar y pulsar **Enviar**. Esta página no almacena solicitudes en un servidor.

Ambos formularios validan que los teléfonos tengan entre 7 y 15 dígitos. Si el navegador bloquea la apertura de WhatsApp, el formulario conserva los datos y muestra un enlace alternativo. Las animaciones y el desplazamiento respetan la preferencia del sistema para reducir movimiento.

El mapa usa Leaflet y los mosaicos de OpenStreetMap. El cálculo de ruta usa el servicio público de OSRM; para uso comercial continuo, conviene configurar un servicio de rutas administrado o propio. Para ubicar al cliente automáticamente, el sitio debe publicarse mediante HTTPS y el usuario debe dar permiso de ubicación. Si el mapa no carga o falla el cálculo, el pedido igual puede enviarse y la tarifa se confirma por WhatsApp.

## Publicar en GitHub Pages

Este sitio puede desplegarse como página estática con el workflow `.github/workflows/pages.yml`. El repositorio debe llamarse `sd-delivery-cajamarca-web` (o actualizar la ruta base si se usa otro nombre), estar en la cuenta de SD Delivery y ser público para usar GitHub Pages gratis. En GitHub, habilita **Settings → Pages → Build and deployment → GitHub Actions**. Cada push a `main` publicará el sitio en `https://<usuario>.github.io/sd-delivery-cajamarca-web/`; esta dirección es distinta de la URL actual de Netlify y no la reemplaza.

Horario publicado: todos los días de 6:00 a. m. a 11:59 p. m. Cobertura: Cajamarca, Baños del Inca, Llacanora, Jesús y Porconcillo; otras zonas cercanas se consultan según el horario. Tarifario publicado: hasta 2 km S/ 5; de 2.1 a 3 km S/ 6; más de 3 km S/ 2 por kilómetro. Medios de pago: efectivo, billeteras digitales (Yape, Plin y Lemon) y tarjetas de débito o crédito con POS, que pueden tener recargo.

## Información legal — pendiente de validación

El pie de página enlaza a `legal.html`, que contiene borradores de privacidad, términos y cookies según los servicios que actualmente carga el sitio. Se agregaron los datos del titular proporcionados por el usuario (nombre, RUC, domicilio y correo de privacidad). El dígito verificador del RUC coincide con su formato, pero no se verificó la titularidad con SUNAT. Antes de publicar, confirmar esos datos, revisar los textos y definir plazos de conservación, acceso a datos y procedimiento para ejercer derechos.

La sección de reclamos indica expresamente que el Libro de Reclamaciones virtual todavía no está habilitado: esta página estática no registra reclamos ni genera constancia. Recomendación: contratar una plataforma administrada que entregue constancia al consumidor, permita seguimiento y exportación de registros y describa por contrato su tratamiento de datos. No presentar el contacto por WhatsApp como sustituto del Libro oficial.

## Pendientes antes de producción

- **Rutas:** `router.project-osrm.org` es un servidor de demostración sin garantía de disponibilidad; puede restringir o retirar el acceso. Recomendación inicial: mantener Leaflet/OpenStreetMap y conectar un proveedor administrado de rutas basado en OSM mediante un proxy backend, con límites y credenciales fuera del navegador. La alternativa es autoalojar OSRM, que exige operación y mantenimiento. La política del proyecto OSRM describe el acceso de demostración como best effort: https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy
- **Opción administrada revisada:** GraphHopper publica un plan Basic de 69 EUR/mes, hasta 5,000 créditos diarios, e indica uso comercial en su tabla. La tarifa y condiciones pueden cambiar; confirmar el plan, cobertura de Cajamarca y contrato antes de contratar. Su respuesta API requiere adaptar la integración actual de OSRM: https://www.graphhopper.com/pricing/
- **Alternativa:** Google Routes API requiere facturación habilitada y clave; cobra según las funciones/SKU usadas, y utiliza un formato de petición distinto al de OSRM. No se recomienda migrar sin revisar el presupuesto y configurar restricciones de clave: https://developers.google.com/maps/documentation/routes/usage-and-billing
- **Revisión legal:** validar los borradores con el titular o asesoría legal y completar los datos reales antes de publicar.
- **Libro de Reclamaciones:** habilitar y probar el flujo oficial, incluida la constancia al consumidor, el registro y seguimiento interno y la atención dentro de los plazos aplicables.
- **Privacidad de terceros:** revisar las políticas de WhatsApp, OSRM, OpenStreetMap, Google Fonts y el CDN Leaflet; publicar el sitio mediante HTTPS.

## Comparación preliminar de plataforma y rutas

Precios revisados el 11 de noviembre de 2026; pueden variar y no incluyen impuestos ni servicios adicionales.

- **Backend propio recomendado: Supabase Pro**, desde USD 25/mes. Incluye PostgreSQL administrado, funciones, autenticación y copias diarias con retención publicada de 7 días; el plan gratuito se pausa tras una semana sin actividad. La aplicación aún requerirá configurar acceso administrativo, políticas de permisos, envío de constancias por correo y retención. Fuente: https://supabase.com/pricing
- **Alternativa de menor costo: Cloudflare Workers + D1.** Workers Paid empieza en USD 5/mes y D1 tiene cuotas incluidas; habría que implementar y mantener la autenticación del administrador, el panel, las copias y el flujo de notificaciones. Fuentes: https://developers.cloudflare.com/workers/platform/pricing/ y https://developers.cloudflare.com/d1/platform/pricing/
- **Rutas económicas: Geoapify.** Publica un nivel gratuito de 3,000 créditos/día y 5 solicitudes/segundo; su página de precios afirma que se permite uso comercial en producción con atribución. Sin embargo, sus términos también mencionan limitaciones y sugieren consultar al proveedor para producción comercial. Antes de conectarlo, solicitar confirmación escrita, restringir la clave, comprobar rutas reales en Cajamarca y mostrar la atribución requerida. Fuente: https://www.geoapify.com/pricing/ y https://www.geoapify.com/terms-and-conditions/
- **Rutas con plan comercial publicado:** Geoapify API 10 cuesta USD 59/mes por 10,000 créditos/día e indica SLA de 99.5% para planes pagados; GraphHopper Basic publica EUR 69/mes por 5,000 créditos/día y uso comercial. Ambos requieren adaptar el formato API actual de OSRM y revisar cobertura, contrato y tratamiento de coordenadas. Fuentes: https://www.geoapify.com/pricing/ y https://www.graphhopper.com/pricing/

Recomendación preliminar: Supabase Pro para el registro sensible de reclamos por su autenticación y copias integradas; Geoapify gratuito solo después de obtener confirmación escrita de uso comercial y probar las rutas. No se configuró una cuenta/clave de Geoapify ni se enviaron datos del titular a servicios externos durante esta revisión.

La integración de rutas ya admite Geoapify de forma opcional. Para probarla, registrar el proyecto Geoapify, limitar la clave a la API de Routing y al dominio publicado, obtener confirmación de los términos comerciales y colocar la clave pública restringida en `site-config.js`. Si la clave está vacía, la página conserva OSRM como antes. El nivel gratuito no se activa hasta completar esos pasos; no pegar claves privadas en el código.

## Seguimiento GPS de repartidores

`driver.html` solicita ubicación solo cuando el repartidor inicia su turno y requiere HTTPS. Finalizar el turno o cerrar la pestaña marca el registro inactivo y elimina la última coordenada. `admin.html` usa el PIN inicial `2026` (cambiable en `admin.js`) como bloqueo de pantalla; la autorización real de lectura depende de Firebase Authentication y `database.rules.json`.

El proyecto `sddelivery` ya tiene registrada la app web, Realtime Database en `us-central1`, Authentication anónima habilitada, y las reglas de `database.rules.json` publicadas. `firebase-config.js` contiene la configuración de esa app; `sddelivery.online` está agregado como dominio autorizado.

GitHub Pages confirma el DNS, pero aún no ha emitido el certificado de `sddelivery.online`; por eso GPS y Wake Lock no funcionarán hasta que HTTPS quede válido. No autorizar un UID de producción desde HTTP. Cuando HTTPS esté activo, abrir `https://sddelivery.online/admin.html`, ingresar el PIN y copiar el UID que aparece. En Firebase Console > Realtime Database > Datos, agregar `admins/<UID>` con valor booleano `true`. El UID de `localhost` es distinto del de `sddelivery.online`; autoriza el que muestra el panel en el dominio publicado. No habilitar escrituras públicas ni permitir que clientes modifiquen `admins`.
