import fetch from 'node-fetch';

class OpenAIImp {
  constructor(apiKey = process.env.OPENAI_API_KEY) {
    this.apiKey = apiKey;
    this.apiURL = process.env.OPENAI_API_URL;
  }

  init() {
    // Aquí podrías conectar logs, configuraciones externas, etc.
  }

  async openAIMessage(promt, messages) {
    const body = {
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: promt
        },
        {
          role: 'user',
          content: messages
        }
      ],
      temperature: 0
    };

    const response = await fetch(this.apiURL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  async extractInfluencerData(promt, messages) {
    const body = {
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: promt
        },
        {
          role: 'user',
          content: `Extract the data from the following messages:\n${messages}`
        }
      ],
      temperature: 0
    };

    const response = await fetch(this.apiURL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
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
  }
}

export default OpenAIImp;
