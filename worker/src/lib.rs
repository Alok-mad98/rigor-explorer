use serde_json::{json, Value};
use worker::*;

const UPSTREAM: &str = "https://explorer.rigorchain.com/api";

fn cors(resp: &mut Response) {
    let headers = resp.headers_mut();
    let _ = headers.set("Access-Control-Allow-Origin", "*");
    let _ = headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    let _ = headers.set("Access-Control-Allow-Headers", "Content-Type");
    let _ = headers.set("Access-Control-Max-Age", "86400");
    let _ = headers.set("X-Rigor-Backend", "rust-worker-0.1.0");
}

fn cache_control(resp: &mut Response, seconds: u32) {
    let headers = resp.headers_mut();
    let _ = headers.set("Cache-Control", &format!("public, max-age={}", seconds));
}

fn ok_json(v: Value, cache_seconds: u32) -> Result<Response> {
    let mut resp = Response::from_json(&v)?;
    cors(&mut resp);
    cache_control(&mut resp, cache_seconds);
    Ok(resp)
}

async fn upstream(path_and_query: &str) -> Result<String> {
    let url = format!("{}/{}", UPSTREAM, path_and_query.trim_start_matches('/'));
    let mut init = RequestInit::new();
    init.with_method(Method::Get);
    let req = Request::new_with_init(&url, &init)?;
    let resp = Fetch::Request(req).send().await?;
    let status = resp.status_code();
    let body = resp.text().await?;
    if status >= 400 {
        return Err(Error::RustError(format!("upstream {}: {}", status, body.chars().take(200).collect::<String>())));
    }
    Ok(body)
}

fn upstream_to_response(body: String, cache_seconds: u32) -> Result<Response> {
    let value: Value = serde_json::from_str(&body)
        .map_err(|e| Error::RustError(format!("bad upstream json: {}", e)))?;
    ok_json(value, cache_seconds)
}

fn is_hex64(s: &str) -> bool {
    s.len() == 64 && s.chars().all(|c| c.is_ascii_hexdigit())
}

fn classify(q: &str) -> String {
    let q = q.trim();
    if q.is_empty() {
        return "empty".into();
    }
    if q.chars().all(|c| c.is_ascii_digit()) && q.len() <= 12 {
        return "height".into();
    }
    if q.starts_with("rg1") {
        return "address".into();
    }
    if is_hex64(q) || (q.starts_with("0x") && q.len() == 66 && is_hex64(&q[2..])) {
        return "hex64".into();
    }
    "unknown".into()
}

async fn resolve(query: &str) -> Result<Response> {
    let mut q = "";
    for pair in query.split('&') {
        if let Some(v) = pair.strip_prefix("q=") {
            q = v;
        }
    }
    let q = q.trim().trim_start_matches("0x").to_string();
    let kind = classify(&q);

    let result = match kind.as_str() {
        "empty" | "unknown" => json!({ "found": false, "kind": kind, "q": q, "hint": "Try a block height, 64-hex block hash or txid, or an rg1q address." }),
        "height" => {
            match upstream(&format!("block/{}", q)).await {
                Ok(_) => json!({ "found": true, "kind": "block", "q": q, "route": format!("/block/{}", q) }),
                Err(_) => json!({ "found": false, "kind": "block", "q": q, "hint": "No block at that height." }),
            }
        }
        "address" => {
            match upstream(&format!("address/{}", q)).await {
                Ok(_) => json!({ "found": true, "kind": "address", "q": q, "route": format!("/address/{}", q) }),
                Err(_) => json!({ "found": false, "kind": "address", "q": q, "hint": "Address not indexed yet." }),
            }
        }
        "hex64" => {
            let as_tx = upstream(&format!("tx/{}", q)).await;
            if as_tx.is_ok() {
                json!({ "found": true, "kind": "tx", "q": q, "route": format!("/tx/{}", q) })
            } else {
                match upstream(&format!("block/{}", q)).await {
                    Ok(_) => json!({ "found": true, "kind": "block", "q": q, "route": format!("/block/{}", q) }),
                    Err(_) => json!({ "found": false, "kind": "unknown", "q": q, "hint": "No transaction or block with that hash." }),
                }
            }
        }
        _ => json!({ "found": false, "kind": "unknown", "q": q }),
    };
    ok_json(result, 10)
}

async fn bundle(query: &str) -> Result<Response> {
    let mut blocks_qs = String::from("blocks?limit=100");
    if !query.is_empty() {
        for pair in query.split('&') {
            if pair.starts_with("limit=") {
                blocks_qs = format!("blocks?{}", pair);
            }
            if pair.starts_with("page=") {
                blocks_qs = format!("{}&{}", blocks_qs, pair);
            }
        }
    }
    let status = upstream("status").await?;
    let blocks = upstream(&blocks_qs).await?;
    let out = json!({
        "status": serde_json::from_str::<Value>(&status).map_err(|e| Error::RustError(e.to_string()))?,
        "blocks": serde_json::from_str::<Value>(&blocks).map_err(|e| Error::RustError(e.to_string()))?,
        "fetched_at": chrono_like_now(),
    });
    ok_json(out, 8)
}

fn chrono_like_now() -> u64 {
    let secs = js_sys::Date::now() as u64 / 1000;
    secs
}

fn route_suffix(path: &str) -> &str {
    path.trim_start_matches("/api/")
}

#[event(fetch)]
async fn fetch(req: Request, _env: Env, _ctx: Context) -> Result<Response> {
    if req.method() == Method::Options {
        let mut resp = Response::empty()?;
        cors(&mut resp);
        return Ok(resp);
    }

    let url = req.url()?;
    let path = url.path().to_string();
    let query = url.query().map(|q| q.to_string()).unwrap_or_default();

    if req.method() != Method::Get {
        return Response::error("Method not allowed", 405);
    }

    match path.as_str() {
        "/" | "/api" => ok_json(json!({
            "service": "rigor-explorer-api",
            "backend": "rust",
            "version": "0.1.0",
            "upstream": UPSTREAM,
            "endpoints": ["/api/health", "/api/status", "/api/blocks", "/api/block/:height_or_hash", "/api/tx/:txid", "/api/address/:addr", "/api/bundle", "/api/resolve?q="]
        }), 300),
        "/api/health" => ok_json(json!({
            "ok": true,
            "service": "rigor-explorer-api",
            "backend": "rust/wasm",
            "rustc": "1.96",
            "upstream": UPSTREAM
        }), 60),
        "/api/resolve" => resolve(&query).await,
        "/api/bundle" => bundle(&query).await,
        "/api/status" => match upstream("status").await {
            Ok(body) => upstream_to_response(body, 8),
            Err(e) => Response::error(format!("upstream error: {}", e), 502),
        },
        "/api/blocks" => match upstream(&format!("blocks?{}", query)).await {
            Ok(body) => upstream_to_response(body, 8),
            Err(e) => Response::error(format!("upstream error: {}", e), 502),
        },
        _ if path.starts_with("/api/block/") => match upstream(&format!("block/{}", route_suffix(&path))).await {
            Ok(body) => upstream_to_response(body, 60),
            Err(_) => Response::error("Block not found", 404),
        },
        _ if path.starts_with("/api/tx/") => match upstream(&format!("tx/{}", route_suffix(&path))).await {
            Ok(body) => upstream_to_response(body, 60),
            Err(_) => Response::error("Transaction not found", 404),
        },
        _ if path.starts_with("/api/address/") => match upstream(&format!("address/{}", route_suffix(&path))).await {
            Ok(body) => upstream_to_response(body, 30),
            Err(_) => Response::error("Address not found or not indexed", 404),
        },
        _ => Response::error("Not found", 404),
    }
}
