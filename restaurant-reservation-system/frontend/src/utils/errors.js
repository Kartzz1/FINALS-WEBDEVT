export function fieldErrors(error) {
  const result = {};
  for (const { field, message } of error?.fieldErrors ?? []) {
    result[field] = message;
  }
  return result;
}
