import fs from "fs"
import { WebClient } from "@slack/web-api"
import {
  CANCEL_SUBSCRIPTION_NOTIFY_CHANNELS,
  UPDATE_ADDRESS_NOTIFY_CHANNELS,
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

  async toCancelSubscriptionErrors(message, title) {
    const cancelSubscriptionChannels =
      CANCEL_SUBSCRIPTION_NOTIFY_CHANNELS.split(",")
    for (const channel of cancelSubscriptionChannels) {
      try {
        await this.sendMessage(channel, message, title)
      } catch (err) {}
    }
  }

  async toUpdateAddressErrors(message, title) {
    const updateAddressChannels = UPDATE_ADDRESS_NOTIFY_CHANNELS.split(",")
    for (const channel of updateAddressChannels) {
      try {
        this.sendMessage(channel, message, title)
      } catch (err) {}
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
