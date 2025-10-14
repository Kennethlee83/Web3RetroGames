// WeAD Mobile Game - Netplay Host Interface
// This file handles netplay host functionality for mobile multiplayer

console.log('👥 Mobile Netplay System Starting...');

// Global variables
let socket = null;
let currentRoom = null;
let roomId = null;
let playerId = null;
let username = null;
let isHost = false;
let netplayHost = null;
let emulator = null;
let inputSystem = null;

// DOM elements
const elements = {
    gameTitle: null,
    connectionStatus: null,
    loading: null,
    gameVideo: null
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Mobile Netplay Interface Initialized');
    
    // Load netplay scripts first
    loadNetplayScripts();
});

// Initialize app after scripts are loaded
function initializeApp() {
    // Get DOM elements
    elements.gameTitle = document.getElementById('game-title');
    elements.connectionStatus = document.getElementById('connection-status');
    elements.loading = document.getElementById('loading');
    elements.gameVideo = document.getElementById('game-video');
    
    // Get URL parameters (support both old and new parameter names)
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('roomId') || urlParams.get('room');
    playerId = urlParams.get('playerId') || urlParams.get('player');
    username = urlParams.get('username');
    isHost = urlParams.get('isHost') === 'true';
    
    console.log('🔍 URL Parameters:', { roomId, playerId, username });
    console.log('🔍 Current URL:', window.location.href);
    
    if (!roomId || !playerId) {
        showError('Missing room or player ID');
        return;
    }
    
    // Connect to server
    connectToServer();
    
    // Initialize orientation detection
    initializeOrientationDetection();
}

// Connect to server
function connectToServer() {
    console.log('🔌 Connecting to game server...');
    updateConnectionStatus('Connecting...', 'disconnected');
    
    try {
        socket = io({
            timeout: 30000,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
            maxReconnectionAttempts: 10,
            forceNew: true
        });
        
        setupSocketHandlers();
        
    } catch (error) {
        console.error('❌ Failed to connect:', error);
        showError('Failed to connect to server: ' + error.message);
    }
}

// Setup Socket.IO handlers
function setupSocketHandlers() {
    socket.on('connect', () => {
        console.log('✅ Connected to server');
        updateConnectionStatus('Connected', 'connected');
        joinGameRoom();
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Disconnected from server');
        updateConnectionStatus('Disconnected', 'disconnected');
    });
    
    socket.on('error', handleError);
    socket.on('game_room_joined', handleGameRoomJoined);
    socket.on('game_started', handleGameStarted);
    
    // Netplay handlers
    socket.on('client_join_request', handleClientJoinRequest);
    socket.on('client_input', handleClientInput);
    socket.on('client_disconnect', handleClientDisconnect);
    socket.on('sync_request', handleSyncRequest);
}

// Join game room
function joinGameRoom() {
    console.log('🎮 Joining game room:', roomId);
    
    socket.emit('join_game_room', {
        roomId: roomId,
        playerId: playerId,
        username: username
    });
}

// Handle game room joined
function handleGameRoomJoined(data) {
    console.log('🎮 Joined game room:', data);
    
    currentRoom = data.room;
    isHost = data.isHost;
    
    // Update UI with proper game title
    if (elements.gameTitle) {
        elements.gameTitle.textContent = 'Street Fighter II Turbo';
    }
    
    // Update status
    updateConnectionStatus(isHost ? 'Host - Connected' : 'Player 2 - Connected', 'connected');
    
    console.log('✅ Game room joined - WebRTC setup will happen in handleGameStarted');
}

// Handle game started
function handleGameStarted(data) {
    console.log('🎮 Game started!', data);
    
    // Handle both formats: data.room (from original event) and direct room object (from rejoin)
    const roomData = data.room || data;
    
    if (roomData && roomData.id) {
        console.log('✅ Room data validation passed');
        
        currentRoom = roomData;
        
        // Double-check isHost based on room data
        const shouldBeHost = playerId === roomData.host?.id;
        if (isHost !== shouldBeHost) {
            console.warn('⚠️ isHost mismatch detected! Correcting...');
            isHost = shouldBeHost;
        }
        
    if (isHost) {
            // Host: Use RetroArch launcher
            console.log('🎯 HOST: Setting up RetroArch launcher');
            setupRetroArchLauncher();
    }
        
        hideLoading();
    } else {
        console.error('❌ No room data in game started event');
        showError('Game started but no room data received');
    }
}

        // Launch EmulatorJS for Host with streaming capabilities (based on working backup)
        async function setupRetroArchLauncher() {
            console.log('🎯 HOST: Launching EmulatorJS with streaming');
            
            const gameContainer = document.getElementById('game');
            if (!gameContainer) {
                console.error('❌ HOST: Game container not found');
                return;
            }
            
            try {
                // Create iframe for the emulator - USE WORKING EJS-EMBED  
                const iframe = document.createElement('iframe');
                iframe.id = 'game-emulator';
                iframe.style.width = '100%';
                iframe.style.height = '100%';
                iframe.style.border = 'none';
                iframe.style.backgroundColor = '#000';
                iframe.src = '/ejs-embed.html#rom=' + encodeURIComponent('/roms/Street Fighter II Turbo (U).smc');
                
                gameContainer.innerHTML = '';
                gameContainer.appendChild(iframe);
                
                // Wait for iframe to load
                await new Promise(resolve => {
                    iframe.onload = () => {
                        console.log('✅ HOST: EmulatorJS iframe loaded successfully');
                        resolve();
                    };
                });
                
                console.log('✅ HOST: EmulatorJS setup complete');
                
            } catch (error) {
                console.error('❌ HOST: Failed to setup EmulatorJS:', error);
            }
        }


// Start emulator loop for rendering
function startEmulatorLoop(canvas) {
    console.log('🎮 HOST: Starting emulator loop');
    
    const ctx = canvas.getContext('2d');
    const frameRate = 60;
    const frameInterval = 1000 / frameRate;
    
    let lastFrameTime = 0;
    
    function gameLoop(currentTime) {
        if (currentTime - lastFrameTime >= frameInterval) {
            // Run emulator frame
            const frameData = emulator.runFrame();
            
            // Render to canvas if we have valid frame data
            if (frameData && frameData.video) {
                renderFrameToCanvas(ctx, frameData.video);
                } else {
                console.log('⚠️ No frame data available, skipping render');
            }
            
            lastFrameTime = currentTime;
        }
        
        requestAnimationFrame(gameLoop);
    }
    
    requestAnimationFrame(gameLoop);
    console.log('✅ HOST: Emulator loop started');
}

// Render frame data to canvas
function renderFrameToCanvas(ctx, videoData) {
    // Convert frame buffer to ImageData
    const imageData = new ImageData(
        new Uint8ClampedArray(videoData.buffer),
        256,
        224 // SNES resolution
    );

    // Clear canvas and draw frame
    ctx.clearRect(0, 0, 256, 224);
    ctx.putImageData(imageData, 0, 0);
}

// Handle host input
function handleHostInput(button, pressed) {
    console.log('🎮 HOST: Input received:', button, pressed ? 'PRESSED' : 'RELEASED');
    
    // Apply input to emulator (Player 1)
    if (emulator) {
        emulator.setInput(1, button, pressed);
    }
}

// Handle client input from netplay
function handleClientInput(data) {
    console.log('🎮 HOST: Received client input:', data);
    
    const { clientId, input, frame, timestamp } = data;
    
    // Apply input to emulator (Player 2)
    if (emulator) {
        emulator.setInput(2, input.button, input.pressed);
    }
}

// Setup netplay host
async function setupNetplayHost(room) {
    console.log('🎯 HOST: Setting up netplay host');
    
    try {
        // Initialize netplay host
        netplayHost = new NetplayHost(emulator, 55435);
        
        // Set socket reference
        netplayHost.setSocket(socket);
        
        // Start hosting
        const hostInfo = await netplayHost.startHost({
            roomId: room.id,
            maxClients: 1,
            password: null,
            isPublic: false
        });
        
        console.log('✅ HOST: Netplay host started:', hostInfo);
        
    } catch (error) {
        console.error('❌ HOST: Failed to setup netplay host:', error);
        throw error;
    }
}

// Handle client join request
function handleClientJoinRequest(data) {
    console.log('📨 HOST: Client join request received:', data);
    
    if (netplayHost) {
        netplayHost.handleClientJoinRequest(data);
    }
}

// Handle client disconnect
function handleClientDisconnect(data) {
    console.log('👋 HOST: Client disconnected:', data);
    
    if (netplayHost) {
        netplayHost.handleClientDisconnect(data);
    }
}

// Handle sync request
function handleSyncRequest(data) {
    console.log('🔄 HOST: Sync request received:', data);
    
    if (netplayHost) {
        netplayHost.handleSyncRequest(data);
    }
}



// Cleanup function
function cleanup() {
    console.log('🧹 Cleaning up netplay host...');
    
    if (netplayHost) {
        netplayHost.stopHost();
        netplayHost = null;
    }
    
    if (emulator) {
        emulator.stop();
        emulator = null;
    }
    
    if (inputSystem) {
        inputSystem.cleanup();
        inputSystem = null;
    }
    
    console.log('✅ Cleanup complete');
}

// Add cleanup on page unload
window.addEventListener('beforeunload', () => {
    cleanup();
});

// Add cleanup on page hide
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        cleanup();
    }
});

// Initialize orientation detection for Host
function initializeOrientationDetection() {
    console.log('📱 HOST: Initializing orientation detection...');
    
    let currentOrientation = getCurrentOrientation();
    
    // Listen for orientation changes
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            const newOrientation = getCurrentOrientation();
            if (newOrientation !== currentOrientation) {
                console.log(`📱 HOST: Orientation changed from ${currentOrientation} to ${newOrientation}`);
                currentOrientation = newOrientation;
                
                // Auto fullscreen on landscape
                if (newOrientation === 'landscape') {
                    requestFullscreen();
                } else if (newOrientation === 'portrait') {
                    exitFullscreen();
                }
            }
        }, 100);
    });
    
    // Also listen for resize events (fallback)
    window.addEventListener('resize', () => {
        setTimeout(() => {
            const newOrientation = getCurrentOrientation();
            if (newOrientation !== currentOrientation) {
                console.log(`📱 HOST: Orientation changed via resize from ${currentOrientation} to ${newOrientation}`);
                currentOrientation = newOrientation;
                
                // Auto fullscreen on landscape
                if (newOrientation === 'landscape') {
                    requestFullscreen();
                } else if (newOrientation === 'portrait') {
                    exitFullscreen();
                }
            }
        }, 100);
    });
}

// Get current orientation
function getCurrentOrientation() {
    if (window.innerHeight > window.innerWidth) {
        return 'portrait';
    } else {
        return 'landscape';
    }
}

// Request fullscreen using proven single player method
function requestFullscreen() {
    console.log('📱 HOST: Requesting fullscreen using proven method...');
    
    // Force landscape orientation immediately (from working single player)
    forceLandscapeOrientation();
    
    // Check if this is iPhone/iPod where native fullscreen API is blocked
    if (isIOSIPhone()) {
        console.log('📱 HOST: iPhone/iPod detected - using CSS fullscreen (native API blocked)');
        activateCSSFullscreen();
        return;
    }
    
    // Try browser fullscreen API for other devices
    const element = document.documentElement;
    const fullscreenPromise = element.requestFullscreen ? element.requestFullscreen() :
                             element.webkitRequestFullscreen ? element.webkitRequestFullscreen() :
                             element.mozRequestFullScreen ? element.mozRequestFullScreen() :
                             element.msRequestFullscreen ? element.msRequestFullscreen() :
                             null;
    
    if (fullscreenPromise) {
        fullscreenPromise.then(() => {
            console.log('📱 HOST: Browser fullscreen activated');
            // Ensure landscape after fullscreen with multiple attempts
            setTimeout(() => forceLandscapeOrientation(), 100);
            setTimeout(() => forceLandscapeOrientation(), 500);
            setTimeout(() => forceLandscapeOrientation(), 1000);
        }).catch((err) => {
            console.log('📱 HOST: Browser fullscreen failed, using CSS fallback:', err);
            // Fallback to CSS-based fullscreen
            activateCSSFullscreen();
        });
    } else {
        console.log('📱 HOST: Fullscreen API not supported, using CSS fallback');
        activateCSSFullscreen();
    }
}

// Exit fullscreen using proven single player method
function exitFullscreen() {
    console.log('📱 HOST: Exiting fullscreen using proven method...');
    
    // Exit browser fullscreen if active
    if (document.fullscreenElement || document.webkitFullscreenElement || 
        document.mozFullScreenElement || document.msFullscreenElement) {
        
        const exitPromise = document.exitFullscreen ? document.exitFullscreen() :
                           document.webkitExitFullscreen ? document.webkitExitFullscreen() :
                           document.mozCancelFullScreen ? document.mozCancelFullScreen() :
                           document.msExitFullscreen ? document.msExitFullscreen() :
                           Promise.resolve();
        
        exitPromise.then(() => {
            console.log('📱 HOST: Successfully exited fullscreen');
        }).catch((err) => {
            console.log('📱 HOST: Failed to exit fullscreen:', err);
        });
    }
    
    // Clean up fullscreen classes
    document.body.classList.remove('mobile-fullscreen');
    
    // Unlock orientation if possible
    if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
    }
    
    // Reset viewport
    let viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, user-scalable=yes');
    }
    
    console.log('📱 HOST: Fullscreen cleanup completed');
}

// Force landscape orientation (from working single player)
function forceLandscapeOrientation() {
    console.log('📱 HOST: Forcing landscape orientation...');
    
    // Method 1: Screen Orientation API
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape-primary').then(() => {
            console.log('📱 HOST: Successfully locked to landscape-primary');
        }).catch((err) => {
            console.log('📱 HOST: Landscape-primary failed, trying landscape:', err);
            screen.orientation.lock('landscape').catch(e => {
                console.log('📱 HOST: Standard landscape failed:', e);
            });
        });
    }
    
    // Method 2: Force viewport meta tag with orientation
    let viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, orientation=landscape');
    }
    
    console.log('📱 HOST: Landscape forcing applied');
}

// CSS-based fullscreen (from working single player)
function activateCSSFullscreen() {
    console.log('📱 HOST: Activating CSS fullscreen mode');
    document.body.classList.add('mobile-fullscreen');
    
    // Apply landscape orientation
    forceLandscapeOrientation();
    
    // Hide address bar on mobile
    if (window.scrollTo) {
        window.scrollTo(0, 1);
        setTimeout(() => window.scrollTo(0, 1), 100);
    }
    
    // Make page feel more app-like
    document.body.style.overflow = 'hidden';
    
    console.log('📱 HOST: CSS fullscreen activated');
}

// Detect iOS iPhone/iPod (from working single player)
function isIOSIPhone() {
    return /iPhone|iPod/.test(navigator.userAgent);
}

// Add script includes for netplay system
function loadNetplayScripts() {
    // RetroArch handles its own emulation and netplay
    console.log('📚 Using RetroArch launcher (no custom scripts needed)');
    initializeApp();
}

// Update connection status
function updateConnectionStatus(text, type) {
    if (elements.connectionStatus) {
        elements.connectionStatus.textContent = text;
        elements.connectionStatus.className = `connection-status ${type}`;
    }
}

// Show/hide loading
function showLoading(text = 'Loading...') {
    if (elements.loading) {
        elements.loading.style.display = 'block';
        elements.loading.querySelector('div:last-child').textContent = text;
    }
}

function hideLoading() {
    if (elements.loading) {
        elements.loading.style.display = 'none';
        console.log('🔄 Loading hidden');
    }
}

// Show error with retry option
function showError(message) {
    console.error('❌ Error:', message);
    
    let errorDisplay = document.getElementById('error-display');
    if (!errorDisplay) {
        errorDisplay = document.createElement('div');
        errorDisplay.id = 'error-display';
        errorDisplay.className = 'error-display';
        document.body.appendChild(errorDisplay);
    }
    
    errorDisplay.innerHTML = `
        <strong>Error:</strong> ${message}
        <br>
        <button class="retry-btn" onclick="retryConnection()">Retry Connection</button>
    `;
}

// Handle error events
function handleError(error) {
    console.error('🚨 Server error:', error);
    showError(error.message || 'Unknown server error');
}

// Retry connection
function retryConnection() {
    console.log('🔄 Retrying connection...');
    
    // Remove error display
    const errorDisplay = document.getElementById('error-display');
    if (errorDisplay) {
        errorDisplay.remove();
    }
    
    // Show loading
    showLoading('Reconnecting...');
    
    // Reconnect
    if (socket) {
        socket.disconnect();
    }
    
    setTimeout(() => {
        connectToServer();
    }, 1000);
}

console.log('✅ Mobile Game System Loaded');