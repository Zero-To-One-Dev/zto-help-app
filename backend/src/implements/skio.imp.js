import { SKIO_API_KEY } from '../app.js'
import { gql, GraphQLClient } from 'graphql-request'

const SKIO_ENDPOINT = 'https://graphql.skio.com/v1/graphql';

class SkioImp {
  constructor() { }

  init() {
    return new GraphQLClient(SKIO_ENDPOINT, {
      headers: {
        authorization: `API ${SKIO_API_KEY}`,
      },
    })
  }

  async getSubscription(email, subscription) {
    const client = this.init()
    return (await client.request(gql`
      query {
        Subscriptions (limit: 1, where: {
            id: {_eq: "${subscription}"},	
            StorefrontUser: {email: {_eq: "${email}"}}
          }, ) {
            id
        }
      }
    `)).Subscriptions.length > 0
  }

  async cancelSubscription(subscription) {
    const client = this.init()
    return (await client.request(gql`
      mutation {
        cancelSubscription(input: {subscriptionId: "${subscription}", shouldSendNotif: true}) {
          ok
        }
      }
    `)).cancelSubscription.ok
  }
}

export default SkioImp;