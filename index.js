const express = require('express');
const path = require('path');
require('dotenv').config();


//App de Expess
const app = express();

//Node server
const server = require('http').createServer(app);
module.exports.io = require('socket.io')(server);
require('./sockets/socket.js');


//path público 
const publicPath = path.resolve( __dirname, 'public' );
app.use(express.static(publicPath));

//Port
server.listen(process.env.PORT, (err) => {
    if(err) throw new Error(err);

    console.log('Servidor Corriendo en Puerto:', process.env.PORT)
})