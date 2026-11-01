import {ApplicationBase, ApplicationType} from "./Application";

export type ApplicationBuilderOptions<Type extends ApplicationType> = {

} & ApplicationBase<Type>;

export class ApplicationBuilder {
    static CreateApplication<Type extends ApplicationType>(opts: ApplicationBuilderOptions<Type>,): ApplicationBase<Type> {
        return {} as ApplicationBase<Type>;
    }
}


const buildApplication = () => {

}