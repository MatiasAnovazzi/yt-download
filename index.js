const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
// Railway asigna el puerto automáticamente en process.env.PORT
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(__dirname));

const archivosParaDescargar = new Map();
const TEMP_DIR = path.resolve(__dirname, 'temp');
const COOKIES_PATH = path.join(__dirname, 'cookies.txt');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Función para preparar las cookies antes de cada descarga
const prepararCookies = () => {
    if (process.env.COOKIES_CONTENT) {
        fs.writeFileSync(COOKIES_PATH, process.env.COOKIES_CONTENT);
        console.log("🍪 Cookies actualizadas desde variable de entorno.");
    } else {
        console.log("⚠️ No se encontró la variable COOKIES_CONTENT.");
    }
};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/status-mp3', (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send("URL requerida");

    prepararCookies(); // Escribimos el archivo antes de llamar a yt-dlp

    const idTransaccion = Date.now().toString();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`data: ${JSON.stringify({ estado: 'generando' })}\n\n`);

    const args = [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--cookies', COOKIES_PATH, // <--- Usamos el archivo generado
        '--js-runtimes', 'deno',   // O 'deno' si actualizaste el Dockerfile
        '--no-cache-dir',

        '--embed-metadata',
        '--embed-thumbnail',
        '--restrict-filenames',
        '--newline',
        '--progress',
        '--print', 'after_move:filepath',
        '-o', path.join(TEMP_DIR, '%(title)s.%(ext)s'),
        videoUrl
    ];

    const processSpawn = spawn('yt-dlp', args);

    let rutaFinalAbsoluta = "";

    processSpawn.stdout.on('data', (data) => {
        const lineas = data.toString().split('\n');
        lineas.forEach(linea => {
            const l = linea.trim();
            if (!l) return;
            if (l.includes(TEMP_DIR)) rutaFinalAbsoluta = l;
            if (l.includes("[download]")) res.write(`data: ${JSON.stringify({ estado: l })}\n\n`);
            console.log(`[yt-dlp]: ${l}`);
        });
    });

    processSpawn.stderr.on('data', (data) => {
        console.error(`[yt-dlp Error]: ${data.toString().trim()}`);
    });

    processSpawn.on('close', (code) => {
        setTimeout(() => {
            if (code === 0 && rutaFinalAbsoluta && fs.existsSync(rutaFinalAbsoluta)) {
                const nombreArchivo = path.basename(rutaFinalAbsoluta);
                archivosParaDescargar.set(idTransaccion, nombreArchivo);
                console.log(`✅ Listo: ${nombreArchivo}`);
                res.write(`data: ${JSON.stringify({ estado: 'listo', id: idTransaccion })}\n\n`);
            } else {
                res.write(`data: ${JSON.stringify({ estado: 'error' })}\n\n`);
            }
            res.end();
        }, 1500);
    });
});

app.get('/descargar-archivo/:id', (req, res) => {
    console.log(archivosParaDescargar)
    const nombreArchivo = archivosParaDescargar.get(req.params.id);
    const rutaCompleta = path.join(TEMP_DIR, nombreArchivo || '');

    if (nombreArchivo && fs.existsSync(rutaCompleta)) {
        res.download(rutaCompleta, nombreArchivo, (err) => {
            if (!err) {
                try {
                    fs.unlinkSync(rutaCompleta);
                    archivosParaDescargar.delete(req.params.id);
                } catch(e) { console.error("Error borrando:", e); }
            }
        });
    } else {
        res.status(404).send("Archivo no encontrado.");
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor en puerto ${PORT}`);
});