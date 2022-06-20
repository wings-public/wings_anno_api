var fs = require('fs');
var express = require('express');
var http = require('http');
var https = require('https');
var helmet = require('helmet');
var jwt = require('jsonwebtoken');
var loginRoutes = require('./src/routes/loginRoutes').loginRoutes;
var annoRoutes = require('./src/routes/annotationRoutes').annotationRoutes;
var createConnection = require('./src/controllers/dbConn.js').createConnection;
//var client;

const configData = require('./src/config/config.js');
const { app : {expressPort},db:{caPM,certPM,keyPM,stackCompose} } = configData;

var initialize = require('./src/controllers/userControllers.js').initialize;
const {requestLogger, errorLogger}  = require('./src/controllers/loggerMiddleware.js');

console.log("Variable to resolve the path");
console.log("file path is  "+__filename);
console.log("Dir Path is "+__dirname);
console.log("certPM is "+certPM);
console.log("keyPM is "+keyPM);

const app = express();

app.use(helmet({
  frameguard: {
    action: 'deny'
  }
}));

app.use(express.json());


// JWT setup
// If header authorization token is present in request, token is validated and jwtid is set
// If header is not present, jwtid will be reset.
// If loginRequired middleware is added to the endpoint, it checks for the jwtid 
app.use((req, res, next) => {
  //console.log(req.connection);

  if (req.headers && req.headers.authorization && req.headers.authorization.split(' ')[0] === 'JWT') {
     jwt.verify(req.headers.authorization.split(' ')[1], 'RESTFULAPIs', (err, decode) => {
         console.log("Logging error to check for the expiry");
         console.dir(err,{"depth": null});
         //console.log(err);
         if (err) {
           req.jwtid = undefined;
           // pass the error to express.
           next(err);
         }
         //console.log("DECODED VALUE IS *******************");
         //console.log(decode);
         req.jwtid = decode;
         next();
     }); 
  } else {
      req.jwtid = undefined;
      next();
  }
});


// Specific endpoint in the route gets called based on the URL.
// Pass express app to Individual Routes

try {
    loginRoutes(app);
    app.use(requestLogger);
    annoRoutes(app);
} catch(e) {
    console.log("Error in routes "+e);
}

var httpsPort = expressPort;


const options = {
    // openssl based certificates defined in the environment files. Update them based on the server in which the installation is performed
    key : fs.readFileSync(keyPM,'utf8'),
    cert: fs.readFileSync(certPM,'utf8'),
    ca: fs.readFileSync(caPM,'utf8')
};

//var server = app.listen(expressPort, async () => {
var server = https.createServer(options,app).listen(httpsPort, async () => {
    var host = server.address().address;
    var port = server.address().port;
    //server.setTimeout();
    try {
        // check and setup database collections
        await createConnection();
        console.log("Creating Main Client Connection");
        // Initializing database Collections
        console.log("Calling initialize to create initial collections ");
        var data = await initialize();
    } catch (e) {
        console.log("Error is "+e);
        //process.exit(1);
    }
    console.log(`Annotation Router API version 1.0.1 listening at https://${host}:${port}`);
 });
 
  // Handle server errors
  server.on('error', (error) => {
    if (error.syscall !== 'listen') {
        throw error;
    }
    port = expressPort;
    const bind = typeof port === 'string'
      ? `Port ${port}`
      : `Port ${port}`;
  
    // handle specific listen errors with friendly messages
    switch (error.code) {
      case 'EACCES':
        console.log(`${bind} requires elevated privileges`);
        process.exit(1);
        break;
      case 'EADDRINUSE':
        console.log(`${bind} is already in use`);
        process.exit(1);
        break;
      default:
        console.log(error);
      // throw error;
    }
  });

// error-handling middleware should be defined last, after the other app.use and route calls.

app.use(errorLogger);
app.get('/', (req, res) =>
    res.send('Annotation Router API version 1.0.1 running on port '+expressPort)
);
