# Usar a imagem oficial do Node.js
FROM node:18-alpine

# Definir diretório de trabalho dentro do container
WORKDIR /app

# Copiar o restante dos arquivos
COPY . /app

# Instalar dependências
RUN npm install

# Expor a porta do servidor
EXPOSE 3000

# Definir comando de execução
CMD ["node", "server.js"]
