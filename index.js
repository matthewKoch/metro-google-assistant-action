

// Import the Dialogflow module from the Actions on Google client library.
const { dialogflow } = require('actions-on-google');

// Import the firebase-functions package for deployment.
const functions = require('firebase-functions');

// Instantiate the Dialogflow client.
const app = dialogflow({ debug: true });

const request = require('request');

// TODO: move this to a separate file in a config directory
const Lines = Object.freeze({
  BL: 'blue',
  GR: 'green',
  OR: 'orange',
  RD: 'red',
  SV: 'silver',
  YL: 'yellow',
});

const filterTrains = (allTrains, startingStationCode, direction, line) => allTrains.filter(train => (train.DestinationCode === direction && Lines[train.Line] === line));
const utilJsonParse = content => JSON.parse(content);

function fetchTrainData(startingStationCode) {
  return new Promise(((resolve, reject) => {
    // TODO: move api key value to command line and api url to config file, for now,  hard code here
    const apiKey = '';
    request(`https://api.wmata.com/StationPrediction.svc/json/GetPrediction/${startingStationCode}?api_key=${apiKey}`, (err, res, body) => {
      if (err) { reject(err); }
      resolve(body);
    });
  }));
}

// Create dialogue for Assistant based on available trains
function getVoiceDialogue(requestedTrains) {
  let dialogueScript = '';

  requestedTrains.forEach((train) => {
    let waitingTimeText = '';

    if (train.Min === 'BRD') {
      waitingTimeText = 'currently boarding.';
    } else if (train.Min === 'ARR') {
      waitingTimeText = 'arriving at the station.';
    } else if (train.Min === '1') {
      waitingTimeText = 'coming in the next minute.';
    } else {
      waitingTimeText = `coming in ${train.Min} minutes.`;
    }

    dialogueScript += `A train is ${waitingTimeText} `;
  });

  if (dialogueScript === '') {
    dialogueScript = 'Sorry, there are no trains currently running.';
  }

  return dialogueScript;
}

// Post text for assistant to speak
function conversation(conv, conversationType, speech) {
  if (conversationType === 'close') {
    conv.close(speech);
  } else if (conversationType === 'ask') {
    conv.ask(speech);
  }
}

// Register handlers for Dialogflow intents
app.intent('Default Welcome Intent', (conv) => {
  const welcomeSpeech = `Welcome! What station will you be departing from, 
                         what line will you be riding, and what direction will you be heading?`;
  conversation(conv, 'ask', welcomeSpeech);
});

app.intent('basic train times request', (conv, { startingStationCode, direction, line }) => fetchTrainData(startingStationCode)
  .then(responseBody => utilJsonParse(responseBody))
  .then(parsedResponseBody => parsedResponseBody.Trains)
  .then(startingStationTrains => filterTrains(startingStationTrains, startingStationCode, direction, line))
  .then(requestedTrains => getVoiceDialogue(requestedTrains))
  .then(trainInformationSpeech => conversation(conv, 'close', trainInformationSpeech)));

// Set the DialogflowApp object to handle the HTTPS POST request.
exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);
