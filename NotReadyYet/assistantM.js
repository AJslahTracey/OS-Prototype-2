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


let assistant;

async function createAssistant() {
  try {
    assistant = await openai.beta.assistants.create({
      name: "Crypto-Assistant",
      instructions: "Try to answer as short as possible. You have access to different APIs so you are able to give the user real-time crypto data and news data. In addition, you can explain everything in detail and use your existing knowledge.",
      tools: [
        { type: "code_interpreter" },
        { type: "file_search" },
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

app.get('/askAssistant/:question', async (req, res) => {
  const { question } = req.params;
  const storedquestion = question;
  console.log('Received question:', storedquestion);

  async function main() {
    let assistantResponse = {}; // Define assistantResponse as an object

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

      // Create a run and wait for its completion
      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistant.id
      });

      // Fetch the final response after the run completes
      const messages = await openai.beta.threads.messages.list(thread.id);

      // Extract the final response message
      const finalMessage = messages.find(msg => msg.role === 'assistant');

      // Log and return the final assistant's response
      console.log('Assistant response:', finalMessage.content);

      // Send response back to the user
      res.json({
        response: finalMessage.content
      });

    } catch (error) {
      console.error('Error creating thread or fetching message:', error);
      res.status(500).send('An error occurred while processing your request.');
    }
  }

  main();
});
