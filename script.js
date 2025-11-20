// --------------------------------------------------
// VARIABLES GLOBALES
// --------------------------------------------------
let comprobantes = [];
let choferNombre = "";
let fechaRuta = "";

let scanning = false;
let isScannerActive = false;

// Para detectar duplicados
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
// CLASIFICACIÓN AUTOMÁTICA
// --------------------------------------------------
function detectarTipo(codigo) {
    if (codigo.length >= 10) return "VENTAS ML FLEX";
    if (codigo.length === 7 || codigo.length === 8) return "VENTAS ML MOTO";
    return "DESCONOCIDO";
}


// --------------------------------------------------
// INICIAR ESCANEO (QUAGGAJS)
// --------------------------------------------------
document.getElementById("scanBtn").onclick = iniciarScanner;

function iniciarScanner() {
    if (isScannerActive) {
        alert("El escáner ya está activo.");
        return;
    }

    isScannerActive = true;
    scanning = true;

    const cont = document.getElementById("listaComprobantes");

    // Inserta un div donde se va a ver la cámara
    const camara = document.createElement("div");
    camara.id = "cameraPreview";
    camara.style.width = "100%";
    camara.style.height = "280px";
    camara.style.background = "#000";
    cont.prepend(camara);

    // Activa Quagga
    Quagga.init({
        inputStream: {
            type: "LiveStream",
            constraints: { facingMode: "environment" },
            target: document.querySelector('#cameraPreview')
        },
        decoder: {
            readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader"]
        }
    }, function (err) {
        if (err) {
            console.error(err);
            alert("Error iniciando cámara");
            return;
        }
        Quagga.start();
    });

    // Evento cuando detecta un código
    Quagga.onDetected((data) => {
        if (!data || !data.codeResult) return;

        const codigo = data.codeResult.code;

        agregarComprobante(codigo);
    });
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
        duplicado: duplicado ? true : false
    });

    actualizarContador();
    renderComprobantes();

    // Beep
    const audio = new Audio("https://actions.google.com/sounds/v1/cartoon/pop.ogg");
    audio.volume = 0.3;
    audio.play();
}


// --------------------------------------------------
// ACTUALIZAR CONTADOR
// --------------------------------------------------
function actualizarContador() {
    document.getElementById("contador").innerText =
        `Escaneados: ${comprobantes.length}`;
}


// --------------------------------------------------
// RENDERIZAR LISTA
// --------------------------------------------------
function renderComprobantes() {
    const cont = document.getElementById("listaComprobantes");

    // Mantener la cámara arriba
    const camara = document.getElementById("cameraPreview");

    cont.innerHTML = "";
    if (camara) cont.prepend(camara);

    comprobantes.forEach((c, index) => {
        const box = document.createElement("div");
        box.className = "comprobante";

        let marcaDuplicado = c.duplicado ?
            `<span class="duplicado-tag">DUPLICADO</span>` :
            "";

        box.innerHTML = `
            <div class="comp-header">
                <div>
                    <strong>${c.numero}</strong> 
                    <small>${c.tipo}</small>
                    ${marcaDuplicado}
                </div>

                <button class="btn-eliminar" onclick="eliminarComprobante(${index})">🗑️</button>
            </div>

            <div class="estado-btns">
                <button class="btn-entregado" onclick="setEstado(${index}, 'ENTREGADO')">Entregado</button>
                <button class="btn-ausente" onclick="setEstado(${index}, 'AUSENTE')">Ausente</button>
                <button class="btn-cancelado" onclick="setEstado(${index}, 'CANCELADO')">Cancelado</button>
                <button class="btn-demorado" onclick="setEstado(${index}, 'DEMORADO')">Demorado</button>
            </div>

            <textarea id="obs_${index}" placeholder="Observación..." style="display:${c.estado === 'ENTREGADO' ? 'none' : 'block'}"></textarea>
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

    const obs = document.getElementById(`obs_${i}`);
    obs.style.display = estado === "ENTREGADO" ? "none" : "block";

    obs.oninput = () => comprobantes[i].observacion = obs.value;

    renderComprobantes();
}


// --------------------------------------------------
// GENERAR QR
// --------------------------------------------------
document.getElementById("generarQR").onclick = () => {

    if (isScannerActive) {
        Quagga.stop();
        isScannerActive = false;
    }

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
// CERRAR MODAL Y LIMPIAR
// --------------------------------------------------
function cerrarQR() {
    document.getElementById("qrModal").style.display = "none";
    comprobantes = [];
    historialCodigos = [];
    actualizarContador();
    renderComprobantes();
}
