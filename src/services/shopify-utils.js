
export function toOrderGID(orderIdOrGid) {
  if (typeof orderIdOrGid !== "string") return `gid://shopify/Order/${orderIdOrGid}`;
  return orderIdOrGid.startsWith("gid://shopify/Order/")
    ? orderIdOrGid
    : `gid://shopify/Order/${orderIdOrGid}`;
}