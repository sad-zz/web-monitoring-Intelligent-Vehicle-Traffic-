'use strict';

/**
 * server.js — TCP server برای پروتکل RATCX1
 *
 * چرخه اتصال:
 *  1. Device → 8000 handshake
 *  2. Server → 0012 time-sync (2 بار، 3 ثانیه فاصله)
 *  3. Device → 8012 ACK
 *  4. Server → 0197 برای 3 interval آخر
 *  5. هر 5 دقیقه: Server → 0197 برای interval تکمیل‌شده
 *  6. هر 15 دقیقه: time-sync مجدد
 *  7. Device → 8821 داده interval → پردازش و ارسال به RMTO
 */

const net = require('net');
const fs = require('fs');
const path = require('path');
const cfg = require('./config');
const proto = require('./protocol');
const rmto = require('./rmto');

// ─── لاگ ─────────────────────────────────────────────────────────────────────
if (!fs.existsSync(cfg.LOG_DIR)) fs.mkdirSync(cfg.LOG_DIR, { recursive: true });

function logFile() {
  const d = new Date();
  const name = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.log`;
  return path.join(cfg.LOG_DIR, name);
}

function log(level, msg) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(logFile(), line + '\n'); } catch (_) {}
}

// ─── state هر اتصال ──────────────────────────────────────────────────────────
function makeState(socket) {
  return {
    socket,
    sysId: null,
    model: null,
    buf: '',
    waitingAck: false,
    pollTimer: null,
    resyncTimer: null,
    ackTimer: null,
    pendingIntervals: [],   // intervalهایی که پس از ACK باید poll شوند
  };
}

// ─── ارسال به دستگاه ─────────────────────────────────────────────────────────
function send(state, msg) {
  try {
    state.socket.write(msg);
    log('SEND', `[${state.sysId || '?'}] ${msg.slice(0, 80)}`);
  } catch (e) {
    log('ERR', `send failed: ${e.message}`);
  }
}

// ─── time-sync ───────────────────────────────────────────────────────────────
function doTimeSync(state, then) {
  const cmd = proto.build0012();
  send(state, cmd);
  setTimeout(() => send(state, proto.build0012()), 3000);
  state.waitingAck = true;

  if (state.ackTimer) clearTimeout(state.ackTimer);
  state.ackTimer = setTimeout(() => {
    log('WARN', `[${state.sysId}] ACK timeout — proceeding anyway`);
    state.waitingAck = false;
    if (then) then();
  }, cfg.ACK_TIMEOUT_MS);

  state._afterAck = then || null;
}

// ─── درخواست 3 interval آخر ──────────────────────────────────────────────────
function requestLast3(state) {
  const now = proto.roundTo5Min(new Date());
  for (let i = 3; i >= 1; i--) {
    const t = new Date(now.getTime() - i * 5 * 60 * 1000);
    setTimeout(() => send(state, proto.build0197(t)), (3 - i) * 500);
  }
}

// ─── polling هر 5 دقیقه ──────────────────────────────────────────────────────
function schedulePoll(state) {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(() => {
    if (state.waitingAck) return; // منتظر ACK هستیم، poll را رد کن
    // interval تکمیل‌شده = آخرین ۵ دقیقه
    const t = new Date(proto.roundTo5Min(new Date()).getTime() - 5 * 60 * 1000);
    send(state, proto.build0197(t));
  }, cfg.POLL_INTERVAL_MS);
}

// ─── resync هر 15 دقیقه ──────────────────────────────────────────────────────
function scheduleResync(state) {
  if (state.resyncTimer) clearInterval(state.resyncTimer);
  state.resyncTimer = setInterval(() => {
    log('INFO', `[${state.sysId}] periodic time-sync`);
    doTimeSync(state, null);
  }, cfg.RESYNC_INTERVAL_MS);
}

// ─── پردازش پیام 8821 ────────────────────────────────────────────────────────
async function handle8821(state, msg) {
  const parsed = proto.parse8821(msg);
  if (!parsed) {
    log('WARN', `[${state.sysId}] invalid 8821`);
    return;
  }
  log('DATA', `[${parsed.sysId}] interval=${parsed.intervalTime.toISOString()} battery=${parsed.battery} solar=${parsed.solar} err=${parsed.error}`);

  const rid = cfg.ROUTE_MAP[parsed.sysId];
  if (!rid) {
    log('WARN', `[${parsed.sysId}] no RID in ROUTE_MAP — skipping RMTO send`);
    return;
  }

  const rmtoData = proto.intervalToRmto(parsed);
  const fid = `${parsed.sysId}-${proto.toYYMMDDHHmm(parsed.intervalTime)}`;

  log('RMTO', `[${parsed.sysId}] sending fid=${fid} rid=${rid} c1-5=${rmtoData.c1},${rmtoData.c2},${rmtoData.c3},${rmtoData.c4},${rmtoData.c5} asp=${rmtoData.asp} sso=${rmtoData.sso}`);

  const result = await rmto.sendAdd5({ ...rmtoData, rid, fid });
  if (result.success) {
    log('RMTO', `[${parsed.sysId}] OK: ${String(result.response).slice(0, 200)}`);
  } else {
    log('ERR', `[${parsed.sysId}] RMTO failed: ${result.response}`);
  }
}

// ─── پردازش handshake 8000 ───────────────────────────────────────────────────
function handle8000(state, msg) {
  const parsed = proto.parse8000(msg);
  if (!parsed) {
    log('WARN', `[?] invalid 8000: ${msg.slice(0, 50)}`);
    return;
  }
  state.sysId = parsed.sysId;
  state.model = parsed.model;
  log('CONN', `[${state.sysId}] connected model=${parsed.model} deviceTime=${parsed.deviceTime ? parsed.deviceTime.toISOString() : 'null'}`);

  const drift = proto.clockDriftMs(parsed.deviceTime);
  log('INFO', `[${state.sysId}] clock drift=${Math.round(drift / 1000)}s`);

  if (drift > cfg.MAX_CLOCK_DRIFT_MS) {
    // > 5 دقیقه: sync و defer
    log('WARN', `[${state.sysId}] drift >5min — syncing, deferring data request`);
    doTimeSync(state, () => requestLast3(state));
  } else if (drift > cfg.WARN_CLOCK_DRIFT_MS) {
    // 2-5 دقیقه: sync و بلافاصله request
    log('WARN', `[${state.sysId}] drift 2-5min — syncing then requesting`);
    doTimeSync(state, () => requestLast3(state));
  } else {
    // طبیعی
    doTimeSync(state, () => requestLast3(state));
  }

  schedulePoll(state);
  scheduleResync(state);
}

// ─── پردازش ACK 8012 ─────────────────────────────────────────────────────────
function handle8012(state, msg) {
  const parsed = proto.parse8012(msg);
  log('ACK', `[${state.sysId}] time-sync ACK deviceTime=${parsed && parsed.deviceTime ? parsed.deviceTime.toISOString() : 'null'}`);
  state.waitingAck = false;
  if (state.ackTimer) { clearTimeout(state.ackTimer); state.ackTimer = null; }
  if (state._afterAck) {
    const fn = state._afterAck;
    state._afterAck = null;
    fn();
  }
}

// ─── پردازش پیام‌های ورودی ───────────────────────────────────────────────────
function processMessages(state) {
  const lines = state.buf.split('\n');
  state.buf = lines.pop(); // آخرین قطعه ناقص
  for (const line of lines) {
    const msg = line.trim();
    if (!msg) continue;
    log('RECV', `[${state.sysId || '?'}] ${msg.slice(0, 80)}`);
    const code = msg.slice(0, 4);
    if (code === '8000') handle8000(state, msg);
    else if (code === '8012') handle8012(state, msg);
    else if (code === '8821') handle8821(state, msg);
    else log('WARN', `[${state.sysId || '?'}] unknown code ${code}`);
  }
}

// ─── cleanup اتصال ───────────────────────────────────────────────────────────
function cleanup(state) {
  if (state.pollTimer) clearInterval(state.pollTimer);
  if (state.resyncTimer) clearInterval(state.resyncTimer);
  if (state.ackTimer) clearTimeout(state.ackTimer);
  log('CONN', `[${state.sysId || '?'}] disconnected`);
}

// ─── TCP Server ───────────────────────────────────────────────────────────────
const server = net.createServer((socket) => {
  const state = makeState(socket);
  const remote = `${socket.remoteAddress}:${socket.remotePort}`;
  log('CONN', `new connection from ${remote}`);

  socket.setEncoding('utf8');

  socket.on('data', (chunk) => {
    state.buf += chunk;
    processMessages(state);
  });

  socket.on('end', () => cleanup(state));
  socket.on('close', () => cleanup(state));
  socket.on('error', (err) => {
    log('ERR', `[${state.sysId || remote}] ${err.message}`);
    cleanup(state);
  });
});

server.on('error', (err) => {
  log('FATAL', `Server error: ${err.message}`);
  process.exit(1);
});

server.listen(cfg.TCP_PORT, () => {
  log('INFO', `tc-relay listening on TCP port ${cfg.TCP_PORT}`);
  log('INFO', `RMTO URL: ${cfg.RMTO_URL}`);
  log('INFO', `ROUTE_MAP entries: ${Object.keys(cfg.ROUTE_MAP).length}`);
});

process.on('SIGINT', () => { log('INFO', 'shutting down'); server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { log('INFO', 'shutting down'); server.close(() => process.exit(0)); });
