# Usar a imagem oficial do Node.js
FROM node:18-alpine

# Instala curl e outras dependências essenciais
RUN apk add --no-cache curl

# Definir diretório de trabalho dentro do container
WORKDIR /app

# Copiar o restante dos arquivos
COPY . /app

# Instalar dependências
RUN npm install

CMD rm docker-compose.yml docker-compose-local.yml
# Expor a porta do servidor
EXPOSE 3000

# Definir comando de execução
CMD ["node", "server.js"]
