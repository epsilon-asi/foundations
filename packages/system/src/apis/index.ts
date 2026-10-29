import { createDecoratorRegistry } from "@epsilon-asi/foundation";

type CrudDecorators = {
    class: {
        CrudEntity: {
            metadata: {
                creatable: boolean,
                editable: boolean,
                deletable: boolean,
                listable: boolean,
            },
        }
    };
    property: {
        CrudProperty: {
            metadata: {
                configurable?: {
                    onCreate: boolean,
                    onEdit: boolean,
                } | false
            },
            target: any
        }
    };
    method: {};
    accessor: {};
};


const registry = createDecoratorRegistry<CrudDecorators>();

export type CrudEntityContract = {

}
const CRUDDecoratorBuilder = registry.for<CrudEntityContract>();

const CrudEntity = CRUDDecoratorBuilder.class('CrudEntity');
const CrudProperty = CRUDDecoratorBuilder.property('CrudProperty');

type CrudProperty<ValueType extends any = any, OnCreate extends boolean = true, OnEdit extends boolean = true, OnFind extends boolean = true, OnDelete extends boolean = true> = {
    valueType: ValueType
    onCreate: OnCreate
    onEdit: OnEdit
    onFind: OnFind
    onDelete: OnDelete
}

@CrudEntity({
    creatable: true,
    editable: true,
    deletable: true,
    listable: true,
})
class TestEntity implements CrudEntityContract {
    @CrudProperty({
        configurable: {
            onCreate: true,
            onEdit: true,
        },
    })
    prop: CrudProperty = {
        valueType: "string",
        onCreate: true,
        onEdit: true,
        onFind: true,
        onDelete: true,
    }

    @CrudProperty({
        configurable: {
            onCreate: true,
            onEdit: true,
        },
    })
    prop2!: string;
}


const buildEntities = () => {
    const snapshot = registry.read(TestEntity);
    const CrudEntity = snapshot.firstClass('CrudEntity');
    if (CrudEntity === undefined) throw new Error('Missing @Controller metadata.');
    snapshot.classRecords()
    return snapshot.propertyRecords('CrudProperty').map((record) => {
      console.log(record)
        return {

      }
    })
}

buildEntities();


