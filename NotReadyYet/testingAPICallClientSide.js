import OpenAI from "openai";


const apikey = "sk-proj-Z27B2NEPytnprItc7KTgT3BlbkFJlwkPynY7zaHJauhT6mJy"

const openai = new OpenAI({
  apiKey: apikey,
});


let messages;
async function getThreadMessages(threadId) {
  try {
     messages = await openai.beta.threads.messages.list(threadId);
    return messages.data;
  } catch (error) {
    console.error('Error fetching thread messages:', error);
    return [];
  }
}



async function logThreadContent(threadId) {
  const messages = await getThreadMessages(threadId);
  
  console.log(`Thread Content for Thread ID: ${threadId}`);
  console.log('----------------------------------------');

  for (const message of messages.reverse()) {
    console.log(`Role: ${message.role}`);
    console.log(`Content: ${message.content[0].text.value}`);
    console.log('----------------------------------------');
  }
}

// Usage example
const threadId = 'thread_dal8vDi7eBRFAV9bmsk8uZWy';
logThreadContent(threadId);