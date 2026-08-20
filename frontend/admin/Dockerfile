FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# White-label branding (baked into the bundle — must be build args; see src/lib/brand.ts)
ARG NEXT_PUBLIC_BRAND_NAME=
ARG NEXT_PUBLIC_BRAND_DOMAIN=
ARG NEXT_PUBLIC_BRAND_LOGO=
ARG NEXT_PUBLIC_BRAND_SUPPORT_EMAIL=
ENV NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME
ENV NEXT_PUBLIC_BRAND_DOMAIN=$NEXT_PUBLIC_BRAND_DOMAIN
ENV NEXT_PUBLIC_BRAND_LOGO=$NEXT_PUBLIC_BRAND_LOGO
ENV NEXT_PUBLIC_BRAND_SUPPORT_EMAIL=$NEXT_PUBLIC_BRAND_SUPPORT_EMAIL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
