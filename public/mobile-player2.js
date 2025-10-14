// WeAD Mobile Player 2 - Netplay Client
// Connects to host via netplay and synchronizes game state

// Globals
let socket = null;
let netplayClient = null;
let emulator = null;
let inputSystem = null;
let currentRoom = null;

// URL params
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId') || urlParams.get('room');
const playerId = urlParams.get('playerId') || urlParams.get('player');
const username = urlParams.get('username');
const isHost = urlParams.get('isHost') === 'true';

// Elements
const elements = {
  gameVideo: null,
  gameTitle: null,
  connectionStatus: null,
  loading: null,
};

document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ PLAYER 2: Mobile Netplay Interface Initialized');
  
  // Load netplay scripts first
  loadNetplayScripts();
});

// Initialize app after scripts are loaded
function initializeApp() {
  elements.gameVideo = document.getElementById('game-video');
  elements.gameTitle = document.getElementById('game-title');
  elements.connectionStatus = document.getElementById('connection-status');
  elements.loading = document.getElementById('loading');

  if (!roomId || !playerId) {
    showError('Missing room or player ID');
    return;
  }

  connectToServer();
}

function connectToServer() {
  updateConnectionStatus('Connecting...', 'disconnected');
  socket = io({
    timeout: 30000,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    forceNew: true
  });

  socket.on('connect', () => {
    console.log('✅ PLAYER 2: Connected to server');
    updateConnectionStatus('Connected - Joining...', 'connected');
    joinGameRoom();
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ PLAYER 2: Disconnected from server:', reason);
    updateConnectionStatus('Disconnected', 'disconnected');
  });

  socket.on('error', (error) => {
    console.error('❌ PLAYER 2: Socket error:', error);
    showError('Socket error: ' + JSON.stringify(error));
  });

  // Game flow
  socket.on('game_started', handleGameStarted);
  socket.on('game_room_joined', (data) => {
    console.log('🎮 PLAYER 2: Game room joined event:', data);
  });

  // Netplay events
  socket.on('client_joined', handleClientJoined);
  socket.on('join_rejected', handleJoinRejected);
  socket.on('frame_data', handleFrameData);
  socket.on('remote_input', handleRemoteInput);
  socket.on('sync_response', handleSyncResponse);
  socket.on('client_list_updated', handleClientListUpdate);
}

function joinGameRoom() {
  console.log('🎮 PLAYER 2: Joining game room:', { roomId, playerId, username });
  socket.emit('join_game_room', {
    roomId: roomId,
    playerId: playerId,
    username: username
  });
}

// Accept both formats: direct room object or { room }
function handleGameStarted(data) {
  console.log('🎮 PLAYER 2: Game started event received:', data);
  const roomData = (data && data.room) ? data.room : data;
  console.log('🎮 PLAYER 2: Room data:', roomData);
  
  if (!roomData || !roomData.id) {
    console.error('❌ PLAYER 2: Invalid room data:', roomData);
    showError('Game started but no room data received');
    return;
  }

  console.log('✅ PLAYER 2: Setting up netplay client...');
  currentRoom = roomData;
  setupPlayer2NetplayUI();
  setupNetplayClient();
  updateConnectionStatus('Player 2 - Connected', 'connected');
  hideLoading();
}

function setupPlayer2NetplayUI() {
  const gameContainer = document.getElementById('game');
  if (!gameContainer) return;
  
  // Create canvas for game display
  const canvas = document.createElement('canvas');
  canvas.id = 'game-canvas';
  canvas.width = 256;
  canvas.height = 224; // SNES resolution
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.border = 'none';
  canvas.style.backgroundColor = '#000';
  
  gameContainer.innerHTML = '';
  gameContainer.appendChild(canvas);
  
  console.log('✅ PLAYER 2: Netplay UI setup complete');
}

async function setupNetplayClient() {
  if (netplayClient) {
    console.log('⚠️ PLAYER 2: Netplay client already set up');
    return;
  }

  console.log('🔧 PLAYER 2: Setting up netplay client...');

  try {
    // Initialize emulator
    emulator = new BaseEmulator();
    
    // Load ROM
    const romPath = '/roms/Street Fighter II Turbo (U).smc';
    const response = await fetch(romPath);
    const romData = await response.arrayBuffer();
    
    await emulator.loadROM(romData);
    console.log('✅ PLAYER 2: ROM loaded successfully');
    
    // Initialize input system
    inputSystem = new InputSystem();
    inputSystem.setupEventListeners();
    inputSystem.startPolling();
    
    // Setup input event handling
    window.addEventListener('inputEvent', (event) => {
      const { button, pressed } = event.detail;
      handlePlayer2Input(button, pressed);
    });
    
    // Initialize netplay client
    netplayClient = new NetplayClient(emulator);
    
    // Connect to host
    const hostIP = window.location.hostname;
    const hostPort = 55435;
    
    await netplayClient.connectToHost(hostIP, hostPort, {
      roomId: roomId,
      playerName: username || 'Player2'
    });
    
    console.log('✅ PLAYER 2: Netplay client connected successfully');
    
    // Start emulator loop
    startEmulatorLoop();
    
  } catch (error) {
    console.error('❌ PLAYER 2: Failed to setup netplay client:', error);
    showError('Failed to setup netplay client: ' + error.message);
  }
}

// Handle client joined response
function handleClientJoined(data) {
  console.log('✅ PLAYER 2: Client joined response:', data);
  
  if (netplayClient) {
    netplayClient.handleJoinResponse(data);
  }
}

// Handle join rejection
function handleJoinRejected(data) {
  console.error('❌ PLAYER 2: Join rejected:', data.reason);
  
  if (netplayClient) {
    netplayClient.handleJoinRejected(data);
  }
}

// Handle frame data from host
function handleFrameData(data) {
  console.log('📡 PLAYER 2: Frame data received:', data);
  
  if (netplayClient) {
    netplayClient.handleFrameData(data);
  }
}

// Handle remote input from host
function handleRemoteInput(data) {
  console.log('🎮 PLAYER 2: Remote input received:', data);
  
  if (netplayClient) {
    netplayClient.handleRemoteInput(data);
  }
}

// Handle sync response
function handleSyncResponse(data) {
  console.log('🔄 PLAYER 2: Sync response received:', data);
  
  if (netplayClient) {
    netplayClient.handleSyncResponse(data);
  }
}

// Handle client list update
function handleClientListUpdate(data) {
  console.log('👥 PLAYER 2: Client list updated:', data);
  
  if (netplayClient) {
    netplayClient.handleClientListUpdate(data);
  }
}

// Start emulator loop for rendering
function startEmulatorLoop() {
  console.log('🎮 PLAYER 2: Starting emulator loop');
  
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.error('❌ PLAYER 2: Canvas not found');
    return;
  }
  
  const ctx = canvas.getContext('2d');
  const frameRate = 60;
  const frameInterval = 1000 / frameRate;
  
  let lastFrameTime = 0;
  
  // Set up frame rendering callback for netplay client
  netplayClient.onFrameReceived = (videoData) => {
    renderFrameToCanvas(ctx, videoData);
  };
  
  console.log('✅ PLAYER 2: Frame rendering callback set up');
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

// Handle player 2 input
function handlePlayer2Input(button, pressed) {
  console.log('🎮 PLAYER 2: Input received:', button, pressed ? 'PRESSED' : 'RELEASED');
  
  // Send input to host via netplay
  if (netplayClient) {
    netplayClient.sendInput(button, pressed);
  }
}

function updateConnectionStatus(text, type) {
  if (elements.connectionStatus) {
    elements.connectionStatus.textContent = text;
    elements.connectionStatus.className = `connection-status ${type}`;
  }
}

function showLoading(text = 'Loading...') {
  if (elements.loading) {
    elements.loading.style.display = 'block';
    const msg = elements.loading.querySelector('div:last-child');
    if (msg) msg.textContent = text;
  }
}

function hideLoading() {
  if (elements.loading) elements.loading.style.display = 'none';
}

function showError(message) {
  console.error(message);
  let errorDisplay = document.getElementById('error-display');
  if (!errorDisplay) {
    errorDisplay = document.createElement('div');
    errorDisplay.id = 'error-display';
    errorDisplay.className = 'error-display';
    document.body.appendChild(errorDisplay);
  }
  errorDisplay.innerHTML = `
    <div>❌ Error: ${message}</div>
    <button class="retry-btn" onclick="retryConnection()">Retry</button>
  `;
}

function retryConnection() {
  const errorDisplay = document.getElementById('error-display');
  if (errorDisplay) errorDisplay.remove();
  showLoading('Reconnecting...');
  if (socket) socket.disconnect();
  setTimeout(connectToServer, 800);
}

// Cleanup function
function cleanup() {
  console.log('🧹 PLAYER 2: Cleaning up netplay client...');
  
  if (netplayClient) {
    netplayClient.disconnect();
    netplayClient = null;
  }
  
  if (emulator) {
    emulator.stop();
    emulator = null;
  }
  
  if (inputSystem) {
    inputSystem.cleanup();
    inputSystem = null;
  }
  
  console.log('✅ PLAYER 2: Cleanup complete');
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

// Add script includes for netplay system
function loadNetplayScripts() {
  const scripts = [
    '/netplay/BaseEmulator.js',
    '/netplay/NetplayHost.js',
    '/netplay/NetplayClient.js',
    '/netplay/RollbackNetcode.js',
    '/netplay/InputSystem.js'
  ];
  
  let loadedCount = 0;
  const totalScripts = scripts.length;
  
  scripts.forEach(src => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => {
      loadedCount++;
      console.log(`📚 PLAYER 2: Loaded script: ${src} (${loadedCount}/${totalScripts})`);
      if (loadedCount === totalScripts) {
        console.log('✅ PLAYER 2: All netplay scripts loaded successfully');
        // Initialize the rest of the app after scripts are loaded
        initializeApp();
      }
    };
    script.onerror = () => {
      console.error(`❌ PLAYER 2: Failed to load script: ${src}`);
    };
    document.head.appendChild(script);
  });
  
  console.log('📚 PLAYER 2: Loading netplay scripts...');
}

console.log('✅ PLAYER 2: Mobile Netplay System Ready!');

// Virtual controller setup for netplay
function setupVirtualController() {
  console.log('🎮 PLAYER 2: Setting up virtual controller...');
  
  const gamepadContainer = document.getElementById('player2Gamepad');
  if (!gamepadContainer) {
    console.error('❌ PLAYER 2: Gamepad container not found');
    return;
  }
  
  // Create simple virtual controller
  gamepadContainer.innerHTML = `
    <div class="virtual-controller">
      <div class="dpad">
        <button data-button="UP" class="dpad-btn up">↑</button>
        <button data-button="DOWN" class="dpad-btn down">↓</button>
        <button data-button="LEFT" class="dpad-btn left">←</button>
        <button data-button="RIGHT" class="dpad-btn right">→</button>
      </div>
      <div class="action-buttons">
        <button data-button="A" class="action-btn">A</button>
        <button data-button="B" class="action-btn">B</button>
      </div>
      <div class="system-buttons">
        <button data-button="START" class="system-btn">START</button>
        <button data-button="SELECT" class="system-btn">SELECT</button>
      </div>
    </div>
  `;
  
  // Add event listeners
  const buttons = gamepadContainer.querySelectorAll('button');
  buttons.forEach(button => {
    button.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const buttonName = button.getAttribute('data-button');
      handlePlayer2Input(buttonName, true);
    });
    
    button.addEventListener('touchend', (e) => {
      e.preventDefault();
      const buttonName = button.getAttribute('data-button');
      handlePlayer2Input(buttonName, false);
    });
  });
  
  console.log('✅ PLAYER 2: Virtual controller setup complete');
}

// Initialize virtual controller when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Setup virtual controller after a short delay to ensure DOM is ready
  setTimeout(() => {
    setupVirtualController();
  }, 100);
});

// Add CSS styles for virtual controller
function addVirtualControllerStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .virtual-controller {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      padding: 20px;
    }
    
    .dpad {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      grid-template-rows: 1fr 1fr 1fr;
      gap: 5px;
      width: 120px;
      height: 120px;
    }
    
    .dpad-btn {
      border: 2px solid #333;
      border-radius: 8px;
      background: #f0f0f0;
      font-size: 24px;
      font-weight: bold;
      color: #333;
      cursor: pointer;
      user-select: none;
      transition: all 0.1s;
    }
    
    .dpad-btn:active {
      background: #ccc;
      transform: scale(0.95);
    }
    
    .dpad-btn.up { grid-column: 2; grid-row: 1; }
    .dpad-btn.down { grid-column: 2; grid-row: 3; }
    .dpad-btn.left { grid-column: 1; grid-row: 2; }
    .dpad-btn.right { grid-column: 3; grid-row: 2; }
    
    .action-buttons {
      display: flex;
      gap: 20px;
    }
    
    .action-btn {
      width: 60px;
      height: 60px;
      border: 2px solid #333;
      border-radius: 50%;
      background: #f0f0f0;
      font-size: 20px;
      font-weight: bold;
      color: #333;
      cursor: pointer;
      user-select: none;
      transition: all 0.1s;
    }
    
    .action-btn:active {
      background: #ccc;
      transform: scale(0.95);
    }
    
    .system-buttons {
      display: flex;
      gap: 20px;
    }
    
    .system-btn {
      width: 80px;
      height: 40px;
      border: 2px solid #333;
      border-radius: 8px;
      background: #f0f0f0;
      font-size: 14px;
      font-weight: bold;
      color: #333;
      cursor: pointer;
      user-select: none;
      transition: all 0.1s;
    }
    
    .system-btn:active {
      background: #ccc;
      transform: scale(0.95);
    }
  `;
  document.head.appendChild(style);
}

// Add styles when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  addVirtualControllerStyles();
});

console.log('✅ PLAYER 2: Mobile Netplay System Ready!');

// Final cleanup and initialization
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎮 PLAYER 2: Netplay system initialized');
});




// Request fullscreen using proven single player method
function requestFullscreen() {
  console.log('🎮 PLAYER 2: Requesting fullscreen using proven method...');
  
  // Force landscape orientation immediately (from working single player)
  forceLandscapeOrientation();
  
  // Check if this is iPhone/iPod where native fullscreen API is blocked
  if (isIOSIPhone()) {
    console.log('🎮 PLAYER 2: iPhone/iPod detected - using CSS fullscreen (native API blocked)');
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
      console.log('🎮 PLAYER 2: Browser fullscreen activated');
      // Ensure landscape after fullscreen with multiple attempts
      setTimeout(() => forceLandscapeOrientation(), 100);
      setTimeout(() => forceLandscapeOrientation(), 500);
      setTimeout(() => forceLandscapeOrientation(), 1000);
    }).catch((err) => {
      console.log('🎮 PLAYER 2: Browser fullscreen failed, using CSS fallback:', err);
      // Fallback to CSS-based fullscreen
      activateCSSFullscreen();
    });
  } else {
    console.log('🎮 PLAYER 2: Fullscreen API not supported, using CSS fallback');
    activateCSSFullscreen();
  }
}

// Exit fullscreen using proven single player method
function exitFullscreen() {
  console.log('🎮 PLAYER 2: Exiting fullscreen using proven method...');
  
  // Exit browser fullscreen if active
  if (document.fullscreenElement || document.webkitFullscreenElement || 
      document.mozFullScreenElement || document.msFullscreenElement) {
    
    const exitPromise = document.exitFullscreen ? document.exitFullscreen() :
                       document.webkitExitFullscreen ? document.webkitExitFullscreen() :
                       document.mozCancelFullScreen ? document.mozCancelFullScreen() :
                       document.msExitFullscreen ? document.msExitFullscreen() :
                       Promise.resolve();
    
    exitPromise.then(() => {
      console.log('🎮 PLAYER 2: Successfully exited fullscreen');
    }).catch((err) => {
      console.log('🎮 PLAYER 2: Failed to exit fullscreen:', err);
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
  
  console.log('🎮 PLAYER 2: Fullscreen cleanup completed');
}

// Force landscape orientation (from working single player)
function forceLandscapeOrientation() {
  console.log('🎮 PLAYER 2: Forcing landscape orientation...');
  
  // Method 1: Screen Orientation API
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape-primary').then(() => {
      console.log('🎮 PLAYER 2: Successfully locked to landscape-primary');
    }).catch((err) => {
      console.log('🎮 PLAYER 2: Landscape-primary failed, trying landscape:', err);
      screen.orientation.lock('landscape').catch(e => {
        console.log('🎮 PLAYER 2: Standard landscape failed:', e);
      });
    });
  }
  
  // Method 2: Force viewport meta tag with orientation
  let viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, orientation=landscape');
  }
  
  console.log('🎮 PLAYER 2: Landscape forcing applied');
}

// CSS-based fullscreen (from working single player)
function activateCSSFullscreen() {
  console.log('🎮 PLAYER 2: Activating CSS fullscreen mode');
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
  
  console.log('🎮 PLAYER 2: CSS fullscreen activated');
}

// Detect iOS iPhone/iPod (from working single player)
function isIOSIPhone() {
  return /iPhone|iPod/.test(navigator.userAgent);
}
