import {ActorRunner} from "../../core/index.js";
import {upworkComActor} from "./upwork-com.actor.js";

const runner = new ActorRunner({
    config: {
        browser: {
            mode: 'remote-debugging',
        }
    }
});


const run = async () => {
    await runner.run(upworkComActor, 'searchJobs', )

}

run().catch(e=>console.error(e)).then(r=>console.log(r));
