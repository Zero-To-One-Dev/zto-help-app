import app from "../app.js"
import { gql, GraphQLClient } from "graphql-request"

const SKIO_ENDPOINT = "https://graphql.skio.com/v1/graphql"

class SkioImp {
  constructor(shopAlias) {
    this.shopAlias = shopAlias
  }

  init() {
    const { [`SKIO_API_KEY_${this.shopAlias}`]: SKIO_API_KEY } = app
    return new GraphQLClient(SKIO_ENDPOINT, {
      headers: {
        authorization: `API ${SKIO_API_KEY}`,
      },
    })
  }

  async getSubscription(email, subscription, haveSellingPlan) {
    let sellingPlanCondition = ""
    if (haveSellingPlan)
      sellingPlanCondition = "sellingPlanId: {_is_null: false}"
    const client = this.init()
    return (
      await client.request(gql`
        query {
          Subscriptions (limit: 1, where: {
              id: {_eq: "${subscription}"},	
              StorefrontUser: {email: {_eq: "${email}"}}
            }) {
              id
              cyclesCompleted
              ShippingAddress {
                address1
                city
                province
                country
                zip
              }
              originOrder {
                platformId
              }
              SubscriptionLines (where:
                {
                  Subscription: {
                    id: {
                      _eq: "${subscription}"
                    }
                  },
                  ${sellingPlanCondition},
                  removedAt: {
                    _is_null: true
                  }
              }) {
                priceWithoutDiscount
                sellingPlanId
                subscriptionId
                ProductVariant {
                  title
                  platformId
                  price
                }
                quantity
              }
            }
          }
      `)
    ).Subscriptions[0]
  }

  async getSubscriptionsByEmail(email) {
    const client = this.init()
    return (
      await client.request(gql`
        query {
          Subscriptions (where: {
            status: {_eq: "ACTIVE"},
            StorefrontUser: {email: {_eq: "${email}"}}
          }) {
            id
            nextBillingDate 
            SubscriptionLines {
              ProductVariant {
                sku
              }
            }
          }
        }
      `)
    ).Subscriptions
  }

  async cancelSubscription(cancelSessionId, subscription) {
    const client = this.init()
    return (
      await client.request(gql`
      mutation {
        cancelSubscription(input: {cancelSessionId: "${cancelSessionId}", subscriptionId: "${subscription}", shouldSendNotif: false}) {
          ok
        }
      }
    `)
    ).cancelSubscription.ok
  }

  async subscriptionsByOrder(order) {
    const client = this.init()
    return (
      await client.request(gql`
      query {
        Subscriptions (limit: 1, where: {
          originOrder: {
            platformId: {_eq: "${order}"}
          }
        }) {
           id
          }
        }`)
    ).Subscriptions.map((subscriptions) => subscriptions.id)
  }

  async applyDiscount(subscriptionId, code) {
    const client = this.init()
    return (
      await client.request(gql`
        mutation {
          applyDiscountCode (input: {
            subscriptionId: "${subscriptionId}",
            code: "${code}"
          }) {
            ok
          }
        }
      `)
    ).applyDiscount
  }

  async updateSubscriptionAddress(
    subscriptionId,
    address1,
    address2,
    province,
    city,
    zip
  ) {
    const client = this.init()
    return (
      await client.request(gql`
      mutation {
        updateSubscriptionShippingAddress (input: {
          subscriptionId: "${subscriptionId}",
          address1: "${address1}",
          address2: "${address2}",
          province: "${province}",
          city: "${city}",
          zip: "${zip}"
        }) {
          message
          ok
        }
      }  
    `)
    ).updateSubscriptionShippingAddress
  }

  async getSubscriptionInfo(id) {
    const client = this.init()
    return (
      await client.request(gql`
      query {
        Subscriptions (limit: 1, where: {id: { _eq: "${id}" }}) {
          StorefrontUser {
            email
            firstName
          }
          nextBillingDate
        }
      }  
    `)
    ).Subscriptions[0]
  }

  async getSubscriptionByContract(platformId) {
    const client = this.init()
    return (
      await client.request(gql`
      query {
        Subscriptions (limit: 1, where: {platformId: { _eq: "${platformId}" }}) {
          StorefrontUser {
            email
          }
          id
          status
        }
      }  
    `)
    ).Subscriptions[0]
  }
}

export default SkioImp
