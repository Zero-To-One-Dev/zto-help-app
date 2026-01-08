import ConfigStores from '../services/config-stores.js';
import { gql, GraphQLClient } from "graphql-request"

const SKIO_ENDPOINT = "https://graphql.skio.com/v1/graphql"

class SkioImp {
  constructor(shopAlias) {
    this.shopAlias = shopAlias
  }

  async init() {
    const STORES_INFORMATION = await ConfigStores.getStoresInformation();
    if(!STORES_INFORMATION[this.shopAlias]) {
      throw new Error(`Store with alias "${this.shopAlias}" not found in ConfigStore (Class SkioImp).`);
    }
    const SKIO_API_KEY = STORES_INFORMATION[this.shopAlias].skio_api_key;

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
    const client = await this.init()
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
    const client = await this.init()
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
    const client = await this.init()
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
    const client = await this.init()
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

  async subscriptionsByContract(contract) {
    const client = await this.init()
    return (
      await client.request(gql`
      query {
        Subscriptions (limit: 1, where: {
          platformId: {_eq: "${contract}"}
        }) {
           id
          }
        }`)
    ).Subscriptions.map((subscriptions) => subscriptions.id)
  }

  async applyDiscount(subscriptionId, code) {
    const client = await this.init()
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
    ).applyDiscountCode
  }

  async pauseSubscription(subscriptionId, unit = "DAY", value = 15.0) {
    const client = await this.init()
    return (
      await client.request(gql`
        mutation {
          pauseSubscription (input: {
            skipOption: {
              unit: "${unit}", 
              value: ${value}
            },
            subscriptionId: "${subscriptionId}"
          }) {
            ok
            message
          }
        }
      `)
    ).pauseSubscription
  }

  async updateSubscriptionAddress(
    subscriptionId,
    address1,
    address2,
    province,
    city,
    zip
  ) {
    const client = await this.init()
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
    const client = await this.init()
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
    const client = await this.init()
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

  // async updateNextBillingDate(subscriptionId, UpdateNextBillingDateInput) {
  //   const client = await this.init()
  //   return (
  //     await client.request(gql`
  //     mutation {
  //       updateNextBillingDate (input: {
  //         subscriptionId: "${subscriptionId}",
  //         UpdateNextBillingDateInput: "${UpdateNextBillingDateInput}"
  //       }) {
  //         message
  //         ok
  //       }
  //     }

  //   `)
  //   ).updateNextBillingDate.ok
  // }
  async updateNextBillingDate(subscriptionId, date) {
    const client = await this.init();

    const query = gql`
      mutation updateNextBillingDate($input: UpdateNextBillingDateInput!) {
        updateNextBillingDate(input: $input) {
          message
          ok
        }
      }
    `;

    const variables = {
      input: {
        subscriptionId, // uuid
        date,           // string
      },
    };

    const res = await client.request(query, variables);
    return res.updateNextBillingDate; // { ok, message }
  }
}



export default SkioImp
