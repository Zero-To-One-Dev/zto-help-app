/**
 * Input validation (simple & explicit)
 * You can swap this for zod/express-validator if your project already uses them.
 */
export const validateCreateProfilePayload = (body) => {
  const errors = []

  const profile = body?.profile || {}
  const listId = body?.listId
  const addToList = Boolean(body?.addToList) // default false
  const addIfDuplicate = Boolean(body?.addIfDuplicate) // default false

  // Basic checks
  if (!listId && addToList) {
    errors.push('When "addToList" is true, "listId" is required.')
  }

  const { email, phone_number, first_name, last_name, locale } = profile

  if (!email && !phone_number) {
    errors.push(
      'Provide at least one unique identifier: "email" or "phone_number".'
    )
  }

  // Optional: add simple type checks
  for (const [k, v] of Object.entries({
    email,
    phone_number,
    first_name,
    last_name,
    locale,
  })) {
    if (v != null && typeof v !== "string") {
      errors.push(`"${k}" must be a string if provided.`)
    }
  }

  return {
    errors,
    listId,
    addToList,
    addIfDuplicate,
    profile: { email, phone_number, first_name, last_name, locale },
  }
}
