import { SalesForecastResponse } from "@shared/api";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b";
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
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: buildPrompt(input) }],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error("Groq summary request failed:", response.status);
      return null;
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (error) {
    console.error("Groq summary failed:", error);
    return null;
  }
}
