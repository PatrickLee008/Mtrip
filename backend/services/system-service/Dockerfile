# Mtrip system-service(Hyperf 3.1 + Swoole 5)
FROM hyperf/hyperf:8.1-alpine-v3.18-swoole
LABEL maintainer="Mtrip" description="Mtrip system-service"

ENV TIMEZONE=UTC \
    APP_ENV=prod \
    SCAN_CACHEABLE=true

RUN set -ex \
    && ln -sf /usr/share/zoneinfo/${TIMEZONE} /etc/localtime \
    && echo "${TIMEZONE}" > /etc/timezone

WORKDIR /opt/www

# 共享组件包(构建上下文须为 backend/ 根目录:docker build -f services/system-service/Dockerfile .)
# composer path 仓库为 ../../shared,对应容器内 /opt/www 的上两级 /shared
COPY shared /shared
COPY services/system-service /opt/www

RUN composer install --no-dev --no-interaction --optimize-autoloader \
    && (php bin/hyperf.php di:init-proxy || true)

EXPOSE 9501

ENTRYPOINT ["php", "bin/hyperf.php", "start"]
