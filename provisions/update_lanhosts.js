// Provision: update_lanhosts
// Atualiza apenas o virtual parameter LanHosts, que fica fora da update_vparams.

const now = Date.now();

declare("VirtualParameters.LanHosts", {value: now});
