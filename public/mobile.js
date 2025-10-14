/**
 * WeAD Mobile Multiplayer - Local Standalone Version
 * Optimized for local development with error handling
 */

// Global variables
let socket;
let currentUser = null;
let currentRoom = null;
let selectedGame = null;
let isHost = false;
// WebRTC variables removed - handled in game interface files

// Touch controls removed - handled in game interface files

// DOM elements
const elements = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 WeAD Mobile Multiplayer Starting...');

    // Check internet connectivity
    checkInternetConnection();

    // Cache DOM elements
    cacheElements();

    // Initialize user
    initializeUser();

    // Setup event listeners
    setupEventListeners();

    // Connect to server
    connectToServer();

    console.log('✅ Mobile Multiplayer Initialized');
});

// Check internet connectivity
function checkInternetConnection() {
    if (!navigator.onLine) {
        showError('No internet connection detected. Please check your connection and refresh the page.');
        return false;
    }

    // Add online/offline event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return true;
}

function handleOnline() {
    console.log('🌐 Internet connection restored');
    showStatus('Connected', 'connected');
    // Try to reconnect if we were disconnected
    if (!socket || socket.disconnected) {
        connectToServer();
    }
}

function handleOffline() {
    console.log('❌ Internet connection lost');
    showStatus('No internet connection', 'disconnected');
}

// Cache DOM elements for performance
function cacheElements() {
    console.log('🔍 Caching DOM elements...');

    elements.connectionStatus = document.getElementById('connection-status');
    elements.createRoomSection = document.getElementById('create-room-section');
    elements.joinRoomSection = document.getElementById('join-room-section');
    elements.roomSection = document.getElementById('room-section');
    elements.roomsSection = document.getElementById('rooms-section');

    elements.roomName = document.getElementById('room-name');
    elements.roomCode = document.getElementById('room-code');
    elements.currentRoomName = document.getElementById('current-room-name');
    elements.playerList = document.getElementById('player-list');

    elements.createRoomBtn = document.getElementById('create-room-btn');
    elements.joinRoomBtn = document.getElementById('join-room-btn');
    elements.readyBtn = document.getElementById('ready-btn');
    elements.startGameBtn = document.getElementById('start-game-btn');
    elements.leaveRoomBtn = document.getElementById('leave-room-btn');
    elements.refreshRoomsBtn = document.getElementById('refresh-rooms-btn');

    elements.loading = document.getElementById('loading');
    elements.loadingText = document.getElementById('loading-text');

    // Debug: Log which elements were found
    console.log('🔍 DOM Elements Found:', {
        connectionStatus: !!elements.connectionStatus,
        createRoomBtn: !!elements.createRoomBtn,
        joinRoomBtn: !!elements.joinRoomBtn,
        readyBtn: !!elements.readyBtn,
        startGameBtn: !!elements.startGameBtn,
        roomName: !!elements.roomName,
        roomCode: !!elements.roomCode
    });
}

// Initialize user with mobile-specific ID
function initializeUser() {
    // TEMPORARY: Clear old localStorage to force new user generation
    const savedGuestUser = localStorage.getItem('mobileMultiplayerUser');
    if (savedGuestUser) {
        try {
            const user = JSON.parse(savedGuestUser);
            // Clear old mobile_guest_ format users
            if (user.id && user.id.startsWith('mobile_guest_')) {
                console.log('🧹 Clearing old mobile_guest user, generating new player_ format');
                localStorage.removeItem('mobileMultiplayerUser');
            } else {
                currentUser = user;
                console.log('👤 Restored mobile user from localStorage:', currentUser);
                return;
            }
        } catch (error) {
            console.error('Error parsing saved mobile user:', error);
            // Generate new user if parsing fails
        }
    }
    
    // Generate new guest user (same pattern as desktop)
    // Generate guest user ID and username (desktop multiplayer format)
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const guestNumber = Math.floor(Math.random() * 9999) + 1;
    currentUser = {
        id: `player_${timestamp}_${randomId}`,
        username: 'Player' + guestNumber,
        isMobile: true,
        isGuest: true
    };
    
    // Save the user to localStorage
    localStorage.setItem('mobileMultiplayerUser', JSON.stringify(currentUser));
    console.log('👤 Created new mobile user:', currentUser);
}

// Setup all event listeners
function setupEventListeners() {
    console.log('🎧 Setting up event listeners...');

    // Room creation
    if (elements.createRoomBtn) {
        // Touch events for mobile
        elements.createRoomBtn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            console.log('🎮 Create Room button touched');
            createRoom();
        });
        // Click events for desktop testing
        elements.createRoomBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🖱️ Create Room button clicked');
            createRoom();
        });
        console.log('✅ Create Room button listeners attached');
    } else {
        console.log('❌ Create Room button not found');
    }

    if (elements.roomName) {
        elements.roomName.addEventListener('input', validateRoomName);
    }

    // Room joining
    if (elements.joinRoomBtn) {
        // Touch events for mobile
        elements.joinRoomBtn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            console.log('🔗 Join Room button touched');
            joinRoom();
        });
        // Click events for desktop testing
        elements.joinRoomBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🖱️ Join Room button clicked');
            joinRoom();
        });
        console.log('✅ Join Room button listeners attached');
    } else {
        console.log('❌ Join Room button not found');
    }

    if (elements.roomCode) {
        elements.roomCode.addEventListener('input', function(e) {
            e.target.value = e.target.value.toUpperCase();
            validateRoomCode();
        });
    }

    // Room actions
    if (elements.readyBtn) {
        // Touch events for mobile
        elements.readyBtn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            console.log('✅ Ready button touched');
            toggleReady();
        });
        // Click events for desktop testing
        elements.readyBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🖱️ Ready button clicked');
            toggleReady();
        });
        console.log('✅ Ready button listeners attached');
    } else {
        console.log('❌ Ready button not found');
    }

    if (elements.startGameBtn) {
        // Touch events for mobile
        elements.startGameBtn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            console.log('🎮 Start Game button touched');
            startGame();
        });
        // Click events for desktop testing
        elements.startGameBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🖱️ Start Game button clicked');
            startGame();
        });
        console.log('✅ Start Game button listeners attached');
    } else {
        console.log('❌ Start Game button not found');
    }

    if (elements.leaveRoomBtn) {
        // Touch events for mobile
        elements.leaveRoomBtn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            console.log('👋 Leave Room button touched');
            leaveRoom();
        });
        // Click events for desktop testing
        elements.leaveRoomBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🖱️ Leave Room button clicked');
            leaveRoom();
        });
    }

    if (elements.refreshRoomsBtn) {
        // Touch events for mobile
        elements.refreshRoomsBtn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            console.log('🔄 Refresh Rooms button touched');
            refreshRooms();
        });
        // Click events for desktop testing
        elements.refreshRoomsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🖱️ Refresh Rooms button clicked');
            refreshRooms();
        });
    }

    // Game selection
    setupGameSelection();

    console.log('✅ All event listeners setup complete');
}

// Setup game selection
function setupGameSelection() {
    const gameItems = document.querySelectorAll('.game-item');
    gameItems.forEach(item => {
        // Touch events for mobile
        item.addEventListener('touchstart', function(e) {
            e.preventDefault();
            // Remove previous selection
            gameItems.forEach(g => g.classList.remove('selected'));

            // Select this game
            this.classList.add('selected');
            selectedGame = this.dataset.game;

            console.log('🎮 Game selected:', selectedGame);
        });
        // Click events for desktop testing
        item.addEventListener('click', function(e) {
            e.preventDefault();
            // Remove previous selection
            gameItems.forEach(g => g.classList.remove('selected'));

            // Select this game
            this.classList.add('selected');
            selectedGame = this.dataset.game;

            console.log('🎮 Game selected:', selectedGame);
        });
    });
}

// Connect to the local server (standalone mode)
function connectToServer() {
    if (!navigator.onLine) {
        showStatus('No internet connection', 'disconnected');
        return;
    }

    console.log('🔌 Connecting to local server...');

    updateConnectionStatus('Connecting...', 'disconnected');

    try {
        // Try multiple connection URLs for better reliability
        const connectionUrls = generateConnectionUrls();

        console.log('🌐 Current location:', window.location.hostname + ':' + (window.location.port || '80'));
        console.log('🔗 Trying connection URLs:', connectionUrls);

        // Try the first URL
        connectWithUrl(connectionUrls[0], connectionUrls.slice(1));
    } catch (error) {
        console.error('🚨 Connection initialization failed:', error);
        showError('Failed to initialize connection. Please refresh the page.');
    }
}

// Generate multiple connection URLs to try
function generateConnectionUrls() {
    const urls = [];

    // Primary: Use current hostname
    urls.push(`http://${window.location.hostname}:3004`);

    // Fallback: Try localhost (for local development)
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        urls.push(`http://localhost:3004`);
    }

    // Additional fallbacks: Try common local network IPs
    urls.push(`http://192.168.101.20:3004`);
    urls.push(`http://192.168.101.2:3004`);
    urls.push(`http://192.168.1.1:3004`);

    return urls;
}

// Connect with URL, with fallback URLs
function connectWithUrl(primaryUrl, fallbackUrls) {
    console.log('🔌 Attempting connection to:', primaryUrl);

    try {
        socket = io(primaryUrl, {
            transports: ['websocket', 'polling'],
            timeout: 5000, // Shorter timeout for faster fallback
            forceNew: true
        });

        // Setup socket listeners BEFORE connecting
        setupSocketListeners();

        socket.on('connect', function() {
            console.log('✅ Connected to local server');
            updateConnectionStatus('Connected', 'connected');

            // Load available rooms immediately (no registration needed like desktop)
            refreshRooms();
        });

        socket.on('connect_error', function(error) {
            console.error('❌ Connection error:', error);
            console.error('❌ Error details:', error.message, error.description, error.context);
            console.error('❌ Failed URL:', primaryUrl);
            console.error('❌ Current hostname:', window.location.hostname);

            // Try next fallback URL
            if (fallbackUrls.length > 0) {
                console.log('🔄 Trying fallback URL:', fallbackUrls[0]);
                updateConnectionStatus('Trying alternative connection...', 'disconnected');
                setTimeout(() => {
                    connectWithUrl(fallbackUrls[0], fallbackUrls.slice(1));
                }, 1000);
                return;
            }

            // All URLs failed
            updateConnectionStatus('Connection failed', 'disconnected');

            let errorMessage = 'Failed to connect to server: ' + error.message;
            if (error.message.includes('websocket')) {
                errorMessage += '\n\nPossible issues:\n• Firewall blocking connections\n• Wrong network IP address\n• Server not running\n• WebSocket protocol not supported';
            } else if (error.message.includes('timeout')) {
                errorMessage += '\n\nPossible issues:\n• Network connectivity problems\n• Server is too slow to respond\n• Firewall blocking connections';
            }

            errorMessage += '\n\nTroubleshooting:\n1. Try: http://' + window.location.hostname + ':3004/websocket-test\n2. Try: http://192.168.101.20:3004/websocket-test\n3. Check if both devices are on the same WiFi network';

            showError(errorMessage);
        });

        socket.on('disconnect', function(reason) {
            console.log('❌ Disconnected from server:', reason);
            updateConnectionStatus('Disconnected', 'disconnected');

            if (reason === 'io server disconnect') {
                // Server disconnected us, try to reconnect
                setTimeout(() => connectToServer(), 3000);
            }
        });

        socket.on('reconnect_attempt', function(attempt) {
            console.log(`🔄 Reconnection attempt ${attempt}`);
            updateConnectionStatus(`Reconnecting... (${attempt})`, 'disconnected');
        });

        socket.on('reconnect', function() {
            console.log('✅ Reconnected to server');
            updateConnectionStatus('Connected', 'connected');
        });

        // Setup message handlers
        setupSocketListeners();

    } catch (error) {
        console.error('🚨 Socket initialization failed:', error);
        showError('Failed to initialize connection. Please refresh the page.');
    }
}

// Setup WebSocket message listeners
function setupSocketListeners() {
    if (!socket) return;

    // Remove existing listeners to prevent duplicates
    socket.removeAllListeners();

    // No registration needed (follows desktop pattern)
    
    // Room events
    socket.on('room_created', handleRoomCreated);
    socket.on('room_joined', handleRoomJoined);
    socket.on('room_updated', handleRoomUpdated);
    socket.on('room_left', handleRoomLeft);
    socket.on('rooms_list', handleRoomsList);

    // Game events
    socket.on('game_starting', handleGameStarting);
    socket.on('game_started', handleGameStarted);

    // WebRTC events handled in game interface files, not in lobby

    // Error handling
    socket.on('error', handleError);
}

// Update connection status display
function updateConnectionStatus(text, type) {
    if (elements.connectionStatus) {
        elements.connectionStatus.textContent = text;
        elements.connectionStatus.className = `status status-${type}`;
    }
}

// Show status message
function showStatus(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    updateConnectionStatus(message, type);
}

// Show error message
function showError(message) {
    console.error('🚨 Error:', message);
    alert('Error: ' + message);
}

// Create a new room
function createRoom() {
    console.log('🚀 createRoom() function called');

    if (!socket || !socket.connected) {
        console.log('❌ Socket not connected');
        showError('Not connected to server. Please check your internet connection.');
        return;
    }

    if (!selectedGame) {
        console.log('❌ No game selected');
        showError('Please select a game first');
        return;
    }

    const roomName = elements.roomName.value.trim();
    if (!roomName) {
        console.log('❌ No room name entered');
        showError('Please enter a room name');
        return;
    }

    console.log('🏠 Creating room:', roomName, 'with game:', selectedGame);

    showLoading('Creating room...');

    socket.emit('create_room', {
        name: roomName,
        game: selectedGame,
        host: currentUser
    });

    console.log('📤 Create room request sent to server');
}

// Join an existing room
function joinRoom() {
    console.log('🚀 joinRoom() function called');

    if (!socket || !socket.connected) {
        console.log('❌ Socket not connected');
        showError('Not connected to server. Please check your internet connection.');
        return;
    }

    const roomCode = elements.roomCode.value.trim();
    if (!roomCode) {
        console.log('❌ No room code entered');
        showError('Please enter a room code');
        return;
    }

    console.log('🔗 Joining room:', roomCode);

    showLoading('Joining room...');

    socket.emit('join_room', {
        roomId: roomCode,
        player: currentUser
    });

    console.log('📤 Join room request sent to server');
}

// Toggle ready status
function toggleReady() {
    if (!currentRoom) return;

    const newStatus = !currentUser.ready;
    currentUser.ready = newStatus;

    console.log('🎯 Ready status:', newStatus);

    socket.emit('player_ready', {
        roomId: currentRoom.id,
        playerId: currentUser.id,
        ready: newStatus
    });

    updateReadyButton();
}

// Start the game (host only)
function startGame() {
    console.log('🚀 startGame() function called');

    if (!currentRoom || !isHost) {
        console.log('❌ Cannot start game:', {
            hasRoom: !!currentRoom,
            isHost: !!isHost,
            roomId: currentRoom?.id
        });
        return;
    }

    console.log('🎮 Starting game for room:', currentRoom.id);

    showLoading('Starting game...');

    socket.emit('start_game', {
        roomId: currentRoom.id
    });

    console.log('📤 Start game request sent to server');
}

// Leave the current room
function leaveRoom() {
    if (!currentRoom) return;

    console.log('👋 Leaving room');

    socket.emit('leave_room', {
        roomId: currentRoom.id,
        playerId: currentUser.id
    });

    showLobby();
}

// Refresh available rooms
function refreshRooms() {
    if (!socket || !socket.connected) {
        showStatus('Cannot refresh - not connected', 'disconnected');
        return;
    }

    console.log('🔄 Refreshing rooms...');
    socket.emit('get_rooms');
}

// Handle user registration confirmation
// User registration function removed - follows desktop pattern of immediate guest user creation

// Handle room creation response
function handleRoomCreated(data) {
    console.log('✅ Room created response:', data);
    console.log('🔍 Data structure check:', {
        hasData: !!data,
        hasRoom: !!(data && data.room),
        dataKeys: data ? Object.keys(data) : 'no data',
        directRoomCheck: !!(data && data.id)
    });

    hideLoading();
    
    // Handle case where data or data.room might be undefined
    if (data && data.room) {
        currentRoom = data.room;
        // Room creator is always host
        isHost = true;
        console.log('🎯 Room created - isHost:', isHost, 'currentUser.id:', currentUser?.id, 'host.id:', currentRoom.host?.id);
        showRoom(data.room);
    } else if (data && data.id) {
        // Handle case where room data is sent directly (not wrapped)
        currentRoom = data;
        // Room creator is always host
        isHost = true;
        console.log('🎯 Room created - isHost:', isHost, 'currentUser.id:', currentUser?.id, 'host.id:', currentRoom.host?.id);
        showRoom(data);
    } else {
        console.error('❌ Room creation failed - no room data received');
        showError('Failed to create room. Please try again.');
    }
}

// Handle room joining response
function handleRoomJoined(data) {
    console.log('✅ Room joined response:', data);

    hideLoading();
    
    // Handle case where data or data.room might be undefined
    if (data && data.room) {
        currentRoom = data.room;
        // Determine if current user is host based on room data
        isHost = currentUser && currentRoom.host && currentUser.id === currentRoom.host.id;
        console.log('🎯 Room joined - isHost determined:', isHost, 'currentUser.id:', currentUser?.id, 'host.id:', currentRoom.host?.id);
        showRoom(data.room);
    } else if (data && data.id) {
        // Handle case where room data is sent directly (not wrapped)
        currentRoom = data;
        // Determine if current user is host based on room data
        isHost = currentUser && currentRoom.host && currentUser.id === currentRoom.host.id;
        console.log('🎯 Room joined - isHost determined:', isHost, 'currentUser.id:', currentUser?.id, 'host.id:', currentRoom.host?.id);
        showRoom(data);
    } else {
        console.error('❌ Room join failed - no room data received');
        showError('Failed to join room. Please try again.');
    }
}

// Handle room updates
function handleRoomUpdated(data) {
    console.log('📡 Room updated response:', data);

    // Handle case where data or data.room might be undefined
    if (data && data.room) {
        currentRoom = data.room;
        updateRoomDisplay();
    } else if (data && data.id) {
        // Handle case where room data is sent directly (not wrapped)
        currentRoom = data;
        updateRoomDisplay();
    } else {
        console.error('❌ Room update failed - no room data received');
    }
}

// Handle room left
function handleRoomLeft(data) {
    console.log('👋 Room left');

    currentRoom = null;
    isHost = false;
    showLobby();
}

// Handle rooms list
function handleRoomsList(data) {
    console.log('🏠 Rooms list received:', data);
    
    // Handle case where data or data.rooms might be undefined
    const rooms = data && data.rooms ? data.rooms : [];
    console.log('🏠 Processed rooms:', rooms.length, 'rooms');

    updateRoomsList(rooms);
}

// Handle game starting
function handleGameStarting(data) {
    console.log('🎮 Game starting...');

    showLoading('Preparing game...');
}

// Handle game started
function handleGameStarted(data) {
    console.log('🎮 Game started!', data);
    console.log('🔍 FULL DATA STRUCTURE:', JSON.stringify(data, null, 2));

    hideLoading();

    // Debug logging for role determination  
    console.log('🔍 Role determination debug:', {
        localIsHost: isHost,
        currentUserId: currentUser?.id,
        roomHostId: data.room?.host?.id,
        hasRoom: !!data.room,
        hasHost: !!data.room?.host,
        roomData: data.room
    });

    // CRITICAL FIX: Determine isHost based on SERVER-PROVIDED room data, not local flag
    // The local isHost flag can be wrong due to reconnections and localStorage issues
    console.log('🚀 [FIX APPLIED] Using server-based isHost determination - ' + new Date().toISOString());
    
    // Handle different data formats that might be sent by the server
    let serverRoomData = null;
    if (data.room) {
        serverRoomData = data.room;
        console.log('📦 Using data.room format');
    } else if (data.id) {
        serverRoomData = data;
        console.log('📦 Using direct data format');
    } else {
        console.log('❌ No room data found in:', Object.keys(data));
        serverRoomData = null;
    }
    
    if (serverRoomData && serverRoomData.host && currentUser) {
        const serverDeterminedIsHost = currentUser.id === serverRoomData.host.id;
        console.log('🔍 SERVER-BASED isHost determination:');
        console.log('  currentUser.id:', currentUser.id);
        console.log('  serverRoomData.host.id:', serverRoomData.host.id);
        console.log('  SERVER says isHost:', serverDeterminedIsHost);
        console.log('  LOCAL had isHost:', isHost);
        
        // Use server determination, not local flag
        isHost = serverDeterminedIsHost;
        console.log('🎯 FINAL isHost decision:', isHost);
    } else {
        console.log('❌ Could not determine isHost from server data:', {
            hasServerRoomData: !!serverRoomData,
            hasHost: !!(serverRoomData && serverRoomData.host),
            hasCurrentUser: !!currentUser,
            dataKeys: Object.keys(data || {}),
            serverRoomDataKeys: Object.keys(serverRoomData || {})
        });
    }
    
    console.log('🎮 Player role:', isHost ? 'HOST' : 'PLAYER 2');
    
    // FORCE CORRECT ROUTING - Debug logging
    console.log('🔍 ROUTING DEBUG:');
    console.log('  isHost:', isHost);
    console.log('  currentUser.id:', currentUser?.id);
    console.log('  serverRoomData.host.id:', serverRoomData?.host?.id);
    console.log('  serverRoomData.id:', serverRoomData?.id);
    console.log('  currentRoom.id:', currentRoom?.id);
    
    // Redirect based on role
    let gameUrl;
    if (isHost) {
        // Host goes to main game interface with netplay
        gameUrl = `/game?roomId=${serverRoomData.id}&playerId=${currentUser.id}&username=${encodeURIComponent(currentUser.username || 'Player1')}&isHost=true`;
        console.log('🎯 HOST: Redirecting to game interface:', gameUrl);
    } else {
        // Player 2 goes to netplay client interface
        gameUrl = `/player2?roomId=${serverRoomData.id}&playerId=${currentUser.id}&username=${encodeURIComponent(currentUser.username || 'Player2')}&isHost=false`;
        console.log('🎯 PLAYER 2: Redirecting to netplay client interface:', gameUrl);
    }

    // Use replace to avoid back button issues
    window.location.replace(gameUrl);
}

// WebRTC handlers removed - handled in game interface files

// Handle errors
function handleError(data) {
    console.error('🚨 Server error:', data.message);
    hideLoading();
    showError(data.message);
}

// Update room display
function updateRoomDisplay() {
    if (!currentRoom) return;

    // Update room name
    if (elements.currentRoomName) {
        elements.currentRoomName.textContent = currentRoom.name;
    }

    // Update player list
    updatePlayerList();

    // Update buttons
    updateReadyButton();

    if (isHost && elements.startGameBtn) {
        elements.startGameBtn.style.display = 'block';
    }
}

// Update player list display
function updatePlayerList() {
    if (!elements.playerList) return;

    const playerListHtml = currentRoom.players.map(player => `
        <div class="player-item">
            <div class="player-avatar">${player.username.charAt(0).toUpperCase()}</div>
            <div class="player-name">${player.username}</div>
            <div class="player-status ${player.ready ? 'ready' : 'waiting'}">
                ${player.ready ? 'Ready' : 'Waiting'}
            </div>
        </div>
    `).join('');

    elements.playerList.innerHTML = playerListHtml;
}

// Update ready button
function updateReadyButton() {
    if (!elements.readyBtn) return;

    if (currentUser.ready) {
        elements.readyBtn.textContent = 'Not Ready';
        elements.readyBtn.style.background = '#dc3545';
    } else {
        elements.readyBtn.textContent = 'Ready';
        elements.readyBtn.style.background = '#28a745';
    }
}

// Update rooms list display
function updateRoomsList(rooms) {
    const roomListElement = document.getElementById('room-list');
    if (!roomListElement) return;

    if (rooms.length === 0) {
        roomListElement.innerHTML = `
            <div style="text-align: center; color: #6c757d; font-size: 9px; padding: 20px;">
                No rooms available
            </div>
        `;
        return;
    }

    const roomsHtml = rooms.map(room => `
        <div class="room-item" data-code="${room.id}">
            <div class="room-name">${room.name}</div>
            <div class="room-info">
                ${room.players}/${room.maxPlayers} players • ${room.game}
            </div>
        </div>
    `).join('');

    roomListElement.innerHTML = roomsHtml;

    // Add click listeners to room items
    document.querySelectorAll('.room-item').forEach(item => {
        item.addEventListener('touchstart', function() {
            if (elements.roomCode) {
                elements.roomCode.value = this.dataset.code;
                validateRoomCode();
            }
        });
    });
}

// Show lobby interface
function showLobby() {
    if (elements.createRoomSection) elements.createRoomSection.style.display = 'block';
    if (elements.joinRoomSection) elements.joinRoomSection.style.display = 'block';
    if (elements.roomSection) elements.roomSection.style.display = 'none';
    if (elements.roomsSection) elements.roomsSection.style.display = 'block';

    refreshRooms();
}

// Show room interface
function showRoom(room) {
    if (elements.createRoomSection) elements.createRoomSection.style.display = 'none';
    if (elements.joinRoomSection) elements.joinRoomSection.style.display = 'none';
    if (elements.roomSection) elements.roomSection.style.display = 'block';
    if (elements.roomsSection) elements.roomsSection.style.display = 'none';

    updateRoomDisplay();
}

// Show loading overlay
function showLoading(text = 'Loading...') {
    if (elements.loading && elements.loadingText) {
        elements.loadingText.textContent = text;
        elements.loading.classList.add('show');
    }
}

// Hide loading overlay
function hideLoading() {
    if (elements.loading) {
        elements.loading.classList.remove('show');
    }
}

// Touch controls and game functions removed - handled in game interface files

// Validation functions
function validateRoomName() {
    if (elements.roomName && elements.createRoomBtn) {
        const name = elements.roomName.value.trim();
        elements.createRoomBtn.disabled = name.length < 3;
    }
}

function validateRoomCode() {
    if (elements.roomCode && elements.joinRoomBtn) {
        const code = elements.roomCode.value.trim();
        elements.joinRoomBtn.disabled = code.length !== 6;
    }
}

// Initialize validation
function initializeValidation() {
    validateRoomName();
    validateRoomCode();
}

// Call initialization
initializeValidation();

// Add connection retry mechanism
setInterval(() => {
    if (!socket || !socket.connected) {
        if (navigator.onLine) {
            console.log('🔄 Attempting to reconnect...');
            connectToServer();
        }
    }
}, 30000); // Try to reconnect every 30 seconds

console.log('🎮 Mobile Multiplayer System Ready!');