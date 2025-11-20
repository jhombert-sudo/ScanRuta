// --------------------------------------------------
// VARIABLES
// --------------------------------------------------
let comprobantes = [];
let choferNombre = "";
let fechaRuta = "";

let isScannerActive = false;
let cooldown = false;

let historialCodigos = []; // Para duplicados

// OCR CONFIG (solo dirección + localidad)
const OCR_CONFIG = {
    lang: "spa",
    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -.,"
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
// DETECTAR TIPO FLEX/MOTO
// --------------------------------------------------
function detectarTipo(codigo) {
    if (codigo.length >= 10) return "VENTAS ML FLEX";
    if (codigo.length === 7 || codigo.length === 8) return "VENTAS ML MOTO";
    return "DESCONOCIDO";
}

// --------------------------------------------------
// ESCANEO CONTINUO
// --------------------------------------------------
document.getElementById("scanBtn").onclick = iniciarScanner;

function iniciarScanner() {
    detenerCamara();

    isScannerActive = true;

    document.getElementById("accionesEscaneo").style.display = "block";

    const cont = document.getElementById("listaComprobantes");
    let camara = document.createElement("div");
    camara.id = "cameraPreview";
    camara.className = "camara-scan";

    let overlay = document.createElement("div");
    overlay.className = "scanner-frame";
    camara.appendChild(overlay);

    cont.prepend(camara);

    Quagga.init({
        inputStream: { type: "LiveStream", constraints: { facingMode: "environment" }, target: camara },
        decoder: { readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader"] },
        locate: true
    }, err => {
        if (err) return alert("Error iniciando cámara");
        Quagga.start();
    });

    Quagga.onDetected(async data => {
        if (!data?.codeResult) return;
        if (cooldown) return;

        cooldown = true;
        setTimeout(() => cooldown = false, 900);

        const codigo = data.codeResult.code.trim();
        triggerScanEffect(codigo);

        const frameBase64 = capturarFrame();

        const textoOCR = await extraerOCR(frameBase64);
        const direccion = parseDireccion(textoOCR);

        agregarComprobante(codigo, frameBase64, direccion);
    });
}

// --------------------------------------------------
// CAPTURAR MINIATURA DEL VIDEO
// --------------------------------------------------
function capturarFrame() {
    const video = document.querySelector("#cameraPreview video");
    if (!video) return "";

    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, 200, 200);

    return canvas.toDataURL("image/jpeg");
}

// --------------------------------------------------
// OCR DIRECCIÓN + LOCALIDAD
// --------------------------------------------------
async function extraerOCR(imgBase64) {
    try {
        const result = await Tesseract.recognize(imgBase64, "spa", OCR_CONFIG);
        return result.data.text;
    } catch (e) {
        return "";
    }
}

// Limpieza básica de OCR
function parseDireccion(texto) {
    if (!texto) return "";

    const lineas = texto.split("\n").map(t => t.trim()).filter(t => t.length > 3);

    // Buscar línea con números + letras (dirección)
    let direccion = lineas.find(l => /\d/.test(l) && /[A-Za-z]/.test(l)) || "";
    let localidad = lineas.find(l => l.toLowerCase().includes("bs as") || l.length > 6) || "";

    return (direccion + " – " + localidad).trim();
}

// --------------------------------------------------
// EFECTOS VISUALES
// --------------------------------------------------
function triggerScanEffect(codigo) {
    const cam = document.getElementById("cameraPreview");
    const esDuplicado = historialCodigos.includes(codigo);

    navigator.vibrate?.(esDuplicado ? 350 : 120);

    cam.classList.add(esDuplicado ? "scan-duplicado" : "scan-ok");

    if (esDuplicado) mostrarMensajeFlotante("DUPLICADO");

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

    let mismoDomicilio = false;
    if (direccion) {
        mismoDomicilio = comprobantes.some(c => c.direccion === direccion);
    }

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
    const camara = document.getElementById("cameraPreview");

    cont.innerHTML = "";
    if (camara) cont.prepend(camara);

    comprobantes.forEach((c, index) => {
        const box = document.createElement("div");
        box.className = "comprobante fadeIn";

        const duplicadoTag = c.duplicado ? `<span class="duplicado-tag">DUPLICADO</span>` : "";
        const domicilioTag = c.mismoDomicilio ? `<span class="domicilio-tag">MISMO DOMICILIO – SE PAGA 1</span>` : "";

        const botones = c.estado === "" ? `
            <div class="estado-btns">
                <button class="btn-entregado" onclick="setEstado(${index}, 'ENTREGADO')">Entregado</button>
                <button class="btn-ausente" onclick="setEstado(${index}, 'AUSENTE')">Ausente</button>
                <button class="btn-cancelado" onclick="setEstado(${index}, 'CANCELADO')">Cancelado</button>
                <button class="btn-demorado" onclick="setEstado(${index}, 'DEMORADO')">Demorado</button>
            </div>` :
            `<div class="estado-btns">
                <button class="btn-estado-activo">${c.estado}</button>
                <button class="btn-editar" onclick="editarEstado(${index})">Editar</button>
            </div>`;

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

document.getElementById("cerrarVisor").onclick = () => {
    document.getElementById("visorModal").style.display = "none";
};

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
// FLUJO
// --------------------------------------------------
document.getElementById("btnFinalizarEscaneo").onclick = detenerCamara;
document.getElementById("btnAgregarMas").onclick = iniciarScanner;

// --------------------------------------------------
// DETENER CAMARA
// --------------------------------------------------
function detenerCamara() {
    if (isScannerActive) {
        Quagga.stop();
        isScannerActive = false;
    }
    const cam = document.getElementById("cameraPreview");
    if (cam) cam.remove();
}

// --------------------------------------------------
// GENERAR QR
// --------------------------------------------------
document.getElementById("generarQR").onclick = () => {
    detenerCamara();

    const json = { fecha: fechaRuta, chofer: choferNombre, comprobantes };

    document.getElementById("qr").innerHTML = "";
    new QRCode(document.getElementById("qr"), {
        text: JSON.stringify(json),
        width: 260,
        height: 260
    });

    document.getElementById("qrModal").style.display = "block";
};

// --------------------------------------------------
// DESCARGAR QR
// --------------------------------------------------
document.getElementById("descargarQR").onclick = () => {
    const canvas = document.querySelector("#qr canvas");
    if (!canvas) return;

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "qr_ruta.png";
    a.click();
};

// --------------------------------------------------
// CERRAR MODAL
// --------------------------------------------------
function cerrarQR() {
    document.getElementById("qrModal").style.display = "none";
    comprobantes = [];
    historialCodigos = [];
    actualizarContador();
    renderComprobantes();
}
