/**
 * ============================================================================
 * Upwork Job Details Page Parser
 * ============================================================================
 *
 * Parses the FULL Upwork job details page HTML into a strongly typed object.
 *
 * Designed for:
 * - Saved HTML snapshots
 * - Browser automation scraping
 * - Puppeteer / Playwright extraction
 * - LangGraph / AI ingestion pipelines
 *
 * This parser intentionally avoids brittle class names wherever possible and
 * instead relies on semantic structure and textual anchors.
 */
import * as cheerio from "cheerio";
import {z} from "zod/v4";

export function parseUpworkJobCoreDetails(
    html: string,
): UpworkJobCoreDetails {
    const $ = cheerio.load(html);

    const cleanText = (input?: string | null): string | null => {
        const value = (input ?? "")
            .replace(/\u00a0/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        return value.length ? value : null;
    };

    const extractNumber = (
        input?: string | null,
    ): number | null => {
        const match = (input ?? "").match(
            /-?\d+(?:\.\d+)?/,
        );

        return match ? Number(match[0]) : null;
    };

    /*
     * Title
     */

    const title =
        cleanText(
            $(".job-details-card h4 span.flex-1")
                .first()
                .text(),
        ) ||
        cleanText(
            $(".fe-job-details h3")
                .first()
                .text(),
        ) ||
        null;

    /*
     * Summary
     */

    const summary =
        cleanText(
            $('[data-test="Description"] .multiline-text')
                .first()
                .text(),
        ) ||
        cleanText(
            $(".fe-job-details .description")
                .first()
                .text(),
        ) ||
        null;

    /*
     * Posted Date
     */

    const postedDate =
        cleanText(
            $(".job-details-card .posted-on-line span")
                .first()
                .text(),
        ) ||
        cleanText(
            $('[itemprop="datePosted"]')
                .first()
                .text(),
        ) ||
        null;

    /*
     * Experience Level
     */

    const experienceLevel =
        cleanText(
            $('[data-cy="expertise"]')
                .closest("li")
                .find("strong")
                .first()
                .text(),
        ) || null;

    /*
     * Hourly Range
     */

    let hourlyRange: UpworkHourlyRange | null =
        null;

    const hourlyContainer =
        $('[data-cy="clock-timelog"]')
            .closest("li");

    const hourlyStrongs = hourlyContainer
        .find("strong")
        .map((_, el) =>
            cleanText($(el).text()),
        )
        .get()
        .filter(Boolean) as string[];

    if (hourlyStrongs.length >= 1) {
        hourlyRange = {
            min: extractNumber(hourlyStrongs[0]),
            max:
                hourlyStrongs.length > 1
                    ? extractNumber(hourlyStrongs[1])
                    : null,
            raw: hourlyStrongs.join(" - "),
        };
    }

    /*
     * Workload
     */

    const workload =
        cleanText(
            $('[data-cy="clock-hourly"]')
                .closest("li")
                .find("strong")
                .first()
                .text(),
        ) ||
        cleanText(
            $(".fe-ui-job-features li")
                .filter((_, el) =>
                    $(el)
                        .text()
                        .toLowerCase()
                        .includes("hrs/week"),
                )
                .find("strong")
                .first()
                .text(),
        ) ||
        null;

    /*
     * Duration
     */

    const duration =
        cleanText(
            $('[data-cy^="duration"]')
                .closest("li")
                .find("strong")
                .first()
                .text(),
        ) ||
        cleanText(
            $('[data-test="hourly-duration"]')
                .find("strong")
                .first()
                .text(),
        ) ||
        null;

    return UpworkJobCoreDetailsSchema.parse({
        title,
        summary,
        postedDate,
        experienceLevel,
        hourlyRange,
        workload,
        duration,
    });
}

export const UpworkHourlyRangeSchema = z.object({
    min: z.number().nullable(),
    max: z.number().nullable(),
    raw: z.string().nullable(),
});

export const UpworkJobCoreDetailsSchema = z.object({
    title: z.string().nullable(),

    summary: z.string().nullable(),

    postedDate: z.string().nullable(),

    experienceLevel: z.string().nullable(),

    hourlyRange: UpworkHourlyRangeSchema.nullable(),

    workload: z.string().nullable(),

    duration: z.string().nullable(),
});

export type UpworkHourlyRange = z.infer<
    typeof UpworkHourlyRangeSchema
>;

export type UpworkJobCoreDetails = z.infer<
    typeof UpworkJobCoreDetailsSchema
>;
export const UpworkClientReviewSchema = z.object({
    jobTitle: z.string().nullable(),
    feedback: z.string().nullable(),
    freelancerName: z.string().nullable(),
    rating: z.number().nullable(),
    engagementType: z.string().nullable(),
    amount: z.string().nullable(),
    dateRange: z.string().nullable(),
});

export type UpworkClientReview = z.infer<
    typeof UpworkClientReviewSchema
>;

export const UpworkClientSchema = z.object({
    paymentVerified: z.boolean(),

    phoneVerified: z.boolean(),

    rating: z.number().nullable(),

    reviewCount: z.number().nullable(),

    country: z.string().nullable(),

    city: z.string().nullable(),

    localTime: z.string().nullable(),

    jobsPosted: z.number().nullable(),

    hireRate: z.number().nullable(),

    openJobs: z.number().nullable(),

    totalSpent: z.string().nullable(),

    hires: z.number().nullable(),

    activeHires: z.number().nullable(),

    avgHourlyRatePaid: z.string().nullable(),

    totalHours: z.number().nullable(),

    memberSince: z.string().nullable(),

    recentHistory: z.array(UpworkClientReviewSchema),
});

export type UpworkClient = z.infer<typeof UpworkClientSchema>;

export const UpworkJobDetailsSchema = z.object({
    jobUrl: z.string().nullable(),
    details: UpworkJobCoreDetailsSchema,
    projectType: z.string().nullable(),

    mandatorySkills: z.array(z.string()),

    preferredQualifications: z.object({
        location: z.string().nullable(),
    }),

    activity: z.object({
        proposals: z.string().nullable(),
        interviewing: z.number().nullable(),
        invitesSent: z.number().nullable(),
        unansweredInvites: z.number().nullable(),
    }),

    connectsRequired: z.number().nullable(),

    availableConnects: z.number().nullable(),

    client: UpworkClientSchema,

    otherOpenJobs: z.array(
        z.object({
            title: z.string(),
            type: z.string().nullable(),
        }),
    ),
});

export type UpworkJobDetails = z.infer<
    typeof UpworkJobDetailsSchema
>;

/* =============================================================================
 * Utility Helpers
 * ========================================================================== */

function cleanText(input?: string | null): string {
    return (input ?? "")
        .replace(/\s+/g, " ")
        .replace(/\u00a0/g, " ")
        .trim();
}

function extractNumber(input?: string | null): number | null {
    if (!input) return null;

    const match = input.match(/-?\d+(\.\d+)?/);

    if (!match) return null;

    return Number(match[0]);
}

function extractStrongLabelValue(
    $root: cheerio.Cheerio<any>,
    label: string,
): string | null {
    const strong = $root
        .find("strong")
        .filter((_, el) =>
            cleanText($root.eq(0).find(el).text())
                .toLowerCase()
                .startsWith(label.toLowerCase()),
        )
        .first();

    if (!strong.length) return null;

    const parentText = cleanText(strong.parent().text());

    return cleanText(
        parentText.replace(strong.text(), ""),
    );
}

/* =============================================================================
 * Main Parser
 * ========================================================================== */

export function parseUpworkJobDetailsPage(
    html: string,
): UpworkJobDetails {
    const $ = cheerio.load(html);


    const projectType = cleanText(
        $("li")
            .filter((_, el) =>
                cleanText($(el).text())
                    .toLowerCase()
                    .includes("project type:"),
            )
            .first()
            .text()
            .replace(/project type:/i, ""),
    ) || null;

    /* ===========================================================================
     * Skills
     * ========================================================================= */

    const mandatorySkills: string[] = [];

    $("h5")
        .filter((_, el) =>
            cleanText($(el).text())
                .toLowerCase()
                .includes("skills and expertise"),
        )
        .closest("section")
        .find(".skills-list a")
        .each((_, el) => {
            const skill = cleanText($(el).text());

            if (skill) {
                mandatorySkills.push(skill);
            }
        });

    /* ===========================================================================
     * Preferred Qualifications
     * ========================================================================= */

    const qualificationSection = $("h5")
        .filter((_, el) =>
            cleanText($(el).text())
                .toLowerCase()
                .includes("preferred qualifications"),
        )
        .closest("section");

    const preferredLocation =
        extractStrongLabelValue(
            qualificationSection,
            "Location:",
        );

    /* ===========================================================================
     * Activity
     * ========================================================================= */

    const activitySection = $("h5")
        .filter((_, el) =>
            cleanText($(el).text())
                .toLowerCase()
                .includes("activity on this job"),
        )
        .closest("section");

    const proposals = cleanText(
        activitySection
            .find(".ca-item")
            .filter((_, el) =>
                cleanText($(el).text())
                    .toLowerCase()
                    .includes("proposals:"),
            )
            .find(".value")
            .text(),
    ) || null;

    const interviewing = extractNumber(
        activitySection
            .find(".ca-item")
            .filter((_, el) =>
                cleanText($(el).text())
                    .toLowerCase()
                    .includes("interviewing:"),
            )
            .find(".value")
            .text(),
    );

    const invitesSent = extractNumber(
        activitySection
            .find(".ca-item")
            .filter((_, el) =>
                cleanText($(el).text())
                    .toLowerCase()
                    .includes("invites sent:"),
            )
            .find(".value")
            .text(),
    );

    const unansweredInvites = extractNumber(
        activitySection
            .find(".ca-item")
            .filter((_, el) =>
                cleanText($(el).text())
                    .toLowerCase()
                    .includes("unanswered invites:"),
            )
            .find(".value")
            .text(),
    );

    /* ===========================================================================
     * Connects
     * ========================================================================= */

    const connectsRequired = extractNumber(
        $("div")
            .filter((_, el) =>
                cleanText($(el).text())
                    .includes("Send a proposal for:"),
            )
            .text(),
    );

    const availableConnects = extractNumber(
        $("div")
            .filter((_, el) =>
                cleanText($(el).text())
                    .includes("Available Connects:"),
            )
            .text(),
    );

    /* ===========================================================================
     * Job URL
     * ========================================================================= */

    const jobUrl =
        $("input[aria-label='Job link']").attr("value") ??
        null;

    /* ===========================================================================
     * Client Section
     * ========================================================================= */

    const clientSection = $(
        "[data-test='about-client-container']",
    );

    const paymentVerified =
        cleanText(clientSection.text())
            .toLowerCase()
            .includes("payment method verified");

    const phoneVerified =
        cleanText(clientSection.text())
            .toLowerCase()
            .includes("phone number verified");

    const rating = extractNumber(
        clientSection
            .find("[data-testid='buyer-rating']")
            .text(),
    );

    const reviewCount = extractNumber(
        clientSection
            .find("[data-testid='buyer-rating']")
            .text()
            .match(/of\s+(\d+)\s+reviews/i)?.[1],
    );

    const country = cleanText(
        clientSection
            .find("[data-qa='client-location'] strong")
            .first()
            .text(),
    ) || null;

    const locationText = cleanText(
        clientSection
            .find("[data-qa='client-location'] div")
            .text(),
    );

    const city =
        locationText.split(/\d/)[0]?.trim() || null;

    const localTimeMatch =
        locationText.match(/\d{1,2}:\d{2}\s?[AP]M/i);

    const localTime = localTimeMatch?.[0] ?? null;

    const jobsPosted = extractNumber(
        clientSection
            .find("[data-qa='client-job-posting-stats']")
            .text(),
    );

    const hireRate = extractNumber(
        clientSection
            .find("[data-qa='client-job-posting-stats']")
            .text()
            .match(/(\d+)% hire rate/i)?.[1],
    );

    const openJobs = extractNumber(
        clientSection
            .find("[data-qa='client-job-posting-stats']")
            .text()
            .match(/(\d+) open jobs/i)?.[1],
    );

    const totalSpent = cleanText(
        clientSection
            .find("[data-qa='client-spend']")
            .text(),
    ) || null;

    const hires = extractNumber(
        clientSection
            .find("[data-qa='client-hires']")
            .text()
            .match(/(\d+) hires/i)?.[1],
    );

    const activeHires = extractNumber(
        clientSection
            .find("[data-qa='client-hires']")
            .text()
            .match(/(\d+) active/i)?.[1],
    );

    const avgHourlyRatePaid = cleanText(
        clientSection
            .find("[data-qa='client-hourly-rate']")
            .text(),
    ) || null;

    const totalHours = extractNumber(
        clientSection
            .find("[data-qa='client-hours']")
            .text(),
    );

    const memberSince = cleanText(
        clientSection
            .find("[data-qa='client-contract-date']")
            .text(),
    ) || null;

    /* ===========================================================================
     * Recent History
     * ========================================================================= */

    const recentHistory: UpworkClientReview[] = [];

    $("[data-cy='job']").each((_, el) => {
        const $job = $(el);

        const jobTitle = cleanText(
            $job.find("[data-cy='job-title']").text(),
        );

        const feedback = cleanText(
            $job
                .find(".air3-truncation")
                .first()
                .text(),
        );

        const freelancerName = cleanText(
            $job
                .find("a[href*='/freelancers/']")
                .first()
                .text(),
        );

        const rating = extractNumber(
            $job.find(".air3-rating-value-text").first().text(),
        );

        const stats = cleanText(
            $job.find("[data-cy='stats']").text(),
        );

        const engagementType =
            stats.split("$")[0]?.trim() || null;

        const amountMatch = stats.match(
            /\$\d+(?:,\d+)?(?:\.\d+)?/,
        );

        const amount = amountMatch?.[0] ?? null;

        const dateRange = cleanText(
            $job.find("[data-cy='date']").text(),
        );

        recentHistory.push(
            UpworkClientReviewSchema.parse({
                jobTitle: jobTitle || null,
                feedback: feedback || null,
                freelancerName: freelancerName || null,
                rating,
                engagementType,
                amount,
                dateRange: dateRange || null,
            }),
        );
    });

    /* ===========================================================================
     * Other Open Jobs
     * ========================================================================= */

    const otherOpenJobs: Array<{
        title: string;
        type: string | null;
    }> = [];

    $("#otherOpenJobs li").each((_, el) => {
        const title = cleanText(
            $(el).find("a").text(),
        );

        const type = cleanText(
            $(el).find(".type").text(),
        );

        if (title) {
            otherOpenJobs.push({
                title,
                type: type || null,
            });
        }
    });
    const coreDetails =
        parseUpworkJobCoreDetails(html);
    /* ===========================================================================
     * Final Object
     * ========================================================================= */

    return UpworkJobDetailsSchema.parse({
        jobUrl,
        projectType,
        details: coreDetails,
        mandatorySkills,
        preferredQualifications: {
            location: preferredLocation,
        },
        activity: {
            proposals,
            interviewing,
            invitesSent,
            unansweredInvites,
        },
        connectsRequired,
        availableConnects,
        client: {
            paymentVerified,
            phoneVerified,
            rating,
            reviewCount,
            country,
            city,
            localTime,
            jobsPosted,
            hireRate,
            openJobs,
            totalSpent,
            hires,
            activeHires,
            avgHourlyRatePaid,
            totalHours,
            memberSince,
            recentHistory,
        },
        otherOpenJobs,
    });
}

