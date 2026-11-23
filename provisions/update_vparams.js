// Provision: update_vparams
// Atualiza os virtual parameters: relê da CPE os parâmetros brutos que alimentam a telemetria
// (uptime, MAC da WAN e temperatura) e depois recalcula todos os virtual parameters, exceto o
// LanHosts, que é atualizado pela provision update_lanhosts.

log("===== TELEMETRY/VP PROVISION INICIO =====");

const now = Date.now();

// TR-181 se a CPE expõe Device.DeviceInfo.UpTime; caso contrário, TR-098
let isTR181 = declare("Device.DeviceInfo.UpTime", {value: 1}).value !== undefined;

const telemetryMap = [
  {
    label: "Uptime do Equipamento",
    tr181: "Device.DeviceInfo.UpTime",
    tr098: "InternetGatewayDevice.DeviceInfo.UpTime"
  },
  {
    label: "Endereço MAC da WAN",
    tr181: "Device.Ethernet.Link.*.MACAddress",
    tr098: "InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.*.*.MACAddress"
  },
  {
    label: "Temperatura (sensor padrão DeviceInfo)",
    tr181: "Device.DeviceInfo.TemperatureStatus.TemperatureSensor.*.Value",
    tr098: "InternetGatewayDevice.DeviceInfo.TemperatureStatus.TemperatureSensor.*.Value"
  },
  {
    label: "Temperatura (transceiver óptico)",
    tr181: "Device.Optical.Interface.*.X_TP_GPON_Config.TransceiverTemperature",
    tr098: "InternetGatewayDevice.Optical.Interface.*.X_TP_GPON_Config.TransceiverTemperature"
  }
];

log("ETAPA 1 OK - iniciando refresh telemetry");

for (let item of telemetryMap) {
  let targetPath = isTR181 ? item.tr181 : item.tr098;
  if (targetPath) {
    declare(targetPath, {value: now});
  }
}

log("ETAPA 2 - iniciando Virtual Parameters");

declare("VirtualParameters.Manufacturer", {value: now});
declare("VirtualParameters.HardwareVersion", {value: now});
declare("VirtualParameters.SoftwareVersion", {value: now});

declare("VirtualParameters.PPPoEUsername", {value: now});
declare("VirtualParameters.PPPoEPassword", {value: now});
declare("VirtualParameters.Vlan", {value: now});
declare("VirtualParameters.WANIP", {value: now});
declare("VirtualParameters.WANMAC", {value: now});

declare("VirtualParameters.Uptime", {value: now});

declare("VirtualParameters.Rx", {value: now});
declare("VirtualParameters.Tx", {value: now});

declare("VirtualParameters.CPU", {value: now});
declare("VirtualParameters.RAM", {value: now});
declare("VirtualParameters.Temperature", {value: now});

declare("VirtualParameters.Wifi24SSID", {value: now});
declare("VirtualParameters.Wifi24Password", {value: now});
declare("VirtualParameters.Wifi24Channel", {value: now});
declare("VirtualParameters.Wifi24Bandwidth", {value: now});

declare("VirtualParameters.Wifi5SSID", {value: now});
declare("VirtualParameters.Wifi5Password", {value: now});
declare("VirtualParameters.Wifi5Channel", {value: now});
declare("VirtualParameters.Wifi5Bandwidth", {value: now});

log("===== TELEMETRY/VP PROVISION FIM =====");
