import mkdirp from "mkdirp";
import path from "path";
import { DriverPackageNotInstalledError } from "../../error/DriverPackageNotInstalledError";
import { DriverOptionNotSetError } from "../../error/DriverOptionNotSetError";
import { PlatformTools } from "../../platform/PlatformTools";
import { Connection } from "../../connection/Connection";
import { ColumnType } from "../types/ColumnTypes";
import { QueryRunner } from "../../query-runner/QueryRunner";
import { AbstractSqliteDriver } from "../sqlite-abstract/AbstractSqliteDriver";
import { BetterSqlite3ConnectionOptions } from "./BetterSqlite3ConnectionOptions";
import { BetterSqlite3QueryRunner } from "./BetterSqlite3QueryRunner";
import {ReplicationMode} from "../types/ReplicationMode";

/**
 * Organizes communication with sqlite DBMS.
 */
export class BetterSqlite3Driver extends AbstractSqliteDriver {

    // -------------------------------------------------------------------------
    // Public Implemented Properties
    // -------------------------------------------------------------------------

    /**
     * Connection options.
     */
    options: BetterSqlite3ConnectionOptions;

    /**
     * SQLite underlying library.
     */
    sqlite: any;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(connection: Connection) {
        super(connection);

        this.connection = connection;
        this.options = connection.options as BetterSqlite3ConnectionOptions;
        this.database = this.options.database;

        // validate options to make sure everything is set
        if (!this.options.database)
            throw new DriverOptionNotSetError("database");

        // load sqlite package
        this.loadDependencies();
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Closes connection with database.
     */
    async disconnect(): Promise<void> {
        this.queryRunner = undefined;
        this.databaseConnection.close();
    }

    /**
     * Creates a query runner used to execute database queries.
     */
    createQueryRunner(mode: ReplicationMode): QueryRunner {
        if (!this.queryRunner)
            this.queryRunner = new BetterSqlite3QueryRunner(this);

        return this.queryRunner;
    }

    normalizeType(column: { type?: ColumnType, length?: number | string, precision?: number | null, scale?: number }): string {
        if ((column.type as any) === Buffer) {
            return "blob";
        }

        return super.normalizeType(column);
    }

    // -------------------------------------------------------------------------
    // Protected Methods
    // -------------------------------------------------------------------------

    /**
     * Creates connection with the database.
     */
    protected async createDatabaseConnection() {
        // not to create database directory if is in memory
        if (this.options.database !== ":memory:")
            await this.createDatabaseDirectory(this.options.database);

        const {
            database,
            readonly = false,
            fileMustExist = false,
            timeout = 5000,
            verbose = null,
            prepareDatabase
        } = this.options;
        const databaseConnection = this.sqlite(database, { readonly, fileMustExist, timeout, verbose });
        // in the options, if encryption key for SQLCipher is setted.
        // Must invoke key pragma before trying to do any other interaction with the database.
        if (this.options.key) {
            databaseConnection.exec(`PRAGMA key = ${JSON.stringify(this.options.key)}`);
        }

        // function to run before a database is used in typeorm.
        if (typeof prepareDatabase === "function") {
            prepareDatabase(databaseConnection);
        }

        // we need to enable foreign keys in sqlite to make sure all foreign key related features
        // working properly. this also makes onDelete to work with sqlite.
        databaseConnection.exec(`PRAGMA foreign_keys = ON`);

        // turn on WAL mode to enhance performance
        databaseConnection.exec(`PRAGMA journal_mode = WAL`);

        return databaseConnection;
    }

    /**
     * If driver dependency is not given explicitly, then try to load it via "require".
     */
    protected loadDependencies(): void {
        try {
            const sqlite = this.options.driver || PlatformTools.load("better-sqlite3");
            this.sqlite = sqlite;

        } catch (e) {
            throw new DriverPackageNotInstalledError("SQLite", "better-sqlite3");
        }
    }

    /**
     * Auto creates database directory if it does not exist.
     */
    protected async createDatabaseDirectory(fullPath: string): Promise<void> {
        await mkdirp(path.dirname(fullPath));
    }

}
