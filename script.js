// --------------------------------------------------
// VARIABLES
// --------------------------------------------------
let comprobantes = [];
let historialCodigos = [];
let choferNombre = "";
let fechaRuta = "";
let scanner = null;

let cooldown = false;
let isScannerActive = false;


// --------------------------------------------------
// OPCIONES ESCÁNER
// --------------------------------------------------
const html5QrConfig = {
    fps: 12,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0,
    rememberLastUsedCamera: true
};


// --------------------------------------------------
// OCR CONFIG
// --------------------------------------------------
const OCR_CONFIG = {
    lang: "spa",
    tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -.,/#"
};


// --------------------------------------------------
// POPUP INICIAL
// --------------------------------------------------
document.getElementById("btnIniciarRuta").onclick = () => {
    const nombre = document.getElementById("inputChofer").value.trim();
    const fecha = document.getElementById("inputFecha").value;

    if (!nombre || !fecha) return alert("Completá nombre y fecha.");

    choferNombre = nombre;
    fechaRuta = fecha;

    document.getElementById("popupInicio").style.display = "none";
};


// --------------------------------------------------
// DETECTAR TIPO
// --------------------------------------------------
function detectarTipo(codigo, esQR) {
    if (esQR) return "VENTAS ML FLEX";
    return "VENTAS ML MOTO";
}


// --------------------------------------------------
// INICIAR ESCÁNER
// --------------------------------------------------
document.getElementById("scanBtn").onclick = iniciarScanner;

async function iniciarScanner() {

    detenerCamara();
    isScannerActive = true;

    document.getElementById("accionesEscaneo").style.display = "block";

    const preview = document.getElementById("cameraPreview");
    preview.innerHTML = ""; // reset

    scanner = new Html5Qrcode("cameraPreview");

    try {
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras.length) {
            alert("No se detectó cámara.");
            return;
        }

        const camaraTrasera = cameras[cameras.length - 1].id;

        await scanner.start(
            camaraTrasera,
            html5QrConfig,
            onScanSuccess,
            onScanFailure
        );

    } catch (err) {
        console.error("Error al activar cámara:", err);
        alert("No se pudo activar la cámara");
    }
}


// --------------------------------------------------
// CALLBACKS DE ESCANEO
// --------------------------------------------------
async function onScanSuccess(decodedText, decodedResult) {

    if (cooldown) return;
    cooldown = true;
    setTimeout(() => cooldown = false, 700);

    const esQR = decodedResult.result.format.formatName === "QR_CODE";

    triggerScanEffect(decodedText);

    // Miniatura cuadrada
    const miniatura = await capturarMiniatura();

    // Dirección solo en QR / FLEX
    let direccion = "";
    if (esQR) {
        const textoOCR = await extraerOCR(miniatura);
        direccion = parseDireccion(textoOCR);
    }

    agregarComprobante(decodedText, miniatura, direccion, esQR);
}

function onScanFailure(error) {
    // ignorar errores pequeños
}


// --------------------------------------------------
// MINIATURA
// --------------------------------------------------
async function capturarMiniatura() {
    const video = document.querySelector("#cameraPreview video");
    if (!video) return "";

    const w = video.videoWidth;
    const h = video.videoHeight;
    const side = Math.min(w, h);

    const sx = (w - side) / 2;
    const sy = (h - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = 500;
    canvas.height = 500;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, sx, sy, side, side, 0, 0, 500, 500);

    return canvas.toDataURL("image/jpeg");
}


// --------------------------------------------------
// OCR DIRECCIÓN (FLEX)
// --------------------------------------------------
async function extraerOCR(imgBase64) {
    try {
        const result = await Tesseract.recognize(imgBase64, "spa", OCR_CONFIG);
        return result.data.text;
    } catch (err) {
        console.error("OCR error:", err);
        return "";
    }
}

function parseDireccion(texto) {
    if (!texto) return "";

    let lineas = texto
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 3);

    const direccion = lineas.find(l =>
        /\d/.test(l) && /[A-Za-z]/.test(l)
    ) || "";

    const localidad = lineas.find(l =>
        l.includes("CABA") ||
        l.includes("CAPITAL") ||
        /\b\d{4}\b/.test(l)
    ) || "";

    return (direccion + " – " + localidad).trim();
}


// --------------------------------------------------
// EFECTOS
// --------------------------------------------------
function triggerScanEffect(codigo) {
    const cam = document.getElementById("cameraPreview");

    const duplicado = historialCodigos.includes(codigo);

    navigator.vibrate?.(duplicado ? 350 : 150);

    cam.classList.add(duplicado ? "scan-duplicado" : "scan-ok");

    if (duplicado) mostrarMensajeFlotante("DUPLICADO");

    setTimeout(() => cam.classList.remove("scan-ok", "scan-duplicado"), 450);
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
function agregarComprobante(codigo, miniatura, direccion, esQR) {

    const duplicado = historialCodigos.includes(codigo);
    historialCodigos.push(codigo);

    const tipo = detectarTipo(codigo, esQR);

    const mismoDomicilio = direccion
        ? comprobantes.some(c => c.direccion === direccion)
        : false;

    comprobantes.push({
        numero: codigo,
        tipo,
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
// RENDER DE LISTA
// --------------------------------------------------
function renderComprobantes() {

    const cont = document.getElementById("listaComprobantes");

    cont.innerHTML = "";

    comprobantes.forEach((c, i) => {

        const duplicadoTag = c.duplicado
            ? `<span class="duplicado-tag">DUPLICADO</span>`
            : "";

        const domicilioTag = c.mismoDomicilio
            ? `<span class="domicilio-tag">MISMO DOMICILIO – SE PAGA 1</span>`
            : "";

        const botones = c.estado === ""
            ? `
            <div class="estado-btns">
                <button onclick="setEstado(${i}, 'ENTREGADO')" class="btn-entregado">Entregado</button>
                <button onclick="setEstado(${i}, 'AUSENTE')" class="btn-ausente">Ausente</button>
                <button onclick="setEstado(${i}, 'CANCELADO')" class="btn-cancelado">Cancelado</button>
                <button onclick="setEstado(${i}, 'DEMORADO')" class="btn-demorado">Demorado</button>
            </div>`
            : `
            <div class="estado-btns">
                <button class="btn-estado-activo">${c.estado}</button>
                <button onclick="editarEstado(${i})" class="btn-editar">Editar</button>
            </div>`;

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

                <button onclick="eliminarComprobante(${i})" class="btn-eliminar">🗑️</button>
            </div>

            ${botones}

            <textarea id="obs_${i}"
                placeholder="Observación..."
                style="display:${c.estado === "" || c.estado === "ENTREGADO" ? "none" : "block"}"
            >${c.observacion}</textarea>
        `;

        cont.appendChild(box);
    });
}


// --------------------------------------------------
// MINIATURA MODAL
// --------------------------------------------------
function verMiniatura(img) {
    document.getElementById("visorModal").style.display = "flex";
    document.getElementById("visorImg").src = img;
}

document.getElementById("cerrarVisor").onclick = () =>
    (document.getElementById("visorModal").style.display = "none");


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
// DETENER CAMARA
// --------------------------------------------------
function detenerCamara() {
    if (scanner) {
        scanner.stop().catch(() => {});
    }
    isScannerActive = false;
}


// --------------------------------------------------
// QR FINAL
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
