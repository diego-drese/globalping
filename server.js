const express = require("express");
const axios = require("axios");
require("dotenv").config(); // Carrega variáveis de ambiente

const app = express();
app.use(express.json());

const GLOBALPING_API = "https://api.globalping.io/v1/measurements";
const API_TOKEN = process.env.GLOBALPING_API_TOKEN;
const TOKEN_AUTH = process.env.TOKEN_AUTH;

console.log("🔑 GLOBALPING_API_TOKEN:", API_TOKEN);
console.log("🔒 TOKEN_AUTH:", TOKEN_AUTH);

const isValidTarget = (target) => {
    const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3}$/;
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9]))$/;
    const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-_]{1,63}\.)+[a-zA-Z]{2,63}$/;

    return {
        isIPv4: ipv4Regex.test(target),
        isIPv6: ipv6Regex.test(target),
        isDomain: domainRegex.test(target)
    };
};
app.get("/test", async (req, res) => {
    try {
        const {
            target,
            token,
            country,
            cities,
            limit,
            ipVersion,
            packets,
            format
        } = req.query;

        if(token!==TOKEN_AUTH){
            return res.status(400).json({ error: "Token de autenticação inválido" });
        }

        if (!target) {
            return res.status(400).json({ error: "Target (IP ou domínio) é obrigatório" });
        }

        const { isIPv4, isIPv6, isDomain } = isValidTarget(target);
        const selectedCountry = country || "BR";
        const selectedLimit = limit || 10;
        const selectedFormat = format || 'default'
        const selectedIpVersion = ipVersion || 4;
        const selectedPackets = packets || 3;

        if (!isIPv4 && !isIPv6 && !isDomain) {
            return res.status(400).json({ error: "Target inválido. Deve ser um IP ou domínio válido." });
        }

        // Apenas se for domínio adicionamos ipVersion
        const measurementOptions = {
            packets: parseInt(selectedPackets)
        };

        if (isDomain) {
            measurementOptions.ipVersion = parseInt(selectedIpVersion); // Apenas domínios usam ipVersion
        }

        const headers = API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {};
        let locations = [];

        if (Array.isArray(cities)) {
            locations = cities.map(city => ({ country: selectedCountry, city }));
        } else if (cities) {
            locations = [{ country: selectedCountry, city: cities }];
        } else {
            locations = [{ country: selectedCountry, limit: parseInt(selectedLimit) }];
        }

        const reqData = {
            type: "ping",
            target: target,
            locations: locations,
            measurementOptions
        };
        console.log(`Teste iniciado para ${target}` , JSON.stringify({'request':reqData}));
        const response = await axios.post(GLOBALPING_API, reqData, { headers });

        const { id } = response.data;
        console.log(`Teste iniciado para ${target}, MEASUREMENT: ${id}` , JSON.stringify({'request':reqData, 'response': response.data}));

        const result = await waitForResult(id, headers);
        const simplified = result.results.map(r => ({
            target: result.target,
            ip: r.result.resolvedAddress,
            host: r.result.resolvedHostname,
            country: r.probe.country,
            city: r.probe.city,
            latitude: r.probe.latitude,
            longitude: r.probe.longitude,
            network: r.probe.network,
            avg_rtt: r.result.stats.avg,
            packet_loss: r.result.stats.loss
        }));

        if (selectedFormat === "zabbix") {
            return res.json(simplified);
        }

        if (selectedFormat === "csv") {
            const fields = Object.keys(simplified[0] || {});
            const csv = [
                fields.join(","), // Cabeçalho
                ...simplified.map(obj => fields.map(f => `"${(obj[f] ?? "")}"`).join(","))
            ].join("\n");

            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", `attachment; filename="ping-result-${Date.now()}.csv"`);
            return res.send(csv);
        }

        res.json(result);
    } catch (error) {
        console.error("Erro ao iniciar teste:", error.response?.data || error.message);
        res.status(500).json({ error: "Erro ao iniciar o teste" });
    }
});

// Função para ficar verificando se o teste foi finalizado
async function waitForResult(measurementId, headers) {
    const STATUS_API = `${GLOBALPING_API}/${measurementId}`;

    while (true) {
        try {
            const resultResponse = await axios.get(STATUS_API, { headers });
            const resultData = resultResponse.data;
            if (resultData.status === "finished") {
                return resultData;
            }
        } catch (error) {
            console.error("Erro ao buscar id:"+STATUS_API+" resultado:", error.response?.data || error.message);
        }
        await new Promise(resolve => setTimeout(resolve, 5000)); // Espera 5 segundos antes de tentar de novo
    }
}

app.get("/info", (req, res) => {
    // Captura o domínio onde o serviço está hospedado
    const protocol = req.headers.protocol || "http";
    const host = req.headers.host || "localhost:3000";

    const apiInfo = {
        name: "Globalping API Service",
        description: "Este serviço permite testar a conectividade de IPs e domínios utilizando a API Globalping.",
        documentation: `${protocol}://${host}/info`,
        endpoints: [
            {
                route: "/test",
                method: "GET",
                description: "Executa um teste de conectividade (ping) para um IP ou domínio.",
                parameters: {
                    "token (obrigatório)": "Token de autenticação",
                    "target (obrigatório)": "Endereço IP ou domínio a ser testado.",
                    "country (opcional, padrão: BR)": "Define o país de origem do teste.",
                    "limit (opcional, padrão: 5)": "Número máximo de localidades para executar o teste.",
                    "ipVersion (opcional, padrão: 4)": "Define a versão do IP (4 ou 6). Só é necessário se o target for um domínio.",
                    "packets (opcional, padrão: 3)": "Número de pacotes a serem enviados no teste."
                },
                example_request: `${protocol}://${host}/test?target=google.com&country=US&limit=10&ipVersion=6&packets=5`,
                example_response: {
                    name: "Globalping API Response",
                    description: "Esta é a estrutura de resposta da rota /test, que retorna os resultados de um teste de conectividade (ping).",
                    example_request: `${protocol}://${host}/test?target=google.com`,
                    response_structure: {
                        id: "Identificador único do teste.",
                        type: "Tipo de teste realizado (exemplo: 'ping').",
                        status: "Status do teste (exemplo: 'finished', 'running').",
                        createdAt: "Data e hora de criação do teste.",
                        updatedAt: "Data e hora da última atualização do teste.",
                        target: "O IP ou domínio que foi testado.",
                        probesCount: "Número de probes (localizações) utilizadas no teste.",
                        locations: [
                            {
                                country: "País de origem do teste.",
                                limit: "Número máximo de localizações utilizadas."
                            }
                        ],
                        results: [
                            {
                                probe: {
                                    continent: "Continente onde o teste foi realizado.",
                                    region: "Região geográfica do teste.",
                                    country: "País onde o teste foi realizado.",
                                    state: "Estado onde o teste foi realizado (se disponível).",
                                    city: "Cidade onde o teste foi realizado.",
                                    asn: "Número de Sistema Autônomo (ASN) da rede onde o teste foi feito.",
                                    longitude: "Coordenada geográfica de longitude do local do teste.",
                                    latitude: "Coordenada geográfica de latitude do local do teste.",
                                    network: "Nome da operadora ou rede do local do teste.",
                                    tags: "Tags adicionais sobre a rede.",
                                    resolvers: "Lista de resolvedores DNS utilizados."
                                },
                                result: {
                                    status: "Status do teste ('finished', 'failed', etc.).",
                                    rawOutput: "Saída bruta do comando ping.",
                                    resolvedAddress: "Endereço IP resolvido para o teste.",
                                    resolvedHostname: "Hostname resolvido do IP (se aplicável).",
                                    timings: [
                                        {
                                            ttl: "Time-To-Live (TTL) do pacote recebido.",
                                            rtt: "Tempo de ida e volta (Round Trip Time - RTT) em milissegundos."
                                        }
                                    ],
                                    stats: {
                                        min: "Tempo mínimo de resposta (RTT mínimo).",
                                        max: "Tempo máximo de resposta (RTT máximo).",
                                        avg: "Tempo médio de resposta (RTT médio).",
                                        total: "Total de pacotes enviados.",
                                        loss: "Percentual de pacotes perdidos.",
                                        rcv: "Número de pacotes recebidos.",
                                        drop: "Número de pacotes descartados."
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            {
                route: "/info",
                method: "GET",
                description: "Retorna informações sobre a API e como utilizá-la."
            }
        ],
        environment: {
            GLOBALPING_API_TOKEN: process.env.GLOBALPING_API_TOKEN ? "Definido ✅" : "Não definido ❌",
            TOKEN_AUTH: process.env.TOKEN_AUTH ? "Definido ✅" : "Não definido ❌"
        }
    };

    res.json(apiInfo);
});

app.listen(3000, () => {
    console.log("Servidor rodando na porta 3000 🚀");
});
