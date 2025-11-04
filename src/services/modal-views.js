export const getModalView = (callbackId) => {
  const date = new Date()
  const formatedDate =
    date.getFullYear() +
    "-" +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    "-" +
    ("0" + date.getDate()).slice(-2)
  const stores = [
    {
      name: "Vibro Sculpt",
      alias: "VS",
    },
    {
      name: "Redu Sculpt",
      alias: "RS",
    },
    {
      name: "Hot Shapers",
      alias: "HS",
    },
    {
      name: "Copper Slim",
      alias: "CS",
    },
    {
      name: "Dr Ming",
      alias: "DM",
    },
    {
      name: "My Way",
      alias: "MW",
    },
    {
      name: "Hot Vita",
      alias: "HV",
    },
    {
      name: "Vibro Sculpt Colombia",
      alias: "VSCOL",
    },
    {
      name: "Vibro Sculpt Relief",
      alias: "VSRELIEF",
    },
  ]

  const modals = {
    intelligems_test: {
      type: "modal",
      callback_id: callbackId,
      title: {
        type: "plain_text",
        text: "Intelligems Test",
        emoji: true,
      },
      submit: {
        type: "plain_text",
        text: "Enviar",
        emoji: true,
      },
      close: {
        type: "plain_text",
        text: "Cancelar",
        emoji: true,
      },
      blocks: [
        {
          type: "input",
          element: {
            type: "rich_text_input",
            action_id: "rich_text_input-action",
          },
          label: {
            type: "plain_text",
            text: "Descripción del test",
            emoji: true,
          },
        },
        {
          type: "input",
          element: {
            type: "datepicker",
            initial_date: formatedDate,
            placeholder: {
              type: "plain_text",
              text: "Select a date",
              emoji: true,
            },
            action_id: "datepicker-action",
          },
          label: {
            type: "plain_text",
            text: "Fecha de Inicio",
            emoji: true,
          },
        },
        {
          type: "input",
          element: {
            type: "datepicker",
            initial_date: formatedDate,
            placeholder: {
              type: "plain_text",
              text: "Select a date",
              emoji: true,
            },
            action_id: "datepicker-action",
          },
          label: {
            type: "plain_text",
            text: "Fecha de Fin",
            emoji: true,
          },
        },
        {
          type: "input",
          element: {
            type: "static_select",
            placeholder: {
              type: "plain_text",
              text: "Select an item",
              emoji: true,
            },
            options: [],
            action_id: "static_select-action",
          },
          label: {
            type: "plain_text",
            text: "Tienda",
            emoji: true,
          },
        },
      ],
    },
    generate_coupon: {
      type: "modal",
      callback_id: callbackId,
      title: {
        type: "plain_text",
        text: "Generate Coupon",
        emoji: true,
      },
      submit: {
        type: "plain_text",
        text: "Generate",
        emoji: true,
      },
      close: {
        type: "plain_text",
        text: "Cancel",
        emoji: true,
      },
      blocks: [
        {
          type: "input",
          element: {
            type: "number_input",
            is_decimal_allowed: false,
            action_id: "number_input-action",
          },
          label: {
            type: "plain_text",
            text: "Discount ID",
            emoji: true,
          },
          optional: false,
        },
        {
          type: "input",
          element: {
            type: "static_select",
            placeholder: {
              type: "plain_text",
              text: "Select a store",
              emoji: true,
            },
            options: [
              {
                text: {
                  type: "plain_text",
                  text: "VibroSculpt Col",
                  emoji: true,
                },
                value: "VSCO",
              },
            ],
            action_id: "static_select-action",
          },
          label: {
            type: "plain_text",
            text: "From",
            emoji: true,
          },
          optional: false,
        },
        {
          type: "input",
          element: {
            type: "static_select",
            placeholder: {
              type: "plain_text",
              text: "Select a store",
              emoji: true,
            },
            options: [
              {
                text: {
                  type: "plain_text",
                  text: "ReduSculpt MX",
                  emoji: true,
                },
                value: "RSMX",
              },
            ],
            action_id: "static_select-action",
          },
          label: {
            type: "plain_text",
            text: "To",
            emoji: true,
          },
          optional: false,
        },
      ],
    },
  }
  for (const store of stores) {
    modals.intelligems_test.blocks[3].element.options.push({
      text: {
        type: "plain_text",
        text: store.name,
        emoji: true,
      },
      value: store.alias,
    })
  }
  return modals[callbackId]
}
