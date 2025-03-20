const express = require("express");
const axios = require("axios");
require("dotenv").config(); // Carrega variáveis de ambiente

const app = express();
app.use(express.json());

const GLOBALPING_API = "https://api.globalping.io/v1/measurements";
const API_TOKEN = process.env.GLOBALPING_API_TOKEN; // Obtém o token da variável de ambiente
const TOKEN_AUTH = process.env.TOKEN_AUTH; // Obtém o token da variável de ambiente
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
            limit,
            ipVersion,
            packets,
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
        const reqData = {
            type: "ping",
            target: target,
            locations: [{ country:selectedCountry, limit: parseInt(selectedLimit) }],
            measurementOptions
        };
        const response = await axios.post(GLOBALPING_API, reqData, { headers });

        const { id } = response.data;
        console.log(`Teste iniciado para ${target}, MEASUREMENT: ${id}` , JSON.stringify({'request':reqData, 'response': response.data}));

        const result = await waitForResult(id, headers);
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

app.listen(3000, () => {
    console.log("Servidor rodando na porta 3000 🚀");
});
