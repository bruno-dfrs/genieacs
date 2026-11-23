# GenieACS – scripts e configurações

Este repositório reúne os *scripts* e as configurações criados para gerenciar remotamente as CPEs de uma provedora de internet, por meio do protocolo **CWMP (TR-069)** e do [GenieACS](https://genieacs.com/), um servidor ACS de código aberto.

Todo o material foi produzido durante um estágio supervisionado do Curso Superior de Tecnologia em Redes de Computadores do **Instituto Federal da Paraíba (IFPB)**.

## Conteúdo

- **Virtual parameters**: reúnem em um único parâmetro informações que cada fabricante guarda em caminhos diferentes dos *data models* **TR-181** (`Device.`) e **TR-098** (`InternetGatewayDevice.`). Assim, a interface exibe os mesmos campos, qualquer que seja o modelo da CPE.
- **Provisions**: mantêm os virtual parameters atualizados, marcam as CPEs que funcionam como satélites de redes *mesh* e cuidam da atualização automática de *firmware*.
- **Presets**: determinam em quais CPEs e em que momento cada provision é executada.
- **Interface**: configuração das colunas da *index page*, dos blocos da *device page* e do gráfico de status *online*.

## Estrutura

```
.
├── charts/
│   └── charts.yaml              
├── device-page/
│   └── device_page.yaml         
├── index-page/
│   └── index_page.yaml          
├── presets/
│   └── presets.csv              
├── provisions/
│   ├── firmware_update.js
│   ├── inform.js
│   ├── tag_satelites.js
│   ├── update_lanhosts.js
│   └── update_vparams.js
└── virtual-parameters/
    └── *.js                     # um arquivo por virtual parameter
```

## Virtual parameters

A busca é sempre feita na mesma ordem: primeiro na árvore **TR-181** e, se a informação não existir nela, na **TR-098**. Se nenhuma das duas tiver o dado, o parâmetro devolve `-`.

| Parâmetro | Descrição | Editável |
|---|---|:---:|
| `CPU` | Uso de CPU (%) | |
| `RAM` | Uso de memória RAM (%) | |
| `Temperature` | Temperatura da CPE (°C), pelo sensor padrão ou pelo *transceiver* óptico | |
| `Rx` / `Tx` | Potência óptica recebida / transmitida (dBm), com conversão de unidades | |
| `Uptime` | Tempo desde a última inicialização (`3d 4h 25m`) | |
| `Manufacturer` | Fabricante | |
| `HardwareVersion` | Versão de *hardware* | |
| `SoftwareVersion` | Versão de *firmware* | |
| `WANIP` | Endereço IPv4 da WAN | |
| `WANMAC` | Endereço MAC da WAN | |
| `PPPoEUsername` / `PPPoEPassword` | Usuário e senha da conexão PPPoE | ✓ |
| `Vlan` | VLAN da WAN | ✓ |
| `Wifi24SSID` / `Wifi5SSID` | Nome da rede Wi-Fi de 2,4 GHz / 5 GHz | ✓ |
| `Wifi24Password` / `Wifi5Password` | Senha da rede Wi-Fi | ✓ |
| `Wifi24Channel` / `Wifi5Channel` | Canal | ✓ |
| `Wifi24Bandwidth` / `Wifi5Bandwidth` | Largura do canal | ✓ |
| `LanHosts` | Tabela de dispositivos conectados à rede local (nome, IP, MAC e sinal Wi-Fi) | |

Ao editar um desses parâmetros na interface do GenieACS, o novo valor é gravado diretamente no parâmetro correspondente da CPE.

## Provisions

| Provision | O que faz |
|---|---|
| `update_vparams` | Lê novamente os dados brutos da CPE e recalcula todos os virtual parameters, com exceção do `LanHosts` |
| `update_lanhosts` | Recalcula somente o `LanHosts`, que fica isolado dos demais por ser mais lento e mais sujeito a falhas |
| `tag_satelites` | Identifica as CPEs que atuam como satélites de uma rede *mesh*, pelo endereço do `ConnectionRequestURL`, e as marca com a *tag* `Satelite` |
| `firmware_update` | Instala automaticamente novas versões de *firmware*, seguindo uma tabela de versões por modelo de *hardware* |
| `inform` | Versão da provision padrão do GenieACS, com o intervalo entre *Informs* periódicos ampliado de 300 para 600 segundos |

As provisions `bootstrap` e `default` vêm com a instalação do GenieACS e não foram modificadas, por isso não fazem parte do repositório.

### Atualização automática de firmware

- Uma mesma provision serve a todos os modelos. Cada **preset** seleciona as CPEs pela `VirtualParameters.HardwareVersion` e repassa essa versão como argumento, que o *script* confere antes de agir, para impedir que um *firmware* seja instalado no *hardware* errado.
- As atualizações são disparadas pelo evento `1 BOOT` e só acontecem **entre 02:00 e 04:59** (horário de Brasília).
- No início do *script*, a tabela `HARDWARES` indica, para cada *hardware*, as versões disponíveis, o nome do arquivo no GenieACS e a versão mínima necessária, o que torna possível atualizar em etapas.
- **Os arquivos de *firmware* não fazem parte deste repositório.** É preciso enviá-los ao GenieACS (*Admin → Files*) com o nome exato que aparece na tabela.

Para adicionar um modelo, basta incluir uma entrada em `HARDWARES` e criar um preset para ele.

## Presets

O `presets/presets.csv` é uma exportação dos presets do GenieACS. Como cada um tem seu próprio canal (*channel*), uma provision que falhe em uma CPE não impede a execução das outras. Todos usam peso 0 e nenhum tem agendamento.

## Como usar

Tudo pode ser recriado pela interface web do GenieACS, no menu **Admin**:

1. **Virtual Parameters**: crie um parâmetro para cada arquivo, com o nome do arquivo sem o `.js`, e cole o *script*.
2. **Provisions**: crie uma provision para cada arquivo, com o mesmo nome, e cole o conteúdo.
3. **Presets**: cadastre os presets com os campos do `presets.csv` (nome, canal, peso, eventos, precondição, provision e argumentos).
4. **Config**: configure a *index page*, a *device page* e os *charts* de acordo com os arquivos `.yaml`.
