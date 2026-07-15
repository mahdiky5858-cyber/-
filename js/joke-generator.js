/* ===========================
   Joke Generator
   Using JokeAPI v2
   https://jokeapi.dev
   =========================== */

// Configuration
const JOKE_API_URL = 'https://v2.jokeapi.dev/joke';
const CATEGORIES = ['any', 'general', 'programming', 'knock-knock'];

// DOM Elements
const getJokeBtn = document.getElementById('get-joke-btn');
const revealBtn = document.getElementById('reveal-btn');
const copyBtn = document.getElementById('copy-btn');
const shareBtn = document.getElementById('share-btn');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const clearFavoritesBtn = document.getElementById('clear-favorites-btn');

const jokeTypeSelect = document.getElementById('joke-type-select');
const jokeContent = document.getElementById('joke-content');
const loadingDiv = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');

const jokeText = document.getElementById('joke-text');
const jokePunchline = document.getElementById('joke-punchline');
const jokeType = document.getElementById('joke-type');
const jokeId = document.getElementById('joke-id');

const historyList = document.getElementById('history-list');
const favoritesList = document.getElementById('favorites-list');
const totalJokesSpan = document.getElementById('total-jokes');
const favoriteCountSpan = document.getElementById('favorite-count');
const sessionTimeSpan = document.getElementById('session-time');

// State
let currentJoke = null;
let jokesHistory = [];
let favorites = [];
let selectedCategory = 'any';
let sessionStartTime = Date.now();

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadJokesFromStorage();
    setupEventListeners();
    updateStats();
    startSessionTimer();
    getRandomJoke();
});

// Setup Event Listeners
function setupEventListeners() {
    getJokeBtn.addEventListener('click', getRandomJoke);
    revealBtn.addEventListener('click', revealPunchline);
    copyBtn.addEventListener('click', copyJokeToClipboard);
    shareBtn.addEventListener('click', shareJoke);
    clearHistoryBtn.addEventListener('click', clearHistory);
    clearFavoritesBtn.addEventListener('click', clearFavorites);
    jokePunchline.addEventListener('click', revealPunchline);

    // Category buttons
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            e.target.closest('.category-btn').classList.add('active');
            selectedCategory = e.target.closest('.category-btn').dataset.category;
            getRandomJoke();
        });
    });

    // Joke type select
    jokePunchline.addEventListener('input', (e) => {
        selectedCategory = e.target.value;
        getRandomJoke();
    });
}

// Fetch Random Joke
async function getRandomJoke() {
    try {
        showLoading();
        hideError();
        hidePunchline();
        
        // Build API URL
        let url = JOKE_API_URL;
        
        if (selectedCategory && selectedCategory !== 'any') {
            url += `/${selectedCategory}`;
        } else {
            url += '/Any';
        }

        url += '?type=single,twopart&format=json';

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.message || 'Failed to fetch joke');
        }

        currentJoke = {
            id: data.id,
            category: data.category,
            type: data.type,
            setup: data.setup || data.joke,
            delivery: data.delivery || null,
            joke: data.joke,
            timestamp: new Date().toLocaleTimeString()
        };

        displayJoke(currentJoke);
        addToHistory(currentJoke);
        hideLoading();

    } catch (error) {
        console.error('Error fetching joke:', error);
        showError(`Failed to load joke: ${error.message}`);
        hideLoading();
    }
}

// Display Joke
function displayJoke(joke) {
    // Show setup/joke
    jokeText.textContent = joke.setup || joke.joke;
    
    // Handle punchline
    if (joke.delivery) {
        jokePunchline.textContent = joke.delivery;
        jokePunchline.classList.add('hidden');
        revealBtn.classList.remove('hidden');
    } else {
        jokePunchline.classList.add('hidden');
        revealBtn.classList.add('hidden');
    }

    // Show metadata
    jokeType.textContent = `${joke.category} ${joke.type === 'twopart' ? '(2-Part)' : ''}`;
    jokeId.textContent = `ID: ${joke.id}`;

    // Show controls
    jokeContent.classList.remove('hidden');
    copyBtn.classList.remove('hidden');
    shareBtn.classList.remove('hidden');

    // Add to favorites button indicator
    const isFavorite = favorites.some(fav => fav.id === joke.id);
    updateFavoriteButton(isFavorite);
}

// Reveal Punchline
function revealPunchline() {
    if (currentJoke && currentJoke.delivery) {
        jokePunchline.classList.remove('hidden');
        revealBtn.classList.add('hidden');
        showToast('Punchline revealed! 😄');
    }
}

// Copy Joke to Clipboard
function copyJokeToClipboard() {
    if (!currentJoke) return;

    let jokeText = currentJoke.setup || currentJoke.joke;
    
    if (currentJoke.delivery) {
        jokeText += `\n\n${currentJoke.delivery}`;
    }

    navigator.clipboard.writeText(jokeText).then(() => {
        showToast('Joke copied to clipboard! 📋');
    }).catch(() => {
        showToast('Failed to copy joke', 'error');
    });
}

// Share Joke
function shareJoke() {
    if (!currentJoke) return;

    let jokeText = currentJoke.setup || currentJoke.joke;
    
    if (currentJoke.delivery) {
        jokeText += `\n\n${currentJoke.delivery}`;
    }

    if (navigator.share) {
        navigator.share({
            title: 'Check out this joke!',
            text: jokeText
        }).catch(() => {
            showToast('Share failed', 'error');
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(jokeText);
        showToast('Joke copied! You can now paste it anywhere. 📤');
    }
}

// Add to History
function addToHistory(joke) {
    // Check if already in history
    const exists = jokesHistory.some(j => j.id === joke.id);
    
    if (!exists) {
        jokesHistory.unshift(joke);
        if (jokesHistory.length > 50) {
            jokesHistory.pop(); // Keep only last 50
        }
        saveToStorage();
        updateStats();
        updateHistoryDisplay();
    }
}

// Add to Favorites
function addToFavorites(joke) {
    const exists = favorites.some(fav => fav.id === joke.id);
    
    if (!exists) {
        favorites.unshift(joke);
        saveToStorage();
        updateStats();
        updateFavoritesDisplay();
        updateFavoriteButton(true);
        showToast('Added to favorites! ❤️');
    }
}

// Remove from Favorites
function removeFromFavorites(jokeId) {
    favorites = favorites.filter(fav => fav.id !== jokeId);
    saveToStorage();
    updateStats();
    updateFavoritesDisplay();
    if (currentJoke && currentJoke.id === jokeId) {
        updateFavoriteButton(false);
    }
    showToast('Removed from favorites');
}

// Update History Display
function updateHistoryDisplay() {
    if (jokesHistory.length === 0) {
        historyList.innerHTML = '<li class="empty-state"><i class="fas fa-folder-open"></i> No jokes yet. Get started!</li>';
        return;
    }

    historyList.innerHTML = jokesHistory.map((joke, index) => `
        <li>
            <div class="history-item-text">
                <strong>${joke.setup || joke.joke}</strong>
                <div style="font-size: 12px; color: #999; margin-top: 5px;">
                    ${joke.timestamp} • ${joke.category}
                </div>
            </div>
            <div class="history-item-actions">
                <button class="action-btn" onclick="usePreviousJoke(${index})" title="Use this joke">
                    <i class="fas fa-redo"></i>
                </button>
                <button class="action-btn" onclick="addToFavorites(jokesHistory[${index}])" title="Add to favorites">
                    <i class="fas fa-star"></i>
                </button>
                <button class="action-btn" onclick="navigator.clipboard.writeText('${escapeQuotes(joke.setup || joke.joke)}${joke.delivery ? '\\n\\n' + escapeQuotes(joke.delivery) : ''}')" title="Copy">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
        </li>
    `).join('');
}

// Update Favorites Display
function updateFavoritesDisplay() {
    if (favorites.length === 0) {
        favoritesList.innerHTML = '<li class="empty-state"><i class="fas fa-heart-broken"></i> No favorites yet!</li>';
        return;
    }

    favoritesList.innerHTML = favorites.map((joke, index) => `
        <li>
            <div class="favorite-item-text">
                <strong>${joke.setup || joke.joke}</strong>
                <div style="font-size: 12px; color: #999; margin-top: 5px;">
                    ${joke.category}
                </div>
            </div>
            <div class="favorite-item-actions">
                <button class="action-btn" onclick="usePreviousJoke(null, ${index})" title="Use this joke">
                    <i class="fas fa-redo"></i>
                </button>
                <button class="action-btn" onclick="removeFromFavorites(${joke.id})" title="Remove from favorites">
                    <i class="fas fa-trash"></i>
                </button>
                <button class="action-btn" onclick="navigator.clipboard.writeText('${escapeQuotes(joke.setup || joke.joke)}${joke.delivery ? '\\n\\n' + escapeQuotes(joke.delivery) : ''}')" title="Copy">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
        </li>
    `).join('');
}

// Use Previous Joke
function usePreviousJoke(historyIndex, favoriteIndex) {
    const joke = historyIndex !== null ? jokesHistory[historyIndex] : favorites[favoriteIndex];
    currentJoke = joke;
    displayJoke(joke);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Update Favorite Button
function updateFavoriteButton(isFavorite) {
    // Button to add/remove from favorites could be added here
}

// Clear History
function clearHistory() {
    if (confirm('Are you sure you want to clear all history?')) {
        jokesHistory = [];
        saveToStorage();
        updateStats();
        updateHistoryDisplay();
        showToast('History cleared');
    }
}

// Clear Favorites
function clearFavorites() {
    if (confirm('Are you sure you want to clear all favorites?')) {
        favorites = [];
        saveToStorage();
        updateStats();
        updateFavoritesDisplay();
        updateFavoriteButton(false);
        showToast('Favorites cleared');
    }
}

// Update Stats
function updateStats() {
    totalJokesSpan.textContent = jokesHistory.length;
    favoriteCountSpan.textContent = favorites.length;
}

// Session Timer
function startSessionTimer() {
    setInterval(() => {
        const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        sessionTimeSpan.textContent = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    }, 1000);
}

// Storage Functions
function saveToStorage() {
    localStorage.setItem('jokesHistory', JSON.stringify(jokesHistory));
    localStorage.setItem('jokeFavorites', JSON.stringify(favorites));
}

function loadJokesFromStorage() {
    const savedHistory = localStorage.getItem('jokesHistory');
    const savedFavorites = localStorage.getItem('jokeFavorites');
    
    if (savedHistory) {
        jokesHistory = JSON.parse(savedHistory);
        updateHistoryDisplay();
    }
    
    if (savedFavorites) {
        favorites = JSON.parse(savedFavorites);
        updateFavoritesDisplay();
    }
}

// UI Helpers
function showLoading() {
    loadingDiv.classList.remove('hidden');
    jokeContent.classList.add('hidden');
}

function hideLoading() {
    loadingDiv.classList.add('hidden');
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    jokeContent.classList.add('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}

function hidePunchline() {
    jokePunchline.classList.add('hidden');
    revealBtn?.classList.remove('hidden');
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    if (type === 'error') {
        toast.style.background = '#ff6b6b';
    }
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Utility Functions
function escapeQuotes(text) {
    return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
}