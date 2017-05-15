Machine prerequisites:
=======================
- Git (For Ubuntu: https://www.digitalocean.com/community/tutorials/how-to-install-git-on-ubuntu-12-04)
- Node 6.2.0 or above: installation reference: https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager#ubuntu-mint-elementary-os
- Node Packaged Modules (npm) 1.4.3 or above
- NVM version 0.30.1 or above

Kaltura platform required changes:
=======================
- Please note that push-server needs version Lynx-12.11.0 at least for it to run. So if you are behind please update you Kaltura installation before continuing to any of the next steps.
- update local.ini file and set the push_server_host value to point to your push server hostname.
- make sure local.ini file and push-server's config.ini file contain the same configuration for both RabbitMQ and tokens (see below).

Repo:
=======================
https://github.com/kaltura/pub-sub-server

Install:
=======================
- Clone https://github.com/kaltura/pub-sub-server to /opt/kaltura/pub-sub-server/master
- Navigate to /opt/kaltura/pub-sub-server/master
- npm install
- ln -s /opt/kaltura/pub-sub-server/master /opt/kaltura/pub-sub-server/latest
- ln -s /opt/kaltura/pub-sub-server/latest/bin/push-server.sh /etc/init.d/kaltura_push
- ln -s /opt/kaltura/pub-sub-server/latest/bin/upgrade-push-server.sh /etc/init.d/kaltura_upgrade_push_server

Configure:
=======================
- Create a log directory, e.g. mkdir /opt/kaltura/log/pub-sub-server
- cp -p /opt/kaltura/pub-sub-server/latest/config/config.ini.template /opt/kaltura/pub-sub-server/latest/config/config.ini

Replace tokens in config.ini file:
=======================
- @LOG_DIR@ - Your logs directory from previous step (e.g. /opt/kaltura/log )
- @RABBIT_MQ_USERNAME@ - Username of admin access to RabbitMQ management console (should be the same as configured in rabbit_mq.ini file)
- @RABBIT_MQ_PASSWORD@ - Password of admin access to RabbitMQ management console (should be the same as configured in rabbit_mq.ini file)
- @RABBIT_MQ_SERVER_HOSTS@ - rabbit cluster url and port – e.g. http://ny-rabbit.kaltura.com:5672 
- @SOCKET_IO_PORT@ - Required port for incoming requests to be given (e.g., 8081)
- @TOKEN_KEY@ - The same secret value configured in local.ini file (push_server_secret)
- @TOKEN_IV@ - The same iv value configured in local.ini file (push_server_secret_iv)
- @QUEUE_NAME@ - unique queueName as defined in rabbitMQ

Modify tokens bin/push-server.sh file:
=======================
make sure that PUB_SUB_PATH and LOG_PATH are pointing to the correct paths

Execution:
=======================
/etc/init.d/kaltura_push start

Upgrade:
=======================
- run /etc/init.d/kaltura_upgrade_push_server @RELEASE_ID@
- Example to upgrade to 1.0 you need to execute: /etc/init.d/kaltura_upgrade_push_server 1.0
- The upgrade will sync all the configuration files and will restart the service.
- Make sure that tokens in bin/push-server.sh file (PUB_SUB_PATH and LOG_PATH) are pointing to the correct paths
