const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3004; // Mobile multiplayer standalone server

// Socket.IO setup with CORS for mobile devices
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Global storage for mobile rooms
global.mobileRooms = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple emulator route
app.get('/emulator', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'simple-emulator.html'));
});

// RetroArch emulator route
app.get('/retroarch', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'retroarch-emulator.html'));
});

// RetroArch simple route
app.get('/retroarch-simple', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'retroarch-simple.html'));
});

// Direct SNES emulator route
app.get('/direct-snes', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'direct-snes.html'));
});

// RetroArch full web player route
app.get('/retroarch-full', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'retroarch-full.html'));
});

// Working emulator route
app.get('/working-emulator', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'working-emulator.html'));
});
app.use('/roms', express.static(path.join(__dirname, 'roms')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/mobile', (req, res) => {
  console.log('📱 Serving standalone mobile multiplayer interface');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/game', (req, res) => {
  console.log('🎮 Serving mobile game interface');
  res.sendFile(path.join(__dirname, 'public', 'mobile-game.html'));
});

// Serve Player 2 interface
app.get('/player2', (req, res) => {
  console.log('👥 Serving Player 2 interface');
  res.sendFile(path.join(__dirname, 'public', 'mobile-player2.html'));
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    server: 'WeAD Mobile Multiplayer Standalone',
    timestamp: new Date().toISOString(),
    activeRooms: global.mobileRooms ? global.mobileRooms.size : 0
  });
});

// Serve ROM files
app.use('/roms', express.static(path.join(__dirname, 'roms')));

// Serve EmulatorJS files
app.use('/emulatorjs', express.static(path.join(__dirname, 'emulatorjs')));

app.get('/websocket-test', (req, res) => {
  console.log('🔌 Serving WebSocket test page');
  res.sendFile(path.join(__dirname, 'public', 'websocket-test.html'));
});

app.get('/test-flow', (req, res) => {
  console.log('🧪 Serving flow test page');
  res.sendFile(path.join(__dirname, 'test-flow.html'));
});

app.get('/test-emulator', (req, res) => {
  console.log('🎮 Serving EmulatorJS test page');
  res.sendFile(path.join(__dirname, 'test-emulator.html'));
});

app.get('/test-connection', (req, res) => {
  console.log('🔧 Serving connection test page');
  res.sendFile(path.join(__dirname, 'test-connection-flow.html'));
});


// Generate unique room code for mobile multiplayer
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 🔥 FIX: Enhanced user check for multiplayer (allows unregistered users)
// Based on the working desktop multiplayer authentication logic
function isUserAuthenticatedForMultiplayer(userId) {
  return new Promise((resolve) => {
    // For multiplayer, we allow any user with a valid userId
    // This enables guest users to play without registration
    if (!userId || userId.length < 3) {
      resolve(false);
      return;
    }

    // Basic validation - any userId that looks reasonable is allowed
    // We can add more sophisticated validation later if needed
    resolve(true);
  });
}

// Socket.IO handlers for mobile multiplayer
io.on('connection', (socket) => {
  console.log('📱 Mobile client connected:', socket.id);

  // Register mobile user
  socket.on('register_mobile_user', (userData) => {
    console.log('👤 Mobile user registered:', userData.username);
    // Use socket.id as the authoritative user ID
    const mobileUser = {
      ...userData,
      id: socket.id // Override client-generated ID with socket ID
    };
    socket.data.mobileUser = mobileUser;
    socket.emit('registered', { userId: socket.id, userData: mobileUser });
  });

  // Create room (follows desktop multiplayer pattern - no registration required)
  socket.on('create_room', (data) => {
    try {
      // Use host data from client request (like desktop multiplayer)
      const host = data.host || {
        id: socket.id,
        username: `Player${Math.floor(Math.random() * 1000)}`,
        isMobile: true,
        ready: false
      };

      // Store user data in socket for this session
      socket.data.mobileUser = host;

      const roomCode = generateRoomCode();
      const room = {
        id: roomCode,
        name: data.name || `Room ${roomCode}`,
        host: host,
        players: [host],
        maxPlayers: 2,
        game: data.game,
        created: new Date().toISOString(),
        status: 'waiting'
      };

      global.mobileRooms.set(roomCode, room);
      socket.join(roomCode);
      socket.data.currentRoom = roomCode;

      console.log('🏠 Mobile room created:', roomCode, 'by', host.username);

      socket.emit('room_created', { room: room });
      io.to(roomCode).emit('room_updated', { room: room });

    } catch (error) {
      console.error('❌ Error creating room:', error);
      socket.emit('error', { message: 'Failed to create room' });
    }
  });

  // Join room
  socket.on('join_room', (data) => {
    try {
      // Generate user data if not present (follows desktop pattern)
      if (!socket.data.mobileUser) {
        socket.data.mobileUser = {
          id: socket.id,
          username: `Player${Math.floor(Math.random() * 1000)}`,
          isMobile: true,
          ready: false
        };
      }

      const room = global.mobileRooms.get(data.roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (room.players.length >= room.maxPlayers) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }

      room.players.push(socket.data.mobileUser);
      socket.join(data.roomId);
      socket.data.currentRoom = data.roomId;

      console.log('👥 Mobile player joined:', socket.data.mobileUser.username, '->', data.roomId);

      socket.emit('room_joined', { room: room });
      io.to(data.roomId).emit('room_updated', { room: room });

    } catch (error) {
      console.error('❌ Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Player ready
  socket.on('player_ready', (data) => {
    try {
      const room = global.mobileRooms.get(data.roomId);
      if (!room) return;

      const player = room.players.find(p => p.id === socket.data.mobileUser.id);
      if (player) {
        player.ready = data.ready;
        console.log('✅ Mobile player ready:', socket.data.mobileUser.username, data.ready);

        io.to(data.roomId).emit('room_updated', room);
      }
    } catch (error) {
      console.error('❌ Error updating ready status:', error);
    }
  });

  // Start game
  socket.on('start_game', (data) => {
    try {
      const room = global.mobileRooms.get(data.roomId);
      if (!room) return;

      // Check if host and all players are ready
      const allReady = room.players.every(p => p.ready);
      const isHost = room.host.id === socket.data.mobileUser.id;

      if (isHost && allReady) {
        room.status = 'starting';
        console.log('🎮 Game started in room', data.roomId);

        io.to(data.roomId).emit('game_starting', room);

        // Start game after a short delay
        setTimeout(() => {
          room.status = 'playing';
          console.log('🎮 Emitting game_started to room:', data.roomId, 'with data:', room);
          io.to(data.roomId).emit('game_started', room);
          try {
            const size = io.sockets.adapter.rooms.get(data.roomId)?.size || 0;
            console.log(`Broadcasted to ${size} players in room ${data.roomId}`);
          } catch(_) {}
        }, 2000);
      }
    } catch (error) {
      console.error('❌ Error starting game:', error);
    }
  });

  // Leave room
  socket.on('leave_room', (data) => {
    try {
      const roomId = data.roomId || socket.data.currentRoom;
      if (!roomId) return;

      const room = global.mobileRooms.get(roomId);
      if (room) {
        // Remove player from room
        room.players = room.players.filter(p => p.id !== socket.data.mobileUser.id);

        // If room is empty or host left, delete room
        if (room.players.length === 0 || room.host.id === socket.data.mobileUser.id) {
          global.mobileRooms.delete(roomId);
          console.log('🗑️ Mobile room deleted:', roomId);
        } else {
          io.to(roomId).emit('room_updated', room);
        }

        socket.leave(roomId);
        socket.data.currentRoom = null;

        console.log('👋 Mobile player left:', socket.data.mobileUser.username, 'from', roomId);
        socket.emit('room_left');
      }
    } catch (error) {
      console.error('❌ Error leaving room:', error);
    }
  });

  // Get rooms list
  socket.on('get_rooms', () => {
    try {
      const rooms = Array.from(global.mobileRooms.values()).map(room => ({
        id: room.id,
        name: room.name,
        players: room.players.length,
        maxPlayers: room.maxPlayers,
        status: room.status,
        game: room.game
      }));

      socket.emit('rooms_list', { rooms: rooms });
    } catch (error) {
      console.error('❌ Error getting rooms list:', error);
    }
  });

  // Join game room (for actual gameplay)
  socket.on('join_game_room', (data) => {
    try {
      console.log('🎮 join_game_room request:', data);
      console.log('🎮 Available rooms:', Array.from(global.mobileRooms.keys()));
      
      const room = global.mobileRooms.get(data.roomId);
      if (!room) {
        console.log('❌ Room not found:', data.roomId);
        socket.emit('error', { message: 'Game room not found' });
        return;
      }
      
      console.log('✅ Room found:', room.id, 'status:', room.status);

      // Find the player in the room
      let player = room.players.find(p => p.id === data.playerId);
      const isHost = room.host.id === data.playerId;
      
      // Tolerant re-add logic during starting/playing for both roles
      if (!player && (room.status === 'starting' || room.status === 'playing')) {
        if (isHost) {
          console.log('🔄 Re-adding HOST to active room:', data.playerId);
          player = {
            id: data.playerId,
            username: room.host.username,
            isMobile: room.host.isMobile,
            platform: room.host.platform,
            ready: true
          };
          room.players.push(player);
        } else {
          // Attempt to re-add missing client using provided fallback data if any
          const username = (data.username || `Player2_${String(data.playerId).slice(-4)}`);
          console.log('🔄 Re-adding CLIENT to active room:', data.playerId, 'as', username);
          player = {
            id: data.playerId,
            username,
            isMobile: true,
            platform: 'mobile',
            ready: true
          };
          // Avoid duplicates
          if (!room.players.find(p => p.id === player.id)) {
            room.players.push(player);
          }
        }
      }

      if (!player) {
        socket.emit('error', { message: 'Player not found in room' });
        return;
      }

      // Join the room
      socket.join(data.roomId);
      socket.data.currentRoom = data.roomId;
      socket.data.playerId = data.playerId;
      socket.data.isHost = isHost;

      console.log('🎮 Player joined game room:', data.playerId, 'in', data.roomId, 'isHost:', isHost);

      // Notify the player
      socket.emit('game_room_joined', {
        room: room,
        isHost: isHost,
        player: player
      });

      // 🔥 FIX: If room is already playing, send game_started event to trigger emulator loading
      if (room.status === 'playing') {
        console.log('🎮 Room is already playing, sending game_started event to client');
        socket.emit('game_started', room);
        try {
          const size = io.sockets.adapter.rooms.get(data.roomId)?.size || 0;
          console.log(`Broadcasted to ${size} players in room ${data.roomId}`);
        } catch(_) {}
      }

    } catch (error) {
      console.error('❌ Error joining game room:', error);
      socket.emit('error', { message: 'Failed to join game room' });
    }
  });

  // WebRTC signaling for game streaming
  socket.on('webrtc_offer', (data) => {
    const roomId = data.roomCode || data.roomId;
    try {
      // Log the FULL SDP like desktop version (no truncation)
      console.log('📨 Main server received message: webrtc_offer from player:', data.fromUserId || socket.data.playerId, 'raw data:', JSON.stringify({ type:'webrtc_offer', roomCode: roomId, offer: data.offer }));
    } catch(_) {
      console.log('📨 WebRTC offer received for room:', roomId);
    }
    console.log('📡 WebRTC offer received for room:', roomId);
    socket.to(roomId).emit('webrtc_offer', data);
    console.log('✅ WebRTC offer forwarded to Player 2');
  });

  socket.on('webrtc_answer', (data) => {
    const roomId = data.roomCode || data.roomId;
    try {
      // Log the FULL SDP like desktop version (no truncation)
      console.log('📨 Main server received message: webrtc_answer from player:', data.fromUserId || socket.data.playerId, 'raw data:', JSON.stringify({ type:'webrtc_answer', roomCode: roomId, answer: data.answer, targetUserId: data.targetUserId }));
    } catch(_) {
      console.log('📨 WebRTC answer received for room:', roomId);
    }
    console.log('📡 WebRTC answer received for room:', roomId);
    socket.to(roomId).emit('webrtc_answer', data);
    console.log('✅ WebRTC answer forwarded to Host');
  });

  socket.on('webrtc_ice_candidate', (data) => {
    const roomId = data.roomCode || data.roomId;
    try {
      console.log('📨 Main server received message: webrtc_ice_candidate from player:', data.fromUserId || socket.data.playerId, 'raw data:', JSON.stringify({ type:'webrtc_ice_candidate', roomCode: roomId, candidate: data.candidate, isHost: data.isHost }));
      console.log('🧊 WebRTC ICE candidate received for room:', roomId, 'from:', (data.isHost ? 'Host' : 'Player 2'));
      console.log('✅ ICE candidate:', JSON.stringify({ candidate: data.candidate?.candidate, sdpMid: data.candidate?.sdpMid, sdpMLineIndex: data.candidate?.sdpMLineIndex }));
    } catch(_) {}
    socket.to(roomId).emit('webrtc_ice_candidate', data);
    console.log('✅ WebRTC ICE candidate forwarded');
  });

  // Player 2 can request the Host to re-send an offer
  socket.on('request_offer', (data) => {
    try {
      const roomId = data?.roomId || socket.data.currentRoom;
      if (!roomId) return;
      console.log('📨 Offer request received for room:', roomId);
      socket.to(roomId).emit('request_offer', { roomId });
      console.log('✅ Offer request forwarded to room:', roomId);
    } catch (_) {}
  });

  // Game control messages (from client to host)
  socket.on('game_control', (data) => {
    try {
      // Forward control messages to the host in the same room
      socket.to(data.roomId).emit('game_control', data);
      console.log('🎮 Game control forwarded to host:', data.control, data.pressed);
    } catch (error) {
      console.error('❌ Error forwarding game control:', error);
    }
  });

  // Orientation change messages (from Player 1 to Player 2)
  socket.on('orientation_change', (data) => {
    try {
      const roomId = data.roomCode || data.roomId;
      if (!roomId) return;
      
      console.log('📱 Orientation change received for room:', roomId, 'orientation:', data.orientation);
      
      // Forward orientation change to all other players in the room
      socket.to(roomId).emit('orientation_change', {
        orientation: data.orientation,
        fromUserId: data.fromUserId
      });
      
      console.log('📤 Orientation change forwarded to room:', roomId);
    } catch (error) {
      console.error('❌ Error handling orientation change:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log('🔌 Mobile client disconnected:', socket.id, 'reason:', reason);

    // Clean up if player was in a room
    if (socket.data.currentRoom) {
      const roomId = socket.data.currentRoom;
      const room = global.mobileRooms.get(roomId);
      if (room) {
        // Do NOT remove players during transition/active gameplay to avoid race conditions
        if (room.status === 'starting' || room.status === 'playing') {
          console.log('⏸️ Preserving players during', room.status, 'for room:', roomId);
          return;
        }

        // Safe to remove in non-playing states
        const userId = socket.data.mobileUser?.id || socket.id;
        room.players = room.players.filter(p => p.id !== userId);

        if (room.players.length === 0) {
          global.mobileRooms.delete(roomId);
          console.log('🗑️ Room deleted due to empty:', roomId);
        } else {
          io.to(roomId).emit('room_updated', room);
        }
      }
    }
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 WeAD Mobile Multiplayer Standalone Server');
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`📱 Mobile interface: http://localhost:${PORT}`);
  console.log(`🌐 Network access: http://localhost:${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down mobile multiplayer server...');
  
  // Close HTTP server
  server.close(() => {
    console.log('✅ HTTP Server closed');
  });
  
  // Close Socket.IO server
  if (io) {
    io.close(() => {
      console.log('✅ Socket.IO server closed');
    });
  }
  
  // Force exit after 5 seconds if graceful shutdown fails
  setTimeout(() => {
    console.log('⚠️ Force shutting down...');
    process.exit(1);
  }, 5000);
  
  console.log('✅ Server shut down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down...');
  process.exit(0);
});