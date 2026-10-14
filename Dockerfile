FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node backend ./backend
COPY --chown=node:node supabase/migrations ./supabase/migrations
ENV NODE_ENV=production APP_ENV=staging BACKEND_MODE=supabase HOST=0.0.0.0 PORT=8787 AUTH_EMAIL_ENABLED=false PAYMENTS_ENABLED=false PRODUCTION_LAUNCH_APPROVED=false
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=8s --start-period=15s --retries=3 CMD node backend/scripts/container-health.mjs
CMD ["node", "backend/server.mjs"]
