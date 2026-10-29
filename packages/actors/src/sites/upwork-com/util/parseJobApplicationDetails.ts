import type { ElementHandle, Page } from "puppeteer-core";

/* -------------------------------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------------------------------- */

export type UpworkProposalQuestionKind =
    | "cover_letter"
    | "custom_question";

export type UpworkProposalControlType =
    | "textarea"
    | "input"
    | "select"
    | "unknown";

export interface UpworkProposalQuestionSelectors {
    container: string | null;
    label: string | null;
    control: string | null;
}

export interface UpworkProposalQuestion {
    id: string;

    kind: UpworkProposalQuestionKind;

    /**
     * The visible prompt shown to the freelancer.
     *
     * Examples:
     * - "Cover Letter"
     * - "Describe your recent experience with similar projects"
     */
    prompt: string;

    /**
     * For cover letter this is always 0.
     * For custom questions this is their order under `.questions-area`.
     */
    index: number;

    controlType: UpworkProposalControlType;

    /**
     * Best-effort CSS selectors for later filling.
     * These are generated from stable page sections, not Vue data-v-* attrs.
     */
    selectors: UpworkProposalQuestionSelectors;

    /**
     * `true` for Cover Letter.
     * `true` for custom questions only when the DOM gives us a required marker/error.
     * `null` means not determinable from the current DOM.
     */
    required: boolean | null;

    placeholder: string | null;

    currentValue: string;

    rows: number | null;

    maxLength: number | null;

    ariaLabelledBy: string | null;

    errorMessages: string[];
}


export interface UpworkProposalQuestions {
    hasAdditionalDetailsSection: boolean;

    sourceUrl: string | null;

    coverLetter: UpworkProposalQuestion | null;

    customQuestions: UpworkProposalQuestion[];

    allQuestions: UpworkProposalQuestion[];

    counts: {
        total: number;
        custom: number;
        hasCoverLetter: boolean;
    };
}
import { z } from "zod";

export const UpworkProposalAnswerSchema = z.object({
    questionId: z.string(),
    kind: z.enum(["cover_letter", "custom_question"]),
    prompt: z.string(),
    answer: z.string(),
});

export const UpworkProposalAnswersSchema = z.object({
    sourceUrl: z.string().nullable().optional(),

    coverLetter: UpworkProposalAnswerSchema.extend({
        kind: z.literal("cover_letter"),
    })
        .nullable()
        .optional(),

    customQuestions: z.array(
        UpworkProposalAnswerSchema.extend({
            kind: z.literal("custom_question"),
        })
    ),

    allAnswers: z.array(UpworkProposalAnswerSchema),
});

export type UpworkProposalAnswers = z.infer<
    typeof UpworkProposalAnswersSchema
>;
/* -------------------------------------------------------------------------------------------------
 * Browser-context parser
 *
 * IMPORTANT:
 * This function is intentionally self-contained because Puppeteer serializes it
 * into the browser context. Do not close over Node-side variables here.
 * ------------------------------------------------------------------------------------------------- */

function parseProposalQuestionsInBrowser(
    rootNode: ParentNode | null,
    sourceUrl: string | null,
): UpworkProposalQuestions {
    const root: ParentNode = rootNode ?? document;

    const cleanText = (input?: string | null): string => {
        return (input ?? "")
            .replace(/\u00a0/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    };

    const toNumber = (input?: string | null): number | null => {
        const match = (input ?? "").match(/\d+/);
        return match ? Number(match[0]) : null;
    };

    const slugify = (input: string): string => {
        const slug = input
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 80);

        return slug || "question";
    };

    const cssEscape = (input: string): string => {
        const css = (globalThis as unknown as { CSS?: { escape?: (value: string) => string } }).CSS;

        if (css?.escape) {
            return css.escape(input);
        }

        return input.replace(/["\\]/g, "\\$&");
    };

    const findCardByHeading = (
        headingText: string,
    ): HTMLElement | null => {
        const headings = Array.from(
            root.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5"),
        );

        const heading = headings.find(
            (el) => cleanText(el.textContent).toLowerCase() === headingText.toLowerCase(),
        );

        if (!heading) {
            return null;
        }

        return (
            heading.closest<HTMLElement>(".fe-proposal-additional-details") ??
            heading.closest<HTMLElement>(".additional-details") ??
            heading.closest<HTMLElement>(".air3-card") ??
            heading.parentElement
        );
    };

    const additionalDetails =
        root.querySelector<HTMLElement>(".fe-proposal-additional-details") ??
        root.querySelector<HTMLElement>(".additional-details") ??
        findCardByHeading("Additional details");

    const hasAdditionalDetailsSection = Boolean(additionalDetails);

    const scope = additionalDetails ?? root;

    const getErrorMessages = (container: Element): string[] => {
        return Array.from(
            container.querySelectorAll<HTMLElement>(
                ".air3-form-message-error, [role='alert'], .error, .has-error",
            ),
        )
            .map((el) => cleanText(el.textContent))
            .filter(Boolean)
            .filter((value, index, array) => array.indexOf(value) === index);
    };

    const getControlType = (
        control: Element | null,
    ): UpworkProposalControlType => {
        if (!control) return "unknown";

        const tag = control.tagName.toLowerCase();

        if (tag === "textarea") return "textarea";
        if (tag === "select") return "select";
        if (tag === "input") return "input";

        return "unknown";
    };

    const getControlValue = (control: Element | null): string => {
        if (!control) return "";

        if (
            control instanceof HTMLTextAreaElement ||
            control instanceof HTMLInputElement ||
            control instanceof HTMLSelectElement
        ) {
            return control.value ?? "";
        }

        return "";
    };

    const getMaxLength = (control: Element | null): number | null => {
        if (!control) return null;

        const value = control.getAttribute("maxlength");

        if (!value) return null;

        const parsed = Number(value);

        return Number.isFinite(parsed) ? parsed : null;
    };

    const getRows = (control: Element | null): number | null => {
        if (!(control instanceof HTMLTextAreaElement)) {
            return null;
        }

        return Number.isFinite(control.rows) ? control.rows : null;
    };

    const inferRequired = (
        kind: UpworkProposalQuestionKind,
        container: Element,
        control: Element | null,
        errors: string[],
    ): boolean | null => {
        if (kind === "cover_letter") {
            return true;
        }

        if (control?.hasAttribute("required")) {
            return true;
        }

        const text = cleanText(container.textContent).toLowerCase();
        const errorText = errors.join(" ").toLowerCase();

        if (container.classList.contains("has-error") && /required/.test(errorText)) {
            return true;
        }

        if (/\brequired\b/.test(errorText)) {
            return true;
        }

        if (/\brequired\b/.test(text)) {
            return true;
        }

        return null;
    };

    const buildQuestion = (
        params: {
            kind: UpworkProposalQuestionKind;
            index: number;
            container: Element;
            baseSelector: string | null;
        },
    ): UpworkProposalQuestion | null => {
        const label = params.container.querySelector<HTMLElement>("label.label, label");

        const control = params.container.querySelector<
            HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement
        >(
            [
                "textarea",
                "input:not([type='hidden']):not([type='file'])",
                "select",
            ].join(", "),
        );

        const prompt = cleanText(label?.textContent);

        if (!prompt || !control) {
            return null;
        }

        const controlType = getControlType(control);
        const controlTag = control.tagName.toLowerCase();
        const errors = getErrorMessages(params.container);

        const ariaLabelledBy =
            control.getAttribute("aria-labelledby") ||
            control.getAttribute("aria-label") ||
            null;

        const id =
            params.kind === "cover_letter"
                ? "cover-letter"
                : `custom-question-${params.index + 1}-${slugify(prompt)}`;

        let containerSelector: string | null = null;
        let labelSelector: string | null = null;
        let controlSelector: string | null = null;

        if (params.kind === "cover_letter") {
            containerSelector =
                ".fe-proposal-additional-details .cover-letter-area .form-group";

            labelSelector =
                ".fe-proposal-additional-details .cover-letter-area label";

            controlSelector =
                ".fe-proposal-additional-details .cover-letter-area textarea";
        } else if (params.baseSelector) {
            const nth = params.index + 1;

            containerSelector =
                `${params.baseSelector} .form-group:nth-of-type(${nth})`;

            labelSelector =
                `${containerSelector} label`;

            controlSelector =
                `${containerSelector} ${controlTag}`;
        }

        if (!controlSelector && control.id) {
            controlSelector = `#${cssEscape(control.id)}`;
        }

        return {
            id,

            kind: params.kind,

            prompt,

            index: params.index,

            controlType,

            selectors: {
                container: containerSelector,
                label: labelSelector,
                control: controlSelector,
            },

            required: inferRequired(params.kind, params.container, control, errors),

            placeholder: control.getAttribute("placeholder") || null,

            currentValue: getControlValue(control),

            rows: getRows(control),

            maxLength: getMaxLength(control),

            ariaLabelledBy,

            errorMessages: errors,
        };
    };

    /* -----------------------------------------------------------------------------------------------
     * Cover Letter
     * --------------------------------------------------------------------------------------------- */


    const coverLetterContainer =
        scope.querySelector<HTMLElement>(".cover-letter-area .form-group") ??
        Array.from(scope.querySelectorAll<HTMLElement>(".form-group")).find((el) =>
            cleanText(el.querySelector("label")?.textContent).toLowerCase() === "cover letter",
        ) ??
        null;


    const coverLetter = coverLetterContainer
        ? buildQuestion({
            kind: "cover_letter",
            index: 0,
            container: coverLetterContainer,
            baseSelector: ".fe-proposal-additional-details .cover-letter-area",
        })
        : null;

    /* -----------------------------------------------------------------------------------------------
     * Custom Job Questions
     * --------------------------------------------------------------------------------------------- */


    const customQuestionArea =
        scope.querySelector<HTMLElement>(".fe-proposal-job-questions.questions-area") ??
        scope.querySelector<HTMLElement>(".questions-area");


    const customQuestionContainers = customQuestionArea
        ? Array.from(customQuestionArea.querySelectorAll<HTMLElement>(".form-group"))
            .filter((el) =>
                Boolean(
                    el.querySelector(
                        [
                            "textarea",
                            "input:not([type='hidden']):not([type='file'])",
                            "select",
                        ].join(", "),
                    ),
                ),
            )
            .filter((el) => {
                const labelText = cleanText(el.querySelector("label")?.textContent).toLowerCase();

                return (
                    labelText !== "cover letter" &&
                    labelText !== "attachments"
                );
            })
        : [];


    const customQuestions = customQuestionContainers
        .map((container, index) =>
            buildQuestion({
                kind: "custom_question",
                index,
                container,
                baseSelector:
                    ".fe-proposal-additional-details .fe-proposal-job-questions.questions-area",
            }),
        )
        .filter((question): question is UpworkProposalQuestion => Boolean(question));

    /* -----------------------------------------------------------------------------------------------
     * Attachments metadata
     * --------------------------------------------------------------------------------------------- */


    const attachmentsArea =
        scope.querySelector<HTMLElement>(".attachments-area") ??
        Array.from(scope.querySelectorAll<HTMLElement>(".form-group")).find((el) =>
            cleanText(el.querySelector("label")?.textContent).toLowerCase() === "attachments",
        ) ??
        null;


    const attachmentsText = cleanText(attachmentsArea?.textContent);


    const fileInput =
        attachmentsArea?.querySelector<HTMLInputElement>("input[type='file']") ??
        null;


    const rejectTypesHolder =
        attachmentsArea?.querySelector<HTMLElement>("[reject_types]") ??
        null;


    const rejectedExtensions = cleanText(
        rejectTypesHolder?.getAttribute("reject_types") ?? "",
    )
        .split(",")
        .map((value) => value.trim().replace(/^\./, ""))
        .filter(Boolean);

    const allQuestions = [
        ...(coverLetter ? [coverLetter] : []),
        ...customQuestions,
    ];

    return {
        hasAdditionalDetailsSection,

        sourceUrl,

        coverLetter,

        customQuestions,

        allQuestions,



        counts: {
            total: allQuestions.length,
            custom: customQuestions.length,
            hasCoverLetter: Boolean(coverLetter),
        },
    };
}

/* -------------------------------------------------------------------------------------------------
 * Puppeteer API
 * ------------------------------------------------------------------------------------------------- */

export async function parseUpworkProposalQuestions(
    page: Page,
    options?: {
        timeoutMs?: number;
    },
): Promise<UpworkProposalQuestions> {
    const timeoutMs = options?.timeoutMs ?? 15_000;

    await page
        .waitForSelector(
            [
                ".fe-proposal-additional-details",
                ".additional-details",
                ".cover-letter-area",
                ".questions-area",
            ].join(", "),
            {
                timeout: timeoutMs,
            },
        )
        .catch(() => {
            // Some proposal pages may render only a cover letter or may lazy-render the
            // additional details section. We still try to parse the current DOM.
        });

    return page.evaluate(
        parseProposalQuestionsInBrowser,
        null,
        page.url(),
    );
}

export async function parseUpworkProposalQuestionsFromRoot(
    root: ElementHandle<Element>,
    sourceUrl: string | null = null,
): Promise<UpworkProposalQuestions> {
    return root.evaluate(
        parseProposalQuestionsInBrowser,
        sourceUrl,
    );
}

/* -------------------------------------------------------------------------------------------------
 * Optional helper: fill answers after parsing
 * ------------------------------------------------------------------------------------------------- */

export interface UpworkProposalQuestionAnswers {
    coverLetter?: string;

    /**
     * You can key custom answers by:
     * - generated question id
     * - exact prompt text
     */
    customQuestions?: Record<string, string>;
}

export async function fillUpworkProposalQuestions(
    page: Page,
    answers: UpworkProposalQuestionAnswers,
): Promise<void> {
    const parsed = await parseUpworkProposalQuestions(page);

    if (answers.coverLetter && parsed.coverLetter?.selectors.control) {
        await page.focus(parsed.coverLetter.selectors.control);
        await page.keyboard.down(process.platform === "darwin" ? "Meta" : "Control");
        await page.keyboard.press("A");
        await page.keyboard.up(process.platform === "darwin" ? "Meta" : "Control");

        await page.type(parsed.coverLetter.selectors.control, answers.coverLetter);
    }

    const customAnswers = answers.customQuestions ?? {};

    for (const question of parsed.customQuestions) {
        const answer =
            customAnswers[question.id] ??
            customAnswers[question.prompt];

        if (!answer || !question.selectors.control) {
            continue;
        }

        await page.focus(question.selectors.control);
        await page.keyboard.down(process.platform === "darwin" ? "Meta" : "Control");
        await page.keyboard.press("A");
        await page.keyboard.up(process.platform === "darwin" ? "Meta" : "Control");
        await page.type(question.selectors.control, answer);
    }
}

/* -------------------------------------------------------------------------------------------------
 * Example
 * ------------------------------------------------------------------------------------------------- */

/*
import puppeteer from "puppeteer";

async function main(): Promise<void> {
  const browser = await puppeteer.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto("https://www.upwork.com/ab/proposals/job/~YOUR_JOB_ID/apply/", {
    waitUntil: "networkidle2",
  });

  const questions = await parseUpworkProposalQuestions(page);

  console.dir(questions, {
    depth: null,
  });

  await fillUpworkProposalQuestions(page, {
    coverLetter: "Hi, I have relevant experience...",
    customQuestions: {
      "Describe your recent experience with similar projects":
        "Recently I led a similar product and engineering effort...",
    },
  });

  await browser.close();
}

void main();
*/