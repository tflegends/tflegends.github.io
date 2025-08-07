// This script provides the core functionality for the TFMultiversal Cards Platform.
// It handles user authentication, dashboard UI, card collection display,
// and the game's core logic using the LivePolls API.

// LivePolls API base URL
const API_BASE = 'https://sheets.livepolls.app/api/spreadsheets/3cfe8939-427d-4cde-9bbf-fc71573d8b08';

// Global game state
let allCards = [];
let currentUser = null;
let userCards = [];
let currentChatFriend = null;
let currentBattle = null;
let currentBattleInterval = null;
let dashboardInterval = null;

// --- UI Element Selectors ---
const authContainer = document.getElementById('auth-container');
const loginBox = document.getElementById('login-box');
const signupBox = document.getElementById('signup-box');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const dashboardContainer = document.getElementById('dashboard-container');
const cardCollectionGrid = document.getElementById('card-collection-grid');
const mainNav = document.getElementById('main-nav');
const userNameDisplay = document.getElementById('user-name');
const userCoinsDisplay = document.getElementById('user-coins');
const logoutBtn = document.getElementById('logout-btn');

// View selectors
const viewContents = document.querySelectorAll('.view-content');
const collectionView = document.getElementById('collection-view');
const friendsView = document.getElementById('friends-view');
const leaderboardView = document.getElementById('leaderboard-view');
const storeView = document.getElementById('store-view');
const battleView = document.getElementById('battle-view');

// New UI selectors for modal, friend requests, leaderboard, and chat
const modalBackdrop = document.getElementById('modal-backdrop');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modal-content');
const modalCloseBtn = document.getElementById('modal-close-btn');
const friendRequestsList = document.getElementById('friend-requests-list');
const friendRequestForm = document.getElementById('friend-request-form');
const friendUsernameInput = document.getElementById('friend-username');
const leaderboardBody = document.getElementById('leaderboard-body');
const friendsList = document.getElementById('friends-list');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const currentChatFriendDisplay = document.getElementById('current-chat-friend');

// New UI selectors for the Battle page
const battleArea = document.getElementById('battle-area');
const findBattleBtn = document.getElementById('find-battle-btn');
const battleStatus = document.getElementById('battle-status');
const opponentName = document.getElementById('opponent-name');
const opponentHealthBar = document.getElementById('opponent-health-bar');
const opponentHealthValue = document.getElementById('opponent-health-value');
const opponentHand = document.getElementById('opponent-hand');
const playerName = document.getElementById('player-name');
const playerHealthBar = document.getElementById('player-health-bar');
const playerHealthValue = document.getElementById('player-health-value');
const playerHand = document.getElementById('player-hand');
const battleLog = document.getElementById('battle-log');
const endTurnBtn = document.getElementById('end-turn-btn');
const playerField = document.getElementById('player-field');
const opponentField = document.getElementById('opponent-field');

// Store page selectors
const storeItemsGrid = document.getElementById('store-items-grid');

// --- Initialization on Load ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();

    // Event listeners for view navigation
    if (mainNav) {
        mainNav.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') {
                e.preventDefault();
                const view = e.target.dataset.view;
                showView(view);
                // Update active nav button
                document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
            }
        });
    }

    if (findBattleBtn) {
        findBattleBtn.addEventListener('click', findOpponent);
    }
    if (endTurnBtn) {
        endTurnBtn.addEventListener('click', handleEndTurn);
    }
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
            loadDashboard();
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
if (loginForm) {
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
                loadDashboard();
            } else {
                showMessage('Invalid username or password.', true);
            }
        } catch (error) {
            console.error('Login error:', error);
            showMessage('An error occurred during login. Please try again.', true);
        }
    });
}

if (signupForm) {
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
                toggleAuth('login');
            } else {
                showMessage('Failed to create account. Please try again.', true);
            }
        } catch (error) {
            console.error('Signup error:', error);
            showMessage('An error occurred during signup. Please try again.', true);
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await updateOnlineStatus(false);
        localStorage.removeItem('tfm_user');
        currentUser = null;
        showAuth();
        if (currentBattleInterval) clearInterval(currentBattleInterval);
        if (dashboardInterval) clearInterval(dashboardInterval);
    });
}

// --- Dashboard Logic ---
function loadDashboard() {
    showDashboard();
    fetchAndUpdateUserData();
    showView('collection');
    dashboardInterval = setInterval(fetchAndUpdateUserData, 5000);
}

async function fetchAndUpdateUserData() {
    try {
        const usersResponse = await fetch(`${API_BASE}/users`);
        const usersData = await usersResponse.json();
        const updatedUser = usersData.data.find(u => u.id === currentUser.id);

        if (updatedUser) {
            currentUser = updatedUser;
            localStorage.setItem('tfm_user', JSON.stringify(currentUser));
            updateUI();
            renderUserCards();
            renderFriendRequests();
            renderFriendsList();
            renderLeaderboard();
            renderStore();
        }
    } catch (error) {
        console.error('Failed to fetch user data:', error);
    }
}

function updateUI() {
    if (userNameDisplay && userCoinsDisplay && currentUser) {
        userNameDisplay.textContent = currentUser.username;
        userCoinsDisplay.textContent = currentUser.coins;
    }
}

// --- Card Collection & Rendering ---
function renderUserCards() {
    if (!cardCollectionGrid || !currentUser) return;
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
    cardDiv.dataset.cardId = card.id;

    const image = document.createElement('img');
    image.className = 'card-img';
    image.src = card.url;
    image.alt = card.name;
    
    let attackValue = parseInt(card.attack);
    let healthValue = parseInt(card.health);
    let defenseValue = parseInt(card.defense);
    let isModified = false;

    // Apply Star multiplier (MTM/MAX)
    if (card.star === 'MTM') {
        attackValue = Math.round(attackValue * 1.25);
        healthValue = Math.round(healthValue * 1.25);
        defenseValue = Math.round(defenseValue * 1.25);
        isModified = true;
    } else if (card.star === 'MAX') {
        attackValue = Math.round(attackValue * 1.5);
        healthValue = Math.round(healthValue * 1.5);
        defenseValue = Math.round(defenseValue * 1.5);
        isModified = true;
    }
    
    // Apply Bonus multiplier (if any)
    const bonusMultiplier = card.bonus ? parseFloat(card.bonus) : 1;
    if (bonusMultiplier > 1) {
        attackValue = Math.round(attackValue * bonusMultiplier);
        healthValue = Math.round(healthValue * bonusMultiplier);
        defenseValue = Math.round(defenseValue * bonusMultiplier);
        isModified = true;
    }

    const name = document.createElement('h3');
    name.className = 'card-name';
    name.textContent = card.name;

    const stats = document.createElement('div');
    stats.className = 'card-stats';
    stats.innerHTML = `
        <div class="stat"><span>Attack</span><span class="stat-value ${isModified ? 'modified-stat' : ''}">${attackValue}</span></div>
        <div class="stat"><span>Health</span><span class="stat-value ${isModified ? 'modified-stat' : ''}">${healthValue}</span></div>
        <div class="stat"><span>Defense</span><span class="stat-value ${isModified ? 'modified-stat' : ''}">${defenseValue}</span></div>
    `;

    cardDiv.appendChild(image);
    cardDiv.appendChild(name);
    cardDiv.appendChild(stats);
    return cardDiv;
}

// --- Friend Requests Logic ---
if (friendRequestForm) {
    friendRequestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const friendUsername = friendUsernameInput.value.trim();

        if (!friendUsername) {
            showMessage('Please enter a username.', true);
            return;
        }

        if (friendUsername === currentUser.username) {
            showMessage('You cannot send a friend request to yourself.', true);
            return;
        }

        try {
            const usersResponse = await fetch(`${API_BASE}/users`);
            const usersData = await usersResponse.json();
            const friendUser = usersData.data.find(u => u.username === friendUsername);

            if (!friendUser) {
                showMessage(`User '${friendUsername}' not found.`, true);
                return;
            }

            // Check if a request has already been sent or if they are already friends
            const requestingUsers = friendUser.requesting ? friendUser.requesting.split(',') : [];
            const currentUserFriends = currentUser.friends ? currentUser.friends.split(',') : [];
            if (requestingUsers.includes(currentUser.username) || currentUserFriends.includes(friendUser.username)) {
                showMessage(`You have already sent a request to or are friends with '${friendUsername}'.`, true);
                return;
            }

            const updatedRequesting = friendUser.requesting ? `${friendUser.requesting},${currentUser.username}` : currentUser.username;
            const updatePayload = [{
                id: friendUser.id,
                requesting: updatedRequesting
            }];

            const putResponse = await fetch(`${API_BASE}/users`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload)
            });

            if (putResponse.ok) {
                showMessage(`Friend request sent to '${friendUsername}'!`);
                friendUsernameInput.value = '';
            } else {
                showMessage('Failed to send friend request. Please try again.', true);
            }
        } catch (error) {
            console.error('Friend request error:', error);
            showMessage('An error occurred while sending the friend request.', true);
        }
    });
}

function renderFriendRequests() {
    if (!friendRequestsList) return;
    const requestingUsers = currentUser.requesting ? currentUser.requesting.split(',') : [];
    friendRequestsList.innerHTML = '';

    if (requestingUsers.length === 0) {
        friendRequestsList.innerHTML = '<p class="empty-message">You have no new friend requests.</p>';
        return;
    }

    requestingUsers.forEach(username => {
        const requestDiv = document.createElement('div');
        requestDiv.className = 'friend-request';
        requestDiv.innerHTML = `
            <span>${username}</span>
            <div class="friend-request-actions">
                <button class="accept-btn" data-username="${username}">Accept</button>
                <button class="decline-btn" data-username="${username}">Decline</button>
            </div>
        `;
        friendRequestsList.appendChild(requestDiv);
    });

    friendRequestsList.querySelectorAll('.accept-btn').forEach(button => {
        button.addEventListener('click', handleFriendRequestAction);
    });
    friendRequestsList.querySelectorAll('.decline-btn').forEach(button => {
        button.addEventListener('click', handleFriendRequestAction);
    });
}

async function handleFriendRequestAction(e) {
    const action = e.target.textContent;
    const friendUsername = e.target.dataset.username;

    try {
        const usersResponse = await fetch(`${API_BASE}/users`);
        const usersData = await usersResponse.json();
        const friendUser = usersData.data.find(u => u.username === friendUsername);
        
        let updatedRequesting = currentUser.requesting.split(',').filter(u => u !== friendUsername).join(',');
        
        const updatePayload = [{
            id: currentUser.id,
            requesting: updatedRequesting
        }];

        if (action === 'Accept') {
            let updatedFriends = currentUser.friends ? `${currentUser.friends},${friendUsername}` : friendUsername;
            let friendUpdatedFriends = friendUser.friends ? `${friendUser.friends},${currentUser.username}` : friendUser.username;
            
            updatePayload[0].friends = updatedFriends;
            
            const friendUpdatePayload = [{
                id: friendUser.id,
                friends: friendUpdatedFriends
            }];

            await fetch(`${API_BASE}/users`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(friendUpdatePayload)
            });

            showMessage(`You are now friends with ${friendUsername}!`);
        } else if (action === 'Decline') {
            showMessage(`You have declined the request from ${friendUsername}.`);
        }

        await fetch(`${API_BASE}/users`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload)
        });

        fetchAndUpdateUserData();
    } catch (error) {
        console.error(`Error handling friend request (${action}):`, error);
        showMessage('An error occurred. Please try again.', true);
    }
}


// --- Leaderboard Logic & Rendering ---
async function renderLeaderboard() {
    if (!leaderboardBody) return;
    try {
        const usersResponse = await fetch(`${API_BASE}/users`);
        const usersData = await usersResponse.json();
        const users = usersData.data;

        users.sort((a, b) => b.wins - a.wins);

        leaderboardBody.innerHTML = '';
        users.forEach((user, index) => {
            const wins = parseInt(user.wins);
            const losses = parseInt(user.losses);
            const totalGames = wins + losses;
            const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(2) : 0;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${user.username}</td>
                <td>${wins}</td>
                <td>${losses}</td>
                <td>${winRate}%</td>
            `;
            leaderboardBody.appendChild(row);
        });
    } catch (error) {
            console.error('Failed to render leaderboard:', error);
            showMessage('Failed to load leaderboard data. Please try again later.', true);
    }
}

// --- Chat Logic & Rendering ---
function renderFriendsList() {
    if (!friendsList) return;
    const friends = currentUser.friends ? currentUser.friends.split(',') : [];
    friendsList.innerHTML = '';

    if (friends.length === 0) {
        friendsList.innerHTML = '<p class="empty-message">Add friends to start chatting.</p>';
        return;
    }

    friends.forEach(friendUsername => {
        const friendDiv = document.createElement('div');
        friendDiv.className = 'friend-item';
        friendDiv.textContent = friendUsername;
        friendDiv.dataset.username = friendUsername;
        friendDiv.addEventListener('click', () => {
            currentChatFriend = friendUsername;
            currentChatFriendDisplay.textContent = `Chat with ${friendUsername}`;
            loadChatHistory(currentChatFriend);
        });
        friendsList.appendChild(friendDiv);
    });
}

async function loadChatHistory(friendUsername) {
    if (!chatMessages) return;
    try {
        const chatResponse = await fetch(`${API_BASE}/chat`);
        const chatData = await chatResponse.json();
        const messages = chatData.data.filter(msg =>
            (msg.user1 === currentUser.username && msg.user2 === friendUsername) ||
            (msg.user1 === friendUsername && msg.user2 === currentUser.username)
        );

        renderMessages(messages);
    } catch (error) {
        console.error('Failed to load chat history:', error);
        showMessage('Failed to load chat messages. Please try again.', true);
    }
}

function renderMessages(messages) {
    if (!chatMessages) return;
    chatMessages.innerHTML = '';
    
    if (messages.length === 0) {
        chatMessages.innerHTML = '<p class="empty-message">No messages yet. Say hello!</p>';
        return;
    }

    messages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${msg.user1 === currentUser.username ? 'sent' : 'received'}`;
        msgDiv.textContent = msg.text;
        chatMessages.appendChild(msgDiv);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = messageInput.value.trim();

        if (!message || !currentChatFriend) {
            return;
        }

        const newMessagePayload = [{
            id: generateUUID(),
            user1: currentUser.username,
            user2: currentChatFriend,
            text: message,
            timestamp: new Date().toISOString(),
            read: "FALSE"
        }];

        try {
            const postResponse = await fetch(`${API_BASE}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newMessagePayload)
            });

            if (postResponse.ok) {
                messageInput.value = '';
                loadChatHistory(currentChatFriend);
            } else {
                showMessage('Failed to send message. Please try again.', true);
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            showMessage('An error occurred while sending the message.', true);
        }
    });
}

// --- Battle Logic & Rendering ---
function loadBattle() {
    if (!battleArea) return;
    battleArea.classList.add('hidden');
    battleStatus.textContent = 'Ready to battle!';
    findBattleBtn.classList.remove('hidden');
}

async function findOpponent() {
    if (!currentUser) return showMessage('Please log in to start a battle.', true);

    findBattleBtn.classList.add('hidden');
    battleStatus.textContent = 'Searching for an opponent...';

    // This is a simple mock for finding an opponent. In a real game, this would be a more complex matchmaking system.
    try {
        const usersResponse = await fetch(`${API_BASE}/users`);
        const usersData = await usersResponse.json();
        const opponents = usersData.data.filter(u => u.id !== currentUser.id && u.online === 'TRUE');

        if (opponents.length > 0) {
            const opponent = opponents[Math.floor(Math.random() * opponents.length)];
            await startBattle(opponent);
        } else {
            battleStatus.textContent = 'No online opponents found. Try again in a bit.';
            findBattleBtn.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Failed to find opponent:', error);
        showMessage('An error occurred while searching for an opponent.', true);
        findBattleBtn.classList.remove('hidden');
    }
}

async function startBattle(opponent) {
    const playerHealth = 100;
    const opponentHealth = 100;
    const playerCardIds = currentUser.cards ? currentUser.cards.split(',') : [];
    const opponentCardIds = opponent.cards ? opponent.cards.split(',') : [];
    
    if (playerCardIds.length < 4 || opponentCardIds.length < 4) {
        showMessage('Both players need at least 4 cards to battle.', true);
        findBattleBtn.classList.remove('hidden');
        return;
    }
    
    // Shuffle and deal 4 cards to each player
    const shuffledPlayerCards = [...playerCardIds].sort(() => 0.5 - Math.random()).slice(0, 4);
    const shuffledOpponentCards = [...opponentCardIds].sort(() => 0.5 - Math.random()).slice(0, 4);

    const newBattlePayload = [{
        id: generateUUID(),
        player1: currentUser.username,
        player1cards: shuffledPlayerCards.join(','),
        player1health: playerHealth,
        player1rem: shuffledPlayerCards.join(','), // Cards remaining in hand
        player2: opponent.username,
        player2cards: shuffledOpponentCards.join(','),
        player2health: opponentHealth,
        player2rem: shuffledOpponentCards.join(','),
        turn: currentUser.username, // Player 1 starts
        log: 'Battle begins!',
        status: 'active',
        winner: '',
        startstamp: new Date().toISOString(),
        endstamp: ''
    }];

    try {
        const postResponse = await fetch(`${API_BASE}/battle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newBattlePayload)
        });

        if (postResponse.ok) {
            const battleData = await postResponse.json();
            currentBattle = battleData.data[0];
            renderBattleUI();
            currentBattleInterval = setInterval(pollBattleStatus, 3000);
        } else {
            showMessage('Failed to start battle. Please try again.', true);
            findBattleBtn.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Start battle error:', error);
        showMessage('An error occurred while starting the battle.', true);
        findBattleBtn.classList.remove('hidden');
    }
}

async function pollBattleStatus() {
    if (!currentBattle) {
        clearInterval(currentBattleInterval);
        return;
    }
    try {
        const battleResponse = await fetch(`${API_BASE}/battle`);
        const battles = await battleResponse.json();
        const updatedBattle = battles.data.find(b => b.id === currentBattle.id);

        if (updatedBattle) {
            currentBattle = updatedBattle;
            renderBattleUI();
            checkWinCondition();
        }
    } catch (error) {
        console.error('Failed to poll battle status:', error);
    }
}

function renderBattleUI() {
    if (!currentBattle) return;

    battleArea.classList.remove('hidden');
    findBattleBtn.classList.add('hidden');
    battleStatus.textContent = `Turn: ${currentBattle.turn}`;

    const isPlayer1 = currentBattle.player1 === currentUser.username;
    const player = isPlayer1 ? 'player1' : 'player2';
    const opponent = isPlayer1 ? 'player2' : 'player1';

    // Update names and health
    playerName.textContent = isPlayer1 ? currentBattle.player1 : currentBattle.player2;
    opponentName.textContent = isPlayer1 ? currentBattle.player2 : currentBattle.player1;
    
    playerHealthValue.textContent = currentBattle[`${player}health`];
    opponentHealthValue.textContent = currentBattle[`${opponent}health`];

    // Update health bars
    playerHealthBar.style.width = `${currentBattle[`${player}health`]}%`;
    opponentHealthBar.style.width = `${currentBattle[`${opponent}health`]}%`;

    // Render player's hand
    playerHand.innerHTML = '';
    const playerCardIds = currentBattle[`${player}rem`].split(',');
    playerCardIds.forEach(cardId => {
        const card = allCards.find(c => c.id === cardId);
        if (card) {
            const cardElement = createCardElement(card);
            cardElement.addEventListener('click', () => handleCardPlay(card.id));
            playerHand.appendChild(cardElement);
        }
    });

    // Render opponent's hand (as back-of-card placeholders)
    opponentHand.innerHTML = '';
    const opponentCardIds = currentBattle[`${opponent}rem`].split(',');
    opponentCardIds.forEach(() => {
        const cardBack = document.createElement('div');
        cardBack.className = 'card-back';
        opponentHand.appendChild(cardBack);
    });

    // Render active cards on the field
    playerField.innerHTML = '';
    opponentField.innerHTML = '';

    const playerActiveCardId = currentBattle[`${player}cardsonfield`];
    const opponentActiveCardId = currentBattle[`${opponent}cardsonfield`];

    if (playerActiveCardId) {
        const playerActiveCard = allCards.find(c => c.id === playerActiveCardId);
        if (playerActiveCard) {
            playerField.appendChild(createCardElement(playerActiveCard));
        }
    }

    if (opponentActiveCardId) {
        const opponentActiveCard = allCards.find(c => c.id === opponentActiveCardId);
        if (opponentActiveCard) {
            opponentField.appendChild(createCardElement(opponentActiveCard));
        }
    }
    
    // Update battle log
    battleLog.textContent = currentBattle.log;

    // Enable/disable 'End Turn' button
    if (currentBattle.turn === currentUser.username) {
        endTurnBtn.classList.remove('hidden');
        playerHand.classList.add('active-turn');
    } else {
        endTurnBtn.classList.add('hidden');
        playerHand.classList.remove('active-turn');
    }
}

async function handleCardPlay(cardId) {
    if (currentBattle.turn !== currentUser.username) {
        return showMessage('It\'s not your turn!', true);
    }

    const isPlayer1 = currentBattle.player1 === currentUser.username;
    const player = isPlayer1 ? 'player1' : 'player2';
    const opponent = isPlayer1 ? 'player2' : 'player1';

    // If a card is already on the field, replace it
    let updatedPlayerCards = currentBattle[`${player}rem`].split(',').filter(id => id !== cardId);
    let newCardOnField = cardId;

    // If there was a previous card on the field, add it back to the hand
    const oldCardOnField = currentBattle[`${player}cardsonfield`];
    if (oldCardOnField) {
        updatedPlayerCards.push(oldCardOnField);
    }
    
    // Update the battle record to reflect the card being played
    const updatedBattlePayload = [{
        id: currentBattle.id,
        [`${player}rem`]: updatedPlayerCards.join(','),
        [`${player}cardsonfield`]: newCardOnField,
        log: `${currentUser.username} played a card.`
    }];

    try {
        await fetch(`${API_BASE}/battle`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedBattlePayload)
        });
        
        // Re-fetch to update the UI
        pollBattleStatus();

    } catch (error) {
        console.error('Error playing card:', error);
        showMessage('Failed to play card. Please try again.', true);
    }
}

async function handleEndTurn() {
    if (currentBattle.turn !== currentUser.username) {
        return showMessage('It\'s not your turn!', true);
    }

    const isPlayer1 = currentBattle.player1 === currentUser.username;
    const player = isPlayer1 ? 'player1' : 'player2';
    const opponent = isPlayer1 ? 'player2' : 'player1';

    let logMessage = '';
    let playerHealth = parseInt(currentBattle[`${player}health`]);
    let opponentHealth = parseInt(currentBattle[`${opponent}health`]);

    const playerCardOnField = allCards.find(c => c.id === currentBattle[`${player}cardsonfield`]);
    const opponentCardOnField = allCards.find(c => c.id === currentBattle[`${opponent}cardsonfield`]);

    if (playerCardOnField && opponentCardOnField) {
        const playerAttack = parseInt(playerCardOnField.attack);
        const opponentDefense = parseInt(opponentCardOnField.defense);
        const opponentAttack = parseInt(opponentCardOnField.attack);
        const playerDefense = parseInt(playerCardOnField.defense);

        opponentHealth -= Math.max(0, playerAttack - opponentDefense);
        playerHealth -= Math.max(0, opponentAttack - playerDefense);

        logMessage = `${currentUser.username}'s ${playerCardOnField.name} attacks ${currentBattle.turn === currentBattle.player1 ? currentBattle.player2 : currentBattle.player1}'s ${opponentCardOnField.name}!`;

    } else if (playerCardOnField) {
        const playerAttack = parseInt(playerCardOnField.attack);
        opponentHealth -= playerAttack;
        logMessage = `${currentUser.username}'s ${playerCardOnField.name} attacks directly for ${playerAttack} damage!`;
    }

    const updatedBattlePayload = [{
        id: currentBattle.id,
        turn: currentBattle.turn === currentBattle.player1 ? currentBattle.player2 : currentBattle.player1,
        log: logMessage,
        [`${player}health`]: playerHealth,
        [`${opponent}health`]: opponentHealth
    }];

    try {
        await fetch(`${API_BASE}/battle`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedBattlePayload)
        });

        pollBattleStatus();
    } catch (error) {
        console.error('Error ending turn:', error);
        showMessage('Failed to end turn. Please try again.', true);
    }
}

async function checkWinCondition() {
    const isPlayer1 = currentBattle.player1 === currentUser.username;
    const player = isPlayer1 ? 'player1' : 'player2';
    const opponent = isPlayer1 ? 'player2' : 'player1';

    if (currentBattle[`${player}health`] <= 0 && currentBattle[`${opponent}health`] <= 0) {
        endBattle('Draw');
    } else if (currentBattle[`${opponent}health`] <= 0) {
        endBattle(isPlayer1 ? currentBattle.player1 : currentBattle.player2);
    } else if (currentBattle[`${player}health`] <= 0) {
        endBattle(isPlayer1 ? currentBattle.player2 : currentBattle.player1);
    }
}

async function endBattle(winner) {
    clearInterval(currentBattleInterval);
    const updatedBattlePayload = [{
        id: currentBattle.id,
        status: 'completed',
        winner: winner,
        endstamp: new Date().toISOString()
    }];

    try {
        await fetch(`${API_BASE}/battle`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedBattlePayload)
        });
        
        // Update user stats
        if (winner !== 'Draw' && winner === currentUser.username) {
            await updateUserStats(true);
        } else if (winner !== 'Draw') {
            await updateUserStats(false);
        }

        showMessage(`Battle over! The winner is ${winner}.`);
        currentBattle = null;
        loadBattle();
    } catch (error) {
        console.error('Error ending battle:', error);
    }
}

async function updateUserStats(isWin) {
    let wins = parseInt(currentUser.wins);
    let losses = parseInt(currentUser.losses);
    let coins = parseInt(currentUser.coins);

    if (isWin) {
        wins += 1;
        coins += 20; // Reward for winning
    } else {
        losses += 1;
        coins += 5; // Small consolation prize
    }

    const updatedUserPayload = [{
        id: currentUser.id,
        wins: wins,
        losses: losses,
        coins: coins
    }];

    await fetch(`${API_BASE}/users`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUserPayload)
    });
    fetchAndUpdateUserData();
}

// --- Store Logic & Rendering ---
function renderStore() {
    if (!storeItemsGrid) return;
    storeItemsGrid.innerHTML = '';
    
    // Define the store's "booster packs" or items
    const storeItems = [
        { id: 'pack1', name: 'Rookie Pack', price: 50, cards: 3, description: 'A basic pack with 3 random cards.' },
        { id: 'pack2', name: 'Veteran Pack', price: 100, cards: 5, description: 'A larger pack with 5 random cards.' }
    ];

    storeItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'store-card';
        itemDiv.innerHTML = `
            <h3>${item.name}</h3>
            <p>${item.description}</p>
            <div class="store-card-price">
                <span>${item.price}</span><div class="coin-icon"></div>
            </div>
            <button class="cta-button buy-btn" data-id="${item.id}" data-price="${item.price}" data-cards="${item.cards}">Buy</button>
        `;
        storeItemsGrid.appendChild(itemDiv);
    });

    document.querySelectorAll('.buy-btn').forEach(button => {
        button.addEventListener('click', handlePurchase);
    });
}

async function handlePurchase(e) {
    const itemPrice = parseInt(e.target.dataset.price);
    const numberOfCards = parseInt(e.target.dataset.cards);

    if (parseInt(currentUser.coins) < itemPrice) {
        showMessage('Not enough coins to purchase this item!', true);
        return;
    }

    try {
        const newCards = getRandomCards(numberOfCards);
        const newCardIds = newCards.map(c => c.id);
        const currentCardIds = currentUser.cards ? currentUser.cards.split(',') : [];
        const updatedCardIds = [...currentCardIds, ...newCardIds].join(',');
        const updatedCoins = parseInt(currentUser.coins) - itemPrice;

        const updatePayload = [{
            id: currentUser.id,
            cards: updatedCardIds,
            coins: updatedCoins
        }];
        
        const putResponse = await fetch(`${API_BASE}/users`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload)
        });

        if (putResponse.ok) {
            showMessage(`Purchase successful! You received ${numberOfCards} new cards.`);
            fetchAndUpdateUserData();
        } else {
            showMessage('Purchase failed. Please try again.', true);
        }
    } catch (error) {
        console.error('Purchase error:', error);
        showMessage('An error occurred during the purchase.', true);
    }
}

// --- Helper Functions ---
function getRandomCards(count) {
    const shuffled = [...allCards].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
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
function toggleAuth(type) {
    if (type === 'signup') {
        loginBox.classList.add('hidden');
        signupBox.classList.remove('hidden');
    } else {
        loginBox.classList.remove('hidden');
        signupBox.classList.add('hidden');
    }
}

function showAuth() {
    if (authContainer) authContainer.classList.remove('hidden');
    if (dashboardContainer) dashboardContainer.classList.add('hidden');
}

function showDashboard() {
    if (authContainer) authContainer.classList.add('hidden');
    if (dashboardContainer) dashboardContainer.classList.remove('hidden');
}

function showView(view) {
    viewContents.forEach(vc => vc.classList.add('hidden'));
    document.getElementById(`${view}-view`).classList.remove('hidden');
}

// --- Custom Modal Functions ---
function showModal(content) {
    if (!modal || !modalBackdrop || !modalCloseBtn) return;
    modalContent.innerHTML = content;
    modal.classList.remove('hidden');
    modalBackdrop.classList.remove('hidden');
    modalCloseBtn.addEventListener('click', closeModal);
}

function closeModal() {
    if (!modal || !modalBackdrop || !modalCloseBtn) return;
    modal.classList.add('hidden');
    modalBackdrop.classList.add('hidden');
    modalCloseBtn.removeEventListener('click', closeModal);
}

function showMessage(message, isError = false) {
    let content = `<p class="modal-message ${isError ? 'error-message' : ''}">${message}</p>`;
    showModal(content);
}
