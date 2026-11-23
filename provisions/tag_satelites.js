// Provision: tag_satelites
// Marca com a tag "Satelite" as CPEs que são satélites (mesh / pontos secundários): o IP do
// ConnectionRequestURL começa com algum prefixo de SATELLITE_CR_PREFIXES. O ManagementServer.URL
// não serve de critério, pois é igual ao dos roteadores principais.
//
// Não pede nada à CPE: lê o ConnectionRequestURL já guardado, que chega em todo Inform. Se a CPE
// deixar de bater com o critério, a tag é removida (REMOVE_IF_MAIN); se a URL não puder ser lida,
// nada é alterado.

// Prefixos do IP (início do endereço) que identificam um satélite
const SATELLITE_CR_PREFIXES = ["192.168.", "10."];

// Nome da tag. O GenieACS monta o caminho "Tags.<nome>", e esse caminho só aceita letras
// ASCII (sem acento), números, "_" e "-". Por isso é "Satelite", e não "Satélite".
const TAG_NAME = "Satelite";

// true = remove a tag de aparelhos que deixam de bater com o critério
const REMOVE_IF_MAIN = true;

if (!/^[A-Za-z0-9_-]+$/.test(TAG_NAME)) {
  log("tag_satelite: TAG_NAME inválido (use só letras sem acento, números, _ e -)");
  return;
}

function readUrl(path) {
  let d = declare(path, { value: 1 });
  if (d.value === undefined || d.value === null || d.value[0] === undefined || d.value[0] === null) return null;
  let s = String(d.value[0]).trim();
  return s === "" ? null : s;
}

let crUrl = readUrl("Device.ManagementServer.ConnectionRequestURL");
if (crUrl === null) crUrl = readUrl("InternetGatewayDevice.ManagementServer.ConnectionRequestURL");

if (crUrl === null) {
  log("tag_satelite: ConnectionRequestURL ainda não conhecido; tag não alterada");
  return;
}

// Extrai o endereço: "http://192.168.101.8:7547/tr069" -> "192.168.101.8"
let m = /^[a-z][a-z0-9+.-]*:\/\/([^\/:?#]+)/i.exec(crUrl);
let host = m ? m[1] : "";

if (host === "") {
  log("tag_satelite: não consegui extrair o endereço de " + crUrl + "; tag não alterada");
  return;
}

let isSatellite = SATELLITE_CR_PREFIXES.some(function (prefix) {
  return host.indexOf(prefix) === 0;
});

if (isSatellite) {
  declare("Tags." + TAG_NAME, null, { value: true });
  log("tag_satelite: SATELITE | ConnectionRequestURL=" + crUrl + " | tag " + TAG_NAME + " aplicada");
} else {
  log("tag_satelite: PRINCIPAL | ConnectionRequestURL=" + crUrl + " | sem tag");
  if (REMOVE_IF_MAIN) declare("Tags." + TAG_NAME, null, { value: false });
}
