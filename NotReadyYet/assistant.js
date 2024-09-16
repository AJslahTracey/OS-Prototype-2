import OpenAI from "openai";
import fetch from "node-fetch";
import express from "express"


const app = express();
const port = 3000;

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});


const openai = new OpenAI({
  apiKey: "sk-proj-Z27B2NEPytnprItc7KTgT3BlbkFJlwkPynY7zaHJauhT6mJy"
});


let thread, assistant

async function createAssistant() {
  try{
     assistant = await openai.beta.assistants.create({
      name: "Crypo-Assistant",
      instructions: "Try to answer as short as possible. You have access to different APIs so you are able to give the user realtime crypto data and news data. In addition, you can explain everything in detail and use your existing knowledge.",
      tools: [{ type: "code_interpreter" }, { type: "file_search" }],
      model: "gpt-4o"
    });
  
    console.log('Assistant created:', assistant);
  
    // Create a new thread
     thread = await openai.beta.threads.create();
    console.log('Thread created:', thread);
  
  }catch(error) {
    console.error('error creating assistant', error)
  }
}

createAssistant()


app.get('/askAssistant/:question', async (req, res) => {
  const { question } = req.params;
  const storedquestion = question;
  console.log('Received question:', storedquestion);

  async function main() {
    try {
      // Create an assistant
      
      // Send a message to the thread
      const message = await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: storedquestion
      });
      console.log('Message sent:', message);
  
      // Variable to accumulate the assistant's response
      let accumulatedResponse = '';
  
      // Create a stream to handle the assistant's response
      const run = openai.beta.threads.runs.stream(thread.id, {
        assistant_id: assistant.id
      });
  
      // Collect each part of the response and store it in the accumulatedResponse variable
      run.on('textCreated', (text) => {
        accumulatedResponse += text.value;
      });
  
      run.on('textDelta', (textDelta) => {
        accumulatedResponse += textDelta.value;
      });
  
      run.on('end', () => {

        res.send(accumulatedResponse)
        // The full response has been accumulated in the accumulatedResponse variable
        console.log("\nAssistant's complete response:");
        console.log(accumulatedResponse);
  
        // Here you can return or send accumulatedResponse to the client side
        // Example:
        // res.json({ response: accumulatedResponse });
      });
  
    } catch (error) {
      console.error('Error creating assistant, thread, or sending/fetching message:', error);
    }
  }
  
  main();
});