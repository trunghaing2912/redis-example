import express from "express";
import { initializeRedisClient } from "../utils/client.js";
import { cuisineKey, cuisinesKey, restaurantKeyById } from "../utils/keys.js";
import { successResponse } from "../utils/responses.js";

const router = express.Router();

// Get All Cuisines
router.get("/", async (req, res, next) => {
  try {
    const client = await initializeRedisClient();
    const cuisine = await client.sMembers(cuisinesKey);

    return successResponse(res, cuisine);
  } catch (error) {
    next(error);
  }
});

// Get Cuisine By Name
router.get("/:cuisine", async (req, res, next) => {
  const { cuisine } = req.params;

  try {
    const client = await initializeRedisClient();
    const resturantIds = await client.sMembers(cuisineKey(cuisine));
    const restaurants = await Promise.all(
      resturantIds.map((id) => client.hGet(restaurantKeyById(id), "name"))
    );

    return successResponse(res, restaurants);
  } catch (error) {
    next(error);
  }
});

export default router;
