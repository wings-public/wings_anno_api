const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

/*const logDir = 'log';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
} */

console.log("********* REquest for logger ********* ");
var pid = process.pid;


/*var logFile = `logger-track-${pid}.log`;
//var path1 = path.parse(__dirname).dir;
var path1 = __dirname;
const filename = path.join(path1,logDir,logFile);
console.log("filename is "+filename); */
const env = 'development';

const logger = function logger(filename) {
    var options = {
        // change level if in dev environment versus production
        level: env === 'development' ? 'debug' : 'info',
        format: format.combine(
            format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss'
            }),
            format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
        ),
        transports: [
            new transports.Console({
                level: 'info',
                format: format.combine(
                    format.colorize(),
                    format.printf(
                        info => `${info.timestamp} ${info.level}: ${info.message}`
                    )
                )
            }),
            new transports.File({
                  filename : filename,
                  format : format.combine(
                      format.json(),
                      format.splat()
                  )
            })
        ]
    };
    return createLogger(options);
}

const loggerEnv = function loggerEnv(instance,logFile) {
    if ( instance == 'dev') {
        // Create the log directory if it does not exist
        const logDir = 'log';
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir);
        }
        filename = path.join(__dirname,logDir,logFile);
    } else {
        // env ( uat, prod ) will be using docker instance. Logs has to be created in the corresponding bind volumes defined in the docker-compose environment file
        // importLogPath will be defined in docker-compose environment variables section 
        filename = path.join(process.env.importLogPath,logFile);
    }
    return filename;
}

module.exports = { logger, loggerEnv }

