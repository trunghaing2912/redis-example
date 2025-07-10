export function getKeyName(...arg: string[]) {
  return `bites:${arg.join(":")}`;
}

export const restaurantKeyById = (id: string) => getKeyName("restaurant", id);
export const reviewKeyById = (id: string) => getKeyName("reviews", id);
export const reviewDetailsKeyById = (id: string) =>
  getKeyName("review_details", id);

export const cuisinesKey = getKeyName("cuisine");
export const cuisineKey = (name: string) => getKeyName("cuisine", name);
export const restaurantCuisineKeyById = (id: string) =>
  getKeyName("restaurant_cuisines", id);

export const restaurantByRatingKey = getKeyName("restaurant_by_rating");
