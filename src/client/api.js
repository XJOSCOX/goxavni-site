export const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

export async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export function payload(form) {
  return Object.fromEntries(new FormData(form).entries());
}
