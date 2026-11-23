// Virtual Parameter: WANIP
// Endereço IPv4 da WAN. Vale o primeiro IP válido da lista de caminhos, na ordem; vazio,
// "0.0.0.0" e "127.0.0.1" são descartados. Devolve "-" se não encontrar.

const now = Date.now();
const day = now - 24 * 60 * 60 * 1000;

let paths = [
  "Device.PPP.Interface.*.IPCP.LocalIPAddress",
  "Device.PPP.Interface.*.IPAddress",
  
  "Device.IP.Interface.*.IPv4Address.*.IPAddress",

  "InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.ExternalIPAddress",
  "InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.ExternalIPAddress",
];

for (let path of paths) {
  // path: day  -> redescobre as instâncias no máximo uma vez por dia
  // value: now -> lê o IP na CPE a cada execução
  let nodes = declare(path, { path: day, value: now });

  for (let node of nodes) {
    if (node.value && node.value[0]) {
      let ip = String(node.value[0]).trim();

      if (ip === "" || ip === "0.0.0.0" || ip === "127.0.0.1") continue;

      // Nas interfaces IP em geral, descarta também os endereços típicos da LAN do cliente
      if (path.startsWith("Device.IP.Interface")) {
        if (ip.startsWith("192.168.") || ip === "10.0.0.1") continue;
      }

      return { value: [ip, "xsd:string"] };
    }
  }
}

return { value: ["-", "xsd:string"] };
