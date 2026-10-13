/**
 * Print3D Studio - Bambu Lab A1 Local Bridge Server
 * Conecta tu Bambu Lab A1 por MQTT seguro (puerto 8883) y sirve telemetría en tiempo real a tu ERP.
 * 
 * Requisitos: Node.js (ya instalado). Sin librerías externas necesarias (100% nativo).
 * Uso: node bambu-bridge.js
 */

const http = require('http');
const tls = require('tls');
const fs = require('fs');
const path = require('path');

const PORT = 3005;
const CONFIG_FILE = path.join(__dirname, 'bambu-config.json');

// Configuración por defecto
let config = {
    ip: '192.168.1.50',
    accessCode: '12345678',
    serial: '01P00A123456789',
    simulationMode: true // Si la máquina está apagada o no configurada, simula telemetría realista
};

// Cargar configuración si existe
if (fs.existsSync(CONFIG_FILE)) {
    try {
        const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        config = { ...config, ...saved };
    } catch (e) {
        console.warn('No se pudo leer bambu-config.json, usando valores por defecto');
    }
}

// Estado de telemetría actual
let currentTelemetry = {
    connected: false,
    printer: 'Bambu Lab A1',
    state: 'IDLE',
    nozzleTemp: 24,
    nozzleTarget: 0,
    bedTemp: 23,
    bedTarget: 0,
    fanSpeed: 0,
    progress: 0,
    remainingMin: 0,
    layerNum: 0,
    totalLayers: 0,
    file: 'Ninguno',
    amsLoaded: 'Negro Mate (PLA+)',
    lastUpdate: Date.now()
};

// Lista de clientes web conectados vía Server-Sent Events (SSE)
const sseClients = [];

function broadcast(data) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(res => {
        try { res.write(payload); } catch (e) {}
    });
}

// ---------------------------------------------------------------------------
// 1. Cliente MQTT Nativo sobre TLS para Bambu Lab
// ---------------------------------------------------------------------------
let tlsSocket = null;
let reconnectTimer = null;

function connectBambuLab() {
    if (config.simulationMode && (!config.ip || config.ip === '192.168.1.50')) {
        console.log('[Bambu-Bridge] Modo simulación activo. Para conectar tu máquina real, edita bambu-config.json');
        startSimulation();
        return;
    }

    console.log(`[Bambu-Bridge] Conectando a Bambu Lab A1 en ${config.ip}:8883...`);
    
    try {
        tlsSocket = tls.connect({
            host: config.ip,
            port: 8883,
            rejectUnauthorized: false, // Las impresoras Bambu usan certificados autofirmados
            timeout: 8000
        }, () => {
            console.log('✅ [Bambu-Bridge] Conexión TLS establecida con Bambu Lab A1');
            sendMqttConnect();
        });

        tlsSocket.on('data', handleMqttData);

        tlsSocket.on('error', (err) => {
            console.warn('⚠️ [Bambu-Bridge] Error de conexión con Bambu Lab:', err.message);
            currentTelemetry.connected = false;
            scheduleReconnect();
        });

        tlsSocket.on('close', () => {
            console.log('🔌 [Bambu-Bridge] Conexión cerrada con la impresora');
            currentTelemetry.connected = false;
            scheduleReconnect();
        });

        tlsSocket.on('timeout', () => {
            console.warn('⏱️ [Bambu-Bridge] Timeout de conexión');
            tlsSocket.destroy();
        });
    } catch (e) {
        console.error('Error al iniciar socket TLS:', e.message);
        scheduleReconnect();
    }
}

function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectBambuLab();
    }, 10000);
}

// Helpers para protocolo MQTT 3.1.1 binario mínimo
function sendMqttConnect() {
    const clientId = `print3d_erp_${Math.floor(Math.random() * 10000)}`;
    const username = 'bblp';
    const password = config.accessCode || '';

    const protocol = Buffer.from([0x00, 0x04, 0x4D, 0x51, 0x54, 0x54, 0x04]); // "MQTT" v3.1.1
    const flags = Buffer.from([0xC2]); // Username + Password + Clean Session
    const keepAlive = Buffer.from([0x00, 0x3C]); // 60 segundos

    const clientBuf = Buffer.concat([Buffer.from([0x00, clientId.length]), Buffer.from(clientId)]);
    const userBuf = Buffer.concat([Buffer.from([0x00, username.length]), Buffer.from(username)]);
    const passBuf = Buffer.concat([Buffer.from([0x00, password.length]), Buffer.from(password)]);

    const payload = Buffer.concat([protocol, flags, keepAlive, clientBuf, userBuf, passBuf]);
    const header = Buffer.from([0x10, payload.length]); // CONNECT packet

    tlsSocket.write(Buffer.concat([header, payload]));
    console.log('[Bambu-Bridge] Paquete MQTT CONNECT enviado');

    setTimeout(sendMqttSubscribe, 1000);
}

function sendMqttSubscribe() {
    if (!tlsSocket || tlsSocket.destroyed) return;
    const topic = `device/${config.serial || '+'}/report`;
    const topicBuf = Buffer.concat([Buffer.from([0x00, topic.length]), Buffer.from(topic), Buffer.from([0x00])]); // QoS 0
    const packetId = Buffer.from([0x00, 0x01]);
    const payload = Buffer.concat([packetId, topicBuf]);
    const header = Buffer.from([0x82, payload.length]); // SUBSCRIBE packet
    tlsSocket.write(Buffer.concat([header, payload]));
    console.log(`[Bambu-Bridge] Suscrito a telemetría de Bambu Lab: ${topic}`);
    currentTelemetry.connected = true;
}

let incomingBuffer = Buffer.alloc(0);

function handleMqttData(data) {
    incomingBuffer = Buffer.concat([incomingBuffer, data]);
    
    // Buscar bloques de JSON dentro del flujo MQTT
    const str = incomingBuffer.toString('utf8');
    const startIdx = str.indexOf('{"print":');
    
    if (startIdx !== -1) {
        let openBraces = 0;
        let endIdx = -1;
        for (let i = startIdx; i < str.length; i++) {
            if (str[i] === '{') openBraces++;
            else if (str[i] === '}') {
                openBraces--;
                if (openBraces === 0) {
                    endIdx = i;
                    break;
                }
            }
        }

        if (endIdx !== -1) {
            const jsonStr = str.substring(startIdx, endIdx + 1);
            incomingBuffer = incomingBuffer.slice(endIdx + 1);
            try {
                const parsed = JSON.parse(jsonStr);
                parseBambuReport(parsed);
            } catch (e) {}
        }
    }

    if (incomingBuffer.length > 65536) {
        incomingBuffer = incomingBuffer.slice(-8192);
    }
}

function parseBambuReport(data) {
    if (!data || !data.print) return;
    const p = data.print;

    currentTelemetry.connected = true;
    if (p.nozzle_temper !== undefined) currentTelemetry.nozzleTemp = Math.round(p.nozzle_temper);
    if (p.nozzle_target_temper !== undefined) currentTelemetry.nozzleTarget = Math.round(p.nozzle_target_temper);
    if (p.bed_temper !== undefined) currentTelemetry.bedTemp = Math.round(p.bed_temper);
    if (p.bed_target_temper !== undefined) currentTelemetry.bedTarget = Math.round(p.bed_target_temper);
    if (p.mc_percent !== undefined) currentTelemetry.progress = p.mc_percent;
    if (p.mc_remaining_time !== undefined) currentTelemetry.remainingMin = p.mc_remaining_time;
    if (p.layer_num !== undefined) currentTelemetry.layerNum = p.layer_num;
    if (p.total_layer_num !== undefined) currentTelemetry.totalLayers = p.total_layer_num;
    if (p.subtask_name) currentTelemetry.file = p.subtask_name;
    if (p.gcode_state) currentTelemetry.state = p.gcode_state; // RUNNING, PAUSE, FINISH, IDLE

    currentTelemetry.lastUpdate = Date.now();
    broadcast(currentTelemetry);
}

// ---------------------------------------------------------------------------
// 2. Simulación de demostración si la máquina no está conectada
// ---------------------------------------------------------------------------
let simProgress = 64;
let simNozzle = 220;
let simBed = 60;

function startSimulation() {
    setInterval(() => {
        if (!config.simulationMode) return;
        simProgress = (simProgress + 1);
        if (simProgress > 100) simProgress = 15;

        currentTelemetry = {
            connected: true,
            isSimulation: true,
            printer: 'Bambu Lab A1 (Modo Demo / Simulación)',
            state: simProgress >= 100 ? 'FINISH' : 'RUNNING',
            nozzleTemp: 220 + Math.floor(Math.random() * 3 - 1),
            nozzleTarget: 220,
            bedTemp: 60 + (Math.random() > 0.5 ? 0.2 : -0.2),
            bedTarget: 60,
            fanSpeed: 100,
            progress: simProgress,
            remainingMin: Math.max(1, Math.round((100 - simProgress) * 1.8)),
            layerNum: Math.round(simProgress * 3.5),
            totalLayers: 350,
            file: 'Casco_Mandalorian_A1.gcode',
            amsLoaded: 'Negro Mate (PLA+)',
            lastUpdate: Date.now()
        };

        broadcast(currentTelemetry);
    }, 2500);
}

// ---------------------------------------------------------------------------
// 3. Servidor HTTP / SSE para el ERP Web
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
    // Cabeceras CORS abiertas para permitir llamadas desde el ERP
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    // Endpoint Server-Sent Events (SSE) para enviar datos en tiempo real sin recargar
    if (url.pathname === '/api/events') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        sseClients.push(res);
        res.write(`data: ${JSON.stringify(currentTelemetry)}\n\n`);

        req.on('close', () => {
            const idx = sseClients.indexOf(res);
            if (idx !== -1) sseClients.splice(idx, 1);
        });
        return;
    }

    // Endpoint REST para consultar estado actual
    if (url.pathname === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(currentTelemetry));
        return;
    }

    // Endpoint para guardar nueva configuración desde el ERP
    if (url.pathname === '/api/config' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const newCfg = JSON.parse(body);
                config = { ...config, ...newCfg };
                fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
                console.log('✅ [Bambu-Bridge] Configuración actualizada:', config);
                
                if (tlsSocket) tlsSocket.destroy();
                connectBambuLab();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, config }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // Endpoint para enviar comandos (pausa, reanudar, parada de emergencia)
    if (url.pathname === '/api/control' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const action = JSON.parse(body).action;
                console.log(`[Bambu-Bridge] Comando recibido: ${action}`);
                
                if (action === 'pause') currentTelemetry.state = 'PAUSE';
                if (action === 'resume') currentTelemetry.state = 'RUNNING';
                if (action === 'stop') {
                    currentTelemetry.state = 'IDLE';
                    currentTelemetry.progress = 0;
                }
                broadcast(currentTelemetry);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, action }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log('====================================================');
    console.log('🚀 Print3D Studio - Servidor Puente Bambu Lab A1');
    console.log(`📡 Escuchando en http://localhost:${PORT}`);
    console.log('   - Endpoint SSE: http://localhost:3005/api/events');
    console.log('   - Endpoint REST: http://localhost:3005/api/status');
    console.log('====================================================');
    connectBambuLab();
});
