// Virtual Parameter: Temperature
// Temperatura da CPE, em °C com 1 casa decimal. Vale a primeira fonte com valor válido:
// sensor do DeviceInfo ou transceiver óptico (TP-Link), na TR-181 e depois na TR-098.
// Devolve "-" se não encontrar.

const now = Date.now();

// Fontes, na ordem de prioridade. "divisors" são os divisores testados em ordem; vale o
// primeiro que resultar em temperatura plausível. Os dois formatos não se confundem: em
// 1/256 °C, uma CPE em operação devolve algo entre 5000 e 30000; em °C, entre 20 e 100.
const sources = [
  {
    path: "Device.DeviceInfo.TemperatureStatus.TemperatureSensor.*.Value",
    divisors: [1]
  },
  {
    path: "Device.Optical.Interface.*.X_TP_GPON_Config.TransceiverTemperature",
    divisors: [256]
  },
  {
    path: "InternetGatewayDevice.DeviceInfo.TemperatureStatus.TemperatureSensor.*.Value",
    divisors: [1]
  },
  {
    path: "InternetGatewayDevice.Optical.Interface.*.X_TP_GPON_Config.TransceiverTemperature",
    divisors: [1, 256]
  }
];

const MIN_C = -40;
const MAX_C = 150;

function readTemperature(src) {
  for (let p of declare(src.path, { value: now })) {
    if (!p.value) continue;

    let v = p.value[0];
    if (v === undefined || v === null || v === "") continue;

    let n = parseFloat(String(v).replace(",", "."));
    if (isNaN(n)) continue;

    for (let d of src.divisors) {
      let t = n / d;

      // Ignora 0 (valor fixo de sensor não implementado) e valores fora da faixa
      if (t === 0 || t < MIN_C || t > MAX_C) continue;

      return t;
    }
  }
  return null;
}

let temp = null;
for (let src of sources) {
  temp = readTemperature(src);
  if (temp !== null) break;
}

return { writable: false, value: [temp === null ? "-" : temp.toFixed(1), "xsd:string"] };
