import express, {type Express,} from "express";
import {ApplicationBase, ApplicationOptions, ApplicationType} from "../common/Application";

export type APIEnvVars = {
    port: number;
    metricsPort: number;
}

export class APIApplication extends ApplicationBase<ApplicationType.API, APIEnvVars> {

    expressApp: Express

    constructor(opts: ApplicationOptions<ApplicationType.API, APIEnvVars>) {
        super(opts);

        this.expressApp = express();

        this.expressApp.use(express.json());

    }

    Start(): void {

    }

    Stop(): void {

    }
}
