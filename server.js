const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};
const clients = new Map();

function send(ws, data) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(data));
}

wss.on('connection', (ws) => {
  console.log('[+] Client connected, total:', wss.clients.size);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const { type } = msg;

    if (type === 'admin-join') {
      const { roomId, password } = msg;
      if (password !== 'admin123') { send(ws, { type: 'error', message: 'Password salah' }); return; }
      if (!rooms[roomId]) rooms[roomId] = { admin: null, peserta: {} };
      rooms[roomId].admin = ws;
      clients.set(ws, { role: 'admin', roomId });
      console.log(`[Admin] joined room: ${roomId}`);
      const pesertaList = Object.entries(rooms[roomId].peserta).map(([kode, pws]) => {
        const info = clients.get(pws);
        return { kode, nama: info?.nama || kode };
      });
      send(ws, { type: 'admin-joined', roomId, pesertaList });
      for (const [kode, pws] of Object.entries(rooms[roomId].peserta)) {
        send(pws, { type: 'admin-online' });
      }
    }

    if (type === 'peserta-join') {
      const { roomId, nama, kode } = msg;
      if (!rooms[roomId]) rooms[roomId] = { admin: null, peserta: {} };
      rooms[roomId].peserta[kode] = ws;
      clients.set(ws, { role: 'peserta', roomId, id: kode, nama });
      console.log(`[Peserta] joined: ${nama} (${kode}) room: ${roomId}`);
      const adminOnline = !!rooms[roomId].admin;
      send(ws, { type: 'peserta-joined', kode, adminOnline });
      if (rooms[roomId].admin) send(rooms[roomId].admin, { type: 'peserta-connected', kode, nama });
    }

    if (type === 'request-offer') {
      const info = clients.get(ws);
      if (!info) return;
      const targetWs = rooms[info.roomId]?.peserta[msg.to];
      if (targetWs) { send(targetWs, { type: 'admin-online' }); console.log(`[Server] Requested offer from ${msg.to}`); }
    }

    if (type === 'webrtc-offer') {
      const info = clients.get(ws);
      if (!info) return;
      const adminWs = rooms[info.roomId]?.admin;
      if (adminWs) { send(adminWs, { type: 'webrtc-offer', offer: msg.offer, from: info.id, nama: info.nama }); console.log(`[WebRTC] Offer from ${info.id}`); }
    }

    if (type === 'webrtc-answer') {
      const info = clients.get(ws);
      if (!info) return;
      const targetWs = rooms[info.roomId]?.peserta[msg.to];
      if (targetWs) { send(targetWs, { type: 'webrtc-answer', answer: msg.answer }); }
    }

    if (type === 'ice-candidate') {
      const senderInfo = clients.get(ws);
      if (!senderInfo) return;
      if (senderInfo.role === 'peserta') {
        const adminWs = rooms[senderInfo.roomId]?.admin;
        if (adminWs) send(adminWs, { type: 'ice-candidate', candidate: msg.candidate, from: senderInfo.id });
      } else if (senderInfo.role === 'admin') {
        const targetWs = rooms[senderInfo.roomId]?.peserta[msg.to];
        if (targetWs) send(targetWs, { type: 'ice-candidate', candidate: msg.candidate });
      }
    }

    if (type === 'progress-update') {
      const info = clients.get(ws);
      if (!info) return;
      const adminWs = rooms[info.roomId]?.admin;
      if (adminWs) send(adminWs, { type: 'progress-update', kode: info.id, jawaban: msg.jawaban, progress: msg.progress });
    }

    if (type === 'event-log') {
      const info = clients.get(ws);
      if (!info) return;
      const adminWs = rooms[info.roomId]?.admin;
      if (adminWs) send(adminWs, { type: 'event-log', from: info.id, nama: info.nama, event: msg.event, level: msg.level || 'info' });
    }

    if (type === 'ping') { send(ws, { type: 'pong' }); return; }

    if (type === 'hasil-tes') {
      const info = clients.get(ws);
      if (!info) return;
      const adminWs = rooms[info.roomId]?.admin;
      if (adminWs) send(adminWs, { type: 'hasil-tes', kode: info.id, nama: info.nama, skor: msg.skor, benar: msg.benar, total: msg.total, kategori: msg.kategori });
    }
  });

  ws.on('close', () => {
    const info = clients.get(ws);
    if (!info) return;
    const { role, roomId, id, nama } = info;
    if (role === 'peserta' && rooms[roomId]) {
      delete rooms[roomId].peserta[id];
      if (rooms[roomId].admin) send(rooms[roomId].admin, { type: 'peserta-disconnected', kode: id, nama });
      console.log(`[Peserta] disconnected: ${nama}`);
    }
    if (role === 'admin' && rooms[roomId]) {
      rooms[roomId].admin = null;
      console.log(`[Admin] disconnected from room: ${roomId}`);
    }
    clients.delete(ws);
  });

  ws.on('error', (e) => console.error('WS error:', e.message));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`PsikoTest server running on port ${PORT}`));
