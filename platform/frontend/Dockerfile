FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps apps
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/admin/dist /usr/share/nginx/html/admin
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html/web
COPY --from=build /workspace/apps/h5/dist /usr/share/nginx/html/h5
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -Y off -qO- http://127.0.0.1/healthz | grep ok
