import express, { type Request } from "express";
import { nanoid } from "nanoid";
import { checkRestaurantExists } from "../middlewares/checkRestaurantId.js";
import { validate } from "../middlewares/validate.js";
import { RestaurantSchema, type Restaurant } from "../schemas/restaurant.js";
import { ReviewSchema, type Review } from "../schemas/review.js";
import { initializeRedisClient } from "../utils/client.js";
import {
  cuisineKey,
  cuisinesKey,
  restaurantByRatingKey,
  restaurantCuisineKeyById,
  restaurantKeyById,
  reviewDetailsKeyById,
  reviewKeyById,
} from "../utils/keys.js";
import { errorResponse, successResponse } from "../utils/responses.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  const start = (Number(page) - 1) * Number(limit);
  const end = start + Number(limit);

  try {
    const client = await initializeRedisClient();

    const restaurantIds = await client.zRange(
      restaurantByRatingKey,
      start,
      end,
      {
        REV: true,
      }
    );

    const restaurants = await Promise.all(
      restaurantIds.map((id) => client.hGetAll(restaurantKeyById(id)))
    );

    return successResponse(res, restaurants);
  } catch (error) {
    next(error);
  }
});

// Create a new restaurant
router.post("/", validate(RestaurantSchema), async (req, res, next) => {
  const data = req.body as Restaurant;
  try {
    const client = await initializeRedisClient();
    const id = nanoid();
    const restaurantKey = restaurantKeyById(id);
    const hashData = { id, name: data.name, location: data.location };
    await Promise.all([
      ...data.cuisines.map((cuisine) =>
        Promise.all([
          client.sAdd(cuisinesKey, cuisine),
          client.sAdd(cuisineKey(cuisine), id),
          client.sAdd(restaurantCuisineKeyById(id), cuisine),
        ])
      ),
      client.hSet(restaurantKey, hashData),
      client.zAdd(restaurantByRatingKey, {
        score: 0,
        value: id,
      }),
    ]);

    return successResponse(res, hashData, "Added new restaurant");
  } catch (error) {
    next(error);
  }
});

// Create a new review in a restaurant by Id
router.post(
  "/:restaurantId/reviews",
  checkRestaurantExists,
  validate(ReviewSchema),
  async (req: Request<{ restaurantId: string }>, res, next) => {
    const { restaurantId } = req.params;
    const data = req.body as Review;

    try {
      const client = await initializeRedisClient();
      const reviewId = nanoid();
      const reviewKey = reviewKeyById(restaurantId);
      const reviewDetailsKey = reviewDetailsKeyById(reviewId);
      const restaurantKey = restaurantKeyById(restaurantId);
      const reviewData = {
        id: reviewId,
        ...data,
        timeStamp: Date.now(),
        restaurantId,
      };

      const [reviewCount, setResult, totalStars] = await Promise.all([
        client.lPush(reviewKey, reviewId),
        client.hSet(reviewDetailsKey, reviewData),
        client.hIncrByFloat(restaurantKey, "totalStars", data.rating),
      ]);

      const averageRating = Number((totalStars / reviewCount).toFixed(1));

      await Promise.all([
        client.zAdd(restaurantByRatingKey, {
          score: averageRating,
          value: restaurantId,
        }),
        client.hSet(restaurantKey, "avgStars", averageRating),
      ]);

      return successResponse(res, reviewData, "Review Added");
    } catch (error) {
      next(error);
    }
  }
);

// Get all review in a restaurantby Id
router.get(
  "/:restaurantId/reviews",
  checkRestaurantExists,
  async (req: Request<{ restaurantId: string }>, res, next) => {
    const { restaurantId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const start = (Number(page) - 1) * Number(limit);
    const end = start + Number(limit) - 1;

    try {
      const client = await initializeRedisClient();
      const reviewKey = reviewKeyById(restaurantId);
      const reviewIds = await client.lRange(reviewKey, start, end);
      const reviews = await Promise.all(
        reviewIds.map((id) => client.hGetAll(reviewDetailsKeyById(id)))
      );

      return successResponse(res, reviews);
    } catch (error) {
      next(error);
    }
  }
);

// Delete a review by Id
router.delete(
  "/:restaurantId/reviews/:reviewId",
  checkRestaurantExists,
  async (
    req: Request<{ restaurantId: string; reviewId: string }>,
    res,
    next
  ) => {
    const { restaurantId, reviewId } = req.params;

    try {
      const client = await initializeRedisClient();
      const reviewKey = reviewKeyById(restaurantId);
      const reviewDetailsKey = reviewDetailsKeyById(reviewId);
      const [removeRestult, deleteResult] = await Promise.all([
        client.lRem(reviewKey, 0, reviewId),
        client.del(reviewDetailsKey),
      ]);

      if (removeRestult === 0 && deleteResult === 0) {
        return errorResponse(res, 404, "Review not found");
      }

      return successResponse(res, reviewId, "Review deleted");
    } catch (error) {
      next(error);
    }
  }
);

// Get restaurant by Id
router.get(
  "/:restaurantId",
  checkRestaurantExists,
  async (req: Request<{ restaurantId: string }>, res, next) => {
    const { restaurantId } = req.params;

    try {
      const client = await initializeRedisClient();
      const restaurantKey = restaurantKeyById(restaurantId);
      const [viewCount, restaurant, cuisine] = await Promise.all([
        client.hIncrBy(restaurantKey, "viewCount", 1),
        client.hGetAll(restaurantKey),
        client.sMembers(restaurantCuisineKeyById(restaurantId)),
      ]);

      return successResponse(res, { ...restaurant, cuisine });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
