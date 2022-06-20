const spawn  = require('child_process');

function execPromise(command,logger) {
    return new Promise(function(resolve, reject) {
        var execOutput = spawn.exec(command);
        console.log("Command "+command);
        execOutput.stdout.on('data', function(data) {
            logger.debug(data.toString());
        });
        execOutput.stderr.on('data',function(data) {
            logger.debug(data.toString());
        });

        execOutput.on('close', (code) => {
            if ( code == 0 ) {
                //console.log("code is 0 and closed");
                resolve('closed');
            } else {
                reject("error");
            }
            console.log(`child process exited with code ${code}`);
        });
   });
}

module.exports = { execPromise };
