import * as cheerio from "cheerio";
import {z} from "zod";

export const UpworkProposalConnectsDetailsFields = {
    availableConnects: z.number(),
    requiredConnectsForProposal: z.number(),
}

export const UpworkBoostingDetailsFields = {
    topBids: z.array(z.number()),
};

export const UpworkProposalBoostingEnabledSchema = z.object({
    boostingEnabled: z.literal(true),
    ...UpworkProposalConnectsDetailsFields,
    ...UpworkBoostingDetailsFields
});

export const UpworkProposalBoostingDisabledSchema = z.object({
    boostingEnabled: z.literal(false),
    ...UpworkProposalConnectsDetailsFields,
    topBids: z.literal(null),
})

export type UpworkBoostingDetails = z.infer<
    typeof UpworkProposalBoostingEnabledSchema
> | z.infer<
    typeof UpworkProposalBoostingDisabledSchema
>;


export function parseUpworkBoostingDetails(
    html: string,
): UpworkBoostingDetails {
    const $ = cheerio.load(html);

    const extractNumber = (
        input?: string | null,
    ): number | null => {
        const match = (input ?? "").match(/\d+/);
        return match ? Number(match[0]) : null;
    };

    const cleanText = (input?: string | null): string => {
        return (input ?? "")
            .replace(/\u00a0/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    };

    const boostSection = $(".fe-proposal-boost-proposal").first();

    if (!boostSection.length) {
        return UpworkProposalBoostingDisabledSchema.parse({
            boostingEnabled: false,
            availableConnects: null,
            requiredConnectsForProposal: null,
            topBids: null,
        });
    }

    const availableConnects =
        extractNumber(
            boostSection.find(".remaining-connects").first().text(),
        ) ??
        extractNumber(
            boostSection.find("#bid-connects-label").first().text(),
        ) ??
        extractNumber(
            boostSection
                .find("#your-bid-container input[type='number']")
                .attr("max"),
        );

    const requiredConnectsForProposal =
        extractNumber(
            boostSection
                .find(".air3-grid-container")
                .filter((_, el) =>
                    cleanText($(el).text()).includes("Required for proposal:"),
                )
                .first()
                .text(),
        ) ??
        extractNumber(
            boostSection
                .text()
                .match(/Required for proposal:\s*(\d+)\s*Connects/i)?.[1],
        );

    const topBids = boostSection
        .find("table tbody tr")
        .map((_, row) => {
            const bidText = cleanText($(row).find("td").eq(2).text());

            if (/no bids/i.test(bidText)) {
                return null;
            }

            return extractNumber(bidText);
        })
        .get()
        .filter((value): value is number => typeof value === "number")
        .slice(0, 5);

    return UpworkProposalBoostingEnabledSchema.parse({
        boostingEnabled: true,
        availableConnects,
        requiredConnectsForProposal,
        topBids,
    });
}