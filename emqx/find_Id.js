const { response } = require("express");
const axios  = require('axios');
const Usuario = require('../models/usuario');
const saverRule = require('./saver_rule');
const EmqxAuthRule = require('../models/emqx_auth');

global.saverResource=null;
global.alarmResource=null;

const auth = {
    auth: {
        // nombre: 'emqx_api',
        username: 'admin',
        password: 'jg0411'
    }
};

const findId = async(req, res=response ) => {

    listResource();

    const uid = req.body;
    const _id = uid.uid;
    const userId = uid.uid;
    

    // console.log(_id);
    //BUSCAR EN BASE DE DATOS

try {
    const existeId = await Usuario.findById({_id});
    const ruleId = await saverRule.findOne({ userId});
    
    if(existeId && ruleId){
        console.log('****YA EXISTE REGLA EN ESTE USUARIO******');
        
        const userId = _id

        const credentials = await getUserMqttCredentials(userId);

        const toSend = {
            ok: true,
            username: credentials.username,
            password: credentials.password,
            uid: userId
        }
        
        return res.json(toSend);

    } 

    else if(existeId){
        //*Crear Regla en EMQX
        createSaverRule(_id,true);
        console.log('***/**CREO UNA REGLA**/***');

        //*responder 
        const userId = _id

        const credentials = await getUserMqttCredentials(userId);

        const toSend = {
            ok: true,
            username: credentials.username,
            password: credentials.password,
            uid: userId
        }

        return res.json(toSend);
    }
    return res.status(401).json({
        ok: false,
        msg: 'No autorizado'
    });

} catch (error) {
    console.log(error);
    console.log('No se pudo crearla regla');
    return res.status(400).json({
        ok: false,
        msg: 'No esta conectado al broker'
    });

}

}


//crea la regla
async function createSaverRule(userId, status) {

    try {

    const url = "http://192.168.100.149:8085/api/v4/rules";

    const topic = userId + "/+/sdata";
    const rawsql ="SELECT topic, payload FROM \"" + topic + "\" WHERE payload.save = 1";

    var newRule = {
        rawsql: rawsql,
        actions: [
            {
            name: "data_to_webserver",
            params: {
                $resource: global.alarmResource.id,
                payload_tmpl: '{"userId": "' + userId + '","payload":${payload}, "topic":"${topic}"  }'
            }
        }
    ],
    description: "SAVER-RULE",
    enabled: status
    };

    //*Guardar regla en emqx
    const res = await axios.post(url, newRule, auth);
    if(res.status === 200 && res.data.data){
        console.log(res.data.data);

        await saverRule.create({
            userId: userId,
            emqxRuleId: res.data.data.id,
            status: status
        });
        return true;
    } else {
        return false;
    }

} catch (error) {
    console.log(error);
    console.log('No se pudo crear rule saver');
    return false;
}

}

/////////////////////////////////////////

async function listResource() {

try {

    const url = "http://192.168.100.149:8085/api/v4/resources/";

    const res = await axios.get(url, auth);
    const size = res.data.data.length;

    console.log('*****Conectado a la API RESOURCE*****');

    if (res.status ===200){
    if (size == 0) {
        console.log('crear emqx webhook resource');
        //funcion
        createResource();
    } else if (size == 2){

        res.data.data.forEach( resource => {
            if(resource.description == "alarm-webhook"){
                global.alarmResource=resource;
                console.log('****ALARM RESOURCE****');
                // console.log(global.alarmResource.id);
            }

            if(resource.description == "saver-webhook"){
                global.saverResource=resource;
                // console.log(global.saverResource.id);
                console.log('**!!**SAVER RESOURCE**!!**');
                // console.log(global.saverResource);
            }

        });


    } else {
        function prinWarning() {
            console.log('Eliminar todo WEBHOOK en EMQX y reinica Node')
            setTimeout(() => {
                prinWarning();
            }, 1000);
        }
        prinWarning();
    }

}//if res.status=200

} catch (err) {
console.log(err)
console.log('Error al conectar al conectar con la API EMQX RESOUCE ');
}
}


//*CREAR RESOURCE
async function createResource() {
    try {

        const url = "http://192.168.100.149:8085/api/v4/resources"

        const data1 = {
            "type": "web_hook",
            "description": "alarm-webhook",
         "config": {
            "url": "http://192.168.100.149:3000/api/login/alarm-webhook",
            "method": "POST",
            // "headers": {
            //    " token": "121212"
            // },
        }

        }//data1

        const data2 = {
            "type": "web_hook",
            "description": "saver-webhook",
         "config": {
            "url": "http://192.168.100.149:3000/api/login/saver-webhook",
            "method": "POST",
            // "headers": {
            //    " token": "121212"
            // },
        }

        }//data2

        const res1 = await axios.post (url, data1, auth);
        if (res1.status === 200){
            console.log('!!!alarm creado!!!');

        }

        const res2 = await axios.post (url, data2, auth);
        if (res2.status === 200){
            console.log('!!saver creado!!!');

        }


    } catch (error) {
    console.log(error);
      console.log('***Error al crear webhook - resources');
    }


    }//createResource

//*BASE
async function getUserMqttCredentials(userId){

 try {

    var rule = await EmqxAuthRule.find({type: "user", userId: userId});

    if(rule.length == 0){

    const newRule = {
    userId: userId,
    username: makeid(10),
    password: makeid(10),
    publish: [userId + "/#"],
    subscribe: [userId + "/#"],
    type: "user",
    time: Date.now(),
    updateTime: Date.now()
        }
    
    const result = await EmqxAuthRule.create(newRule); 
    
    const toReturn = {
    username: result.username,
    password: result.password,    
    }

    return toReturn;

    }

    const newUserName = makeid(10);
    const newPassword = makeid(10);

    const result = await EmqxAuthRule.updateOne({type: "user", userId: userId}, {$set: {username: newUserName, password: newPassword, updateTime: Date.now()}})
    if (result.modifiedCount == 1 && result.matchedCount == 1){
        return {
            username: newUserName,
            password: newPassword
        }
    } else {
        return false;
    }       
    } catch (error) {
        console.log(error);
        return false;        
    } 

}


function makeid(length) {
    var result = "";
    const caract = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const long = caract.length;
    let resul = [];
    for(let i =0; i<length; i++){
        result += caract.charAt(Math.floor(Math.random() * long));
    }
    return result;
}


module.exports = {
    findId
}