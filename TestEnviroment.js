import OpenAI from "openai";
import fetch from "node-fetch"; // Ensure you have node-fetch installed
import express from "express";


const app = express(); // Initialize app first
const port = 4000;

app.use(express.json()); // Now use the middleware after initializing app

//Hosting server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
//Getting real time Prices of Crypto currencies



const openai = new OpenAI({
  apiKey: "sk-proj-Z27B2NEPytnprItc7KTgT3BlbkFJlwkPynY7zaHJauhT6mJy" // Replace with your actual OpenAI API key
});

const cryptoApiKey = "969b602d4303313e070ba3417c888fdb6f5834a783410b775b99e49d4416"; // Replace with your actual CryptoRank API key

async function getCryptoCurrencies() {
  const apiUrl = `https://api.cryptorank.io/v1/currencies?api_key=${cryptoApiKey}`; // Use the API key directly here

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching data:', error);
    return { error: 'Unable to fetch data at the moment' };
  }
}


//Getting realtime news

async function getCryptoNews() {
  const defaultSearchCategory = 'crypto';  // Default search term
  const defaultMaxArticles = 20;  // Default number of articles

  const gNewsapiKey = '928ff2bfd7e07886724eafe29ae2e372';  // Your API key
  const url = `https://gnews.io/api/v4/search?q=${defaultSearchCategory}&lang=en&country=us&max=${defaultMaxArticles}&apikey=${gNewsapiKey}`;
  
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Error fetching news: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.articles || data.articles.length === 0) {
      throw new Error("No articles found in the news API response.");
    }

    return data;

  } catch (error) {
    console.error('Error fetching news:', error.message);
    return { error: error.message };
  }
}

//create assistant 
let assistant;
let threadId;
let thread;
async function createAssistant() {
  try {
    assistant = await openai.beta.assistants.create({      instructions: "Try to answer as short as possible. You have access to different APIs so you are able to give the user real-time crypto data and news data. In addition, if you are given data, you can explain everything in detail and use your existing knowledge.",
      tools: [
        { type: "code_interpreter" },
        { type: "file_search" },
        {
          type: "function",
          function: {
            "name": "get_crypto_currencies",
            "description": "Fetch a list of cryptocurrencies from the CryptoRank API and get real-time data about them.",
            "parameters": {
              "type": "object",
              "properties": {}
            }
          }
        },
        {
          "type": "function",
          "function": {
            "name": "get_crypto_news",
            "description": "Fetch a list of cryptocurrency-related news articles from the News API using default values.",
            "parameters": {
              "type": "object",
              "properties": {}
            }
          }
        }
      ],
      model: "gpt-4o"
    });
     thread = await openai.beta.threads.create();
    threadId = thread.id; // Store the thread ID
    console.log('Thread created:', threadId);

  } catch (error) {
    console.error('Error creating assistant:', error);
    throw new Error('Failed to create assistant');
  }
}







// Call this function once when the server starts
createAssistant();

let assistantResponse = {}; // Define assistantResponse as an object
let toolCallPromises = []; // To hold promises for all tool calls


app.post("/askAssistant", async (req, res) => {
  const requestBody = req.body; // Get the full request body
  console.log("Received request:", requestBody);

  try {
    // Create a new thread for every request
    const thread = await openai.beta.threads.create();
    const threadId = thread.id; // Store the new thread ID
    console.log("Thread created:", threadId);

    // Create the initial messages array with the system prompt and the entire request body
    const messages = [
      {
        role: "system",
        content:
          "You are Crypto-Assistant. Try to answer as short as possible. You have access to different APIs so you are able to give the user real-time crypto data and news data. In addition, if you are given data, you can explain everything in detail and use your existing knowledge.",
      },
      {
        role: "user",
        content: JSON.stringify(requestBody), // Pass the entire request body as a message
      },
    ];

    const functions = [
      {
        name: "get_crypto_currencies",
        description:
          "Fetch a list of cryptocurrencies from the CryptoRank API and get real-time data about them.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_crypto_news",
        description:
          "Fetch a list of cryptocurrency-related news articles from the News API using default values.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    ];

    let assistantResponse = {};
    let shouldContinue = true;

    while (shouldContinue) {
      // Use the thread ID and messages to create a response in the new thread
      const response = await openai.chat.completions.create({
        model: "gpt-4-0613",
        messages: messages,
        functions: functions,
        function_call: "auto", // Ensure the message is stored inside the thread
      });

      const message = response.choices[0].message;
      console.log("Assistant response:", message);

      if (message.content) {
        // Assistant provided a response without needing a function call
        assistantResponse['conversation'] = message.content;
        shouldContinue = false;
      } else if (message.function_call) {
        // Assistant wants to call a function
        const functionName = message.function_call.name;
        let functionResult;

        if (functionName === "get_crypto_currencies") {
          try {
            const currenciesData = await getCryptoCurrencies();

            if (currenciesData.data) {
              const topCurrencies = currenciesData.data.slice(0, 5).map((currency) => ({
                name: currency.name,
                symbol: currency.symbol,
                marketCap: currency.values.USD.marketCap.toFixed(2),
                price: currency.values.USD.price.toFixed(2),
                change24h: currency.values.USD.percentChange24h.toFixed(2),
                volume24h: currency.values.USD.volume24h.toFixed(2),
                high24h: currency.values.USD.high24h.toFixed(2),
                low24h: currency.values.USD.low24h.toFixed(2),
              }));

              functionResult = topCurrencies.map((c) => `${c.name} (${c.symbol}): $${c.price}`).join("\n");
              assistantResponse["top_cryptocurrencies"] = topCurrencies;
              console.log("Assistant response based on API data:\n", );
            } else {
              throw new Error("No cryptocurrency data available in the API response.");
            }
          } catch (error) {
            console.error("Error fetching data from API:", error.message);
            functionResult = `I'm having trouble fetching cryptocurrency data at the moment. ${error.message}`;
            assistantResponse["error"] = functionResult;
          }
        } else if (functionName === "get_crypto_news") {
          try {
            const newsData = await getCryptoNews();

            if (newsData.articles) {
              const topArticles = newsData.articles.map((article) => ({
                title: article.title,
                description: article.description,
                url: article.url,
                source: article.source.name,
              }));

              functionResult = topArticles.map((a) => `${a.title} - ${a.source}\n${a.url}`).join("\n\n");
              assistantResponse["top_crypto_news"] = topArticles;
              console.log("Assistant response based on news API data:\n", );
            } else {
              throw new Error("No articles found in the API response.");
            }
          } catch (error) {
            console.error("Error fetching news data from API:", error.message);
            functionResult = `I'm having trouble fetching news data at the moment. ${error.message}`;
            assistantResponse["error"] = functionResult;
          }
        }

        // Add the assistant's message with the function call to the messages
        messages.push({
          role: "assistant",
          content: null,
          function_call: message.function_call,
        });

        // Add the function result to the messages
        messages.push({
          role: "function",
          name: functionName,
          content: functionResult,
        });
      }
    }

    // Send the final response
if (!res.headersSent) {
      res.json(assistantResponse); // Response sent back to the client
    }

    // Optionally perform any async tasks after response is sent
    async function logThread() {
      try {
        const myThread = await openai.beta.threads.retrieve(threadId);
        console.log("Thread info:", myThread);
      } catch (error) {
        console.error("Error retrieving thread:", error);
      }
    }
    logThread(); // Log the thread after sending the response

    console.log("Final assistant response:\n", assistantResponse);

  } catch (error) {
    console.error("Error during assistant interaction:", error);
    if (!res.headersSent) {
      res.status(500).send("An error occurred while processing your request.");
    }
  }
});

