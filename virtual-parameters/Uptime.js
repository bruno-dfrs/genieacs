// Virtual Parameter: Uptime
// Tempo desde a última inicialização da CPE, ex.: "3d 4h 25m". TR-181 primeiro; TR-098 como
// alternativa. Devolve "-" se não encontrar.

try {
  let paths = [
    "Device.DeviceInfo.UpTime",
    "InternetGatewayDevice.DeviceInfo.UpTime"
  ];

  for (let path of paths) {
    let d = declare(path, {value: 1});
    
    if (d && d.value && d.value[0] !== undefined && d.value[0] !== "") {
      
      let seconds = parseInt(d.value[0], 10);
      
      if (!isNaN(seconds)) {
        let dNum = Math.floor(seconds / (3600 * 24));
        let hNum = Math.floor((seconds % (3600 * 24)) / 3600);
        let mNum = Math.floor((seconds % 3600) / 60);
        
        let result = dNum + "d " + hNum + "h " + mNum + "m";
        return {value: [result, "xsd:string"]};
      }
    }
  }
  return {value: ["-", "xsd:string"]};

} catch (err) {
  return {value: ["Erro: " + err.message, "xsd:string"]};
}
