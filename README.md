# WeAD Web3 Retro Games

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.7-black.svg)](https://socket.io/)

## 🎮 Overview

**WeAD Web3 Retro Games** is a multiplayer retro gaming platform featuring WebRTC-based multiplayer functionality, allowing players to enjoy classic games together in real-time.

### Key Features

- 🕹️ **Retro Game Emulation** - Classic gaming experience
- 👥 **Mobile Multiplayer** - Play with friends on any device
- ⚡ **WebRTC Technology** - Low-latency peer-to-peer connections
- 🌐 **Cross-Platform** - Works on desktop and mobile
- 🔒 **Secure Connections** - Encrypted WebSocket communication
- 📱 **Mobile-Optimized** - Touch controls and responsive design
- 🎯 **Real-Time Sync** - Synchronized gameplay across devices

## 🏗️ Architecture

### Backend (Node.js + Express)
- **Framework**: Express.js 4.18
- **Real-Time**: Socket.io 4.7
- **WebRTC**: Peer-to-peer connections
- **CORS**: Cross-origin support

### Frontend
- **Emulator**: RetroArch WebAssembly
- **Controls**: Touch-optimized for mobile
- **UI**: Responsive HTML5/CSS3/JavaScript

## 📦 Installation

### Prerequisites

```bash
# System requirements
- Node.js 16+
- npm
```

### Clone Repository

```bash
git clone https://github.com/Kennethlee83/Web3RetroGames.git
cd Web3RetroGames
```

### Setup

```bash
# Install dependencies
npm install

# Run server
npm start
```

## 🎮 Usage

### For Players

1. **Join Game**
   - Navigate to the platform
   - Select a retro game
   - Create or join a room

2. **Multiplayer**
   - Share room code with friend
   - Connect via WebRTC
   - Enjoy synchronized gameplay

3. **Mobile Controls**
   - Touch-optimized button layout
   - Responsive controls
   - Full-screen support

## 🔧 Configuration

```javascript
// Server configuration
const PORT = process.env.PORT || 3004;

// Socket.IO with CORS
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
```

## 🗺️ Roadmap

### Q4 2025
- [x] Mobile multiplayer implementation
- [x] WebRTC integration
- [x] Touch controls
- [ ] Token-based matchmaking

### Q1 2026
- [ ] Blockchain integration
- [ ] NFT achievement system
- [ ] WeAD Token rewards
- [ ] Tournament system

### Q2 2026
- [ ] Cross-chain gaming
- [ ] DAO governance
- [ ] Community features
- [ ] Streaming integration

## 🧪 Testing

```bash
# Start development server
npm run dev

# Test WebRTC connection
node test-webrtc-manager.cjs

# Test multiplayer flow
# Open test-page.html in browser
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md).

## 📄 License

This project is **proprietary and confidential**. 

**All Rights Reserved** - Unauthorized use, copying, modification, or distribution is strictly prohibited.

For commercial licensing inquiries: licensing@ www.wead.info

## 📞 Contact

- **Website**: [weadretrogameplatform.com](https://weadretrogameplatform.com)
- **Email**: info@wead.io

---

**Built with ❤️ by the WeAD Team**

*Bringing retro gaming to Web3*

