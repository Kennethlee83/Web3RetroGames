/**
 * NetplayClient - RetroArch-style netplay client implementation
 * Connects to host and synchronizes game state
 */

class NetplayClient {
    constructor(emulator) {
        this.emulator = emulator;
        this.socket = null;
        this.hostIP = null;
        this.port = 55435;
        this.roomId = null;
        this.playerNumber = 0;
        this.isConnected = false;
        this.isHost = false;
        
        // Synchronization
        this.frameBuffer = [];
        this.maxFrameBuffer = 10;
        this.inputDelay = 2; // frames
        this.lastSyncTime = 0;
        this.syncRequested = false;
        
        // Input handling
        this.inputHistory = [];
        this.maxInputHistory = 120; // 2 seconds at 60fps
        this.pendingInputs = [];
        
        // Performance monitoring
        this.latency = 0;
        this.frameDrops = 0;
        this.lastFrameTime = 0;
        
        console.log('🎮 NetplayClient initialized');
    }

    /**
     * Connect to a netplay host
     */
    async connectToHost(hostIP, port = 55435, options = {}) {
        try {
            console.log('🔌 Connecting to netplay host:', hostIP + ':' + port);
            
            this.hostIP = hostIP;
            this.port = port;
            this.roomId = options.roomId || null;
            this.password = options.password || null;
            this.playerName = options.playerName || 'Player';
            
            // Setup socket connection
            await this.setupSocketConnection();
            
            // Send join request
            this.sendJoinRequest();
            
            return new Promise((resolve, reject) => {
                this.connectionPromise = { resolve, reject };
                
                // Timeout after 10 seconds
                setTimeout(() => {
                    if (!this.isConnected) {
                        reject(new Error('Connection timeout'));
                    }
                }, 10000);
            });
            
        } catch (error) {
            console.error('❌ Failed to connect to host:', error);
            throw error;
        }
    }

    /**
     * Setup socket connection
     */
    async setupSocketConnection() {
        return new Promise((resolve, reject) => {
            try {
                // Create socket connection
                this.socket = io(`http://${this.hostIP}:${this.port}`, {
                    timeout: 5000,
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000
                });
                
                // Connection events
                this.socket.on('connect', () => {
                    console.log('✅ Connected to netplay host');
                    this.setupSocketHandlers();
                    resolve();
                });
                
                this.socket.on('connect_error', (error) => {
                    console.error('❌ Connection error:', error);
                    reject(error);
                });
                
                this.socket.on('disconnect', (reason) => {
                    console.log('❌ Disconnected from host:', reason);
                    this.handleDisconnection();
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Setup socket event handlers
     */
    setupSocketHandlers() {
        // Handle join response
        this.socket.on('client_joined', (data) => {
            this.handleJoinResponse(data);
        });
        
        this.socket.on('join_rejected', (data) => {
            this.handleJoinRejected(data);
        });
        
        // Handle game state updates
        this.socket.on('frame_data', (data) => {
            this.handleFrameData(data);
        });
        
        this.socket.on('remote_input', (data) => {
            this.handleRemoteInput(data);
        });
        
        // Handle synchronization
        this.socket.on('sync_response', (data) => {
            this.handleSyncResponse(data);
        });
        
        // Handle client list updates
        this.socket.on('client_list_updated', (data) => {
            this.handleClientListUpdate(data);
        });
        
        // Handle errors
        this.socket.on('error', (error) => {
            console.error('❌ Socket error:', error);
        });
        
        console.log('✅ Socket handlers setup complete');
    }

    /**
     * Send join request to host
     */
    sendJoinRequest() {
        const joinData = {
            clientId: this.socket.id,
            romChecksum: this.emulator.romChecksum,
            playerName: this.playerName,
            roomId: this.roomId,
            password: this.password
        };
        
        console.log('📤 Sending join request:', joinData);
        this.socket.emit('client_join_request', joinData);
    }

    /**
     * Handle join response from host
     */
    handleJoinResponse(data) {
        console.log('✅ Join request accepted:', data);
        
        this.playerNumber = data.playerNumber;
        this.roomId = data.roomId;
        this.isConnected = true;
        
        // Restore game state from host
        if (data.gameState) {
            this.emulator.setState(data.gameState);
        }
        
        // Start local game loop
        this.startLocalGameLoop();
        
        // Resolve connection promise
        if (this.connectionPromise) {
            this.connectionPromise.resolve({
                playerNumber: this.playerNumber,
                roomId: this.roomId,
                gameState: data.gameState
            });
            this.connectionPromise = null;
        }
        
        console.log('🎮 Connected as Player', this.playerNumber);
    }

    /**
     * Handle join rejection from host
     */
    handleJoinRejected(data) {
        console.error('❌ Join request rejected:', data.reason);
        
        this.isConnected = false;
        
        // Reject connection promise
        if (this.connectionPromise) {
            this.connectionPromise.reject(new Error(data.reason));
            this.connectionPromise = null;
        }
    }

    /**
     * Handle frame data from host
     */
    handleFrameData(data) {
        // Store frame data for synchronization
        this.frameBuffer.push({
            frame: data.frame,
            checksum: data.checksum,
            timestamp: data.timestamp,
            video: data.video // Store video data for rendering
        });
        
        // Limit buffer size
        if (this.frameBuffer.length > this.maxFrameBuffer) {
            this.frameBuffer.shift();
        }
        
        // Update latency
        this.latency = Date.now() - data.timestamp;
        
        // Check for frame drops
        if (this.lastFrameTime > 0) {
            const expectedFrame = this.lastFrameTime + 1;
            if (data.frame > expectedFrame) {
                this.frameDrops += (data.frame - expectedFrame);
            }
        }
        this.lastFrameTime = data.frame;
        
        // Render the received frame if we have a render callback
        if (data.video && this.onFrameReceived) {
            this.onFrameReceived(data.video);
        }
    }

    /**
     * Handle remote input from other players
     */
    handleRemoteInput(data) {
        const { player, input, frame, timestamp } = data;
        
        // Store input in history
        this.inputHistory.push({
            frame,
            player,
            input,
            timestamp
        });
        
        // Limit history size
        if (this.inputHistory.length > this.maxInputHistory) {
            this.inputHistory.shift();
        }
        
        // Apply input to emulator
        this.emulator.setInput(player, input.button, input.pressed);
        
        console.log('🎮 Remote input from Player', player + ':', input.button, input.pressed ? 'PRESSED' : 'RELEASED');
    }

    /**
     * Handle sync response from host
     */
    handleSyncResponse(data) {
        console.log('🔄 Sync response received for frame', data.currentFrame);
        
        // Restore game state
        if (data.gameState) {
            this.emulator.setState(data.gameState);
        }
        
        // Update frame data
        if (data.frameData) {
            this.frameBuffer = [{
                frame: data.currentFrame,
                data: data.frameData,
                timestamp: Date.now()
            }];
        }
        
        this.syncRequested = false;
        this.lastSyncTime = Date.now();
    }

    /**
     * Handle client list updates
     */
    handleClientListUpdate(data) {
        console.log('👥 Client list updated:', data.clients);
        // Could update UI with player list
    }

    /**
     * Handle disconnection
     */
    handleDisconnection() {
        this.isConnected = false;
        this.stopLocalGameLoop();
        
        console.log('👋 Disconnected from netplay host');
    }

    /**
     * Start local game loop
     */
    startLocalGameLoop() {
        console.log('🎮 Starting local game loop...');
        
        const frameInterval = 1000 / 60; // 60 FPS
        
        this.gameLoopInterval = setInterval(() => {
            if (!this.isConnected) return;
            
            // Run local emulator frame
            const frameData = this.emulator.runFrame();
            
            // Sync with host frame data if available
            if (this.frameBuffer.length > 0) {
                this.syncWithHost(frameData);
            }
            
            // Process pending inputs
            this.processPendingInputs();
            
        }, frameInterval);
        
        console.log('✅ Local game loop started');
    }

    /**
     * Stop local game loop
     */
    stopLocalGameLoop() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
            console.log('⏹️ Local game loop stopped');
        }
    }

    /**
     * Synchronize with host frame data
     */
    syncWithHost(localFrameData) {
        if (this.frameBuffer.length === 0) return;
        
        const hostFrame = this.frameBuffer[0];
        const localChecksum = localFrameData.checksum;
        
        // Check for desync
        if (hostFrame.checksum !== localChecksum) {
            console.warn('⚠️ Desync detected, requesting resync');
            this.requestResync();
        }
    }

    /**
     * Request resynchronization from host
     */
    requestResync() {
        if (this.syncRequested) return;
        
        this.syncRequested = true;
        
        this.socket.emit('sync_request', {
            clientId: this.socket.id,
            frame: this.emulator.frameCount
        });
        
        console.log('🔄 Resync requested for frame', this.emulator.frameCount);
    }

    /**
     * Send input to host
     */
    sendInput(button, pressed) {
        if (!this.isConnected || !this.socket) {
            console.warn('⚠️ Cannot send input - not connected');
            return;
        }
        
        const inputData = {
            clientId: this.socket.id,
            input: {
                button,
                pressed
            },
            frame: this.emulator.frameCount + this.inputDelay,
            timestamp: Date.now()
        };
        
        // Store input locally
        this.inputHistory.push({
            frame: inputData.frame,
            player: this.playerNumber,
            input: inputData.input,
            timestamp: inputData.timestamp
        });
        
        // Limit history size
        if (this.inputHistory.length > this.maxInputHistory) {
            this.inputHistory.shift();
        }
        
        // Send to host
        this.socket.emit('client_input', inputData);
        
        console.log('📤 Input sent:', button, pressed ? 'PRESSED' : 'RELEASED');
    }

    /**
     * Process pending inputs
     */
    processPendingInputs() {
        while (this.pendingInputs.length > 0) {
            const input = this.pendingInputs.shift();
            this.emulator.setInput(input.player, input.button, input.pressed);
        }
    }

    /**
     * Disconnect from host
     */
    disconnect() {
        console.log('👋 Disconnecting from netplay host...');
        
        if (this.socket) {
            this.socket.emit('client_disconnect', {
                clientId: this.socket.id
            });
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.isConnected = false;
        this.stopLocalGameLoop();
        
        // Clear state
        this.frameBuffer = [];
        this.inputHistory = [];
        this.pendingInputs = [];
        
        console.log('✅ Disconnected from netplay host');
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            hostIP: this.hostIP,
            port: this.port,
            roomId: this.roomId,
            playerNumber: this.playerNumber,
            latency: this.latency,
            frameDrops: this.frameDrops,
            frameBufferSize: this.frameBuffer.length
        };
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats() {
        return {
            latency: this.latency,
            frameDrops: this.frameDrops,
            frameBufferSize: this.frameBuffer.length,
            inputHistorySize: this.inputHistory.length,
            lastSyncTime: this.lastSyncTime
        };
    }

    /**
     * Update input delay
     */
    setInputDelay(delay) {
        this.inputDelay = Math.max(0, Math.min(10, delay));
        console.log('⚙️ Input delay set to', this.inputDelay, 'frames');
    }

    /**
     * Get input history for a specific frame range
     */
    getInputHistory(startFrame, endFrame) {
        return this.inputHistory.filter(input => 
            input.frame >= startFrame && input.frame <= endFrame
        );
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetplayClient;
} else {
    window.NetplayClient = NetplayClient;
}
