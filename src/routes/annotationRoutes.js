const spawn  = require('child_process');
const runningProcess = require('is-running');
var path = require('path');
const configData = require('../config/config.js');
const { db : {stackCompose,caddInput, caddOutput,vepInput,vepOutput,parsedAnno,vepConf1,vepConf2,vepParserIp,vepParserOp,caddParserIp,caddParserOp,caddCores,annoLoc} } = configData;
const fs = require('fs');
const { createWriteStream , createReadStream , existsSync } = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const loginRequired = require('../controllers/userControllers.js').loginRequired;
var loggerMod = require('../controllers/loggerMod');

const execPromise = require('../controllers/annotationController.js').execPromise;
const customVepConfig = require('../controllers/annotationController.js').customVepConfig;
const checkDelFile = require('../controllers/annotationController').checkDelFile;
const createTmpDir = require('../controllers/annotationController').createTmpDir;
// changes specific to streams backpressure, usage of pipeline
const stream = require('stream');
const { purgeDir } = require('../controllers/annotationController.js');
const pipeline = util.promisify(stream.pipeline);
// stream pipeline

const annotationRoutes = (app) => {
    // route updated : request params added to request body
    app.route('/deployStack/:fileID')
    //app.route('/deployStack/:sid/:assembly')
    .post( loginRequired, async (req,res,next) => {
        // Request body contains the VCF Sample ID and VCF File Path/VCF URL

        // Level 1 Processing
        var parsePath = path.parse(__dirname).dir;

        var logFile = path.join(parsePath,'routes','log',`deploy-stack-logger-${id}-${pid}.log`);
        var createLog = loggerMod.logger(logFile);
        
        createLog.debug("/deployStack request");
        //console.log(req);
        const params = req.query;
        createLog.debug(params);
        createLog.debug(req.query.assembly)
        createLog.debug(req.params.fileID);
        //assembly=GRCh38&annotations=VEP-CADD&config=true

        var id = parseInt(req.params.fileID);
        var assemblyType = req.query.assembly;
        var config = req.query.config;
        
        var annoFields = "";
        if ( req.query.annoFields ) {
            annoFields = req.query.annoFields;
        }

        var vepConfig = "";
        if ( assemblyType == "GRCh37" ) {
            vepConfig = `./${vepConf1}`;
        } else if ( assemblyType == "GRCh38" ) {
            vepConfig = `./${vepConf2}`;
        }
        var pid = process.pid;
        
        var inputFile = `${vepParserIp}/${id}_novel_variants.vcf.gz`;
        var inputFile1 = `${caddParserIp}/${id}_novel_variants.vcf.gz`;
        var varFile = `${id}_novel_variants.vcf`;
        //res.status(200).json({'message': "Stack Deployed"});
        try {
            // check and purge any old temp directories
            // change prefix from anno to annoTmp 
            //var purgeStats = await purgeDir(annoLoc,'annoTmp')
            var purgeStats = await purgeDir(annoLoc,'annoTmp');
            // create temp directory
            var appPrefix = `annoTmp-${id}-`;
            var tmpDir = await createTmpDir(annoLoc,appPrefix);
            console.log(`Logging created temp directory ${tmpDir}`);

            var file1 = `${tmpDir}/vep_completed`;
            var file2 = `${tmpDir}/vep_err`;
            var vep_op_file = `${tmpDir}/vep_novel_anno.json`;
            var file3 = `${tmpDir}/cadd_completed`;
            var file4 = `${tmpDir}/cadd_err`;
            var cadd_op_file = `${tmpDir}/cadd_novel_anno.tsv.gz`

            // Novel Variants variants for which Annotations has to be generated will be uploaded in the Request
            // Novel Variants has to be streamed to a file and copied to the expected mount points based on the Annotation Source.
            //req.pipe(createWriteStream(inputFile));
            var VEP_CMD = "";
            var CADD_CMD = "";
            var annoArr = [];
            var annoSrcObj = {};

            
            // We will introduce a wrapper within the VEP/CADD docker which launches the actual VEP command.
            if ( req.query.VEP ) {
                createLog.debug("VEP selected");
                // check and delete _completed and _err files

                //await checkDelFile(file1);
                //await checkDelFile(file2);
                if ( config == "false" ) {
                    createLog.debug("config false option")
                    vepConfig = `${vepParserIp}/${id}_conf.ini`;
                    console.log(`annoFields:${annoFields}`);
                    createLog.debug("call customVepConfig function")
                    createLog.debug(`annoFields:${annoFields} assemblyType:${assemblyType} vepConfig:${vepConfig}`);
                    await customVepConfig(annoFields,assemblyType,vepConfig)
                    //await pipeline(req,createWriteStream(vepConfig));
                }

                await pipeline(req,createWriteStream(inputFile));
                createLog.debug("novel variants input has been written to vep input location");
                var VEP_TMP_CMD = `./vep --config ${vepConfig} -i ${vepInput}/${id}_novel_variants.vcf.gz -o ${vep_op_file} && touch ${file1} || touch ${file2}`;
                
                if ( config == "false" ) {
                    VEP_TMP_CMD = `./vep --config ${vepInput}/${id}_conf.ini -i ${vepInput}/${id}_novel_variants.vcf.gz -o ${vep_op_file} && touch ${file1} || touch ${file2}`;
                }
                createLog.debug("Logging TEMP VEP_CMD "+VEP_TMP_CMD);
                //VEP_CMD = `./invoke_vep.sh ${VEP_TMP_CMD}`;
                VEP_CMD = VEP_TMP_CMD;
                createLog.debug("Logging VEP_CMD "+VEP_CMD);
                annoArr.push('VEP');
                var tmpVep = {"input": `${vep_op_file}`};
                annoSrcObj['VEP'] = tmpVep;
                annoSrcObj['VEP']['script'] = "./vepParser.js";
            } else {
                // include wrapper command with dummy parameters
                //VEP_CMD = `./invoke_vep.sh Dummy`;

                //await checkDelFile(file1);
                //await checkDelFile(file2);

                VEP_CMD = `touch ${file1} && exit 0 || touch ${file2}`;
                createLog.debug("Logging VEP_CMD "+VEP_CMD);
            }

            if ( req.query.CADD ) {
                //await checkDelFile(file3);
                //await checkDelFile(file4);

                await pipeline(createReadStream(inputFile),createWriteStream(inputFile1));
                createLog.debug("novel variants input has been written to cadd input location");

                // included cores option for snakemake cadd
                var CADD_TMP_CMD = `./CADD.sh  -g ${assemblyType} -v v1.6 -c ${caddCores} -o ${cadd_op_file} ${caddInput}/${id}_novel_variants.vcf.gz && touch ${file3} || touch ${file4}`;
                createLog.debug("Logging TEMP CADD Command "+CADD_TMP_CMD);
                //CADD_CMD = `./invoke_cadd.sh ${CADD_TMP_CMD}`;
                CADD_CMD = CADD_TMP_CMD;
                createLog.debug("Logging CADD command "+CADD_CMD);
                annoArr.push('CADD');

                var tmpCadd = {"input" : `${cadd_op_file}`};
                annoSrcObj['CADD'] = tmpCadd;
                annoSrcObj['CADD']["script"] = "./caddParser.js";

            } else {
                //await checkDelFile(file3);
                //await checkDelFile(file4);

                // include wrapper command with dummy parameters
                //CADD_CMD = `./invoke_cadd.sh Dummy`;
                //CADD_CMD = `tail -f /dev/null`;
                CADD_CMD = `touch ${file3} && exit 0 || touch ${file4}`;
                createLog.debug("Logging CADD_CMD "+CADD_CMD);
            }

            // Note : Annotation Commands are invoked based on the working directory that has been set in the source docker image
            
            //var PARSE_CMD = `./wait-annotations.sh ${vepParserOp}/${id}_completed ${caddParserOp}/${id}_completed ${vepParserOp}/${id}_err ${caddParserOp}/${id}_err && node ./execParser.js parse_annotations ${id} ${vepParserOp}/${id}_novel_variants_new.json ${caddParserOp}/${id}_novel_variants_test21.tsv.gz || touch ${parsedAnno}/parser_${id}_err`;
            var parserObj = { "fileID" : id, "annotations" : annoArr, "anno-src" : annoSrcObj };
            console.log("Logging parser object -----");
            console.dir(parserObj,{"depth":null});
            createLog.debug("JSON Stringify");
            // commented for testing
            var parserObjStr = JSON.stringify(parserObj);
            
            console.log(parserObjStr);
            //var PARSE_CMD = `./wait-annotations.sh ${vepParserOp}/${id}_completed ${caddParserOp}/${id}_completed ${vepParserOp}/${id}_err ${caddParserOp}/${id}_err && node ./execParser.js parse_annotations ${parserObj} || touch ${parsedAnno}/parser_${id}_err`;

            //var PARSE_CMD = `./wait-annotations.sh ${vepParserOp}/${id}_completed ${caddParserOp}/${id}_completed ${vepParserOp}/${id}_err ${caddParserOp}/${id}_err && node ./execParser.js parse_annotations `+ parserObj +`|| touch ${parsedAnno}/parser_${id}_err`;

            //var PARSE_CMD = `./wait-annotations.sh ${vepParserOp}/${id}_completed ${caddParserOp}/${id}_completed ${vepParserOp}/${id}_err ${caddParserOp}/${id}_err && node ./execParser.js --data_json `+ parserObjStr +`|| touch ${parsedAnno}/parser_${id}_err`;

            // escape double quotes, to preserve them after sh 
            parserObjStr = parserObjStr.replace(/"/g, '\\\"');
            console.log("escaped parser object");
            console.log(parserObjStr);

            var file5= `${tmpDir}/variantAnnotations.json.${id}.gz.sha256`;
            var file6 = `${tmpDir}/parser_err`;

            //await checkDelFile(file5);
            //await checkDelFile(file6);

            //var PARSE_CMD = `./wait-annotations.sh ${vepParserOp}/${id}_completed ${caddParserOp}/${id}_completed ${vepParserOp}/${id}_err ${caddParserOp}/${id}_err && node ./execParser.js --data_json '${parserObjStr}' || touch ${parsedAnno}/parser_${id}_err`;

            // Updating parse command to include file_id parameter for execParser
            // file1 and file3 -> error files of vep and cadd resp.
            // file2 and file4 --> completed files of vep and cadd resp.
            var PARSE_CMD = `./wait-annotations.sh ${file1} ${file3} ${file2} ${file4} && node ./execParser.js --data_json '${parserObjStr}' --file_id ${id} --tmp_dir ${tmpDir} || touch ${file6}`;

            console.log("Logging PARSE_CMD");
            console.log(PARSE_CMD);
            console.dir(PARSE_CMD,{"depth":null});
            //createLog.debug("Logging PARSE_CMD is "+PARSE_CMD_TMP);
            //var PARSE_CMD = `tail -f /dev/null`;

            var stackName = `stackDemo-${id}`;

            try {
                //spawn.exec('docker stack deploy --compose-file '+stackCompose+' stackDemoTest',{'env':{'VEP_CMD':VEP_CMD,'CADD_CMD':CADD_CMD,'PARSE_CMD':PARSE_CMD}}, (error,stdout,stderr) => {
                createLog.debug("Proceed to deploy Stack ");
                createLog.debug("Compose file "+stackCompose);
                spawn.exec('docker stack deploy --compose-file '+stackCompose+' '+stackName,{'env':{'VEP_CMD':VEP_CMD,'CADD_CMD':CADD_CMD,'PARSE_CMD':PARSE_CMD}}, (error,stdout,stderr) => {
                    if (error) {
                        createLog.debug("Error in deploying stack");
                        createLog.debug(error);
                        console.log(error);
                        //return;
                        //res.status(400).send("Failure-Error message "+error); 
                        next(`${error}`);
                    } else {
                        createLog.debug(`stdout: ${stdout}`);
                        createLog.debug(`stderr: ${stderr}`);
                        //res.send("Stack Deployed");
                        res.status(200).json({'message': "Stack Deployed","tmp_loc": tmpDir});
                    }
                });
            } catch(err) {
                createLog.debug(err);
                console.log(err);
                createLog.debug("Received the message in CATCH Block "+err);
                next(`${err}`);
                //res.status(400).send("Failure-Error message "+err); 
            }

        } catch(err2) {
            createLog.debug("Error in performing pipeline operations");
            createLog.debug(err2);
            console.log("Error performing pipeline operations to write data");
            console.log(err2);
            //console.log("Error performing operation *********** "+err2);
            next(`${err2}`);
        }
        
    });

    // This endpoint will be called to check the status of import process.
    app.route('/annotationStatus/:sid/:tmpDir(*)')
    .get(loginRequired, async(req,res,next) => {
        var sid = req.params.sid;
        var tmpDir = '/'+req.params.tmpDir;

        var annotationLog = `${tmpDir}/variantAnnotations.json.${sid}.gz`;
        var checkSumFile = `${tmpDir}/variantAnnotations.json.${sid}.gz.sha256`;
        console.log("checking for file "+checkSumFile);
        try {
            var pid = process.pid;
            var parsePath = path.parse(__dirname).dir;
            var logFile = path.join(parsePath,'routes','log',`anno-stats-logger-${sid}-${pid}.log`);
            var createLog = loggerMod.logger(logFile);

            createLog.debug("Logging a test debug statement");
            // If Annotation Process has completed
            if ( existsSync(checkSumFile) ) {
                console.log(`${checkSumFile} checkfile exists`)
                var stackName = `stackDemo-${sid}`;
                //var cmd = `docker stack ps --format "{{.Name}}|{{.Image}}|{{.DesiredState}}|{{.CurrentState}}|{{.Error}}" ${stackName}`;
                var cmd = `docker stack ps -f "desired-state=shutdown" --format "{{.ID}}||{{.Name}}||{{.Image}}||{{.DesiredState}}||{{.CurrentState}}||{{.Error}}" ${stackName}`;
                console.log(`Executing command ${cmd}`);
                spawn.exec(cmd,(error,stdout1,stderr) => {

                    // debug - commenting stack removal (testing purpose)
                    spawn.exec(`docker stack rm ${stackName}`,(error,stdout,stderr) => {
                    //spawn.exec(`docker stack ls`,(error,stdout,stderr) => {
                        var respObj = {};
                        respObj['status'] = "Annotation Completed";
                        respObj['annotation_file'] = `${annotationLog}`;
                        respObj['checksum'] = `${checkSumFile}`;
                        respObj['info1'] = "Deployed Stack has been removed now";
                        respObj['stdout'] = `${stdout1}`;
                        res.status(200).json({'message':respObj});
                    });
                });
            // Annotation Error or Annotation In Progress
            } else {
                var stackName = `stackDemo-${sid}`;
                //var cmd = `docker stack ps ${stackName}`;
                var cmd = `docker stack ps --format "{{.Name}}|{{.Image}}|{{.DesiredState}}|{{.CurrentState}}|{{.Error}}" ${stackName}`;
                console.log("Checksum file does not exist-Annotation in progress");
                console.log(`Executing command ${cmd}`);
                //var errFile = `${parsedAnno}/parser_err`;
                var errFile = `${tmpDir}/parser_err`;
                createLog.debug(`Execution stack command to get the stats ${cmd}`);
                createLog.debug(`Checking for error file ${errFile}`);
                spawn.exec(cmd,async(error,stdout,stderr) => {
                    console.log("Annotation Status Data ******************** ");
                    createLog.debug("logging stdout");
                    createLog.debug(stdout);
                    createLog.debug("logging error");
                    createLog.debug(error);
                    createLog.debug("logging stderr");
                    createLog.debug(stderr);
                    //console.log(stdout);

                    var respObj = {};
                    respObj['stdout'] = `${stdout}`;

                    if ( stderr  || error ) {
                        var errMsg = stderr || error;
                        respObj['status'] = "Annotation Error";
                        respObj['errInfo'] = errMsg;
                        createLog.debug(respObj,{"depth":null});
                        res.status(200).json({'message': respObj});
                    }

                    if ( existsSync(errFile) ) {
                        createLog.debug(`errFile ${errFile} exists`);
                        respObj['status'] = "Annotation Error";
                        respObj['errInfo'] = "Annotation process failed due to an error in Annotation Engines VEP or CADD.Contact wingsAPI Team to analyse the failure logs for sample "+sid;
                        // Add the error messages to logger and remove the stack
                        createLog.debug(respObj,{"depth":null});
                        res.status(200).json({'message': respObj});

                        console.log("Response sent to User. Now start the logging operations");

                        var servCmd = `docker stack services --format "{{.Name}}" ${stackName}`;
                        const { stdout, stderr } = await exec(servCmd);

                        var services = stdout.split('\n') || [];
                        console.log(services);
                        var sIdx;
                        for ( sIdx=0;sIdx < services.length;sIdx++ ) {
                            var sName = services[sIdx];
                            if ( sName.match(/^\s*$/) ) {
                                continue;
                            }
                            var sCmd = `docker service logs ${sName}`;
                            createLog.debug("Service log Command is "+sCmd);
                            createLog.debug("------------------ LOG ----------------------------");
                            try {
                                var stat = await execPromise(sCmd,createLog);
                                console.log('stat is '+stat);
                            } catch(err) {
                                console.log("Logging error ");
                                console.log(err);
                                createLog.debug("Error in executing command "+sCmd);
                            }
                        } 
                        createLog.debug("Delete the stack as there was an Annotation Error ");
                        // Commenting delete stack 
                        var dCmd = `docker stack rm ${stackName}`;
                        var stat1 = await exec(dCmd);
                        createLog.debug("Executed stack rm command to delete the stack");
                    } else {
                        //var cmd = `docker stack ps -f "desired-state=running" --format "{{.ID}}|{{.Name}}|{{.Image}}|{{.DesiredState}}|{{.CurrentState}}|{{.Error}}" ${stackName}`;
                        /*
docker stack ps --format "{{.ID}}: {{.Name}}: {{.Image}}: {{.DesiredState}}: {{.CurrentState}}: {{.Error}}" stackDemo-1000009899
z2ic0nrw9qwc: stackDemo-1000009899_vep.1: ensemblorg/ensembl-vep:release_98.2: Shutdown: Failed 42 seconds ago: "task: non-zero exit (137)"
stee3hwy3ne4: stackDemo-1000009899_parser.1: variantdb/parseannotations:n2: Running: Running 13 minutes ago: 
8yxy1bwvhjux: stackDemo-1000009899_cadd.1: variantdb/caddsetup:n3: Shutdown: Complete less than a second ago: 
uih0403g16ok: stackDemo-1000009899_vep.1: ensemblorg/ensembl-vep:release_98.2: Shutdown: Failed about a minute ago: "task: non-zero exit (137)" */
                        console.log("Else part");
                        createLog.debug("else part");
                        var exitReg = /^(shutdown|failed)/i;
                        var appendErr = '';
                        var procHash = {};
                        var scanStdout = stdout.split('\n');
                        for ( var idx in scanStdout ) {
                            var line = scanStdout[idx];
                            if ( line.match(/^\s*$/) ) {
                                continue;
                            }
                            var spLine = line.split('\|');
                            var currState = spLine[3];
                            var procName = spLine[0];
                            if ( ! procHash[procName] ) {
                                procHash[procName] = currState; 
                                if ( currState.match(exitReg) ) {
                                    var err = `${procName} has exited. Check ${currState}. This happens when there is network/server issue at Annotation Server.Process was restarted once`; 
                                    createLog.debug(`Logging error message ${err}`);
                                    appendErr = appendErr + err;
                                }
                            }
                        }
                        createLog.debug("Let us log append error and check ");
                        createLog.debug(appendErr);
                        if ( appendErr == '' ) {
                            createLog.debug(`Annotation Sample ID ${sid} stats is : Annotation InProgress`);
                            console.log(`Annotation Sample ID ${sid} stats is : Annotation InProgress`);
                            respObj['status'] = "Annotation InProgress";
                            createLog.debug(respObj,{"depth":null});
                            res.status(200).json({'message': respObj});
                        } else {
                            // Delete the stack and respond
                            console.log("shutdown failed else part");
                            respObj['status'] = "Annotation Error";
                            respObj['errInfo'] = appendErr;
                            createLog.debug(`Annotation Sample ID ${sid} stats is : Annotation Error`);
                            console.log(`Annotation Sample ID ${sid} stats is : Annotation Error`);
                            createLog.debug(respObj,{"depth":null});
                            res.status(200).json({'message': respObj});
                            createLog.debug("Execute the docker stack rm command to delete the stack");
                            var dCmd1 = `docker stack rm ${stackName}`;
                            // commented stack rm 
                            exec(dCmd1).then( (resp) => {
                                createLog.debug("Docker stack has been deleted for Sample ID"+sid);
                            });
                        }
                    }
                });
            }
        } catch(err1) {
            //res.status(400).send("Failure-Error message "+err1);
            next(`${err1}`);
        }
    });

    // Download Annotation Data
    app.route('/downloadData')
    .get(loginRequired,async(req,res,next) => {
        try {
                var annoFile = req.query.annotation;
                fs.access(annoFile,fs.constants.R_OK,(err) => {
                    if (err) {
                        console.log("Error is " +err);
                        next(`The requested URL ${annoFile} was not found on the server`);
                        //res.writeHead(404,{"Content-Type":"text"});
                        //res.write(`The requested URL ${annoFile} was not found on the server`);
                        //res.sendStatus(404); 
                        //res.end();
                    } else {
                        console.log("Else part ");
                        var stream = createReadStream(annoFile);
                        res.setHeader("Content-Type" , "application/gzip");
                        //res.setHeader("Content-Disposition" , `attachment;filename=${annoFile}` );
                        stream.on('error', (err) => {
                            console.log("----- Error in creating write stream ");
                            console.log(err);
                            //res.send(err);
                            next(`${err}`);
                        });
                        stream.pipe(res).on('error', (err1) => {
                            console.log("****** Could not write data to response stream ");
                            //console.log(err1);
                            next(`${err1}`);
                        });
                    }
                });


        } catch(err1) {
            console.log("Error is ************************"+err1);
            next(`${err1}`);
            //res.sendStatus(404);
            //res.status(400).send("Failure-Error message "+err1);
        }
    });

}


module.exports = { annotationRoutes };
