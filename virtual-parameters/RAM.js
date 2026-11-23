// Virtual Parameter: RAM
// Uso de memória RAM da CPE, em %: (Total - Free) / Total * 100. TR-181 primeiro; TR-098 como
// alternativa. Devolve "-" se não encontrar.

const now = Date.now();

const tr181 = {
  total: "Device.DeviceInfo.MemoryStatus.Total",
  free: "Device.DeviceInfo.MemoryStatus.Free"
};

const tr098 = {
  total: "InternetGatewayDevice.DeviceInfo.MemoryStatus.Total",
  free: "InternetGatewayDevice.DeviceInfo.MemoryStatus.Free"
};

function readNum(path) {
  let d = declare(path, { value: now });
  if (!d || !d.value) return null;

  let v = d.value[0];
  if (v === undefined || v === null || v === "") return null;

  let n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}

// Calcula o percentual de uso; null se os dados forem ausentes ou incoerentes
// (total menor ou igual a zero, ou memória livre negativa ou maior que o total)
function ramUsage(paths) {
  let total = readNum(paths.total);
  let free = readNum(paths.free);

  if (total === null || free === null) return null;
  if (total <= 0 || free < 0 || free > total) return null;

  return ((total - free) / total) * 100;
}

let usage = ramUsage(tr181);
if (usage === null) usage = ramUsage(tr098);

return { writable: false, value: [usage === null ? "-" : String(Math.round(usage)), "xsd:string"] };
