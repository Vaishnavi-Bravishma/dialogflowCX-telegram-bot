require("dotenv").config();
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const SERVER_URL = process.env.SERVER_URL;

const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const URI = `/webhook/${TELEGRAM_TOKEN}`;
const WEBHOOK = SERVER_URL + URI;

const app = express();
app.use(bodyParser.json());

const setup = async () => {
  console.log("Setting up webhook...");
  console.log("Webhook URL:", WEBHOOK);
  try {
    const res = await axios.post(`${API_URL}/setWebhook`, { url: WEBHOOK });
    console.log("Webhook setup response:", res.data);
  } catch (error) {
    console.error(
      "Error setting up webhook:",
      error.response ? error.response.data : error.message
    );
  }
};

app.post(URI, async (req, res) => {
  console.log("Received update:", JSON.stringify(req.body, null, 2));

  if (req.body.message && req.body.message.text) {
    const chatId = req.body.message.chat.id;
    const messageText = req.body.message.text;

    console.log(`Received message: "${messageText}" from chat ID: ${chatId}`);

    try {
      const response = await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: `You said: ${messageText}`,
      });
      console.log("Echo message sent successfully. Response:", response.data);
    } catch (error) {
      console.error(
        "Error sending echo message:",
        error.response ? error.response.data : error.message
      );
    }
  } else {
    console.log("Received update does not contain a text message");
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Echo bot server is running on port ${PORT}`);
  console.log("Environment variables:");
  console.log("TELEGRAM_TOKEN:", TELEGRAM_TOKEN ? "Set" : "Not set");
  console.log("SERVER_URL:", SERVER_URL);
  await setup();
});

// Add a test endpoint
app.get("/test", (req, res) => {
  console.log("Test endpoint hit");
  res.send("Echo bot is running!");
});
