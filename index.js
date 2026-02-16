const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.static(__dirname));

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

    // Usamos --newline y --progress para forzar la salida de logs
    const process = spawn('yt-dlp', [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--embed-metadata',
        '--embed-thumbnail',
        '--js-runtimes', 'node',
        '--restrict-filenames',
        '--newline',              // Fuerza logs línea por línea
        '--progress',             // Obliga a mostrar el progreso aunque haya --print
        '--print', 'after_move:filepath',
        '-o', path.join(TEMP_DIR, '%(title)s.%(ext)s'),
        videoUrl
    ]);

    let rutaFinalAbsoluta = "";

    process.stdout.on('data', (data) => {
        const lineas = data.toString().split('\n');
        
        lineas.forEach(linea => {
            const l = linea.trim();
            if (!l) return;

            // Si la línea contiene la ruta a la carpeta temp, es nuestra ruta final
            if (l.includes(TEMP_DIR)) {
                rutaFinalAbsoluta = l;
            }

            // VOLVEMOS A MOSTRAR LOS LOGS
            console.log(`[yt-dlp]: ${l}`);
        });
    });

    process.stderr.on('data', (data) => {
        console.error(`[yt-dlp Error]: ${data.toString().trim()}`);
    });

    process.on('close', (code) => {
        // Un pequeño delay para que el sistema de archivos termine de procesar
        setTimeout(() => {
            if (code === 0 && rutaFinalAbsoluta && fs.existsSync(rutaFinalAbsoluta)) {
                const nombreArchivo = path.basename(rutaFinalAbsoluta);
                archivosParaDescargar.set(idTransaccion, nombreArchivo);
                
                console.log(`✅ Proceso completado. Archivo: ${nombreArchivo}`);
                res.write(`data: ${JSON.stringify({ estado: 'listo', id: idTransaccion })}\n\n`);
            } else {
                console.error(`❌ Error: Código ${code}. ¿Ruta encontrada?: ${!!rutaFinalAbsoluta}`);
                res.write(`data: ${JSON.stringify({ estado: 'error' })}\n\n`);
            }
            res.end();
        }, 1000);
    });
});

app.get('/descargar-archivo/:id', (req, res) => {
    const nombreArchivo = archivosParaDescargar.get(req.params.id);
    const rutaCompleta = path.join(TEMP_DIR, nombreArchivo || '');

    if (nombreArchivo && fs.existsSync(rutaCompleta)) {
        res.download(rutaCompleta, nombreArchivo, (err) => {
            if (!err) {
                try {
                    fs.unlinkSync(rutaCompleta);
                    archivosParaDescargar.delete(req.params.id);
                    console.log(`🗑️ Limpieza exitosa: ${nombreArchivo}`);
                } catch(e) { console.error("Error al borrar:", e); }
            }
        });
    } else {
        res.status(404).send("Archivo no encontrado.");
    }
});

// Cambia esto en tu index.js
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor online en puerto ${PORT}`);
});