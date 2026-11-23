// Virtual Parameter: Rx
// Potência óptica de recepção (RX) da ONU em dBm, ex.: "-13.32dBm". TR-181 primeiro; as fontes
// da TR-098 só são usadas se a TR-181 não tiver resultado. Devolve "-" se não encontrar.
//
// Cada fonte em SOURCES informa a unidade que a CPE devolve: "dBm", "mdBm" (milésimos),
// "cdBm" (centésimos), "0.1uW" (décimos de µW) ou "auto" (testa cada uma e fica com a primeira
// conversão na faixa plausível de RX).

const now = Date.now();

// true = modo de diagnóstico: em vez do valor em dBm, devolve o valor bruto, a unidade
// escolhida, o caminho de origem e todos os valores brutos lidos
const DEBUG = false;

const RX_MIN_DBM = -40;
const RX_MAX_DBM = -3;

// false = ignora as fontes genéricas (generic: true), que usam curinga no objeto do fabricante
const USE_GENERIC = true;

const SOURCES = [
  { path: "Device.Optical.Interface.*.X_TP_GPON_Config.RXPower", unit: "0.1uW" },
  { path: "Device.Optical.Interface.*.OpticalSignalLevel", unit: "auto" },
  { path: "Device.Optical.Interface.*.*.RXPower", unit: "auto", generic: true },

  { path: "InternetGatewayDevice.Optical.Interface.*.X_TP_GPON_Config.RXPower", unit: "dBm" },
  // Huawei (a grafia "Interafce" é a do próprio fabricante)
  { path: "InternetGatewayDevice.WANDevice.*.X_GponInterafceConfig.RXPower", unit: "auto" },
  { path: "InternetGatewayDevice.WANDevice.*.X_ZTE-COM_WANPONInterfaceConfig.RXPower", unit: "auto" },
  { path: "InternetGatewayDevice.WANDevice.*.X_CT-COM_GponInterfaceConfig.RXPower", unit: "auto" },
  { path: "InternetGatewayDevice.X_ALU_OntOpticalParam.RXPower", unit: "auto" },
  { path: "InternetGatewayDevice.WANDevice.*.*.RXPower", unit: "auto", generic: true }
];

// Converte o valor bruto para dBm na unidade indicada; null se não for possível.
// Em 0.1uW: décimos de µW -> mW (raw * 0.1 / 1000) -> dBm (10 * log10 da potência em mW)
function convert(raw, unit) {
  if (unit === "dBm") return raw;
  if (unit === "mdBm") return raw / 1000;
  if (unit === "cdBm") return raw / 100;
  if (unit === "0.1uW") return raw > 0 ? 10 * Math.log10((raw * 0.1) / 1000) : null;
  return null;
}

function plausible(d) {
  return d !== null && isFinite(d) && d >= RX_MIN_DBM && d <= RX_MAX_DBM;
}

// Converte para dBm e devolve { dbm, unit }, ou null. Com unidade "auto", testa as unidades
// candidatas em ordem e aceita a primeira conversão plausível.
function toDbm(raw, unit) {
  if (unit !== "auto") {
    let d = convert(raw, unit);
    return d !== null && isFinite(d) ? { dbm: d, unit: unit } : null;
  }
  // Com casas decimais só pode ser dBm; inteiros podem ser qualquer uma das unidades
  let candidates = Number.isInteger(raw) ? ["dBm", "mdBm", "cdBm", "0.1uW"] : ["dBm"];
  for (let u of candidates) {
    let d = convert(raw, u);
    if (plausible(d)) return { dbm: d, unit: u };
  }
  return null;
}

function fmt(v) {
  return v.toFixed(2) + "dBm";
}

let seen = [];

// Lê as fontes de uma árvore (TR-181 ou TR-098) na ordem da lista e devolve a primeira leitura
// válida, { dbm, unit, raw, path }, ou null. No modo DEBUG, continua lendo todas as fontes
// para registrar os valores em "seen".
function tryTree(sources) {
  let found = null;
  for (let s of sources) {
    if (s.generic && !USE_GENERIC) continue;
    for (let p of declare(s.path, { value: now })) {
      if (!p.value) continue;
      let v = p.value[0];
      if (v === undefined || v === null || v === "") continue;
      let raw = parseFloat(String(v).replace(",", "."));
      if (isNaN(raw)) continue;
      seen.push(p.path + "=" + v);
      if (found !== null || raw === 0) continue; // 0 fixo = sem leitura real
      let r = toDbm(raw, s.unit);
      if (r !== null) {
        found = { dbm: r.dbm, unit: r.unit, raw: v, path: p.path };
        if (!DEBUG) return found;
      }
    }
  }
  return found;
}

let result = tryTree(SOURCES.filter(function (s) { return s.path.indexOf("Device.") === 0; }));
if (result === null) {
  result = tryTree(SOURCES.filter(function (s) { return s.path.indexOf("InternetGatewayDevice.") === 0; }));
}

if (DEBUG) {
  let txt = (result === null
    ? "sem leitura valida"
    : "raw=" + result.raw + " (" + result.unit + ") -> " + fmt(result.dbm) + " @ " + result.path)
    + " | lidos: " + (seen.join(" ; ") || "nenhum");
  return { writable: false, value: [txt, "xsd:string"] };
}

return {
  writable: false,
  value: [result === null ? "-" : fmt(result.dbm), "xsd:string"]
};
