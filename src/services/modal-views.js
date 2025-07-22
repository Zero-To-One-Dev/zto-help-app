export const getModalView = (callbackId) => {
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
            type: "plain_text_input",
            action_id: "plain_text_input-action",
          },
          label: {
            type: "plain_text",
            text: "Titulo",
            emoji: true,
          },
        },
        {
          type: "input",
          element: {
            type: "rich_text_input",
            action_id: "rich_text_input-action",
          },
          label: {
            type: "plain_text",
            text: "Descripción",
            emoji: true,
          },
        },
        {
          type: "input",
          element: {
            type: "datepicker",
            initial_date: "2025-04-28",
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
            initial_date: "2025-04-28",
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
            options: [
              {
                text: {
                  type: "plain_text",
                  text: "Dr Ming",
                  emoji: true,
                },
                value: "DM",
              },
              {
                text: {
                  type: "plain_text",
                  text: "Redu Sculpt",
                  emoji: true,
                },
                value: "RS",
              },
              {
                text: {
                  type: "plain_text",
                  text: "Vibro Sculpt",
                  emoji: true,
                },
                value: "VS",
              },
            ],
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
  }

  return modals[callbackId]
}
