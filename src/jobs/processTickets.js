import GorgiasImp from "../implements/gorgias.imp.js"
import GoogleImp from "../implements/google.imp.js"
import MessageImp from '../implements/slack.imp.js'
import OpenAIImp from "../implements/openai.imp.js"
import DBRepository from "../repositories/postgres.repository.js"

//classes
const dbRepository = new DBRepository()
const gorgias = new GorgiasImp()
const openAI = new OpenAIImp()
const google = new GoogleImp()
const slack = new MessageImp()
//utils
const emailSender = gorgias.emailSender
const createMessagePrompt = `
You are a professional customer service assistant specialized in responding to influencer collaboration messages. You always respond with kindness, professionalism, and clarity.

Your tasks:
1. Respond to the customer based on the conversation history provided.
2. Always reply in the **same language** as the customer. If the last customer message is in English, you must respond in English. If in Spanish, respond in Spanish.
3. Always capitalize the **first letter of each sentence**.
4. Do NOT include labels like "Sender:" or "Message:" in your reply.
5. Never mention that you are an AI, assistant, or bot.
6. If the customer has already provided a name and at least one social media (Instagram or TikTok), thank them and confirm that the info was received. Do NOT ask for more info.
7. If the customer has not provided that, ask politely and concisely for the missing info (name and at least one social media), dont forget to ask about their email or phone number too but keep in mind that email and phone number are optional.
8. Keep your response short and friendly, and never sign with a name or role.
9. Respond in the same channel where the conversation took place, dont tell the user to send the information to other emails.  

Now write the appropriate response to the customer based on this conversation:
`
const extractDataPromt = `
Your task is to extract structured data from influencer/customer messages. Return the information as a single JSON object with the following keys: "brand", "name", "email", "instagram", "tiktok", "phone", and "notes".
If any field is not present, set its value to ''.
The "brand" field should contain the name of the brand mentioned in the messages or in the tags, if any are present. Our brands are "ReduSculpt", "VibroSculpt", "HotShapers", "MyWay", "DrMing", "CopperSlim".
If the same information appears more than once in the message history (e.g., the same email or Instagram), and it is clearly the same user, return only one JSON object, not duplicates.
If the user provides the same social media twice (e.g., two Instagram accounts), return only the last one.
If the user provides extra information that is not related to the required fields, include it in the "notes" field.
If the user has provided a name and at least one social media (Instagram or TikTok), create a key called "confirmed" with a value of true as a boolean not string, otherwise is false.
The data that you extract has to be only one object and it's keys values most be strings strings values, not arrays or objects.
`
const processTicketTag = process.env.PROCESS_TICKET_TAG
const spreadsheetId = process.env.SHEET_ID
const sheetName = process.env.SHEET_NAME

const processOneTicket = async (ticketRow) => {
  try {
    // Obtener ticket tags y verificar si tiene el tag del proceso, si no, salir
    const ticketTags = ticketRow.tags

    if (!ticketTags.toLowerCase().includes(processTicketTag.toLowerCase())) {
      await dbRepository.updateTicketStatus(ticketRow.ticket_id, 'UNPROCESSED');
      console.log(`Ticket ${ticketRow.ticket_id} does not have the tag ${processTicketTag}, skipping...`);
      return
    };

    if (ticketTags.toLowerCase().includes('auto-close')) {
      await dbRepository.updateTicketStatus(ticketRow.ticket_id, 'UNPROCESSED');
      await slack.postMessage('C09176CKX9A', `Ticket has influencer but is auto-closed, please check: https://b2cresponse.gorgias.com/app/ticket/${ticketRow.ticket_id}`);
      return
    };

    // Obtener ticket
    const ticket = await gorgias.getTicket(ticketRow.ticket_id);
    if (!ticket) {
      await slack.postMessage('C09176CKX9A', `Ticket ${ticketRow.ticket_id} not found in gorgias`);
      throw new Error("Ticket not found in Gorgias");
    }

    // if (ticket.status === "closed") {
    //   await dbRepository.updateTicketStatus(ticketRow.ticket_id, 'COMPLETED');
    //   console.log(`Ticket ${ticketRow.ticket_id} is not open, skipping...`);
    //   return 
    // }

    // Obtener los mensajes del ticket y crear el mensaje para OpenAI
    const ticketMessages = ticket.messages
    let ticketMessagesStr = ""
    if (ticketMessages.length > 0) {
      ticketMessagesStr = ticketMessages
        .map((message, index) => {
          if (index == 0) {
            return gorgias.cleanMessage(
              `Customer: ${ticket.customer.name}.\nMessage: ${message.body_text}.`
            )
          } else if (ticket.customer.name == message.sender.name) {
            return gorgias.cleanMessage(
              `Customer: ${message.sender.name}.\nMessage: ${message.body_text}.`
            )
          } else {
            return gorgias.cleanMessage(`${message.body_text}.`)
          }
        })
        .join("\n")
      ticketMessagesStr = `tags: ${ticketTags}   ${ticketMessagesStr}`
    }
    // Datos para establecer la comunicación
    const lastSender =
      ticketMessages[ticketMessages.length - 1].sender.email || ""
    const firstMessage = ticketMessages[0]
    const ticketChannel = ticket.channel
    const ticketSource = {
      from: {
        name: firstMessage.source.to[0].name,
        address: firstMessage.source.to[0].address,
      },
      type: `${ticketChannel}`,
      to: [
        {
          name: firstMessage.source.from.name,
          address: firstMessage.source.from.address,
        },
      ],
    }
    const reciever = {
      id: ticket.customer.id,
      name: ticket.customer.name,
    }

    console.log(`Processing ticket ${ticketRow.ticket_id}...`);
    await dbRepository.updateTicketStatus(ticketRow.ticket_id, 'PROCESSING');
    await slack.postMessage('C09176CKX9A', `Processing ticket https://b2cresponse.gorgias.com/app/ticket/${ticketRow.ticket_id} ...`);

    if (lastSender !== emailSender) {
      const reply = await openAI.openAIMessage(createMessagePrompt, ticketMessagesStr);
      await gorgias.sendMessageTicket(ticket.id, reply, ticketChannel, ticketSource, reciever);
      console.log(`Message sent to ticket ${ticketRow.ticket_id}...`);
    }
    const customerData = await openAI.extractInfluencerData(extractDataPromt, ticketMessagesStr);
    if (customerData.confirmed === true || customerData.confirmed === "true") {
      await google.appendValues(spreadsheetId, `${sheetName}`, [[
        customerData.brand,
        customerData.instagram,
        customerData.tiktok,
        customerData.name,
        customerData.email,
        customerData.phone,
        customerData.notes
      ]]);
      await dbRepository.updateTicketStatus(ticketRow.ticket_id, 'COMPLETED');
      console.log(`Ticket ${ticketRow.ticket_id} completed`);
      await slack.postMessage('C09176CKX9A', `Ticket ${ticketRow.ticket_id} compleated successfully`);
      await gorgias.updateTicketStatus(ticketRow.ticket_id, 'closed');
    } else {
      await dbRepository.updateTicketStatus(ticketRow.ticket_id, 'UNPROCESSED');
      await slack.postMessage('C09176CKX9A', `Waiting for user to provide more data for Ticket ${ticketRow.ticket_id}`);
    }

  } catch (err) {
    console.error(`❌ Ticket ${ticketRow.ticket_id} failed:`, err);
    await slack.postMessage('C09176CKX9A', `Ticket ${ticketRow.ticket_id} error: ${err.message}`);
    await dbRepository.updateTicketStatus(ticketRow.ticket_id, 'ERROR');
    await dbRepository.incrementRetries(ticketRow.ticket_id);
  }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const run = async () => {
  const unprocessed = await dbRepository.getTicketsByStatusAndTags(['UNPROCESSED', 'ERROR'], [`${processTicketTag}`]);
  
  for (const ticket of unprocessed) {
    if (ticket.retries >= 3) continue;
    await processOneTicket(ticket);
    await sleep(1000);
  }
  
  process.exit();
};

run();
