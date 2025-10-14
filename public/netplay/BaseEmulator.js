/**
 * BaseEmulator - Foundation for deterministic emulation
 * Handles ROM loading, frame execution, and netplay synchronization
 */
class BaseEmulator {
    constructor() {
        this.libretroCore = new LibretroCore();
        this.frameBuffer = new Uint32Array(256 * 224); // SNES resolution
        this.audioBuffer = new Float32Array(4096);
        this.isRunning = false;
        this.frameCount = 0;
        this.romData = null;
        this.romChecksum = null;
        this.systemType = 'snes';
        
        // Netplay synchronization
        this.syncFrame = 0;
        this.lastSyncTime = 0;
        this.frameRate = 60;
        this.targetFrameTime = 1000 / this.frameRate;
        
        console.log('🎮 BaseEmulator initialized with LibretroCore');
    }

    /**
     * Load ROM with checksum calculation for netplay verification
     */
    async loadROM(romData) {
        try {
            console.log('📁 Loading ROM into libretro core...');
            
            // Store ROM data
            this.romData = romData;
            
            // Calculate checksum for netplay verification
            this.romChecksum = await this.calculateChecksum(romData);
            console.log('🔍 ROM checksum:', this.romChecksum);
            
            // Load libretro core
            await this.libretroCore.loadCore();
            
            // Set up video callback to receive frames from libretro core
            this.libretroCore.setVideoCallback((videoData) => {
                this.frameBuffer = videoData;
                console.log('📺 Received video frame from libretro core:', videoData ? videoData.length : 0, 'pixels');
            });
            
            // Load ROM into libretro core
            await this.libretroCore.loadROM(romData);
            
            // Reset emulator state
            this.reset();
            
            console.log('✅ ROM loaded successfully into libretro core');
            return true;
        } catch (error) {
            console.error('❌ Failed to load ROM:', error);
            throw error;
        }
    }

    /**
     * Calculate deterministic checksum for ROM verification
     */
    async calculateChecksum(data) {
        const buffer = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
        let crc = 0xFFFFFFFF;
        
        for (let i = 0; i < buffer.length; i++) {
            crc ^= buffer[i];
            for (let j = 0; j < 8; j++) {
                crc = (crc >>> 1) ^ (0xEDB88320 & (-(crc & 1)));
            }
        }
        
        return (~crc >>> 0).toString(16).toUpperCase();
    }

    /**
     * Reset emulator state
     */
    reset() {
        console.log('🔄 Resetting emulator...');
        
        this.frameCount = 0;
        this.syncFrame = 0;
        this.lastSyncTime = 0;
        
        // Clear frame buffer
        this.frameBuffer.fill(0);
        
        console.log('✅ Emulator reset complete');
    }

    /**
     * Run one frame of emulation (deterministic)
     */
    runFrame() {
        if (!this.isRunning) {
            // Return empty frame data instead of null
            return {
                video: new Uint32Array(256 * 224),
                audio: new Float32Array(0),
                frame: 0,
                checksum: 0
            };
        }
        
        // Use LibretroCore to run the actual emulation
        if (this.libretroCore && this.libretroCore.isRunning) {
            const result = this.libretroCore.runFrame();
            if (result) {
                this.frameCount = result.frame;
                // frameBuffer is updated via the video callback
                return {
                    video: this.frameBuffer.slice(),
                    audio: result.audio || new Float32Array(0),
                    frame: this.frameCount,
                    checksum: this.calculateFrameChecksum()
                };
            }
        }
        
        // Fallback to mock rendering if libretro core isn't ready
        this.renderSNESFrame();
        this.frameCount++;
        
        return {
            video: this.frameBuffer.slice(),
            audio: this.audioBuffer.slice(),
            frame: this.frameCount,
            checksum: this.calculateFrameChecksum()
        };
    }

    /**
     * Calculate frame checksum for netplay synchronization
     */
    calculateFrameChecksum() {
        if (!this.frameBuffer || this.frameBuffer.length === 0) {
            return 0;
        }
        
        let checksum = 0;
        for (let i = 0; i < this.frameBuffer.length; i++) {
            const pixel = this.frameBuffer[i];
            if (pixel !== undefined && pixel !== null) {
                checksum ^= pixel;
            }
        }
        
        return checksum;
    }

    /**
     * Render SNES frame (fallback)
     */
    renderSNESFrame() {
        // Simple fallback rendering
        const time = Date.now() * 0.001;
        for (let y = 0; y < 224; y++) {
            for (let x = 0; x < 256; x++) {
                const index = y * 256 + x;
                const r = Math.sin(x * 0.02 + time) * 127 + 128;
                const g = Math.sin(y * 0.02 + time * 1.1) * 127 + 128;
                const b = Math.sin((x + y) * 0.01 + time * 0.8) * 127 + 128;
                
                this.frameBuffer[index] = (255 << 24) | (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
            }
        }
    }

    /**
     * Start emulation
     */
    start() {
        this.isRunning = true;
        console.log('▶️ Emulator started');
    }

    /**
     * Stop emulation
     */
    stop() {
        this.isRunning = false;
        console.log('⏹️ Emulator stopped');
    }

    /**
     * Get current frame count
     */
    getFrameCount() {
        return this.frameCount;
    }

    /**
     * Get ROM checksum
     */
    getROMChecksum() {
        return this.romChecksum;
    }
}