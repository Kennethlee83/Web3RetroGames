/**
 * NetplayHost - RetroArch-style netplay host implementation
 * Manages game sessions and synchronizes with clients
 */

class NetplayHost {
    constructor(emulator, port = 55435) {
        this.emulator = emulator;
        this.port = port;
        this.clients = new Map();
        this.gameState = null;
        this.frameRate = 60;
        this.isRunning = false;
        this.currentFrame = 0;
        this.socket = null;
        this.roomId = null;
        this.maxClients = 1; // 2 players total (host + 1 client)
        this.password = null;
        this.isPublic = false;
        
        // Synchronization
        this.syncInterval = null;
        this.lastSyncTime = 0;
        this.frameBuffer = [];
        this.maxFrameBuffer = 10;
        
        // Input handling
        this.inputDelay = 2; // frames
        this.inputHistory = [];
        this.maxInputHistory = 120; // 2 seconds at 60fps
        
        console.log('🎯 NetplayHost initialized on port', port);
    }

    /**
     * Start hosting a netplay session
     */
    async startHost(options = {}) {
        try {
            console.log('🚀 Starting netplay host...');
            
            // Configure host settings
            this.maxClients = options.maxClients || 1;
            this.password = options.password || null;
            this.isPublic = options.isPublic || false;
            this.roomId = options.roomId || this.generateRoomId();
            
            // Initialize emulator
            if (!this.emulator) {
                throw new Error('Emulator not initialized. Please ensure emulator is created before starting netplay host.');
            }
            
            if (!this.emulator.isRunning) {
                this.emulator.reset();
            }
            
            // Start game loop
            this.startGameLoop();
            
            // Setup socket handlers
            this.setupSocketHandlers();
            
            this.isRunning = true;
            
            console.log('✅ Netplay host started successfully');
            console.log('📋 Host info:', {
                roomId: this.roomId,
                port: this.port,
                maxClients: this.maxClients,
                hasPassword: !!this.password
            });
            
            return {
                roomId: this.roomId,
                port: this.port,
                maxClients: this.maxClients,
                hasPassword: !!this.password
            };
            
        } catch (error) {
            console.error('❌ Failed to start netplay host:', error);
            throw error;
        }
    }

    /**
     * Stop hosting
     */
    stopHost() {
        console.log('🛑 Stopping netplay host...');
        
        this.isRunning = false;
        
        // Stop game loop
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        // Disconnect all clients
        this.clients.forEach(client => {
            this.disconnectClient(client.id);
        });
        
        // Clear state
        this.clients.clear();
        this.frameBuffer = [];
        this.inputHistory = [];
        
        console.log('✅ Netplay host stopped');
    }

    /**
     * Generate unique room ID
     */
    generateRoomId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let roomId = '';
        for (let i = 0; i < 6; i++) {
            roomId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return roomId;
    }

    /**
     * Setup socket event handlers
     */
    setupSocketHandlers() {
        if (!this.socket) {
            console.warn('⚠️ No socket available for host');
            return;
        }

        // Handle client connections
        this.socket.on('client_join_request', (data) => {
            this.handleClientJoinRequest(data);
        });

        // Handle client input
        this.socket.on('client_input', (data) => {
            this.handleClientInput(data);
        });

        // Handle client disconnection
        this.socket.on('client_disconnect', (data) => {
            this.handleClientDisconnect(data);
        });

        // Handle sync requests
        this.socket.on('sync_request', (data) => {
            this.handleSyncRequest(data);
        });

        console.log('✅ Socket handlers setup complete');
    }

    /**
     * Handle client join request
     */
    handleClientJoinRequest(data) {
        console.log('📨 Client join request:', data);
        
        const { clientId, romChecksum, playerName } = data;
        
        // Verify ROM checksum
        if (romChecksum !== this.emulator.romChecksum) {
            this.socket.emit('join_rejected', {
                clientId,
                reason: 'ROM checksum mismatch',
                expectedChecksum: this.emulator.romChecksum
            });
            return;
        }
        
        // Check if room is full
        if (this.clients.size >= this.maxClients) {
            this.socket.emit('join_rejected', {
                clientId,
                reason: 'Room is full'
            });
            return;
        }
        
        // Verify password if required
        if (this.password && data.password !== this.password) {
            this.socket.emit('join_rejected', {
                clientId,
                reason: 'Invalid password'
            });
            return;
        }
        
        // Accept client
        const playerNumber = this.clients.size + 2; // Host is player 1
        const client = {
            id: clientId,
            playerNumber,
            playerName: playerName || `Player${playerNumber}`,
            lastInputFrame: 0,
            lastSyncTime: Date.now(),
            isConnected: true
        };
        
        this.clients.set(clientId, client);
        
        // Send acceptance
        this.socket.emit('client_joined', {
            clientId,
            playerNumber,
            gameState: this.emulator.getState(),
            currentFrame: this.currentFrame,
            roomId: this.roomId
        });
        
        console.log('✅ Client joined:', client.playerName, 'as Player', playerNumber);
        
        // Notify other clients
        this.broadcastToClients('client_list_updated', {
            clients: Array.from(this.clients.values())
        });
    }

    /**
     * Handle client input
     */
    handleClientInput(data) {
        const { clientId, input, frame, timestamp } = data;
        const client = this.clients.get(clientId);
        
        if (!client) {
            console.warn('⚠️ Input from unknown client:', clientId);
            return;
        }
        
        // Validate input timing
        if (frame < this.currentFrame - this.inputDelay) {
            console.warn('⚠️ Input too old, ignoring');
            return;
        }
        
        // Store input in history
        this.inputHistory.push({
            frame,
            player: client.playerNumber,
            input,
            timestamp,
            clientId
        });
        
        // Limit history size
        if (this.inputHistory.length > this.maxInputHistory) {
            this.inputHistory.shift();
        }
        
        // Apply input to emulator
        this.emulator.setInput(client.playerNumber, input.button, input.pressed);
        
        // Broadcast input to other clients
        this.broadcastToClients('remote_input', {
            player: client.playerNumber,
            input,
            frame,
            timestamp
        }, clientId);
        
        console.log('🎮 Input from', client.playerName + ':', input.button, input.pressed ? 'PRESSED' : 'RELEASED');
    }

    /**
     * Handle client disconnection
     */
    handleClientDisconnect(data) {
        const { clientId } = data;
        const client = this.clients.get(clientId);
        
        if (client) {
            console.log('👋 Client disconnected:', client.playerName);
            this.clients.delete(clientId);
            
            // Notify other clients
            this.broadcastToClients('client_list_updated', {
                clients: Array.from(this.clients.values())
            });
        }
    }

    /**
     * Handle sync request from client
     */
    handleSyncRequest(data) {
        const { clientId, frame } = data;
        const client = this.clients.get(clientId);
        
        if (!client) {
            return;
        }
        
        // Send current game state
        this.socket.emit('sync_response', {
            clientId,
            gameState: this.emulator.getState(),
            currentFrame: this.currentFrame,
            frameData: this.getFrameData(frame)
        });
        
        console.log('🔄 Sync sent to', client.playerName, 'for frame', frame);
    }

    /**
     * Start the game loop
     */
    startGameLoop() {
        console.log('🎮 Starting netplay game loop...');
        
        const frameInterval = 1000 / this.frameRate;
        
        this.syncInterval = setInterval(() => {
            if (!this.isRunning) return;
            
            const startTime = Date.now();
            
            // Run emulator frame
            const frameData = this.emulator.runFrame();
            this.currentFrame++;
            
            // Store frame data
            this.frameBuffer.push({
                frame: this.currentFrame,
                data: frameData,
                timestamp: startTime
            });
            
            // Limit buffer size
            if (this.frameBuffer.length > this.maxFrameBuffer) {
                this.frameBuffer.shift();
            }
            
            // Broadcast frame data to clients
            this.broadcastFrameData(frameData);
            
            // Maintain consistent frame rate
            const elapsed = Date.now() - startTime;
            const delay = Math.max(0, frameInterval - elapsed);
            
            if (delay > 0) {
                setTimeout(() => {}, delay);
            }
            
        }, frameInterval);
        
        console.log('✅ Game loop started at', this.frameRate, 'FPS');
    }

    /**
     * Broadcast frame data to all clients
     */
    broadcastFrameData(frameData) {
        if (this.clients.size === 0) return;
        
        const packet = {
            frame: this.currentFrame,
            checksum: frameData.checksum,
            timestamp: Date.now(),
            video: frameData.video // Include video data for client rendering
        };
        
        this.broadcastToClients('frame_data', packet);
    }

    /**
     * Broadcast message to all clients
     */
    broadcastToClients(event, data, excludeClientId = null) {
        if (!this.socket) return;
        
        this.clients.forEach((client, clientId) => {
            if (clientId !== excludeClientId && client.isConnected) {
                this.socket.emit(event, {
                    ...data,
                    targetClientId: clientId
                });
            }
        });
    }

    /**
     * Get frame data for a specific frame
     */
    getFrameData(frame) {
        const frameData = this.frameBuffer.find(f => f.frame === frame);
        return frameData ? frameData.data : null;
    }

    /**
     * Get input history for a specific frame range
     */
    getInputHistory(startFrame, endFrame) {
        return this.inputHistory.filter(input => 
            input.frame >= startFrame && input.frame <= endFrame
        );
    }

    /**
     * Disconnect a specific client
     */
    disconnectClient(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            client.isConnected = false;
            this.clients.delete(clientId);
            
            console.log('👋 Client disconnected:', client.playerName);
            
            // Notify other clients
            this.broadcastToClients('client_list_updated', {
                clients: Array.from(this.clients.values())
            });
        }
    }

    /**
     * Get host status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            roomId: this.roomId,
            port: this.port,
            currentFrame: this.currentFrame,
            clientCount: this.clients.size,
            maxClients: this.maxClients,
            frameRate: this.frameRate,
            hasPassword: !!this.password,
            isPublic: this.isPublic
        };
    }

    /**
     * Get client list
     */
    getClientList() {
        return Array.from(this.clients.values()).map(client => ({
            id: client.id,
            playerNumber: client.playerNumber,
            playerName: client.playerName,
            isConnected: client.isConnected,
            lastSyncTime: client.lastSyncTime
        }));
    }

    /**
     * Set socket reference
     */
    setSocket(socket) {
        this.socket = socket;
        this.setupSocketHandlers();
    }

    /**
     * Update host settings
     */
    updateSettings(settings) {
        if (settings.maxClients !== undefined) {
            this.maxClients = Math.max(1, Math.min(4, settings.maxClients));
        }
        
        if (settings.password !== undefined) {
            this.password = settings.password;
        }
        
        if (settings.isPublic !== undefined) {
            this.isPublic = settings.isPublic;
        }
        
        console.log('⚙️ Host settings updated:', {
            maxClients: this.maxClients,
            hasPassword: !!this.password,
            isPublic: this.isPublic
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetplayHost;
} else {
    window.NetplayHost = NetplayHost;
}
