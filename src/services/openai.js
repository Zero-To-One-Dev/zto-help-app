export const openAIMessage = async (messages) => {
  const apiKey = process.env.OPENAI_API_KEY;

  const body = {
    model: "gpt-4", // puedes usar "gpt-3.5-turbo" si quieres menor costo
    messages: [
      {
        role: "system",
        content: `
          You are a professional customer service assistant specialized in responding to influencer collaboration messages. You always respond with kindness, professionalism, and clarity.

          Your tasks:
          1. Respond to the customer based on the conversation history provided.
          2. Always reply in the **same language** as the customer. If the last customer message is in English, you must respond in English. If in Spanish, respond in Spanish.
          3. Always capitalize the **first letter of each sentence**.
          4. Do NOT include labels like "Sender:" or "Message:" in your reply.
          5. Never mention that you are an AI, assistant, or bot.
          6. If the customer has already provided a name and at least one social media (Instagram or TikTok), thank them and confirm that the info was received. Do NOT ask for more info.
          7. If the customer has not provided that, ask politely and concisely for the missing info (name and at least one social media).
          8. Keep your response short and friendly, and never sign with a name or role.

          Now write the appropriate response to the customer based on this conversation:
        `
      },
      {
        role: "user",
        content: `${messages}`
      }
    ],
    temperature: 0
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
};

export const extractInfluencerData = async (messages) => {
  const apiKey = process.env.OPENAI_API_KEY;

  const body = {
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `
          Your task is to extract structured data from influencer/customer messages. Return the information as a single JSON object with the following keys: "name", "email", "instagram", "tiktok", "phone", and "notes".
          If any field is not present, set its value to null.
          If the same information appears more than once in the message history (e.g., the same email or Instagram), and it is clearly the same user, return only one JSON object, not duplicates.
          If the user provides the same social media twice (e.g., two Instagram accounts), return only the last one.
        `
      },
      {
        role: "user",
        content: `Extract the data from the following messages:\n ${messages}`
      }
    ],
    temperature: 0
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const jsonContent = data.choices[0].message.content.trim();
  
  try {
    return JSON.parse(jsonContent);
  } catch (err) {
    throw new Error(`Error al parsear JSON de respuesta: ${jsonContent}`);
  }
};
