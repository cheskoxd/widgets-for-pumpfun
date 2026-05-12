use tauri::Manager;

#[tauri::command]
async fn fetch_token_metadata(mint: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    
    // 1. Get Pool Info from MEV-X (Crucial for poolAddress)
    let search_url = format!("https://api.mevx.io/api/v1/pools/search?q={}&orderBy=createdAt+desc&liquidUsd%5Bgte%5D=2000&chain=sol", mint);
    let search_resp = client.get(search_url).header("User-Agent", "Tauri App").send().await.map_err(|e| e.to_string())?;
    
    let mut final_data = serde_json::json!({});
    let mut found_pool = false;

    if search_resp.status().is_success() {
        let json: serde_json::Value = search_resp.json().await.map_err(|e| e.to_string())?;
        if let Some(pools) = json.get("pools").and_then(|p| p.as_array()) {
            if !pools.is_empty() {
                let pool = &pools[0];
                final_data["poolAddress"] = pool["poolAddress"].clone();
                final_data["baseToken"] = pool["baseToken"].clone();
                final_data["marketCap"] = pool["marketCap"].clone();
                
                // Try to get metadata from MEV-X first
                if let Some(info) = pool.get("baseTokenInfo") {
                    final_data["symbol"] = info["symbol"].clone();
                    final_data["name"] = info["name"].clone();
                    final_data["image"] = info["logoUri"].clone();
                }
                found_pool = true;
            }
        }
    }

    // 2. Fallback/Supplement with Pump.fun API for metadata
    let pump_url = format!("https://frontend-api-v3.pump.fun/coins-v2/{}", mint);
    let pump_resp = client.get(pump_url).header("User-Agent", "Tauri App").send().await;
    
    if let Ok(resp) = pump_resp {
        if resp.status().is_success() {
            if let Ok(pump_json) = resp.json::<serde_json::Value>().await {
                // Prioritize Pump.fun for these specific fields if they are missing or if it's a fresh token
                if final_data["symbol"].is_null() || final_data["symbol"] == "" {
                    final_data["symbol"] = pump_json["symbol"].clone();
                }
                if final_data["name"].is_null() || final_data["name"] == "" {
                    final_data["name"] = pump_json["name"].clone();
                }
                if final_data["image"].is_null() || final_data["image"] == "" {
                    final_data["image"] = pump_json["image_uri"].clone();
                }
                
                // If MEV-X didn't find a pool yet, we can still use Pump.fun data for the dashboard
                if !found_pool {
                    final_data["baseToken"] = pump_json["mint"].clone();
                    final_data["marketCap"] = pump_json["usd_market_cap"].clone();
                    // Note: poolAddress will be null, so it won't connect to WS yet
                }
            }
        }
    }

    if final_data["baseToken"].is_null() {
        return Err("Could not find token data on MEV-X or Pump.fun".to_string());
    }

    Ok(final_data)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            } else {
                let _ = tauri::WebviewWindowBuilder::new(
                    app,
                    "main",
                    tauri::WebviewUrl::App("index.html".into()),
                )
                .title("WidgetsForPumpfun by Cheskodev")
                .inner_size(800.0, 600.0)
                .resizable(true)
                .decorations(true)
                .build();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![fetch_token_metadata])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
