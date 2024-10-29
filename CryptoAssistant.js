import { OpenAI } from 'openai';
import fetch from "node-fetch"; // Ensure you have node-fetch installed
import express from "express"

const app = express();
const port = 4000;



const port = process.env.PORT || 4000;  // Use Railway's assigned port, fallback to 4000 for local dev
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
//Getting real time Prices of Crypto currencies


//Getting real time Prices of Crypto currencies



const openai = new OpenAI({
  apiKey: "openAI-API-KEY" // Replace with your actual OpenAI API key
});

const cryptoApiKey = "CryptoRankAPI-KEY"; // Replace with your actual CryptoRank API key

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

async function createAssistant() {
  try {
    assistant = await openai.beta.assistants.create({
      name: "Crypto-Assistant",
      instructions: "Try to answer as short as possible. You have access to different APIs so you are able to give the user real-time crypto data and news data. In addition, if you are given data, you can explain everything in detail and use your existing knowledge.",
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

    console.log('Assistant created:', assistant);
  } catch (error) {
    console.error('Error creating assistant:', error);
    throw new Error('Failed to create assistant');
  }
}

// Call this function once when the server starts
createAssistant();

let assistantResponse = {}; // Define assistantResponse as an object
let toolCallPromises = []; // To hold promises for all tool calls


app.get('/askAssistant/:question', async (req, res) => {
  const { question } = req.params;
  console.log('Received question:', question);

  // Set headers for streaming response
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  res.flushHeaders(); // Flush headers immediately

  let messages = [
    {
      role: 'system',
      content:
        'Try to answer as concisely as possible. You have access to different APIs so you can provide real-time crypto data and news. Use your existing knowledge to explain the data in detail.',
    },
    {
      role: 'user',
      content: question,
    },
  ];

  const functions = [
    {
      name: 'get_crypto_currencies',
      description:
        'Fetch a list of cryptocurrencies from the CryptoRank API and get real-time data about them.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_crypto_news',
      description:
        'Fetch a list of cryptocurrency-related news articles from the News API using default values.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  ];

  try {
    let assistantFinished = false;

    while (!assistantFinished) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4', // Use 'gpt-3.5-turbo' if you don't have access to GPT-4
        messages: messages,
        functions: functions,
        function_call: 'auto',
        stream: true,
      });

      const stream = response; // response is a stream

      await new Promise((resolve, reject) => {
        let functionCall = null;
        let functionArgs = null;

        stream.on('data', (chunk) => {
          const data = chunk.toString();
          const lines = data
            .split('\n')
            .filter((line) => line.trim() !== '');

          for (const line of lines) {
            const message = line.replace(/^data: /, '');
            if (message === '[DONE]') {
              res.write('\n');
              resolve();
              return;
            }
            try {
              const parsed = JSON.parse(message);
              const delta = parsed.choices[0].delta;

              if (delta.content) {
                res.write(delta.content);
              }

              if (delta.function_call) {
                functionCall = delta.function_call.name;
                functionArgs = delta.function_call.arguments
                  ? JSON.parse(delta.function_call.arguments)
                  : {};
              }
            } catch (error) {
              console.error(
                'Could not JSON parse stream message',
                message,
                error
              );
            }
          }
        });

        stream.on('error', (error) => {
          console.error('Stream error:', error);
          reject(error);
        });

        stream.on('end', () => {
          if (functionCall) {
            resolve();
          } else {
            assistantFinished = true;
            res.end();
            resolve();
          }
        });
      });

      if (assistantFinished) break;

      // Handle function call
      let functionResponse;
      if (functionCall === 'get_crypto_currencies') {
        functionResponse = await getCryptoCurrencies();
      } else if (functionCall === 'get_crypto_news') {
        functionResponse = await getCryptoNews();
      } else {
        functionResponse = { error: 'Unknown function' };
      }

      messages.push({
        role: 'assistant',
        content: null,
        function_call: {
          name: functionCall,
          arguments: JSON.stringify(functionArgs),
        },
      });

      messages.push({
        role: 'function',
        name: functionCall,
        content: JSON.stringify(functionResponse),
      });

      functionCall = null;
      functionArgs = null;
    }
  } catch (error) {
    console.error('Error processing request:', error);
    if (!res.headersSent) {
      res
        .status(500)
        .send('An error occurred while processing your request.');
    } else {
      res.end();
    }
  }
});
