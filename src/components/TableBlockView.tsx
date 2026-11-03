"use client";

import React from "react";
import {
  Plus,
  Trash2,
  Tag,
  Type,
  CheckCircle2,
  Database,
  ChevronDown,
} from "lucide-react";
import {
  STATUS_OPTIONS,
  type BlockProps,
  type TableColumn,
  type TableRow,
} from "@/types/notez";

interface TableBlockViewProps {
  props: BlockProps;
  caption?: string;
  onUpdateProps: (nextProps: BlockProps) => void;
}

const DEFAULT_COLUMNS: TableColumn[] = [
  { id: "col_1", name: "Item", type: "text" },
  { id: "col_2", name: "Status", type: "status" },
  { id: "col_3", name: "Category", type: "tag" },
];

const DEFAULT_ROWS: TableRow[] = [
  {
    id: "row_1",
    cells: { col_1: "First milestone", col_2: "In Progress", col_3: "Core" },
  },
  {
    id: "row_2",
    cells: { col_1: "Second milestone", col_2: "Planned", col_3: "Design" },
  },
];

export function TableBlockView({
  props,
  caption,
  onUpdateProps,
}: TableBlockViewProps) {
  const columns =
    props.columns && props.columns.length > 0 ? props.columns : DEFAULT_COLUMNS;
  const rows = props.rows && props.rows.length > 0 ? props.rows : DEFAULT_ROWS;

  const commit = (nextColumns: TableColumn[], nextRows: TableRow[]) => {
    onUpdateProps({ ...props, columns: nextColumns, rows: nextRows });
  };

  const handleColumnNameChange = (colId: string, name: string) => {
    commit(
      columns.map((c) => (c.id === colId ? { ...c, name } : c)),
      rows
    );
  };

  const handleCycleColumnType = (colId: string) => {
    const order: Array<"text" | "status" | "tag"> = ["text", "status", "tag"];
    commit(
      columns.map((c) =>
        c.id === colId
          ? { ...c, type: order[(order.indexOf(c.type) + 1) % order.length] }
          : c
      ),
      rows
    );
  };

  const handleAddColumn = () => {
    commit(
      [
        ...columns,
        { id: `col_${Date.now().toString(36)}`, name: "Notes", type: "text" },
      ],
      rows
    );
  };

  const handleDeleteColumn = (colId: string) => {
    if (columns.length <= 1) return;
    commit(
      columns.filter((c) => c.id !== colId),
      rows
    );
  };

  const handleCellChange = (rowId: string, colId: string, value: string) => {
    commit(
      columns,
      rows.map((r) =>
        r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r
      )
    );
  };

  const handleCycleStatus = (rowId: string, colId: string, current: string) => {
    const idx = STATUS_OPTIONS.findIndex((s) => s.label === current);
    const next = STATUS_OPTIONS[(idx + 1) % STATUS_OPTIONS.length].label;
    handleCellChange(rowId, colId, next);
  };

  const handleAddRow = () => {
    const defaultCells: Record<string, string> = {};
    for (const col of columns) {
      defaultCells[col.id] = col.type === "status" ? "Planned" : "";
    }
    commit(columns, [
      ...rows,
      { id: `row_${Date.now().toString(36)}`, cells: defaultCells },
    ]);
  };

  const handleDeleteRow = (rowId: string) => {
    if (rows.length <= 1) {
      const cleared: Record<string, string> = {};
      for (const col of columns) cleared[col.id] = "";
      commit(columns, [{ id: rows[0].id, cells: cleared }]);
      return;
    }
    commit(
      columns,
      rows.filter((r) => r.id !== rowId)
    );
  };

  const getStatusClass = (val: string) =>
    STATUS_OPTIONS.find((s) => s.label === val)?.bg ||
    "bg-stone-200/75 text-stone-700 dark:bg-stone-700/60 dark:text-stone-200";

  return (
    <div
      className="notez-card my-3 overflow-hidden shadow-[var(--shadow-sm)]"
      style={{ borderRadius: 18 }}
    >
      {/* Database Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/60 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
            <Database className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-semibold text-[var(--text-primary)]">
              {caption?.trim() || "Inline Database"}
            </div>
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Table · {rows.length} {rows.length === 1 ? "row" : "rows"}
            </div>
          </div>
        </div>
        <span className="notez-pill hidden sm:inline-flex">Editable</span>
      </div>

      <div className="notez-scroll overflow-x-auto">
        <table className="w-full min-w-[540px] border-collapse text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/70">
              <th className="w-9 border-r border-[var(--border-subtle)] px-2 py-2 text-center text-[10px] font-semibold text-[var(--text-faint)]">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className="group/col relative border-r border-[var(--border-subtle)] px-3 py-2 font-medium text-[var(--text-muted)] last:border-r-0"
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCycleColumnType(col.id)}
                      title={`Column type: ${col.type} — click to switch`}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      {col.type === "status" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500" />
                      ) : col.type === "tag" ? (
                        <Tag className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <Type className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <input
                      type="text"
                      value={col.name}
                      onChange={(e) =>
                        handleColumnNameChange(col.id, e.target.value)
                      }
                      placeholder="Column"
                      className="w-full min-w-[70px] bg-transparent text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)] focus:text-[var(--text-primary)] focus:outline-none"
                    />
                    {columns.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn(col.id)}
                        title="Delete column"
                        className="opacity-0 rounded p-0.5 text-[var(--text-muted)] hover:text-rose-500 group-hover/col:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="w-9 px-1.5 py-2 text-center">
                <button
                  type="button"
                  onClick={handleAddColumn}
                  title="Add column"
                  className="notez-icon-btn h-6 w-6"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={row.id}
                className="group/row border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-sidebar)]/40 transition-colors"
              >
                <td className="border-r border-[var(--border-subtle)] px-2 py-2 text-center font-editorial-mono text-[10px] text-[var(--text-faint)]">
                  {rowIndex + 1}
                </td>

                {columns.map((col) => {
                  const cellVal = row.cells?.[col.id] ?? "";

                  return (
                    <td
                      key={col.id}
                      className="border-r border-[var(--border-subtle)] px-3 py-2 align-middle last:border-r-0"
                    >
                      {col.type === "status" ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleCycleStatus(
                              row.id,
                              col.id,
                              cellVal || "Planned"
                            )
                          }
                          title="Click to cycle status"
                          className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-transform active:scale-95 ${getStatusClass(
                            cellVal || "Planned"
                          )}`}
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
                          <span className="truncate">{cellVal || "Planned"}</span>
                          <ChevronDown className="h-3 w-3 shrink-0 opacity-45" />
                        </button>
                      ) : col.type === "tag" ? (
                        <input
                          type="text"
                          value={cellVal}
                          onChange={(e) =>
                            handleCellChange(row.id, col.id, e.target.value)
                          }
                          placeholder="Add tag…"
                          className={`w-full max-w-[150px] rounded-md px-2 py-1 text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25 ${
                            cellVal
                              ? "bg-indigo-500/10 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300"
                              : "bg-transparent text-[var(--text-muted)]"
                          }`}
                        />
                      ) : (
                        <input
                          type="text"
                          value={cellVal}
                          onChange={(e) =>
                            handleCellChange(row.id, col.id, e.target.value)
                          }
                          placeholder="Empty"
                          className="w-full bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)]/60 focus:outline-none"
                        />
                      )}
                    </td>
                  );
                })}

                <td className="w-9 px-1.5 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => handleDeleteRow(row.id)}
                    title="Remove row"
                    className="opacity-0 inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-rose-500/10 hover:text-rose-500 group-hover/row:opacity-100 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={handleAddRow}
        className="flex w-full items-center gap-1.5 border-t border-[var(--border-subtle)] px-3.5 py-2 text-[11.5px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)]/70 hover:text-[var(--text-primary)] transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>New row</span>
      </button>
    </div>
  );
}
