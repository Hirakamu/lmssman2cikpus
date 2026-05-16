import type { PoolClient } from "pg";
import type { DatabaseClient } from "./db.js";
import { generateCreateTableSQL } from "./schemaBuilder.js";
import type { Table, Column } from "./schemaBuilder.js";

// ---------------------------------------------------------------------------
// Type Helpers
// ---------------------------------------------------------------------------

/** Extract the TypeScript row shape from a defineTable() result */
type InferRow<T extends Table<any>> = {
    [K in keyof T["columns"]]: T["columns"][K] extends Column<infer U> ? U : never;
};

/** Make all keys optional for partial updates / WHERE clauses */
type PartialRow<T extends Table<any>> = Partial<InferRow<T>>;

/** Pick only specific columns from a row */
type PickRow<T extends Table<any>, K extends keyof InferRow<T>> = Pick<InferRow<T>, K>;

/** Merge two row types for JOIN results */
type MergedRow<A extends Table<any>, B extends Table<any>> = InferRow<A> & InferRow<B>;

/** Valid column names of a table */
type ColName<T extends Table<any>> = keyof InferRow<T> & string;

/** Options for insert's conflict resolution */
type ForceMode = "update" | "ignore";
interface InsertOptions {
    force?: ForceMode;
    conflictTarget?: string; // column name(s) for ON CONFLICT(...)
}

/** ORDER BY direction */
type OrderDir = "ASC" | "DESC";

// ---------------------------------------------------------------------------
// Internal SQL builder helpers
// ---------------------------------------------------------------------------

function buildWhere(where: Record<string, any>, offset = 0): { clause: string; values: any[] } {
    const values: any[] = [];
    const conditions = Object.entries(where).map(([key, val], i) => {
        values.push(val);
        return `${key} = $${offset + i + 1}`;
    });
    return {
        clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
        values,
    };
}

function buildSet(data: Record<string, any>, offset = 0): { clause: string; values: any[] } {
    const values: any[] = [];
    const parts = Object.entries(data).map(([key, val], i) => {
        values.push(val);
        return `${key} = $${offset + i + 1}`;
    });
    return { clause: `SET ${parts.join(", ")}`, values };
}

// ---------------------------------------------------------------------------
// SELECT Builder
// ---------------------------------------------------------------------------

class SelectBuilder<
    TMain extends Table<any>,
    TResult = InferRow<TMain>
> {
    private _columns: string[] = ["*"];
    private _wheres: Array<{ col: string; val: any }> = [];
    private _joins: Array<{ table: Table<any>; on: [string, string] }> = [];
    private _orderBy?: { col: string; dir: OrderDir };
    private _limit?: number;
    private _offset?: number;

    constructor(
        private db: DatabaseClient,
        private table: TMain,
        private client?: PoolClient
    ) {}

    /** Restrict which columns are returned */
    columns<K extends ColName<TMain>>(...cols: K[]): SelectBuilder<TMain, PickRow<TMain, K>> {
        this._columns = cols as string[];
        return this as any;
    }

    /** Filter rows. Call multiple times to AND conditions together */
    where(conditions: PartialRow<TMain>): this {
        for (const [col, val] of Object.entries(conditions)) {
            this._wheres.push({ col, val });
        }
        return this;
    }

    /** JOIN another table. onLeft/onRight are "tableName.column" strings */
    join<TOther extends Table<any>>(
        other: TOther,
        onLeft: string,
        onRight: string
    ): SelectBuilder<TMain, TResult & InferRow<TOther>> {
        this._joins.push({ table: other, on: [onLeft, onRight] });
        return this as any;
    }

    /** Add ORDER BY clause */
    orderBy(col: ColName<TMain>, dir: OrderDir = "ASC"): this {
        this._orderBy = { col: col as string, dir };
        return this;
    }

    /** Limit the number of returned rows */
    limit(n: number): this {
        this._limit = n;
        return this;
    }

    /** Skip the first N rows */
    offsetBy(n: number): this {
        this._offset = n;
        return this;
    }

    /** Build and execute the SELECT query */
    async execute(): Promise<TResult[]> {
        const parts: string[] = [];
        const values: any[] = [];

        // SELECT columns FROM main
        parts.push(`SELECT ${this._columns.join(", ")} FROM ${this.table.name}`);

        // JOINs
        for (const j of this._joins) {
            parts.push(`JOIN ${j.table.name} ON ${j.on[0]} = ${j.on[1]}`);
        }

        // WHERE
        if (this._wheres.length) {
            const conditions = this._wheres.map(({ col, val }, i) => {
                values.push(val);
                return `${col} = $${i + 1}`;
            });
            parts.push(`WHERE ${conditions.join(" AND ")}`);
        }

        // ORDER BY
        if (this._orderBy) {
            parts.push(`ORDER BY ${this._orderBy.col} ${this._orderBy.dir}`);
        }

        // LIMIT / OFFSET
        if (this._limit !== undefined) parts.push(`LIMIT ${this._limit}`);
        if (this._offset !== undefined) parts.push(`OFFSET ${this._offset}`);

        const sql = parts.join(" ");

        if (this.client) {
            const result = await this.client.query<any>(sql, values);
            return result.rows as TResult[];
        }
        const result = await this.db.query<any>(sql, values);
        return result.rows as TResult[];
    }
}

// ---------------------------------------------------------------------------
// UPDATE Builder
// ---------------------------------------------------------------------------

class UpdateBuilder<T extends Table<any>> {
    private _set: PartialRow<T> = {};
    private _where: PartialRow<T> = {};

    constructor(
        private db: DatabaseClient,
        private table: T,
        private client?: PoolClient
    ) {}

    set(data: PartialRow<T>): this {
        this._set = { ...this._set, ...data };
        return this;
    }

    where(conditions: PartialRow<T>): this {
        this._where = { ...this._where, ...conditions };
        return this;
    }

    async execute(): Promise<number> {
        if (!Object.keys(this._set).length) throw new Error("cdb.update: .set() is required");
        if (!Object.keys(this._where).length) throw new Error("cdb.update: .where() is required (safety guard)");

        const { clause: setClause, values: setValues } = buildSet(this._set as Record<string, any>);
        const { clause: whereClause, values: whereValues } = buildWhere(
            this._where as Record<string, any>,
            setValues.length
        );

        const sql = `UPDATE ${this.table.name} ${setClause} ${whereClause}`;
        const values = [...setValues, ...whereValues];

        if (this.client) {
            const result = await this.client.query(sql, values);
            return result.rowCount ?? 0;
        }
        const result = await this.db.query(sql, values);
        return result.rowCount ?? 0;
    }
}

// ---------------------------------------------------------------------------
// DELETE Builder
// ---------------------------------------------------------------------------

class DeleteBuilder<T extends Table<any>> {
    private _where: PartialRow<T> = {};

    constructor(
        private db: DatabaseClient,
        private table: T,
        private client?: PoolClient
    ) {}

    where(conditions: PartialRow<T>): this {
        this._where = { ...this._where, ...conditions };
        return this;
    }

    async execute(): Promise<number> {
        if (!Object.keys(this._where).length) throw new Error("cdb.delete: .where() is required (safety guard)");

        const { clause, values } = buildWhere(this._where as Record<string, any>);
        const sql = `DELETE FROM ${this.table.name} ${clause}`;

        if (this.client) {
            const result = await this.client.query(sql, values);
            return result.rowCount ?? 0;
        }
        const result = await this.db.query(sql, values);
        return result.rowCount ?? 0;
    }
}

// ---------------------------------------------------------------------------
// Transaction Context
// — inside a transaction, all methods go through the PoolClient directly
// ---------------------------------------------------------------------------

export class TransactionContext {
    constructor(
        private db: DatabaseClient,
        private client: PoolClient
    ) {}

    select<T extends Table<any>>(table: T): SelectBuilder<T> {
        return new SelectBuilder(this.db, table, this.client);
    }

    async insert<T extends Table<any>>(
        table: T,
        data: PartialRow<T>,
        options?: InsertOptions
    ): Promise<InferRow<T>> {
        return insertImpl(this.client, table, data, options);
    }

    update<T extends Table<any>>(table: T): UpdateBuilder<T> {
        return new UpdateBuilder(this.db, table, this.client);
    }

    delete<T extends Table<any>>(table: T): DeleteBuilder<T> {
        return new DeleteBuilder(this.db, table, this.client);
    }
}

// ---------------------------------------------------------------------------
// Shared INSERT implementation (used by both cdb and TransactionContext)
// ---------------------------------------------------------------------------

async function insertImpl<T extends Table<any>>(
    executor: DatabaseClient | PoolClient,
    table: T,
    data: PartialRow<T>,
    options?: InsertOptions
): Promise<InferRow<T>> {
    const keys = Object.keys(data as object);
    const vals = Object.values(data as object);
    const placeholders = vals.map((_, i) => `$${i + 1}`);

    let sql = `INSERT INTO ${table.name}(${keys.join(", ")}) VALUES (${placeholders.join(", ")})`;

    if (options?.force) {
        const target = options.conflictTarget ? `(${options.conflictTarget})` : "";
        if (options.force === "ignore") {
            sql += ` ON CONFLICT ${target} DO NOTHING`;
        } else if (options.force === "update") {
            const updates = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
            sql += ` ON CONFLICT ${target} DO UPDATE SET ${updates}`;
        }
    }

    sql += " RETURNING *";

    let rows: any[];
    if ("query" in executor && typeof (executor as any).pool !== "undefined") {
        // DatabaseClient
        const result = await (executor as DatabaseClient).query<any>(sql, vals);
        rows = result.rows;
    } else {
        // PoolClient
        const result = await (executor as PoolClient).query<any>(sql, vals);
        rows = result.rows;
    }

    return rows[0] as InferRow<T>;
}

// ---------------------------------------------------------------------------
// Main CDB class
// ---------------------------------------------------------------------------

export class CDB {
    constructor(private db: DatabaseClient) {}

    // --- DDL ---

    /** Create a table if it doesn't exist. Use in boot.ts in dependency order. */
    async createTable(table: Table<any>): Promise<void> {
        const sql = generateCreateTableSQL(table);
        await this.db.query(sql);
    }

    // --- DML ---

    /** Start a SELECT query chain */
    select<T extends Table<any>>(table: T): SelectBuilder<T> {
        return new SelectBuilder(this.db, table);
    }

    /**
     * Insert a row into a table.
     * @param options.force "update" → upsert, "ignore" → skip on conflict
     * @param options.conflictTarget column name(s) for ON CONFLICT(...), e.g. "nisn"
     */
    async insert<T extends Table<any>>(
        table: T,
        data: PartialRow<T>,
        options?: InsertOptions
    ): Promise<InferRow<T>> {
        return insertImpl(this.db, table, data, options);
    }

    /** Start an UPDATE query chain — must call .set() and .where() before .execute() */
    update<T extends Table<any>>(table: T): UpdateBuilder<T> {
        return new UpdateBuilder(this.db, table);
    }

    /** Start a DELETE query chain — must call .where() before .execute() (safety guard) */
    delete<T extends Table<any>>(table: T): DeleteBuilder<T> {
        return new DeleteBuilder(this.db, table);
    }

    /**
     * Run multiple operations in a single atomic transaction.
     * If any operation throws, everything is rolled back automatically.
     *
     * @example
     * await cdb.transaction(async (tx) => {
     *     await tx.insert(student, { ... })
     *     await tx.update(attendance).set({ ... }).where({ ... }).execute()
     * })
     */
    async transaction<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T> {
        return this.db.transaction(async (client) => {
            const tx = new TransactionContext(this.db, client);
            return callback(tx);
        });
    }
}

// ---------------------------------------------------------------------------
// Export a singleton — import { cdb } from "./cdb.js"
// ---------------------------------------------------------------------------

export type { InferRow, PartialRow, PickRow, MergedRow, ColName, InsertOptions, ForceMode };