// This script provides the core functionality for the TFMultiversal Cards Platform.
// It handles user authentication, dashboard UI, card collection display,
// and the game's core logic using the LivePolls API.

// LivePolls API base URL
const API_BASE = 'https://sheets.livepolls.app/api/spreadsheets/3cfe8939-427d-4cde-9bbf-fc71573d8b08';

// Global game state
let allCards = [];
let currentUser = null;
let userCards = [];

// --- UI Element Selectors ---
const authContainer = document.getElementById('auth-container');
const loginBox = document.getElementById('login-box');
const signupBox = document.getElementById('signup-box');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const dashboardContainer = document.getElementById('dashboard-container');
const cardCollectionGrid = document.getElementById('card-collection-grid');
const mainNav = document.getElementById('main-nav');
const storeCostDisplay = document.getElementById('store-cost');
const buyCardBtn = document.getElementById('buy-card-btn');
const newCardNotification = document.getElementById('new-card-notification');
const userNameDisplay = document.getElementById('user-name');
const userCoinsDisplay = document.getElementById('user-coins');
const logoutBtn = document.getElementById('logout-btn');

// New UI selectors for modal and friend requests
const modalBackdrop = document.getElementById('modal-backdrop');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modal-content');
const modalCloseBtn = document.getElementById('modal-close-btn');
const friendRequestsList = document.getElementById('friend-requests-list');

// --- Initialization on Load ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    // Attempt to retrieve and parse all cards from the backend
    try {
        const cardsResponse = await fetch(`${API_BASE}/cards`);
        const cardsData = await cardsResponse.json();
        allCards = cardsData.data;

        // Auto-login if a user is stored in local storage
        const savedUser = localStorage.getItem('tfm_user');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            await updateOnlineStatus(true);
            await loadDashboard();
        } else {
            // Show the login page by default
            showAuth();
        }
    } catch (error) {
        console.error('Failed to load card data:', error);
        showMessage('Failed to connect to the game server. Please try again later.', true);
    }
}

// --- Login/Signup Logic ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const usersResponse = await fetch(`${API_BASE}/users`);
        const usersData = await usersResponse.json();
        const foundUser = usersData.data.find(u => u.username === username && u.password === password);

        if (foundUser) {
            currentUser = foundUser;
            localStorage.setItem('tfm_user', JSON.stringify(currentUser));
            await updateOnlineStatus(true);
            await loadDashboard();
        } else {
            showMessage('Invalid username or password.', true);
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('An error occurred during login. Please try again.', true);
    }
});

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newUsername = document.getElementById('signup-username').value;
    const newPassword = document.getElementById('signup-password').value;

    if (!newUsername || !newPassword) {
        return showMessage('Please enter both a username and password.', true);
    }

    try {
        const usersResponse = await fetch(`${API_BASE}/users`);
        const usersData = await usersResponse.json();

        if (usersData.data.some(u => u.username === newUsername)) {
            return showMessage('This username is already taken. Please choose another.', true);
        }

        // Get 4 random cards for the new user
        const initialCards = getRandomCards(4);
        const cardIds = initialCards.map(c => c.id).join(',');

        const newUserPayload = [{
            id: generateUUID(),
            username: newUsername,
            password: newPassword,
            cards: cardIds,
            coins: 0,
            online: "TRUE",
            wins: 0,
            losses: 0,
            friends: "",
            requesting: ""
        }];

        const postResponse = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUserPayload)
        });

        if (postResponse.ok) {
            showMessage('Account created successfully! You can now log in.');
        } else {
            showMessage('Failed to create account. Please try again.', true);
        }
    } catch (error) {
        console.error('Signup error:', error);
        showMessage('An error occurred during signup. Please try again.', true);
    }
});

logoutBtn.addEventListener('click', async () => {
    await updateOnlineStatus(false);
    localStorage.removeItem('tfm_user');
    currentUser = null;
    showAuth();
});

// --- Dashboard Logic ---
async function loadDashboard() {
    showDashboard();
    await fetchAndUpdateUserData();
    renderUserCards();
    updateUI();
    renderFriendRequests();
    
    // Set up a refresh interval to poll for updates
    setInterval(fetchAndUpdateUserData, 5000); 
}

async function fetchAndUpdateUserData() {
    try {
        const usersResponse = await fetch(`${API_BASE}/users`);
        const usersData = await usersResponse.json();
        const updatedUser = usersData.data.find(u => u.id === currentUser.id); // Use ID for unique identification

        if (updatedUser) {
            // Update the user data from the backend
            currentUser = updatedUser;
            localStorage.setItem('tfm_user', JSON.stringify(currentUser));
            updateUI();
            renderUserCards();
            renderFriendRequests();
        }
    } catch (error) {
        console.error('Failed to fetch user data:', error);
    }
}

function updateUI() {
    userNameDisplay.textContent = currentUser.username;
    userCoinsDisplay.textContent = currentUser.coins;
}

// --- Card Collection & Rendering ---
function renderUserCards() {
    const cardIds = currentUser.cards ? currentUser.cards.split(',') : [];
    userCards = allCards.filter(card => cardIds.includes(card.id));
    
    cardCollectionGrid.innerHTML = '';
    userCards.forEach(card => {
        const cardElement = createCardElement(card);
        cardCollectionGrid.appendChild(cardElement);
    });
}

function createCardElement(card) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    cardDiv.classList.add(`faction-${card.faction.toLowerCase()}`);
    
    const image = document.createElement('img');
    image.className = 'card-img';
    image.src = card.url;
    image.alt = card.name;

    const name = document.createElement('h3');
    name.className = 'card-name';
    name.textContent = card.name;

    const stats = document.createElement('div');
    stats.className = 'card-stats';
    stats.innerHTML = `
        <div class="stat"><span>Attack</span><span class="stat-value">${card.attack}</span></div>
        <div class="stat"><span>Health</span><span class="stat-value">${card.health}</span></div>
        <div class="stat"><span>Defense</span><span class="stat-value">${card.defense}</span></div>
    `;

    cardDiv.appendChild(image);
    cardDiv.appendChild(name);
    cardDiv.appendChild(stats);
    return cardDiv;
}

// --- Friend Requests Logic ---
function renderFriendRequests() {
    // This is a placeholder. You'll need to implement logic to
    // fetch friend requests from the API and render them here.
    // For now, it just displays a message.
    friendRequestsList.innerHTML = '<p class="empty-message">You have no new friend requests.</p>';
}

// --- Store Logic ---
buyCardBtn.addEventListener('click', async () => {
    const cost = 50; 
    if (currentUser.coins < cost) {
        showMessage("You don't have enough coins!", true);
        return;
    }
    
    // Deduct coins and get a new card
    currentUser.coins -= cost;
    const newCard = getRandomCard();
    const updatedCards = currentUser.cards ? `${currentUser.cards},${newCard.id}` : newCard.id;

    // Update the user data in the backend
    const updatedUserPayload = [{
        id: currentUser.id, // LivePolls requires the ID for a PUT request
        username: currentUser.username,
        password: currentUser.password,
        cards: updatedCards,
        coins: currentUser.coins,
        online: currentUser.online,
        wins: currentUser.wins,
        losses: currentUser.losses,
        friends: currentUser.friends,
        requesting: currentUser.requesting
    }];

    try {
        const putResponse = await fetch(`${API_BASE}/users`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedUserPayload)
        });

        if (putResponse.ok) {
            currentUser.cards = updatedCards;
            
            // Show notification
            newCardNotification.textContent = `You got a new card: ${newCard.name}!`;
            newCardNotification.style.display = 'block';
            setTimeout(() => { newCardNotification.style.display = 'none'; }, 5000);

            // Update UI
            updateUI();
            renderUserCards();
        } else {
            showMessage('Failed to purchase card.', true);
        }
    } catch (error) {
        console.error('Purchase error:', error);
        showMessage('An error occurred during your purchase.', true);
    }
});

// --- Navigation Logic ---
mainNav.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
        // Remove 'active' class from all in-page buttons
        mainNav.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
        // Add 'active' to the clicked button
        e.target.classList.add('active');

        // Hide all content views
        document.querySelectorAll('.content-view').forEach(view => view.classList.remove('active-view'));
        
        // Show the selected view
        const targetView = document.getElementById(e.target.dataset.view + '-view');
        if (targetView) {
            targetView.classList.add('active-view');
        }
    }
});

// --- Helper Functions ---
function getRandomCards(count) {
    const shuffled = [...allCards].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

function getRandomCard() {
    const randomIndex = Math.floor(Math.random() * allCards.length);
    return allCards[randomIndex];
}

function updateOnlineStatus(isOnline) {
    if (!currentUser) return;
    const updatePayload = [{
        id: currentUser.id,
        online: isOnline ? "TRUE" : "FALSE"
    }];

    return fetch(`${API_BASE}/users`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
    }).catch(console.error);
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// --- UI Toggle Functions ---
function showAuth() {
    authContainer.classList.remove('hidden');
    dashboardContainer.classList.add('hidden');
}

function showDashboard() {
    authContainer.classList.add('hidden');
    dashboardContainer.classList.remove('hidden');
}

// --- Custom Modal Functions ---
function showModal(content) {
    modalContent.innerHTML = content;
    modal.classList.remove('hidden');
    modalBackdrop.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
    modalBackdrop.classList.add('hidden');
}

// Show a message in a custom modal instead of an alert()
function showMessage(message, isError = false) {
    let content = `<p class="modal-message ${isError ? 'error-message' : ''}">${message}</p>`;
    showModal(content);
}
