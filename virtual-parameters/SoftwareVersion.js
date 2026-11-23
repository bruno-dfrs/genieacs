// Virtual Parameter: SoftwareVersion
// Versão de software (firmware) da CPE. TR-181 primeiro; TR-098 como alternativa.
// Devolve "-" se não encontrar.

let paths = [
  "Device.DeviceInfo.SoftwareVersion",
  "InternetGatewayDevice.DeviceInfo.SoftwareVersion"
];

for (let path of paths) {
  let d = declare(path, {value: 1});
  if (d && d.value && d.value[0] && d.value[0].trim() !== "") {
    return {value: [d.value[0], "xsd:string"]};
  }
}

return {value: ["-", "xsd:string"]};
