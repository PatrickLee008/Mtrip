# Mtrip finance-service(Hyperf 3.1 + Swoole 5)
FROM hyperf/hyperf:8.1-alpine-v3.18-swoole
LABEL maintainer="Mtrip" description="Mtrip finance-service"

ENV TIMEZONE=UTC \
    APP_ENV=prod \
    SCAN_CACHEABLE=true

RUN set -ex \
    && ln -sf /usr/share/zoneinfo/${TIMEZONE} /etc/localtime \
    && echo "${TIMEZONE}" > /etc/timezone

WORKDIR /opt/www

# 共享组件包(构建上下文须为 backend/ 根目录:docker build -f services/finance-service/Dockerfile .)
COPY shared /shared
COPY services/finance-service /opt/www

RUN composer install --no-dev --no-interaction --optimize-autoloader \
    && (php bin/hyperf.php di:init-proxy || true)

EXPOSE 9506

ENTRYPOINT ["php", "bin/hyperf.php", "start"]
