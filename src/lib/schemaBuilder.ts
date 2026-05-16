type SqlType = | "TEXT" | "INTEGER" | "SMALLINT" | "TIME" | "TIMESTAMP" | "JSONB" | "SERIAL" | "ENUM";

type Column<T> = {
    type: SqlType;
    primaryKey?: true;
    notNull?: true;
    unique?: true;
    default?: string;
    enum?: readonly string[];
    references?: {
        table: string;
        column: string;
        onDelete?: string;
    };
    check?: string;
    __tsType?: T;
};

type Table<T extends Record<string, Column<any>>> = { name: string; columns: T; };


// Types

function text() { return { type: "TEXT" } as Column<string>; }

function integer() { return { type: "INTEGER" } as Column<number>; }

function smallint() { return { type: "SMALLINT" } as Column<number>; }

function serial() { return { type: "SERIAL" } as Column<number>; }

function time() { return { type: "TIME" } as Column<string>; }

function timestamp() { return { type: "TIMESTAMP" } as Column<Date>; }

function jsonb<T = any>() { return { type: "JSONB" } as Column<T>; }

function enumType<T extends readonly string[]>(values: T) {
    return { type: "ENUM", enum: values } as Column<T[number]>;
}


// Property modifiers

function primaryKey<T>(column: Column<T>) { column.primaryKey = true; return column; }

function notNull<T>(column: Column<T>) { column.notNull = true; return column; }

function unique<T>(column: Column<T>) { column.unique = true; return column; }

function defaultValue<T>(column: Column<T>, value: string) { column.default = value; return column; }

function references<T>(column: Column<T>, table: string, target: string, onDelete?: string) {
    column.references = { table, column: target, onDelete }; return column;
}

function check<T>(column: Column<T>, expression: string) {
    column.check = expression; return column;
}


// Table definition

function defineTable<T extends Record<string, Column<any>>>(name: string, columns: T) {
    return { name, columns };
}

type InferRow<T extends ReturnType<typeof defineTable>> = {
    [K in keyof T["columns"]]: T["columns"][K] extends Column<infer U> ? U : never;
};

// SQL generation

function generateCreateTableSQL(table: Table<any>) {
    const lines: string[] = [];
    for (const [columnName, column] of Object.entries(table.columns) as [string, Column<any>][]) {
        let sql = `${columnName} ${column.type}`;
        if (column.type === "ENUM") { sql = `${columnName} TEXT`; }
        if (column.primaryKey) { sql += " PRIMARY KEY"; }
        if (column.notNull) { sql += " NOT NULL"; }
        if (column.unique) { sql += " UNIQUE"; }
        if (column.default) { sql += ` DEFAULT ${column.default}`; }
        if (column.references) {
            sql += ` REFERENCES ${column.references.table}(${column.references.column})`;
            if (column.references.onDelete) { sql += ` ON DELETE ${column.references.onDelete}`; }
        }
        if (column.check) { sql += ` CHECK (${column.check})`; }
        lines.push(sql);
    }
    return `CREATE TABLE IF NOT EXISTS ${table.name} (${lines.join(",\n    ")});`;
}

function buildInsertSQL(table: Table<any>, data: Record<string, any>) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`);
    const sql = `INSERT INTO ${table.name}(${keys.join(", ")}) VALUES (${placeholders.join(", ")})`;
    return { sql, values };
}

function buildSelectSQL(table: Table<any>, where?: Record<string, any>) {
    let sql = `SELECT * FROM ${table.name}`;
    const values: any[] = [];
    if (where && Object.keys(where).length) {
        const conditions = Object.entries(where).map(([key, _], index) => { values.push(where[key]); return `${key} = $${index + 1}`; });
        sql += ` WHERE ${conditions.join(" AND ")}`;
    } return { text: sql, values };
}

function buildUpdateSQL(table: Table<any>, data: Record<string, any>, where: Record<string, any>) {
    const values: any[] = [];
    const setClause = Object.entries(data).map(([key, value], index) => { values.push(value); return `${key} = $${index + 1}`; });
    const whereClause = Object.entries(where).map(([key, value], index) => { values.push(value); return `${key} = $${setClause.length + index + 1}`; });
    const sql = `UPDATE ${table.name} SET ${setClause.join(", ")} WHERE ${whereClause.join(" AND ")}`;
    return { text: sql, values };
}

function buildDeleteSQL(table: Table<any>, where: Record<string, any>) {
    const values: any[] = [];
    const conditions = Object.entries(where).map(([key, value], index) => { values.push(value); return `${key} = $${index + 1}`; });
    const sql = `DELETE FROM ${table.name} WHERE ${conditions.join(" AND ")}`;
    return { text: sql, values };
}

// Exporting

export { 
    text, 
    integer, 
    smallint, 
    time, 
    timestamp, 
    jsonb, 
    serial, 
    enumType 
};
export { 
    primaryKey, 
    notNull, 
    unique, 
    defaultValue, 
    references, 
    check
};
export {
    generateCreateTableSQL,
    buildInsertSQL,
    buildSelectSQL,
    buildUpdateSQL,
    buildDeleteSQL,
};
export { defineTable, InferRow };
export type { Column, Table };