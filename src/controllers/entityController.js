const MongoClient = require('mongodb').MongoClient;
const fs = require('fs');
var test = require('assert');
const Async = require('async');
const configData = require('../config/config.js');
const { db : {host,port,dbName,familyCollection,individualCollection,variantAnnoCollection} } = configData;
console.log("variantAnnoCollection "+variantAnnoCollection);

const getConnection = require('../controllers/dbConn.js').getConnection;

const initialize = async () => {
    const getSuccess = new Promise( (resolve) => resolve("Success") );
    try {
        var res5 = await checkCollectionExists(variantAnnoCollection);
        console.log("RES5 "+res5);
        var res6 = await createCollection(variantAnnoCollection);
        console.log("RES6 "+res6);
        return await getSuccess;
    } catch(err) {
        throw err;
    }
};

const storeMultiple = async  (jsonData1) => {
        var client = getConnection();
        const db = client.db(dbName);
        const collection = db.collection(individualCollection);
        var bulkOps = [];
        var jsonData = jsonData1['Individuals'];
        for ( var hashIdx in jsonData ) {
            var indHash = jsonData[hashIdx];
            var doc = createDoc(indHash);
            //console.log("Document created ");
            //console.log(doc);
            bulkOps.push(doc);
        }
        var lgt = bulkOps.length;
        //console.log("Length of Array that will be inserted to Individuals is "+lgt);

        //console.log("Check the structure of bulkOps Object");
        //console.dir(bulkOps);

        const getSuccess = new Promise( ( resolve ) => resolve("Success") );

        try {
            var r = await collection.insertMany(bulkOps);
            test.equal(lgt,r.insertedCount);
            var retValue = getSuccess;
            return await getSuccess;
        } catch(e) {
            // Throw the error to catch and handle the error in the calling function
            throw e;
        }

};

const updateData = async (jsonData1) => {
    //var client = await createConnection();
    var client = getConnection();
    const db = client.db(dbName);
    const collection = db.collection(individualCollection);
    var jsonData = jsonData1['Individuals'];

    var bulkOps = [];
    for ( var hashIdx in jsonData ) {
        var indHash = jsonData[hashIdx]; // array index holding hash data
        var indId = indHash['IndividualID'];
        var meta = indHash['Meta'];
        var metaKeys = Object.keys(meta);
        var updateFilter = {};
        var filter = {};
        var setFilter = {};
        for ( var kIdx in metaKeys ) {
            var keyName = metaKeys[kIdx];
            var val = meta[keyName];
            setFilter[keyName] = val;
        }
        filter['filter'] = { '_id' : indId };
        filter['update'] = { $set : setFilter };
        updateFilter['updateOne'] = filter;
        bulkOps.push(updateFilter);
    }
    //console.log("Check the structure of the created bulkOps filter");
    //console.dir(bulkOps,{"depth":null});

    //const getSuccess = new Promise( ( resolve ) => resolve("Success") );
    try {
        var res = await collection.bulkWrite(bulkOps);
        //console.dir(res,{"depth":null});
        const getSuccess = new Promise( ( resolve ) => resolve(res) );
        return await getSuccess;
    } catch(e) {
        throw e;
    };
};

const readData = async (indId) =>  {
    var client = getConnection();
    const db = client.db(dbName);
    const collection = db.collection(individualCollection);
    var filter = {'_id':indId};
    //console.log("Filter that was set for Mongo is "+filter);
    //console.dir(filter,{"depth":null});
    try {
        var doc = await collection.findOne(filter);
        //console.log(doc);
        const getDoc = new Promise( ( resolve ) => resolve(doc) );
        //console.log("Check for the Promise return value. Success/Failure");
        //console.log(getDoc);
        return await getDoc;
    } catch (e) {
        throw "Error";
    }
};

const getAttrData = async (filter) => {
    var client = getConnection();
    const db = client.db(dbName);
    const collection = db.collection(individualCollection);
    var obj = [];
    var proj = {'_id':1}; // Projection to retrieve only the Individual IDs
    try {
        var dataStream = collection.find(filter);
        dataStream.project(proj);
        while ( await dataStream.hasNext() ) {
            const doc = await dataStream.next();
            obj.push(doc);
        }
        const getObj = new Promise( ( resolve ) => resolve(obj) );
        return await getObj;
    } catch (e) {
        throw e;
    }
};

const createFamily = async (jsonData) => {
    var client = getConnection();
    const db = client.db(dbName);
    const collection = db.collection(familyCollection);

    const getSuccess = new Promise( (resolve) => resolve("Success") );
    try {
        var result = await collection.insertOne(jsonData);
        test.equal(1,result.insertedCount);
        return await getSuccess;
    } catch(e) {
        throw e;
    }
}

const addPedigree = async (jsonData) => {
    var client = getConnection();
    const db = client.db(dbName);
    const collection = db.collection(familyCollection);
    const getSuccess = new Promise( (resolve) => resolve("Success") );
    try {
        var id = { '_id' : jsonData['_id'] };
        jsonData['update']['relatives'] = [];
        //var set = { $set : jsonData['update'] };
        var set = { $set : jsonData['update'] };
        var result = await collection.updateOne(id,set);
        return await getSuccess;
    } catch(e) {
        throw e;
    }
}

const showPedigree = async (indId) => {
    var client = getConnection();
    const db = client.db(dbName);
    const collection = db.collection(familyCollection);
    try {
        var filter = { '_id' : indId };
        //var projection = { 'pedigree':1 };        
        var doc = await collection.findOne(filter,{'pedigree':1});
        //console.log("Logging the document that was sent by Mongo for the specific filter");
        //console.log(doc);
        const getDoc = new Promise( ( resolve ) => resolve(doc) );
        //console.log("Check for the Promise return value. Success/Failure");
        //console.log(getDoc);
        return await getDoc;
    } catch(e) {
        throw e;
    }
}

const assignInd = async (familyId,indId) => {
    var client = getConnection();
    const db = client.db(dbName);
    const indColl = db.collection(individualCollection);
    const getSuccess = new Promise( (resolve) => resolve("Success") );
    // check if the family ID is present in family collection before assigning the family ID to Individual Collection
    try {
        var id = { '_id' : indId };
        var set = { $set : {'familyId':familyId} };
        var result = await indColl.updateOne(id,set);
        return await getSuccess;
    } catch(err) {
        throw err;
    }
}

const updateRelative = async (jsonData) => {
    var client = getConnection();
    const db = client.db(dbName);
    const familyColl = db.collection(familyCollection);
    const getSuccess = new Promise( (resolve) => resolve("Success") );

    if ( jsonData['update']['pedigree'] && jsonData['update']['relatives'] ) {
        var id = jsonData['_id'];
        var nodeId = jsonData['update']['pedigree']['key'];
        var relId = jsonData['update']['relatives']['ID'];
        //console.log("nodeID"+nodeId);
        //console.log("relId"+relId);

        // filter and set criteria to update the pedigree node once the relatives are added
        var filter = { '_id' : id , 'pedigree.key' : nodeId };
        var set = { $set : { 'pedigree.$' : jsonData['update']['pedigree'] } };

        try {
            var res = await familyColl.updateOne(filter,set);
            //console.log("Result of pedigree Update ");
            //console.dir(res,{"depth":null});

            // Check if relative ID entry already exists
            console.log("Check for relative ID ");
            var relFilter = {'_id':id,'relatives.ID':relId};
            var exists = await familyColl.findOne(relFilter);
            console.log("Check if relative ID exists or not in the database");
            console.log(exists);
            // Relative ID already exists
            var relFilterQ;
            var relSet;
            if ( exists ) {
                // positional array update
                /*
                    db.family.updateOne(
                      { _id:"80002399431", "relatives.ID" : "5555" },
                      { $set : { "relatives.$" : { "ID" : "5555", "Sex" : "F", "Status" : "alive", "FamilyMemberTypeID" : "Sibling", "FamilySide" : "Maternal", "Affected" : "1" } } }
                    );
                */
                relFilterQ = relFilter;
                relSet = { $set : {'relatives.$' : jsonData['update']['relatives'] } };
            } else {
                // Relative ID does not exist
                /*
                 db.family.updateOne(      { _id:"80002399431" },      { $push : { "relatives" : { "ID" : "5566", "Sex" : "M", "Status" : "alive", "FamilyMemberTypeID" : "Sibling", "FamilySide" : "Maternal", "Affected" : "1" } } } );
               */
                relFilterQ = { '_id' : id };
                relSet = { $push : { 'relatives' : jsonData['update']['relatives'] } };
            }
            var relUpdRes = await familyColl.updateOne(relFilterQ,relSet);
            return await getSuccess;
        } catch (err) {
            throw err;
        }
    } else {
        throw "JSON Structure Error ";
    }
}

const createDoc = (jsonInd) => {
    var doc = {};
    doc['_id'] = jsonInd['IndividualID'];
    var meta = jsonInd['Meta'];

    // Retrieve the meta keys defined in the Individual JSON and create the document
    var metaKeys = Object.keys(meta);
    //console.log(metaKeys);
    for ( var kIdx in metaKeys ) {
        var keyName = metaKeys[kIdx];
        doc[keyName] = meta[keyName];
    } 
    return doc;
};

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

/*
async function createConnection() {
    const url = `mongodb://${host}:${port}`;
    var client = await MongoClient.connect(url,{ useNewUrlParser : true });
    return client;
}
*/

module.exports = { initialize, storeMultiple, updateData, readData, getAttrData, createDoc, createFamily, assignInd, addPedigree, showPedigree, updateRelative };
