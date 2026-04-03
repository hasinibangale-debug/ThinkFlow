import path from "node:path";
export const config = {
    port: Number(process.env.PORT ?? 8080),
    dbPath: path.resolve(process.cwd(), process.env.THINKFLOW_DB_PATH ?? "./data/thinkflow-db.json"),
};
