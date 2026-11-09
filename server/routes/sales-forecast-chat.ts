import type { RequestHandler } from "express";
import { SalesForecastChatRequestSchema } from "../../shared/api";
import { generateSalesForecastAnswer, hasGeminiApiKey } from "../services/sales-forecast-chat";

export const postSalesForecastChat: RequestHandler = async (req, res) => {
  const parsed = SalesForecastChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid sales forecast chat request" });
  }

  if (!hasGeminiApiKey()) {
    return res.status(503).json({ error: "Gemini is not configured. Add GEMINI_API_KEY to the server environment." });
  }

  try {
    const answer = await generateSalesForecastAnswer(parsed.data);
    if (!answer) return res.status(502).json({ error: "Gemini returned an empty answer. Please try again." });
    res.json({ answer });
  } catch {
    res.status(502).json({ error: "Gemini could not answer right now. Please try again." });
  }
};
