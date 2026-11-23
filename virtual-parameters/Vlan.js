// Virtual Parameter: Vlan
// VLAN da WAN: a primeira válida (1 a 4094) na ordem de prioridade; se só houver VLAN 0, devolve "0".
// Editável: o valor digitado no GenieACS (inteiro de 1 a 4094) é gravado na CPE.
// TR-181 primeiro; TR-098 como alternativa. Devolve "-" se não encontrar.
// ATENÇÃO: uma VLAN diferente da configurada na OLT/concentrador deixa a CPE sem conexão.

const now = Date.now();

const fresh = now - 24 * 60 * 60 * 1000;

const VENDOR_VLAN_PARAMS = ["X_HW_VLAN", "X_BROADCOM_COM_VlanMuxID", "X_ZTE-COM_VLANID"];

function val(p) {
  if (!p || !p.value) return null;
  let v = p.value[0];
  if (v === undefined || v === null) return null;
  v = String(v).trim();
  return v === "" ? null : v;
}

function toRef(p) {
  let raw = val(p);
  if (raw === null) return null;
  let n = parseInt(raw, 10);
  if (isNaN(n) || n < 0 || n > 4094) return null;
  return { path: p.path, vlan: n, type: (p.value && p.value[1]) || "xsd:unsignedInt" };
}

function readStr(path) {
  return val(declare(path, { value: fresh }));
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

function choose(refs) {
  let zero = null;
  for (let r of refs) {
    if (r.vlan >= 1) return r;
    if (zero === null) zero = r;
  }
  return zero;
}

// Na TR-181, a VLAN de uma interface IP/PPP fica no Device.Ethernet.VLANTermination que ela
// alcança descendo pela cadeia LowerLayers. Ordem das candidatas: as das interfaces IP, as das
// interfaces PPP e, por último, as VLANTerminations que nenhuma interface referencia (caso
// observado em TP-Link, com a VLAN em Device.Ethernet.VLANTermination.4.VLANID). Em cada
// grupo, vale a ordem dos números de instância.

// Desce pelos LowerLayers a partir de um objeto até achar um VLANTermination, com no máximo
// 6 níveis; null se não achar
function findVlanTermination(start) {
  let layer = start;
  for (let i = 0; i < 6 && layer; i++) {
    if (/^Device\.Ethernet\.VLANTermination\.\d+$/.test(layer)) return layer;
    layer = normPath(readStr(layer + ".LowerLayers"));
  }
  return null;
}

function refTr181() {
  let terms = [];
  function add(t) { if (t && terms.indexOf(t) === -1) terms.push(t); }

  for (let root of ["Device.IP.Interface", "Device.PPP.Interface"]) {
    let bases = [];
    for (let p of declare(root + ".*.LowerLayers", { value: fresh })) {
      bases.push(p.path.replace(/\.LowerLayers$/, ""));
    }
    for (let base of bases.sort(byInstance)) add(findVlanTermination(base));
  }

  let loose = [];
  for (let p of declare("Device.Ethernet.VLANTermination.*.VLANID", { value: fresh })) {
    loose.push(p.path.replace(/\.VLANID$/, ""));
  }
  for (let t of loose.sort(byInstance)) add(t);

  let refs = [];
  for (let t of terms) {
    let r = toRef(declare(t + ".VLANID", { value: fresh }));
    if (r !== null) refs.push(r);
  }
  return choose(refs);
}

// Na TR-098 não há parâmetro padrão de VLAN na conexão WAN: a leitura usa os nomes de
// VENDOR_VLAN_PARAMS (nessa ordem), nas conexões PPPoE e depois IPoE
function refTr098() {
  let refs = [];
  for (let type of ["WANPPPConnection", "WANIPConnection"]) {
    for (let suffix of VENDOR_VLAN_PARAMS) {
      let path = "InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*." + type + ".*." + suffix;
      let items = [];
      for (let p of declare(path, { value: fresh })) items.push(p);
      items.sort(function (a, b) { return byInstance(a.path, b.path); });
      for (let p of items) {
        let r = toRef(p);
        if (r !== null) refs.push(r);
      }
    }
  }
  return choose(refs);
}

let target = refTr181();
if (target === null) target = refTr098();

let newValue = args[1] && args[1].value ? args[1].value[0] : undefined;
let shown = target === null ? null : target.vlan;

if (target !== null && newValue !== undefined) {
  let s = String(newValue).trim();
  let n = /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
  if (n >= 1 && n <= 4094) {
    // Grava no parâmetro real mantendo o tipo original (inteiro ou texto)
    let v = /int|long/i.test(target.type) ? n : String(n);
    declare(target.path, { value: now }, { value: [v, target.type] });
    shown = n;
  } else {
    log("VLAN: valor inválido '" + s + "' ignorado (use um inteiro de 1 a 4094)");
  }
}

return { writable: target !== null, value: [shown === null ? "-" : String(shown), "xsd:string"] };
