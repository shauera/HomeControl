// Good tutorial and examples can be found here:
// https://developers.home.google.com/codelabs/smarthome-washer#0
// https://github.com/googlecodelabs/smarthome-washer/blob/master/washer-start/functions/index.js

// In depth documentation about fulfillments can be found here:
// https://developers.home.google.com/cloud-to-cloud/integration/sync

// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
const functions = require('firebase-functions');

// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
var serviceAccount = require("./firebase-admin-SDK-private-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://homecontrol-dde07-default-rtdb.asia-southeast1.firebasedatabase.app"
});

// The PubSub SDK to access pub/sub
const {PubSub} = require('@google-cloud/pubsub');

// Instantiates a client
const pubsub = new PubSub();

// The smarthome SDK to respond to intents
const {smarthome} = require('actions-on-google');

let jwt
try {
  jwt = require('./smart-home-key.json')
} catch (e) {
  functions.logger.warn('Service account key is not found')
  functions.logger.warn('Report state and Request sync will be unavailable')
}

const app = smarthome({
  jwt: jwt,
  debug: true,
})
const firebaseRef = admin.database().ref('/');

// Take the text parameter passed to this HTTP endpoint and insert it into 
// Firestore under the path /messages/:documentId/original
exports.addMessage = functions.https.onRequest(async (req, res) => {
    // Grab the text parameter.
    const original = req.query.text;
    // Push the new message into Firestore using the Firebase Admin SDK.
    const writeResult = await admin.firestore().collection('messages').add({original: original});
    // Send back a message that we've successfully written the message
    res.json({result: `Message with ID: ${writeResult.id} added.`});
    });

// Listens for new messages added to /messages/:documentId/original and creates an
// uppercase version of the message to /messages/:documentId/uppercase
exports.makeUppercase = functions.firestore.document('/messages/{documentId}')
    .onCreate((snap, context) => {
      // Grab the current value of what was written to Firestore.
      const original = snap.data().original;

      // Access the parameter `{documentId}` with `context.params`
      functions.logger.log('Uppercasing', context.params.documentId, original);
      
      const uppercase = original.toUpperCase();
      
      // You must return a Promise when performing asynchronous tasks inside a Functions such as
      // writing to Firestore.
      // Setting an 'uppercase' field in Firestore document returns a Promise.
      return snap.ref.set({uppercase}, {merge: true});
    });


exports.publishHomeControlCommandEvent = functions.https.onRequest(async (req, res) => {
  console.log(`---------- body: ${JSON.stringify(req.body)}`);
  if (!req.body.message) {
    res
      .status(400)
      .send(
        'Missing parameter; include "message" property in your request.'
      );
    return;
  }

  // console.log(`Publishing message to topic ${req.body.topic}`);

  // References an existing topic
  const topic = pubsub.topic('ControlCommands');
  
  const data = {
    message: req.body.message,
  };

  // Publish message
  try {
    await topic.publishMessage({json: data});
    res.status(200).send('Message published.');
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
    return Promise.reject(err);
  }
});

// ------------ Smart Home Fulfilment ----------------------------------
// Hardcoded user ID
const USER_ID = '123';

exports.login = functions.https.onRequest((request, response) => {
  if (request.method === 'GET') {
    functions.logger.log('Requesting login page');
    response.send(`
    <html>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <body>
        <form action="/login" method="post">
          <input type="hidden"
            name="responseurl" value="${request.query.responseurl}" />
          <button type="submit" style="font-size:14pt">
            Link this service to Google
          </button>
        </form>
      </body>
    </html>
  `);
  } else if (request.method === 'POST') {
    // Here, you should validate the user account.
    // In this sample, we do not do that.
    const responseurl = decodeURIComponent(request.body.responseurl);
    functions.logger.log(`Redirect to ${responseurl}`);
    return response.redirect(responseurl);
  } else {
    // Unsupported method
    response.send(405, 'Method Not Allowed');
  }
});


const util = require('util');
/**
 * This is one of three functions that is setup as a webhook for Google assistant.
 * It should authenticate the request coming from the Google assistant.
 */
exports.fakeauth = functions.https.onRequest((request, response) => {
  const responseurl = util.format('%s?code=%s&state=%s',
      decodeURIComponent(request.query.redirect_uri), 'xxxxxx',
      request.query.state);
  functions.logger.log(`Set redirect as ${responseurl}`);
  return response.redirect(
      `/login?responseurl=${encodeURIComponent(responseurl)}`);
});

/**
 * This is one of three functions that is setup as a webhook for Google assistant.
 * It should grant an authorization code to Google assistant.
 */
exports.faketoken = functions.https.onRequest((request, response) => {
  const grantType = request.query.grant_type ?
    request.query.grant_type : request.body.grant_type;
  const secondsInDay = 86400; // 60 * 60 * 24
  const HTTP_STATUS_OK = 200;
  functions.logger.log(`Grant type ${grantType}`);

  let obj;
  if (grantType === 'authorization_code') {
    obj = {
      token_type: 'bearer',
      access_token: '123access',
      refresh_token: '123refresh',
      expires_in: secondsInDay,
    };
  } else if (grantType === 'refresh_token') {
    obj = {
      token_type: 'bearer',
      access_token: '123access',
      expires_in: secondsInDay,
    };
  }
  response.status(HTTP_STATUS_OK)
      .json(obj);
});

let devicelist
devicelist = require('./devices.json')
const deviceitems = JSON.parse(JSON.stringify(devicelist));

var devicecounter;

app.onSync((body) => {
  functions.logger.log('onSync');
  for (devicecounter = 0; devicecounter < deviceitems.length; devicecounter++) {
    if (deviceitems[devicecounter].traits.includes('action.devices.traits.TemperatureSetting')) {
      if (deviceitems[devicecounter].attributes.queryOnlyTemperatureSetting == true) {
        firebaseRef.child(deviceitems[devicecounter].id).child('TemperatureSetting').set({thermostatMode: "off", thermostatTemperatureAmbient: 20, thermostatHumidityAmbient: 90});
      } else if (deviceitems[devicecounter].attributes.queryOnlyTemperatureSetting == false) {
        firebaseRef.child(deviceitems[devicecounter].id).child('TemperatureSetting').set({thermostatMode: "off", thermostatTemperatureSetpoint: 25.5, thermostatTemperatureAmbient: 20, thermostatHumidityAmbient: 90, thermostatTemperatureSetpointLow: 15, thermostatTemperatureSetpointHigh: 30});
      }
    }
    if (deviceitems[devicecounter].traits.includes('action.devices.traits.OnOff')) {
      firebaseRef.child(deviceitems[devicecounter].id).child('OnOff').set({on: false});
    }
    if (deviceitems[devicecounter].traits.includes('action.devices.traits.Brightness')) {
      firebaseRef.child(deviceitems[devicecounter].id).child('Brightness').set({brightness: 10});
    }
    if (deviceitems[devicecounter].traits.includes('action.devices.traits.ColorSetting')) {
      firebaseRef.child(deviceitems[devicecounter].id).child('ColorSetting').set({color: {name: "deep sky blue", spectrumRGB: 49151}});
    }
    if (deviceitems[devicecounter].traits.includes('action.devices.traits.Modes')) {
      var modename = deviceitems[devicecounter].attributes.availableModes[0].name
      var modevalue = deviceitems[devicecounter].attributes.availableModes[0].settings[0].setting_name
      firebaseRef.child(deviceitems[devicecounter].id).child('Modes').set({currentModeSettings: {modename: modevalue}});
    }
    if (deviceitems[devicecounter].traits.includes('action.devices.traits.FanSpeed')) {
      firebaseRef.child(deviceitems[devicecounter].id).child('FanSpeed').set({currentFanSpeedSetting: 20.0});
    }
  }
  return {
    requestId: body.requestId,
    payload: {
      agentUserId: USER_ID,
      devices: deviceitems
    },
  };
});

const queryFirebase = async (deviceId) => {
  const snapshot = await firebaseRef.child(deviceId).once('value');
  const snapshotVal = snapshot.val();

  var asyncvalue = {};

  if (Object.prototype.hasOwnProperty.call(snapshotVal, 'OnOff')) {
    asyncvalue = Object.assign(asyncvalue, {on: snapshotVal.OnOff.on});
  }
  if (Object.prototype.hasOwnProperty.call(snapshotVal, 'Brightness')) {
    asyncvalue = Object.assign(asyncvalue, {brightness: snapshotVal.Brightness.brightness});
  }
  if (Object.prototype.hasOwnProperty.call(snapshotVal, 'ColorSetting')) {
    asyncvalue = Object.assign(asyncvalue, {color: snapshotVal.ColorSetting.color});
  }
  if (Object.prototype.hasOwnProperty.call(snapshotVal, 'FanSpeed')) {
    if (Object.prototype.hasOwnProperty.call(snapshotVal.FanSpeed, 'currentFanSpeedSetting')) {
      asyncvalue = Object.assign(asyncvalue, {currentFanSpeedSetting: snapshotVal.FanSpeed.currentFanSpeedSetting});
    }
  }
  if (Object.prototype.hasOwnProperty.call(snapshotVal, 'Modes')) {
    if (Object.prototype.hasOwnProperty.call(snapshotVal.Modes, 'currentModeSettings')) {
      asyncvalue = Object.assign(asyncvalue, {currentModeSettings: snapshotVal.Modes.currentModeSettings});
    }
  }
  if (Object.prototype.hasOwnProperty.call(snapshotVal, 'TemperatureSetting')) {
    if (Object.prototype.hasOwnProperty.call(snapshotVal.TemperatureSetting, 'thermostatMode')) {
      asyncvalue = Object.assign(asyncvalue, {thermostatMode: snapshotVal.TemperatureSetting.thermostatMode});
    }
    if (Object.prototype.hasOwnProperty.call(snapshotVal.TemperatureSetting, 'thermostatTemperatureSetpoint')) {
      asyncvalue = Object.assign(asyncvalue, {thermostatTemperatureSetpoint: snapshotVal.TemperatureSetting.thermostatTemperatureSetpoint});
    }
    if (Object.prototype.hasOwnProperty.call(snapshotVal.TemperatureSetting, 'thermostatTemperatureAmbient')) {
      asyncvalue = Object.assign(asyncvalue, {thermostatTemperatureAmbient: snapshotVal.TemperatureSetting.thermostatTemperatureAmbient});
    }
    if (Object.prototype.hasOwnProperty.call(snapshotVal.TemperatureSetting, 'thermostatHumidityAmbient')) {
      asyncvalue = Object.assign(asyncvalue, {thermostatHumidityAmbient: snapshotVal.TemperatureSetting.thermostatHumidityAmbient});
    }
    if (Object.prototype.hasOwnProperty.call(snapshotVal.TemperatureSetting, 'thermostatTemperatureSetpointLow')) {
      asyncvalue = Object.assign(asyncvalue, {thermostatTemperatureSetpointLow: snapshotVal.TemperatureSetting.thermostatTemperatureSetpointLow});
    }
    if (Object.prototype.hasOwnProperty.call(snapshotVal.TemperatureSetting, 'thermostatTemperatureSetpointHigh')) {
      asyncvalue = Object.assign(asyncvalue, {thermostatTemperatureSetpointHigh: snapshotVal.TemperatureSetting.thermostatTemperatureSetpointHigh});
    }
  }
  return asyncvalue;
};

const queryDevice = async (deviceId) => {
  const data = await queryFirebase(deviceId);

  var datavalue = {};

  if (Object.prototype.hasOwnProperty.call(data, 'on')) {
    datavalue = Object.assign(datavalue, {on: data.on});
  }
  if (Object.prototype.hasOwnProperty.call(data, 'brightness')) {
    datavalue = Object.assign(datavalue, {brightness: data.brightness});
  }
  if (Object.prototype.hasOwnProperty.call(data, 'color')) {
    datavalue = Object.assign(datavalue, {color: data.color});
  }
  if (Object.prototype.hasOwnProperty.call(data, 'currentFanSpeedSetting')) {
    datavalue = Object.assign(datavalue, {currentFanSpeedSetting: data.currentFanSpeedSetting});
  }
  if (Object.prototype.hasOwnProperty.call(data, 'currentModeSettings')) {
    datavalue = Object.assign(datavalue, {currentModeSettings: data.currentModeSettings});
  }
  if (Object.prototype.hasOwnProperty.call(data, 'thermostatMode')) {
    datavalue = Object.assign(datavalue, {thermostatMode: data.thermostatMode});
  }
  if (Object.prototype.hasOwnProperty.call(data, 'thermostatTemperatureSetpoint')) {
    datavalue = Object.assign(datavalue, {thermostatTemperatureSetpoint: data.thermostatTemperatureSetpoint});
  }
  if (Object.prototype.hasOwnProperty.call(data, 'thermostatTemperatureAmbient')) {
    datavalue = Object.assign(datavalue, {thermostatTemperatureAmbient: data.thermostatTemperatureAmbient});
  }
  if (Object.prototype.hasOwnProperty.call(data, 'thermostatHumidityAmbient')) {
    datavalue = Object.assign(datavalue, {thermostatHumidityAmbient: data.thermostatHumidityAmbient});
  }
  if (Object.prototype.hasOwnProperty.call(data, 'thermostatTemperatureSetpointLow')) {
    datavalue = Object.assign(datavalue, {thermostatTemperatureSetpointLow: data.thermostatTemperatureSetpointLow});
  }
  if (Object.prototype.hasOwnProperty.call(data, 'thermostatTemperatureSetpointHigh')) {
    datavalue = Object.assign(datavalue, {thermostatTemperatureSetpointHigh: data.thermostatTemperatureSetpointHigh});
  }
  return datavalue;
};

app.onQuery(async (body) => {
  const {requestId} = body;
  const payload = {
    devices: {},
  };

  const queryPromises = [];
  const intent = body.inputs[0];
  for (const device of intent.payload.devices) {
    const deviceId = device.id;
    queryPromises.push(
        queryDevice(deviceId)
            .then((data) => {
              // Add response to device payload
              payload.devices[deviceId] = data;
            }) );
  }
  // Wait for all promises to resolve
  await Promise.all(queryPromises);
  return {
    requestId: requestId,
    payload: payload,
  };
});

const updateDevice = async (execution, deviceId) => {
  const {params, command} = execution;
  let state, ref;
  switch (command) {
    case 'action.devices.commands.OnOff':
      state = {on: params.on};
      ref = firebaseRef.child(deviceId).child('OnOff');
      break;
    case 'action.devices.commands.BrightnessAbsolute':
      state = {brightness: params.brightness};
      ref = firebaseRef.child(deviceId).child('Brightness');
      break;
    case 'action.devices.commands.ColorAbsolute':
      state = {color: params.color};
      ref = firebaseRef.child(deviceId).child('ColorSetting');
      break;
    case 'action.devices.commands.SetFanSpeed':
      state = {currentFanSpeedSetting: params.fanSpeed};
      ref = firebaseRef.child(deviceId).child('FanSpeed');
      break;
    case 'action.devices.commands.SetModes':
      state = {currentModeSettings: params.updateModeSettings};
      ref = firebaseRef.child(deviceId).child('Modes');
      break;
    case 'action.devices.commands.ThermostatTemperatureSetpoint':
      state = {thermostatTemperatureSetpoint: params.thermostatTemperatureSetpoint};
      ref = firebaseRef.child(deviceId).child('TemperatureSetting');
      break;
    case 'action.devices.commands.ThermostatSetMode':
      state = {thermostatMode: params.thermostatMode};
      ref = firebaseRef.child(deviceId).child('TemperatureSetting');
      break;
    case 'action.devices.commands.ThermostatTemperatureSetRange':
      state = {thermostatTemperatureSetpointLow: params.thermostatTemperatureSetpointLow,thermostatTemperatureSetpointHigh: params.thermostatTemperatureSetpointHigh};
      ref = firebaseRef.child(deviceId).child('TemperatureSetting');
  }
  return ref.update(state)
      .then(() => state);
};

app.onExecute(async (body) => {
  const {requestId} = body;
  // Execution results are grouped by status
  const result = {
    ids: [],
    status: 'SUCCESS',
    states: {
      online: true,
    },
  };
  //---------------------
  // References an existing topic
  const topic = pubsub.topic('ControlCommands');
  
  const data = {
    message: JSON.stringify(body),
  };

  // Publish message
  try {
    functions.logger.info('EXECUTE-ABOUT-TO-PUBLISH')
    await topic.publishMessage({json: data});
    functions.logger.info('EXECUTE-PUBLISH')
  } catch (err) {
    functions.logger.error('EXECUTE-PUBLISH', err)    
  }
  //--------------------------

  const executePromises = [];
  const intent = body.inputs[0];
  for (const command of intent.payload.commands) {
    for (const device of command.devices) {
      for (const execution of command.execution) {
        executePromises.push(
            updateDevice(execution, device.id)
                .then((data) => {
                  result.ids.push(device.id);
                  Object.assign(result.states, data);
                })
                .catch(() => functions.logger.error('EXECUTE', device.id)));
      }
    }
  }

  await Promise.all(executePromises);
  return {
    requestId: requestId,
    payload: {
      commands: [result],
    },
  };
});

app.onDisconnect((body, headers) => {
  functions.logger.log('User account unlinked from Google Assistant');
  // Return empty response
  return {};
});

/**
 * This is one of three functions that is setup as a webhook for Google assistant.
 * Passing in `app` will setup all
 * the required callbacks (Sync, Query, Disconnect, and Execute)
 */
exports.smarthome = functions.https.onRequest(app);

/**
 * This should be called by a cilent that wants to request the assistant to resync e.g.
 * when a new device was added and the assistant is not aware of it yet.
 */
exports.requestsync = functions.https.onRequest(async (request, response) => {
  response.set('Access-Control-Allow-Origin', '*');
  functions.logger.info('Request SYNC for user ${USER_ID}');
  try {
    const res = await app.requestSync(USER_ID);
    functions.logger.log('Request sync completed');
    response.json(res.data);
  } catch (err) {
    functions.logger.error(err);
    response.status(500).send(`Error requesting sync: ${err}`);
  }
});

/**
 * Send a REPORT STATE call to the homegraph when data for any device id
 * has been changed. This should be called by a cilent that wants to report back the state
 * of a device that my have changed not throug the Google assistant e.g. a light was turned on
 * using a manual switch.
 */
 exports.reportstate = functions.database.ref('{deviceId}').onWrite(async (change, context) => {
  functions.logger.info('Firebase write event triggered this cloud function');
  if (!app.jwt) {
    functions.logger.warn('Service account key is not configured');
    functions.logger.warn('Report state is unavailable');
    return;
  }
  const snapshot = change.after.val();

  var syncvalue = {};

  if (Object.prototype.hasOwnProperty.call(snapshot, 'OnOff')) {
    syncvalue = Object.assign(syncvalue, {on: snapshot.OnOff.on});
  }
  if (Object.prototype.hasOwnProperty.call(snapshot, 'Brightness')) {
    syncvalue = Object.assign(syncvalue, {brightness: snapshot.Brightness.brightness});
  }
  if (Object.prototype.hasOwnProperty.call(snapshot, 'ColorSetting')) {
    syncvalue = Object.assign(syncvalue, {color: snapshot.ColorSetting.color});
  }
  if (Object.prototype.hasOwnProperty.call(snapshot, 'FanSpeed')) {
    if (Object.prototype.hasOwnProperty.call(snapshot.FanSpeed, 'currentFanSpeedSetting')) {
      syncvalue = Object.assign(syncvalue, {currentFanSpeedSetting: snapshot.FanSpeed.currentFanSpeedSetting});
    }
  }
  if (Object.prototype.hasOwnProperty.call(snapshot, 'Modes')) {
    if (Object.prototype.hasOwnProperty.call(snapshot.Modes, 'currentModeSettings')) {
      syncvalue = Object.assign(syncvalue, {currentModeSettings: snapshot.Modes.currentModeSettings});
    }
  }
  if (Object.prototype.hasOwnProperty.call(snapshot, 'TemperatureSetting')) {
    if (Object.prototype.hasOwnProperty.call(snapshot.TemperatureSetting, 'thermostatMode')) {
      syncvalue = Object.assign(syncvalue, {thermostatMode: snapshot.TemperatureSetting.thermostatMode});
    }
    if ("thermostatTemperatureSetpoint" in snapshot) {
      syncvalue = Object.assign(syncvalue, {thermostatTemperatureSetpoint: snapshot.TemperatureSetting.thermostatTemperatureSetpoint});
    }
    if ("thermostatTemperatureAmbient" in snapshot) {
      syncvalue = Object.assign(syncvalue, {thermostatTemperatureAmbient: snapshot.TemperatureSetting.thermostatTemperatureAmbient});
    }
    if ('thermostatHumidityAmbient' in snapshot) {
      syncvalue = Object.assign(syncvalue, {thermostatHumidityAmbient: snapshot.TemperatureSetting.thermostatHumidityAmbient});
    }
    if ('thermostatTemperatureSetpointLow' in snapshot) {
      syncvalue = Object.assign(syncvalue, {thermostatTemperatureSetpointLow: snapshot.TemperatureSetting.thermostatTemperatureSetpointLow});
    }
    if ('thermostatTemperatureSetpointHigh' in snapshot) {
      syncvalue = Object.assign(syncvalue, {thermostatTemperatureSetpointHigh: snapshot.TemperatureSetting.thermostatTemperatureSetpointHigh});
    }
  }

  const postData = {
    requestId: 'ff36a3ccsiddhy', /* Any unique ID */
    agentUserId: USER_ID, /* Hardcoded user ID */
    payload: {
      devices: {
        states: {
          /* Report the current state of our light */
          [context.params.deviceId]: syncvalue,
        },
      },
    },
  };
  
  const data = await app.reportState(postData);
  functions.logger.log('Report state came back');
  functions.logger.info(data);
});
