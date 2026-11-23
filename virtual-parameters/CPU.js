// Virtual Parameter: CPU
// Uso de CPU da CPE, em % (sem o símbolo). TR-181 primeiro; TR-098 como alternativa.
// Devolve "-" se não encontrar.

const now = Date.now();

const tr181Path = "Device.DeviceInfo.ProcessStatus.CPUUsage";
const tr098Path = "InternetGatewayDevice.DeviceInfo.ProcessStatus.CPUUsage";

function readCpu(path) {
  let d = declare(path, { value: now });
  if (!d || !d.value) return null;

  let v = d.value[0];
  if (v === undefined || v === null || v === "") return null;

  let n = parseFloat(String(v).replace(",", "."));
  if (isNaN(n) || n < 0 || n > 100) return null;

  return n;
}

let cpu = readCpu(tr181Path);
if (cpu === null) cpu = readCpu(tr098Path);

return { writable: false, value: [cpu === null ? "-" : String(Math.round(cpu)), "xsd:string"] };
