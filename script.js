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
// OPCIONES ESCÁNER (CUADRADO GRANDE PARA ETIQUETAS FLEX)
// --------------------------------------------------
const html5QrConfig = {
    fps: 12,
    qrbox: {
        width: Math.min(window.innerWidth * 0.78, 380),
        height: Math.min(window.innerWidth * 0.78, 380)
    },
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
// DETECTAR TIPO (QR → FLEX / BARRAS → MOTO)
// --------------------------------------------------
function detectarTipo(codigo, esQR) {
    return esQR ? "VENTAS ML FLEX" : "VENTAS ML MOTO";
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
    preview.innerHTML = "";

    scanner = new Html5Qrcode("cameraPreview");

    try {
        const cams = await Html5Qrcode.getCameras();
        if (!cams.length) return alert("No se detectó cámara.");

        const camaraTrasera = cams[cams.length - 1].id;

        await scanner.start(
            camaraTrasera,
            html5QrConfig,
            onScanSuccess,
            onScanFailure
        );

    } catch (err) {
        console.error("Error:", err);
        alert("No se pudo activar la cámara");
    }
}


// --------------------------------------------------
// CALLBACKS SCAN
// --------------------------------------------------
async function onScanSuccess(decodedText, decodedResult) {

    if (cooldown) return;
    cooldown = true;
    setTimeout(() => (cooldown = false), 800);

    const esQR = decodedResult.result.format.formatName === "QR_CODE";

    triggerScanEffect(decodedText);

    const miniatura = await capturarMiniatura();

    let direccion = "";
    if (esQR) {
        const textoOCR = await extraerOCR(miniatura);
        direccion = parseDireccion(textoOCR);
    }

    agregarComprobante(decodedText, miniatura, direccion, esQR);
}

function onScanFailure(err) {
    // ignoramos errores menores
}


// --------------------------------------------------
// CAPTURA MINIATURA (900x900 MEJOR OCR)
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
    canvas.width = 900;
    canvas.height = 900;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, sx, sy, side, side, 0, 0, 900, 900);

    return canvas.toDataURL("image/jpeg");
}


// --------------------------------------------------
// OCR FLEX
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
        .filter(l => l.length > 4);

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
// EFECTOS (vibración, duplicados)
// --------------------------------------------------
function triggerScanEffect(codigo) {

    const cam = document.getElementById("cameraPreview");
    const duplicado = historialCodigos.includes(codigo);

    navigator.vibrate?.(duplicado ? 320 : 140);

    cam.classList.add(duplicado ? "scan-duplicado" : "scan-ok");

    if (duplicado) mostrarMensajeFlotante("DUPLICADO");

    setTimeout(() => cam.classList.remove("scan-ok", "scan-duplicado"), 450);
}

function mostrarMensajeFlotante(msg) {
    const div = document.createElement("div");
    div.className = "mensaje-duplicado";
    div.innerText = msg;
    document.body.appendChild(div);

    setTimeout(() => div.classList.add("show"), 20);
    setTimeout(() => div.remove(), 1500);
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
// RENDER LISTA
// --------------------------------------------------
function renderComprobantes() {

    const cont = document.getElementById("listaComprobantes");
    cont.innerHTML = "";

    comprobantes.forEach((c, i) => {

        const duplicadoTag = c.duplicado
            ? `<span class="duplicado-tag">DUPLICADO</span>` : "";

        const domicilioTag = c.mismoDomicilio
            ? `<span class="domicilio-tag">MISMO DOMICILIO — SE PAGA 1</span>` : "";

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

                <img src="${c.miniatura}" class="miniatura"
                     onclick="verMiniatura('${c.miniatura}')">

                <div class="info">
                    <strong>${c.numero}</strong>
                    <small>${c.tipo}</small>
                    <div class="direccion">${c.direccion || ""}</div>
                    ${duplicadoTag}
                    ${domicilioTag}
                </div>

                <button onclick="eliminarComprobante(${i})"
                        class="btn-eliminar">🗑️</button>
            </div>

            ${botones}

            <textarea id="obs_${i}"
                placeholder="Observación..."
                style="display:${c.estado === "" || c.estado === "ENTREGADO"
                    ? "none"
                    : "block"}"
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
