const { WebviewWindow, getAllWebviewWindows } = window.__TAURI__.webviewWindow || window.__TAURI__.window;
const { invoke } = window.__TAURI__.core;

const poolInput = document.getElementById("pool-address");
const addButton = document.getElementById("add-widget");
const widgetList = document.getElementById("widget-list");

// Track widgets with metadata
let activeWidgets = JSON.parse(localStorage.getItem("activeWidgetsMetadata") || "[]");

// Track windows that are currently in the process of spawning to prevent duplicates
const spawningLabels = new Set();

async function spawnWidget(widgetData) {
  const { poolAddress, symbol, image, mcap, mint } = widgetData;
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

async function addWidget() {
  const mintOrPool = poolInput.value.trim();
  if (!mintOrPool) return;

  addButton.disabled = true;
  addButton.innerText = "Loading...";

  try {
    const data = await invoke("fetch_token_metadata", { mint: mintOrPool });
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
    alert("Error: " + err);
  } finally {
    addButton.disabled = false;
    addButton.innerText = "Add Widget";
    poolInput.value = "";
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

renderList();
initSavedWidgets();
