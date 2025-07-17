import fs from "fs"
import { WebClient } from "@slack/web-api"
import {
  CANCEL_SUBSCRIPTION_NOTIFY_CHANNEL_IDS,
  UPDATE_ADDRESS_NOTIFY_CHANNEL_IDS,
} from "../app.js"

class SlackImp {
  init() {
    const client = new WebClient(process.env.SLACK_BOT_TOKEN)
    return client
  }

  async uploadFile(filePath, channel_id, message = "", filename, title) {
    const client = await this.init()
    const result = await client.files.uploadV2({
      channel_id,
      initial_comment: message,
      file: fs.createReadStream(filePath),
      filename,
      title,
    })

    if (!result.ok) {
      throw new Error(`Error uploading file: ${result.error}`)
    }

    return result.file
  }

  async toCancelSubscriptionErrors(message, title = "No Title") {
    const channelsIds = CANCEL_SUBSCRIPTION_NOTIFY_CHANNEL_IDS.split(",")

    for (const channelId of channelsIds) {
      try {
        const blocks = [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${title}`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "```" + message + "```",
            },
          },
        ]
        await this.postMessage(channelId, title, blocks)
      } catch (err) {
        console.log(`${title}: toCancelSubscriptionErrors`, err)
      }
    }
  }

  async toUpdateAddressErrors(message, title) {
    const channelsIds = UPDATE_ADDRESS_NOTIFY_CHANNEL_IDS.split(",")

    for (const channelId of channelsIds) {
      try {
        const blocks = [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${title}`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "```" + message + "```",
            },
          },
        ]
        await this.postMessage(channelId, title, blocks)
      } catch (err) {
        console.log(`${title}: toUpdateAddressErrors`, err)
      }
    }
  }

  async postMessage(channel_id, text, blocks) {
    const client = this.init()
    if (Array.isArray(blocks) && blocks.length) {
      blocks = blocks.map((block) => {
        if (block.text && typeof block.text.text === "string") {
          block.text.text = block.text.text.replace(/\\n/g, "\n")
        }
        return block
      })
    }

    const payload = { channel: channel_id, text }
    if (blocks && blocks.length) payload.blocks = blocks

    const result = await client.chat.postMessage(payload)
    if (!result.ok) {
      await client.chat.postMessage({
        channel: "C02ULRX6U21", // #testing_development
        text: `Error sending message to ${channel_id}: ${JSON.stringify(
          result
        )}`,
      })
    }
    return result
  }
}

export default SlackImp
