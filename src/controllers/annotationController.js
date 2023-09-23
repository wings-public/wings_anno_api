const spawn  = require('child_process');
const customAnnoConfig = require('../config/customAnno.json');
var fs = require('fs');
//const fsPro = require('fs').promises;
const path = require('path');
const promisify = require('util').promisify;
const unlink = promisify(fs.unlink);
const { stat,rmdir, rm, readdir } = require('fs/promises');
const configData = require('../config/config.js');
const { app : {tmpPurgeWeeks} } = configData;

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

const writeFile = (pathNew, data, opts = 'utf8') => 
    new Promise((resolve, reject) => {
        fs.writeFile(pathNew, data, opts, (err) => {
            if (err) reject(err)
            else resolve()
        })
})

// Creates temp directory in the provided annoLoc path
const createTmpDir = async (annoLoc,appPrefix) => {
    try {
        //mode: 0o77
        var tmpDir = fs.mkdtempSync(path.join(annoLoc, appPrefix));
        //fs.chmodSync(tmpDir, 0o666);
        fs.chmodSync(tmpDir, 0o777);
        return tmpDir;
    } catch (err) {
        throw err;
    } finally {
        console.log("delete temp folder will be added here later...")
    }
}

const customVepConfig = async(annoFields,assemblyType,confFile) => {
    var fields = annoFields.split('-');
    var generic = customAnnoConfig['generic']['default'];
    var generic_data = generic.join('\n');
    console.log("************************* customVepConfig ****************** ")
    console.log(`assemblyType:${assemblyType}`)
    var fasta = customAnnoConfig[assemblyType]['fasta'];
    var assembly_tmp = customAnnoConfig[assemblyType]['assembly'];
    generic_data = generic_data + '\n' + fasta + '\n' + assembly_tmp;

    for ( var idx in fields ) {
        var fname = fields[idx];
        if ( fname == "MaxEntScan") {
            var data = customAnnoConfig['generic'][fname]['plugin'];
            generic_data = generic_data + '\n' + data;
        } else if ( fname == "Encode" ) {
            var tmp = customAnnoConfig['generic'][fname]['plugin'];
            var cell_t = customAnnoConfig['generic'][fname]['cell_type'];
            generic_data = generic_data + '\n' + tmp + '\n' + cell_t;
        } else if ( fname == "RNACentral" ) {
            var tmp = customAnnoConfig['generic'][fname]['custom'][assemblyType];
            generic_data = generic_data + '\n' + tmp;
        }
    }
    console.log("**********************************")
    console.log(generic_data);
    console.log(__dirname);
    //var parsePath = path.parse(__dirname).dir;
    //console.log(`parsePath:${parsePath}`);
    //var parsePath = path.join(vepLoc,'import');
    try {
        console.log(`confFile:${confFile}`)
        console.log(generic_data)
        await writeFile(confFile,generic_data);
    } catch(err) {
        console.log("Logging error from writeFile")
        console.log(err);
    }
    
}

// check and delete the file passed as input
const checkDelFile = async(file) => {
    // include a check for _completed or _err or checksum file
    console.log(`checking for file ${file}`);
    if (fs.existsSync(file) ) {
        console.log(`deleting file ${file}`);
        //fsPro.unlink(file);
        await unlink(file);
        console.log(`deleted file ${file}`);
    }
    return "deleted";
}
const findByName = async (dir, name) => {
    const matchedFiles = [];

    const files = await readdir(dir);

    for (const file of files) {
        // Method 2:
        if (file.startsWith(name)) {
            matchedFiles.push(file);
        }
    }

    return matchedFiles;
};

const purgeDir = async (directory, pattern) => {
    var files = await findByName(directory,pattern);
    //var seconds = 10;
    // 1 week
    var seconds = tmpPurgeWeeks * 604800;
    console.log(files);
    const currentTime = Math.floor(new Date().getTime() / 1000);
    for ( const file of files ) {
        const filePath = path.join(directory, file);
        var stats = await stat(filePath);
        const birthTime = Math.floor(stats.birthtimeMs / 1000);
        console.log(`birthTime:${birthTime}`);
        console.log(`currentTime:${currentTime}`);
        console.log(currentTime - birthTime);
        console.log(seconds);
        if ((currentTime - birthTime) > seconds) {
            console.log("Logged directory will be deleted");
            console.log("*****************************Logged directory ******************");
            console.log(filePath);
            rm(filePath, { recursive: true, force: true });
            //rmdir(filePath);
        }
    }
    return "purge_done";
}

module.exports = { execPromise, customVepConfig , checkDelFile, createTmpDir,purgeDir};
