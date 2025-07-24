const toMrkdwn = (elements = []) => {
  return elements
    .map((el) => {
      if (el.type === "text") {
        let text = el.text

        if (el.style) {
          if (el.style.bold) text = `*${text}*`
          if (el.style.italic) text = `_${text}_`
          if (el.style.strike) text = `~${text}~`
          if (el.style.code) text = `\`${text}\``
        }

        return text
      }

      if (el.type === "emoji") {
        return `:${el.name}:`
      }

      if (el.type === "link") {
        return `<${el.url}|${el.text}>`
      }

      if (el.type === "user") {
        return `<@${el.user_id}>`
      }

      if (el.type === "channel") {
        return `<#${el.channel_id}>`
      }

      if (el.type === "quote") {
        return el.elements.map((q) => `> ${toMrkdwn([q])}`).join("\n")
      }

      if (el.type === "rich_text_section") {
        return toMrkdwn(el.elements)
      }

      if (el.type === "rich_text_list") {
        return el.elements
          .map((item, index) => {
            const bullet = el.style === "ordered" ? `${index + 1}.` : "•"
            return `${bullet} ${toMrkdwn(item.elements)}`
          })
          .join("\n")
      }

      if (el.type === "rich_text_preformatted") {
        return `\`\`\`\n${toMrkdwn(el.elements)}\n\`\`\``
      }

      return ""
    })
    .join("")
}

const extractMrkdwnFromRichText = (richText) => {
  if (!richText || !Array.isArray(richText.elements)) return ""

  return richText.elements.map((element) => toMrkdwn([element])).join("\n")
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
          value = extractMrkdwnFromRichText(field.rich_text_value)
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
