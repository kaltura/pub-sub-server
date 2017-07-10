## Pub-sub-server ##

Machine prerequisites:
=======================
- RabbitMq v3.6.6 (see instructions below).
- Git (For Ubuntu: https://www.digitalocean.com/community/tutorials/how-to-install-git-on-ubuntu-12-04)
- Node 6.2.0 or above: installation reference: https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager#ubuntu-mint-elementary-os
- Node Packaged Modules (npm) 1.4.3 or above
- NVM version 0.30.1 or above

Kaltura platform required changes:
=======================
- Please note that push-server needs version Lynx-12.11.0 at least for it to run. So if you are behind please update you Kaltura installation before continuing to any of the next steps.
- update local.ini file and set the push_server_host value to point to your push server hostname.
- make sure local.ini file and push-server's config.ini file contain the same configuration for both RabbitMQ and tokens (see below).

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

Increase concurrency:
=======================
Change sysctl and limits.d configration to support large amount of concurrent users:
		
	/etc/sysctl.conf:

		net.ipv4.ip_local_port_range = 2000 65535
		net.core.somaxconn = 1000000
		net.core.netdev_max_backlog = 65536
		net.core.optmem_max = 25165824
		net.ipv4.tcp_mem = 65536 131072 262144
		net.ipv4.udp_mem = 65536 131072 262144
		net.ipv4.tcp_rmem = 8192 87380 16777216
		net.ipv4.udp_rmem_min = 16384
		net.ipv4.tcp_wmem = 8192 65536 16777216
		net.ipv4.udp_wmem_min = 16384
		net.ipv4.tcp_max_tw_buckets = 1440000
		net.ipv4.tcp_tw_recycle = 1
		net.ipv4.tcp_tw_reuse = 1
		fs.file-max = 2097152
		fs.nr_open = 1000000
		net.netfilter.nf_conntrack_max = 1048576
		net.nf_conntrack_max = 1048576
		
	/etc/security/limits.d/custom.conf:
		
		root soft nofile 1000000
		root hard nofile 1000000
		* soft nofile 1000000
		* hard nofile 1000000
Upgrade:
=======================
- run /etc/init.d/kaltura_upgrade_push_server @RELEASE_ID@
- Example to upgrade to 1.0 you need to execute: /etc/init.d/kaltura_upgrade_push_server 1.0
- The upgrade will sync all the configuration files and will restart the service.
- Make sure that tokens in bin/push-server.sh file (PUB_SUB_PATH and LOG_PATH) are pointing to the correct paths


## rabbitMQ ##

Install:
=======================
1. erlang: 19 (for reference view https://www.rabbitmq.com/which-erlang.html).
2. rabbitMQ: 3.6.6 (for reference view https://www.rabbitmq.com/install-debian.html).


Setup:
=======================
1. Enable rabbitmq plugins: rabbitmq-plugins enable rabbitmq_management 
2. Open all relevant ports: http://www.rabbitmq.com/install-debian.html
		
		- 4369 (epmd)
		- 5672, 5671 (AMQP 0-9-1 and 1.0 without and with TLS)
		- 25672. This port used by Erlang distribution for inter-node and CLI tools communication and is allocated from a dynamic range (limited to a single port by default, computed as AMQP port + 20000). See networking guide for details.
		- 15672 (if management plugin is enabled)
		- 61613, 61614 (if STOMP is enabled)
		- 1883, 8883 (if MQTT is enabled)

3. Create rabbitMQ admin user

		- rabbitmqctl add_user @USER_NAME@ @PASSWORD@
		- rabbitmqctl set_user_tags @USER_NAME@ administrator
		- rabbitmqctl set_permissions -p / @USER_NAME@ ".*" ".*" ".*"
		
4. Add new policy (If running in cluster mode please follow cluster setup instruction before continuing):

		Go to rabbitmq Admin tab -> Policies tab -> add new policy
		Name: ha-all
		Apply to : Exchanges and queues
		Definition: Ha-mode: all
		ha-sync-mode: automatic
		
5. 	Create new exchange:

		Exchanges tab -> add a new exchange
		Name: kaltura_exchange
		type: fanout
		durability: durable
		auto delete: No
		internal: No
		
6. Create queues:

		Name: queue name according to each push-server configuration
		Durability: Dirable
		Node: choose one of the existing in the cluster
		Auto delete: No
		Arguments: x-message-ttl = 86400000 (24 hours)
		
Cluster Setup:
=======================
1. Configure same cookie on all rabbit machines: /var/lib/rabbitmq/.erlang.cookie
2. /etc/hosts – make sure each rabbitMachine can get to full and short name of other rabbit Machines in cluster.
3. On one rabbitMachine 

		rabbitmqctl -n rabbit stop_app
		rabbitmqctl -n rabbit join_cluster rabbit@otherRabbitHostName
		rabbitmqctl -n rabbit start_app
		
4. rabbitmqctl cluster_status – to verify that cluster is correctly connected.
5. If runign dual DC use federation to sync clusters between DC's: https://www.rabbitmq.com/federation.html