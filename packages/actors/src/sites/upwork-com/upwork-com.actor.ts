import {defineLoginFlow} from '../../auth/LoginFlow.types.js';
import {defineActor} from '../../core/defineActor.js';
import {upworkComSelectors} from './upwork-com.selectors.js';
import {
    UpworkApplyToJobInput,
    UpworkApplyToJobResult,
    UpworkJobSearchFields,
    UpworkJobSelector
} from './upwork-com.types.js';
import {parseRate} from "./upwork-com.util.js";
import {ScrapeDashboardInput} from "../example/index.js";
import {parseUpworkSearchResults, UpworkJobListing} from "./util/scrapeJobListing.js";
import {Page} from "puppeteer-core";
import {
    fillUpworkProposalQuestions,
    parseUpworkProposalQuestions, UpworkProposalAnswers, UpworkProposalQuestionKind,
    UpworkProposalQuestions
} from "./util/parseJobApplicationDetails.js";
import {parseUpworkJobDetailsPage, UpworkJobCoreDetails, UpworkJobDetails} from "./util/parseJobDetails.js";
import {parseUpworkBoostingDetails} from "./util/parseBoostingDetails.js";
const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export const upworkComActor = defineActor({
    id: 'upwork-com',
    baseUrl: 'https://upwork.com',
    auth: defineLoginFlow({
        loginUrl: 'https://www.upwork.com/',
        selectors: {
            loggedInSignal: upworkComSelectors.login.loggedInSignal,
            errorMessage: upworkComSelectors.login.errorMessage
        },
        credentials: {id: 'upwork'},
        behavior: {
            authCheckUrl: '/nx/search/jobs',
            loggedInTimeoutMs: 5_000,
            errorTimeoutMs: 1_500,
            typing: {
                targetWordsPerMinute: 65,
                intervalJitterMs: 18
            }
        },
        steps: [
            {
                type: 'fill',
                name: 'username',
                selector: upworkComSelectors.login.username,
                credential: 'username'
            },
            {
                type: 'click',
                name: 'continue to password',
                selector: upworkComSelectors.login.continueToPassword,
                waitForSelector: upworkComSelectors.login.password,
                waitForSelectorTimeoutMs: 5_000
            },
            {
                type: 'fill',
                name: 'password',
                selector: upworkComSelectors.login.password,
                credential: 'password'
            },
            {
                type: 'click',
                name: 'submit password',
                selector: upworkComSelectors.login.submit,
                submit: true,
                waitForNavigation: true,
                checkForError: false
            }
        ]
    }),
    tasks: {
        searchJobs: async (context, input: UpworkJobSearchFields = {}): Promise<UpworkJobListing[]> => {
            console.log('starting job search task');
            const path = '/nx/search/jobs/?category2_uid=531770282580668420,531770282580668419,531770282580668418&client_hires=1-9,10-&fromAppshell=1&hourly_rate=50-&location=Canada,United%2520Kingdom,United%2520States,United%2520States%2520Minor%2520Outlying%2520Islands&nav_dir=pop&payment_verified=1&per_page=20&q=%27karpenter%27%20OR%20%27rancher%27%20OR%20%27terraform%27%20OR%20%27gitops%27%20OR%20%27azure%27%20OR%20%27microsoft%20azure%27%20OR%20%27cloud%20architect%27%20OR%20%27ai%20architect%27%20OR%20%27forward%20deployed%20engineer%27%20OR%20%27aws%27%20OR%20%27aks%27%20OR%20%27eks%27%20OR%20%27gke%27%20OR%20%27cloud%20engineer%27%20OR%20devops%20OR%20kuberentes%20OR%20%27platform%20engineer%27%20OR%20%27infrastructure%20engineer%27%20OR%20"google%20cloud%20platform"%20OR%20"GCP"%20OR%20"langsmith"%20OR%20"langgraph"%20OR%20"gemini%20enterprise"&sort=recency&t=0';

            console.log('navigating to jobs search page');
            await context.nav.goto(path, {});

            console.log('parsing jobs search results');
            const results = await parseUpworkSearchResults(context.session.page as Page);
            console.log('finished job search task');
            await context.page.close();
            return results;
        },
        getJob: async (_context, input: UpworkJobSelector): Promise<{
            jobDetails: UpworkJobDetails,
            jobQuestions: UpworkProposalQuestions
        }> => {
            console.log('starting get job task');
            console.log('opening job details page');
            await _context.nav.goto(`/jobs/~02${input.jobId}/`);

            console.log('parsing job details content');
            const jobDetails =  parseUpworkJobDetailsPage(await _context.session.page.content());

            console.log('opening job application page');
            await _context.nav.goto(`/nx/proposals/job/~02${input.jobId}/apply/`);

            console.log('parsing proposal questions');
            const jobQuestions = await parseUpworkProposalQuestions(_context.session.page as Page);
            console.log('finished get job task');
            await _context.page.close();
            return {
                jobDetails,
                jobQuestions
            }
        },
        applyToJob: async (_context, input: UpworkApplyToJobInput & UpworkProposalAnswers): Promise<UpworkApplyToJobResult> => {
            try {
                console.log('starting apply to job task');
                console.log('opening apply page');
                await _context.nav.goto(`/nx/proposals/job/~02${input.jobId}/apply/`, {waitUntil:"networkidle0"});
                await wait(3000)
                console.log('Moving mouse to agency selector');
                //await _context.cursor.move('.up-fe-agency-member-selector > [data-test="dropdown-toggle"]')
                console.log('Clicking agency selector');
                await _context.cursor.click('.up-fe-team-selector')
                await wait(1000)
                console.log('Moving mouse to agency option');
                //await _context.cursor.move('li[role="option"][tabindex="0"]')
                await _context.cursor.click('li[role="option"][tabindex="0"]')
                await wait(1000)
                console.log('opening contractor selector');
                //await _context.cursor.move('.up-fe-contractor-selector > [data-test="dropdown-toggle"]')
                await _context.cursor.click('.up-fe-contractor-selector')
                await wait(1000)
                console.log('selecting contractor option');
                //await _context.cursor.move('li[role="option"][tabindex="0"]')
                await _context.cursor.click('li[role="option"][tabindex="0"]')
                await wait(2000)
                console.log('scrolling to rate increase selector');
                await _context.cursor.scrollIntoView('[aria-label="How often do you want a rate increase?"]')
                await wait(2000)
                console.log('opening rate increase selector');
                //await _context.cursor.move('[data-test="sri-form-card"] > [data-test="dropdown-toggle"] > [aria-label="How often do you want a rate increase?"]')
                await _context.cursor.click('[aria-label="How often do you want a rate increase?"]')
                await wait(1000)
                //await _context.cursor.move('li[role="option"][tabindex="0"]')
                await _context.cursor.click('li[role="option"][tabindex="0"]')
                await wait(3000)
                await _context.forms.fillText('#step-rate', (input.rate ?? 99).toString())

                console.log('filling proposal answers');
                await fillUpworkProposalQuestions(_context.session.page as Page, input.answers)

                try {

                    // await wait(967)
                    // await _context.cursor.click('span.up-fe-upload-btn>button')
                    // await wait(1990)
                    // await _context.native.fileDialogs.selectFile('/Users/chris/Downloads/resume.pdf');
                    // await wait(1360)

                    const {boostingEnabled, requiredConnectsForProposal, availableConnects, topBids} = parseUpworkBoostingDetails(await _context.session.page.content())
                    if(requiredConnectsForProposal < availableConnects && requiredConnectsForProposal <= 100) {
                        if(boostingEnabled && (topBids[0] ?? 0) < 100) {
                            await _context.cursor.click('#set-bid-button')
                        }
                    }

                } catch (e) {
                    // no concerns if this fails bc this button is not always avail
                    console.log(e)
                    console.log("Swallowed Error. Proceeding")
                }
                await wait(15000)
                await _context.cursor.click('footer>div>button.air3-btn-primary')

                await _context.page.waitForNavigation({waitUntil: "networkidle0"});
                await _context.page.close();
            }
            catch(e){
                console.error(e)
                console.log(e);
                return {
                    success: false,
                    coverLetter: input.answers.coverLetter ?? '',
                };
            }
            console.log('building apply result payload');
            return {
                success: true,
                coverLetter: input.answers.coverLetter ?? '',
            };
        }
    }
});
