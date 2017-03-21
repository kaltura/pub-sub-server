var ConnectionManager = require('./lib/ConnectionManager');
const continuationLocalStorage = require('continuation-local-storage');

require('./lib/utils/KalturaConfig');
require('./lib/utils/KalturaLogger');

function KalturaMainProcess(){
	this.start();
};

KalturaMainProcess.prototype.start = function () {

	this.namespace = continuationLocalStorage.createNamespace('push-server');//Here just to make sure we create it only once
	var version = KalturaConfig.config.server.version;
	KalturaLogger.log('\n\n_____________________________________________________________________________________________');
	KalturaLogger.log('Push-Server ' + version + ' started');
	
	var conn = new ConnectionManager();
	process.on('SIGUSR1', function() {
                KalturaLogger.log('Got SIGUSR1. Invoke log rotate notification.');
                KalturaLogger.notifyLogsRotate();
        });

};

module.exports.KalturaMainProcess = KalturaMainProcess;

var KalturaProcess = new KalturaMainProcess();
