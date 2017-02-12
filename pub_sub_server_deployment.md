Machine prerequisites:
=======================

- Git (For Ubuntu: https://www.digitalocean.com/community/tutorials/how-to-install-git-on-ubuntu-12-04)
- Node 0.10.26 or above: installation reference: https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager#ubuntu-mint-elementary-os
- Node Packaged Modules (npm) 1.4.3 or above

Kaltura platform required changes:
=======================
- Please note that push-server needs version Jupiter-10.14.0 at least for it to run. So if you are behind please update you Kaltura installation before continuing to any of the next steps.
- update local.ini file and set the push_server_host value to point to your push server hostname.
- make sure local.ini file and push-server's config.ini file contain the same configuration for both RabbitMQ and tokens (see below).

Code:
=======================
Clone https://github.com/kaltura/pub-sub-server to /opt/kaltura/pub-sub-server

Install:
=======================
- Navigate to /opt/kaltura/pub-sub-server
- npm install
- ln -s /opt/kaltura/push-server/bin/push-server.sh /etc/init.d/kaltura_push

Configure:
=======================
- Create a log directory, e.g. mkdir /opt/kaltura/log
- cp /opt/kaltura/push-server/config/config.ini.template /opt/kaltura/push-server/config/config.ini

Replace tokens in config.ini file:
=======================
- @LOG_DIR@ - Your logs directory from previous step (e.g. /opt/kaltura/log )
- @QUEUE_NAME@ - unique queueName for specific pub-sub-server as defined in rabbitMQ
- @RABBIT_MQ_USERNAME@ - Username of admin access to RabbitMQ management console (should be the same as configured in rabbit_mq.ini file)
- @RABBIT_MQ_PASSWORD@ - Password of admin access to RabbitMQ management console (should be the same as configured in rabbit_mq.ini file)
- @RABBIT_MQ_SERVER_HOSTS@ - comma separated hosts - rabbit cluster url and port – e.g. http://ny-rabbit.kaltura.com:5672 
- @SOCKET_IO_PORT@ - Required port for incoming requests to be given (e.g., 8081)
- @TOKEN_KEY@ - The same secret value configured in local.ini file (push_server_secret)
- @TOKEN_IV@ - The same iv value configured in local.ini file (push_server_secret_iv)

Execution:
=======================
/etc/init.d/kaltura_push start
