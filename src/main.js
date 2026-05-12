const { WebviewWindow, getAllWebviewWindows } = window.__TAURI__.webviewWindow || window.__TAURI__.window;
const { invoke } = window.__TAURI__.core;

const poolInput = document.getElementById("pool-address");
const addButton = document.getElementById("add-widget");
const walletInput = document.getElementById("wallet-address");
const pullButton = document.getElementById("pull-wallet");
const widgetList = document.getElementById("widget-list");

// Track widgets with metadata
let activeWidgets = JSON.parse(localStorage.getItem("activeWidgetsMetadata") || "[]");

// Track windows that are currently in the process of spawning to prevent duplicates
const spawningLabels = new Set();

async function spawnWidget(widgetData) {
  const { poolAddress, symbol, image, mcap, mint } = widgetData;
  if (!poolAddress) return;
  const label = `widget_${poolAddress.replace(/[^a-zA-Z0-9]/g, '')}`;

  if (spawningLabels.has(label)) return;

  try {
    // Check if window already exists in the system
    const windows = await getAllWebviewWindows();
    if (windows.some(w => w.label === label)) {
      console.log("Window already exists for", symbol);
      return;
    }

    spawningLabels.add(label);

    const webview = new WebviewWindow(label, {
      url: `widget.html?pool=${poolAddress}&symbol=${symbol}&image=${encodeURIComponent(image)}&mcap=${mcap || 0}&mint=${mint}`,
      title: `Price: ${symbol}`,
      width: 300,
      height: 120,
      minWidth: 150,
      minHeight: 60,
      resizable: true,
      decorations: false,
      transparent: true,
      alwaysOnTop: true,
      visible: true
    });

    webview.once('tauri://created', () => {
      console.log("SUCCESS: Window created for", symbol);
      spawningLabels.delete(label);
    });

    webview.once('tauri://error', (e) => {
      console.error("Window error for", symbol, e);
      spawningLabels.delete(label);
    });
  } catch (err) {
    console.error("Window creation error:", err);
    spawningLabels.delete(label);
  }
}

async function addWidgetByMint(mint, silent = false) {
  if (!mint) return;

  try {
    const data = await invoke("fetch_token_metadata", { mint });
    const widgetData = {
      mint: data.baseToken,
      poolAddress: data.poolAddress,
      symbol: data.symbol,
      name: data.name,
      image: data.image,
      mcap: data.marketCap
    };

    if (!activeWidgets.find(w => w.poolAddress === widgetData.poolAddress)) {
      activeWidgets.push(widgetData);
      localStorage.setItem("activeWidgetsMetadata", JSON.stringify(activeWidgets));
      renderList();
      spawnWidget(widgetData);
    }
  } catch (err) {
    console.error("Failed to add widget:", err);
    if (!silent) alert("Error: " + err);
  }
}

async function addWidget() {
  const mintOrPool = poolInput.value.trim();
  if (!mintOrPool) return;

  addButton.disabled = true;
  addButton.innerText = "Loading...";

  await addWidgetByMint(mintOrPool);

  addButton.disabled = false;
  addButton.innerText = "Add Widget";
  poolInput.value = "";
}

async function pullWallet() {
  const wallet = walletInput.value.trim();

  if (!wallet) {
    alert("Please enter both Wallet Address and Helius API Key");
    return;
  }

  pullButton.disabled = true;
  pullButton.innerText = "Pulling...";

  try {
    const response = await fetch(`https://api.helius.xyz/v1/wallet/${wallet}/balances?api-key=0041091d-9a4e-43c9-a025-617a1de37ae4`);
    if (!response.ok) throw new Error("Helius API error: " + response.statusText);

    const data = await response.json();
    const balances = data.balances || [];

    // Sort by USD value descending
    const sorted = balances.sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0));

    // Take top 5 non-SOL tokens with non-zero balance
    const topTokens = sorted
      .filter(t => t.balance > 0.1 && t.mint !== "So11111111111111111111111111111111111111112")
      .slice(0, 10);

    if (topTokens.length === 0) {
      alert("No tokens with balance found in this wallet.");
      return;
    }

    for (const token of topTokens) {
      await addWidgetByMint(token.mint, true);
    }

  } catch (err) {
    console.error("Failed to pull wallet:", err);
    alert("Error: " + err.message);
  } finally {
    pullButton.disabled = false;
    pullButton.innerText = "Pull Wallet";
  }
}

async function removeWidget(index, poolAddress) {
  activeWidgets.splice(index, 1);
  localStorage.setItem("activeWidgetsMetadata", JSON.stringify(activeWidgets));
  renderList();

  const label = `widget_${poolAddress ? poolAddress.replace(/[^a-zA-Z0-9]/g, '') : 'none'}`;
  const windows = await getAllWebviewWindows();
  const target = windows.find(w => w.label === label);
  if (target) await target.close();
}

function renderList() {
  widgetList.innerHTML = "";
  activeWidgets.forEach((widget, index) => {
    const div = document.createElement("div");
    div.className = "widget-item";
    div.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <img src="${widget.image}" style="width:24px; height:24px; border-radius:50%;" />
        <span>${widget.symbol}</span>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <button class="launch-btn" data-index="${index}" ${!widget.poolAddress ? 'disabled' : ''}>${widget.poolAddress ? 'Launch' : 'Pending...'}</button>
        <span class="remove" data-index="${index}">✕</span>
      </div>
    `;
    if (widget.poolAddress) {
      div.querySelector(".launch-btn").onclick = () => spawnWidget(widget);
    }
    div.querySelector(".remove").onclick = () => removeWidget(index, widget.poolAddress);
    widgetList.appendChild(div);
  });
}

// Only refresh metadata on start, don't auto-spawn
async function initSavedWidgets() {
  const refreshedWidgets = [];

  for (const widget of activeWidgets) {
    try {
      console.log("Refreshing metadata for:", widget.symbol);
      const data = await invoke("fetch_token_metadata", { mint: widget.mint });
      const freshWidget = {
        mint: data.baseToken,
        poolAddress: data.poolAddress,
        symbol: data.symbol,
        name: data.name,
        image: data.image,
        mcap: data.marketCap
      };
      refreshedWidgets.push(freshWidget);
    } catch (err) {
      console.error("Failed to refresh widget on startup:", widget.symbol, err);
      refreshedWidgets.push(widget);
    }
  }

  activeWidgets = refreshedWidgets;
  localStorage.setItem("activeWidgetsMetadata", JSON.stringify(activeWidgets));
  renderList();
}

const terminalRadios = document.querySelectorAll('input[name="terminal"]');
let preferredTerminal = localStorage.getItem('preferredTerminal') || 'axiom';

// Set initial radio state
terminalRadios.forEach(radio => {
  if (radio.value === preferredTerminal) radio.checked = true;
  radio.onchange = (e) => {
    preferredTerminal = e.target.value;
    localStorage.setItem('preferredTerminal', preferredTerminal);
  };
});

addButton.onclick = addWidget;
poolInput.onkeypress = (e) => { if (e.key === "Enter") addWidget(); };

pullButton.onclick = pullWallet;
walletInput.onkeypress = (e) => { if (e.key === "Enter") pullWallet(); };


renderList();
initSavedWidgets();
