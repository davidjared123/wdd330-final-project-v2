/**
 * Módulo de Persistencia Local (STORAGE) - Proyecto Final (WDD 330)
 * 
 * Abstrae las operaciones de lectura, escritura y eliminación en localStorage.
 * Garantiza que la aplicación funcione en modo offline (Offline Support)
 * para los destinos ecológicos que el usuario marque como favoritos.
 */

const STORAGE_KEY = 'el_localizador_favorites';

/**
 * Recupera la lista completa de favoritos guardados en localStorage.
 * Aplica el principio de decodificación JSON.
 * @returns {Array} Arreglo de objetos de lugares favoritos.
 */
export function getFavorites() {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    // Si no hay datos, retornamos un arreglo vacío
    return rawData ? JSON.parse(rawData) : [];
  } catch (error) {
    console.error('Error al decodificar favoritos desde localStorage:', error);
    return [];
  }
}

/**
 * Guarda un nuevo lugar en la lista de favoritos de localStorage.
 * Serializa la estructura de datos a cadena JSON mediante JSON.stringify.
 * @param {Object} place Objeto con los datos del lugar ecológico.
 */
export function saveFavorite(place) {
  if (!place || !place.xid) return;
  
  const favorites = getFavorites();
  
  // Evitamos duplicados buscando por su identificador único xid
  const exists = favorites.some(fav => fav.xid === place.xid);
  if (!exists) {
    favorites.push(place);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }
}

/**
 * Elimina un lugar de la lista de favoritos de localStorage.
 * Utiliza funciones de orden superior para filtrar y re-serializar los datos.
 * @param {string} xid Identificador único del lugar.
 */
export function removeFavorite(xid) {
  if (!xid) return;
  
  const favorites = getFavorites();
  // Filtramos la lista excluyendo el elemento a eliminar
  const updatedFavorites = favorites.filter(fav => fav.xid !== xid);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedFavorites));
}

/**
 * Verifica si un lugar ya ha sido agregado a favoritos.
 * @param {string} xid Identificador único del lugar.
 * @returns {boolean} True si está guardado, False en caso contrario.
 */
export function isFavorite(xid) {
  if (!xid) return false;
  const favorites = getFavorites();
  return favorites.some(fav => fav.xid === xid);
}
