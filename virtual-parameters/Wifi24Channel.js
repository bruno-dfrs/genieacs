// Virtual Parameter: Wifi24Channel
// Canal da rede Wi-Fi de 2,4 GHz.
// Editável: o valor digitado no GenieACS é gravado na CPE. TR-181 primeiro; TR-098 como alternativa.
// Devolve "-" se não encontrar.

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
  let band = readStr(base + ".OperatingFrequencyBand");
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
  return radio ? nonEmpty(readRef(radio + ".Channel")) : null;
}

function tr098() {
  let wlan = findWlan24();
  return wlan ? nonEmpty(readRef(wlan + ".Channel")) : null;
}

let target = tr181();
if (target === null) target = tr098();

let newValue = args[1] && args[1].value ? args[1].value[0] : undefined;

// Grava no parâmetro real (TR-181 ou TR-098), convertendo o valor para o tipo original dele
if (target !== null && newValue !== undefined) {
  declare(target.path, { value: now }, { value: [cast(target.type, newValue), target.type] });
}

return { writable: target !== null, value: [target === null ? "-" : target.value, "xsd:string"] };
