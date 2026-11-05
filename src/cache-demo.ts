import { CacheStore } from "./cache-store";
import { redis } from "./redis-client";

type Product = {
  id: string;
  name: string;
  price: number;
};

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchProductFromDatabase(): Promise<Product> {
  console.log("Fetching product from the database...");
  await wait(1500);

  return {
    id: "101",
    name: "Mechanical Keyboard",
    price: 4999,
  };
}

async function main() {
  const cache = new CacheStore(redis);
  const productKey = "cache:product:101";

  // Reset only for this demo, so the first request is always a cache miss.
  await cache.delete(productKey);

  console.time("First request");
  const firstProduct = await cache.getOrSet(
    productKey,
    300,
    fetchProductFromDatabase
  );
  console.timeEnd("First request");
  console.log("First product:", firstProduct);

  console.time("Second request");
  const secondProduct = await cache.getOrSet(
    productKey,
    300,
    fetchProductFromDatabase
  );
  console.timeEnd("Second request");
  console.log("Second product:", secondProduct);

  await redis.quit();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
