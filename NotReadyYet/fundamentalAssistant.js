import OpenAI from "openai";
import fetch from "node-fetch"; // Ensure you have node-fetch installed
import express from "express"

const app = express();
const port = 5500;


//Hosting server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

//Getting real time Prices of Crypto currencies



const openai = new OpenAI({
  apiKey: "sk-proj-Z27B2NEPytnprItc7KTgT3BlbkFJlwkPynY7zaHJauhT6mJy" // Replace with your actual OpenAI API key
});

const cryptoApiKey = "969b602d4303313e070ba3417c888fdb6f5834a783410b775b99e49d4416"; // Replace with your actual CryptoRank API key

async function getFinancaialDataSets(ticker) {
 // Add your API key to the headers
    const headers = {
        'X-API-KEY': 'ed045d83-6830-45ad-830e-4edaa96272c5'
    };

    // Set your query params
    const tickerParm = ticker;    // stock ticker
    const period = 'annual';  // possible values are 'annual', 'quarterly', or 'ttm'
    const limit = 30;         // number of statements to return

    // Create the URL
    const url = `https://api.financialdatasets.ai/financials/income-statements?ticker=${ticker}&period=${period}&limit=${limit}`;

    // Make API request
    fetch(url, { headers })
        .then(response => response.json())
        .then(data => {
            // Parse income_statements from the response
            const incomeStatements = data.income_statements;
            console.log(incomeStatements);
        })
        .catch(error => {
            console.error('Error fetching income statements:', error);
        });

}


//Getting realtime news

async function getStockmarketNews() {
  const defaultSearchCategory = 'Stockmarket';  // Default search term
  const defaultMaxArticles = 20;  // Default number of articles

  const gNewsapiKey = '928ff2bfd7e07886724eafe29ae2e372';  // Your API key
  const url = `https://gnews.io/api/v4/search?q=${defaultSearchCategory}&lang=en&country=us&max=${defaultMaxArticles}&apikey=${gNewsapiKey}`;
  console.log(url)
  
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
      instructions: "You are a assistant that is able to fetch financial Datasets from Companies",
      tools: [
        { type: "code_interpreter" },
        { type: "file_search" },
        {
            "type": "function",
            "function": {
              "name": "getStockmarketNews",
              "description": "Fetch a list of cryptocurrency-related news articles from the News API using default values.",
              "parameters": {
                "type": "object",
                "properties": {}
              }
            }
          },
          {
            type: "function",
            function: {
              name: "get_financial_data",
              description: "Fetch annual income statements for a company. The assistant will choose a stock ticker if one is not provided.",
              parameters: {
                type: "object",
                properties: {
                  ticker: {
                    type: "string",
                    description: "The stock ticker symbol (e.g., 'NVDA', 'AAPL'). If not provided, you will choose one."
                  }
                },
                required: []
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
  const storedquestion = question;
  console.log('Received question:', storedquestion);

  async function main() {
    

    try {
      // Create a new thread with OpenAI
      const thread = await openai.beta.threads.create();
      console.log('Thread created:', thread);

      // Send the user's question to the assistant
      const message = await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: storedquestion
      });
      console.log('Message sent:', message);

      // Create a stream to handle the assistant's response
      const run = openai.beta.threads.runs.stream(thread.id, {
        assistant_id: assistant.id
      });

      // Handle tool call events
      run.on('toolCallCreated', (toolCall) => {
        const toolCallPromise = (async () => {
          // Handle "get_financial_data" tool call
          if (toolCall.function.name === 'get_financial_data') {
            try {
              // Extract ticker from tool call parameters, or default to 'AAPL'
              const ticker = toolCall.parameters.ticker || 'AAPL';
              
              // Call the getFinancialDataSets function with the ticker
              const financialData = await getFinancialDataSets(ticker);
              
              if (financialData.income_statements) {
                // Process the top 5 financial data entries
                const topIncomeStatements = financialData.income_statements.slice(0, 5).map(statement => ({
                  year: statement.year,
                  revenue: statement.revenue,
                  netIncome: statement.net_income,
                  grossProfit: statement.gross_profit,
                  operatingExpense: statement.operating_expense
                }));
      
                // Store the financial data in the assistantResponse object
                assistantResponse['top_income_statements'] = topIncomeStatements;
                console.log('Assistant response based on financial API data:\n', assistantResponse);
              } else {
                throw new Error("No financial data available in the API response.");
              }
            } catch (error) {
              console.error('Error fetching financial data from API:', error.message);
              assistantResponse['error'] = `I'm having trouble fetching financial data at the moment. ${error.message}`;
            }
          }
        })();

        toolCallPromises.push(toolCallPromise); // Add promise to array
        });

      // Collect text response as it comes in
      run.on('textCreated', (text) => {
        assistantResponse['conversation'] = text.value; // Add conversation text to assistantResponse
      });

      run.on('textDelta', (textDelta) => {
        if (!assistantResponse['conversation']) assistantResponse['conversation'] = ''; // Initialize if needed
        assistantResponse['conversation'] += textDelta.value; // Append to conversation text
      });
      let accumulatedText = '';      

      // Wait for the run to finish
      run.on('end', async () => {
        try {
          // Wait for all tool calls to complete
          await Promise.all(toolCallPromises);

          // Send the final response
          if (!res.headersSent) {
            res.json(assistantResponse); 
            assistantResponse = {}; // Define assistantResponse as an object
            toolCallPromises = [];// Return a structured JSON response
            console.log('Run completed. Final assistant response:\n', assistantResponse);
          }
        } catch (error) {
          console.error('Error awaiting tool calls:', error);
          if (!res.headersSent) {
            res.status(500).send('An error occurred while processing your request.');
          }
        }
      });

    } catch (error) {
      console.error('Error creating assistant, thread, or sending/fetching message:', error);
      if (!res.headersSent) {
        res.status(500).send('An error occurred while processing your request.');
      }
    }
  }

  main(); // Call the main function when the API route is hit
});
