// config.js
var path = require('path');
//var data = require('dotenv').config();
//console.dir(data,{"depth":null});

// custom path to retrieve the vars related to environment

var envPath = path.join(__dirname,'.env');
//var dataConfig = require('dotenv').config({path:__dirname+'/.env'});
var dataConfig = require('dotenv').config({path : envPath});

const env = process.env.NODE_ENV; // 'dev' or 'test'

const dev = {
 app: {
   expressPort : parseInt(process.env.EXPRESS_APP_PORT) || 8081
 },
 db: {
   host: process.env.DEV_DB_HOST || 'localhost',
   port: parseInt(process.env.DEV_DB_PORT) || 27017,
   dbName: process.env.DEV_DB_NAME || 'db',
   apiUser : process.env.DEV_API_USER || '',
   apiUserColl : process.env.MONGO_API_USER_COLL || 'apiUsers',   
   caPM : process.env.CA_PM || '',
   certPM : process.env.CERT_PM || '',
   keyPM : process.env.KEY_PM || '',
   stackCompose : process.env.STACK_COMPOSE || '',
   caddInput : process.env.CADD_IMG_MNT_IP || '',
   caddOutput : process.env.CADD_IMG_MNT_OP || '',
   vepInput : process.env.VEP_IMG_MNT_IP || '',
   vepOutput : process.env.VEP_IMG_MNT_OP || '',
   vepParserIp : process.env.VEP_DATA + process.env.VEP_IP_LOC || '',
   vepParserOp : process.env.VEP_DATA + process.env.VEP_OP_LOC || '',
   caddParserIp : process.env.CADD_DATA + process.env.CADD_IP_LOC || '',
   caddParserOp : process.env.CADD_DATA + process.env.CADD_OP_LOC || '',
   parsedAnno : process.env.PARSED_ANNO || '',
   vepConf1 : process.env.VEP_HG19_CONF || '',
   vepConf2 : process.env.VEP_HG38_CONF || ''
 }
};

const test = {
 app: {
   port: parseInt(process.env.TEST_APP_PORT) || 3000
 },
 db: {
   host: process.env.TEST_DB_HOST || 'localhost',
   port: parseInt(process.env.TEST_DB_PORT) || 27017,
   dbName: process.env.TEST_DB_NAME || 'test'
 }
};

const config = {
 dev,
 test
};

module.exports = config[env];
