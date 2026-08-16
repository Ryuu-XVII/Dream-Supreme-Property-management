FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_PUBLIC_AGENCY_SLUG=dream-supreme-properties
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_PUBLIC_AGENCY_SLUG=$VITE_PUBLIC_AGENCY_SLUG
RUN npm run check

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-ratelimit.conf /etc/nginx/conf.d/ratelimit.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Run as the image's built-in non-root nginx user rather than root. nginx needs
# write access to its cache/run/log dirs and a writable pid file location even
# when only serving static files.
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid

USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
