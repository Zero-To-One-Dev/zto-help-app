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

  async toCancelSubscriptionErrors(message, title = 'No Title') {
    const channelsIds = CANCEL_SUBSCRIPTION_NOTIFY_CHANNEL_IDS.split(",");

    for (const channelId of channelsIds) {
      try {
        await this.postMessage(channelId, `${title} \n ${message}`)
      } catch (err) {
        console.log(`${title}: toCancelSubscriptionErrors`, err);
      }
    }
  }

  async toUpdateAddressErrors(message, title) {

    const channelsIds = UPDATE_ADDRESS_NOTIFY_CHANNEL_IDS.split(",");

    for (const channelId of channelsIds) {
      try {
        await this.postMessage(channelId, `${title} \n ${message}`)
      } catch (err) {
        console.log(`${title}: toUpdateAddressErrors`, err);
      }
    }
  }

  async postMessage(channel_id, text) {
    const client = this.init()
    const result = await client.chat.postMessage({
      channel: channel_id,
      text,
    })

    if (!result.ok) {
      throw new Error(`Error sending message: ${result.error}`)
    }

    return result
  }
}

export default SlackImp
