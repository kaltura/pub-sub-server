const express = require('express');
const bodyParser = require('body-parser');
var ConnectionManager = require('../ConnectionManager');
require('./KalturaConfig');
require('./KalturaLogger');

class KalturaMonitor
{
    constructor ()
    {
        this.app = express();
        if(KalturaConfig.config.monitor && KalturaConfig.config.monitor.port && !isNaN(KalturaConfig.config.monitor.port))
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
                    'Allow': 'OPTIONS',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': allowedHeaders,
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Content-Type': 'text/html; charset=utf-8'
                });
                response.end();
            }
        );

        this.app.get('/admin/alive', function (req, res)
        {
                res.send('kaltura')
        });

        this.app.get('/version',
            function (request, response)
            {
                if(KalturaConfig.config.server && KalturaConfig.config.server.version) {
                    response.end(KalturaConfig.config.server.version + '\n');
                }
                else
                {
                    response.end('Version is missing from config \n');
                }
            }
        );

        this.app.get('/monitoring',
            function (request, response)
            {
                let serverInfo = '';
                let counters = ConnectionManager.getMonitorCounters();
                serverInfo += 'push_monitoring{check="CONNECTIONS"} ' + counters[0] + '\n' ;
                serverInfo += 'push_monitoring{check="MESSAGES"} ' + counters[1] + '\n' ;

                let errorConters = counters[2];
                for (var errorType in errorConters)
                {
                    serverInfo += 'push_monitoring{check="' + errorType +'"} ' + errorConters[errorType] + '\n';
                }

                KalturaLogger.monitor("VALUES: \n" + serverInfo);
                if (request.query.resetCounters && request.query.resetCounters == 'true')
                {
                    ConnectionManager.resetCounters();
                    KalturaLogger.monitor("Counters were reset");
                }

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
