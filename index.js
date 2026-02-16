const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static(__dirname));

// Guardaremos solo el nombre del archivo para descargarlo luego
const archivosParaDescargar = new Map();
const TEMP_DIR = path.resolve(__dirname, 'temp');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/status-mp3', (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send("URL requerida");

    const idTransaccion = Date.now().toString();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`data: ${JSON.stringify({ estado: 'generando' })}\n\n`);

    // Usamos %(title)s para el nombre, pero --restrict-filenames para evitar errores
    // El output irá directo a la carpeta temp
    const process = spawn('yt-dlp', [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--embed-metadata',
        '--embed-thumbnail',
        '--js-runtimes', 'node',
        '--restrict-filenames', // IMPORTANTE: Cambia espacios por _ y quita caracteres raros
        '--print', 'after_move:filepath', // Nos dirá la ruta exacta final donde quedó el archivo
        '-o', path.join(TEMP_DIR, '%(title)s.%(ext)s'),
        videoUrl
    ]);

    let rutaFinalRelativa = "";

    process.stdout.on('data', (data) => {
        const output = data.toString().trim();
        // Capturamos la ruta que imprime 'after_move:filepath'
        if (output.includes(TEMP_DIR)) {
            rutaFinalRelativa = output;
        }
        console.log(`[yt-dlp]: ${output}`);
    });

    process.on('close', (code) => {
        if (code === 0 && rutaFinalRelativa) {
            const nombreArchivo = path.basename(rutaFinalRelativa);
            archivosParaDescargar.set(idTransaccion, nombreArchivo);
            
            console.log(`✅ Archivo listo: ${nombreArchivo}`);
            res.write(`data: ${JSON.stringify({ estado: 'listo', id: idTransaccion })}\n\n`);
        } else {
            res.write(`data: ${JSON.stringify({ estado: 'error' })}\n\n`);
        }
        res.end();
    });
});

app.get('/descargar-archivo/:id', (req, res) => {
    const nombreArchivo = archivosParaDescargar.get(req.params.id);
    const rutaCompleta = path.join(TEMP_DIR, nombreArchivo || '');

    if (nombreArchivo && fs.existsSync(rutaCompleta)) {
        res.download(rutaCompleta, nombreArchivo, (err) => {
            if (!err) {
                fs.unlinkSync(rutaCompleta);
                archivosParaDescargar.delete(req.params.id);
            }
        });
    } else {
        res.status(404).send("Archivo no encontrado.");
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor en http://localhost:${PORT}`);
});