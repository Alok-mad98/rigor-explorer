use serde_json::{json, Value};
use worker::*;

const UPSTREAM: &str = "https://explorer.rigorchain.com/api";

#[event(fetch)]
async fn fetch(req: Request, _env: Env, _ctx: Context) -> Result<Response> {
    console_error_panic_hook::set_once();

    let url = req.url()?;
    let path = url.path().to_string();

    if req.method() == Method::Options {
        return Ok(cors(Response::empty()?));
    }

    if path == "/health" {
        return Ok(cors(Response::from_json(&json!({
            "ok": true,
            "service": "rigor-explorer-api",
            "backend": "rust-worker",
            "upstream": UPSTREAM,
        }))?));
    }

    if path == "/api/resolve" {
        let q = url
            .query()
            .unwrap_or_default()
            .split('&')
            .find_map(|kv| kv.strip_prefix("q="))
            .unwrap_or("")
            .to_string();
        return resolve(&q).await;
    }

    if let Some(rest) = path.strip_prefix("/api/") {
        return proxy(rest, url.query()).await;
    }

    Ok(cors(Response::from_json(&json!({
        "service": "rigor-explorer-api",
        "usage": ["GET /api/{upstream chain api path}", "GET /api/resolve?q=", "GET /health"]
    }))?))
}

async fn proxy(rest: &str, query: Option<&str>) -> Result<Response> {
    let qs = match query {
        Some(q) if !q.is_empty() => format!("?{}", q),
        _ => String::new(),
    };
    let target = format!("{}/{}{}", UPSTREAM, rest, qs);

    let mut init = RequestInit::new();
    init.method = Method::Get;

    let req = Request::new_with_init(&target, &init)?;
    let mut resp = Fetch::Request(req).send().await?;
    let status = resp.status_code();
    let body = resp.text().await?;

    let value = serde_json::from_str::<Value>(&body).unwrap_or(json!({ "error": "upstream non-json" }));

    let mut headers = Headers::new();
    let _ = headers.set("content-type", "application/json");
    let _ = headers.set("access-control-allow-origin", "*");
    let _ = headers.set("access-control-allow-methods", "GET, OPTIONS");
    let _ = headers.set("cache-control", "public, max-age=5, stale-while-revalidate=30");
    let _ = headers.set("x-backend", "rust-worker");

    Response::from_json(&value)
        .map(|r| r.with_status(status))
        .map(|r| r.with_headers(headers))
}

async fn resolve(q: &str) -> Result<Response> {
    let q = q.trim();
    let result = if !q.is_empty() && q.chars().all(|c| c.is_ascii_digit()) {
        json!({ "type": "block", "href": format!("#/block/{}", q) })
    } else if q.len() == 64 && q.chars().all(|c| c.is_ascii_hexdigit()) {
        let lower = q.to_lowercase();
        let tx_ok = probe(&format!("{}/tx/{}", UPSTREAM, lower)).await;
        if tx_ok {
            json!({ "type": "tx", "href": format!("#/tx/{}", lower) })
        } else {
            let block_ok = probe(&format!("{}/block/{}", UPSTREAM, lower)).await;
            if block_ok {
                json!({ "type": "block", "href": format!("#/block/{}", lower) })
            } else {
                json!({ "type": "not_found", "href": null })
            }
        }
    } else if q.starts_with("rg1") {
        json!({ "type": "address", "href": format!("#/address/{}", q) })
    } else {
        json!({ "type": "unknown", "href": null })
    };
    Ok(cors(Response::from_json(&result)?))
}

async fn probe(target: &str) -> bool {
    let mut init = RequestInit::new();
    init.method = Method::Get;
    if let Ok(req) = Request::new_with_init(target, &init) {
        if let Ok(resp) = Fetch::Request(req).send().await {
            return resp.status_code() == 200;
        }
    }
    false
}

fn cors(resp: Response) -> Response {
    let mut r = resp;
    let _ = r.headers_mut().set("access-control-allow-origin", "*");
    let _ = r.headers_mut().set("access-control-allow-methods", "GET, OPTIONS");
    let _ = r.headers_mut().set("access-control-allow-headers", "content-type");
    r
}
