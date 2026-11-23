// Virtual Parameter: PPPoEPassword
// Senha PPPoE da WAN. Serve para edição: a maioria das CPEs não devolve a senha na leitura.
// Editável: o valor digitado no GenieACS é gravado na CPE (vazio não é aceito).
// Usa a mesma interface do PPPoEUsername. Devolve "-" se o parâmetro não existir.
// ATENÇÃO: uma senha errada derruba a conexão e pode impedir a CPE de falar com o ACS.

try {
  function byInstance(a, b) {
    let x = (String(a).match(/\d+/g) || []).map(Number);
    let y = (String(b).match(/\d+/g) || []).map(Number);
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      if (x[i] !== y[i]) return x[i] - y[i];
    }
    return x.length - y.length;
  }

  function findBase(userPath) {
    let nodes = [];
    for (let node of declare(userPath, { value: 1 })) nodes.push(node);
    nodes.sort(function (a, b) { return byInstance(a.path, b.path); });
    for (let node of nodes) {
      if (node.value && node.value[0]) return node.path.replace(/\.Username$/, "");
    }
    return null;
  }

  let base = findBase("Device.PPP.Interface.*.Username");
  if (base === null) {
    base = findBase("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Username");
  }

  let node = base === null ? null : declare(base + ".Password", { value: 1 });
  let exists = node !== null && node.value !== undefined && node.value !== null && node.value[0] !== undefined && node.value[0] !== null;
  let type = exists && node.value[1] ? node.value[1] : "xsd:string";
  let shown = exists ? String(node.value[0]) : "-";

  let newValue = args[1] && args[1].value ? args[1].value[0] : undefined;

  if (exists && newValue !== undefined) {
    let s = String(newValue);
    if (s !== "" && s.length <= 256) {
      declare(base + ".Password", { value: 1 }, { value: [s, type] });
      // Não exibe a nova senha depois de gravar (a CPE a devolveria em branco de qualquer forma)
      shown = "";
    } else {
      log("PPPoEPassword: valor inválido ignorado (vazio ou maior que 256 caracteres)");
    }
  }

  return { writable: exists, value: [shown, "xsd:string"] };

} catch (err) {
  return { value: ["Erro: " + err.message, "xsd:string"] };
}
