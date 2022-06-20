const MongoClient = require('mongodb').MongoClient;
const configData = require('../config/config.js');
const { db: { host, port, dbName, importCollection } } = configData;
const url = 'mongodb://' + host + ':' + port + '/' + dbName;

var client;
async function createConnection() {
    const url = `mongodb://${host}:${port}`;
    client = await MongoClient.connect(url,{ useNewUrlParser : true });
    return client;
}

const getConnection = () => {
    if(!client) {
        throw new Error('Call connect first!');
        //console.log('Call connect first!');
    }

    return client;
}

module.exports = { createConnection, getConnection };