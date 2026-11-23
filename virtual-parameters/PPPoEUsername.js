// Virtual Parameter: PPPoEUsername
// Usuário PPPoE da WAN. Editável: o valor digitado no GenieACS é gravado na CPE.
// Vale o primeiro Username preenchido (TR-181 primeiro; TR-098 como alternativa), a mesma regra
// do PPPoEPassword. Devolve "-" se não encontrar.
// ATENÇÃO: um usuário errado derruba a conexão e pode impedir a CPE de falar com o ACS.

try {
  function byInstance(a, b) {
    let x = (String(a).match(/\d+/g) || []).map(Number);
    let y = (String(b).match(/\d+/g) || []).map(Number);
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      if (x[i] !== y[i]) return x[i] - y[i];
    }
    return x.length - y.length;
  }

  function findUser(path) {
    let nodes = [];
    for (let node of declare(path, { value: 1 })) nodes.push(node);
    nodes.sort(function (a, b) { return byInstance(a.path, b.path); });
    for (let node of nodes) {
      if (node.value && node.value[0]) {
        return { path: node.path, value: String(node.value[0]), type: node.value[1] || "xsd:string" };
      }
    }
    return null;
  }

  let target = findUser("Device.PPP.Interface.*.Username");
  if (target === null) {
    target = findUser("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Username");
  }

  let newValue = args[1] && args[1].value ? args[1].value[0] : undefined;
  let shown = target === null ? "-" : target.value;

  if (target !== null && newValue !== undefined) {
    let s = String(newValue).trim();
    if (s !== "" && s.length <= 256) {
      declare(target.path, { value: 1 }, { value: [s, target.type] });
      shown = s;
    } else {
      log("PPPoEUsername: valor inválido ignorado (vazio ou maior que 256 caracteres)");
    }
  }

  return { writable: target !== null, value: [shown, "xsd:string"] };

} catch (err) {
  return { value: ["Erro: " + err.message, "xsd:string"] };
}
