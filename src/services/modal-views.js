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
      name: "Hot Shapers LATAM",
      alias: "HSLA",
    },
    {
      name: "Hot Shapers Colombia",
      alias: "HSCO",
    },
    {
      name: "Hot Shapers Mexico",
      alias: "HSMX",
    },
    {
      name: "Redu Sculpt LATAM",
      alias: "RSLA",
    },
    {
      name: "Redu Sculpt Colombia",
      alias: "RSCO",
    },
    {
      name: "Redu Sculpt Mexico",
      alias: "RSMX",
    },
    {
      name: "Vibro Sculpt LATAM",
      alias: "VSLA",
    },
    {
      name: "Vibro Sculpt Colombia",
      alias: "VSCO",
    },
    {
      name: "Vibro Sculpt Mexico",
      alias: "VSMX",
    },
    {
      name: "Vibro Sculpt Chile",
      alias: "VSCL",
    },
    {
      name: "Vibro Sculpt Ecuador",
      alias: "VSECU",
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
            type: "plain_text_input",
            action_id: "plain_text_input-action",
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
            options: [],
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
            options: [],
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

  const toOption = ({ name, alias }) => ({
    text: { type: "plain_text", text: String(name).slice(0, 75), emoji: true },
    value: String(alias).slice(0, 75),
  })

  const setOptionsAt = (modal, blockIndex, options) => {
    const block = modal?.blocks?.[blockIndex]
    if (!block?.element) {
      console.warn(`Bloque ${blockIndex} no encontrado o sin element`)
      return
    }
    block.element.options = options.map((o) => ({
      ...o,
      text: { ...o.text },
    }))
  }

  const options = stores.map(toOption)

  setOptionsAt(modals.intelligems_test, 3, options)
  setOptionsAt(modals.generate_coupon, 1, options)
  setOptionsAt(modals.generate_coupon, 2, options)

  return modals[callbackId]
}
