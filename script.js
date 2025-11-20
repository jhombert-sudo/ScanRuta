// --------------------------------------------------
// VARIABLES
// --------------------------------------------------
let comprobantes = [];
let choferNombre = "";
let fechaRuta = "";

let isScannerActive = false;
let cooldown = false;

let historialCodigos = []; // Para duplicados

let codeReader = null;
let videoElement = null;

// OCR CONFIG
const OCR_CONFIG = {
    lang: "spa",
    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -.,/#"
};


// --------------------------------------------------
// POPUP INICIAL
// --------------------------------------------------
document.getElementById("btnIniciarRuta").onclick = () => {
    const nombre = document.getElementById("inputChofer").value.trim();
    const fecha = document.getElementById("inputFecha").value;

    if (!nombre || !fecha)
        return alert("Completá nombre y fecha.");

    choferNombre = nombre;
    fechaRuta = fecha;

    document.getElementById("popupInicio").style.display = "none";
};


// --------------------------------------------------
// DETECTAR TIPO ML
// --------------------------------------------------
function detectarTipo(codigo) {
    if (codigo.length >= 10) return "VENTAS ML FLEX";
    if (codigo.length === 7 || codigo.length === 8) return "VENTAS ML MOTO";
    return "DESCONOCIDO";
}


// --------------------------------------------------
// INICIAR ESCANEO (FIX iPHONE)
// --------------------------------------------------
document.getElementById("scanBtn").onclick = iniciarScanner;

async function iniciarScanner() {

    detenerCamara();
    isScannerActive = true;

    document.getElementById("accionesEscaneo").style.display = "block";

    const cont = document.getElementById("listaComprobantes");

    // Contenedor cámara
    let camara = document.createElement("div");
    camara.id = "cameraPreview";
    camara.className = "camara-scan";

    let overlay = document.createElement("div");
    overlay.className = "scanner-frame";
    camara.appendChild(overlay);

    cont.prepend(camara);

    // VIDEO
    videoElement = document.createElement("video");
    videoElement.setAttribute("autoplay", true);
    videoElement.setAttribute("playsinline", true); // Obligatorio iPhone
    videoElement.setAttribute("muted", true);       // Obligatorio Safari
    videoElement.style.width = "100%";

    camara.appendChild(videoElement);

    // ZXING
    const { BrowserMultiFormatReader } = ZXingBrowser;
    codeReader = new BrowserMultiFormatReader();

    try {
        const devices = await ZXingBrowser.BrowserCodeReader.listVideoInputDevices();
        const camaraTrasera = devices[devices.length - 1].deviceId;

        await codeReader.decodeFromVideoDevice(
            camaraTrasera,
            videoElement,
            async (result, err) => {

                if (result) {
                    procesarDeteccion(result.text);
                }
            }
        );

    } catch (err) {
        console.error(err);
        alert("No se pudo activar la cámara.");
    }
}



// --------------------------------------------------
// PROCESAR DETECCIÓN
// --------------------------------------------------
async function procesarDeteccion(codigo) {

    if (cooldown) return;

    cooldown = true;
    setTimeout(() => cooldown = false, 800);

    triggerScanEffect(codigo);

    const frameBase64 = capturarFrame();

    const textoOCR = await extraerOCR(frameBase64);
    const direccion = parseDireccion(textoOCR);

    agregarComprobante(codigo, frameBase64, direccion);
}



// --------------------------------------------------
// CAPTURA FRAME → MINIATURA
// --------------------------------------------------
function capturarFrame() {
    if (!videoElement) return "";

    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoElement, 0, 0, 300, 300);

    return canvas.toDataURL("image/jpeg");
}



// --------------------------------------------------
// OCR DIRECCIÓN
// --------------------------------------------------
async function extraerOCR(imgBase64) {
    if (!imgBase64) return "";

    try {
        const result = await Tesseract.recognize(imgBase64, "spa", OCR_CONFIG);
        return result.data.text;
    } catch (e) {
        console.error("OCR Error:", e);
        return "";
    }
}

function parseDireccion(texto) {

    if (!texto) return "";

    let lineas = texto
        .split("\n")
        .map(t => t.trim())
        .filter(t => t.length > 3);

    const direccion = lineas.find(l => /\d/.test(l) && /[A-Za-z]/.test(l)) || "";
    const localidad = lineas.find(l =>
        l.toLowerCase().includes("buenos") ||
        l.toLowerCase().includes("bs") ||
        /\b\d{4}\b/.test(l)
    ) || "";

    return (direccion + " – " + localidad).trim();
}



// --------------------------------------------------
// EFECTOS DE ESCANEO
// --------------------------------------------------
function triggerScanEffect(codigo) {

    const cam = document.getElementById("cameraPreview");
    let duplicado = historialCodigos.includes(codigo);

    navigator.vibrate?.(duplicado ? 300 : 120);

    cam.classList.add(duplicado ? "scan-duplicado" : "scan-ok");

    if (duplicado) mostrarMensajeFlotante("DUPLICADO");

    setTimeout(() => cam.classList.remove("scan-ok", "scan-duplicado"), 500);
}

function mostrarMensajeFlotante(texto) {

    const msg = document.createElement("div");
    msg.className = "mensaje-duplicado";
    msg.innerText = texto;

    document.body.appendChild(msg);

    setTimeout(() => msg.classList.add("show"), 10);
    setTimeout(() => msg.remove(), 1600);
}



// --------------------------------------------------
// AGREGAR COMPROBANTE
// --------------------------------------------------
function agregarComprobante(codigo, miniatura, direccion) {

    const duplicado = historialCodigos.includes(codigo);
    historialCodigos.push(codigo);

    const mismoDomicilio = comprobantes.some(c => c.direccion === direccion);

    comprobantes.push({
        numero: codigo,
        tipo: detectarTipo(codigo),
        estado: "",
        observacion: "",
        duplicado,
        miniatura,
        direccion,
        mismoDomicilio
    });

    actualizarContador();
    renderComprobantes();
}



// --------------------------------------------------
// CONTADOR
// --------------------------------------------------
function actualizarContador() {
    document.getElementById("contador").innerText =
        `Escaneados: ${comprobantes.length}`;
}



// --------------------------------------------------
// RENDER LISTA
// --------------------------------------------------
function renderComprobantes() {

    const cont = document.getElementById("listaComprobantes");
    const cam = document.getElementById("cameraPreview");

    cont.innerHTML = "";

    if (cam) cont.prepend(cam);

    comprobantes.forEach((c, index) => {

        const duplicadoTag = c.duplicado ? `<span class="duplicado-tag">DUPLICADO</span>` : "";
        const domicilioTag = c.mismoDomicilio ? `<span class="domicilio-tag">MISMO DOMICILIO – SE PAGA 1</span>` : "";

        const botones = c.estado === "" ?
            `
            <div class="estado-btns">
                <button class="btn-entregado" onclick="setEstado(${index}, 'ENTREGADO')">Entregado</button>
                <button class="btn-ausente" onclick="setEstado(${index}, 'AUSENTE')">Ausente</button>
                <button class="btn-cancelado" onclick="setEstado(${index}, 'CANCELADO')">Cancelado</button>
                <button class="btn-demorado" onclick="setEstado(${index}, 'DEMORADO')">Demorado</button>
            </div>
            `
            :
            `
            <div class="estado-btns">
                <button class="btn-estado-activo">${c.estado}</button>
                <button class="btn-editar" onclick="editarEstado(${index})">Editar</button>
            </div>
            `;

        const box = document.createElement("div");
        box.className = "comprobante fadeIn";
        box.innerHTML = `
            <div class="comp-header">

                <img src="${c.miniatura}" class="miniatura" onclick="verMiniatura('${c.miniatura}')">

                <div class="info">
                    <strong>${c.numero}</strong>
                    <small>${c.tipo}</small>
                    <div class="direccion">${c.direccion || ""}</div>
                    ${duplicadoTag}
                    ${domicilioTag}
                </div>

                <button class="btn-eliminar" onclick="eliminarComprobante(${index})">🗑️</button>

            </div>

            ${botones}

            <textarea
                id="obs_${index}"
                placeholder="Observación..."
                style="display:${c.estado === 'ENTREGADO' || c.estado === '' ? 'none' : 'block'}"
            >${c.observacion}</textarea>
        `;

        cont.appendChild(box);
    });
}



// --------------------------------------------------
// MINIATURA → MODAL
// --------------------------------------------------
function verMiniatura(img) {
    document.getElementById("visorModal").style.display = "flex";
    document.getElementById("visorImg").src = img;
}

document.getElementById("cerrarVisor").onclick = () =>
    document.getElementById("visorModal").style.display = "none";



// --------------------------------------------------
// ESTADOS
// --------------------------------------------------
function setEstado(i, estado) {
    comprobantes[i].estado = estado;
    renderComprobantes();
}

function editarEstado(i) {
    comprobantes[i].estado = "";
    comprobantes[i].observacion = "";
    renderComprobantes();
}

function eliminarComprobante(i) {
    comprobantes.splice(i, 1);
    actualizarContador();
    renderComprobantes();
}



// --------------------------------------------------
// BOTONES FLUJO
// --------------------------------------------------
document.getElementById("btnFinalizarEscaneo").onclick = detenerCamara;
document.getElementById("btnAgregarMas").onclick = iniciarScanner;



// --------------------------------------------------
// DETENER CÁMARA (FIX iPHONE)
// --------------------------------------------------
function detenerCamara() {
    if (codeReader) {
        try { codeReader.reset(); } catch {}
    }

    isScannerActive = false;

    const camara = document.getElementById("cameraPreview");
    if (camara) camara.remove();
}



// --------------------------------------------------
// QR
// --------------------------------------------------
document.getElementById("generarQR").onclick = () => {
    detenerCamara();

    const json = {
        fecha: fechaRuta,
        chofer: choferNombre,
        comprobantes
    };

    document.getElementById("qr").innerHTML = "";

    new QRCode(document.getElementById("qr"), {
        text: JSON.stringify(json),
        width: 260,
        height: 260
    });

    document.getElementById("qrModal").style.display = "block";
};

document.getElementById("descargarQR").onclick = () => {
    const canvas = document.querySelector("#qr canvas");
    if (!canvas) return;

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "qr_ruta.png";
    a.click();
};

function cerrarQR() {
    document.getElementById("qrModal").style.display = "none";
    comprobantes = [];
    historialCodigos = [];
    actualizarContador();
    renderComprobantes();
}
