import { CANCEL_SUBSCRIPTION_NOTIFY_CHANNELS, UPDATE_ADDRESS_NOTIFY_CHANNELS } from "../app.js";

class SlackImp {
    init() { }

    async sendMessage(channel, message, title) {
        try {
            await fetch("https://n8n-zto.herokuapp.com/webhook/slack-notifier-dev", {
                method: "POST",
                body: JSON.stringify({ channel, message, title }),
                headers: {
                    "Content-Type": "application/json",
                },
            });
            console.log(`✅ Error notification sent 🚀`);
        } catch (err) {
            console.log(`❌ Error sending error notification: ${err}`);
        }
    }

    async toCancelSubscriptionErrors(message, title) {
        const cancelSubscriptionChannels = CANCEL_SUBSCRIPTION_NOTIFY_CHANNELS.split(',');
        for (const channel of cancelSubscriptionChannels) {
            try {
                this.sendMessage(channel, message, title)
            } catch (err) {}
        }
    }

    async toUpdateAddressErrors(message, title) {
        const updateAddressChannels = UPDATE_ADDRESS_NOTIFY_CHANNELS.split(',');
        for (const channel of updateAddressChannels) {
            try {
                this.sendMessage(channel, message, title)
            } catch (err) {}
        }
    }
}

export default SlackImp;