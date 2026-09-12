FROM mysql:8.0

# Docker Desktop bind mounts may report an init .sh as executable while
# refusing its shebang. Copy it into the image so entrypoint sources it.
# Normalize Windows CRLF checkouts before MySQL reads the script.
COPY database/init/99-run-migrations.sh /docker-entrypoint-initdb.d/99z-run-migrations.sh
RUN sed -i 's/\r$//' /docker-entrypoint-initdb.d/99z-run-migrations.sh \
    && chmod 0644 /docker-entrypoint-initdb.d/99z-run-migrations.sh
