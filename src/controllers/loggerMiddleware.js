'use strict'
const {createLogger, format, transports} = require('winston');
const { combine, timestamp, label, prettyPrint } = format;
const dailyRotateFile = require('winston-daily-rotate-file');
const maskdata = require('maskdata');
const consoleLog = new transports.File({'filename': 'combined.log'});
const errorLog = new transports.File({'filename' : 'errors.log'});

module.exports = {
    requestLogger: createRequestLogger([consoleLog]),
    //errorLogger: createErrorLogger([remoteLog, consoleLog])
    errorLogger: createErrorLogger([errorLog])
}

function createRequestLogger(transports) {

    /*const env = 'development';
    const requestLogger = createLogger ( {
        level: env === 'development' ? 'debug' : 'info',
        format: format.combine( format.timestamp ( { format: 'YYYY-MM-DD HH:mm:ss'}), format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`) ),
        transports: transports
    });*/

    const requestLogger = createLogger({
        transports: transports
    }); 
    var opts = { filename: 'wingsApiQuery-%DATE%.log', dirname: __dirname+'/'+'log', datePattern: 'YYYY-MM-DD' , zippedArchive: true, maxSize: '20m', maxFiles: '14d' };

    requestLogger.configure({transports: [new dailyRotateFile(opts) ] });
    

    return function logRequest(req, res, next) {

        const { rawHeaders, headers, socket:{remoteAddress, remoteFamily} } = req;
        var date1 = new Date().toUTCString();
        const maskOpt = { maskWith: '*', fields:['authorization']};
        //requestLogger.info({req, res});
        requestLogger.info('API Request logged at '+date1);
        requestLogger.info("Request - url,method,params,body,headers");
        //requestLogger.info(req);
        requestLogger.info(req.url);
        requestLogger.info(req.method);
        requestLogger.info(req.params);
        requestLogger.info(req.body);
        const maskH = maskdata.maskJSONFields(headers,maskOpt);
        requestLogger.info(maskH);
        requestLogger.info("Request Logging the socket data - remoteAddress, remoteFamily");
        requestLogger.info(remoteAddress);
        requestLogger.info(remoteFamily);
        requestLogger.info("Response - Type, Status Code");
        requestLogger.info(res.type);
        requestLogger.info(res.statusCode);
        requestLogger.info(res.body);
        requestLogger.info("-----------------------------------------------------------------------------------------------");
        next();
    }
}

function createErrorLogger(transports) {
    const errLogger = createLogger({
        level: 'error',
        transports: transports
    })   

    var opts = { filename: 'wingsapi-error-%DATE%.log', dirname: __dirname+'/'+'log', datePattern: 'YYYY-MM-DD' , zippedArchive: true, maxSize: '20m', maxFiles: '14d' };
    errLogger.configure({transports: [new dailyRotateFile(opts)]});

    return function logError(err, req, res, next) {
        var re = /Error: blacklist token/g;
        var execRes = re.exec(err);
        if ( execRes ) {
            err = "blacklisted token";
        }

        if ( res.headersSent ) {
            console.log("Did you pass by here ? Error ");
            console.log(err);
            return next(err);
        }
        errLogger.error({err})
        res.status(500).json({error : `${err}`});
        next();
    }
}

function getRequestLogFormatter() {
    const {combine, timestamp, printf} = format;

    return combine(
        timestamp()
    );
}
