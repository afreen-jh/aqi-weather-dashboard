let currentCityData = null;

// On Page Load
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (token) {
    showDashboard();
    fetchDashboardData('Delhi');
  } else {
    showAuth();
  }
});

// Navigation / Tabs
function switchTab(tab) {
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('signupForm').classList.toggle('hidden', tab !== 'signup');
  document.getElementById('loginTabBtn').classList.toggle('active', tab === 'login');
  document.getElementById('signupTabBtn').classList.toggle('active', tab === 'signup');
}

function showDashboard() {
  document.getElementById('authContainer').classList.add('hidden');
  document.getElementById('dashboardContainer').classList.remove('hidden');

  const user = JSON.parse(localStorage.getItem('user'));
  if (user) {
    document.getElementById('usernameDisplay').textContent = user.name || 'User';
    renderFavorites(user.favorites || []);
  }
}

function showAuth() {
  document.getElementById('authContainer').classList.remove('hidden');
  document.getElementById('dashboardContainer').classList.add('hidden');
}

function logout() {
  localStorage.clear();
  showAuth();
}

// Authentication Handler
async function handleAuth(event, type) {
  event.preventDefault();
  const endpoint = type === 'signup' ? '/api/auth/signup' : '/api/auth/login';
  
  const body = type === 'signup' ? {
    name: document.getElementById('signupName').value,
    email: document.getElementById('signupEmail').value,
    password: document.getElementById('signupPassword').value
  } : {
    email: document.getElementById('loginEmail').value,
    password: document.getElementById('loginPassword').value
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    showDashboard();
    fetchDashboardData('Delhi');
  } catch (err) {
    alert(err.message);
  }
}

// Fetch Weather & AQI
async function fetchDashboardData(queryCity) {
  const city = queryCity || document.getElementById('cityInput').value;
  if (!city) return;

  try {
    const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    currentCityData = data;
    renderWeather(data);
    updateStarStatus();
  } catch (err) {
    alert(err.message || 'Failed to retrieve weather/AQI data.');
  }
}

// Render Weather Cards & Health Guidelines
function renderWeather(data) {
  document.getElementById('weatherContent').classList.remove('hidden');
  document.getElementById('cityName').textContent = `${data.city}, ${data.country}`;
  document.getElementById('updateTime').textContent = `Updated: ${new Date().toLocaleTimeString()}`;
  document.getElementById('tempVal').textContent = `${data.temp} °C`;
  document.getElementById('weatherDesc').textContent = `(${data.description})`;

  // AQI Level Badges & Colors
  const aqiMap = {
    1: { text: 'AQI 1 - Good', class: 'aqi-1', measures: ['Air quality is ideal for all outdoor activities.', 'Ventilate rooms freely.'] },
    2: { text: 'AQI 2 - Fair', class: 'aqi-2', measures: ['Air quality is satisfactory. Enjoy outdoor activities.', 'Ventilate rooms freely.'] },
    3: { text: 'AQI 3 - Moderate', class: 'aqi-3', measures: ['Sensitive groups should consider reducing prolonged outdoor exertion.', 'Close windows during high peak hours.'] },
    4: { text: 'AQI 4 - Poor', class: 'aqi-4', measures: ['Wear an N95 mask outside.', 'Avoid prolonged outdoor exertion.'] },
    5: { text: 'AQI 5 - Very Poor', class: 'aqi-5', measures: ['Stay indoors as much as possible.', 'Run air purifiers indoors.'] }
  };

  const aqiInfo = aqiMap[data.aqi] || aqiMap[2];
  const badgeEl = document.getElementById('aqiBadge');
  badgeEl.textContent = aqiInfo.text;
  badgeEl.className = `aqi-badge ${aqiInfo.class}`;

  // Pollutants
  document.getElementById('pm25').textContent = data.components.pm2_5;
  document.getElementById('pm10').textContent = data.components.pm10;
  document.getElementById('no2').textContent = data.components.no2;
  document.getElementById('o3').textContent = data.components.o3;

  // Health Advice
  const healthList = document.getElementById('healthMeasures');
  healthList.innerHTML = aqiInfo.measures.map(m => `<li>${m}</li>`).join('');
}

// Favorite Management
async function toggleFavorite() {
  if (!currentCityData) return;

  const user = JSON.parse(localStorage.getItem('user'));
  const token = localStorage.getItem('token');
  const cityName = currentCityData.city;
  const isFav = user.favorites.includes(cityName);

  const method = isFav ? 'DELETE' : 'POST';

  try {
    const res = await fetch('/api/favorites', {
      method,
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ city: cityName })
    });

    const data = await res.json();
    if (res.ok) {
      user.favorites = data.favorites;
      localStorage.setItem('user', JSON.stringify(user));
      renderFavorites(user.favorites);
      updateStarStatus();
    }
  } catch (err) {
    console.error(err);
  }
}

function renderFavorites(favs) {
  const container = document.getElementById('favoritesList');
  if (!favs || favs.length === 0) {
    container.innerHTML = `<span class="empty-favs">No saved favorite cities.</span>`;
    return;
  }

  container.innerHTML = favs.map(city => 
    `<button class="fav-chip" onclick="searchFav('${city}')">${city}</button>`
  ).join('');
}

function searchFav(city) {
  document.getElementById('cityInput').value = city;
  fetchDashboardData(city);
}

function updateStarStatus() {
  const user = JSON.parse(localStorage.getItem('user'));
  const starBtn = document.getElementById('favStarBtn');
  if (currentCityData && user && user.favorites.includes(currentCityData.city)) {
    starBtn.classList.add('active');
  } else {
    starBtn.classList.remove('active');
  }
}