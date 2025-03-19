import { CANCEL_SUBSCRIPTION_NOTIFY_CHANNELS } from "../app.js";

class SlackImp {
    init() { }

    async sendMessage(message, title) {
        const cancelSubscriptionChannels = CANCEL_SUBSCRIPTION_NOTIFY_CHANNELS.split(',');
        for (const channel of cancelSubscriptionChannels) {
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
    }
}

export default SlackImp;