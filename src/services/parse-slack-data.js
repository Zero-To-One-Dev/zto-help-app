const extractRichText = (richText) => {
  if (!richText || !Array.isArray(richText.elements)) return ""

  return richText.elements
    .map((section) => {
      if (
        section.type === "rich_text_section" &&
        Array.isArray(section.elements)
      ) {
        return section.elements
          .filter((el) => el.type === "text")
          .map((el) => el.text)
          .join("")
      }
      return ""
    })
    .join("\n")
}

export const parseSlackViewState = (values) => {
  const result = {}

  for (const blockId in values) {
    const actions = values[blockId]

    for (const actionId in actions) {
      const field = actions[actionId]
      let value

      switch (field.type) {
        case "plain_text_input":
          value = field.value
          break

        case "rich_text_input":
          value = extractRichText(field.rich_text_value)
          break

        case "datepicker":
          value = field.selected_date
          break

        case "static_select":
          value = field.selected_option?.value
          break

        default:
          value = null
      }

      if (value !== undefined) {
        if (result[actionId]) {
          if (Array.isArray(result[actionId])) {
            result[actionId].push(value)
          } else {
            result[actionId] = [result[actionId], value]
          }
        } else {
          result[actionId] = value
        }
      }
    }
  }

  return result
}
