# WidgetsForPumpfun 🚀

**Stay in the trade. No matter what you're doing.**

WidgetsForPumpfun is a high-performance, minimalist desktop application built for Solana trenchers. Track any coin's market cap in real-time and see live trades animated directly on your desktop, all without ever switching tabs or checking charts every 5 seconds.

https://raw.githubusercontent.com/cheskoxd/widgets-for-pumpfun/main/frontend/demo.mp4

## ✨ Features

- **⚡ Real-Time Tracking**: Ultra-fast market cap updates via MEV-X WebSockets.
- **📈 Live Trade Animations**: Visual "buy" and "sell" popups so you can *feel* the market momentum while gaming or working.
- **📏 Resizable & Fluid**: Windows scale perfectly. Make them tiny for a clean corner look or large to dominate your screen.
- **🔄 Auto-Migration**: Automatically detects when a token migrates from Pump.fun and switches to the new pool seamlessly.
- **🔘 Terminal Integration**: Quick-launch into Axiom or Padre with a single click.
- **🦀 Built with Tauri**: Lightweight, secure, and memory-efficient (Rust + Vanilla JS).

## 📥 Installation

1. Go to the [Latest Releases](https://github.com/cheskoxd/widgets-for-pumpfun/releases/latest).
2. Download the `WidgetsForPumpfun_x64_en-US.msi` installer.
3. Run the installer and launch the app!

## 🛠 Development

### Prerequisites
- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

### Setup
1. Clone the repo:
   ```bash
   git clone https://github.com/cheskoxd/widgets-for-pumpfun.git
   cd widgets-for-pumpfun
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development mode:
   ```bash
   npm run tauri dev
   ```

## 🏗 Technology Stack

- **Frontend**: Vanilla HTML5 / CSS3 / JavaScript (ES6+)
- **Backend**: Rust (Tauri 2.0)
- **Data Source**: MEV-X API & WebSockets
- **Styling**: Custom "Ultra-Tech" Grayscale Design System

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

Built with 🤍 for the Solana community by [Cheskodev](https://x.com/cheskodev).
