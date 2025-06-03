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
      throw new Error(`Error subiendo archivo a Slack: ${result.error}`)
    }

    return result.file
  }

  async sendMessage(channel, message, title) {
    try {
      await fetch("https://n8n-zto.herokuapp.com/webhook/slack-notifier-dev", {
        method: "POST",
        body: JSON.stringify({ channel, message, title }),
        headers: {
          "Content-Type": "application/json",
        },
      })
      console.log(`✅ Error notification sent 🚀`)
    } catch (err) {
      console.log(`❌ Error sending error notification: ${err}`)
    }
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
}

export default SlackImp
