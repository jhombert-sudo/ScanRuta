// --------------------------------------------------
// VARIABLES GLOBALES
// --------------------------------------------------
let comprobantes = [];
let choferNombre = "";
let fechaRuta = "";

// Anti-duplicado
let codigosEscaneados = new Set();

// BarcodeDetector disponible?
const barcodeSupported = ('BarcodeDetector' in window);

// --------------------------------------------------
// POPUP INICIAL
// --------------------------------------------------
document.getElementById("btnIniciarRuta").onclick = () => {
    const nombre = document.getElementById("inputChofer").value.trim();
    const fecha = document.getElementById("inputFecha").value;

    if (!nombre || !fecha) {
        alert("Completá nombre y fecha para comenzar.");
        return;
    }

    choferNombre = nombre;
    fechaRuta = fecha;

    document.getElementById("popupInicio").style.display = "none";
};

// --------------------------------------------------
// CLASIFICACIÓN AUTOMÁTICA (ESTILO MERCADO LIBRE)
// --------------------------------------------------
function detectarTipo(codigo) {
    if (codigo.length >= 10) return "VENTAS ML FLEX";
    if (codigo.length === 7 || codigo.length === 8) return "VENTAS ML MOTO"; 
    return "DESCONOCIDO";
}

// --------------------------------------------------
// ESCANEO CONTINUO
// --------------------------------------------------
let videoStream;
let scanning = false;

document.getElementById("scanBtn").onclick = iniciarScanner;

async function iniciarScanner() {

    if (!barcodeSupported) {
        alert("Tu navegador no soporta BarcodeDetector. Probá con Chrome o Android.");
        return;
    }

    scanning = true;

    const video = document.createElement("video");
    video.setAttribute("autoplay", true);
    video.setAttribute("muted", true);
    video.setAttribute("playsinline", true);
    video.style.width = "100%";

    document.getElementById("listaComprobantes").prepend(video);

    videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
    });

    video.srcObject = videoStream;

    const detector = new BarcodeDetector({ formats: ['code_128', 'ean_13', 'ean_8', 'code_39'] });

    // Loop continuo
    async function scanLoop() {
        if (!scanning) return;

        try {
            const barcodes = await detector.detect(video);

            for (const barcode of barcodes) {
                const codigo = barcode.rawValue.trim();

                // Anti duplicados
                if (!codigosEscaneados.has(codigo)) {
                    codigosEscaneados.add(codigo);
                    agregarComprobante(codigo);

                    // beep
                    const audio = new Audio(
                        "https://actions.google.com/sounds/v1/cartoon/pop.ogg"
                    );
                    audio.volume = 0.3;
                    audio.play();
                }
            }
        } catch (e) {
            console.log("Error detectando:", e);
        }

        requestAnimationFrame(scanLoop);
    }

    scanLoop();
}

// --------------------------------------------------
// AGREGAR COMPROBANTE AUTOMÁTICAMENTE
// --------------------------------------------------
function agregarComprobante(codigo) {

    const tipo = detectarTipo(codigo);

    comprobantes.push({
        numero: codigo,
        tipo: tipo,
        estado: "",
        observacion: ""
    });

    renderComprobantes();
}

// --------------------------------------------------
// RENDER LISTADO
// --------------------------------------------------
function renderComprobantes() {
    const cont = document.getElementById("listaComprobantes");

    // Borramos todos los elementos EXCEPTO el video (si existe)
    const children = Array.from(cont.children).filter(el => el.tagName !== "VIDEO");
    children.forEach(el => el.remove());

    comprobantes.forEach((c, index) => {
        const div = document.createElement("div");
        div.className = "comprobante";

        div.innerHTML = `
            <strong>Comprobante:</strong> ${c.numero}<br>
            <strong>Tipo:</strong> ${c.tipo}
            <div class="estado-btns">
                <button onclick="setEstado(${index}, 'ENTREGADO')">ENTREGADO</button>
                <button onclick="setEstado(${index}, 'AUSENTE')">AUSENTE</button>
                <button onclick="setEstado(${index}, 'CANCELADO')">CANCELADO</button>
                <button onclick="setEstado(${index}, 'DEMORADO')">DEMORADO</button>
            </div>
            <textarea id="obs_${index}" placeholder="Observación..."></textarea>
        `;

        cont.appendChild(div);
    });
}

// --------------------------------------------------
// SETEAR ESTADO
// --------------------------------------------------
function setEstado(i, estado) {
    comprobantes[i].estado = estado;

    const obs = document.getElementById(`obs_${i}`);
    obs.style.display = estado === "ENTREGADO" ? "none" : "block";

    obs.oninput = () => comprobantes[i].observacion = obs.value;

    renderComprobantes();
}

// --------------------------------------------------
// GENERAR QR
// --------------------------------------------------
document.getElementById("generarQR").onclick = () => {

    scanning = false;
    if (videoStream) {
        videoStream.getTracks().forEach(t => t.stop());
    }

    const json = {
        fecha: fechaRuta,
        chofer: choferNombre,
        comprobantes
    };

    const textoQR = JSON.stringify(json);

    document.getElementById("qr").innerHTML = "";
    new QRCode(document.getElementById("qr"), {
        text: textoQR,
        width: 256,
        height: 256
    });

    document.getElementById("qrModal").style.display = "block";
};

// --------------------------------------------------
// DESCARGAR QR
// --------------------------------------------------
document.getElementById("descargarQR").onclick = () => {
    const canvas = document.querySelector("#qr canvas");
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr_ruta.png";
    a.click();
};

// --------------------------------------------------
// CERRAR MODAL Y LIMPIAR DATOS
// --------------------------------------------------
function cerrarQR() {

    document.getElementById("qrModal").style.display = "none";

    // Limpiar todo para nueva ruta
    comprobantes = [];
    codigosEscaneados.clear();

    renderComprobantes();

    // Reiniciar todo menos datos del chofer
}
