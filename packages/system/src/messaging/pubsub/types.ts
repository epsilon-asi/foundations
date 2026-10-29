import {createDecoratorRegistry} from "@epsilon-asi/foundation";

export type PubSubDecorators<TTopics extends string = string> = {
    class: {
        PubSubMessage: {
            metadata: {
                topic: TTopics
            }
        }
    },
    method: {
        Consumer: {
            metadata: {
                topic: TTopics
            },
            target: (message: BasePubSubMessage) => Promise<void>
        },
    },
    property: {},
    accessor: {}
}

enum PubSubTopics {
    TOPIC_1 = "TOPIC_1",
}

export class BasePubSubMessage {
}

const registry = createDecoratorRegistry<PubSubDecorators<PubSubTopics>>()
const PubSub = registry.for<BasePubSubMessage>();
const PubSubMessage = PubSub.class('PubSubMessage');
const Consumer = PubSub.method('Consumer');



export class TestImpl extends BasePubSubMessage {

}