// Virtual Parameter: WANMAC
// MAC da interface WAN, em maiúsculas e separado por ":". TR-181 primeiro (a partir da interface
// da rota padrão); TR-098 como alternativa. Devolve "-" se não encontrar.

const now = Date.now();

const fresh = now - 24 * 60 * 60 * 1000;

function val(p) {
  if (!p || !p.value) return null;
  let v = p.value[0];
  if (v === undefined || v === null) return null;
  v = String(v).trim();
  return v === "" ? null : v;
}

function readStr(path) {
  return val(declare(path, { value: fresh }));
}

function normPath(v) {
  if (!v) return null;
  let s = String(v).split(",")[0].trim().replace(/\.$/, "");
  return s === "" ? null : s;
}

function cleanMac(v) {
  if (!v) return null;
  if (!/^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/.test(v)) return null;
  let mac = v.toUpperCase().replace(/-/g, ":");
  return mac === "00:00:00:00:00:00" ? null : mac;
}

function wanMacTr181() {
  // 1) Descobre a interface IP da rota padrão: rota com destino vazio ou 0.0.0.0 e habilitada
  //    (sem o parâmetro Enable, a rota é considerada habilitada)
  let ipIface = null;
  for (let p of declare("Device.Routing.Router.*.IPv4Forwarding.*.Interface", { value: fresh })) {
    let target = normPath(val(p));
    if (!target) continue;

    let base = p.path.replace(/\.Interface$/, "");
    let dest = readStr(base + ".DestIPAddress");
    let enabled = readStr(base + ".Enable");

    if ((dest === null || dest === "0.0.0.0") && enabled !== "false" && enabled !== "0") {
      ipIface = target;
      break;
    }
  }
  if (!ipIface) return null;

  // 2) Desce pela cadeia LowerLayers (ex.: IP.Interface -> PPP.Interface -> VLANTermination
  //    -> Ethernet.Link) até um Ethernet.Link ou Ethernet.Interface, com no máximo 6 níveis
  let layer = ipIface;
  for (let i = 0; i < 6 && layer; i++) {
    if (/^Device\.Ethernet\.(Link|Interface)\.\d+$/.test(layer)) {
      return cleanMac(readStr(layer + ".MACAddress"));
    }
    layer = normPath(readStr(layer + ".LowerLayers"));
  }
  return null;
}

function wanMacTr098() {
  let fallback = null;

  for (let type of ["WANPPPConnection", "WANIPConnection"]) {
    let path = "InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*." + type + ".*.MACAddress";
    for (let p of declare(path, { value: fresh })) {
      let mac = cleanMac(val(p));
      if (!mac) continue;

      let status = readStr(p.path.replace(/\.MACAddress$/, ".ConnectionStatus"));
      if (status === "Connected") return mac;
      if (fallback === null) fallback = mac;
    }
  }
  if (fallback) return fallback;

  let linkPath = "InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANEthernetLinkConfig.MACAddress";
  for (let p of declare(linkPath, { value: fresh })) {
    let mac = cleanMac(val(p));
    if (mac) return mac;
  }
  return null;
}

let mac = wanMacTr181();
if (mac === null) mac = wanMacTr098();

return { writable: false, value: [mac === null ? "-" : mac, "xsd:string"] };
