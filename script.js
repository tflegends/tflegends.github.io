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
            await loadDashboard();
        } else {
            // Show the login page by default
            authContainer.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Failed to load card data:', error);
        alert('Failed to connect to the game server. Please try again later.');
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
            alert('Invalid username or password.');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('An error occurred during login. Please try again.');
    }
});

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newUsername = document.getElementById('signup-username').value;
    const newPassword = document.getElementById('signup-password').value;

    if (!newUsername || !newPassword) {
        return alert('Please enter both a username and password.');
    }

    try {
        const usersResponse = await fetch(`${API_BASE}/users`);
        const usersData = await usersResponse.json();

        if (usersData.data.some(u => u.username === newUsername)) {
            return alert('This username is already taken. Please choose another.');
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
            alert('Account created successfully! You can now log in.');
            showLogin();
        } else {
            alert('Failed to create account. Please try again.');
        }
    } catch (error) {
        console.error('Signup error:', error);
        alert('An error occurred during signup. Please try again.');
    }
});

function showSignup() {
    loginBox.classList.remove('active');
    signupBox.classList.add('active');
}

function showLogin() {
    signupBox.classList.remove('active');
    loginBox.classList.add('active');
}

logoutBtn.addEventListener('click', async () => {
    await updateOnlineStatus(false);
    localStorage.removeItem('tfm_user');
    currentUser = null;
    dashboardContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
    // Reload the page to reset the state
    window.location.reload(); 
});

// --- Dashboard Logic ---
async function loadDashboard() {
    authContainer.classList.add('hidden');
    dashboardContainer.classList.remove('hidden');
    await fetchAndUpdateUserData();
    renderUserCards();
    updateUI();
    
    // Set up a refresh interval to poll for updates
    setInterval(fetchAndUpdateUserData, 5000); 
}

async function fetchAndUpdateUserData() {
    try {
        const usersResponse = await fetch(`${API_BASE}/users`);
        const usersData = await usersResponse.json();
        const updatedUser = usersData.data.find(u => u.username === currentUser.username);

        if (updatedUser) {
            currentUser = updatedUser;
            localStorage.setItem('tfm_user', JSON.stringify(currentUser));
            updateUI();
            renderUserCards();
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

// --- Store Logic ---
buyCardBtn.addEventListener('click', async () => {
    const cost = 50; 
    if (currentUser.coins < cost) {
        alert("You don't have enough coins!");
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
            alert('Failed to purchase card.');
        }
    } catch (error) {
        console.error('Purchase error:', error);
        alert('An error occurred during your purchase.');
    }
});

// --- Navigation Logic ---
mainNav.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
        // Remove 'active' class from all buttons
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

// A simple UUID generator for new users, as LivePolls API might not generate it automatically.
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}
