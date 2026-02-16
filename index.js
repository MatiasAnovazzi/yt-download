const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const archivosListos = new Map();

// Definimos la ruta de la carpeta temporal
const TEMP_DIR = path.join(__dirname, 'temp');

// --- PASO CLAVE: Crear la carpeta al iniciar el servidor ---
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    console.log(`Carpeta creada en: ${TEMP_DIR}`);
}

app.get('/status-mp3', (req, res) => {
    const videoUrl = req.query.url;
    const id = Date.now().toString();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`data: ${JSON.stringify({ estado: 'generando' })}\n\n`);

    // Ruta final del archivo
    const outputPath = path.join(TEMP_DIR, `${id}.mp3`);
    
    const process = spawn('yt-dlp', [
        '--extract-audio',
        '--audio-format', 'mp3',
        '-o', outputPath,
        videoUrl
    ]);

    process.on('close', (code) => {
        if (code === 0) {
            archivosListos.set(id, outputPath);
            res.write(`data: ${JSON.stringify({ estado: 'listo', id })}\n\n`);
        } else {
            res.write(`data: ${JSON.stringify({ estado: 'error' })}\n\n`);
        }
        res.end();
    });
});

app.get('/descargar-archivo/:id', (req, res) => {
    const ruta = archivosListos.get(req.params.id);
    if (ruta && fs.existsSync(ruta)) {
        res.download(ruta, 'audio.mp3', (err) => {
            if (!err) {
                // Borramos el archivo físico después de la descarga con éxito
                fs.unlink(ruta, (err) => {
                    if (err) console.error("Error al borrar temporal:", err);
                });
                archivosListos.delete(req.params.id);
            }
        });
    } else {
        res.status(404).send("Archivo no encontrado.");
    }
});

app.listen(3000, () => console.log('Servidor corriendo en el puerto 3000'));