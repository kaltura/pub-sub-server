const express = require('express');
const bodyParser = require('body-parser');
var ConnectionManager = require('../ConnectionManager');
require('./KalturaConfig');

class KalturaMonitor
{
    constructor ()
    {
        this.app = express();
        if(KalturaConfig.config.monitor && KalturaConfig.config.monitor.port)
        {
            this.app.listen(KalturaConfig.config.monitor.port, this.onStart.bind(this));
        }
        else
        {
            KalturaLogger.error("ENOPORT - No port defined in configuration file for monitoring");
        }
    }

    onStart()
    {
        this.app.use(function (req, res, next)
        {
            next();
        });
        this.app.use(bodyParser.urlencoded(
            {
            extended: true,
            verify: function (req, res, body) {
                req.rawBody = body.toString();
            }
        }));

        this.app.options('/*',
            function (request, response)
            {
                let allowedHeaders = '*';
                if (request.get('Access-Control-Request-Headers'))
                    allowedHeaders = request.get('Access-Control-Request-Headers');
                response.set({
                    'Allow': 'POST, OPTIONS',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': allowedHeaders,
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Content-Type': 'text/html; charset=utf-8'
                });
                response.end();
            }
        );

        this.app.get('/alive', function (req, res)
        {
                res.send('Pub Sub server monitor alive \n')
        });

        this.app.get('/server-status',
            function (request, response)
            {
                let serverInfo = '';
                serverInfo += 'connectionsCounter ' + ConnectionManager.getConnectionsCounter() + '\n' ;
                serverInfo += 'messagesCounter ' + ConnectionManager.getMessagesCounter() + '\n' ;
                response.send(serverInfo);
                response.end();
            }
        );

        this.app.all('/*', function (req, res)
        {
            res.status(400).send('Unsupported request \n');
        });
    }
}

module.exports = KalturaMonitor;
