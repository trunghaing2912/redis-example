export function getKeyName(...arg: string[]) {
  return `bites:${arg.join(":")}`;
}

export const restaurantKeyById = (id: string) => getKeyName("restaurant", id);
export const reviewKeyById = (id: string) => getKeyName("reviews", id);
export const reviewDetailsKeyById = (id: string) =>
  getKeyName("review_details", id);
