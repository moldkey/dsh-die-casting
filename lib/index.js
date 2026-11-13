/**
 * dsh-die-casting — 压铸件 DFM 与缺陷排查
 */

export const name = "dsh-die-casting";
export const inject = ["tools"];

const NL = String.fromCharCode(10);
const SITE = "https://deepseekbase.com/zh/tools/";
const TEXT_OUTPUT = {
  schema: { type: "object", additionalProperties: false, properties: { text: { type: "string" } }, required: ["text"] },
  render: (_args, value) => [{ type: "text", text: (value && value.text) || "" }],
};

const MATS = {
  adc12: { name: "ADC12 铝合金", density: 2.7, minWall: 1.0, shrink: 0.5 },
  a380: { name: "A380 铝合金", density: 2.7, minWall: 1.0, shrink: 0.5 },
  za3: { name: "ZA3 锌合金", density: 6.6, minWall: 0.6, shrink: 0.6 },
  az91: { name: "AZ91 镁合金", density: 1.8, minWall: 1.0, shrink: 0.6 },
};

const DEFECTS = {
  porosity: ["气孔", "压射速度过高、排气不良、涂料过多、卷气", "降低高速切换点、加排气、减少喷涂、优化浇口"],
  coldshut: ["冷隔", "模温低、压射慢、壁厚过薄", "提高模温、加快压射、增厚"],
  flash: ["飞边", "锁模力不足、分型面磨损、压射比压过高", "提高锁模力、修模、降比压"],
  soldering: ["粘模", "模温过高、涂料不足、铝合金亲和", "降模温、补喷涂、表面处理"],
  shrinkage: ["缩陷", "壁厚不均、补缩不足、模温不均", "均匀壁厚、加溢流、调模温"],
};

function n(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }
function f(x) { return (Math.round(x * 100) / 100).toString(); }

const TOOLS = {
  die_casting_dfm: {
    description: "压铸 DFM：按材料、壁厚、脱模角、投影面积检查并估算锁模力吨位",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        material: { type: "string", enum: ["adc12", "a380", "za3", "az91"], description: "压铸材料" },
        wall: { type: "number", description: "主壁厚 mm" },
        draft_deg: { type: "number", description: "脱模角（度）" },
        projected_area_cm2: { type: "number", description: "投影面积 cm²（可选，算锁模力）" },
      },
      required: ["material", "wall"],
    },
    run(args) {
      const m = MATS[String(args.material || "").toLowerCase()];
      if (!m) throw new Error("材料支持: adc12 / a380 / za3 / az91");
      const T = n(args.wall, 0);
      if (T <= 0) throw new Error("壁厚必须大于 0");
      const lines = ["压铸 DFM 检查", "=".repeat(52), "材料: " + m.name, "壁厚: " + f(T) + " mm", ""];
      let pass = true;
      const rule = (name, ok, detail) => { if (!ok) pass = false; lines.push((ok ? "PASS " : "FAIL ") + name + " — " + detail); };
      rule("壁厚 ≥ 材料下限", T >= m.minWall, "下限 " + m.minWall + " mm");
      if (args.draft_deg != null) {
        rule("脱模角 ≥ 1°", n(args.draft_deg, 0) >= 1, "实际 " + f(n(args.draft_deg, 0)) + "°（深腔建议 2–3°）");
      }
      if (args.projected_area_cm2 != null) {
        const A = n(args.projected_area_cm2, 0);
        const pressure = 600; // bar 经验比压
        const forceKN = (A * pressure) / 1000;
        const tonnage = Math.ceil(forceKN * 1.2 / 10) * 10;
        lines.push("投影面积: " + f(A) + " cm²");
        lines.push("估算锁模力: " + Math.round(forceKN) + " kN ≈ " + tonnage + " 吨（含 20% 余量）");
      }
      lines.push("");
      lines.push(pass ? "结论：按给定规则可压铸" : "结论：存在风险，建议调整");
      lines.push("比压 600 bar 为经验值，实际按材料、结构与设备调整。");
      lines.push("");
      lines.push("更多工具：" + SITE);
      return lines.join(NL);
    },
  },
  die_casting_defect: {
    description: "压铸缺陷排查：按缺陷给原因与对策",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { defect: { type: "string", enum: ["porosity", "coldshut", "flash", "soldering", "shrinkage"], description: "缺陷" } },
      required: ["defect"],
    },
    run(args) {
      const d = DEFECTS[String(args.defect || "").toLowerCase()];
      if (!d) throw new Error("支持: " + Object.keys(DEFECTS).join(" / "));
      return ["压铸缺陷排查", "=".repeat(52), "缺陷: " + d[0], "", "原因: " + d[1], "对策: " + d[2], "", "更多工具：" + SITE].join(NL);
    },
  },
};

export function apply(ctx, config) {
  void config;
  for (const name of Object.keys(TOOLS)) {
    const t = TOOLS[name];
    ctx.tools.register({
      name: name,
      description: t.description,
      parameters: t.parameters,
      output: TEXT_OUTPUT,
      async execute(args) { try { return { text: t.run(args || {}) }; } catch (e) { return { text: "处理失败: " + String((e && e.message) || e) }; } },
    });
  }
}
