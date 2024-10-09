#syntax=docker/dockerfile:1.7-labs

ARG NODE_VERSION=v20.13.1
ARG PUSH_VERSION=master

FROM scratch as git
ARG PUSH_VERSION

ADD https://github.com/kaltura-community/pub-sub-server.git#${PUSH_VERSION} /pub-sub-server

FROM kalturaa.jfrog.io/onprem-docker/kaltura-node:${NODE_VERSION} as build

COPY --from=git --exclude='deployment/' --exclude='package.lock.json' /pub-sub-server /pub-sub-server

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        git \
        python3 \
        ca-certificates

WORKDIR /pub-sub-server
     
RUN npm install

FROM kalturaa.jfrog.io/onprem-docker/kaltura-node:${NODE_VERSION}

ARG BASE_PATH=/
ARG PUSH_PATH=${BASE_PATH}pub-sub-server
ARG LOG_PATH=/var/log/pub-sub-server
ARG CONFIG_PATH=${PUSH_PATH}/config
ARG CACHE_PATH=${PUSH_PATH}/cache
ARG PUSH_USER=push
ARG PUSH_PORT=80

RUN apt-get install -y --no-install-recommends \
    libcap2-bin=1:2.44-1ubuntu0.22.04.1

COPY --from=build --parents \
    /pub-sub-server/node_modules \
    /pub-sub-server/main.js \
    /pub-sub-server/bin \
    /pub-sub-server/vendor \
    /pub-sub-server/lib \
    /pub-sub-server/package*.json \
    ${BASE_PATH}

COPY files/config.ini ${CONFIG_PATH}/config.ini
COPY files/entrypoint.sh /entrypoint.sh

ENV CONFIG_PATH=${CONFIG_PATH} \
    PUSH_RABBIT_MQ_NAME="push_server" \
    PUSH_RABBIT_MQ_USERNAME="kaltura" \
    PUSH_RABBIT_MQ_PASSWORD="kaltura" \
    PUSH_RABBIT_MQ_SERVER="http://rabbitmq:5675" \
    PUSH_SOCKET_IO_PORT=${PUSH_PORT} \
    PUSH_TOKEN_KEY="kaltura" \
    PUSH_TOKEN_IV="kaltura" \
    PUSH_MONITOR_PORT=8086

RUN setcap 'cap_net_bind_service=+ep' $(readlink -f $(which node)) && \
    groupadd -g 1000 ${PUSH_USER} && \
    useradd -d ${PUSH_PATH} -u 1000 -g 1000 ${PUSH_USER} && \
    mkdir -p ${LOG_PATH} && \
    mkdir -p ${CONFIG_PATH} && \
    mkdir -p ${CACHE_PATH} && \
    chown -R ${PUSH_USER}:${PUSH_USER} ${LOG_PATH} ${CONFIG_PATH} ${CACHE_PATH}

#USER ${PUSH_USER}
WORKDIR ${PUSH_PATH}

EXPOSE ${PUSH_PORT}

ENTRYPOINT [ "/entrypoint.sh" ]
CMD [ "node", "main.js" ]
