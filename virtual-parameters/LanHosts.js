// Virtual Parameter: LanHosts
// Dispositivos da rede local da CPE, em uma tabela de texto (nome, IP, MAC e sinal Wi-Fi).
// O sinal só aparece para clientes Wi-Fi associados; os demais mostram "-".
// TR-181 primeiro; TR-098 como alternativa. Devolve "-" se não houver hosts.

const now = Date.now();

// true = lista só os clientes ativos (Active = true); false = lista também os inativos
const ONLY_ACTIVE = true;

// Largura máxima da coluna de nome (nomes maiores são cortados com "…")
const MAX_NAME = 24;

// true = também lê a lista de dispositivos Wi-Fi associados, para obter o sinal de cada cliente
const COLLECT_SIGNAL = true;

// Modelos (DeviceID.ProductClass) em que a leitura do sinal fica desativada porque o firmware
// responde com fault. A comparação ignora maiúsculas e minúsculas, e nesses modelos a coluna
// de sinal mostra "-". Formato: ["MODELO1", "MODELO2"].
const SKIP_SIGNAL_MODELS = [];

// TR-098: parâmetros de sinal por host, específicos de fabricante (lista vazia = não consulta).
// Cada nome é lido em InternetGatewayDevice.LANDevice.*.Hosts.Host.*.<nome>, e só valores
// negativos (dBm) são aceitos. Ex.: ["X_HW_RSSI"] em ONTs Huawei.
const TR098_HOST_SIGNAL_VENDOR = [];

function val(p) {
  if (!p || !p.value) return null;
  let v = p.value[0];
  if (v === undefined || v === null) return null;
  v = String(v).trim();
  return v === "" ? null : v;
}

// Lê um campo de todas as instâncias de uma tabela e devolve { "<instância>": "valor", ... }.
// A chave é o caminho da instância (sem o nome do campo), o que permite cruzar os campos de
// um mesmo host (MAC, nome, IP...).
// As tabelas de hosts e de dispositivos associados mudam o tempo todo; com "path: now", o
// GenieACS redescobre as instâncias que existem agora, em vez de pedir à CPE valores de
// instâncias antigas que já não existem (o que alguns firmwares respondem com fault).
function readColumn(path) {
  let col = {};
  let field = path.slice(path.lastIndexOf(".") + 1);
  for (let p of declare(path, { path: now, value: now })) {
    let v = val(p);
    if (v !== null) col[p.path.slice(0, p.path.length - field.length - 1)] = v;
  }
  return col;
}

function byInstance(a, b) {
  let x = (String(a).match(/\d+/g) || []).map(Number);
  let y = (String(b).match(/\d+/g) || []).map(Number);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return x.length - y.length;
}

function normMac(v) {
  if (!v) return null;
  let m = String(v).trim().toLowerCase().replace(/-/g, ":");
  return /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(m) ? m : null;
}

function parseSignal(v) {
  if (v === undefined || v === null) return null;
  let n = parseFloat(String(v).replace(",", "."));
  return !isNaN(n) && n < 0 && n >= -120 ? Math.round(n) : null;
}

function fmtSignal(s) {
  return s === undefined || s === null ? "-" : s + " dBm";
}

function isActive(v) {
  return !(v === "false" || v === "0");
}

function signalsByMac(macCol, sigCol) {
  let out = {};
  for (let base of Object.keys(macCol)) {
    let mac = normMac(macCol[base]);
    let s = parseSignal(sigCol[base]);
    if (mac !== null && s !== null) out[mac] = s;
  }
  return out;
}

function buildRows(macs, names, ips, actives, signalOf) {
  let rows = [];
  for (let base of Object.keys(macs).sort(byInstance)) {
    if (ONLY_ACTIVE && !isActive(actives[base])) continue;
    rows.push({
      name: names[base] || "-",
      ip: ips[base] || "-",
      mac: (normMac(macs[base]) || macs[base]).toUpperCase(),
      signal: signalOf(base, normMac(macs[base]))
    });
  }
  return rows;
}

// Um fault da CPE ao ler uma tabela dinâmica não pode ser capturado com try/catch, porque o
// pedido só vai à CPE depois que o script termina. Por isso, o script evita pedir o que
// provavelmente falharia:
//  1) respeita a lista SKIP_SIGNAL_MODELS;
//  2) lê primeiro o contador de associados (parâmetro simples) e só abre a tabela
//     AssociatedDevice dos pontos de acesso/redes que têm pelo menos 1 cliente.

function signalAllowed() {
  if (!COLLECT_SIGNAL) return false;
  if (SKIP_SIGNAL_MODELS.length === 0) return true;
  let model = val(declare("DeviceID.ProductClass", { value: 1 }));
  if (model === null) return true;
  model = model.toLowerCase();
  return !SKIP_SIGNAL_MODELS.some(function (m) { return String(m).toLowerCase() === model; });
}

// Devolve { "<mac>": sinal }, abrindo a tabela AssociatedDevice só dos objetos cujo contador
// de associados é maior que zero. countPath é o caminho do contador, com curinga
// (ex.: ...AccessPoint.*.AssociatedDeviceNumberOfEntries).
function signalsGated(countPath, macField, sigField) {
  let out = {};
  let counts = readColumn(countPath);
  for (let base of Object.keys(counts).sort(byInstance)) {
    if (!(parseInt(counts[base], 10) > 0)) continue;
    let m = signalsByMac(
      readColumn(base + ".AssociatedDevice.*." + macField),
      readColumn(base + ".AssociatedDevice.*." + sigField)
    );
    for (let k of Object.keys(m)) out[k] = m[k];
  }
  return out;
}

function hostsTr181() {
  let macs = readColumn("Device.Hosts.Host.*.PhysAddress");
  if (Object.keys(macs).length === 0) return null;

  let names = readColumn("Device.Hosts.Host.*.HostName");
  let ips = readColumn("Device.Hosts.Host.*.IPAddress");
  let actives = readColumn("Device.Hosts.Host.*.Active");

  let bySig = signalAllowed()
    ? signalsGated("Device.WiFi.AccessPoint.*.AssociatedDeviceNumberOfEntries", "MACAddress", "SignalStrength")
    : {};

  return buildRows(macs, names, ips, actives, function (base, mac) {
    return fmtSignal(mac !== null ? bySig[mac] : undefined);
  });
}

function hostsTr098() {
  const host = "InternetGatewayDevice.LANDevice.*.Hosts.Host.*.";

  let macs = readColumn(host + "MACAddress");
  if (Object.keys(macs).length === 0) return null;

  let names = readColumn(host + "HostName");
  let ips = readColumn(host + "IPAddress");
  let actives = readColumn(host + "Active");

  let allowed = signalAllowed();
  let bySig = allowed
    ? signalsGated("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.TotalAssociations",
                   "AssociatedDeviceMACAddress", "SignalStrength")
    : {};

  let vendor = {};
  for (let suffix of allowed ? TR098_HOST_SIGNAL_VENDOR : []) {
    let col = readColumn(host + suffix);
    for (let base of Object.keys(col)) {
      let s = parseSignal(col[base]);
      if (s !== null && vendor[base] === undefined) vendor[base] = s;
    }
  }

  return buildRows(macs, names, ips, actives, function (base, mac) {
    let s = mac !== null ? bySig[mac] : undefined;
    if (s === undefined) s = vendor[base];
    return fmtSignal(s);
  });
}

function pad(s, n) {
  s = String(s);
  if (s.length > n) s = s.slice(0, n - 1) + "…";
  return s + " ".repeat(n - s.length);
}

function formatTable(rows) {
  let head = { name: "Host name", ip: "IP address", mac: "MAC address", signal: "Wi-Fi signal" };
  let all = [head].concat(rows);
  let width = function (key, max) {
    let w = 0;
    for (let r of all) w = Math.max(w, r[key].length);
    return Math.min(w, max);
  };
  let w = { name: width("name", MAX_NAME), ip: width("ip", 99), mac: width("mac", 99), signal: width("signal", 99) };

  let line = function (r) {
    return [pad(r.name, w.name), pad(r.ip, w.ip), pad(r.mac, w.mac), pad(r.signal, w.signal)]
      .join("  ")
      .replace(/\s+$/, "");
  };

  let sep = [w.name, w.ip, w.mac, w.signal].map(function (n) { return "-".repeat(n); }).join("  ");
  return [line(head), sep].concat(rows.map(line)).join("\n");
}

let rows = hostsTr181();
if (rows === null) rows = hostsTr098();

let text = rows === null ? "-" : rows.length === 0 ? "Nenhum dispositivo conectado" : formatTable(rows);

return { writable: false, value: [text, "xsd:string"] };
