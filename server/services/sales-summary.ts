import { SalesForecastResponse } from "@shared/api";

const DEFAULT_MODEL = "gemini-3.5-flash";
const REQUEST_TIMEOUT_MS = 8000;

type SummaryInput = Pick<
  SalesForecastResponse,
  "projected_7_day_total" | "trend" | "trend_percent" | "product_insights"
>;

function buildPrompt(input: SummaryInput): string {
  const products = input.product_insights.length
    ? input.product_insights
        .map(
          (p) =>
            `- ${p.product_name}: sold on ${p.days_sold} of the last 30 days, about ${p.avg_daily_qty} units/day, suggested stock-up ${p.suggested_restock_qty} units`
        )
        .join("\n")
    : "- none";

  return [
    "You write short notes for a cold-chain distributor's sales dashboard.",
    "Write 2 to 3 plain sentences for a non-technical store manager. Use only the figures below and do not invent numbers.",
    "Mention that the projection is an estimate. Recommend which consistently sold products to stock up on.",
    "",
    `Projected sales for the next 7 days: ₱${input.projected_7_day_total}`,
    `Weekly trend: ${input.trend} (${input.trend_percent}%)`,
    "Consistently sold products:",
    products,
  ].join("\n");
}

export async function generateSalesSummary(input: SummaryInput): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(input) }] }],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      console.error("Gemini summary request failed:", response.status);
      return null;
    }

    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || null;
  } catch (error) {
    console.error("Gemini summary failed:", error);
    return null;
  }
}
