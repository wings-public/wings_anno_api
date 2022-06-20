const MongoClient = require('mongodb').MongoClient;
const fs = require('fs');
var test = require('assert');
var jwt = require('jsonwebtoken');
var bcrypt = require('bcrypt');
const configData = require('../config/config.js');
const { db : {host,port,dbName,apiUserColl,apiUser} } = configData;

const getConnection = require('../controllers/dbConn.js').getConnection;

const initialize = async () => {
    //const getSuccess = new Promise( (resolve) => resolve("Success") );
    try {
        await checkApiUser(apiUser);
        await createApiUser(apiUser);
        return "Success";
    } catch(err) {
        console.log("user already exists");
        throw err;
    }
};

const checkApiUser = async (apiUser) => {
    var client = getConnection();
    const db = client.db(dbName);
    const collection = db.collection(apiUserColl);
    try {
        var res1 = await checkCollectionExists(apiUserColl);
        var res2 = await createCollection(apiUserColl);
        var doc = await collection.findOne({'user':apiUserColl});
        return "Success";
    } catch(err1) {
        throw err1;
    }
};

const createApiUser = async (apiUser) => {
    try {
        var client = getConnection();
        const db = client.db(dbName);
        const collection = db.collection(apiUserColl);
        // Auto generate a salt and hash
        var hashPassword = bcrypt.hashSync(`${apiUser}@A#01`, 10);
        var data = {'user':apiUser, 'hashPassword' : hashPassword,'createDate': Date.now()};
        
        var result = await collection.insertOne(data);
        test.equal(1,result.insertedCount);
        return "Success";
    } catch(err) {
        throw err;
    }
};

const login = async (req, res) => {
    try {
        var client = getConnection();
        const db = client.db(dbName);
        const collection = db.collection(apiUserColl);
        var result = await collection.findOne({'user':req.body.user});
        if ( result ) {
            if ( ! comparePassword(req.body.password,result.hashPassword) ) {
                return res.status(401).json({ message: 'Authentication failed. Wrong password!'});
            } else {
               return res.json({token: jwt.sign({ 'user': req.body.user, exp: Math.floor(Date.now() / 1000) + (96 * 60 * 60), 'audience': "auth_user"}, 'RESTFULAPIs')});
            }
        } else {
            return res.status(401).json({ message: 'Authentication failed. No user found!'});
        }
    } catch(err) {
        res.status(401).json({ message: 'Login failed!'}); 
    }

}

const comparePassword = (pwd,hashPwd) => {
    return bcrypt.compareSync(pwd,hashPwd);
};

// middleware validation. function added to all the route endpoints that has to be validated with a token
const loginRequired = (req, res, next) => {
    //console.log(req);
    if (req.jwtid && req.jwtid.audience === "auth_user") {
        next();
    } else {
        console.log("************ Here !!!");
        return res.status(401).json({ message: 'Unauthorized user!'});
    }
}

// Connect to MongoDB and check if the collection exists. Returns Promise
const checkCollectionExists = async (colName) => {
    var client = getConnection();
    const db = client.db(dbName);
    const getSuccess = new Promise( ( resolve ) => resolve("Success") );
    try {
        var items = await db.listCollections({name:colName}).toArray();
        test.equal(0,items.length);
        return await getSuccess;
    } catch(err) {
        throw err;
    }
};

// Create the Collection passed as argument. Returns Promise;
const createCollection = async (colName) => {
    var client = getConnection();
    const db = client.db(dbName);
    const getSuccess = new Promise ( (resolve) => resolve("Success") );
    try {
        var result = await db.createCollection(colName,{'w':1});
        return await getSuccess;
    } catch(err) {
        throw err;
    }
};


module.exports = { initialize, checkApiUser, createApiUser, login, loginRequired };
