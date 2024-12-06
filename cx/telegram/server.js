
require("dotenv").config();

const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

const { SessionsClient } = require("@google-cloud/dialogflow-cx");
const structProtoToJson = require("./proto_to_json.js").structProtoToJson;

const projectId = process.env.PROJECT_ID;
const locationId = process.env.LOCATION;
const agentId = process.env.AGENT_ID;
const languageCode = process.env.LANGUAGE;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const SERVER_URL = process.env.SERVER_URL;

const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const URI = `/webhook/${TELEGRAM_TOKEN}`;
const WEBHOOK = SERVER_URL + URI;

const app = express();
app.use(bodyParser.json());

// Dialogflow CX client setup
const client = new SessionsClient({
  apiEndpoint: `${locationId}-dialogflow.googleapis.com`,
});

// Session timeout configuration (60 minutes)
const SESSION_TIMEOUT = 60 * 60 * 1000;
const activeSessions = new Map(); // Store active sessions with expiration timers

// Helper function to manage session timeout
function manageSessionTimeout(chatId, sessionId) {
  if (activeSessions.has(chatId)) {
    clearTimeout(activeSessions.get(chatId).timeout);
  }

  const timeout = setTimeout(() => {
    activeSessions.delete(chatId); // Remove session after timeout
    console.log(`Session expired for chat ID: ${chatId}`);
  }, SESSION_TIMEOUT);

  activeSessions.set(chatId, { sessionId, timeout });
}

// Convert Telegram request to Dialogflow detectIntent request
function telegramToDetectIntent(telegramRequest, sessionPath) {
  return {
    session: sessionPath,
    queryInput: {
      text: {
        text: telegramRequest.message.text,
      },
      languageCode,
    },
  };
}

// Convert Dialogflow response to Telegram message
async function convertToTelegramMessage(responses, chatId) {
  const replies = [];

  for (const response of responses.queryResult.responseMessages) {
    let reply;

    if (response.hasOwnProperty("text")) {
      reply = { chat_id: chatId, text: response.text.text.join() };
    } else if (response.hasOwnProperty("payload")) {
      reply = await structProtoToJson(response.payload);
      reply.chat_id = chatId;
    }

    if (reply) {
      replies.push(reply);
    }
  }

  return replies;
}

// Handle detectIntent logic with session management
async function detectIntentResponse(telegramRequest) {
  const chatId = telegramRequest.message.chat.id;

  let sessionId;
  if (activeSessions.has(chatId)) {
    sessionId = activeSessions.get(chatId).sessionId;
  } else {
    sessionId = `telegram-${chatId}-${Date.now()}`;
    console.log(`Created new session ID for chat ID: ${chatId}`);
  }

  manageSessionTimeout(chatId, sessionId); // Reset session timeout

  const sessionPath = client.projectLocationAgentSessionPath(
    projectId,
    locationId,
    agentId,
    sessionId
  );

  const request = telegramToDetectIntent(telegramRequest, sessionPath);
  const [response] = await client.detectIntent(request);

  return response;
}

// Setup Telegram webhook
const setup = async () => {
  const webhookUrl = `${SERVER_URL}${URI}`;
  console.log(`Setting webhook to: ${webhookUrl}`);
  try {
    const res = await axios.post(`${API_URL}/setWebhook`, { url: webhookUrl });
    console.log("Webhook setup response:", res.data);
  } catch (error) {
    console.error(
      "Error setting webhook:",
      error.response ? error.response.data : error.message
    );
  }
};

// Handle incoming Telegram messages
app.post(URI, async (req, res) => {
  try {
    console.log("Received webhook:", JSON.stringify(req.body, null, 2));

    const chatId = req.body.message.chat.id;
    console.log("Processing request for chat ID:", chatId);

    const response = await detectIntentResponse(req.body);
    console.log("Dialogflow response:", JSON.stringify(response, null, 2));

    const requests = await convertToTelegramMessage(response, chatId);
    console.log(
      "Converted Telegram messages:",
      JSON.stringify(requests, null, 2)
    );

    for (const request of requests) {
      let endpoint = `${API_URL}/sendMessage`;
      if (request.hasOwnProperty("photo")) {
        endpoint = `${API_URL}/sendPhoto`;
      } else if (request.hasOwnProperty("voice")) {
        endpoint = `${API_URL}/sendVoice`;
      }

      try {
        const result = await axios.post(endpoint, request);
        console.log(
          `Successfully sent message to Telegram. Response:`,
          result.data
        );
      } catch (error) {
        console.error(
          `Error sending message to Telegram:`,
          error.response ? error.response.data : error.message
        );
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.sendStatus(500);
  }
});

// Start server
const listener = app.listen(process.env.PORT, async () => {
  console.log(
    "Your Dialogflow integration server is listening on port " +
      listener.address().port
  );

  await setup();
});

exports = {
  telegramToDetectIntent,
  convertToTelegramMessage,
};





// require("dotenv").config();

// const projectId = process.env.PROJECT_ID;
// const locationId = process.env.LOCATION;
// const agentId = process.env.AGENT_ID;
// const languageCode = process.env.LANGUAGE;
// const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

// const SERVER_URL = process.env.SERVER_URL;

// const  structProtoToJson  = require("./proto_to_json.js").structProtoToJson;

// const express = require("express");
// const axios = require("axios");
// const bodyParser = require("body-parser");

// const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
// const URI = `/webhook/${TELEGRAM_TOKEN}`;
// const WEBHOOK = SERVER_URL + URI;

// const app = express();
// app.use(bodyParser.json());

// // Imports the Google Cloud Some API library
// const { SessionsClient } = require("@google-cloud/dialogflow-cx");
// /**
//  * Example for regional endpoint:
//  *   const locationId = 'us-central1'
//  *   const client = new SessionsClient({apiEndpoint:
//  * 'us-central1-dialogflow.googleapis.com'})
//  */
// const client = new SessionsClient({
//   apiEndpoint: locationId + "-dialogflow.googleapis.com",
// });



// // Converts Telgram request to a detectIntent request.
// function telegramToDetectIntent(telegramRequest, sessionPath) {
//   const request = {
//     session: sessionPath,
//     queryInput: {
//       text: {
//         text: telegramRequest.message.text,
//       },
//       languageCode,
//     },
//   };

//   return request;
// }




// // // Converts detectIntent responses to Telegram message requests.
// async function convertToTelegramMessage(responses, chatId) {
//   let replies = [];

//   for (let response of responses.queryResult.responseMessages) {
//     let reply;

//     switch (true) {
//       case response.hasOwnProperty("text"): {
//         reply = { chat_id: chatId, text: response.text.text.join() };
//         break;
//       }

//       /**
//        * The layout for the custom payload responses can be found in these
//        * sites: Buttons: https://core.telegram.org/bots/api#inlinekeyboardmarkup
//        * Photos: https://core.telegram.org/bots/api#sendphoto
//        * Voice Audios: https://core.telegram.org/bots/api#sendvoice
//        */
//       case response.hasOwnProperty("payload"): {
//         reply = await structProtoToJson(response.payload);
//         reply["chat_id"] = chatId;
//         break;
//       }
//       default:
//     }
//     if (reply) {
//       replies.push(reply);
//     }
//   }

//   return replies;
// }

// // /**
// //  * Takes as input a request from Telegram and converts the request to
// //  * detectIntent request which is used to call the detectIntent() function
// //  * and finally output the response given by detectIntent().
// //  */



// async function detectIntentResponse(telegramRequest) {
//   const sessionId = telegramRequest.message.chat.id;
//   const sessionPath = client.projectLocationAgentSessionPath(
//     projectId,
//     locationId,
//     agentId,
//     sessionId
//   );
//   console.info(sessionPath);

//   request = telegramToDetectIntent(telegramRequest, sessionPath);
//   const [response] = await client.detectIntent(request);

//   return response;
// }

// const setup = async () => {
//   const webhookUrl = `${SERVER_URL}${URI}`;
//   console.log(`Setting webhook to: ${webhookUrl}`);
//   try {
//     const res = await axios.post(`${API_URL}/setWebhook`, { url: webhookUrl });
//     console.log("Webhook setup response:", res.data);
//   } catch (error) {
//     console.error(
//       "Error setting webhook:",
//       error.response ? error.response.data : error.message
//     );
//   }
// };


// app.post(URI, async (req, res) => {
//   try {
//     console.log("Received webhook:", JSON.stringify(req.body, null, 2));

//     const chatId = req.body.message.chat.id;
//     console.log("Processing request for chat ID:", chatId);

//     const response = await detectIntentResponse(req.body);
//     console.log("Dialogflow response:", JSON.stringify(response, null, 2));

//     const requests = await convertToTelegramMessage(response, chatId);
//     console.log(
//       "Converted Telegram messages:",
//       JSON.stringify(requests, null, 2)
//     );

//     for (const request of requests) {
//       let endpoint = `${API_URL}/sendMessage`;
//       if (request.hasOwnProperty("photo")) {
//         endpoint = `${API_URL}/sendPhoto`;
//       } else if (request.hasOwnProperty("voice")) {
//         endpoint = `${API_URL}/sendVoice`;
//       }

//       try {
//         const result = await axios.post(endpoint, request);
//         console.log(
//           `Successfully sent message to Telegram. Response:`,
//           result.data
//         );
//       } catch (error) {
//         console.error(
//           `Error sending message to Telegram:`,
//           error.response ? error.response.data : error.message
//         );
//       }
//     }

//     res.sendStatus(200);
//   } catch (error) {
//     console.error("Error processing webhook:", error);
//     res.sendStatus(500);
//   }
// });



// const listener = app.listen(process.env.PORT, async () => {
//   console.log(
//     "Your Dialogflow integration server is listening on port " +
//       listener.address().port
//   );

//   await setup();
// });

// exports = {
//   telegramToDetectIntent,
//   convertToTelegramMessage,
// };


