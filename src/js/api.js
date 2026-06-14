/**
 * Módulo de Conexión de Datos (MODEL - API) - Proyecto Final (WDD 330)
 * 
 * Migrado a GEOAPIFY API.
 * 
 * Este archivo centraliza la interconexión con APIs externas:
 * 1. Geolocation API (Nativa del Navegador envoltura en Promesa)
 * 2. Geoapify API (Geocodificación y Búsqueda de Puntos de Interés)
 * 3. Unsplash API (Buscador de fotos paisajísticas)
 * 
 * Aplica asincronía avanzada con async/await, control estructurado de
 * excepciones try/catch/finally y métodos de orden superior de JavaScript.
 * Incluye un simulador robusto de datos locales por si falla la conexión o las claves.
 */

// Carga de variables de entorno de Vite
const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_KEY;
const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_KEY;

// Imagen por defecto por si falla Unsplash o no hay claves configuradas
const FALLBACK_IMAGE_URL = 'https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=600&q=80';

/**
 * 🛰️ ENCAPSULACIÓN DE GEOLOCALIZACIÓN NATIVA EN PROMESA
 * Transforma el callback asíncrono de navigator.geolocation a una Promesa.
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
 * 🗺️ TRADUCCIÓN DE NOMBRE DE CIUDAD A COORDENADAS (Geoapify Geocoding)
 * Consume el endpoint 'search' de Geoapify.
 * 
 * @param {string} cityName Nombre del destino ingresado por el usuario.
 * @returns {Promise<Object>} Coordenadas lat y lon.
 */
export async function getCoordinatesByCity(cityName) {
  const isDummyKey = !GEOAPIFY_API_KEY || GEOAPIFY_API_KEY.includes('key_aqui') || GEOAPIFY_API_KEY.trim() === '';
  
  if (isDummyKey) {
    console.warn("API Key de Geoapify no configurada. Activando simulador para:", cityName);
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
    return { lat: 4.6097, lon: -74.0817, displayName: `${cityName} [Simulado]` };
  }

  try {
    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(cityName)}&apiKey=${GEOAPIFY_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.warn("API Key de Geoapify no autorizada. Cargando coordenadas simuladas.");
        return getMockCoordinates(cityName);
      }
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.features || data.features.length === 0) {
      throw new Error(`No pudimos localizar la ciudad "${cityName}". Verifica la ortografía.`);
    }
    
    const firstResult = data.features[0].properties;
    return {
      lat: firstResult.lat,
      lon: firstResult.lon,
      displayName: firstResult.formatted || cityName
    };
  } catch (error) {
    console.warn("Error en geocodificación de Geoapify. Cargando coordenadas simuladas.", error);
    return getMockCoordinates(cityName);
  }
}

/**
 * Coordenadas simuladas para geocodificación en caso de error o sin conexión.
 */
function getMockCoordinates(cityName) {
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
  return { lat: 4.6097, lon: -74.0817, displayName: `${cityName} [Simulado]` };
}

/**
 * 🌲 BÚSQUEDA DE PUNTOS ECOLÓGICOS Y TURÍSTICOS POR RADIO (Geoapify Places API)
 * Consume el endpoint '/places' de Geoapify.
 * 
 * @param {number} lat Latitud de origen.
 * @param {number} lon Longitud de origen.
 * @param {number} radiusKm Radio de búsqueda en kilómetros.
 * @returns {Promise<Array>} Lista de lugares limpios y procesados.
 */
export async function getPlacesByRadius(lat, lon, radiusKm) {
  const isDummyKey = !GEOAPIFY_API_KEY || GEOAPIFY_API_KEY.includes('key_aqui') || GEOAPIFY_API_KEY.trim() === '';

  if (isDummyKey) {
    console.warn("Utilizando destinos ecológicos simulados (Geoapify Modo offline).");
    return getMockPlaces(lat, lon, radiusKm);
  }

  try {
    const radiusMeters = radiusKm * 1000;
    // Categorías de Geoapify para turismo, monumentos históricos, parques naturales y áreas de esparcimiento
    const categories = 'tourism,historic,leisure.park,natural';
    const limit = 40;
    
    // El orden de las coordenadas en filter=circle de Geoapify DEBE ser lon,lat,radiusMeters
    const url = `https://api.geoapify.com/v2/places?categories=${categories}&filter=circle:${lon},${lat},${radiusMeters}&limit=${limit}&apiKey=${GEOAPIFY_API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.warn("API key de Geoapify no autorizada. Activando destinos simulados.");
        return getMockPlaces(lat, lon, radiusKm);
      }
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data || !data.features) {
      return [];
    }

    // ==========================================================================
    // 📐 FUNCIONES DE ORDEN SUPERIOR PARA PROCESAR Y FILTRAR DATOS
    // ==========================================================================
    
    // 1. Mapeamos la respuesta GeoJSON de Geoapify para ser compatible con la interfaz del Modelo
    const parsedPlaces = data.features.map(feature => {
      const props = feature.properties;
      return {
        xid: props.place_id, // Usamos place_id como xid único para persistencia y render
        name: props.name || props.formatted || '',
        distance: props.distance ? (props.distance / 1000).toFixed(1) : '0.0', // Geoapify devuelve metros
        kinds: props.categories ? props.categories.join(',') : '', // Mapeado para translateKinds
        lat: props.lat,
        lon: props.lon
      };
    });

    // 2. Filtramos registros incompletos (lugares sin nombre válido)
    const cleanPlaces = parsedPlaces.filter(place => 
      place.name && place.name.trim().length > 0 && !place.name.match(/^[\d\s\W]+$/)
    );

    // 3. Eliminamos duplicados por nombre
    const uniquePlaces = cleanPlaces.reduce((accumulator, current) => {
      const isDuplicated = accumulator.some(item => item.name.toLowerCase() === current.name.toLowerCase());
      if (!isDuplicated) {
        accumulator.push(current);
      }
      return accumulator;
    }, []);

    // 4. Ordenamos por distancia y seleccionamos los mejores 8
    return uniquePlaces
      .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance))
      .slice(0, 8);
  } catch (error) {
    console.warn("Error en la conexión con la API de Geoapify. Activando simulador local.", error);
    return getMockPlaces(lat, lon, radiusKm);
  }
}

/**
 * 📸 BÚSQUEDA DE IMÁGENES ECO-PAISAJÍSTICAS EN UNSPLASH
 */
export async function getPlacePhoto(query) {
  if (!UNSPLASH_ACCESS_KEY || UNSPLASH_ACCESS_KEY.trim() === '') {
    return FALLBACK_IMAGE_URL;
  }

  try {
    const searchQuery = `${query} nature landscape`;
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&client_id=${UNSPLASH_ACCESS_KEY}&per_page=1&orientation=landscape`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return FALLBACK_IMAGE_URL;
    }
    
    const data = await response.json();
    if (data && data.results && data.results.length > 0) {
      return data.results[0].urls.small || data.results[0].urls.regular || FALLBACK_IMAGE_URL;
    }
    return FALLBACK_IMAGE_URL;
  } catch (error) {
    console.warn(`Error al obtener foto de Unsplash para "${query}". Usando fallback.`, error);
    return FALLBACK_IMAGE_URL;
  }
}

/**
 * 🔄 FLUJO ASÍNCRONO ORQUESTADO COMPLETO
 */
export async function fetchFullPlacesData(lat, lon, radiusKm) {
  const places = await getPlacesByRadius(lat, lon, radiusKm);
  
  if (places.length === 0) {
    return [];
  }

  const photoPromises = places.map(async (place) => {
    const photoUrl = await getPlacePhoto(place.name);
    return {
      ...place,
      photoUrl
    };
  });

  return Promise.all(photoPromises);
}

/**
 * 🍃 GENERACIÓN DE DESTINOS MOCK (MODO DESARROLLO / OFFLINE)
 * Genera lugares eco-turísticos realistas para Cusco o genéricos según las coordenadas.
 */
function getMockPlaces(lat, lon, radiusKm) {
  const isCusco = Math.abs(Number(lat) - (-13.52)) < 1.0;
  
  if (isCusco) {
    return [
      {
        xid: "mock_cusco_1",
        name: "Santuario Histórico de Machu Picchu",
        distance: (radiusKm * 0.15).toFixed(1),
        kinds: "tourism,historic",
        lat: -13.1631,
        lon: -72.5450
      },
      {
        xid: "mock_cusco_2",
        name: "Valle Sagrado de los Incas",
        distance: (radiusKm * 0.35).toFixed(1),
        kinds: "natural,tourism",
        lat: -13.3167,
        lon: -72.1167
      },
      {
        xid: "mock_cusco_3",
        name: "Fortaleza Arqueológica de Sacsayhuamán",
        distance: "2.1",
        kinds: "historic",
        lat: -13.5078,
        lon: -71.9822
      },
      {
        xid: "mock_cusco_4",
        name: "Montaña de Siete Colores (Vinicunca)",
        distance: (radiusKm * 0.82).toFixed(1),
        kinds: "natural",
        lat: -13.8688,
        lon: -71.3030
      }
    ];
  }

  return [
    {
      xid: "mock_gen_1",
      name: "Reserva Natural Bosque de Duendes",
      distance: (radiusKm * 0.22).toFixed(1),
      kinds: "natural",
      lat: Number(lat) + 0.01,
      lon: Number(lon) - 0.01
    },
    {
      xid: "mock_gen_2",
      name: "Ruinas y Monumentos del Templo del Sol",
      distance: (radiusKm * 0.45).toFixed(1),
      kinds: "historic",
      lat: Number(lat) - 0.02,
      lon: Number(lon) + 0.02
    },
    {
      xid: "mock_gen_3",
      name: "Cascadas y Senderos Ecológicos Río Verde",
      distance: (radiusKm * 0.61).toFixed(1),
      kinds: "natural,tourism",
      lat: Number(lat) + 0.03,
      lon: Number(lon) + 0.01
    },
    {
      xid: "mock_gen_4",
      name: "Mirador Panorámico Los Volcanes",
      distance: (radiusKm * 0.3).toFixed(1),
      kinds: "tourism",
      lat: Number(lat) + 0.015,
      lon: Number(lon) - 0.015
    }
  ];
}
