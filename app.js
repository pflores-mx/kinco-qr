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

/* =====================================================
NAVEGACIÓN
===================================================== */

function show(id){

document.querySelectorAll(".screen").forEach(x =>
x.classList.remove("active")
);

const screen = $(id);

if(screen){
screen.classList.add("active");
}
}

/* =====================================================
NORMALIZACIÓN
===================================================== */

function normalizeText(text){

return String(text)
.replace(/\r\n/g,"\n")
.replace(/\r/g,"\n");
}

/* =====================================================
CÓDIGO DE VALIDACIÓN KINCO
===================================================== */

// Algoritmo utilizado por la macro Kinco
//
// codigo = 5381
// codigo = codigo * 33 + byte
// codigo = codigo % 16777216

function validationCode(text){

let code = 5381;

for(const byte of new TextEncoder().encode(text)){

```
code =
  (code * 33 + byte) %
  16777216;
```

}

return code
.toString(16)
.toUpperCase()
.padStart(6,"0");
}

/* =====================================================
INTERPRETAR QR KINCO
===================================================== */

function parseKinco(text){

const normalized =
normalizeText(text);

const lines =
normalized.split("\n");

const records = [];

let beforeCode = "";

let received = null;

for(const line of lines){

```
if(
  line
    .toUpperCase()
    .startsWith("CODIGO=")
){

  received =
    line
      .substring(
        line.indexOf("=") + 1
      )
      .trim();

  break;
}


if(line === ""){
  continue;
}


const p =
  line.indexOf("=");


if(p >= 0){

  const key =
    line
      .substring(0,p)
      .trim();

  const value =
    line
      .substring(p + 1)
      .trim();


  records.push({
    key:key,
    value:value
  });


  beforeCode +=
    line + "\n";
}
```

}

const calculated =
validationCode(beforeCode);

const valid =
!!received &&
received.toUpperCase() === calculated;

const map = {};

records.forEach(r => {

```
map[r.key] =
  r.value;
```

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

/* =====================================================
PROCESAR QR
===================================================== */

function processQR(text){

if(!text || !text.trim()){

```
alert(
  "No se recibió texto del QR."
);

return;
```

}

currentResult =
parseKinco(text);

renderResult();

show("report");

const dots =
document.querySelectorAll(
".status-dot"
);

dots.forEach(dot => {

```
dot.classList.toggle(
  "ok",
  currentResult.valid
);
```

});
}

/* =====================================================
MOSTRAR RESULTADO
===================================================== */

function renderResult(){

const r =
currentResult;

$("siteInput").value =
r.map["SITIO"] || "";

$("receivedCode").textContent =
r.received || "—";

$("calculatedCode").textContent =
r.calculated || "—";

const badge =
$("validBadge");

badge.textContent =
r.valid
? "🟢 QR VÁLIDO"
: "🔴 QR NO VÁLIDO";

badge.className =
"badge " +
(r.valid
? "valid"
: "invalid");

const container =
$("fields");

container.innerHTML = "";

fieldOrder.forEach(key => {

```
if(
  r.map[key] === undefined
){
  return;
}


const wrap =
  document.createElement("div");

wrap.className =
  "field";


const label =
  document.createElement("label");

label.textContent =
  labels[key] || key;


const input =
  document.createElement("input");

input.type =
  "text";

input.value =
  r.map[key];

input.dataset.key =
  key;

input.autocomplete =
  "off";


wrap.append(
  label,
  input
);


container.append(
  wrap
);
```

});

$("rawText").value =
r.normalized;
}

/* =====================================================
RECOPILAR DATOS EDITADOS
===================================================== */

function collectEdited(){

const map = {};

map["SITIO"] =
$("siteInput")
.value
.trim();

document
.querySelectorAll(
"#fields input"
)
.forEach(input => {

```
  map[input.dataset.key] =
    input.value.trim();

});
```

return map;
}

/* =====================================================
CREAR TEXTO EDITADO
===================================================== */

function makeEditedText(){

const map =
collectEdited();

let text = "";

if(
map["SITIO"] !== undefined
){

```
text +=
  "SITIO=" +
  map["SITIO"] +
  "\n";
```

}

fieldOrder.forEach(key => {

```
if(
  map[key] !== undefined
){

  text +=
    key +
    "=" +
    map[key] +
    "\n";

}
```

});

return text;
}

/* =====================================================
REVALIDAR
===================================================== */

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
(valid
? "valid"
: "invalid");

if(
!valid &&
originalReceived
){

```
$("receivedCode").textContent =
  originalReceived;
```

}
}

/* =====================================================
REPORTE
===================================================== */

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

/* =====================================================
COMPARTIR
===================================================== */

async function shareReport(){

const text =
reportText();

if(navigator.share){

```
try{

  await navigator.share({
    title:"Reporte Kinco",
    text:text
  });

}catch(e){}
```

}else{

```
await navigator.clipboard.writeText(
  text
);


alert(
  "Reporte copiado al portapapeles."
);
```

}
}

/* =====================================================
COPIAR
===================================================== */

async function copyReport(){

await navigator.clipboard.writeText(
reportText()
);

alert(
"Reporte copiado."
);
}

/* =====================================================
LECTOR QR PARA IPHONE
===================================================== */

async function startScanner(){

show("scanner");

scanLocked = false;

/*
IMPORTANTE:

```
 Eliminamos cualquier lector anterior
 antes de iniciar uno nuevo.
```

*/

if(scanner){

```
try{
  await scanner.stop();
}catch(e){}

try{
  scanner.clear();
}catch(e){}

scanner = null;
```

}

if(
!window.Html5Qrcode
){

```
alert(
  "No se pudo cargar el lector QR.\n\n" +
  "Comprueba que tienes conexión a Internet."
);

show("home");

return;
```

}

try{

```
/*
   Creamos el lector.
*/

scanner =
  new Html5Qrcode(
    "reader",
    {
      verbose:false
    }
  );


/*
   =================================================
   CONFIGURACIÓN OPTIMIZADA PARA IPHONE
   =================================================

   La configuración anterior era demasiado
   restrictiva.

   Ahora:

   - 30 FPS
   - área de lectura grande
   - QR únicamente
   - cámara trasera
   - sin resolución fija de 1920x1080
   - sin aspectRatio forzado
   - sin disableFlip
*/


const config = {

  fps:30,


  /*
     El área ocupa aproximadamente el 75%
     del ancho disponible.

     Esto facilita muchísimo la lectura
     de códigos QR pequeños de la HMI.
  */

  qrbox: (viewfinderWidth, viewfinderHeight) => {

    const minDimension =
      Math.min(
        viewfinderWidth,
        viewfinderHeight
      );


    const size =
      Math.floor(
        minDimension * 0.75
      );


    return {
      width:size,
      height:size
    };

  },


  /*
     Solo buscamos QR.
  */

  formatsToSupport:[
    Html5QrcodeSupportedFormats.QR_CODE
  ],


  /*
     Permitimos inversión si el lector
     la necesita.
  */

  disableFlip:false

};


/*
   Iniciamos específicamente la
   cámara trasera.
*/

await scanner.start(

  {
    facingMode:{
      ideal:"environment"
    }
  },


  config,


  /*
     QR DETECTADO
  */

  async decodedText => {

    if(scanLocked){
      return;
    }


    scanLocked = true;


    console.log(
      "================================"
    );

    console.log(
      "QR DETECTADO:"
    );

    console.log(
      decodedText
    );

    console.log(
      "================================"
    );


    /*
       Detener cámara.
    */

    try{

      await scanner.stop();

    }catch(e){

      console.warn(
        "No se pudo detener cámara:",
        e
      );

    }


    /*
       Limpiar lector.
    */

    try{

      scanner.clear();

    }catch(e){}


    scanner = null;


    /*
       Procesar QR.
    */

    processQR(
      decodedText
    );

  },


  /*
     Los errores de búsqueda son normales.

     NO mostramos mensajes.
  */

  errorMessage => {

    // No hacer nada.
  }

);


/*
   Indicador de cámara activa.
*/

const dots =
  document.querySelectorAll(
    ".status-dot"
  );


dots.forEach(dot => {

  dot.classList.add(
    "ok"
  );

});
```

}catch(error){

```
console.error(
  "ERROR DEL LECTOR:",
  error
);


let mensaje =
  "No se pudo iniciar el lector QR.\n\n";


if(
  error &&
  error.message
){

  mensaje +=
    error.message;

}else{

  mensaje +=
    "Comprueba el permiso de cámara.";
}


alert(
  mensaje
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
```

}
}

/* =====================================================
DETENER ESCÁNER
===================================================== */

async function stopScanner(){

scanLocked = true;

if(scanner){

```
try{

  await scanner.stop();

}catch(e){}


try{

  scanner.clear();

}catch(e){}


scanner = null;
```

}

show("home");
}

/* =====================================================
BOTÓN ESCANEAR
===================================================== */

$("scanBtn")
.addEventListener(
"click",
startScanner
);

/* =====================================================
CANCELAR ESCÁNER
===================================================== */

$("closeScanner")
.addEventListener(
"click",
stopScanner
);

/* =====================================================
PEGAR QR
===================================================== */

$("pasteBtn")
.addEventListener(
"click",
() => {

```
  $("pasteText").value =
    "";


  $("pasteModal")
    .classList
    .remove(
      "hidden"
    );

}
```

);

/* =====================================================
CANCELAR PEGADO
===================================================== */

$("cancelPaste")
.addEventListener(
"click",
() => {

```
  $("pasteModal")
    .classList
    .add(
      "hidden"
    );

}
```

);

/* =====================================================
PROCESAR QR PEGADO
===================================================== */

$("processPaste")
.addEventListener(
"click",
() => {

```
  const t =
    $("pasteText").value;


  $("pasteModal")
    .classList
    .add(
      "hidden"
    );


  processQR(t);

}
```

);

/* =====================================================
NUEVO ESCANEO
===================================================== */

$("newScan")
.addEventListener(
"click",
() => {

```
  show("home");


  document
    .querySelectorAll(
      ".status-dot"
    )
    .forEach(dot => {

      dot.classList.remove(
        "ok"
      );

    });

}
```

);

/* =====================================================
COMPARTIR
===================================================== */

$("shareBtn")
.addEventListener(
"click",
shareReport
);

/* =====================================================
COPIAR
===================================================== */

$("copyBtn")
.addEventListener(
"click",
copyReport
);

/* =====================================================
REVALIDAR
===================================================== */

$("revalidateBtn")
.addEventListener(
"click",
revalidateEdited
);

/* =====================================================
SERVICE WORKER
===================================================== */

if(
"serviceWorker" in navigator
){

window.addEventListener(
"load",
() => {

```
  navigator.serviceWorker
    .register(
      "./service-worker.js"
    )
    .catch(
      console.warn
    );

}

);

}
