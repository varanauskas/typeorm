import "reflect-metadata";
import { closeTestingConnections, createTestingConnections, reloadTestingDatabases } from "../../utils/test-utils";
import { Connection } from "../../../src/connection/Connection";
import { expect } from "chai";
import { TestEntity } from "./entity/TestEntity";
import { RdbmsSchemaBuilder } from "../../../src/schema-builder/RdbmsSchemaBuilder";

describe("github issues > #9999 cannot provide existing queryRunner to schema builder.", () => {
    let connections: Connection[];

    before(async () => connections = await createTestingConnections({
        entities: [TestEntity],
        enabledDrivers: ["postgres"]
    }));
    beforeEach(() => reloadTestingDatabases(connections));
    after(() => closeTestingConnections(connections));

    it("queryRunner should be reused by RdbmsSchemaBuilder", () => Promise.all(connections.map(async (connection) => {
        const queryRunner = connection.createQueryRunner();
        await queryRunner.startTransaction();
        
        const schemaBuilder = new RdbmsSchemaBuilder(connection);

        // Transaction has no tables yet, thus it will have 1 query to create `TestEntity`
        expect((await schemaBuilder.log(queryRunner)).upQueries.length).to.equal(1);

        await schemaBuilder.build(queryRunner);

        // Transaction has one table, thus it will have 0 additional queries as `TestEntity` is already created
        expect((await schemaBuilder.log(queryRunner)).upQueries.length).to.equal(0);

        await queryRunner.commitTransaction();
        await queryRunner.release();
    })));
}); 