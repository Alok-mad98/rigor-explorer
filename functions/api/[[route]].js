// Pages Function: proxies /api/* to the public RIGOR chain API.
// No secrets, no keys: the upstream is a public, read-only endpoint.
// This exists to avoid browser CORS limits and to add sane caching.

const UPSTREAM = "https://explorer.rigorchain.com/api";

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);

  // route is the array of path segments after /api
  const rest = (params.route || []).map(encodeURIComponent).join("/");
  const query = url.search || "";
  const target = `${UPSTREAM}/${rest}${query}`;

  const init = {
    method: request.method,
    headers: {
      "accept": "application/json",
      "user-agent": "rigor-explorer/1.0 (community, read-only)"
    },
    // cf options: always cache JSON briefly at the edge so a burst of
    // visitors does not hammer the public API
    cf: { cacheTtl: 5, cacheEverything: false }
  };

  let upstreamRes;
  try {
    upstreamRes = await fetch(target, init);
  } catch (e) {
    return json({ error: "upstream_unreachable", detail: String(e) }, 502);
  }

  const body = await upstreamRes.text();
  const headers = new Headers({
    "content-type": upstreamRes.headers.get("content-type") || "application/json",
    "cache-control": "public, max-age=5, stale-while-revalidate=30",
    "access-control-allow-origin": "*",
    "x-rigor-explorer": "community-proxy"
  });
  return new Response(body, { status: upstreamRes.status, headers });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" }
  });
}
