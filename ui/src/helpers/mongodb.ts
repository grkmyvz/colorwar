import { MongoClient, ServerApiVersion } from "mongodb";
import { PixelJSON } from "./types";

const { NEXT_PUBLIC_MONGODB_USER, NEXT_PUBLIC_MONGODB_PASS } = process.env;

const uri = `mongodb+srv://${NEXT_PUBLIC_MONGODB_USER}:${NEXT_PUBLIC_MONGODB_PASS}@cluster0.6xxzz6z.mongodb.net/?retryWrites=true&w=majority`;

export const mongoDBClient = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

export async function getPixels(): Promise<PixelJSON[]> {
  try {
    await mongoDBClient.connect();
    const database = mongoDBClient.db("color-war");
    const data = await database.collection("pixels").find().toArray();
    if (!data) {
      throw new Error("Data not found");
    }
    const result = data.map((pixel) => {
      return {
        id: pixel.id,
        color: pixel.color,
        painter: pixel.painter,
        cost: pixel.cost,
        blockLength: pixel.blockLength,
      };
    });
    return result;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  } finally {
    await mongoDBClient.close();
  }
}
