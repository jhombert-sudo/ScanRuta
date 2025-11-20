// --------------------------------------------------
// VARIABLES GLOBALES
// --------------------------------------------------
let comprobantes = [];
let choferNombre = "";
let fechaRuta = "";

let isScannerActive = false;
let cooldown = false;

// Duplicados
let historialCodigos = [];



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
// CLASIFICACIÓN AUTOMÁTICA (TIPO ML)
// --------------------------------------------------
function detectarTipo(codigo) {
    if (codigo.length >= 10) return "VENTAS ML FLEX";
    if (codigo.length === 7 || codigo.length === 8) return "VENTAS ML MOTO";
    return "DESCONOCIDO";
}



// --------------------------------------------------
// BOTÓN PRINCIPAL PARA INICIAR ESCANEO
// --------------------------------------------------
document.getElementById("scanBtn").onclick = iniciarScanner;


function iniciarScanner() {

    detenerCamara(); // por si había otra activa

    isScannerActive = true;

    // MOSTRAR BOTONES DEL FLUJO A
    document.getElementById("accionesEscaneo").style.display = "block";

    const cont = document.getElementById("listaComprobantes");

    // Crear contenedor de cámara
    let camara = document.createElement("div");
    camara.id = "cameraPreview";
    camara.className = "camara-scan";

    // Crear rectángulo guía
    let overlay = document.createElement("div");
    overlay.className = "scanner-frame";
    camara.appendChild(overlay);

    cont.prepend(camara);

    // Inicializar Quagga
    Quagga.init({
        inputStream: {
            type: "LiveStream",
            constraints: { facingMode: "environment" },
            target: camara
        },
        decoder: {
            readers: [
                "code_128_reader",
                "ean_reader",
                "ean_8_reader",
                "code_39_reader"
            ]
        },
        locate: true
    }, function (err) {
        if (err) {
            console.log(err);
            alert("Error iniciando cámara");
            return;
        }
        Quagga.start();
    });


    // DETECCIÓN
    Quagga.onDetected((data) => {
        if (!data || !data.codeResult) return;

        if (cooldown) return;
        cooldown = true;
        setTimeout(() => cooldown = false, 900);

        const codigo = data.codeResult.code.trim();

        triggerScanEffect(codigo);
        agregarComprobante(codigo);
    });
}



// --------------------------------------------------
// EFECTOS VISUALES Y VIBRACIÓN
// --------------------------------------------------
function triggerScanEffect(codigo) {

    const cam = document.getElementById("cameraPreview");

    let esDuplicado = historialCodigos.includes(codigo);

    if (navigator.vibrate) navigator.vibrate(esDuplicado ? 350 : 120);

    if (esDuplicado) {
        cam.classList.add("scan-duplicado");
        mostrarMensajeFlotante("DUPLICADO");
    } else {
        cam.classList.add("scan-ok");
    }

    setTimeout(() => {
        cam.classList.remove("scan-ok");
        cam.classList.remove("scan-duplicado");
    }, 500);
}


// --------------------------------------------------
// MENSAJE FLOTANTE DUPLICADO
// --------------------------------------------------
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
function agregarComprobante(codigo) {

    const duplicado = historialCodigos.includes(codigo);

    historialCodigos.push(codigo);

    comprobantes.push({
        numero: codigo,
        tipo: detectarTipo(codigo),
        estado: "",
        observacion: "",
        duplicado: duplicado
    });

    actualizarContador();
    renderComprobantes();

    const audio = new Audio("https://actions.google.com/sounds/v1/cartoon/pop.ogg");
    audio.volume = 0.3;
    audio.play();
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
    const camara = document.getElementById("cameraPreview");

    cont.innerHTML = "";
    if (camara) cont.prepend(camara);

    comprobantes.forEach((c, index) => {

        let box = document.createElement("div");
        box.className = "comprobante fadeIn";

        let duplicadoTag = c.duplicado ?
            `<span class="duplicado-tag">DUPLICADO</span>` : ``;

        let botones = `
            <div class="estado-btns">
                <button class="btn-entregado" onclick="setEstado(${index}, 'ENTREGADO')">Entregado</button>
                <button class="btn-ausente" onclick="setEstado(${index}, 'AUSENTE')">Ausente</button>
                <button class="btn-cancelado" onclick="setEstado(${index}, 'CANCELADO')">Cancelado</button>
                <button class="btn-demorado" onclick="setEstado(${index}, 'DEMORADO')">Demorado</button>
            </div>
        `;

        if (c.estado !== "") {
            botones = `
                <div class="estado-btns">
                    <button class="btn-estado-activo">${c.estado}</button>
                    <button class="btn-editar" onclick="editarEstado(${index})">Editar</button>
                </div>
            `;
        }

        box.innerHTML = `
            <div class="comp-header">
                <div>
                    <strong>${c.numero}</strong>
                    <small>${c.tipo}</small>
                    ${duplicadoTag}
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
// ELIMINAR COMPROBANTE
// --------------------------------------------------
function eliminarComprobante(i) {
    comprobantes.splice(i, 1);
    actualizarContador();
    renderComprobantes();
}



// --------------------------------------------------
// SETEAR ESTADO
// --------------------------------------------------
function setEstado(i, estado) {

    comprobantes[i].estado = estado;

    renderComprobantes();
}



// --------------------------------------------------
// EDITAR ESTADO
// --------------------------------------------------
function editarEstado(i) {
    comprobantes[i].estado = "";
    comprobantes[i].observacion = "";
    renderComprobantes();
}



// --------------------------------------------------
// BOTÓN FINALIZAR ESCANEO
// --------------------------------------------------
document.getElementById("btnFinalizarEscaneo").onclick = () => {
    detenerCamara();
};



// --------------------------------------------------
// BOTÓN AGREGAR MÁS
// --------------------------------------------------
document.getElementById("btnAgregarMas").onclick = () => {
    iniciarScanner();
};



// --------------------------------------------------
// DETENER CÁMARA
// --------------------------------------------------
function detenerCamara() {

    if (isScannerActive) {
        Quagga.stop();
        isScannerActive = false;
    }

    let cam = document.getElementById("cameraPreview");
    if (cam) cam.remove();
}



// --------------------------------------------------
// GENERAR QR
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
