FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY client ./client
COPY server ./server
COPY shared ./shared
COPY public ./public
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=4173 HOST=0.0.0.0 SPIRE_DATA=/data SPIRE_ORIGIN=http://localhost:4173
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/dist ./dist
EXPOSE 4173
VOLUME ["/data"]
CMD ["npm","start"]
