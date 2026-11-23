// Provision: firmware_update
// Atualização automática de firmware, com uma única provision para vários modelos. Cada preset
// passa como argumentos as versões de hardware que atende:
//   Precondition: VirtualParameters.HardwareVersion = "<hw 1>" OR VirtualParameters.HardwareVersion = "<hw 2>"
//   Arguments:    "<hw 1>", "<hw 2>"   (os mesmos textos da precondition)
//
// A cada execução, não faz nada se: estiver fora da janela de horário; a HardwareVersion não
// puder ser lida ou não estiver nos argumentos (trava de segurança); o hardware não tiver regra
// na tabela; ou a CPE já estiver na versão mais recente aplicável. Caso contrário, pede o
// download do próximo firmware (uma vez por arquivo, nunca repete).
//
// Novo hardware: acrescente uma entrada em HARDWARES e crie um preset. Nova versão de firmware:
// acrescente uma release no fim da lista do hardware.

// Janela em que o upgrade é permitido: das 02:00:00 até 04:59:59 (às 05:00 em ponto já fecha).
const ENFORCE_WINDOW = true;       // false = ignora o horário (use só em testes)
const WINDOW_START_HOUR = 2;
const WINDOW_END_HOUR = 5;
const UTC_OFFSET_HOURS = -3;       // fuso do Brasil (Brasília). O servidor pode estar em UTC.

// Hardwares. A chave é o texto da VirtualParameters.HardwareVersion, o mesmo usado na
// precondition e no argumento do preset (maiúsculas/minúsculas e espaços repetidos são ignorados).
//   releases : em ordem CRESCENTE de versão.
//     version : versão que o arquivo instala (só números importam na comparação)
//     file    : nome EXATO do arquivo em Admin > Files
//     minFrom : versão mínima que o aparelho precisa ter para aceitar este arquivo
//               (null = qualquer versão anterior). Serve para upgrades em etapas.
const HARDWARES = {
  // ---------- Intelbras ----------
  "PON1200R_v3.0": {
    releases: [
      {
        version: "2.2-250203",
        file: "ONT1200R_inMesh_2.2-250203.tar",
        minFrom: null
      }
    ]
  },

  // ---------- TP-Link ----------
  "EX520 v1.0 00000000": {
    releases: [
      {
        version: "0.5.0 3.0.0 v60b4.0 Build 250730 Rel.72230n",
        file: "EX520_UP_BOOT_2025-07-31_11.34.16.bin",
        minFrom: null
      }
    ]
  },

  // Upgrade em duas etapas: o aparelho precisa passar pela etapa 1 antes de receber a etapa 2
  "XX530vV2 v2.0 00000001": {
    releases: [
      {
        // etapa 1
        version: "0.5.0 3.1.10 v60dc.0 Build 251104 Rel.42109n",
        file: "XX530vV2v2_0.5.0_3.1.10_UP_BOOT_agc3000(251104)_2025-11-04_13.28.02.bin",
        minFrom: null
      },
      {
        // etapa 2
        version: "0.8.0 3.2.2 v60dc.0 Build 260506 Rel.80666n",
        file: "XX530vV2v2_0.8.0_3.2.2_UP_BOOT_agc3000(260506)_2026-05-07_09.22.23.bin",
        minFrom: "0.5.0 3.1.10 v60dc.0 Build 251104 Rel.42109n"
      }
    ]
  },

  // ---------- Huawei EG8041X6-10 ----------
  "3F6D.D": {
    releases: [
      {
        version: "V5R024C10S110",
        file: "EG8145X6-10_ONTV500R024C10SPC106_all.bin",
        minFrom: null
      }
    ]
  },
  
  // ---------- Huawei EG8145X6-10 ----------
  "343D.D": {
    releases: [
      {
        version: "V5R024C10S110",
        file: "EG8145X6-10_ONTV500R024C10SPC106_all.bin",
        minFrom: null
      }
    ]
  },

  // ---------- TP-Link XX230v ----------
  "XX230v v1.0 00000000": {
    releases: [
      {
        version: "0.17.0 3.0.0",
        file: "XX230vv1_0.17.0_3.0.0_UP_BOOT_agc3000(250917)_2025-09-17_20.33.53 1.bin",
        minFrom: null
      }
    ]
  }
};

// ---------- TP-Link XC220-G3 ----------
// Duas revisões de hardware com o mesmo firmware: as releases ficam numa lista só
// e as duas chaves da tabela apontam para ela (editar aqui vale para as duas).
const XC220_G3_RELEASES = [
  {
    version: "1.8.0 0.8.0 v6062.0 Build 260401 Rel.14670n",
    file: "XC220-G3v1_1.8.0_0.8.0_UP_BOOT(260401)_2026-04-01_12.08.20.bin",
    minFrom: null
  }
];
HARDWARES["XC220-G3 v1.0 00000000"] = { releases: XC220_G3_RELEASES };
HARDWARES["XC220-G3 v1.0 00000001"] = { releases: XC220_G3_RELEASES };

const SW_PATHS = ["VirtualParameters.SoftwareVersion"];

const HW_PARAM = "VirtualParameters.HardwareVersion";

const now = Date.now();

// Grava a tag "fw_<motivo>" no ponto em que o script parou ("fw_pedido" quando pediu o
// download), para ver o resultado na página da CPE sem depender do log do ACS.
// Pode ser desligada com false.
const TRACE_TAGS = true;
function trace(why) {
  log("firmware_update: " + why);
  if (TRACE_TAGS) declare("Tags.fw_" + why, null, { value: true });
}

// Janela de horário, no fuso de UTC_OFFSET_HOURS (não depende do fuso do servidor)
if (ENFORCE_WINDOW) {
  let hour = new Date(now + UTC_OFFSET_HOURS * 3600 * 1000).getUTCHours();
  if (hour < WINDOW_START_HOUR || hour >= WINDOW_END_HOUR) {
    trace("fora_da_janela");
    return;
  }
}

function readFirst(paths) {
  for (let p of paths) {
    let d = declare(p, { value: now });
    if (d.value && d.value[0] !== undefined && d.value[0] !== null && String(d.value[0]).trim() !== "") {
      return String(d.value[0]).trim();
    }
  }
  return null;
}

// Números de uma versão: "0.16.0 3.0.0 v6066.0 Build 250423" -> [0,16,0,3,0,0,6066,0,250423]
function parts(v) { return (String(v).match(/\d+/g) || []).map(Number); }

// < 0 se a < b, 0 se igual, > 0 se a > b
function cmp(a, b) {
  let x = parts(a), y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    let d = (x[i] || 0) - (y[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

function clean(v) {
  return v === undefined || v === null ? null : String(v).trim().replace(/^["']+|["']+$/g, "");
}

// Forma comparável de uma versão de hardware: sem aspas, minúscula, espaços repetidos viram um só
function norm(v) {
  let s = clean(v);
  return s === null ? null : s.toLowerCase().replace(/\s+/g, " ").trim();
}

let hw = readFirst([HW_PARAM]);
if (hw === null) {
  trace("hardware_nao_confere");
  return;
}
let hwNorm = norm(hw);

// Trava de segurança: o hardware lido tem que estar entre os argumentos do preset
let allowed = (typeof args !== "undefined" && args ? args : []).map(norm).filter(function (a) { return a; });
if (allowed.indexOf(hwNorm) === -1) {
  log("firmware_update: HardwareVersion lida = '" + hw + "', argumentos = " + JSON.stringify(allowed));
  trace("hardware_nao_confere");
  return;
}

let hwKey = null;
for (let k of Object.keys(HARDWARES)) {
  if (norm(k) === hwNorm) hwKey = k;
}
if (hwKey === null) {
  log("firmware_update: sem regra para '" + hw + "'");
  trace("sem_regra_hardware");
  return;
}
let hardware = HARDWARES[hwKey];

let current = readFirst(SW_PATHS);
if (current === null) {
  trace("versao_desconhecida");
  return;
}

let next = null;
for (let r of hardware.releases) {
  let newer = cmp(r.version, current) > 0;                            // é mais nova que a atual
  let accepted = r.minFrom === null || cmp(current, r.minFrom) >= 0;  // o aparelho já aceita este arquivo
  if (newer && accepted) next = r;                                    // fica com a mais alta aplicável
}

if (next === null) {
  log("firmware_update: versão lida = '" + current + "'");
  trace("ja_atualizado");
  return;
}

// Download idempotente: cada FileName vira uma instância, que só dispara uma vez
log("firmware_update: " + hwKey + " " + current + " -> " + next.version + " (" + next.file + ")");
trace("pedido");
const sel = "Downloads.[FileType:1 Firmware Upgrade Image,FileName:" + next.file + "]";
declare(sel, { path: 1 }, { path: 1 });
declare(sel + ".FileName", { value: 1 }, { value: next.file });
declare(sel + ".Download", { value: 1 }, { value: now });
