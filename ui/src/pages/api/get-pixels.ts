// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { getPixels } from "@/helpers/mongodb";
import type { NextApiRequest, NextApiResponse } from "next";

type ResData = {
  status: number;
  data?: any;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResData>
) {
  try {
    const data = await getPixels();
    if (data.length > 0) {
      res.status(200).json({ status: 200, data: data });
    } else {
      res.status(404).json({ status: 404, error: "Data not found" });
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ status: 500, error: "Internal server error" });
  }
}
