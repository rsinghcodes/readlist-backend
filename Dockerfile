FROM node:latest
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["/bin/bash", "-c", "npm run build;npm start"]
