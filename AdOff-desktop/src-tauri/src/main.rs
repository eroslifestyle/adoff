#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Serialize, Deserialize)]
pub struct LicenseInfo {
    pub valid: bool,
    pub plan: String,
    pub expires_at: Option<i64>,
    pub account_id: Option<String>,
    pub bearer_token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VpnServer {
    pub id: String,
    pub name: String,
    pub country: String,
    pub country_code: String,
    pub load: u8,
    pub premium_only: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VpnConfig {
    pub config: String,
    pub server: String,
    pub port: u16,
    pub protocol: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VpnAccount {
    pub account_id: String,
    pub device_id: String,
    pub created: bool,
}

#[derive(Debug, Deserialize)]
struct ApiError {
    error: String,
}

/// Verifica licenza Premium mobile tramite token
#[tauri::command]
pub async fn verify_license(token: String) -> Result<LicenseInfo, String> {
    let api_base = env::var("ADOFF_API_BASE").unwrap_or_else(|_| "https://api.adoff.app".into());

    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/api/verify-mobile-license", api_base))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", resp.status(), body));
    }

    resp.json::<LicenseInfo>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

/// Lista server VPN disponibili
#[tauri::command]
pub async fn get_vpn_servers(bearer_token: String) -> Result<Vec<VpnServer>, String> {
    let api_base = env::var("ADOFF_API_BASE").unwrap_or_else(|_| "https://api.adoff.app".into());

    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/vpn/servers", api_base))
        .header("Authorization", format!("Bearer {}", bearer_token))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", resp.status(), body));
    }

    resp.json::<Vec<VpnServer>>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

/// Scarica config WireGuard/OpenVPN per uno server
#[tauri::command]
pub async fn get_vpn_config(
    bearer_token: String,
    account_id: String,
    server_id: String,
    device_id: String,
) -> Result<VpnConfig, String> {
    let api_base = env::var("ADOFF_API_BASE").unwrap_or_else(|_| "https://api.adoff.app".into());

    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/vpn/config", api_base))
        .query(&[
            ("account_id", &account_id),
            ("server_id", &server_id),
            ("device_id", &device_id),
        ])
        .header("Authorization", format!("Bearer {}", bearer_token))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", resp.status(), body));
    }

    resp.json::<VpnConfig>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

/// Crea account VPN per un nuovo dispositivo
#[tauri::command]
pub async fn create_vpn_account(bearer_token: String) -> Result<VpnAccount, String> {
    let api_base = env::var("ADOFF_API_BASE").unwrap_or_else(|_| "https://api.adoff.app".into());

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/vpn/create", api_base))
        .header("Authorization", format!("Bearer {}", bearer_token))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", resp.status(), body));
    }

    resp.json::<VpnAccount>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

fn main() {
    // ponytail: tracing instead of println for production
    tracing_subscriber::fmt()
        .with_env_filter(
            env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        )
        .init();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            verify_license,
            get_vpn_servers,
            get_vpn_config,
            create_vpn_account,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
