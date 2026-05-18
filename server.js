const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));

// ── State ──
const rooms = {}; // roomId -> { admin: ws, peserta: { id: ws } }
const clients = new Map(); // ws -> { role, roomId, id, nama }

function broadcast(ws, data) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(data));
}

function getRoomAdmin(roomId) {
  return rooms[roomId]?.admin || null;
}

function getAdminInfo(roomId) {
  for (const [ws, info] of clients.entries()) {
    if (info.role === 'admin' && info.roomId === roomId) return { ws, info };
  }
  return null;
}

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const { type } = msg;

    // ── Admin join ──
    if (type === 'admin-join') {
      const { roomId, password } = msg;
      if (password !== 'admin123') {
        broadcast(ws, { type: 'error', message: 'Password salah' });
        return;
      }
      if (!rooms[roomId]) rooms[roomId] = { admin: null, peserta: {} };
      rooms[roomId].admin = ws;
      clients.set(ws, { role: 'admin', roomId });
      broadcast(ws, { type: 'admin-joined', roomId });
      console.log(`Admin joined room: ${roomId}`);

      // Beritahu semua peserta di room bahwa admin aktif
      for (const [pid, pws] of Object.entries(rooms[roomId].peserta)) {
        broadcast(pws, { type: 'admin-online' });
      }
    }

    // ── Peserta join ──
    if (type === 'peserta-join') {
      const { roomId, nama, kode } = msg;
      if (!rooms[roomId]) rooms[roomId] = { admin: null, peserta: {} };
      rooms[roomId].peserta[kode] = ws;
      clients.set(ws, { role: 'peserta', roomId, id: kode, nama });
      broadcast(ws, { type: 'peserta-joined', kode });
      console.log(`Peserta joined: ${nama} (${kode}) in room: ${roomId}`);

      // Beritahu admin ada peserta baru
      const adminWs = rooms[roomId].admin;
      if (adminWs) {
        broadcast(adminWs, { type: 'peserta-connected', kode, nama });
      }
    }

    // ── WebRTC Signaling: Peserta kirim offer ke Admin ──
    if (type === 'webrtc-offer') {
      const info = clients.get(ws);
      if (!info) return;
      const adminWs = rooms[info.roomId]?.admin;
      if (adminWs) {
        broadcast(adminWs, {
          type: 'webrtc-offer',
          offer: msg.offer,
          from: info.id,
          nama: info.nama,
        });
      }
    }

    // ── WebRTC Signaling: Admin kirim answer ke Peserta ──
    if (type === 'webrtc-answer') {
      const { to, answer } = msg;
      const info = clients.get(ws);
      if (!info) return;
      const targetWs = rooms[info.roomId]?.peserta[to];
      if (targetWs) {
        broadcast(targetWs, { type: 'webrtc-answer', answer });
      }
    }

    // ── ICE Candidate ──
    if (type === 'ice-candidate') {
      const { candidate, to, from } = msg;
      const senderInfo = clients.get(ws);
      if (!senderInfo) return;

      if (senderInfo.role === 'peserta') {
        // Peserta kirim ICE ke admin
        const adminWs = rooms[senderInfo.roomId]?.admin;
        if (adminWs) broadcast(adminWs, { type: 'ice-candidate', candidate, from: senderInfo.id });
      } else if (senderInfo.role === 'admin') {
        // Admin kirim ICE ke peserta
        const targetWs = rooms[senderInfo.roomId]?.peserta[to];
        if (targetWs) broadcast(targetWs, { type: 'ice-candidate', candidate });
      }
    }

    // ── Log event dari peserta (pindah tab, dll) ──
    if (type === 'event-log') {
      const info = clients.get(ws);
      if (!info) return;
      const adminWs = rooms[info.roomId]?.admin;
      if (adminWs) {
        broadcast(adminWs, {
          type: 'event-log',
          from: info.id,
          nama: info.nama,
          event: msg.event,
          level: msg.level || 'info',
        });
      }
    }

    // ── Hasil tes ──
    if (type === 'hasil-tes') {
      const info = clients.get(ws);
      if (!info) return;
      const adminWs = rooms[info.roomId]?.admin;
      if (adminWs) {
        broadcast(adminWs, {
          type: 'hasil-tes',
          kode: info.id,
          nama: info.nama,
          skor: msg.skor,
          benar: msg.benar,
          total: msg.total,
          kategori: msg.kategori,
        });
      }
    }
  });

  ws.on('close', () => {
    const info = clients.get(ws);
    if (!info) return;
    const { role, roomId, id, nama } = info;

    if (role === 'peserta' && rooms[roomId]) {
      delete rooms[roomId].peserta[id];
      const adminWs = rooms[roomId].admin;
      if (adminWs) broadcast(adminWs, { type: 'peserta-disconnected', kode: id, nama });
      console.log(`Peserta disconnected: ${nama}`);
    }

    if (role === 'admin' && rooms[roomId]) {
      rooms[roomId].admin = null;
      console.log(`Admin disconnected from room: ${roomId}`);
    }

    clients.delete(ws);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`PsikoTest server running on port ${PORT}`));
