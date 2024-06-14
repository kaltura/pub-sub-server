require('./utils/KalturaConfig');
require('./utils/KalturaLogger');
require('./utils/KalturaPushServerErrors');

const os = require('os');
const kalturaPushServerValidator = require('./utils/KalturaPushServerValidator');
const util = require('util');
const QueueManager = require('./QueueManager');
const CacheManager = require('./CacheManager');
const clearEventCommand = 'CLEAR_QUEUE';
const ipRestrict = 'iprestrict';
const hostname = os.hostname();
const { Server } = require("socket.io");

const DEFAULT_ROOM = '/';

let connectionManagerInstance = null;
let connectionsCounter = 0;
let messagesCounter = 0;

let errorCounters = {
    INCORRECT_QUERY_DETAILS : 0,
    USER_VERIFICATION_ERROR : 0,
    AVAILABLE_MESSAGES_ERROR : 0,
    PARSE_KEY_ERROR : 0,
    MESSAGE_DATA_PARSING_ERROR : 0,
    TOKEN_DECRYPTION_ERROR : 0,
    MISSING_CONFIGURATION_PARAMETER : 0
};

class ConnectionManager {

    constructor() {
        try {
            this.cacheManager = new CacheManager();
            this.socketIoServer = null;
            this.queueManager = null;
            kalturaPushServerValidator.validateConfigurations(KalturaConfig.config);
            this.queueName = KalturaConfig.config.queue.queueName;
            this._init();
	    connectionManagerInstance = this;
        }
        catch(err){
            KalturaLogger.error("EXITING: " + KalturaPushServerErrors.CONNECTION_MANAGER_INIT_ERROR + ": " + util.inspect(err));
            process.exit(1);
        }
    }

    _init() {
        let This = this;
        //Connect and listen to queue before making server available for connections.
        this.queueManager = new QueueManager(function () {
            if (!This._hasRoomInSocketServer(This.queueName)) {
                This.queueManager.addMessageListener(This.queueName, function (message) {
                    return This._onMessage(message);
                });
            }
        });

        this._startServer();
    }

    _hasRoomInSocketServer(roomName){
        let rooms = null;
        try {
            rooms = this.socketIoServer.of(DEFAULT_ROOM).adapter.rooms;
        }
        catch (err) {
            KalturaLogger.error("Error while trying to get rooms from socket server: " + util.inspect(err));
            process.exit(1);
        }

        return rooms;
    }

     _startServer() {
        let port = KalturaConfig.config.socketio.port;
        const io = new Server({
            wsEngine: require("eiows").Server,
            allowEIO3: true,
            transports: ['polling', 'websocket'],
            allowUpgrades: true,
            path: '/',
            cookie: {
                name: 'push',
            }
          });
        this.socketIoServer = io.listen(parseInt(port, 10));
        this.socketIoServer.sockets.setMaxListeners(0);

        let This = this;

        this.socketIoServer.on('connection', function (socket) {
            KalturaLogger.log("New socket with id [" + socket.id + "] connected");
            This._onClientConnects(socket);
            socket.on('listen', handleSocketListen);
            socket.on('error', handleSocketError);
            socket.on('disconnect', handleSocketDisconnect);
            socket.on('unlisten', handleSockentNotListening);
        });
    };

    _onError(socket , msg, disconnect) {
        if (msg instanceof Error)
                socket.emit('errorMsg', msg.message);
        else
                socket.emit('errorMsg', msg);
        KalturaLogger.error("[" + socket.id + "]" + msg);
        if (disconnect) {
            socket.disconnect();
        }
    };

    _onClientConnects(socket) {
        let query = socket.handshake.query;
        KalturaLogger.log("New connection [" + socket.id + "] query: " + util.inspect(query));
        if (!query.b && (!query.p || !query.x)) {
            increaseErrorCounter('INCORRECT_QUERY_DETAILS');
            this._onError(socket, KalturaPushServerErrors.INCORRECT_QUERY_DETAILS, true);
        }
        else {
            if (query.b) {
                if (query.b == KalturaConfig.config.tokens.key) {
                    KalturaLogger.log("New socket with id [" + socket.id + "] created for a user connected from demo");
                    socket.alreadyValidated = true;
                    socket.emit('validated', {"X-ME" : hostname});
                    connectionsCounter++;
                }
                else {
                    increaseErrorCounter('USER_VERIFICATION_ERROR');
                    this._onError(socket, KalturaPushServerErrors.USER_VERIFICATION_ERROR, true);
                }
            }
            else if (this._validateClient(query.p, query.x, socket)) {
                KalturaLogger.log("New socket with id [" + socket.id + "] created.");
                socket.emit('validated', {"X-ME" : hostname});
                connectionsCounter++;
            }
            else {
                increaseErrorCounter('USER_VERIFICATION_ERROR');
                this._onError(socket, KalturaPushServerErrors.USER_VERIFICATION_ERROR, true);
            }
        }
    }

    onClientDisconnects(socket) {
        KalturaLogger.log('User with socket id [' + socket.id + '] has disconnected.');
	socket.disconnect();
        connectionsCounter--;
    }

    _onClientNotListening(socket, queueKeyStr) {
        try {
            let queueKey = this._parseKey(queueKeyStr, socket);
            if (socket.rooms.hasOwnProperty(queueKey))
            {
                socket.leave(queueKey);
                KalturaLogger.log('User is now NOT listening to socket [' + socket.id + '] and room [' + queueKey + ']');
            }
            else
            {
                KalturaLogger.log('Trying to leave room [' + queueKey + '], but not joined on that room');
            }

        } catch (err) {
            this._onError(socket, err, false);
        }
    }

    _connectionError(socketId, type, expected, given) {
        KalturaLogger.error('[' + socketId + '] A connection with incorrect ' + type + ' was attempted! (expected: [' + expected + '], given: [' + given + '])');
     }

    _validateClient(partnerId, token, socket) {
        let b64string = Buffer.from(token, 'base64');
        let params = b64string.toString('utf8').split(":");
        let pId = params[0];
        if (partnerId !== pId) {
            this._connectionError(socket.id, 'partnerId', partnerId, pId);
            return false;
        }
        try {
            let tokens;
            tokens = JSON.parse(this._decrypt(params[1], false));
            if (tokens.key !== KalturaConfig.config.tokens.key) {
                this._connectionError(socket.id, 'key', KalturaConfig.config.tokens.key, tokens.key);
                return false;
            }
            let privileges = tokens.ksPrivileges.split(",");
            for (let i = 0; i < privileges.length; i++) {
                if ( privileges[i].startsWith(ipRestrict))
                {
                    let ipRestrictionPrivilege = privileges[i].split(":");
                    let clientIp = this._getClientIp(socket.request);
                    if (ipRestrictionPrivilege[1] !== clientIp) {
                        this._connectionError(socket.id, 'client IP', ipRestrictionPrivilege[1], clientIp);
                        return false;
                    }
                }
            }

            if (tokens.ksExpiry) {
                let ksExpiry = parseInt(tokens.ksExpiry, 10);
                let now = new Date().now;
                if (ksExpiry < now) {
                    this._connectionError(socket.id, 'Ks expiry', ksExpiry, now);
                    return false;
                }
            }
	    KalturaLogger.debug("[" +socket.id + "] Setting hash for new socket to: " + tokens.hash);
            socket.myHash = tokens.hash;
            return true;
        }
        catch (err) {
	    KalturaLogger.error("[" + socket.id + "] " +KalturaPushServerErrors.TOKEN_DECRYPTION_ERROR + util.inspect(err));
	    increaseErrorCounter('TOKEN_DECRYPTION_ERROR');
  	    return false;
        }
    }

    _getClientIp(req) {
        let res;
        if (req.headers['x-forwarded-for']) {
            res = req.headers['x-forwarded-for'].split(',')[0];
        }
        else if (req.connection.remoteAddress) {
            res = req.connection.remoteAddress;
        }
        else{
            res = socket.handshake.address;
        }

        if (res.substr(0, 7) == "::ffff:") {
            res = res.substr(7);
        }
        return res;
    }

    _onClientListens(socket, eventNameStr, queueKeyStr) {

        try {
            let queueKey = null;
            let eventName = null;

            if (socket.alreadyValidated) {
                eventName = eventNameStr;
                queueKey = queueKeyStr;
            } else {
                eventName = this._parseKey(eventNameStr, socket);
                queueKey = this._parseKey(queueKeyStr, socket);
            }
	    
	    //prevent a socket to join same room twice
	    if (socket.rooms && !socket.rooms.hasOwnProperty(queueKey))
            {
		 socket.join(queueKey);
	    }

            socket.emit('connected', queueKey, queueKeyStr);
            KalturaLogger.log('User is now listening to ' + queueKey);
            this._sendAvailableMessages(socket.id, eventName, queueKey);

        } catch (err) {
            //We log an error and send it back to socket but we do not close connection since socket might listen to more keys.
            this._onError(socket, err, false);
        }
    };

    _sendAvailableMessages(socketId, eventKey, clientKey) {
        KalturaLogger.log("[" + socketId + "] Sending Available Messages to client: " + clientKey + " for event: " + eventKey);
        try {
            // TODO - handle pagination if we have very large messages.
            let res = this.cacheManager.getMessages(eventKey, clientKey);
            for (let i = 0; i < res.length; i++) {
                let messageData = JSON.parse(res[i].data);
                this.socketIoServer.to(socketId).emit('message', clientKey, [messageData]);
            }
        }
        catch (err) {
            KalturaLogger.error("[" + socketId + "] " + KalturaPushServerErrors.AVAILABLE_MESSAGES_ERROR  + ", " + util.inspect(err));
            increaseErrorCounter('AVAILABLE_MESSAGES_ERROR');
        }
    }

    _onMessage(message) {
        let messageAsString;
        try {
            messageAsString = String.fromCharCode.apply(null, new Uint8Array(message.data));
            KalturaLogger.log("Message received: " + messageAsString);
            let messageObj = JSON.parse(messageAsString);
            messagesCounter++;

            this._handleMessage( messageObj);
        }
        catch (err) {
            KalturaLogger.error("Could not handle received message: " + messageAsString + " " + util.inspect(err));
        }
    }
    _handleMessage(messageObj) {
        let eventKey = messageObj.queueName;
        let messageId = messageObj.msgId;
        let messageTiming = messageObj.msgTime;
        let eventMessageKey = messageObj.queueKey;
        let messageData;
        try {
            messageData = JSON.parse(messageObj.data);
        }catch(err){
            increaseErrorCounter('MESSAGE_DATA_PARSING_ERROR');
            throw new Error(KalturaPushServerErrors.MESSAGE_DATA_PARSING_ERROR + ": " + util.inspect(messageObj.data));
        }

        if (messageObj.command &&  messageObj.command == clearEventCommand && eventKey ) {
            KalturaLogger.log("Received Clear event command for event [" + eventKey + "]");
            this.cacheManager.clearEventFromCache(eventKey);
            return;
        }

        if (!this.cacheManager.shouldHandleMessage(messageId, messageTiming)) {
            KalturaLogger.log("No need to handle received message.");
            return;
        }

        KalturaLogger.log("Message received for key: " + eventMessageKey);
        this.socketIoServer.sockets.in(eventMessageKey).emit('message', eventMessageKey, [messageData]);

        this.cacheManager.addMessageToCache(eventKey, eventMessageKey, messageId, messageTiming, messageObj );
    }

    _decrypt(data, shouldSplit) {
        let crypto = require('crypto');

        let decipher = crypto.createDecipheriv('aes-128-cbc', KalturaConfig.config.tokens.key, KalturaConfig.config.tokens.iv);
        let chunks = [];
        chunks.push(decipher.update(data.toString(), 'hex', 'binary'));
        chunks.push(decipher.final('binary'));
        let dec = chunks.join('');

        if (shouldSplit)
            dec = dec.split(":");

        return dec;
    };

    _parseKey(token, socket) {
        try {
            let tokens;
            tokens = this._decrypt(token, true);
            
            if (!socket.validated && tokens[1] !== socket.myHash) {
                this._connectionError(socket.id, 'hash', socket.myHash, tokens[1]);
                increaseErrorCounter('PARSE_KEY_ERROR');
                throw new Error(KalturaPushServerErrors.PARSE_KEY_ERROR);
            }
            
            socket.validated = true;
            return tokens[0];
        }
        catch (err) {
            KalturaLogger.error("[" + socket.id + "] " +KalturaPushServerErrors.TOKEN_DECRYPTION_ERROR + " : " + util.inspect(token) + " - " +  util.inspect(err));
            increaseErrorCounter('TOKEN_DECRYPTION_ERROR');
            throw new Error(KalturaPushServerErrors.TOKEN_DECRYPTION_ERROR);
        }
    };
}

    function handleSocketListen(eventName, queueKey) {
        connectionManagerInstance._onClientListens(this, eventName, queueKey);
    }

    function handleSocketError(err){
        KalturaLogger.error("[" + this.id +"] " + err);
    }

    function handleSocketDisconnect() {
        connectionManagerInstance.onClientDisconnects(this);
     }

    function handleSockentNotListening(queueKey) {
        connectionManagerInstance._onClientNotListening(this, queueKey);
    }

    function getMonitorCounters()
    {
        return [connectionsCounter, messagesCounter, errorCounters];
    }

    function resetCounters()
    {
        messagesCounter = 0;
        for (var i in errorCounters)
        {
            errorCounters[i] = 0;
        }
    }

    function increaseErrorCounter(errorType)
    {
        if(errorCounters[errorType] !== undefined && errorCounters[errorType] !== null)
        {
            errorCounters[errorType]++;
        }
    }

module.exports = ConnectionManager;
module.exports.resetCounters = resetCounters;
module.exports.getMonitorCounters = getMonitorCounters;
module.exports.increaseErrorCounter = increaseErrorCounter;