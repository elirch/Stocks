import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { embedText, extractText, isPng } from "@/lib/export/pngMeta";
import { toFile } from "@/lib/persistence/file";
import { importAnyFile } from "@/lib/persistence/importFile";
import { gridToHoldings, mapSector, mapType, parseCsv, readXlsx } from "@/lib/persistence/spreadsheet";
import { h, portfolio, testId } from "./fixtures";

// Smallest valid PNG (1×1 transparent pixel).
const TINY_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

describe("editable PNG", () => {
  it("round-trips a portfolio inside the image", () => {
    const d = portfolio([h("AAPL", "12000", { name: "Äpple ✓", sector: "technology" }), h("CASH", "50", { type: "cash" })], "ILS");
    const png = embedText(TINY_PNG, JSON.stringify(toFile(d)));
    expect(isPng(png)).toBe(true);
    expect(png.length).toBeGreaterThan(TINY_PNG.length);
    const res = importAnyFile("my-atlas.png", png, testId, 1000);
    expect(res.kind).toBe("portfolio");
    if (res.kind !== "portfolio") return;
    expect(res.from).toBe("image");
    expect(res.draft.currency).toBe("ILS");
    expect(res.draft.holdings.map((x) => [x.name, x.valueText])).toEqual([
      ["Äpple ✓", "12000"],
      ["", "50"],
    ]);
  });

  it("explains when an image has no saved holdings", () => {
    expect(extractText(TINY_PNG)).toBeNull();
    const res = importAnyFile("photo.png", TINY_PNG, testId, 1000);
    expect(res.kind === "error" && res.errors[0]).toMatch(/Editable copy/);
  });

  it("rejects tampered data inside an image", () => {
    const png = embedText(TINY_PNG, '{"format":"portfolio-atlas","version":1,"currency":"USD","holdings":[{"identifier":"A","name":"","value":-1}]}');
    expect(importAnyFile("x.png", png, testId, 1000).kind).toBe("error");
  });
});

describe("spreadsheets", () => {
  it("reads a broker-style CSV with header, currency symbols and a total row", () => {
    const csv = 'Symbol,Description,Quantity,Price,Market Value,Cost Basis,Sector\nAAPL,Apple Inc,10,190,"$1,900.00",1200,Information Technology\nVTI,Vanguard ETF,5,250,"$1,250.00",1000,\nTotal,,,,"$3,150.00",,\n';
    const res = gridToHoldings(parseCsv(csv), testId, 1000);
    expect(res.columns?.value).toBe("Market Value");
    expect(res.holdings.map((x) => [x.identifier, x.name, x.valueText, x.sector])).toEqual([
      ["AAPL", "Apple Inc", "1900", "technology"],
      ["VTI", "Vanguard ETF", "1250", null],
    ]);
    expect(res.skipped[0]!.reason).toMatch(/total row/);
  });

  it("never uses cost basis or price as the value column", () => {
    const res = gridToHoldings([["Ticker", "Cost basis", "Price", "Current value"], ["A", "1", "2", "300"]], testId, 10);
    expect(res.holdings[0]!.valueText).toBe("300");
  });

  it("reads Hebrew headers", () => {
    const res = gridToHoldings([["סימול", "שם נייר", "כמות", "שווי נוכחי"], ["TEVA", "טבע", "3", "₪4,500"]], testId, 10);
    expect(res.holdings[0]).toMatchObject({ identifier: "TEVA", name: "טבע", valueText: "4500" });
  });

  it("works without a header (identifier, name, value)", () => {
    const res = gridToHoldings([["AAPL", "Apple", "100"], ["CASH", "", "20"]], testId, 10);
    expect(res.holdings.map((x) => [x.identifier, x.valueText, x.type])).toEqual([
      ["AAPL", "100", "unknown"],
      ["CASH", "20", "cash"],
    ]);
  });

  it("reports negative and invalid values", () => {
    const res = gridToHoldings([["Ticker", "Value"], ["A", "-5"], ["B", "n/a"], ["C", "10"]], testId, 10);
    expect(res.holdings).toHaveLength(1);
    expect(res.skipped).toHaveLength(2);
  });

  it("maps types and sectors conservatively", () => {
    expect(mapType("ETF")).toBe("etf");
    expect(mapType("Mutual Fund")).toBe("mutual_fund");
    expect(mapType("Common Stock")).toBe("stock");
    expect(mapType("Money Market")).toBe("cash");
    expect(mapType("Warrant")).toBe("other");
    expect(mapSector("Health Care")).toBe("health_care");
    expect(mapSector("Healthcare")).toBe("health_care");
    expect(mapSector("Space mining")).toBeNull();
  });

  it("reads a real .xlsx structure (shared strings, numbers, inline strings, gaps)", () => {
    const xlsx = zipSync({
      "[Content_Types].xml": strToU8("<Types/>"),
      "xl/workbook.xml": strToU8('<workbook><sheets><sheet name="Holdings" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>'),
      "xl/sharedStrings.xml": strToU8("<sst><si><t>Ticker</t></si><si><t>Market Value</t></si><si><t>AT&amp;T</t></si><si><r><t>Micro</t></r><r><t>soft</t></r></si></sst>"),
      "xl/worksheets/sheet1.xml": strToU8(
        '<worksheet><sheetData>' +
          '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
          '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>1.5E+3</v></c></row>' +
          '<row r="3"><c r="A3" t="s"><v>3</v></c><c r="C3"><v>2500.25</v></c></row>' +
          '<row r="4"><c r="A4" t="inlineStr"><is><t>BND</t></is></c><c r="C4" t="str"><v>700</v></c></row>' +
        "</sheetData></worksheet>",
      ),
    });
    const grid = readXlsx(xlsx);
    expect(grid[1]).toEqual(["AT&T", "", "1500"]);
    const res = importAnyFile("export.xlsx", xlsx, testId, 1000);
    expect(res.kind).toBe("holdings");
    if (res.kind !== "holdings") return;
    expect(res.holdings.map((x) => [x.identifier, x.valueText])).toEqual([
      ["AT&T", "1500"],
      ["Microsoft", "2500.25"],
      ["BND", "700"],
    ]);
  });

  it("rejects corrupted and old-format Excel files", () => {
    expect(importAnyFile("x.xlsx", strToU8("not a zip"), testId, 10).kind).toBe("error");
    const old = importAnyFile("x.xls", strToU8("x"), testId, 10);
    expect(old.kind === "error" && old.errors[0]).toMatch(/\.xlsx or \.csv/);
  });
});
