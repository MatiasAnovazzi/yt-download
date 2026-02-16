const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;

// --- CONFIGURACIÓN ---
app.use(cors());
// Servir archivos estáticos (esto permite que Express encuentre tu index.html)
app.use(express.static(__dirname));

const archivosListos = new Map();
const TEMP_DIR = path.join(__dirname, 'temp');

// Crear carpeta temporal si no existe
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    console.log('📁 Carpeta "temp" lista.');
}

// --- RUTA PRINCIPAL: Servir el HTML ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- RUTA DE ESTADO (SSE) ---
app.get('/status-mp3', (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send("URL requerida");

    const id = Date.now().toString();
    const outputPath = path.join(TEMP_DIR, `${id}.mp3`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    console.log(`\n🚀 Procesando: ${videoUrl}`);
    res.write(`data: ${JSON.stringify({ estado: 'generando' })}\n\n`);

    // Ejecución de yt-dlp con mejoras de estabilidad
    const process = spawn('yt-dlp', [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--js-runtimes', 'node', // Fix para el error de JS Runtime
        '--no-cache-dir',
        '-o', outputPath,
        videoUrl
    ]);

    process.stdout.on('data', (data) => {
        const linea = data.toString().trim();
        if (linea.includes('[download]')) {
            console.log(`[Progreso]: ${linea}`);
        } else {
            console.log(`[yt-dlp]: ${linea}`);
        }
    });

    process.stderr.on('data', (data) => {
        console.error(`[yt-dlp Error]: ${data.toString()}`);
    });

    process.on('close', (code) => {
        if (code === 0) {
            archivosListos.set(id, outputPath);
            console.log(`✅ Archivo generado: ${id}.mp3`);
            res.write(`data: ${JSON.stringify({ estado: 'listo', id })}\n\n`);
        } else {
            console.error(`❌ El proceso falló con código ${code}`);
            res.write(`data: ${JSON.stringify({ estado: 'error' })}\n\n`);
        }
        res.end();
    });
});

// --- RUTA DE DESCARGA ---
app.get('/descargar-archivo/:id', (req, res) => {
    const ruta = archivosListos.get(req.params.id);
    if (ruta && fs.existsSync(ruta)) {
        res.download(ruta, 'musica.mp3', (err) => {
            if (!err) {
                fs.unlinkSync(ruta); // Borrar tras descarga exitosa
                archivosListos.delete(req.params.id);
                console.log(`🗑️ Temporal ${req.params.id} eliminado.`);
            }
        });
    } else {
        res.status(404).send("Archivo no encontrado.");
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('=========================================');
    console.log(`🔥 SERVIDOR LISTO EN: http://localhost:${PORT}`);
    console.log('=========================================');
    console.log('NOTA: No uses Live Server. Entra directamente a la URL de arriba.');
});