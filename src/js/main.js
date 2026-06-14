/**
 * Mediador Principal (VIEWMODEL / CONTROLLER) - Proyecto Final (WDD 330)
 * 
 * Orquesta los ciclos de vida, escuchadores de eventos e inicialización
 * general de la aplicación. Conecta las operaciones del Modelo (api.js, storage.js)
 * con los efectos visuales en el DOM (dom.js).
 */

import { 
  getBrowserLocation, 
  getCoordinatesByCity, 
  fetchFullPlacesData 
} from './api.js';

import { 
  getFavorites, 
  saveFavorite, 
  removeFavorite, 
  isFavorite 
} from './storage.js';

import { 
  renderPlacesGrid, 
  toggleFavButtonState 
} from './dom.js';

// ==========================================================================
// ⚡ FLUJO 1: PÁGINA DE CONFIGURACIÓN Y BÚSQUEDA (input.html)
// ==========================================================================
function initSearchPage() {
  const searchForm = document.getElementById('search-form');
  const destinationInput = document.getElementById('destination');
  const destinationError = document.getElementById('destination-error');
  const radiusInput = document.getElementById('radius');
  const radiusValue = document.getElementById('radius-value');
  const geoBtn = document.getElementById('geo-btn');
  const geoStatus = document.getElementById('geo-status');
  const formAlert = document.getElementById('form-alert');

  if (!searchForm) return; // No estamos en input.html

  // 1. Mostrar el valor del rango (slider) en tiempo real
  radiusInput.addEventListener('input', (e) => {
    radiusValue.textContent = `${e.target.value} km`;
  });

  // 2. Control de Geolocalización Satelital
  geoBtn.addEventListener('click', async () => {
    geoStatus.className = 'status-msg';
    geoStatus.textContent = 'Consultando GPS satelital... 🛰️';
    geoBtn.disabled = true;

    try {
      const coords = await getBrowserLocation();
      
      // Guardamos las coordenadas temporalmente en atributos de datos (dataset) del formulario
      searchForm.dataset.lat = coords.lat;
      searchForm.dataset.lon = coords.lon;
      
      // Actualizamos el input de destino y borramos errores activos
      destinationInput.value = 'Mi ubicación actual (GPS)';
      destinationInput.setCustomValidity('');
      destinationError.classList.remove('show');
      
      geoStatus.textContent = 'Coordenadas GPS obtenidas con éxito ✅';
    } catch (error) {
      console.error(error);
      geoStatus.className = 'status-msg error';
      geoStatus.textContent = error.message;
      
      // Limpiamos coordenadas del dataset si falla
      delete searchForm.dataset.lat;
      delete searchForm.dataset.lon;
    } finally {
      geoBtn.disabled = false;
    }
  });

  // 3. Limpiar GPS si el usuario escribe en el input manualmente
  destinationInput.addEventListener('input', () => {
    if (searchForm.dataset.lat) {
      delete searchForm.dataset.lat;
      delete searchForm.dataset.lon;
      if (destinationInput.value === 'Mi ubicación actual (GPS)') {
        destinationInput.value = '';
      }
    }
  });

  // 4. Implementación de Constraint Validation API nativa en español
  const validateDestinationField = () => {
    // Sanitizamos la entrada eliminando caracteres extraños
    const value = destinationInput.value.trim();
    
    if (destinationInput.validity.valueMissing || value === '') {
      destinationInput.setCustomValidity('El destino o ciudad es obligatorio. Escríbelo o presiona "Usar mi Ubicación GPS".');
    } else if (value.length < 3) {
      destinationInput.setCustomValidity(`El nombre debe ser más específico (mínimo 3 letras). Escribiste solo ${value.length}.`);
    } else {
      // Si pasa los controles de flujo, limpiamos la validez customizada
      destinationInput.setCustomValidity('');
    }

    // Dibujamos el estado de alerta en el contenedor en tiempo real
    if (!destinationInput.checkValidity()) {
      destinationError.querySelector('.error-text').textContent = destinationInput.validationMessage;
      destinationError.classList.add('show');
      return false;
    } else {
      destinationError.classList.remove('show');
      return true;
    }
  };

  // Escuchadores de eventos para validación interactiva solicitados
  destinationInput.addEventListener('input', validateDestinationField);
  destinationInput.addEventListener('blur', validateDestinationField);

  // 5. Envío del Formulario
  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    formAlert.style.display = 'none';

    // Disparamos la validación nativa antes de procesar
    const isValid = validateDestinationField();
    
    if (!isValid) {
      formAlert.querySelector('.alert-text').textContent = 'Por favor, resuelve los errores en los campos antes de continuar.';
      formAlert.style.display = 'flex';
      return;
    }

    const radius = radiusInput.value;
    const isGPS = !!searchForm.dataset.lat;

    // Redireccionamos a index.html enviando los parámetros de búsqueda por URL
    if (isGPS) {
      const lat = searchForm.dataset.lat;
      const lon = searchForm.dataset.lon;
      window.location.href = `index.html?lat=${lat}&lon=${lon}&radius=${radius}&gps=true`;
    } else {
      const city = destinationInput.value.trim();
      window.location.href = `index.html?city=${encodeURIComponent(city)}&radius=${radius}`;
    }
  });
}

// ==========================================================================
// ⚡ FLUJO 2: PÁGINA DE EXPLORACIÓN DE RESULTADOS (index.html)
// ==========================================================================
function initExplorePage() {
  const placesGrid = document.getElementById('places-grid');
  const favoritesGrid = document.getElementById('favorites-grid');
  
  if (!placesGrid && !favoritesGrid) return; // No estamos en index.html

  // Carga e inicialización inmediata de favoritos desde localStorage (Soporte Offline)
  refreshFavoritesView();

  // Leemos los parámetros de búsqueda en la URL
  const queryParams = new URLSearchParams(window.location.search);
  const radius = queryParams.get('radius') || '25';
  const lat = queryParams.get('lat');
  const lon = queryParams.get('lon');
  const city = queryParams.get('city');
  const gps = queryParams.get('gps');

  const searchTitle = document.getElementById('search-title');
  const resultsCount = document.getElementById('results-count');
  const loader = document.getElementById('loader');
  const emptyResults = document.getElementById('empty-results');

  // Si no se inició ninguna búsqueda, informamos al usuario en la cabecera
  if (!lat && !lon && !city) {
    if (loader) loader.style.display = 'none';
    if (searchTitle) searchTitle.textContent = 'Comienza una exploración';
    if (resultsCount) resultsCount.textContent = 'Esperando búsqueda';
    if (emptyResults) {
      emptyResults.style.display = 'flex';
      emptyResults.querySelector('h3').textContent = '¿Listo para explorar?';
      emptyResults.querySelector('p').textContent = 'Configura tu destino para trazar tu compass ecológico.';
    }
    return;
  }

  // Ejecutamos la carga asíncrona
  loadSearchData();

  async function loadSearchData() {
    try {
      if (loader) loader.style.display = 'flex';
      if (emptyResults) emptyResults.style.display = 'none';
      if (placesGrid) placesGrid.innerHTML = '';
      
      let searchLat = lat;
      let searchLon = lon;
      let displayLocation = 'tu ubicación GPS';

      // Si la búsqueda es por nombre de ciudad, resolvemos coordenadas primero
      if (city) {
        if (searchTitle) searchTitle.textContent = `Buscando "${city}"...`;
        const coords = await getCoordinatesByCity(city);
        searchLat = coords.lat;
        searchLon = coords.lon;
        displayLocation = coords.displayName;
      }

      if (searchTitle) {
        searchTitle.textContent = `Cerca de ${displayLocation} (${radius} km)`;
      }

      // Consumimos el modelo asíncrono cruzado (OpenTripMap + Unsplash)
      const places = await fetchFullPlacesData(searchLat, searchLon, parseInt(radius));

      if (loader) loader.style.display = 'none';

      if (places.length === 0) {
        if (resultsCount) resultsCount.textContent = '0 lugares';
        if (emptyResults) emptyResults.style.display = 'flex';
      } else {
        if (resultsCount) resultsCount.textContent = `${places.length} lugares`;
        
        // Renderizado optimizado pasando el callback del ViewModel para alternar favoritos
        renderPlacesGrid(places, placesGrid, handleFavoriteToggle);
      }
    } catch (error) {
      console.error('Error durante la búsqueda de destinos:', error);
      if (loader) loader.style.display = 'none';
      if (searchTitle) searchTitle.textContent = 'Error en la búsqueda';
      if (resultsCount) resultsCount.textContent = 'Error';
      
      if (emptyResults) {
        emptyResults.style.display = 'flex';
        emptyResults.querySelector('h3').textContent = 'Hubo un inconveniente';
        emptyResults.querySelector('p').textContent = error.message || 'No pudimos contactar a los servidores. Intenta más tarde.';
      }
    }
  }

  /**
   * Manejador del ViewModel (Controlador) para reaccionar al click en Favoritos.
   * Modifica el modelo en localStorage y sincroniza la vista en tiempo real.
   * 
   * @param {Object} place Datos del lugar seleccionado.
   * @param {HTMLElement} btn Elemento del botón cliqueado.
   */
  function handleFavoriteToggle(place, btn) {
    const isSaved = isFavorite(place.xid);
    
    if (isSaved) {
      // 1. Modificar el modelo (eliminar)
      removeFavorite(place.xid);
      // 2. Modificar el estado del botón en la tarjeta actual
      toggleFavButtonState(btn, false);
    } else {
      // 1. Modificar el modelo (guardar)
      saveFavorite(place);
      // 2. Modificar el estado del botón
      toggleFavButtonState(btn, true);
    }

    // 3. Sincronizar el panel inferior de favoritos inmediatamente
    refreshFavoritesView();
    
    // 4. Si el elemento también existía en la grilla de búsqueda de arriba, actualizar su botón
    syncSearchResultsBtn(place.xid, !isSaved);
  }

  /**
   * Refresca la sección inferior de favoritos cargados offline.
   */
  function refreshFavoritesView() {
    if (!favoritesGrid) return;
    
    const favs = getFavorites();
    const favsCountBadge = document.getElementById('favs-count');
    const emptyFavsCard = document.getElementById('empty-favorites');
    
    if (favsCountBadge) {
      favsCountBadge.textContent = favs.length;
    }

    if (favs.length === 0) {
      favoritesGrid.innerHTML = '';
      if (emptyFavsCard) emptyFavsCard.style.display = 'flex';
    } else {
      if (emptyFavsCard) emptyFavsCard.style.display = 'none';
      
      // Renderizamos la grilla de favoritos offline
      renderPlacesGrid(favs, favoritesGrid, (clickedPlace, btn) => {
        // En favoritos, al cliquear el corazón siempre removemos el elemento
        removeFavorite(clickedPlace.xid);
        refreshFavoritesView();
        
        // Sincronizamos cualquier botón gemelo en la grilla de resultados superior
        syncSearchResultsBtn(clickedPlace.xid, false);
      });
    }
  }

  /**
   * Sincroniza el botón de favoritos de una tarjeta en la grilla de resultados activos.
   */
  function syncSearchResultsBtn(xid, makeFavorite) {
    if (!placesGrid) return;
    // Buscamos directamente el botón por su atributo data-xid asignado en el DOM
    const favBtn = placesGrid.querySelector(`.btn-fav[data-xid="${xid}"]`);
    if (favBtn) {
      toggleFavButtonState(favBtn, makeFavorite);
    }
  }
}

// ==========================================================================
// 🚀 INICIALIZACIÓN GLOBAL DE LA APLICACIÓN
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initSearchPage();
  initExplorePage();
});
