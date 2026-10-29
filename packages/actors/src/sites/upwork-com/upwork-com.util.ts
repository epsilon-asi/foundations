import type {UpworkApplyToJobInput, UpworkJobSearchFields} from "./upwork-com.types.js";

export function buildSearchParams(input: UpworkJobSearchFields): URLSearchParams {
    const params = new URLSearchParams();

    if (input.sort !== undefined) params.set('sort', input.sort);
    if (input.domestic !== undefined) params.set('domestic', input.domestic);
    appendList(params, 'categories', input.categories);
    appendList(params, 'contractor_tier', input.contractorTier);
    appendList(params, 'job_type', input.jobType);

    if (input.hourlyRate?.min !== undefined) params.set('hourly_rate_min', String(input.hourlyRate.min));
    if (input.hourlyRate?.max !== undefined) params.set('hourly_rate_max', String(input.hourlyRate.max));
    if (input.hourlyRate?.currency !== undefined) params.set('hourly_rate_currency', input.hourlyRate.currency);

    appendList(params, 'fixed_price_ranges', input.fixedPriceRanges);
    if (input.fixedPriceCustom?.min !== undefined) params.set('fixed_price_min', String(input.fixedPriceCustom.min));
    if (input.fixedPriceCustom?.max !== undefined) params.set('fixed_price_max', String(input.fixedPriceCustom.max));
    if (input.fixedPriceCustom?.currency !== undefined) params.set('fixed_price_currency', input.fixedPriceCustom.currency);

    appendList(params, 'proposals', input.proposals);
    appendList(params, 'client_info', input.clientInfo);
    appendList(params, 'client_hires', input.clientHires);
    appendList(params, 'client_locations', input.clientLocations);
    appendList(params, 'client_timezones', input.clientTimezones);
    appendList(params, 'project_length', input.projectLength);
    appendList(params, 'hours_per_week', input.hoursPerWeek);
    appendList(params, 'job_duration', input.jobDuration);

    return params;
}

function appendList(params: URLSearchParams, key: string, values: readonly string[] | undefined): void {
    if (values === undefined || values.length === 0) return;
    params.set(key, values.join(','));
}

export function parseRate(rate: any): number {
    if (typeof rate === 'number') return rate;
    return Number(rate.trim());
}