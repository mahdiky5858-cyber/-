/* ===========================
   Weather Dashboard
   Using OpenWeatherMap API
   =========================== */

// Configuration
const API_KEY = 'open_free'; // Using Open-Meteo (free alternative) - no key needed
const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';

// DOM Elements
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const locationBtn = document.getElementById('location-btn');
const searchSuggestions = document.getElementById('search-suggestions');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error-message');
const currentWeatherDiv = document.getElementById('current-weather');
const forecastSection = document.getElementById('forecast-section');
const savedListDiv = document.getElementById('saved-list');
const lastUpdatedSpan = document.getElementById('last-updated');
const toggleUnitBtn = document.getElementById('toggle-unit');

// State
let currentUnit = 'celsius'; // celsius or fahrenheit
let currentLocation = null;
let weatherHistory = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSavedLocations();
    cityInput.addEventListener('input', handleSearchInput);
    searchBtn.addEventListener('click', handleSearch);
    locationBtn.addEventListener('click', getGeolocation);
    toggleUnitBtn.addEventListener('click', toggleUnit);
    document.addEventListener('click', closeSuggestions);

    // Load default location
    getWeather('London');
});

// Handle search input with debounce
let searchTimeout;
async function handleSearchInput(e) {
    const query = e.target.value.trim();
    
    clearTimeout(searchTimeout);
    
    if (query.length < 2) {
        closeSuggestions();
        return;
    }

    searchTimeout = setTimeout(() => {
        fetchCitySuggestions(query);
    }, 300);
}

// Fetch city suggestions
async function fetchCitySuggestions(query) {
    try {
        const response = await fetch(`${GEO_URL}?name=${encodeURIComponent(query)}&count=5&language=en`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            displaySuggestions(data.results);
        } else {
            closeSuggestions();
        }
    } catch (error) {
        console.error('Error fetching suggestions:', error);
    }
}

// Display suggestions
function displaySuggestions(results) {
    searchSuggestions.innerHTML = '';
    searchSuggestions.classList.remove('hidden');

    results.forEach(city => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `
            <strong>${city.name}</strong>
            ${city.admin1 ? `, ${city.admin1}` : ''}
            ${city.country ? `, ${city.country}` : ''}
        `;
        
        item.addEventListener('click', () => {
            cityInput.value = city.name;
            closeSuggestions();
            getWeather(city.name, city.latitude, city.longitude);
        });

        searchSuggestions.appendChild(item);
    });
}

// Close suggestions
function closeSuggestions() {
    searchSuggestions.classList.add('hidden');
    searchSuggestions.innerHTML = '';
}

// Handle search
function handleSearch() {
    const city = cityInput.value.trim();
    if (city) {
        getWeather(city);
        closeSuggestions();
    }
}

// Get geolocation
function getGeolocation() {
    if (navigator.geolocation) {
        showLoading();
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                getWeatherByCoordinates(latitude, longitude);
            },
            (error) => {
                showError('Unable to access your location');
                hideLoading();
            }
        );
    } else {
        showError('Geolocation is not supported by your browser');
    }
}

// Get weather by coordinates
async function getWeatherByCoordinates(lat, lon) {
    try {
        showLoading();
        const response = await fetch(
            `${BASE_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,pressure_msl,cloud_cover&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`
        );
        const data = await response.json();

        // Reverse geocoding to get city name
        const geoResponse = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
        );
        const geoData = await geoResponse.json();
        const cityName = geoData.address?.city || geoData.address?.town || 'Unknown Location';

        currentLocation = {
            name: cityName,
            latitude: lat,
            longitude: lon
        };

        displayWeather(data, cityName);
        hideLoading();
    } catch (error) {
        console.error('Error fetching weather:', error);
        showError('Failed to fetch weather data');
        hideLoading();
    }
}

// Get weather
async function getWeather(cityName, lat = null, lon = null) {
    try {
        showLoading();

        if (lat === null || lon === null) {
            // Geocode the city name
            const geoResponse = await fetch(
                `${GEO_URL}?name=${encodeURIComponent(cityName)}&count=1&language=en`
            );
            const geoData = await geoResponse.json();

            if (!geoData.results || geoData.results.length === 0) {
                showError(`City "${cityName}" not found`);
                hideLoading();
                return;
            }

            lat = geoData.results[0].latitude;
            lon = geoData.results[0].longitude;
            cityName = geoData.results[0].name;
        }

        currentLocation = {
            name: cityName,
            latitude: lat,
            longitude: lon
        };

        const response = await fetch(
            `${BASE_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,pressure_msl,cloud_cover,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,uv_index_max,sunrise,sunset&timezone=auto`
        );

        if (!response.ok) {
            throw new Error('API Error');
        }

        const data = await response.json();
        displayWeather(data, cityName);
        hideLoading();
        saveLocation(cityName, lat, lon);
    } catch (error) {
        console.error('Error fetching weather:', error);
        showError('Failed to fetch weather data. Please try again.');
        hideLoading();
    }
}

// Display weather
function displayWeather(data, cityName) {
    const current = data.current;
    const daily = data.daily;
    const timezone = data.timezone;

    // Update current weather
    const temp = Math.round(current.temperature_2m);
    const feelsLike = Math.round(current.apparent_temperature);
    const description = getWeatherDescription(current.weather_code);
    const icon = getWeatherIcon(current.weather_code);

    document.getElementById('city-name').textContent = cityName;
    document.getElementById('temperature').textContent = `${temp}°${currentUnit === 'celsius' ? 'C' : 'F'}`;
    document.getElementById('weather-description').textContent = description;
    document.getElementById('weather-icon').src = icon;
    document.getElementById('humidity').textContent = `${current.relative_humidity_2m}%`;
    document.getElementById('wind-speed').textContent = `${Math.round(current.wind_speed_10m)} km/h`;
    document.getElementById('pressure').textContent = `${Math.round(current.pressure_msl)} hPa`;
    document.getElementById('visibility').textContent = 'N/A';
    document.getElementById('uv-index').textContent = Math.round(current.uv_index);
    document.getElementById('feels-like').textContent = `${feelsLike}°${currentUnit === 'celsius' ? 'C' : 'F'}`;
    document.getElementById('clouds').textContent = `${current.cloud_cover}%`;
    document.getElementById('precipitation').textContent = `${current.precipitation} mm`;

    // Sunrise and sunset
    if (daily.sunrise && daily.sunrise[0]) {
        const sunrise = new Date(daily.sunrise[0]).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        const sunset = new Date(daily.sunset[0]).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        document.getElementById('sunrise').textContent = sunrise;
        document.getElementById('sunset').textContent = sunset;
    }

    // Update date/time
    updateDateTime(new Date());

    // Display forecast
    displayForecast(daily);

    // Show sections
    currentWeatherDiv.classList.remove('hidden');
    forecastSection.classList.remove('hidden');
    errorDiv.classList.add('hidden');

    // Update last updated time
    document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();
}

// Display forecast
function displayForecast(daily) {
    const forecastContainer = document.getElementById('forecast-container');
    forecastContainer.innerHTML = '';

    const days = 5;
    for (let i = 1; i < Math.min(days + 1, daily.time.length); i++) {
        const date = new Date(daily.time[i]);
        const maxTemp = Math.round(daily.temperature_2m_max[i]);
        const minTemp = Math.round(daily.temperature_2m_min[i]);
        const weatherCode = daily.weather_code[i];
        const description = getWeatherDescription(weatherCode);
        const icon = getWeatherIcon(weatherCode);

        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
            <div class="forecast-date">${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
            <img src="${icon}" alt="Weather" class="forecast-icon">
            <div class="forecast-temp">
                ${maxTemp}° / ${minTemp}°
            </div>
            <div class="forecast-desc">${description}</div>
        `;

        forecastContainer.appendChild(card);
    }
}

// Update date/time
function updateDateTime(date) {
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    document.getElementById('date-time').textContent = date.toLocaleDateString('en-US', options);
}

// Get weather description from WMO code
function getWeatherDescription(code) {
    const descriptions = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Foggy',
        48: 'Foggy',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        71: 'Slight snow',
        73: 'Moderate snow',
        75: 'Heavy snow',
        80: 'Slight rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        85: 'Slight snow showers',
        86: 'Heavy snow showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with hail',
        99: 'Thunderstorm with hail'
    };
    return descriptions[code] || 'Unknown';
}

// Get weather icon from WMO code
function getWeatherIcon(code) {
    if (code === 0) return '☀️';
    if (code === 1 || code === 2) return '⛅';
    if (code === 3) return '☁️';
    if (code === 45 || code === 48) return '🌫️';
    if (code >= 51 && code <= 55) return '🌧️';
    if (code >= 61 && code <= 65) return '🌧️';
    if (code >= 71 && code <= 75) return '❄️';
    if (code >= 80 && code <= 82) return '🌧️';
    if (code >= 85 && code === 86) return '❄️';
    if (code >= 95) return '⛈️';
    return '🌤️';
}

// Save location
function saveLocation(name, lat, lon) {
    const locations = JSON.parse(localStorage.getItem('weatherLocations')) || [];
    
    const exists = locations.some(loc => loc.name === name);
    if (!exists) {
        locations.push({ name, latitude: lat, longitude: lon });
        localStorage.setItem('weatherLocations', JSON.stringify(locations));
        loadSavedLocations();
    }
}

// Load saved locations
function loadSavedLocations() {
    const locations = JSON.parse(localStorage.getItem('weatherLocations')) || [];
    savedListDiv.innerHTML = '';

    if (locations.length === 0) {
        savedListDiv.innerHTML = '<p class="empty-state">No saved locations yet</p>';
        return;
    }

    locations.forEach((location, index) => {
        const item = document.createElement('div');
        item.className = 'saved-item';
        item.innerHTML = `
            <button class="remove-saved" onclick="removeLocation(${index})">×</button>
            <div class="saved-item-name">${location.name}</div>
            <div class="saved-item-temp">Click to view</div>
        `;

        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('remove-saved')) {
                getWeather(location.name, location.latitude, location.longitude);
                cityInput.value = location.name;
            }
        });

        savedListDiv.appendChild(item);
    });
}

// Remove location
function removeLocation(index) {
    const locations = JSON.parse(localStorage.getItem('weatherLocations')) || [];
    locations.splice(index, 1);
    localStorage.setItem('weatherLocations', JSON.stringify(locations));
    loadSavedLocations();
}

// Toggle temperature unit
function toggleUnit() {
    currentUnit = currentUnit === 'celsius' ? 'fahrenheit' : 'celsius';
    toggleUnitBtn.textContent = `Switch to °${currentUnit === 'celsius' ? 'F' : 'C'}`;

    if (currentLocation) {
        getWeather(currentLocation.name, currentLocation.latitude, currentLocation.longitude);
    }
}

// Show/hide loading
function showLoading() {
    loadingDiv.classList.remove('hidden');
}

function hideLoading() {
    loadingDiv.classList.add('hidden');
}

// Show error
function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    currentWeatherDiv.classList.add('hidden');
    forecastSection.classList.add('hidden');
}

// Auto-update weather every 10 minutes
setInterval(() => {
    if (currentLocation) {
        getWeather(currentLocation.name, currentLocation.latitude, currentLocation.longitude);
    }
}, 600000);