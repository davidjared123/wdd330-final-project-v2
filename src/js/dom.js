/**
 * Módulo de Renderizado Eficiente (VIEW-DOM) - Proyecto Final (WDD 330)
 * 
 * Este módulo interactúa directamente con la interfaz HTML.
 * - Utiliza exclusivamente etiquetas <template> capturadas en memoria.
 * - Realiza clonaciones seguras con .cloneNode(true) para evitar inyecciones de código (XSS).
 * - Agrupa las tarjetas en un DocumentFragment para insertarlas en un único reflujo (reflow) de DOM.
 */

import { isFavorite } from './storage.js';

/**
 * Traduce y simplifica la cadena de categorías de OpenTripMap a etiquetas estéticas.
 * 
 * @param {string} kinds Cadena con categorías separadas por comas.
 * @returns {string} Etiqueta en español legible.
 */
function translateKinds(kinds) {
  if (!kinds) return 'Punto de Interés';
  
  const kindsLower = kinds.toLowerCase();
  
  if (kindsLower.includes('nature_reserves') || kindsLower.includes('natural') || kindsLower.includes('park')) {
    return 'Reserva Natural 🌿';
  }
  if (kindsLower.includes('historical_places') || kindsLower.includes('historic') || kindsLower.includes('heritage')) {
    return 'Sitio Histórico 🏛️';
  }
  if (kindsLower.includes('tourist_object') || kindsLower.includes('monuments') || kindsLower.includes('tourism')) {
    return 'Atracción Turística 🧭';
  }
  
  return 'Destino Ecológico 🏞️';
}

/**
 * Renderiza una colección de tarjetas de lugares en un contenedor específico.
 * Utiliza clonación de plantillas y DocumentFragment de manera altamente eficiente.
 * 
 * @param {Array} places Colección de lugares a dibujar.
 * @param {HTMLElement} gridElement Contenedor del DOM donde se inyectarán.
 * @param {Function} onFavoriteToggle Callback ViewModel para procesar clics en favoritos.
 */
export function renderPlacesGrid(places, gridElement, onFavoriteToggle) {
  if (!gridElement) return;
  
  // Limpiamos el contenedor previo de forma segura sin concatenar HTML
  gridElement.innerHTML = '';
  
  // Capturamos el nodo de la plantilla declarada en HTML
  const template = document.getElementById('place-card-template');
  if (!template) {
    console.error('No se encontró la plantilla "place-card-template" en el documento.');
    return;
  }
  
  // 🏛️ PRINCIPIO DE RENDIMIENTO: Creación del fragmento en memoria
  const fragment = document.createDocumentFragment();
  
  // Procesamos la colección
  places.forEach((place) => {
    // Clonamos la estructura profunda del template
    const cardClone = template.content.cloneNode(true);
    
    // Mapeamos los datos del modelo a las propiedades directas del nodo
    const imageEl = cardClone.querySelector('.place-image');
    imageEl.src = place.photoUrl;
    imageEl.alt = `Fotografía de ${place.name}`;
    
    const badgeEl = cardClone.querySelector('.place-kinds-badge');
    badgeEl.textContent = translateKinds(place.kinds);
    
    const nameEl = cardClone.querySelector('.place-name');
    nameEl.textContent = place.name;
    
    const distanceEl = cardClone.querySelector('.place-distance');
    distanceEl.textContent = place.distance;
    
    // Configuración visual del botón de Favoritos
    const favBtn = cardClone.querySelector('.btn-fav');
    const heartIcon = favBtn.querySelector('.heart-icon');
    const favText = favBtn.querySelector('.fav-text');
    favBtn.dataset.xid = place.xid; // Asignamos id para sincronización visual
    
    const active = isFavorite(place.xid);
    if (active) {
      favBtn.classList.add('is-favorite');
      heartIcon.textContent = '❤️';
      favText.textContent = 'Guardado';
    } else {
      favBtn.classList.remove('is-favorite');
      heartIcon.textContent = '🤍';
      favText.textContent = 'Guardar';
    }
    
    // Escuchador de eventos personalizado enlazando la capa ViewModel
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onFavoriteToggle(place, favBtn);
    });
    
    // Añadimos el nodo clonado al fragmento en memoria
    fragment.appendChild(cardClone);
  });
  
  // Realizamos una ÚNICA mutación al árbol del DOM del navegador
  gridElement.appendChild(fragment);
}

/**
 * Alterna visualmente el estado del botón de favoritos.
 * Evita tener que volver a renderizar todo el grid completo por un solo cambio de estado.
 * 
 * @param {HTMLElement} btn Elemento del botón de favoritos.
 * @param {boolean} isSaved True si el lugar fue guardado, False si fue removido.
 */
export function toggleFavButtonState(btn, isSaved) {
  if (!btn) return;
  const heartIcon = btn.querySelector('.heart-icon');
  const favText = btn.querySelector('.fav-text');
  
  if (isSaved) {
    btn.classList.add('is-favorite');
    if (heartIcon) heartIcon.textContent = '❤️';
    if (favText) favText.textContent = 'Guardado';
    
    // Agregamos una micro-animación temporal de rebote
    btn.style.transform = 'scale(1.1)';
    setTimeout(() => btn.style.transform = '', 200);
  } else {
    btn.classList.remove('is-favorite');
    if (heartIcon) heartIcon.textContent = '🤍';
    if (favText) favText.textContent = 'Guardar';
  }
}
