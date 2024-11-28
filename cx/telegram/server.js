require("dotenv").config();

const projectId = process.env.PROJECT_ID;
const locationId = process.env.LOCATION;
const agentId = process.env.AGENT_ID;
const languageCode = process.env.LANGUAGE;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

const SERVER_URL = process.env.SERVER_URL;

const  structProtoToJson  = require("./proto_to_json.js").structProtoToJson;

const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const URI = `/webhook/${TELEGRAM_TOKEN}`;
const WEBHOOK = SERVER_URL + URI;

const app = express();
app.use(bodyParser.json());

// Imports the Google Cloud Some API library
const { SessionsClient } = require("@google-cloud/dialogflow-cx");
/**
 * Example for regional endpoint:
 *   const locationId = 'us-central1'
 *   const client = new SessionsClient({apiEndpoint:
 * 'us-central1-dialogflow.googleapis.com'})
 */
const client = new SessionsClient({
  apiEndpoint: locationId + "-dialogflow.googleapis.com",
});

// Converts Telgram request to a detectIntent request.
function telegramToDetectIntent(telegramRequest, sessionPath) {
  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: telegramRequest.message.text,
      },
      languageCode,
    },
  };

  return request;
}

// Converts detectIntent responses to Telegram message requests.
async function convertToTelegramMessage(responses, chatId) {
  let replies = [];

  for (let response of responses.queryResult.responseMessages) {
    let reply;

    switch (true) {
      case response.hasOwnProperty("text"): {
        reply = { chat_id: chatId, text: response.text.text.join() };
        break;
      }

      /**
       * The layout for the custom payload responses can be found in these
       * sites: Buttons: https://core.telegram.org/bots/api#inlinekeyboardmarkup
       * Photos: https://core.telegram.org/bots/api#sendphoto
       * Voice Audios: https://core.telegram.org/bots/api#sendvoice
       */
      case response.hasOwnProperty("payload"): {
        reply = await structProtoToJson(response.payload);
        reply["chat_id"] = chatId;
        break;
      }
      default:
    }
    if (reply) {
      replies.push(reply);
    }
  }

  return replies;
}

/**
 * Takes as input a request from Telegram and converts the request to
 * detectIntent request which is used to call the detectIntent() function
 * and finally output the response given by detectIntent().
 */
async function detectIntentResponse(telegramRequest) {
  const sessionId = telegramRequest.message.chat.id;
  const sessionPath = client.projectLocationAgentSessionPath(
    projectId,
    locationId,
    agentId,
    sessionId
  );
  console.info(sessionPath);

  request = telegramToDetectIntent(telegramRequest, sessionPath);
  const [response] = await client.detectIntent(request);

  return response;
}

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
// app.post(URI, async (req, res) => {
//   const chatId = req.body.message.chat.id;
//   const response = await detectIntentResponse(req.body);
//   const requests = await convertToTelegramMessage(response, chatId);

//   for (request of requests) {
//     if (request.hasOwnProperty("photo")) {
//       await axios.post(`${API_URL}/sendPhoto`, request).catch(function (error) {
//         console.log(error);
//       });
//     } else if (request.hasOwnProperty("voice")) {
//       await axios.post(`${API_URL}/sendVoice`, request).catch(function (error) {
//         console.log(error);
//       });
//     } else {
//       await axios
//         .post(`${API_URL}/sendMessage`, request)
//         .catch(function (error) {
//           console.log(error);
//         });
//     }
//   }

//   return res.send();
// });

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

//  *********************************************** NEW CODE *******************************

// require("dotenv").config();
// const express = require("express");
// const axios = require("axios");
// const bodyParser = require("body-parser");
// const { SessionsClient } = require("@google-cloud/dialogflow-cx");

// const app = express();
// app.use(bodyParser.json());

// // Environment variables
// const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
// const SERVER_URL = process.env.SERVER_URL;
// const PROJECT_ID = process.env.PROJECT_ID;
// const LOCATION = process.env.LOCATION;
// const AGENT_ID = process.env.AGENT_ID;
// const LANGUAGE_CODE = process.env.LANGUAGE_CODE || "en";

// const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
// const URI = `/webhook/${TELEGRAM_TOKEN}`;
// const WEBHOOK = SERVER_URL + URI;

// // Dialogflow client
// const sessionClient = new SessionsClient({
//   apiEndpoint: `${LOCATION}-dialogflow.googleapis.com`,
// });

// const detectIntent = async (sessionId, text) => {
//   const sessionPath = sessionClient.projectLocationAgentSessionPath(
//     PROJECT_ID,
//     LOCATION,
//     AGENT_ID,
//     sessionId
//   );

//   const request = {
//     session: sessionPath,
//     queryInput: {
//       text: {
//         text: text,
//       },
//       languageCode: LANGUAGE_CODE,
//     },
//   };

//   const [response] = await sessionClient.detectIntent(request);
//   return response.queryResult;
// };

// const sendTelegramMessage = async (chatId, text) => {
//   await axios.post(`${API_URL}/sendMessage`, {
//     chat_id: chatId,
//     text: text,
//   });
// };

// app.post(URI, async (req, res) => {
//   console.log("Received update:", JSON.stringify(req.body, null, 2));

//   if (req.body.message && req.body.message.text) {
//     const chatId = req.body.message.chat.id;
//     const messageText = req.body.message.text;

//     try {
//       const dialogflowResponse = await detectIntent(
//         chatId.toString(),
//         messageText
//       );

//       for (const message of dialogflowResponse.responseMessages) {
//         if (message.text) {
//           await sendTelegramMessage(chatId, message.text.text[0]);
//         }
//         // Handle other types of responses (e.g., images, buttons) here
//       }
//     } catch (error) {
//       console.error("Error processing message:", error);
//       await sendTelegramMessage(
//         chatId,
//         "Sorry, I couldn't process your message."
//       );
//     }
//   }

//   res.sendStatus(200);
// });

// const setup = async () => {
//   try {
//     const res = await axios.post(`${API_URL}/setWebhook`, { url: WEBHOOK });
//     console.log("Webhook setup response:", res.data);
//   } catch (error) {
//     console.error(
//       "Error setting up webhook:",
//       error.response ? error.response.data : error.message
//     );
//   }
// };

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, async () => {
//   console.log(`Server is running on port ${PORT}`);
//   await setup();
// });
