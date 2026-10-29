import type {ElementHandle, Page} from "puppeteer-core";
import {z} from "zod/v4";

/* -------------------------------------------------------------------------------------------------
 * Zod Schemas
 * ------------------------------------------------------------------------------------------------- */
export enum JobCategoryType {
    "hourly" = "hourly",
    "fixed" = "fixed",
}

export const UpworkJobListingSchema = z.object({
    id: z.string(),

    title: z.string(),
    url: z.string(),
    alreadyApplied: z.boolean(),
    postedAtText: z.string().nullable(),
    proposalsText: z.string().nullable(),

    description: z.string(),

    skills: z.array(z.string()),

    category: z.object({
        type: z.enum(JobCategoryType, {}).nullable(),
        raw: z.string().nullable(),
    }),

    hourlyRate: z
        .object({
            min: z.number().nullable(),
            max: z.number().nullable(),
            raw: z.string().nullable(),
        })
        .nullable(),

    fixedBudget: z
        .object({
            amount: z.number().nullable(),
            raw: z.string().nullable(),
        })
        .nullable(),

    experienceLevel: z.string().nullable(),

    estimatedTime: z.string().nullable(),

    client: z.object({
        paymentVerified: z.boolean(),

        rating: z.number().nullable(),

        totalSpent: z.string().nullable(),

        location: z.string().nullable(),
    }),

    rawText: z.string(),
});

export type UpworkJobListing = z.infer<typeof UpworkJobListingSchema>;

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------------------------------- */

function cleanText(input?: string | null): string {
    return (input ?? "")
        .replace(/\s+/g, " ")
        .replace(/\u00a0/g, " ")
        .trim();
}

function parseMoney(value?: string): number | null {
    if (!value) return null;
    const normalized = value.replace(/[^0-9.]/g, "");

    if (!normalized) {
        return null;
    }

    const parsed = Number(normalized);

    return Number.isNaN(parsed) ? null : parsed;
}

function parseHourlyRate(
    raw: string | null,
): UpworkJobListing["hourlyRate"] {
    if (!raw) {
        return null;
    }

    const matches = raw.match(/\$([\d,.]+)\s*-\s*\$([\d,.]+)/);

    if (!matches || matches.length < 3) {
        return {
            min: null,
            max: null,
            raw,
        };
    }
    return {
        min: parseMoney(matches[1]),
        max: parseMoney(matches[2]),
        raw,
    };
}

function parseFixedBudget(
    raw: string | null,
): UpworkJobListing["fixedBudget"] {
    if (!raw) {
        return null;
    }

    const match = raw.match(/\$([\d,.]+)/);

    return {
        amount: match ? parseMoney(match[1]) : null,
        raw,
    };
}

/* -------------------------------------------------------------------------------------------------
 * Core Parser
 * ------------------------------------------------------------------------------------------------- */

export async function parseUpworkJobListing(
    article: ElementHandle<Element>,
): Promise<UpworkJobListing> {
    const extracted = await article.evaluate((node) => {
        const getText = (selector: string): string | null => {
            const element = node.querySelector(selector);

            return element?.textContent?.trim() ?? null;
        };

        const getTexts = (selector: string): string[] => {
            return Array.from(node.querySelectorAll(selector))
                .map((el) => el.textContent?.trim() ?? "")
                .filter(Boolean);
        };

        const titleAnchor = node.querySelector(
            '[data-test="job-tile-title-link UpLink"]',
        ) as HTMLAnchorElement | null;

        const jobInfoItems = Array.from(
            node.querySelectorAll('[data-test="JobInfo"] li'),
        ).map((li) => li.textContent?.trim() ?? "");

        const clientInfoItems = Array.from(
            node.querySelectorAll('[data-test="JobInfoClient"] li'),
        ).map((li) => li.textContent?.trim() ?? "");

        const alreadyApplied = !!node.querySelector('[data-test="JobBadgeApplied"]');
        const hourlyItem =
            jobInfoItems.find((x) => x.toLowerCase().includes("hourly")) ?? null;

        const fixedItem =
            jobInfoItems.find((x) => x.toLowerCase().includes("fixed")) ?? null;

        const experienceLevel =
            node
                .querySelector('[data-test="experience-level"]')
                ?.textContent?.trim() ?? null;

        const estimatedTime =
            node
                .querySelector('[data-test="duration-label"]')
                ?.textContent?.trim() ?? null;

        const ratingText =
            node
                .querySelector('[data-test="feedback-rating UpCRating"]')
                ?.textContent?.trim() ?? null;

        const spentText =
            node
                .querySelector('[data-test="total-spent"]')
                ?.textContent?.trim() ?? null;

        const locationText =
            node
                .querySelector('[data-test="location"]')
                ?.textContent?.trim() ?? null;

        return {
            id:
                node.getAttribute("data-ev-job-uid") ??
                node.getAttribute("data-test-key") ??
                "",
            alreadyApplied,
            title: titleAnchor?.textContent?.trim() ?? "",

            url: titleAnchor?.href ?? "",

            postedAtText:
                getText('[data-test="job-pubilshed-date"] span:first-child') ?? null,

            proposalsText:
                getText('[data-test="proposals-tier"]') ?? null,

            description:
                getText('[data-test="UpCLineClamp JobDescription"] p') ?? "",

            skills: getTexts('[data-test="token"] span'),

            hourlyRaw: hourlyItem,
            fixedRaw: fixedItem,

            experienceLevel,
            estimatedTime,

            paymentVerified:
                node.querySelector('[data-test="payment-verified"]') !== null,

            ratingText,
            spentText,
            locationText,

            rawText: node.textContent ?? "",

            categoryType: hourlyItem
                ? "hourly"
                : fixedItem
                    ? "fixed"
                    : null,
        };
    });

    const hourlyRate = parseHourlyRate(extracted.hourlyRaw);
    const fixedBudget = parseFixedBudget(extracted.fixedRaw);

    const ratingMatch = extracted.ratingText?.match(/(\d+(\.\d+)?)/);

    const parsed: UpworkJobListing = {
        id: cleanText(extracted.id),
        alreadyApplied: extracted.alreadyApplied,
        title: cleanText(extracted.title),

        url: cleanText(extracted.url),

        postedAtText: cleanText(extracted.postedAtText),

        proposalsText: cleanText(extracted.proposalsText),

        description: cleanText(extracted.description),

        skills: extracted.skills.map(cleanText),

        category: {
            type: extracted.categoryType as (JobCategoryType | null),
            raw: cleanText(extracted.hourlyRaw ?? extracted.fixedRaw),
        },

        hourlyRate,

        fixedBudget,

        experienceLevel: cleanText(extracted.experienceLevel),

        estimatedTime: cleanText(extracted.estimatedTime),

        client: {
            paymentVerified: extracted.paymentVerified,

            rating: ratingMatch ? Number(ratingMatch[1]) : null,

            totalSpent: cleanText(extracted.spentText),

            location: cleanText(extracted.locationText),
        },

        rawText: cleanText(extracted.rawText),
    };

    return UpworkJobListingSchema.parse(parsed);
}

/* -------------------------------------------------------------------------------------------------
 * Multi-Listing Parser
 * ------------------------------------------------------------------------------------------------- */

export async function parseUpworkSearchResults(
    page: Page,
): Promise<UpworkJobListing[]> {
    await page.waitForSelector('article[data-ev-sublocation="search_results"]');

    const articles = await page.$$(
        'article[data-ev-sublocation="search_results"]',
    );

    const results = await Promise.all(
        articles.map((article) => parseUpworkJobListing(article)),
    );

    return results;
}
