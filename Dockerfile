FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY client ./client
COPY server ./server
COPY shared ./shared
COPY public ./public
COPY scripts/prepare-voice-assets.mjs ./scripts/prepare-voice-assets.mjs
COPY scripts/generate-third-party-notices.mjs ./scripts/generate-third-party-notices.mjs
COPY documents/voice-assets.lock.json ./documents/voice-assets.lock.json
COPY LICENSE NOTICE CREDITS.md THIRD_PARTY_NOTICES.md ./
RUN npm run prepare:voice && npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=4173 HOST=0.0.0.0 SPIRE_DATA=/data SPIRE_ORIGIN=http://localhost:4173 SPIRE_WHISTLE_MODEL=/app/voice/models/whistle.cact
WORKDIR /app
RUN apk add --no-cache ffmpeg
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/dist ./dist
COPY --from=build /app/public/voice ./voice
COPY LICENSE NOTICE CREDITS.md THIRD_PARTY_NOTICES.md ./
EXPOSE 4173
VOLUME ["/data"]
CMD ["npm","start"]
