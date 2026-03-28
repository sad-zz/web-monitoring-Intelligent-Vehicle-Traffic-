/**
 * TC Manager - Mobile Web UI Proxy
 *
 * A lightweight server that:
 *  1. Serves the mobile-optimised frontend (index.html, css/, js/)
 *  2. Proxies every /api/* request to the main TC Manager server
 *     so that the mobile UI reads the SAME data (TCP port 2022,
 *     database, RMTO queue) without duplicating anything.
 *
 * Usage:
 *   MAIN_SERVER=http://127.0.0.1:3000 PORT=3001 node server.js
 *
 * Environment variables:
 *   PORT         – port for this mobile server   (default 3001)
 *   MAIN_SERVER  – main TC Manager origin        (default http://127.0.0.1:3000)
 */

var express = require("express");
var path = require("path");
var { createProxyMiddleware } = require("http-proxy-middleware");

var app = express();
var PORT = parseInt(process.env.PORT, 10);
if (isNaN(PORT)) PORT = 3001;
var MAIN_SERVER = process.env.MAIN_SERVER || "http://127.0.0.1:3000";

// ------------------------------------------------------------------
// 1. Proxy all API calls to the main server (preserves cookies/session)
// ------------------------------------------------------------------
app.use(
    "/api",
    createProxyMiddleware({
        target: MAIN_SERVER,
        changeOrigin: true,
        cookieDomainRewrite: "",
        onProxyReq: function (proxyReq, req) {
            // Forward the original cookie header so sessions work
            if (req.headers.cookie) {
                proxyReq.setHeader("Cookie", req.headers.cookie);
            }
        },
        onProxyRes: function (proxyRes) {
            // Allow credentials from the mobile origin
            proxyRes.headers["access-control-allow-credentials"] = "true";
        },
        onError: function (err, req, res) {
            console.error("[Proxy] Error connecting to main server:", err.message);
            res.status(502).json({ error: "Main server unreachable" });
        }
    })
);

// ------------------------------------------------------------------
// 2. Serve mobile frontend static files
// ------------------------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));

// Fallback: serve index.html for any non-API, non-file route (SPA)
app.get("*", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ------------------------------------------------------------------
// 3. Start
// ------------------------------------------------------------------
app.listen(PORT, "0.0.0.0", function () {
    console.log("============================================");
    console.log("  TC Manager – Mobile UI");
    console.log("  Listening: http://0.0.0.0:" + PORT);
    console.log("  API proxy: " + MAIN_SERVER + "/api/*");
    console.log("============================================");
});
