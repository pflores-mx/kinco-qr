const $ = (id) => document.getElementById(id);

let currentResult = null;
let scanner = null;
let scanLocked = false;

const fieldOrder = [
  "NIVEL 1","NIVEL 2","PRESION 1","PRESION 2",
  "CAUDAL 1","TOTALIZADO 1","CAUDAL 2","TOTALIZADO 2",
  "FECHA","HORA"
];

const labels = {
  "NIVEL 1":"NIVEL 1",
  "NIVEL 2":"NIVEL 2",
  "PRESION 1":"PRESIÓN 1",
  "PRESION 2":"PRESIÓN 2",
  "CAUDAL 1":"CAUDAL 1",
  "TOTALIZADO 1":"TOTALIZADO 1",
  "CAUDAL 2":"CAUDAL 2",
  "TOTALIZADO 2":"TOTALIZADO 2",
  "FECHA":"FECHA",
  "HORA":"HORA"
};

function show(id){
  document.querySelectorAll(".screen").forEach(x =>
    x.classList.remove("active")
  );

  $(id).classList.add("active");
}

function normalizeText(text){
  return text
    .replace(/\r\n/g,"\n")
    .replace(/\r/g,"\n");
}

// Algoritmo utilizado por la macro Kinco
// codigo=5381
// codigo=codigo*33+byte
// codigo=codigo%16777216
function validationCode(text){
  let code = 5381;

  for(const byte of new TextEncoder().encode(text)){
    code = (code * 33 + byte) % 16777216;
  }

  return code
    .toString(16)
    .toUpperCase()
    .padStart(6,"0");
}

function parseKinco(text){

  const normalized = normalizeText(text);
  const lines = normalized.split("\n");

  const records = [];
  let beforeCode = "";
  let received = null;

  for(const line of lines){

    if(line.toUpperCase().startsWith("CODIGO=")){
      received = line
        .substring(line.indexOf("=") + 1)
        .trim();

      break;
    }

    if(line === "") continue;

    const p = line.indexOf("=");

    if(p >= 0){

      records.push({
        key: line.substring(0,p).trim(),
        value: line.substring(p+1).trim()
      });

      beforeCode += line + "\n";
    }
  }

  const calculated = validationCode(beforeCode);

  const valid =
    !!received &&
    received.toUpperCase() === calculated;

  const map = {};

  records.forEach(r => {
    map[r.key] = r.value;
  });

  return {
    normalized,
    records,
    map,
    received,
    calculated,
    valid,
    beforeCode
  };
}

function processQR(text){

  if(!text || !text.trim()){
    alert("No se recibió texto del QR.");
    return;
  }

  currentResult = parseKinco(text);

  renderResult();

  show("report");

  $("statusDot").classList.toggle(
    "ok",
    currentResult.valid
  );
}

function renderResult(){

  const r = currentResult;

  $("siteInput").value =
    r.map["SITIO"] || "";

  $("receivedCode").textContent =
    r.received || "—";

  $("calculatedCode").textContent =
    r.calculated || "—";

  const badge = $("validBadge");

  badge.textContent =
    r.valid
      ? "🟢 QR VÁLIDO"
      : "🔴 QR NO VÁLIDO";

  badge.className =
    "badge " + (r.valid ? "valid" : "invalid");

  const container = $("fields");

  container.innerHTML = "";

  fieldOrder.forEach(key => {

    if(r.map[key] === undefined) return;

    const wrap = document.createElement("div");

    wrap.className = "field";

    const label = document.createElement("label");

    label.textContent =
      labels[key] || key;

    const input =
      document.createElement("input");

    input.type = "text";
    input.value = r.map[key];
    input.dataset.key = key;
    input.autocomplete = "off";

    wrap.append(label,input);

    container.append(wrap);
  });

  $("rawText").value =
    r.normalized;
}

function collectEdited(){

  const map = {};

  map["SITIO"] =
    $("siteInput").value.trim();

  document
    .querySelectorAll("#fields input")
    .forEach(input => {

      map[input.dataset.key] =
        input.value.trim();

    });

  return map;
}

function makeEditedText(){

  const map = collectEdited();

  let text = "";

  if(map["SITIO"] !== undefined){
    text +=
      "SITIO=" +
      map["SITIO"] +
      "\n";
  }

  fieldOrder.forEach(key => {

    if(map[key] !== undefined){

      text +=
        key +
        "=" +
        map[key] +
        "\n";

    }

  });

  return text;
}

function revalidateEdited(){

  const text =
    makeEditedText();

  const code =
    validationCode(text);

  $("calculatedCode").textContent =
    code;

  const originalReceived =
    currentResult.received;

  const valid =
    !!originalReceived &&
    originalReceived.toUpperCase() === code;

  const badge =
    $("validBadge");

  badge.textContent =
    valid
      ? "🟢 QR VÁLIDO"
      : "🟡 DATOS EDITADOS";

  badge.className =
    "badge " +
    (valid ? "valid" : "invalid");

  if(!valid && originalReceived){

    $("receivedCode").textContent =
      originalReceived;

  }
}

function reportText(){

  const text =
    makeEditedText();

  const code =
    validationCode(text);

  return (
    text +
    "CODIGO=" +
    code
  );
}

async function shareReport(){

  const text =
    reportText();

  if(navigator.share){

    try{

      await navigator.share({
        title:"Reporte Kinco",
        text:text
      });

    }catch(e){}

  }else{

    await navigator.clipboard.writeText(text);

    alert(
      "Reporte copiado al portapapeles."
    );
  }
}

async function copyReport(){

  await navigator.clipboard.writeText(
    reportText()
  );

  alert(
    "Reporte copiado."
  );
}


/* =====================================================
   LECTOR QR MEJORADO PARA HMI KINCO
   ===================================================== */

async function startScanner(){

  show("scanner");

  $("statusDot").classList.remove("ok");

  scanLocked = false;

  if(!window.Html5Qrcode){

    alert(
      "No se pudo cargar el lector QR. " +
      "Comprueba que tienes internet."
    );

    show("home");

    return;
  }

  try{

    scanner =
      new Html5Qrcode(
        "reader",
        {
          verbose:false
        }
      );

    /*
      Configuración especial:

      - Solo buscamos QR
      - Mayor velocidad de análisis
      - Zona de lectura más grande
      - Cámara trasera
      - Mayor resolución
      - Sin invertir la imagen
    */

    const config = {

      fps:20,

      qrbox:{
        width:320,
        height:320
      },

      aspectRatio:1.0,

      disableFlip:true,

      formatsToSupport:[
        Html5QrcodeSupportedFormats.QR_CODE
      ],

      videoConstraints:{
        facingMode:{
          ideal:"environment"
        },

        width:{
          ideal:1920
        },

        height:{
          ideal:1080
        }
      }

    };

    await scanner.start(

      {
        facingMode:"environment"
      },

      config,

      async decodedText => {

        if(scanLocked) return;

        scanLocked = true;

        console.log(
          "QR DETECTADO:",
          decodedText
        );

        try{

          await scanner.stop();

        }catch(e){}

        try{

          scanner.clear();

        }catch(e){}

        scanner = null;

        processQR(decodedText);

      },

      errorMessage => {

        // Los errores normales de búsqueda
        // NO se muestran al usuario.

      }

    );

  }catch(error){

    console.error(
      "ERROR DEL LECTOR:",
      error
    );

    alert(
      "No se pudo iniciar el lector QR.\n\n" +
      "Comprueba que la aplicación tenga " +
      "permiso para usar la cámara y que " +
      "la dirección sea HTTPS."
    );

    try{

      if(scanner){
        await scanner.stop();
      }

    }catch(e){}

    try{

      if(scanner){
        scanner.clear();
      }

    }catch(e){}

    scanner = null;

    show("home");
  }
}

async function stopScanner(){

  scanLocked = true;

  if(scanner){

    try{
      await scanner.stop();
    }catch(e){}

    try{
      scanner.clear();
    }catch(e){}

    scanner = null;
  }

  show("home");
}


/* =====================================================
   BOTONES
   ===================================================== */

$("scanBtn")
  .addEventListener(
    "click",
    startScanner
  );

$("closeScanner")
  .addEventListener(
    "click",
    stopScanner
  );


$("pasteBtn")
  .addEventListener(
    "click",
    () => {

      $("pasteText").value = "";

      $("pasteModal")
        .classList
        .remove("hidden");

    }
  );


$("cancelPaste")
  .addEventListener(
    "click",
    () => {

      $("pasteModal")
        .classList
        .add("hidden");

    }
  );


$("processPaste")
  .addEventListener(
    "click",
    () => {

      const t =
        $("pasteText").value;

      $("pasteModal")
        .classList
        .add("hidden");

      processQR(t);

    }
  );


$("newScan")
  .addEventListener(
    "click",
    () => {

      show("home");

      $("statusDot")
        .classList
        .remove("ok");

    }
  );


$("shareBtn")
  .addEventListener(
    "click",
    shareReport
  );


$("copyBtn")
  .addEventListener(
    "click",
    copyReport
  );


$("revalidateBtn")
  .addEventListener(
    "click",
    revalidateEdited
  );


/* =====================================================
   SERVICE WORKER
   ===================================================== */

if("serviceWorker" in navigator){

  window.addEventListener(
    "load",
    () => {

      navigator.serviceWorker
        .register("./sw.js")
        .catch(console.warn);

    }
  );

}