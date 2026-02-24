const progress = document.querySelector('.wave-progress');
const btn = document.getElementById('btnDescargar');
const statusText = document.getElementById('status');

function setWaveProgress(value) {
  value = Math.max(0, Math.min(100, value));
  progress.dataset.progress = value;

  progress.querySelectorAll('.wave').forEach(wave => {
    wave.style.top = `${100 - value}%`;
  });

  progress.querySelector('.percentage').textContent = value + '%';
}

btn.addEventListener('click', iniciarDescarga);

async function iniciarDescarga() {

  const url = document.getElementById('videoUrl').value.trim();
  if (!url) {
    alert("Por favor, pega una URL válida de YouTube.");
    return;
  }

  btn.disabled = true;
  statusText.innerText = "Enviando solicitud...";
  setWaveProgress(10);

  try {

    // 1️⃣ Crear job
    const response = await fetch(`/status-mp3?url=${encodeURIComponent(url)}`);
    const data = await response.json();

    const jobId = data.jobId;

    statusText.innerText = "En cola...";
    setWaveProgress(25);

    // 2️⃣ Polling cada 2 segundos
    const interval = setInterval(async () => {

      const statusRes = await fetch(`/job-status/${jobId}`);
      const statusData = await statusRes.json();

      if (statusData.state === "waiting") {
        statusText.innerText = "Esperando turno...";
      }

      if (statusData.state === "active") {
        statusText.innerText = "Procesando audio...";
        setWaveProgress(60);
      }

      if (statusData.state === "completed") {
        clearInterval(interval);
        setWaveProgress(100);
        statusText.innerText = "¡Listo! Descargando...";
        window.location.href = `/descargar-archivo/${jobId}`;
        resetUI();
      }

      if (statusData.state === "failed") {
        clearInterval(interval);
        statusText.innerText = "Error procesando el video.";
        resetUI();
      }

    }, 2000);

  } catch (err) {
    statusText.innerText = "Error de conexión.";
    resetUI();
  }
}

function resetUI() {
  btn.disabled = false;
}