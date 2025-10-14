/**
 * RollbackNetcode - RetroArch-style rollback netcode implementation
 * Provides lag compensation and input prediction for smooth multiplayer
 */

class RollbackNetcode {
    constructor(emulator) {
        this.emulator = emulator;
        this.stateHistory = [];
        this.inputHistory = [];
        this.maxHistoryFrames = 60; // 1 second at 60fps
        this.rollbackFrames = 0;
        this.maxRollbackFrames = 8; // Maximum frames to rollback
        
        // Input prediction
        this.inputPrediction = true;
        this.predictionFrames = 3;
        
        // Synchronization
        this.syncThreshold = 2; // Frames
        this.lastSyncFrame = 0;
        this.desyncCount = 0;
        this.maxDesyncs = 5;
        
        // Performance monitoring
        this.rollbackCount = 0;
        this.predictionCount = 0;
        this.syncCount = 0;
        
        console.log('🔄 RollbackNetcode initialized');
    }

    /**
     * Save emulator state for rollback
     */
    saveState(frame) {
        const state = {
            frame,
            emulatorState: this.emulator.getState(),
            timestamp: Date.now()
        };

        this.stateHistory.push(state);
        
        // Limit history size
        if (this.stateHistory.length > this.maxHistoryFrames) {
            this.stateHistory.shift();
        }
        
        console.log('💾 State saved for frame', frame);
    }

    /**
     * Rollback to a specific frame
     */
    rollbackToFrame(targetFrame) {
        console.log('🔄 Rolling back to frame', targetFrame);
        
        // Find the closest saved state before target frame
        let rollbackState = null;
        for (let i = this.stateHistory.length - 1; i >= 0; i--) {
            if (this.stateHistory[i].frame <= targetFrame) {
                rollbackState = this.stateHistory[i];
                break;
            }
        }

        if (!rollbackState) {
            console.error('❌ No rollback state found for frame', targetFrame);
            return false;
        }

        // Restore emulator state
        this.emulator.setState(rollbackState.emulatorState);
        
        // Re-simulate frames with corrected inputs
        const currentFrame = this.emulator.frameCount;
        for (let frame = rollbackState.frame + 1; frame <= targetFrame; frame++) {
            const inputs = this.getInputsForFrame(frame);
            this.applyInputsToEmulator(inputs);
            this.emulator.runFrame();
        }

        this.rollbackFrames = currentFrame - targetFrame;
        this.rollbackCount++;
        
        console.log('✅ Rollback completed, re-simulated', this.rollbackFrames, 'frames');
        return true;
    }

    /**
     * Handle input correction from network
     */
    handleInputCorrection(frame, correctedInputs) {
        console.log('🔧 Input correction received for frame', frame);
        
        // Update input history with corrected data
        const inputIndex = this.inputHistory.findIndex(i => i.frame === frame);
        if (inputIndex !== -1) {
            this.inputHistory[inputIndex] = {
                frame,
                inputs: correctedInputs,
                timestamp: Date.now(),
                corrected: true
            };

            // Rollback and re-simulate if necessary
            if (frame < this.emulator.frameCount) {
                this.rollbackToFrame(frame);
            }
        }
    }

    /**
     * Get inputs for a specific frame
     */
    getInputsForFrame(frame) {
        const inputData = this.inputHistory.find(i => i.frame === frame);
        return inputData ? inputData.inputs : { p1: 0x00, p2: 0x00 };
    }

    /**
     * Apply inputs to emulator
     */
    applyInputsToEmulator(inputs) {
        // Apply player 1 inputs
        this.applyPlayerInputs(1, inputs.p1);
        
        // Apply player 2 inputs
        this.applyPlayerInputs(2, inputs.p2);
    }

    /**
     * Apply inputs for a specific player
     */
    applyPlayerInputs(player, inputByte) {
        const buttonMap = {
            0x01: 'A',
            0x02: 'B',
            0x04: 'SELECT',
            0x08: 'START',
            0x10: 'UP',
            0x20: 'DOWN',
            0x40: 'LEFT',
            0x80: 'RIGHT'
        };

        for (const [mask, button] of Object.entries(buttonMap)) {
            const pressed = (inputByte & parseInt(mask)) !== 0;
            this.emulator.setInput(player, button, pressed);
        }
    }

    /**
     * Predict inputs for future frames
     */
    predictInputs(currentFrame, predictionFrames) {
        if (!this.inputPrediction) return;
        
        const predictions = [];
        
        for (let i = 1; i <= predictionFrames; i++) {
            const targetFrame = currentFrame + i;
            const predictedInputs = this.getPredictedInputs(targetFrame);
            predictions.push({
                frame: targetFrame,
                inputs: predictedInputs
            });
        }
        
        this.predictionCount += predictions.length;
        return predictions;
    }

    /**
     * Get predicted inputs for a frame
     */
    getPredictedInputs(frame) {
        // Simple prediction: use the most recent input
        const recentInputs = this.inputHistory.slice(-5);
        if (recentInputs.length === 0) {
            return { p1: 0x00, p2: 0x00 };
        }
        
        // Use the most recent input as prediction
        const lastInput = recentInputs[recentInputs.length - 1];
        return lastInput.inputs;
    }

    /**
     * Check for desynchronization
     */
    checkDesync(localChecksum, remoteChecksum, frame) {
        if (localChecksum !== remoteChecksum) {
            console.warn('⚠️ Desync detected at frame', frame);
            this.desyncCount++;
            
            if (this.desyncCount > this.maxDesyncs) {
                console.error('❌ Too many desyncs, requesting full resync');
                this.requestFullResync();
                return true;
            }
            
            return true;
        }
        
        // Reset desync count on successful sync
        this.desyncCount = 0;
        return false;
    }

    /**
     * Request full resynchronization
     */
    requestFullResync() {
        console.log('🔄 Requesting full resynchronization');
        
        // Clear state history
        this.stateHistory = [];
        this.inputHistory = [];
        
        // Reset counters
        this.desyncCount = 0;
        this.rollbackCount = 0;
        this.predictionCount = 0;
        
        // Emit resync request event
        if (window.netplayClient) {
            window.netplayClient.requestResync();
        }
    }

    /**
     * Handle network latency compensation
     */
    compensateLatency(latency) {
        // Adjust input delay based on latency
        const baseDelay = 2; // frames
        const latencyFrames = Math.ceil(latency / 16.67); // Convert ms to frames
        const totalDelay = baseDelay + latencyFrames;
        
        console.log('⏱️ Latency compensation:', {
            latency: latency + 'ms',
            latencyFrames: latencyFrames,
            totalDelay: totalDelay + ' frames'
        });
        
        return totalDelay;
    }

    /**
     * Optimize rollback performance
     */
    optimizeRollback() {
        // Reduce history size if memory usage is high
        if (this.stateHistory.length > this.maxHistoryFrames * 0.8) {
            const reduceBy = Math.floor(this.maxHistoryFrames * 0.2);
            this.stateHistory = this.stateHistory.slice(reduceBy);
            console.log('🧹 Reduced state history by', reduceBy, 'frames');
        }
        
        // Clean up old input history
        if (this.inputHistory.length > this.maxHistoryFrames * 2) {
            const reduceBy = Math.floor(this.maxHistoryFrames * 0.5);
            this.inputHistory = this.inputHistory.slice(reduceBy);
            console.log('🧹 Reduced input history by', reduceBy, 'entries');
        }
    }

    /**
     * Get rollback statistics
     */
    getStats() {
        return {
            rollbackCount: this.rollbackCount,
            predictionCount: this.predictionCount,
            syncCount: this.syncCount,
            desyncCount: this.desyncCount,
            stateHistorySize: this.stateHistory.length,
            inputHistorySize: this.inputHistory.length,
            maxRollbackFrames: this.maxRollbackFrames,
            inputPrediction: this.inputPrediction
        };
    }

    /**
     * Update rollback settings
     */
    updateSettings(settings) {
        if (settings.maxHistoryFrames !== undefined) {
            this.maxHistoryFrames = Math.max(30, Math.min(120, settings.maxHistoryFrames));
        }
        
        if (settings.maxRollbackFrames !== undefined) {
            this.maxRollbackFrames = Math.max(1, Math.min(16, settings.maxRollbackFrames));
        }
        
        if (settings.inputPrediction !== undefined) {
            this.inputPrediction = settings.inputPrediction;
        }
        
        if (settings.predictionFrames !== undefined) {
            this.predictionFrames = Math.max(0, Math.min(8, settings.predictionFrames));
        }
        
        console.log('⚙️ Rollback settings updated:', {
            maxHistoryFrames: this.maxHistoryFrames,
            maxRollbackFrames: this.maxRollbackFrames,
            inputPrediction: this.inputPrediction,
            predictionFrames: this.predictionFrames
        });
    }

    /**
     * Reset rollback system
     */
    reset() {
        console.log('🔄 Resetting rollback system');
        
        this.stateHistory = [];
        this.inputHistory = [];
        this.rollbackFrames = 0;
        this.desyncCount = 0;
        this.rollbackCount = 0;
        this.predictionCount = 0;
        this.syncCount = 0;
        this.lastSyncFrame = 0;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        console.log('🧹 Cleaning up rollback system');
        
        this.stateHistory = [];
        this.inputHistory = [];
        
        // Clear any pending operations
        if (this.optimizationInterval) {
            clearInterval(this.optimizationInterval);
            this.optimizationInterval = null;
        }
    }
}

/**
 * InputPredictor - Advanced input prediction for rollback netcode
 */
class InputPredictor {
    constructor() {
        this.predictionModels = new Map();
        this.inputPatterns = new Map();
        this.predictionAccuracy = 0.8; // 80% accuracy threshold
    }

    /**
     * Train prediction model for a player
     */
    trainModel(playerId, inputHistory) {
        if (inputHistory.length < 10) return;
        
        const patterns = this.extractPatterns(inputHistory);
        this.inputPatterns.set(playerId, patterns);
        
        console.log('🧠 Trained prediction model for player', playerId);
    }

    /**
     * Extract input patterns from history
     */
    extractPatterns(inputHistory) {
        const patterns = [];
        
        for (let i = 2; i < inputHistory.length; i++) {
            const pattern = {
                previous: inputHistory[i - 2],
                current: inputHistory[i - 1],
                next: inputHistory[i]
            };
            patterns.push(pattern);
        }
        
        return patterns;
    }

    /**
     * Predict next input for a player
     */
    predictNextInput(playerId, currentInput, previousInput) {
        const patterns = this.inputPatterns.get(playerId);
        if (!patterns || patterns.length === 0) {
            return currentInput; // No prediction available
        }
        
        // Find matching pattern
        const matchingPattern = patterns.find(pattern => 
            pattern.previous === previousInput && pattern.current === currentInput
        );
        
        if (matchingPattern) {
            return matchingPattern.next;
        }
        
        // Fallback to current input
        return currentInput;
    }

    /**
     * Update prediction accuracy
     */
    updateAccuracy(playerId, predicted, actual) {
        const isCorrect = predicted === actual;
        const currentAccuracy = this.predictionAccuracy;
        
        // Simple moving average
        this.predictionAccuracy = (currentAccuracy * 0.9) + (isCorrect ? 0.1 : 0);
        
        if (this.predictionAccuracy < 0.5) {
            console.warn('⚠️ Low prediction accuracy for player', playerId);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RollbackNetcode, InputPredictor };
} else {
    window.RollbackNetcode = RollbackNetcode;
    window.InputPredictor = InputPredictor;
}

