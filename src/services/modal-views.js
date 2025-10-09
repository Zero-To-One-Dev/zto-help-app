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

  const dropi_stores = [
    {
      name: "Vibro Sculpt Colombia",
      alias: "VSCO"
    },
    {
      name: "Vibro Sculpt Mexico",
      alias: "VSMX"
    },
    {
      name: "Vibro Sculpt Chile",
      alias: "VSCL"
    },
    {
      name: "Hot Shapers Colombia",
      alias: "HSCO"
    },
    {
      name: "Hot Shapers Mexico",
      alias: "HSMX"
    },
    {
      name: "Hot Shapers Chile",
      alias: "HSCL"
    },
    {
      name: "Redu Sculpt Colombia",
      alias: "RSCO"
    },
    {
      name: "Redu Sculpt Mexico",
      alias: "RSMX"
    },
    {
      name: "Redu Sculpt Chile",
      alias: "RSCL"
    },
    {
      name: "Vibro Sculpt Relief Colombia",
      alias: "VRCO"
    },
    {
      name: "Inbogo Colombia",
      alias: "INCO"
    },
    {
      name: "Inbogo Mexico",
      alias: "INMX"
    }
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
    dropi_campaign_report: {
      type: "modal",
      callback_id: callbackId,
      title: {
        type: "plain_text",
        text: "Dropi Campaign Report",
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
            type: "static_select",
            placeholder: {
              type: "plain_text",
              text: "Selecciona una tienda",
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
        {
          type: "input",
          element: {
            type: "datepicker",
            initial_date: formatedDate,
            placeholder: {
              type: "plain_text",
              text: "Selecciona una fecha",
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
              text: "Selecciona una fecha",
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
            type: "plain_text_input",
            action_id: "plain_text_input-action"
          },
          label: {
            type: "plain_text",
            text: "Campaña UTM",
            emoji: true,
          },
        }
      ],
    }
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

  for (const store of dropi_stores) {
    modals.dropi_campaign_report.blocks[0].element.options.push({
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
