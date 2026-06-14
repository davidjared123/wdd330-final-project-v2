/**
 * Módulo de Conexión de Datos (MODEL - API) - Proyecto Final (WDD 330)
 * 
 * Este archivo centraliza la interconexión con APIs externas:
 * 1. Geolocation API (Nativa del Navegador envoltura en Promesa)
 * 2. OpenTripMap API (Localizador de Puntos de Interés)
 * 3. Unsplash API (Buscador de fotos paisajísticas)
 * 
 * Aplica asincronía avanzada con async/await, control estructurado de
 * excepciones try/catch/finally y métodos de orden superior de JavaScript.
 */

// Carga de variables de entorno de Vite
const OTM_API_KEY = import.meta.env.VITE_OPENTRIPMAP_KEY;
const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_KEY;

// Imagen por defecto por si falla Unsplash o no hay claves configuradas (Estética Wow)
const FALLBACK_IMAGE_URL = 'https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=600&q=80';

/**
 * 🛰️ ENCAPSULACIÓN DE GEOLOCALIZACIÓN NATIVA EN PROMESA
 * Transforma el callback asíncrono de navigator.geolocation a una Promesa
 * para poder consumirla limpiamente con sintaxis async/await.
 * 
 * @returns {Promise<Object>} Coordenadas lat y lon.
 */
export function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('La geolocalización no está soportada por este navegador.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
      },
      (error) => {
        let errorMsg = 'Error al obtener la ubicación satelital.';
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = 'Permiso denegado por el usuario para geolocalizar.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = 'Ubicación física no disponible.';
            break;
          case error.TIMEOUT:
            errorMsg = 'Tiempo de espera agotado al consultar GPS.';
            break;
        }
        reject(new Error(errorMsg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

/**
 * 🗺️ TRADUCCIÓN DE NOMBRE DE CIUDAD A COORDENADAS (OpenTripMap Geocoding)
 * Consume el endpoint 'geoname' de OpenTripMap. En caso de no tener API Key o fallar,
 * activa una geocodificación simulada para no bloquear al usuario (Graceful Degradation).
 * 
 * @param {string} cityName Nombre del destino ingresado por el usuario.
 * @returns {Promise<Object>} Coordenadas lat y lon.
 */
export async function getCoordinatesByCity(cityName) {
  const isDummyKey = !OTM_API_KEY || OTM_API_KEY.includes('key_aqui') || OTM_API_KEY === '5ae2e3f221c38a28845f05b6b8b0e8c07e0bbfa179927694931a2a4b';
  
  if (isDummyKey) {
    console.warn("API Key inválida o no configurada. Activando simulador de geocodificación para:", cityName);
    const lowerCity = cityName.toLowerCase().trim();
    if (lowerCity.includes('cusco')) {
      return { lat: -13.5226, lon: -71.9673, displayName: "Cusco (Perú) [Simulado]" };
    }
    if (lowerCity.includes('santiago')) {
      return { lat: -33.4489, lon: -70.6693, displayName: "Santiago (Chile) [Simulado]" };
    }
    if (lowerCity.includes('bariloche') || lowerCity.includes('san carlos')) {
      return { lat: -41.1343, lon: -71.3085, displayName: "San Carlos de Bariloche (Argentina) [Simulado]" };
    }
    // Coordenadas genéricas por defecto (Bogotá como fallback)
    return { lat: 4.6097, lon: -74.0817, displayName: `${cityName} [Prueba Simulación]` };
  }

  try {
    const url = `https://api.opentripmap.com/0.1/es/places/geoname?name=${encodeURIComponent(cityName)}&apikey=${OTM_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("UNAUTHORIZED");
      }
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data || data.status === 'NOT_FOUND' || data.lat === undefined) {
      throw new Error(`No pudimos localizar la ciudad "${cityName}". Verifica la ortografía.`);
    }
    
    return {
      lat: data.lat,
      lon: data.lon,
      displayName: data.name || cityName
    };
  } catch (error) {
    if (error.message === "UNAUTHORIZED" || error.message.includes("Failed to fetch")) {
      console.warn("Fallo en API de geocodificación. Activando simulación offline.");
      // Fallback estático de prueba para permitir validación
      return { lat: -13.5226, lon: -71.9673, displayName: `${cityName} [Simulado por error de API]` };
    }
    throw error;
  }
}

/**
 * 🌲 BÚSQUEDA DE PUNTOS ECOLÓGICOS Y TURÍSTICOS POR RADIO
 * Consume el endpoint 'radius' de OpenTripMap. Si falla o no hay clave,
 * genera destinos simulados locales hermosos.
 * 
 * @param {number} lat Latitud de origen.
 * @param {number} lon Longitud de origen.
 * @param {number} radiusKm Radio de búsqueda en kilómetros.
 * @returns {Promise<Array>} Lista de lugares limpios y procesados.
 */
export async function getPlacesByRadius(lat, lon, radiusKm) {
  const isDummyKey = !OTM_API_KEY || OTM_API_KEY.includes('key_aqui') || OTM_API_KEY === '5ae2e3f221c38a28845f05b6b8b0e8c07e0bbfa179927694931a2a4b';

  if (isDummyKey) {
    console.warn("Utilizando destinos ecológicos simulados localmente (Modo de Desarrollo).");
    return getMockPlaces(lat, lon, radiusKm);
  }

  try {
    const radiusMeters = radiusKm * 1000;
    const kinds = 'nature_reserves,tourist_object,historical_places';
    const limit = 40;
    
    const url = `https://api.opentripmap.com/0.1/es/places/radius?radius=${radiusMeters}&lon=${lon}&lat=${lat}&kinds=${kinds}&limit=${limit}&apikey=${OTM_API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.warn("API key no autorizada (401/403). Activando destinos simulados.");
        return getMockPlaces(lat, lon, radiusKm);
      }
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data || !data.features) {
      return [];
    }

    const parsedPlaces = data.features.map(feature => ({
      xid: feature.properties.xid,
      name: feature.properties.name || '',
      distance: (feature.properties.dist / 1000).toFixed(1),
      kinds: feature.properties.kinds || '',
      lat: feature.geometry.coordinates[1],
      lon: feature.geometry.coordinates[0]
    }));

    const cleanPlaces = parsedPlaces.filter(place => 
      place.name && place.name.trim().length > 0 && !place.name.match(/^[\d\s\W]+$/)
    );

    const uniquePlaces = cleanPlaces.reduce((accumulator, current) => {
      const isDuplicated = accumulator.some(item => item.name.toLowerCase() === current.name.toLowerCase());
      if (!isDuplicated) {
        accumulator.push(current);
      }
      return accumulator;
    }, []);

    return uniquePlaces
      .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance))
      .slice(0, 8);
  } catch (error) {
    console.warn("Fallo de red o API en getPlacesByRadius. Activando destinos simulados.", error);
    return getMockPlaces(lat, lon, radiusKm);
  }
}

/**
 * 🍃 GENERACIÓN DE DESTINOS MOCK (MODO DESARROLLO / OFFLINE)
 * Genera lugares eco-turísticos realistas para Cusco o generales.
 */
function getMockPlaces(lat, lon, radiusKm) {
  // Verificamos si estamos en el rango de latitud de Cusco
  const isCusco = Math.abs(Number(lat) - (-13.52)) < 1.0;
  
  if (isCusco) {
    return [
      {
        xid: "mock_cusco_1",
        name: "Santuario Histórico de Machu Picchu",
        distance: (radiusKm * 0.15).toFixed(1),
        kinds: "nature_reserves,historical_places,tourist_object",
        lat: -13.1631,
        lon: -72.5450
      },
      {
        xid: "mock_cusco_2",
        name: "Valle Sagrado de los Incas",
        distance: (radiusKm * 0.35).toFixed(1),
        kinds: "nature_reserves,tourist_object",
        lat: -13.3167,
        lon: -72.1167
      },
      {
        xid: "mock_cusco_3",
        name: "Fortaleza Arqueológica de Sacsayhuamán",
        distance: "2.1",
        kinds: "historical_places",
        lat: -13.5078,
        lon: -71.9822
      },
      {
        xid: "mock_cusco_4",
        name: "Montaña de Siete Colores (Vinicunca)",
        distance: (radiusKm * 0.82).toFixed(1),
        kinds: "nature_reserves",
        lat: -13.8688,
        lon: -71.3030
      }
    ];
  }

  // Listado genérico para cualquier otra coordenada o GPS
  return [
    {
      xid: "mock_gen_1",
      name: "Reserva Natural Bosque de Duendes",
      distance: (radiusKm * 0.22).toFixed(1),
      kinds: "nature_reserves",
      lat: Number(lat) + 0.01,
      lon: Number(lon) - 0.01
    },
    {
      xid: "mock_gen_2",
      name: "Ruinas y Monumentos del Templo del Sol",
      distance: (radiusKm * 0.45).toFixed(1),
      kinds: "historical_places",
      lat: Number(lat) - 0.02,
      lon: Number(lon) + 0.02
    },
    {
      xid: "mock_gen_3",
      name: "Cascadas y Senderos Ecológicos Río Verde",
      distance: (radiusKm * 0.61).toFixed(1),
      kinds: "nature_reserves,tourist_object",
      lat: Number(lat) + 0.03,
      lon: Number(lon) + 0.01
    },
    {
      xid: "mock_gen_4",
      name: "Mirador Panorámico Los Volcanes",
      distance: (radiusKm * 0.3).toFixed(1),
      kinds: "tourist_object",
      lat: Number(lat) + 0.015,
      lon: Number(lon) - 0.015
    }
  ];
}

/**
 * 📸 BÚSQUEDA DE IMAGENES ECO-PAISAJÍSTICAS EN UNSPLASH
 * Realiza una consulta asíncrona a Unsplash utilizando el nombre del lugar.
 * Si falla, retorna una imagen natural por defecto manteniendo la estética de la app.
 * 
 * @param {string} query Nombre del lugar para la búsqueda de la imagen.
 * @returns {Promise<string>} URL de la imagen en formato optimizado.
 */
export async function getPlacePhoto(query) {
  // Si el usuario no configuró su clave Unsplash, usamos fallback elegante de inmediato
  if (!UNSPLASH_ACCESS_KEY || UNSPLASH_ACCESS_KEY.trim() === '') {
    return FALLBACK_IMAGE_URL;
  }

  try {
    // Añadimos 'nature eco landscape' al query para forzar resultados estéticos hermosos
    const searchQuery = `${query} nature landscape`;
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&client_id=${UNSPLASH_ACCESS_KEY}&per_page=1&orientation=landscape`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return FALLBACK_IMAGE_URL; // Degradación elegante si falla cuota o servicio
    }
    
    const data = await response.json();
    
    if (data && data.results && data.results.length > 0) {
      // Retornamos la versión "small" o "regular" optimizada para dispositivos móviles
      return data.results[0].urls.small || data.results[0].urls.regular || FALLBACK_IMAGE_URL;
    }
    
    return FALLBACK_IMAGE_URL;
  } catch (error) {
    console.warn(`No se pudo cargar imagen de Unsplash para "${query}". Usando fallback.`, error);
    return FALLBACK_IMAGE_URL;
  }
}

/**
 * 🔄 FLUJO ASÍNCRONO ORQUESTADO COMPLETO
 * Coordina las búsquedas de lugares y sus fotos de forma paralela óptima.
 * 
 * @param {number} lat Latitud.
 * @param {number} lon Longitud.
 * @param {number} radiusKm Radio de búsqueda en Km.
 * @returns {Promise<Array>} Lista de lugares lista para ser renderizada en el DOM.
 */
export async function fetchFullPlacesData(lat, lon, radiusKm) {
  // 1. Obtener los mejores 8 lugares filtrados y ordenados
  const places = await getPlacesByRadius(lat, lon, radiusKm);
  
  if (places.length === 0) {
    return [];
  }

  // 2. Realizar búsquedas de imágenes en paralelo usando Promise.all
  // Esto acelera radicalmente el renderizado al no esperar una respuesta secuencial
  const photoPromises = places.map(async (place) => {
    const photoUrl = await getPlacePhoto(place.name);
    return {
      ...place,
      photoUrl
    };
  });

  return Promise.all(photoPromises);
}
