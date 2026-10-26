use serde_json::{json, Value};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn version() -> String {
    "explorer-core 0.1.0 (rust/wasm32)".to_string()
}

fn atoms_to_decimal(atoms: &str, decimals: usize) -> Option<String> {
    let cleaned: String = atoms.chars().filter(|c| c.is_ascii_digit()).collect();
    if cleaned.is_empty() {
        return None;
    }
    if cleaned.len() <= decimals {
        let int_part = "0".to_string();
        let frac = format!("{}{}", "0".repeat(decimals - cleaned.len()), cleaned);
        Some(format!("{}.{}", int_part, frac))
    } else {
        let split = cleaned.len() - decimals;
        let int_part = cleaned[..split].to_string();
        let frac = cleaned[split..].to_string();
        Some(format!("{}.{}", int_part, frac))
    }
}

fn trim_trailing_zeros(s: String) -> String {
    if s.contains('.') {
        let t = s.trim_end_matches('0').trim_end_matches('.');
        t.to_string()
    } else {
        s
    }
}

#[wasm_bindgen]
pub fn format_atoms(atoms: &str, unit: &str, decimals: usize) -> String {
    let decimals = if decimals > 8 || decimals == 0 { 8 } else { decimals };
    match atoms_to_decimal(atoms, decimals) {
        Some(d) => format!("{} {}", trim_trailing_zeros(d), unit),
        None => format!("0 {}?", unit),
    }
}

#[wasm_bindgen]
pub fn classify_query(q: &str) -> String {
    let q = q.trim();
    if q.is_empty() {
        return json!({ "kind": "empty" }).to_string();
    }
    if q.chars().all(|c| c.is_ascii_digit()) && q.len() <= 12 {
        return json!({ "kind": "height", "value": q }).to_string();
    }
    if q.starts_with("rg1") {
        return json!({ "kind": "address", "value": q }).to_string();
    }
    let hex_ok = q.len() == 64 && q.chars().all(|c| c.is_ascii_hexdigit());
    if hex_ok {
        return json!({ "kind": "hex64", "value": q.to_lowercase() }).to_string();
    }
    if q.starts_with("0x") && q.len() == 66 && q[2..].chars().all(|c| c.is_ascii_hexdigit()) {
        return json!({ "kind": "hex64", "value": q[2..].to_lowercase() }).to_string();
    }
    json!({ "kind": "unknown", "value": q }).to_string()
}

fn f64_or(v: &Value, default: f64) -> f64 {
    v.as_f64().unwrap_or(default)
}

fn atoms_f64(v: &Value) -> f64 {
    match v {
        Value::String(s) => s.parse::<u128>().map(|a| a as f64 / 1e8).unwrap_or(0.0),
        Value::Number(n) => n.as_f64().unwrap_or(0.0),
        _ => 0.0,
    }
}

#[wasm_bindgen]
pub fn summarize(blocks_json: &str, status_json: &str) -> String {
    let blocks: Value = match serde_json::from_str(blocks_json) {
        Ok(v) => v,
        Err(_) => return json!({ "error": "bad_blocks_json" }).to_string(),
    };
    let status: Value = match serde_json::from_str(status_json) {
        Ok(v) => v,
        Err(_) => return json!({ "error": "bad_status_json" }).to_string(),
    };

    let list = blocks
        .get("blocks")
        .and_then(|b| b.as_array())
        .cloned()
        .unwrap_or_default();

    let n = list.len();
    let mut total_tx: u64 = 0;
    let mut fee_burn_sum: f64 = 0.0;
    let mut minted_sum: f64 = 0.0;
    let mut with_winner: usize = 0;
    let mut newest_time: f64 = 0.0;
    let mut oldest_time: f64 = 0.0;
    let mut tx_counts: Vec<u64> = Vec::with_capacity(n);

    for b in &list {
        let tx = b
            .get("tx_count")
            .and_then(|t| t.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .or_else(|| b.get("tx_count").and_then(|t| t.as_u64()))
            .unwrap_or(0);
        tx_counts.push(tx);
        total_tx += tx;
        fee_burn_sum += atoms_f64(b.get("rfc018_block_burned_oru").unwrap_or(&Value::Null));
        minted_sum += atoms_f64(b.get("oru_minted_atoms").unwrap_or(&Value::Null));
        if b.get("rigor_winner")
            .and_then(|w| w.as_str())
            .map(|w| !w.is_empty())
            .unwrap_or(false)
        {
            with_winner += 1;
        }
        let t = b.get("time").and_then(|t| t.as_str()).and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
        if t > 0.0 {
            if newest_time == 0.0 || t > newest_time {
                newest_time = t;
            }
            if oldest_time == 0.0 || t < oldest_time {
                oldest_time = t;
            }
        }
    }

    let avg_tx = if n > 0 { total_tx as f64 / n as f64 } else { 0.0 };
    let window_seconds = if newest_time > oldest_time { newest_time - oldest_time } else { 0.0 };
    let avg_interval = if n > 1 && window_seconds > 0.0 {
        window_seconds / (n - 1) as f64
    } else {
        0.0
    };

    let econ = status.pointer("/economic_snapshot").cloned().unwrap_or(Value::Null);
    let mining = status.pointer("/mining_activity").cloned().unwrap_or(Value::Null);
    let health = status.pointer("/block_health").cloned().unwrap_or(Value::Null);

    let out = json!({
        "window": {
            "blocks": n,
            "avg_tx_per_block": (avg_tx * 100.0).round() / 100.0,
            "avg_interval_seconds": (avg_interval * 10.0).round() / 10.0,
            "blocks_per_hour": if avg_interval > 0.0 { (3600.0 / avg_interval * 100.0).round() / 100.0 } else { 0.0 },
            "fee_burn_sum_oru": (fee_burn_sum * 1e8).round() / 1e8,
            "minted_sum_oru": (minted_sum * 1e8).round() / 1e8,
            "blocks_with_named_winner": with_winner,
            "span_seconds": window_seconds
        },
        "tip": {
            "height": econ.get("tip_height").cloned().unwrap_or(json!(0)),
            "difficulty": f64_or(&health.get("difficulty").cloned().unwrap_or(json!(0)), 0.0)
        },
        "network": {
            "connections": mining.get("connections").cloned().unwrap_or(json!(0)),
            "mempool_tx_count": mining.get("mempool_tx_count").cloned().unwrap_or(json!(0)),
            "active_miners": mining.get("active_miners").cloned().unwrap_or(Value::Null)
        },
        "economy": {
            "circulating": econ.get("oru_circulating_spendable_display").cloned().unwrap_or(json!("")),
            "coinbase_total": econ.get("oru_coinbase_total_display").cloned().unwrap_or(json!("")),
            "convergence_burned": econ.get("oru_burned_lifetime_display").cloned().unwrap_or(json!("")),
            "res_minted": econ.get("res_minted_total_display").cloned().unwrap_or(json!("")),
            "res_destroy_cost": econ.get("res_destroy_cost_display").cloned().unwrap_or(json!("")),
            "immature_coinbase": econ.get("oru_immature_coinbase_display").cloned().unwrap_or(json!(""))
        }
    });
    out.to_string()
}

#[wasm_bindgen]
pub fn address_balance(utxo_summary_json: &str) -> String {
    let v: Value = match serde_json::from_str(utxo_summary_json) {
        Ok(v) => v,
        Err(_) => return json!({ "error": "bad_json" }).to_string(),
    };
    let oru = &v["oru"];
    let res = &v["res"];
    let out = json!({
        "oru": {
            "balance": oru.get("current_balance").cloned().unwrap_or(json!("0")),
            "received": oru.get("total_received").cloned().unwrap_or(json!("0")),
            "spent": oru.get("total_spent").cloned().unwrap_or(json!("0")),
            "utxos": oru.get("total_utxo_count").cloned().unwrap_or(json!(0))
        },
        "res": {
            "balance": res.get("current_balance").cloned().unwrap_or(json!("0")),
            "received": res.get("total_received").cloned().unwrap_or(json!("0")),
            "spent": res.get("total_spent").cloned().unwrap_or(json!("0")),
            "utxos": res.get("total_utxo_count").cloned().unwrap_or(json!(0))
        }
    });
    out.to_string()
}
