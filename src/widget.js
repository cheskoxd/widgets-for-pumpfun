const params = new URLSearchParams(window.location.search);
let poolAddress = params.get('pool');
const initialSymbol = params.get('symbol');
const initialImage = params.get('image');
const initialMcap = parseFloat(params.get('mcap') || "0");
const mintAddress = params.get('mint');

const symbolEl = document.getElementById('symbol');
const logoEl = document.getElementById('logo');
const bgLogoEl = document.getElementById('bg-logo');
const mcapEl = document.getElementById('mcap');
const closeBtn = document.getElementById('close-widget');
const axiomLink = document.getElementById('axiom-link');
const container = document.querySelector('.widget-container');

let isMigrating = false;

if (initialSymbol) symbolEl.innerText = initialSymbol;
if (initialImage) {
  const decodedImg = decodeURIComponent(initialImage);
  logoEl.src = decodedImg;
  bgLogoEl.src = decodedImg;
}

closeBtn.onclick = async () => {
  if (window.__TAURI__) {
    const { getCurrentWebviewWindow } = window.__TAURI__.webviewWindow || window.__TAURI__.window;
    const current = getCurrentWebviewWindow();
    await current.close();
  }
};

axiomLink.onclick = () => {
  const terminal = localStorage.getItem('preferredTerminal') || 'axiom';
  let url;
  if (terminal === 'padre') {
    url = `https://trade.padre.gg/trade/solana/${poolAddress}`;
  } else if (terminal === 'gmgn') {
    url = `https://gmgn.ai/sol/token/${mintAddress}`;
  } else {
    url = `https://axiom.trade/meme/${poolAddress}?chain=sol`;
  }

  if (window.__TAURI__) {
    // Try both possible Tauri 2.0 shell locations
    const shell = window.__TAURI__.shell || window.__TAURI__.opener;
    if (shell && (shell.open || shell.openUrl)) {
      if (shell.open) shell.open(url);
      else shell.openUrl(url);
    } else {
      window.open(url, '_blank');
    }
  } else {
    window.open(url, '_blank');
  }
};

let currentPrice = initialMcap / 1000000000;
let targetMcap = initialMcap;
let displayMcap = initialMcap;
let ws = null;

// Show initial MCAP immediately
if (initialMcap > 0) {
  mcapEl.innerText = `$${Math.floor(initialMcap).toLocaleString()}`;
}

// Total supply for pump tokens is 1 Billion
const TOTAL_SUPPLY = 1_000_000_000;

function connect() {
  if (ws) {
    ws.close();
  }

  ws = new WebSocket('wss://ws.mevx.io/api/v1/ws');

  ws.onopen = () => {
    // Subscribe to pool updates
    ws.send(JSON.stringify({
      jsonrpc: "2.0",
      id: "subscribe-" + poolAddress,
      method: "subscribePool",
      params: { chain: "sol", poolAddress: poolAddress }
    }));

    // Subscribe to trades
    ws.send(JSON.stringify({
      jsonrpc: "2.0",
      id: "trades-" + poolAddress,
      method: "subscribeTradesBatch",
      params: { chain: "sol", poolAddress: poolAddress }
    }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === "subscribePool" && msg.params) {
      updateUI(msg.params);

      // Check for migration (curvePercent 100)
      if (msg.params.metadata && msg.params.metadata.curvePercent >= 100 && !isMigrating) {
        handleMigration();
      }
    } else if (msg.method === "subscribeTradesBatch" && msg.params) {
      handleTrades(msg.params);
    }
  };

  ws.onclose = () => {
    if (!isMigrating) {
      setTimeout(connect, 3000);
    }
  };
}

async function handleMigration() {
  if (!mintAddress) return;
  isMigrating = true;
  console.log("Token migrated! Re-fetching pool...");

  try {
    const { invoke } = window.__TAURI__.core;
    //wait for 5 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    // We use the same fetch_token_metadata which now uses the MEV-X search API
    const data = await invoke("fetch_token_metadata", { mint: mintAddress });

    if (data.poolAddress && data.poolAddress !== poolAddress) {
      console.log("Switching to new pool:", data.poolAddress);
      poolAddress = data.poolAddress;
      isMigrating = false;
      connect(); // Reconnect with new poolAddress
    } else {
      // If pool hasn't changed yet, retry in a few seconds
      setTimeout(handleMigration, 5000);
    }
  } catch (err) {
    console.error("Migration fetch failed:", err);
    setTimeout(handleMigration, 5000);
  }
}

// Animation Loop for Smooth Counter
function animate() {
  if (displayMcap !== targetMcap) {
    const diff = targetMcap - displayMcap;
    const step = diff * 0.1;
    if (Math.abs(diff) < 1) {
      displayMcap = targetMcap;
    } else {
      displayMcap += step;
    }
    mcapEl.innerText = `$${Math.floor(displayMcap).toLocaleString()}`;
  }
  requestAnimationFrame(animate);
}

animate();

function updateUI(data) {
  if (data.priceUsd) {
    const newPrice = parseFloat(data.priceUsd);
    if (newPrice > currentPrice) {
      mcapEl.style.color = '#4ade80';
      mcapEl.style.textShadow = '0 0 20px rgba(74, 222, 128, 0.4)';
    } else if (newPrice < currentPrice) {
      mcapEl.style.color = '#f87171';
      mcapEl.style.textShadow = '0 0 20px rgba(248, 113, 113, 0.4)';
    }
    currentPrice = newPrice;
    targetMcap = newPrice * TOTAL_SUPPLY;
  }
}

function handleTrades(trades) {
  if (!Array.isArray(trades)) return;

  trades.forEach(trade => {
    // MEV-X can use volumeUsd or usdAmount depending on the specific pool/stream
    const amount = parseFloat(trade.volumeUsd || trade.usdAmount || 0);
    const side = trade.side || trade.type; // Some streams use 'side', some use 'type'

    console.log("Trade detected:", side, amount);

    if (amount > 0.1) {
      showTradePopup(side === 'buy' || side === 'up' ? 'up' : 'down', amount);
    }

    // Use the trade price to update the MCAP immediately if available
    if (trade.priceUsd) {
      updateUI({ priceUsd: trade.priceUsd });
    }
  });
}

function showTradePopup(type, amount) {
  const popup = document.createElement('div');
  popup.className = `trade-popup ${type}`;
  popup.innerText = (type === 'up' ? '+' : '-') + '$' + (amount < 1 ? amount.toFixed(2) : Math.floor(amount).toLocaleString());

  // Random horizontal offset to prevent overlapping (converted to rem)
  const offsetRem = (Math.random() - 0.5) * 2.5;
  popup.style.right = (2.5 + offsetRem) + 'rem';
  //lets also rotate it a little
  popup.style.transform = `rotate(${(Math.random() - 0.5) * 30}deg)`;
  popup.style.zIndex = "9999";

  container.appendChild(popup);

  setTimeout(() => {
    if (popup.parentNode) popup.remove();
  }, 1500);
}

connect();
