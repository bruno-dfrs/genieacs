// Virtual Parameter: Wifi24Bandwidth
// Largura de canal da rede Wi-Fi de 2,4 GHz.
// Editável: o valor digitado no GenieACS é gravado na CPE. TR-181 primeiro; TR-098 como alternativa.
// Devolve "-" se não encontrar.
//
// Largura de canal na TR-098 é parâmetro de fabricante: este script tenta os de TP-Link, Huawei e
// FiberHome/Intelbras (veja BW_PARAMS_098). Se algum modelo continuar com "-", ligue o DEBUG.

const now = Date.now();

function val(p) {
  if (!p || !p.value) return null;
  let v = p.value[0];
  if (v === undefined || v === null) return null;
  v = String(v).trim();
  return v === "" ? null : v;
}

function readStr(path) {
  return val(declare(path, { value: now }));
}

function readRef(path) {
  let d = declare(path, { value: now });
  if (!d || !d.value || d.value[0] === undefined || d.value[0] === null) return null;
  return { path: path, value: String(d.value[0]).trim(), type: d.value[1] || "xsd:string" };
}

function nonEmpty(r) {
  return r !== null && r.value !== "" ? r : null;
}

function readFirstRef(base, suffixes, allowEmpty) {
  for (let s of suffixes) {
    let r = readRef(base + "." + s);
    if (r !== null && (allowEmpty || r.value !== "")) return r;
  }
  return null;
}

function cast(type, v) {
  if (/int|long|decimal|float|double/i.test(type)) {
    let n = Number(v);
    return isNaN(n) ? v : n;
  }
  return String(v);
}

function normPath(v) {
  if (!v) return null;
  let s = String(v).split(",")[0].trim().replace(/\.$/, "");
  return s === "" ? null : s;
}

function byInstance(a, b) {
  let x = (String(a).match(/\d+/g) || []).map(Number);
  let y = (String(b).match(/\d+/g) || []).map(Number);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return x.length - y.length;
}

function findRadio24() {
  let radios = [];
  for (let p of declare("Device.WiFi.Radio.*.OperatingFrequencyBand", { value: now })) {
    let band = val(p);
    if (band && band.indexOf("2.4") !== -1) {
      radios.push(p.path.replace(/\.OperatingFrequencyBand$/, ""));
    }
  }
  radios.sort(byInstance);
  return radios.length > 0 ? radios[0] : null;
}

function is24(base) {
  let band = readFirstStr(base, BAND_PARAMS);
  if (band !== null) return band.indexOf("2.4") !== -1;

  // Sem a banda informada, deduz pelos canais (2,4 GHz usa os canais 1 a 14): primeiro pelo
  // início da lista PossibleChannels (ex.: "1-13") e, na falta dela, pelo canal atual
  let channels = readStr(base + ".PossibleChannels");
  if (channels !== null) {
    let first = parseInt(channels, 10);
    return !isNaN(first) && first >= 1 && first <= 14;
  }

  let ch = parseInt(readStr(base + ".Channel"), 10);
  return !isNaN(ch) && ch >= 1 && ch <= 14;
}

function findWlan24() {
  let wlans = [];
  for (let p of declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.SSID", { value: now })) {
    let base = p.path.replace(/\.SSID$/, "");
    if (is24(base)) wlans.push(base);
  }
  wlans.sort(byInstance);
  return wlans.length > 0 ? wlans[0] : null;
}

function tr181() {
  let radio = findRadio24();
  return radio ? readFirstRef(radio, ["OperatingChannelBandwidth"], false) : null;
}

function tr098() {
  let wlan = findWlan24();
  return wlan ? readFirstRef(wlan, BW_PARAMS_098, false) : null;
}

// Parâmetros que informam a banda de um rádio/rede (TR-098). A TR-181 usa OperatingFrequencyBand;
// a Huawei usa X_HW_RFBand / X_HW_Band (visto em um dump de uma ONT Huawei).
const BAND_PARAMS = ["OperatingFrequencyBand", "X_HW_RFBand", "X_HW_Band"];

// Parâmetros de largura de canal na TR-098, em ordem de tentativa (o primeiro que existir e tiver valor):
//   OperatingChannelBandwidth / X_TP_Bandwidth : TP-Link
//   Bandwidth        : texto "20MHz", "20/40MHz"... (visto na documentação TR-069 de ONTs Intelbras da linha RX)
//   X_HW_HT20        : Huawei. O significado dos valores NÃO está confirmado (veja VALUE_MAP e DEBUG)
//   X_FH_ChannelWidth: FiberHome/Intelbras (ex.: HG6145F3). Valores numéricos, significado NÃO confirmado
const BW_PARAMS_098 = ["OperatingChannelBandwidth", "X_TP_Bandwidth", "Bandwidth", "X_HW_HT20", "X_FH_ChannelWidth"];

// Tradução opcional de valores numéricos de fabricante para texto, por nome de parâmetro.
// Sem entrada, o valor aparece como a CPE devolve. Para ao digitar na interface o texto ser gravado
// de volta como o número certo, preencha a tabela depois de descobrir os valores com o DEBUG.
// Formato: "NomeDoParametro": { "<valor bruto>": "<texto exibido>" }
const VALUE_MAP = {
};

// true = em vez da largura, devolve um diagnóstico em texto: cada rede Wi-Fi encontrada, a banda
// que a CPE informa e todos os parâmetros dela com nome parecido com largura/modo/banda.
// Use em um aparelho de cada modelo, copie o texto e volte para false. Não grava nada.
const DEBUG = false;

function readFirstStr(base, suffixes) {
  for (let s of suffixes) {
    let v = readStr(base + "." + s);
    if (v !== null) return v;
  }
  return null;
}

function suffixOf(path) {
  return path.substring(path.lastIndexOf(".") + 1);
}

// Valor a exibir (traduzido pelo VALUE_MAP, se houver)
function show(t) {
  let m = VALUE_MAP[suffixOf(t.path)];
  return m && m[t.value] !== undefined ? m[t.value] : t.value;
}

// Valor a gravar: se o texto digitado estiver no VALUE_MAP, grava o valor bruto correspondente
function unshow(t, v) {
  let m = VALUE_MAP[suffixOf(t.path)];
  if (m) {
    for (let k of Object.keys(m)) {
      if (String(m[k]).toLowerCase() === String(v).trim().toLowerCase()) return k;
    }
  }
  return v;
}

// Parâmetros de um objeto cujo nome lembra largura, modo ou banda
function candidates(base) {
  let out = [];
  for (let q of declare(base + ".*", { value: now })) {
    let name = suffixOf(q.path);
    let v = q.value && q.value[0] !== undefined && q.value[0] !== null ? String(q.value[0]) : null;
    if (v !== null && /band|width|bw|ht20|ht40|vht|standard|mode/i.test(name)) out.push(name + "=" + v);
  }
  return out.join("; ");
}

function debugReport() {
  let lines = [];
  for (let p of declare("Device.WiFi.Radio.*.OperatingFrequencyBand", { value: now })) {
    let radio = p.path.replace(/\.OperatingFrequencyBand$/, "");
    lines.push("TR181 " + radio + " | " + candidates(radio));
  }
  for (let p of declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.SSID", { value: now })) {
    let base = p.path.replace(/\.SSID$/, "");
    lines.push("TR098 " + base + " | PossibleChannels=" + readStr(base + ".PossibleChannels") +
      " Channel=" + readStr(base + ".Channel") + " | " + candidates(base));
  }
  return lines.length > 0 ? lines.join(" || ") : "nenhuma rede Wi-Fi encontrada (nem TR-181 nem TR-098)";
}

if (DEBUG) return { writable: false, value: [debugReport(), "xsd:string"] };

let target = tr181();
if (target === null) target = tr098();

let newValue = args[1] && args[1].value ? args[1].value[0] : undefined;

// Grava no parâmetro real (TR-181 ou TR-098), convertendo o valor para o tipo original dele
if (target !== null && newValue !== undefined) {
  declare(target.path, { value: now }, { value: [cast(target.type, unshow(target, newValue)), target.type] });
}

return { writable: target !== null, value: [target === null ? "-" : show(target), "xsd:string"] };
