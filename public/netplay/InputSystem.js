/**
 * InputSystem - RetroArch-style input mapping and synchronization
 * Handles input collection, mapping, and network synchronization
 */

class InputSystem {
    constructor() {
        this.inputMappings = new Map();
        this.inputState = new Map();
        this.inputHistory = [];
        this.maxHistoryFrames = 120; // 2 seconds at 60fps
        
        // Input validation
        this.inputValidator = new InputValidator();
        
        // Performance monitoring
        this.inputRate = 0;
        this.lastInputTime = 0;
        this.inputCount = 0;
        
        // Initialize default mappings
        this.initializeDefaultMappings();
        
        console.log('🎮 InputSystem initialized');
    }

    /**
     * Initialize default input mappings for different systems
     */
    initializeDefaultMappings() {
        // NES mapping
        this.inputMappings.set('nes', {
            'A': { code: 'KeyA', value: 0x01 },
            'B': { code: 'KeyS', value: 0x02 },
            'SELECT': { code: 'KeyQ', value: 0x04 },
            'START': { code: 'KeyW', value: 0x08 },
            'UP': { code: 'ArrowUp', value: 0x10 },
            'DOWN': { code: 'ArrowDown', value: 0x20 },
            'LEFT': { code: 'ArrowLeft', value: 0x40 },
            'RIGHT': { code: 'ArrowRight', value: 0x80 }
        });

        // SNES mapping
        this.inputMappings.set('snes', {
            'A': { code: 'KeyA', value: 0x01 },
            'B': { code: 'KeyS', value: 0x02 },
            'X': { code: 'KeyD', value: 0x04 },
            'Y': { code: 'KeyF', value: 0x08 },
            'L': { code: 'KeyQ', value: 0x10 },
            'R': { code: 'KeyE', value: 0x20 },
            'SELECT': { code: 'KeyZ', value: 0x40 },
            'START': { code: 'KeyX', value: 0x80 },
            'UP': { code: 'ArrowUp', value: 0x100 },
            'DOWN': { code: 'ArrowDown', value: 0x200 },
            'LEFT': { code: 'ArrowLeft', value: 0x400 },
            'RIGHT': { code: 'ArrowRight', value: 0x800 }
        });

        // Game Boy mapping
        this.inputMappings.set('gameboy', {
            'A': { code: 'KeyA', value: 0x01 },
            'B': { code: 'KeyS', value: 0x02 },
            'SELECT': { code: 'KeyQ', value: 0x04 },
            'START': { code: 'KeyW', value: 0x08 },
            'UP': { code: 'ArrowUp', value: 0x10 },
            'DOWN': { code: 'ArrowDown', value: 0x20 },
            'LEFT': { code: 'ArrowLeft', value: 0x40 },
            'RIGHT': { code: 'ArrowRight', value: 0x80 }
        });

        console.log('✅ Default input mappings initialized');
    }

    /**
     * Set input mapping for a specific system
     */
    setInputMapping(system, mapping) {
        this.inputMappings.set(system, mapping);
        console.log('🎮 Input mapping set for', system);
    }

    /**
     * Get input mapping for a specific system
     */
    getInputMapping(system) {
        return this.inputMappings.get(system) || this.inputMappings.get('nes');
    }

    /**
     * Handle keyboard input
     */
    handleKeyboardInput(event) {
        const { type, code, key } = event;
        const pressed = type === 'keydown';
        
        // Find which button this key maps to
        const button = this.getButtonFromKey(code);
        if (!button) return;
        
        // Validate input
        if (!this.inputValidator.validateInput(button, pressed, Date.now())) {
            return;
        }
        
        // Update input state
        this.updateInputState(button, pressed);
        
        // Store in history
        this.storeInputHistory(button, pressed);
        
        // Emit input event
        this.emitInputEvent(button, pressed);
        
        console.log('⌨️ Keyboard input:', button, pressed ? 'PRESSED' : 'RELEASED');
    }

    /**
     * Handle touch input for mobile
     */
    handleTouchInput(event) {
        const { type, target } = event;
        const pressed = type === 'touchstart' || type === 'mousedown';
        
        // Get button from target
        const button = target.getAttribute('data-button');
        if (!button) return;
        
        // Validate input
        if (!this.inputValidator.validateInput(button, pressed, Date.now())) {
            return;
        }
        
        // Update input state
        this.updateInputState(button, pressed);
        
        // Store in history
        this.storeInputHistory(button, pressed);
        
        // Emit input event
        this.emitInputEvent(button, pressed);
        
        console.log('👆 Touch input:', button, pressed ? 'PRESSED' : 'RELEASED');
    }

    /**
     * Handle gamepad input
     */
    handleGamepadInput(gamepadIndex, buttonIndex, pressed) {
        // Map gamepad button to system button
        const button = this.getButtonFromGamepad(gamepadIndex, buttonIndex);
        if (!button) return;
        
        // Validate input
        if (!this.inputValidator.validateInput(button, pressed, Date.now())) {
            return;
        }
        
        // Update input state
        this.updateInputState(button, pressed);
        
        // Store in history
        this.storeInputHistory(button, pressed);
        
        // Emit input event
        this.emitInputEvent(button, pressed);
        
        console.log('🎮 Gamepad input:', button, pressed ? 'PRESSED' : 'RELEASED');
    }

    /**
     * Get button name from keyboard key code
     */
    getButtonFromKey(keyCode) {
        for (const [system, mapping] of this.inputMappings) {
            for (const [button, config] of Object.entries(mapping)) {
                if (config.code === keyCode) {
                    return button;
                }
            }
        }
        return null;
    }

    /**
     * Get button name from gamepad input
     */
    getButtonFromGamepad(gamepadIndex, buttonIndex) {
        // Standard gamepad mapping
        const gamepadMapping = {
            0: 'A',
            1: 'B',
            2: 'X',
            3: 'Y',
            4: 'L',
            5: 'R',
            6: 'SELECT',
            7: 'START',
            12: 'UP',
            13: 'DOWN',
            14: 'LEFT',
            15: 'RIGHT'
        };
        
        return gamepadMapping[buttonIndex] || null;
    }

    /**
     * Update input state
     */
    updateInputState(button, pressed) {
        const currentState = this.inputState.get(button) || false;
        
        if (currentState !== pressed) {
            this.inputState.set(button, pressed);
            this.inputCount++;
            this.lastInputTime = Date.now();
        }
    }

    /**
     * Store input in history
     */
    storeInputHistory(button, pressed) {
        const input = {
            button,
            pressed,
            timestamp: Date.now(),
            frame: this.getCurrentFrame()
        };
        
        this.inputHistory.push(input);
        
        // Limit history size
        if (this.inputHistory.length > this.maxHistoryFrames) {
            this.inputHistory.shift();
        }
    }

    /**
     * Emit input event for network synchronization
     */
    emitInputEvent(button, pressed) {
        // Emit custom event for netplay system
        const event = new CustomEvent('inputEvent', {
            detail: {
                button,
                pressed,
                timestamp: Date.now(),
                frame: this.getCurrentFrame()
            }
        });
        
        window.dispatchEvent(event);
    }

    /**
     * Get current frame number
     */
    getCurrentFrame() {
        return window.currentEmulator ? window.currentEmulator.frameCount : 0;
    }

    /**
     * Get current input state
     */
    getCurrentInputState() {
        const state = {};
        for (const [button, pressed] of this.inputState) {
            state[button] = pressed;
        }
        return state;
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
     * Get input rate (inputs per second)
     */
    getInputRate() {
        const now = Date.now();
        const timeDiff = now - this.lastInputTime;
        
        if (timeDiff > 1000) {
            this.inputRate = 0;
        } else {
            this.inputRate = this.inputCount / (timeDiff / 1000);
        }
        
        return this.inputRate;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyboardInput(e));
        document.addEventListener('keyup', (e) => this.handleKeyboardInput(e));
        
        // Touch events
        document.addEventListener('touchstart', (e) => this.handleTouchInput(e));
        document.addEventListener('touchend', (e) => this.handleTouchInput(e));
        document.addEventListener('mousedown', (e) => this.handleTouchInput(e));
        document.addEventListener('mouseup', (e) => this.handleTouchInput(e));
        
        // Gamepad events
        window.addEventListener('gamepadconnected', (e) => {
            console.log('🎮 Gamepad connected:', e.gamepad.id);
        });
        
        window.addEventListener('gamepaddisconnected', (e) => {
            console.log('🎮 Gamepad disconnected:', e.gamepad.id);
        });
        
        console.log('✅ Input event listeners setup complete');
    }

    /**
     * Poll gamepad inputs
     */
    pollGamepads() {
        const gamepads = navigator.getGamepads();
        
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (!gamepad) continue;
            
            // Poll buttons
            for (let j = 0; j < gamepad.buttons.length; j++) {
                const button = gamepad.buttons[j];
                const pressed = button.pressed;
                
                // Check if button state changed
                const buttonKey = `gamepad_${i}_button_${j}`;
                const lastState = this.inputState.get(buttonKey);
                
                if (lastState !== pressed) {
                    this.handleGamepadInput(i, j, pressed);
                }
            }
            
            // Poll axes (for D-pad simulation)
            const axes = gamepad.axes;
            if (axes.length >= 2) {
                const leftStickX = axes[0];
                const leftStickY = axes[1];
                
                // Convert analog stick to digital input
                const threshold = 0.5;
                
                // Left/Right
                if (leftStickX < -threshold) {
                    this.handleGamepadInput(i, 14, true); // LEFT
                } else if (leftStickX > threshold) {
                    this.handleGamepadInput(i, 15, true); // RIGHT
                }
                
                // Up/Down
                if (leftStickY < -threshold) {
                    this.handleGamepadInput(i, 12, true); // UP
                } else if (leftStickY > threshold) {
                    this.handleGamepadInput(i, 13, true); // DOWN
                }
            }
        }
    }

    /**
     * Start input polling
     */
    startPolling() {
        console.log('🎮 Starting input polling...');
        
        this.pollingInterval = setInterval(() => {
            this.pollGamepads();
        }, 16); // ~60 FPS
        
        console.log('✅ Input polling started');
    }

    /**
     * Stop input polling
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            console.log('⏹️ Input polling stopped');
        }
    }

    /**
     * Get input statistics
     */
    getStats() {
        return {
            inputRate: this.getInputRate(),
            inputCount: this.inputCount,
            historySize: this.inputHistory.length,
            stateSize: this.inputState.size,
            lastInputTime: this.lastInputTime
        };
    }

    /**
     * Reset input system
     */
    reset() {
        this.inputState.clear();
        this.inputHistory = [];
        this.inputCount = 0;
        this.lastInputTime = 0;
        this.inputRate = 0;
        
        console.log('🔄 Input system reset');
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stopPolling();
        this.reset();
        
        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeyboardInput);
        document.removeEventListener('keyup', this.handleKeyboardInput);
        document.removeEventListener('touchstart', this.handleTouchInput);
        document.removeEventListener('touchend', this.handleTouchInput);
        document.removeEventListener('mousedown', this.handleTouchInput);
        document.removeEventListener('mouseup', this.handleTouchInput);
        
        console.log('🧹 Input system cleaned up');
    }
}

/**
 * InputValidator - Validates input for anti-cheat and performance
 */
class InputValidator {
    constructor() {
        this.maxInputsPerSecond = 30; // Reasonable human limit
        this.inputHistory = [];
        this.suspiciousPatterns = [];
        this.blockedInputs = new Set();
    }

    /**
     * Validate input
     */
    validateInput(button, pressed, timestamp) {
        // Check input rate limiting
        if (!this.checkInputRate(timestamp)) {
            console.warn('⚠️ Input rate exceeded');
            return false;
        }

        // Check for impossible input combinations
        if (!this.checkInputCombinations(button, pressed)) {
            console.warn('⚠️ Invalid input combination');
            return false;
        }

        // Check for inhuman timing patterns
        if (!this.checkTimingPatterns(button, pressed, timestamp)) {
            console.warn('⚠️ Suspicious timing pattern');
            return false;
        }

        // Log valid input
        this.logInput(button, pressed, timestamp);
        
        return true;
    }

    /**
     * Check input rate
     */
    checkInputRate(timestamp) {
        const recentInputs = this.inputHistory.filter(
            input => timestamp - input.timestamp < 1000
        );

        return recentInputs.length < this.maxInputsPerSecond;
    }

    /**
     * Check input combinations
     */
    checkInputCombinations(button, pressed) {
        // Check for impossible D-pad combinations
        if (button === 'UP' && pressed) {
            return !this.inputHistory.some(i => i.button === 'DOWN' && i.pressed);
        }
        if (button === 'DOWN' && pressed) {
            return !this.inputHistory.some(i => i.button === 'UP' && i.pressed);
        }
        if (button === 'LEFT' && pressed) {
            return !this.inputHistory.some(i => i.button === 'RIGHT' && i.pressed);
        }
        if (button === 'RIGHT' && pressed) {
            return !this.inputHistory.some(i => i.button === 'LEFT' && i.pressed);
        }

        return true;
    }

    /**
     * Check timing patterns
     */
    checkTimingPatterns(button, pressed, timestamp) {
        const recentInputs = this.inputHistory.filter(
            i => timestamp - i.timestamp < 1000
        );

        if (recentInputs.length < 3) return true;

        // Check for perfectly regular timing (bot-like)
        const intervals = [];
        for (let i = 1; i < recentInputs.length; i++) {
            intervals.push(recentInputs[i].timestamp - recentInputs[i-1].timestamp);
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, interval) => {
            return sum + Math.pow(interval - avgInterval, 2);
        }, 0) / intervals.length;

        // If variance is too low, timing is suspiciously regular
        return variance > 100; // Milliseconds squared
    }

    /**
     * Log input
     */
    logInput(button, pressed, timestamp) {
        this.inputHistory.push({ button, pressed, timestamp });
        
        // Keep history manageable
        if (this.inputHistory.length > 1000) {
            this.inputHistory = this.inputHistory.slice(-500);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { InputSystem, InputValidator };
} else {
    window.InputSystem = InputSystem;
    window.InputValidator = InputValidator;
}

