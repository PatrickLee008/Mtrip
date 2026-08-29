# Mtrip order-service(Hyperf 3.1 + Swoole 5)
FROM hyperf/hyperf:8.1-alpine-v3.18-swoole
LABEL maintainer="Mtrip" description="Mtrip order-service"

ENV TIMEZONE=UTC \
    APP_ENV=prod \
    SCAN_CACHEABLE=true

RUN set -ex \
    && ln -sf /usr/share/zoneinfo/${TIMEZONE} /etc/localtime \
    && echo "${TIMEZONE}" > /etc/timezone

WORKDIR /opt/www

# 共享组件包(构建上下文须为 backend/ 根目录:docker build -f services/order-service/Dockerfile .)
COPY shared /shared
COPY services/order-service /opt/www

# 国内网络构建加速:COMPOSER_MIRROR 非空时切换 packagist 镜像源(dist 包不再回源 GitHub)
# 默认空 = 官方 packagist,生产/海外构建行为完全不变
ARG COMPOSER_MIRROR=""
RUN if [ -n "$COMPOSER_MIRROR" ]; then composer config -g repos.packagist composer "$COMPOSER_MIRROR"; fi \
    && composer install --no-dev --no-interaction --optimize-autoloader --no-security-blocking \
    && (php bin/hyperf.php di:init-proxy || true)

EXPOSE 9504

ENTRYPOINT ["php", "bin/hyperf.php", "start"]
