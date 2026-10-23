FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node dist ./dist
COPY --chown=node:node backend ./backend
COPY --chown=node:node api ./api
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node server.mjs ./server.mjs
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:4173/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server.mjs"]
