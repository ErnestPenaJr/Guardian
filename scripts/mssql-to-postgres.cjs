#!/usr/bin/env node
/**
 * mssql-to-postgres.cjs
 * --------------------------------------------------------------------------
 * Introspects a live SQL Server (Azure SQL) database and regenerates the
 * full schema + data as PostgreSQL-dialect SQL. Built for the Guardian MVP
 * database move (SQL Server -> PostgreSQL).
 *
 * It produces two files (default: ./postgres/):
 *   01_schema.sql  - CREATE SCHEMA + all tables, PKs, uniques, indexes,
 *                    check constraints, and DEFERRABLE foreign keys.
 *   02_seed.sql    - A full data clone as batched INSERTs, wrapped in a
 *                    single transaction with deferred constraints, plus
 *                    identity-sequence resync at the end.
 *
 * Identifiers are emitted as quoted, case-preserved names ("GUARDIAN"."USERS")
 * so the Postgres database is a faithful 1:1 copy of the source.
 *
 * USAGE
 *   # uses DATABASE_URL (Prisma sqlserver:// string) if present, else the
 *   # built-in staging fallback below
 *   node scripts/mssql-to-postgres.cjs
 *
 *   # point at a specific source / output dir
 *   DATABASE_URL="sqlserver://host:1433;database=DB;user=U;password=P;encrypt=true" \
 *     node scripts/mssql-to-postgres.cjs --schema GUARDIAN --out ./postgres
 *
 * FLAGS
 *   --schema <name>   source SQL Server schema to export (default GUARDIAN)
 *   --out <dir>       output directory (default ./postgres)
 *   --schema-only     emit 01_schema.sql only (skip the data dump)
 *   --batch <n>       INSERT rows per statement (default 200)
 *
 * NOTE: 02_seed.sql is a full clone and contains real PII + password hashes.
 *       It is git-ignored by default. Treat it as sensitive.
 */

const fs = require('fs');
const path = require('path');
const sql = require('mssql');

// ---------------------------------------------------------------------------
// Args + connection config
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const a = { schema: 'GUARDIAN', out: path.join(process.cwd(), 'postgres'), schemaOnly: false, batch: 200 };
  for (let i = 2; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--schema') a.schema = argv[++i];
    else if (v === '--out') a.out = path.resolve(argv[++i]);
    else if (v === '--schema-only') a.schemaOnly = true;
    else if (v === '--batch') a.batch = parseInt(argv[++i], 10) || 200;
    else if (v === '--help' || v === '-h') { a.help = true; }
  }
  return a;
}

// Parse a Prisma-style "sqlserver://host:port;database=..;user=..;password=..;encrypt=.."
function parseSqlServerUrl(url) {
  if (!url) return null;
  const m = url.match(/^sqlserver:\/\/([^:;]+)(?::(\d+))?(.*)$/i);
  if (!m) return null;
  const cfg = { server: m[1], port: m[2] ? parseInt(m[2], 10) : 1433, options: {} };
  const rest = (m[3] || '').replace(/^;/, '');
  for (const part of rest.split(';')) {
    if (!part) continue;
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (key === 'database') cfg.database = val;
    else if (key === 'user' || key === 'username') cfg.user = val;
    else if (key === 'password') cfg.password = val;
    else if (key === 'encrypt') cfg.options.encrypt = /^(true|yes|1)$/i.test(val);
    else if (key === 'trustservercertificate') cfg.options.trustServerCertificate = /^(true|yes|1)$/i.test(val);
  }
  return cfg;
}

// Fallback = Guardian staging (per .env.staging)
const STAGING_FALLBACK = {
  server: 'guardian-dev-db.database.windows.net',
  port: 1433,
  database: 'GUARDIAN-DEV',
  user: 'GUARDIAN',
  password: 'Sh13ldlyt1c$',
  options: { encrypt: true, trustServerCertificate: false },
};

// ---------------------------------------------------------------------------
// Type mapping: SQL Server -> PostgreSQL
// ---------------------------------------------------------------------------
function mapType(col) {
  const t = col.dataType.toLowerCase();
  switch (t) {
    case 'bit': return 'boolean';
    case 'tinyint': return 'smallint';
    case 'smallint': return 'smallint';
    case 'int': return 'integer';
    case 'bigint': return 'bigint';
    case 'real': return 'real';
    case 'float': return 'double precision';
    case 'money': return 'numeric(19,4)';
    case 'smallmoney': return 'numeric(10,4)';
    case 'decimal':
    case 'numeric': return `numeric(${col.precision},${col.scale})`;
    case 'char':
    case 'nchar': return col.charLen === -1 ? 'text' : `char(${col.charLen})`;
    case 'varchar':
    case 'nvarchar': return col.charLen === -1 ? 'text' : `varchar(${col.charLen})`;
    case 'text':
    case 'ntext': return 'text';
    case 'date': return 'date';
    case 'time': return 'time';
    case 'datetime':
    case 'datetime2':
    case 'smalldatetime': return 'timestamp';
    case 'datetimeoffset': return 'timestamptz';
    case 'uniqueidentifier': return 'uuid';
    case 'binary':
    case 'varbinary':
    case 'image': return 'bytea';
    case 'xml': return 'xml';
    default: return 'text'; // safe fallback
  }
}

// Postgres `timestamp` accepts at most 6 fractional-second digits; SQL Server
// datetime2 literals can carry 7. Truncate to 6 so the literal stays valid.
function clampFractionalSeconds(s) {
  return s.replace(/(\.\d{6})\d+/, '$1');
}

// Convert a SQL Server column DEFAULT definition to Postgres.
function mapDefault(rawDef, pgType) {
  if (rawDef == null) return null;
  let d = rawDef.trim();
  // strip wrapping parens, possibly doubled: ((0)) , (getdate())
  while (d.startsWith('(') && d.endsWith(')')) {
    // make sure the parens are balanced wrappers, not part of a call
    const inner = d.slice(1, -1);
    let depth = 0, ok = true;
    for (const ch of inner) { if (ch === '(') depth++; else if (ch === ')') { depth--; if (depth < 0) { ok = false; break; } } }
    if (!ok || depth !== 0) break;
    d = inner.trim();
  }
  const low = d.toLowerCase();
  if (low === 'getdate()' || low === 'sysdatetime()' || low === 'current_timestamp') return 'now()';
  if (low === 'getutcdate()' || low === 'sysutcdatetime()') return "timezone('utc'::text, now())";
  if (low === 'newid()' || low === 'newsequentialid()') return 'gen_random_uuid()';
  // CONVERT([type],'literal') / CAST('literal' AS type) -> the literal itself
  // (common in SQL Server temporal-table SysEndTime defaults).
  const conv = d.match(/^(?:convert|cast)\s*\(.*?'([^']*)'.*\)$/i);
  if (conv) return `'${clampFractionalSeconds(conv[1])}'`;
  if (pgType === 'boolean') {
    if (d === '0' || low === "'0'") return 'false';
    if (d === '1' || low === "'1'") return 'true';
  }
  // numeric / string literals pass through unchanged
  return d;
}

// Translate a SQL Server CHECK definition to Postgres:
//   [COL]='V' -> "COL"='V', remap SQL Server-only functions, and rewrite
//   integer comparisons on bit->boolean columns ("FLAG"=(1) -> "FLAG" = true).
function mapCheck(def, booleanCols) {
  let d = def.replace(/\[/g, '"').replace(/\]/g, '"');
  d = d.replace(/\blen\s*\(/gi, 'length(');              // LEN -> length
  d = d.replace(/\bdatalength\s*\(/gi, 'octet_length('); // DATALENGTH -> octet_length
  d = d.replace(/\bisnull\s*\(/gi, 'coalesce(');         // ISNULL -> coalesce
  d = d.replace(/\bgetdate\s*\(\s*\)/gi, 'now()');       // GETDATE() -> now()
  for (const name of (booleanCols || [])) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`("${esc}")\\s*=\\s*\\(?\\s*(\\d+)\\s*\\)?`, 'g');
    d = d.replace(re, (_m, col, num) => `${col} = ${num === '0' ? 'false' : 'true'}`);
  }
  return d;
}

const qid = (id) => '"' + id.replace(/"/g, '""') + '"';
const qual = (schema, name) => `${qid(schema)}.${qid(name)}`;

// ---------------------------------------------------------------------------
// Introspection
// ---------------------------------------------------------------------------
async function introspect(pool, schema) {
  // Tables
  const tablesRs = await pool.request().input('s', sql.NVarChar, schema).query(`
    SELECT t.object_id, t.name
    FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = @s
    ORDER BY t.name`);
  const tables = tablesRs.recordset.map(r => ({ objectId: r.object_id, name: r.name }));

  // Columns (+ identity + default + computed/period detection)
  const colsRs = await pool.request().input('s', sql.NVarChar, schema).query(`
    SELECT c.object_id, c.column_id, c.name AS col_name,
           ty.name AS data_type, c.max_length, c.precision, c.scale,
           c.is_nullable, c.is_identity, c.is_computed,
           c.generated_always_type, c.is_hidden,
           ic.seed_value, ic.increment_value,
           dc.definition AS default_def
    FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    JOIN sys.types ty ON c.user_type_id = ty.user_type_id
    LEFT JOIN sys.identity_columns ic ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
    WHERE s.name = @s
    ORDER BY c.object_id, c.column_id`);

  const colsByTable = new Map();
  for (const r of colsRs.recordset) {
    let charLen = null;
    const t = r.data_type.toLowerCase();
    if (['nchar', 'nvarchar'].includes(t)) charLen = r.max_length === -1 ? -1 : r.max_length / 2;
    else if (['char', 'varchar', 'binary', 'varbinary'].includes(t)) charLen = r.max_length === -1 ? -1 : r.max_length;
    const col = {
      name: r.col_name,
      dataType: r.data_type,
      charLen,
      precision: r.precision,
      scale: r.scale,
      nullable: !!r.is_nullable,
      isIdentity: !!r.is_identity,
      isComputed: !!r.is_computed,
      // generated_always_type: 1=ROW START, 2=ROW END (temporal period columns)
      periodCol: r.generated_always_type && r.generated_always_type !== 0,
      seed: r.seed_value,
      increment: r.increment_value,
      defaultDef: r.default_def,
    };
    if (!colsByTable.has(r.object_id)) colsByTable.set(r.object_id, []);
    colsByTable.get(r.object_id).push(col);
  }

  // Primary keys + unique constraints (via indexes)
  const idxRs = await pool.request().input('s', sql.NVarChar, schema).query(`
    SELECT i.object_id, i.name AS index_name, i.is_primary_key, i.is_unique_constraint,
           i.is_unique, i.type AS index_type,
           c.name AS col_name, ic.key_ordinal, ic.is_descending_key, ic.is_included_column
    FROM sys.indexes i
    JOIN sys.tables t ON i.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE s.name = @s AND i.type > 0
    ORDER BY i.object_id, i.index_id, ic.key_ordinal`);

  const pkByTable = new Map();      // objectId -> { name, cols: [] }
  const uniqueByTable = new Map();  // objectId -> [ { name, cols: [] } ]
  const indexByTable = new Map();   // objectId -> [ { name, unique, cols:[{col,desc}], included:[] } ]
  const idxAccum = new Map();       // key objectId|indexName -> record
  for (const r of idxRs.recordset) {
    const key = r.object_id + '|' + r.index_name;
    if (!idxAccum.has(key)) {
      idxAccum.set(key, {
        objectId: r.object_id, name: r.index_name,
        isPk: !!r.is_primary_key, isUniqueConstraint: !!r.is_unique_constraint,
        isUnique: !!r.is_unique, cols: [], included: [],
      });
    }
    const rec = idxAccum.get(key);
    if (r.is_included_column) rec.included.push(r.col_name);
    else rec.cols.push({ col: r.col_name, desc: !!r.is_descending_key });
  }
  for (const rec of idxAccum.values()) {
    if (rec.isPk) {
      pkByTable.set(rec.objectId, { name: rec.name, cols: rec.cols.map(c => c.col) });
    } else if (rec.isUniqueConstraint) {
      if (!uniqueByTable.has(rec.objectId)) uniqueByTable.set(rec.objectId, []);
      uniqueByTable.get(rec.objectId).push({ name: rec.name, cols: rec.cols.map(c => c.col) });
    } else {
      if (!indexByTable.has(rec.objectId)) indexByTable.set(rec.objectId, []);
      indexByTable.get(rec.objectId).push(rec);
    }
  }

  // Check constraints
  const ckRs = await pool.request().input('s', sql.NVarChar, schema).query(`
    SELECT cc.parent_object_id AS object_id, cc.name, cc.definition
    FROM sys.check_constraints cc
    JOIN sys.tables t ON cc.parent_object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = @s`);
  const checkByTable = new Map();
  for (const r of ckRs.recordset) {
    if (!checkByTable.has(r.object_id)) checkByTable.set(r.object_id, []);
    checkByTable.get(r.object_id).push({ name: r.name, def: r.definition });
  }

  // Foreign keys
  const fkRs = await pool.request().input('s', sql.NVarChar, schema).query(`
    SELECT fk.name AS fk_name, fk.parent_object_id, fk.referenced_object_id,
           ps.name AS parent_schema, pt.name AS parent_table,
           rs.name AS ref_schema, rt.name AS ref_table,
           pc.name AS parent_col, rc.name AS ref_col, fkc.constraint_column_id,
           fk.delete_referential_action, fk.update_referential_action
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
    JOIN sys.tables pt ON fk.parent_object_id = pt.object_id
    JOIN sys.schemas ps ON pt.schema_id = ps.schema_id
    JOIN sys.tables rt ON fk.referenced_object_id = rt.object_id
    JOIN sys.schemas rs ON rt.schema_id = rs.schema_id
    JOIN sys.columns pc ON fkc.parent_object_id = pc.object_id AND fkc.parent_column_id = pc.column_id
    JOIN sys.columns rc ON fkc.referenced_object_id = rc.object_id AND fkc.referenced_column_id = rc.column_id
    WHERE ps.name = @s
    ORDER BY fk.name, fkc.constraint_column_id`);
  const fkAccum = new Map();
  for (const r of fkRs.recordset) {
    if (!fkAccum.has(r.fk_name)) {
      fkAccum.set(r.fk_name, {
        name: r.fk_name, parentObjectId: r.parent_object_id, refObjectId: r.referenced_object_id,
        parentSchema: r.parent_schema, parentTable: r.parent_table,
        refSchema: r.ref_schema, refTable: r.ref_table,
        parentCols: [], refCols: [],
        onDelete: r.delete_referential_action, onUpdate: r.update_referential_action,
      });
    }
    const rec = fkAccum.get(r.fk_name);
    rec.parentCols.push(r.parent_col);
    rec.refCols.push(r.ref_col);
  }
  const fks = [...fkAccum.values()];

  return { tables, colsByTable, pkByTable, uniqueByTable, indexByTable, checkByTable, fks };
}

// Topological sort of tables by FK dependency (referenced tables first).
function topoSort(tables, fks) {
  const byId = new Map(tables.map(t => [t.objectId, t]));
  const deps = new Map(tables.map(t => [t.objectId, new Set()]));
  for (const fk of fks) {
    if (byId.has(fk.parentObjectId) && byId.has(fk.refObjectId) && fk.parentObjectId !== fk.refObjectId) {
      deps.get(fk.parentObjectId).add(fk.refObjectId);
    }
  }
  const ordered = [], visited = new Set(), temp = new Set();
  const visit = (id) => {
    if (visited.has(id)) return;
    if (temp.has(id)) return; // cycle: bail, deferred constraints handle it
    temp.add(id);
    for (const d of deps.get(id)) visit(d);
    temp.delete(id);
    visited.add(id);
    ordered.push(byId.get(id));
  };
  for (const t of tables) visit(t.objectId);
  return ordered;
}

const FK_ACTION = { 0: 'NO ACTION', 1: 'CASCADE', 2: 'SET NULL', 3: 'SET DEFAULT' };

// ---------------------------------------------------------------------------
// Schema emission
// ---------------------------------------------------------------------------
function emitSchema(meta, schema) {
  const { tables, colsByTable, pkByTable, uniqueByTable, indexByTable, checkByTable, fks } = meta;
  const out = [];
  out.push('-- =====================================================================');
  out.push('-- Guardian MVP — PostgreSQL schema (generated from SQL Server)');
  out.push(`-- Source schema: ${schema}    Tables: ${tables.length}`);
  out.push('-- Generated by scripts/mssql-to-postgres.cjs');
  out.push('-- =====================================================================');
  out.push('');
  out.push('CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()');
  out.push(`CREATE SCHEMA IF NOT EXISTS ${qid(schema)};`);
  out.push('');

  for (const t of tables) {
    const cols = colsByTable.get(t.objectId) || [];
    out.push(`-- ${'-'.repeat(60)}`);
    out.push(`-- ${schema}.${t.name}`);
    out.push(`CREATE TABLE ${qual(schema, t.name)} (`);
    const lines = [];
    for (const c of cols) {
      const pgType = mapType(c);
      let line = `  ${qid(c.name)} ${pgType}`;
      if (c.isIdentity) {
        const seed = c.seed != null ? Number(c.seed) : 1;
        const inc = c.increment != null ? Number(c.increment) : 1;
        line += ` GENERATED BY DEFAULT AS IDENTITY (START WITH ${seed} INCREMENT BY ${inc})`;
      } else {
        const def = mapDefault(c.defaultDef, pgType);
        if (def != null) line += ` DEFAULT ${def}`;
      }
      line += c.nullable ? ' NULL' : ' NOT NULL';
      lines.push(line);
    }
    const pk = pkByTable.get(t.objectId);
    if (pk) lines.push(`  CONSTRAINT ${qid(pk.name)} PRIMARY KEY (${pk.cols.map(qid).join(', ')})`);
    for (const u of (uniqueByTable.get(t.objectId) || [])) {
      lines.push(`  CONSTRAINT ${qid(u.name)} UNIQUE (${u.cols.map(qid).join(', ')})`);
    }
    const booleanCols = cols.filter(c => mapType(c) === 'boolean').map(c => c.name);
    for (const ck of (checkByTable.get(t.objectId) || [])) {
      lines.push(`  CONSTRAINT ${qid(ck.name)} CHECK (${mapCheck(ck.def, booleanCols)})`);
    }
    out.push(lines.join(',\n'));
    out.push(');');
    // non-PK / non-unique-constraint indexes
    for (const idx of (indexByTable.get(t.objectId) || [])) {
      const uniq = idx.isUnique ? 'UNIQUE ' : '';
      const colList = idx.cols.map(c => `${qid(c.col)}${c.desc ? ' DESC' : ''}`).join(', ');
      const incl = idx.included.length ? ` INCLUDE (${idx.included.map(qid).join(', ')})` : '';
      out.push(`CREATE ${uniq}INDEX ${qid(idx.name)} ON ${qual(schema, t.name)} (${colList})${incl};`);
    }
    out.push('');
  }

  // Foreign keys (deferrable so the seed can load in one transaction)
  out.push('-- ---------------------------------------------------------------------');
  out.push('-- Foreign keys (DEFERRABLE INITIALLY DEFERRED for bulk seed loads)');
  out.push('-- ---------------------------------------------------------------------');
  for (const fk of fks) {
    const onDel = FK_ACTION[fk.onDelete] || 'NO ACTION';
    const onUpd = FK_ACTION[fk.onUpdate] || 'NO ACTION';
    out.push(
      `ALTER TABLE ${qual(fk.parentSchema, fk.parentTable)} ADD CONSTRAINT ${qid(fk.name)} ` +
      `FOREIGN KEY (${fk.parentCols.map(qid).join(', ')}) ` +
      `REFERENCES ${qual(fk.refSchema, fk.refTable)} (${fk.refCols.map(qid).join(', ')}) ` +
      `ON DELETE ${onDel} ON UPDATE ${onUpd} DEFERRABLE INITIALLY DEFERRED;`
    );
  }
  out.push('');
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Value formatting for data dump
// ---------------------------------------------------------------------------
function pad(n) { return String(n).padStart(2, '0'); }
function fmtTimestamp(d) {
  // emit in UTC, microsecond precision; Postgres `timestamp` ignores the zone
  const ms = String(d.getUTCMilliseconds()).padStart(3, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
         `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${ms}`;
}

function formatValue(val, col, pgType) {
  if (val === null || val === undefined) return 'NULL';
  if (pgType === 'boolean') {
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    return (val === 1 || val === '1' || /^true$/i.test(val)) ? 'TRUE' : 'FALSE';
  }
  if (Buffer.isBuffer(val)) return `decode('${val.toString('hex')}', 'hex')`;
  if (val instanceof Date) return `'${fmtTimestamp(val)}'`;
  if (pgType === 'uuid') return `'${String(val)}'`;
  if (['smallint', 'integer', 'bigint', 'real', 'double precision'].includes(pgType) ||
      pgType.startsWith('numeric')) {
    // numerics may arrive as string (bigint/decimal) — emit raw if it looks numeric
    if (typeof val === 'number') return String(val);
    const s = String(val);
    return /^-?\d+(\.\d+)?$/.test(s) ? s : `'${s.replace(/'/g, "''")}'`;
  }
  // strings, text, xml, json, char — single-quote escape ('' ); backslashes are
  // literal under standard_conforming_strings (Postgres default).
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function emitSeed(pool, meta, schema, opts, write) {
  const { tables, colsByTable, fks } = meta;
  const ordered = topoSort(tables, fks);

  write('-- =====================================================================');
  write('-- Guardian MVP — PostgreSQL data seed (full clone)');
  write('-- ⚠️  Contains real PII / password hashes. Do not commit. Handle as secret.');
  write('-- Load AFTER 01_schema.sql.');
  write('-- =====================================================================');
  write('');
  write('BEGIN;');
  write('SET CONSTRAINTS ALL DEFERRED;');
  write('');

  const identityCols = []; // {schema, table, col, seed}

  for (const t of ordered) {
    const cols = (colsByTable.get(t.objectId) || []).filter(c => !c.periodCol); // skip temporal period cols
    if (cols.length === 0) continue;
    const pgTypes = cols.map(c => mapType(c));
    cols.forEach((c, i) => { if (c.isIdentity) identityCols.push({ table: t.name, col: c.name, seed: c.seed != null ? Number(c.seed) : 1 }); });

    const colNameList = cols.map(c => qid(c.name)).join(', ');
    const reader = new sql.Request(pool);
    reader.stream = true;
    const selectCols = cols.map(c => `[${c.name}]`).join(', ');
    reader.query(`SELECT ${selectCols} FROM ${qid(schema)}.[${t.name}]`);

    let buffer = [];
    let rowCount = 0;
    let wroteHeader = false;

    const flush = () => {
      if (buffer.length === 0) return;
      write(`INSERT INTO ${qual(schema, t.name)} (${colNameList}) VALUES`);
      write(buffer.join(',\n') + ';');
      buffer = [];
    };

    await new Promise((resolve, reject) => {
      reader.on('row', (row) => {
        if (!wroteHeader) { write(`-- ${schema}.${t.name}`); wroteHeader = true; }
        const vals = cols.map((c, i) => formatValue(row[c.name], c, pgTypes[i]));
        buffer.push(`  (${vals.join(', ')})`);
        rowCount++;
        if (buffer.length >= opts.batch) flush();
      });
      reader.on('error', reject);
      reader.on('done', () => { flush(); resolve(); });
    });

    if (wroteHeader) { write(''); }
    process.stderr.write(`  ${schema}.${t.name}: ${rowCount} rows\n`);
  }

  // Resync identity sequences to MAX(col)
  write('-- ---------------------------------------------------------------------');
  write('-- Resync identity sequences to current max values');
  write('-- ---------------------------------------------------------------------');
  for (const ic of identityCols) {
    const tbl = qual(schema, ic.table);
    // pg_get_serial_sequence lower-cases its first arg unless identifiers are
    // double-quoted within the string; the column arg is already case-preserved.
    const seqArg = `pg_get_serial_sequence('"${schema}"."${ic.table}"', '${ic.col}')`;
    // Rows present: setval to MAX (is_called=true) -> next = MAX+1.
    // Empty table: setval to the identity start value with is_called=false
    // -> next = start value (avoids "0 out of bounds" on empty tables).
    write(
      `SELECT setval(${seqArg}, ` +
      `COALESCE((SELECT MAX(${qid(ic.col)}) FROM ${tbl}), ${ic.seed}), ` +
      `(SELECT MAX(${qid(ic.col)}) FROM ${tbl}) IS NOT NULL) ` +
      `WHERE ${seqArg} IS NOT NULL;`
    );
  }
  write('');
  write('COMMIT;');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 40).join('\n')); return; }

  const cfgBase = parseSqlServerUrl(process.env.DATABASE_URL) || STAGING_FALLBACK;
  const cfg = { ...cfgBase, connectionTimeout: 30000, requestTimeout: 0, options: { ...cfgBase.options }, pool: { max: 4 } };

  fs.mkdirSync(args.out, { recursive: true });
  const schemaPath = path.join(args.out, '01_schema.sql');
  const seedPath = path.join(args.out, '02_seed.sql');

  process.stderr.write(`Connecting to ${cfg.server}/${cfg.database} (schema ${args.schema})...\n`);
  const pool = await sql.connect(cfg);
  try {
    const meta = await introspect(pool, args.schema);
    process.stderr.write(`Introspected ${meta.tables.length} tables, ${meta.fks.length} FKs.\n`);

    fs.writeFileSync(schemaPath, emitSchema(meta, args.schema));
    process.stderr.write(`Wrote ${schemaPath}\n`);

    if (!args.schemaOnly) {
      const fd = fs.openSync(seedPath, 'w');
      const write = (line) => fs.writeSync(fd, line + '\n');
      await emitSeed(pool, meta, args.schema, args, write);
      fs.closeSync(fd);
      process.stderr.write(`Wrote ${seedPath}\n`);
    }
  } finally {
    await pool.close();
  }
  process.stderr.write('Done.\n');
}

main().catch((e) => { console.error('ERROR:', e.message); console.error(e.stack); process.exit(1); });
