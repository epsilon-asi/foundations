import {PubSub} from "@google-cloud/pubsub";

import {SubscriberClient} from "@google-cloud/pubsub/build/src/v1";
import {Message} from "@google-cloud/pubsub/build/src/subscriber";
import {google} from "@google-cloud/pubsub/build/protos/protos";
import IPullRequest = google.pubsub.v1.IPullRequest;
import IPullResponse = google.pubsub.v1.IPullResponse;

export type PubSubServiceInitOpts = {
        projectId: string,
        debug?: boolean
}
export default class StaticPubSubService {
    static client: PubSubService
    static Initialize(opts: PubSubServiceInitOpts){
        this.client = new PubSubService(opts)
    }
    // Todo - decide whether we want this static impl or whether the nonstatic impl is best.
}

export class PubSubService<Topics extends string = string, Subscriptions extends string = string, MessageData extends Record<string, unknown> = {}> {
     projectID: string;
     subClient: SubscriberClient;
     pubClient: PubSub;

    constructor(opts: PubSubServiceInitOpts) {
        const {debug, projectId} = opts;
        this.projectID = projectId;
        this.subClient = new SubscriberClient({
            projectId: projectId,

        });
        this.pubClient = new PubSub({
            projectId: projectId,
        });
    }

     Subscribe = async (subscription: Subscriptions, callback: (message: Message) => (Promise<any> | void)): Promise<void> => {
        this.pubClient.subscription(subscription, {
            flowControl: {
                allowExcessMessages: false,
                maxMessages: 1,
            },
            streamingOptions: {
                maxStreams: 1
            },
        }).on('message', callback);
    }
     Unsubscribe = async (subscription: Subscriptions, callback: (message: Message) => (Promise<any> | void)): Promise<void> => {
        this.pubClient.subscription(subscription).removeListener("message", callback);
    }

     GetMessage = async (subscription: Subscriptions): Promise<[IPullResponse, IPullRequest | undefined]> => {
        const [response, request, empty]: [IPullResponse, (IPullRequest | undefined), ({} | undefined)] = await this.subClient.pull({
            subscription: `${this.projectID}/${subscription}`,
            maxMessages: 1
        })

        return [response, request];
    }

     publishMessage = async (topic: Topics, message: MessageData) => {
        return this.pubClient
            .topic(topic)
            .publishMessage({
                // TODO - Fix usage of deprecated "Buffer" function
                data: new Buffer(JSON.stringify({
                    topic,
                    data: message
                })),
            });
    }
}