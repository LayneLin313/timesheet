/* 工時記錄 — CubeLV WorkLogPlugin v325 (source-sha f85eef8c6bf288a7), ported to a standalone PWA.
 * Body = cubelv/source/WorkLogPlugin.bundle.pretty.js lines 390-2250, unchanged except:
 *   - P1 static block
 *   - P2 leave toggle
 *   - P3 pay toggle
 *   - P4 hint
 *   - P5 special a11y
 *   - P6 save enforce
 *   - P6b saved signature
 *   - P7 dirty hook
 *   - P7b discard hook
 *   - P7c expose discard
 * Removed: the market-data bridge prelude (lines 1-388) and the inline source map.
 * Needs window.require (app/sdk-shim.js) for "react", "react/jsx-runtime", "@cubelv/sdk". */
var __plugin__ = (() => {
  var Se = Object.defineProperty;
  var lt = Object.getOwnPropertyDescriptor;
  var bt = Object.getOwnPropertyNames;
  var vt = Object.prototype.hasOwnProperty;
  var a = (r, e) => Se(r, "name", {
      value: e,
      configurable: !0
    }),
    re = (r => typeof require < "u" ? require : typeof Proxy < "u" ? new Proxy(r, {
      get: (e, i) => (typeof require < "u" ? require : e)[i]
    }) : r)(function(r) {
      if (typeof require < "u") return require.apply(this, arguments);
      throw Error('Dynamic require of "' + r + '" is not supported')
    });
  var gt = (r, e) => {
      for (var i in e) Se(r, i, {
        get: e[i],
        enumerable: !0
      })
    },
    yt = (r, e, i, c) => {
      if (e && typeof e == "object" || typeof e == "function")
        for (let p of bt(e)) !vt.call(r, p) && p !== i && Se(r, p, {
          get: () => e[p],
          enumerable: !(c = lt(e, p)) || c.enumerable
        });
      return r
    };
  var xt = r => yt(Se({}, "__esModule", {
      value: !0
    }), r),
    Oe = (r, e, i, c) => {
      for (var p = c > 1 ? void 0 : c ? lt(e, i) : e, y = r.length - 1, b; y >= 0; y--)(b = r[y]) && (p = (c ? b(e, i, p) : b(p)) || p);
      return c && p && Se(e, i, p), p
    };
  var Ft = {};
  gt(Ft, {
    WorkLogPlugin: () => ce
  });
  var ye = re("@cubelv/sdk");
  var be = re("@cubelv/sdk");
  var se = class extends be.BaseItem {};
  a(se, "WorkLogFolder"), se = Oe([(0, be.itemType)("WORK_LOG_FOLDER", "\u5DE5\u6642\u8A18\u9304\u8CC7\u6599\u593E", {
    defaultFolder: "\u5DE5\u6642\u8A18\u9304"
  })], se);
  var ae = class extends be.BaseItem {
    date = "";
    clockIn = "";
    clockOut = "";
    breaks = [];
    workMinutes = 0;
    isLeave = !1;
    isSpecialLeave = !1;
    isOvertimePay = !1;
    note = ""
  };
  a(ae, "WorkLog"), ae = Oe([(0, be.itemType)("WORK_LOG", "\u6BCF\u65E5\u5DE5\u6642\u8A18\u9304")], ae);
  var o = re("react"),
    d = re("@cubelv/sdk");

  function it(r) {
    if (typeof r != "string") return null;
    let e = r.match(/^(\d{1,2}):(\d{2})$/);
    if (!e) return null;
    let i = Number(e[1]),
      c = Number(e[2]);
    return i < 0 || i > 23 || c < 0 || c > 59 ? null : i * 60 + c
  }
  a(it, "parseHM");

  function ct(r, e) {
    let i = it(r),
      c = it(e);
    if (i == null || c == null) return null;
    let p = c - i;
    return p < 0 && (p += 1440), p
  }
  a(ct, "spanMinutes");

  function ve(r, e, i) {
    let c = ct(r, e);
    if (c == null) return null;
    let p = 0;
    for (let y of i ?? []) {
      if (!y || !y.start && !y.end) continue;
      let b = ct(y.start, y.end);
      if (b == null) return null;
      p += b
    }
    return c - p
  }
  a(ve, "calcWorkMinutes");
  var J = 480;

  function Q(r) {
    return !r || r?.isSpecialLeave ? !1 : !!(r.isLeave && r.clockIn && r.clockOut)
  }
  a(Q, "isHolidayWorkLog");

  function Ce(r) {
    return r ? r?.isSpecialLeave ? !0 : r.isLeave ? !(r.clockIn && r.clockOut) : !1 : !1
  }
  a(Ce, "isPureRestLog");

  function Le(r) {
    return !!r?.isOvertimePay
  }
  a(Le, "isOvertimePayLog");

  function Be(r, e) {
    if (r == null) return 0;
    let i = Math.round(r);
    return e ? i > 0 ? i : 0 : i - J > 0 ? i - J : 0
  }
  a(Be, "overtimePayMinutes");

  function He(r, e, i = !1) {
    if (r == null || i) return 0;
    let c = Math.round(r);
    return e ? c > 0 ? c : 0 : c - J > 0 ? c - J : 0
  }
  a(He, "effectiveOvertime");

  function Ge(r, e) {
    if (r == null || e) return 0;
    let i = Math.round(r);
    return i - J < 0 ? -(i - J) : 0
  }
  a(Ge, "effectiveShortage");

  function Me(r, e, i = !1) {
    if (r == null) return "\u7121\u6CD5\u8A08\u7B97";
    if (i) {
      let c = Be(r, e);
      return c > 0 ? `\u52A0\u73ED\u8CBB ${w(c)} \u5C0F\u6642` : ut(r)
    }
    if (e) {
      let c = Math.round(r);
      return c > 0 ? `\u52A0\u73ED ${w(c)} \u5C0F\u6642` : ""
    }
    return ut(r)
  }
  a(Me, "effectiveDiffLabel");

  function Ye(r, e, i = !1) {
    if (r == null) return "text-muted-foreground";
    if (i) return Be(r, e) > 0 ? "text-chart-cherryRed" : Math.round(r) - J < 0 ? "text-chart-tangerineOrange" : "text-muted-foreground";
    if (e) return Math.round(r) > 0 ? "text-chart-cherryRed" : "text-muted-foreground";
    let c = Math.round(r) - J;
    return c > 0 ? "text-chart-cherryRed" : c < 0 ? "text-chart-tangerineOrange" : "text-muted-foreground"
  }
  a(Ye, "effectiveDiffColor");

  function w(r) {
    return Math.round(r / 60 * 100) / 100
  }
  a(w, "toHours");

  function ut(r) {
    if (r == null) return "\u7121\u6CD5\u8A08\u7B97";
    let e = Math.round(r) - J;
    return e > 0 ? `\u52A0\u73ED ${w(e)} \u5C0F\u6642` : e < 0 ? `\u88DC\u4F11 ${w(-e)} \u5C0F\u6642` : ""
  }
  a(ut, "diffLabel");
  var t = re("react/jsx-runtime"),
    ze = class extends d.View {
      getViewType() {
        return "work-log-list"
      }
      getDisplayText() {
        return "\u5DE5\u6642\u8A18\u9304"
      }
      renderComponent() {
        return (0, t.jsx)(At, {})
      }
    };

  function rt() {
    let r = new Date;
    return `${r.getFullYear()}-${String(r.getMonth()+1).padStart(2,"0")}`
  }
  a(rt, "currentMonth");

  function tt(r) {
    return r.length >= 7 ? r.slice(0, 7) : ""
  }
  a(tt, "monthOf");

  function ht() {
    let r = new Date;
    return `${r.getFullYear()}-${String(r.getMonth()+1).padStart(2,"0")}-${String(r.getDate()).padStart(2,"0")}`
  }
  a(ht, "todayYMD");

  function st() {
    return String(new Date().getFullYear())
  }
  a(st, "currentYear");

  function dt(r) {
    return r.length >= 4 ? r.slice(0, 4) : ""
  }
  a(dt, "yearOf");

  function nt(r) {
    let e = Math.round(r);
    return e > 0 ? {
      text: `\uFF0B${w(e)} \u5C0F\u6642`,
      color: "text-chart-cherryRed"
    } : e < 0 ? {
      text: `\uFF0D${w(-e)} \u5C0F\u6642`,
      color: "text-chart-tangerineOrange"
    } : {
      text: "0 \u5C0F\u6642",
      color: "text-muted-foreground"
    }
  }
  a(nt, "netLabel");

  function Ie(r) {
    let e = r.match(/^(\d{1,2}):(\d{2})$/);
    return e ? `${String(Number(e[1])).padStart(2,"0")}:${e[2]}` : ""
  }
  a(Ie, "clockLabel");
  var P = 36;

  function kt({
    value: r,
    options: e,
    onChange: i
  }) {
    let [c, p] = (0, o.useState)(!1), y = Number(r) || new Date().getFullYear(), b = (0, o.useMemo)(() => {
      let $ = e.map(f => Number(f)).filter(f => Number.isFinite(f));
      return [...new Set($)].sort((f, T) => f - T)
    }, [e]), L = a($ => {
      let f = String($);
      f !== r && i(f)
    }, "pickY"), M = a(() => {
      let $ = st();
      $ !== r && i($), p(!1)
    }, "goThisYear");
    return (0, t.jsxs)("div", {
      className: "relative w-36 shrink-0",
      children: [(0, t.jsxs)(d.Button, {
        variant: "outline",
        onClick: () => p($ => !$),
        className: "w-full justify-center text-sm tabular-nums",
        children: [r, "\u5E74"]
      }), c ? (0, t.jsxs)(t.Fragment, {
        children: [(0, t.jsx)("div", {
          className: "fixed inset-0 z-10",
          onClick: () => p(!1)
        }), (0, t.jsxs)("div", {
          className: "absolute left-0 top-0 z-20 w-36 rounded-md border border-border bg-card shadow-lg",
          children: [(0, t.jsx)("div", {
            className: "flex items-stretch px-2 pt-2",
            children: (0, t.jsx)(Ae, {
              options: b,
              labelOf: $ => `${$}\u5E74`,
              value: y,
              onPick: L,
              widthClass: "flex-1",
              proximity: !0
            }, `y-${c}`)
          }), (0, t.jsx)("div", {
            className: "px-3 pb-3 pt-6",
            children: (0, t.jsx)("div", {
              onClick: M,
              className: "flex w-full cursor-pointer items-center justify-center rounded-md border border-foreground/40 px-3 py-1 text-sm font-semibold text-foreground",
              children: "\u4ECA\u5E74"
            })
          })]
        })]
      }) : null]
    })
  }
  a(kt, "YearField");
  var Nt = Array.from({
    length: 12
  }, (r, e) => e + 1);

  function wt(r) {
    let e = r.match(/^(\d{4})-(\d{2})$/);
    return e ? `${Number(e[1])}\u5E74${Number(e[2])}\u6708` : r
  }
  a(wt, "formatYM");

  function $t({
    value: r,
    options: e,
    onChange: i
  }) {
    let [c, p] = (0, o.useState)(!1), y = (0, o.useMemo)(() => {
      let m = new Date().getFullYear(),
        C = m - 10,
        S = m + 5;
      for (let x of e) {
        let k = Number(x.slice(0, 4));
        Number.isFinite(k) && (C = Math.min(C, k), S = Math.max(S, k))
      }
      let v = [];
      for (let x = C; x <= S; x += 1) v.push(x);
      return v
    }, [e]), b = r.match(/^(\d{4})-(\d{2})$/), L = b ? Number(b[1]) : new Date().getFullYear(), M = b ? Number(b[2]) : new Date().getMonth() + 1, $ = a(m => {
      let C = `${m}-${String(M).padStart(2,"0")}`;
      C !== r && i(C)
    }, "pickY"), f = a(m => {
      let C = `${L}-${String(m).padStart(2,"0")}`;
      C !== r && i(C)
    }, "pickM"), T = a(() => {
      let m = rt();
      m !== r && i(m), p(!1)
    }, "goThisMonth");
    return (0, t.jsxs)("div", {
      className: "relative w-36 shrink-0",
      children: [(0, t.jsx)(d.Button, {
        variant: "outline",
        onClick: () => p(m => !m),
        className: "w-full justify-center text-sm tabular-nums",
        children: wt(r)
      }), c ? (0, t.jsxs)(t.Fragment, {
        children: [(0, t.jsx)("div", {
          className: "fixed inset-0 z-10",
          onClick: () => p(!1)
        }), (0, t.jsxs)("div", {
          className: "absolute left-0 top-0 z-20 w-64 rounded-md border border-border bg-card shadow-lg",
          children: [(0, t.jsxs)("div", {
            className: "flex items-stretch px-2 pt-2",
            children: [(0, t.jsx)(Ae, {
              options: y,
              labelOf: m => `${m}\u5E74`,
              value: L,
              onPick: $,
              widthClass: "flex-1",
              proximity: !0
            }, `y-${c}`), (0, t.jsx)(Ae, {
              options: Nt,
              labelOf: m => `${m}\u6708`,
              value: M,
              onPick: f,
              widthClass: "flex-1",
              proximity: !0
            }, `m-${c}`)]
          }), (0, t.jsx)("div", {
            className: "px-3 pb-3 pt-6",
            children: (0, t.jsx)("div", {
              onClick: T,
              className: "flex w-full cursor-pointer items-center justify-center rounded-md border border-foreground/40 px-3 py-1 text-sm font-semibold text-foreground",
              children: "\u672C\u6708"
            })
          })]
        })]
      }) : null]
    })
  }
  a($t, "YearMonthField");

  function De(r) {
    let e = r.match(/^(\d{1,2}):(\d{2})$/);
    if (!e) return null;
    let i = Number(e[1]),
      c = Number(e[2]);
    return i < 0 || i > 23 || c < 0 || c > 59 ? null : i * 60 + c
  }
  a(De, "parseClock");

  function St(r) {
    let e = (r % 1440 + 1440) % 1440;
    return `${String(Math.floor(e/60)).padStart(2,"0")}:${String(e%60).padStart(2,"0")}`
  }
  a(St, "formatClock");

  function Te(r, e) {
    let i = De(r);
    return i == null ? null : St(i + e)
  }
  a(Te, "shiftClock");
  var Ot = (() => {
      let r = [];
      for (let e = 0; e < 24; e += 1) r.push(e);
      return r
    })(),
    Ct = [0, 30];

  function Lt(r, e) {
    return `${String(r).padStart(2,"0")}:${String(e).padStart(2,"0")}`
  }
  a(Lt, "formatHM");

  function Ae({
    options: r,
    labelOf: e,
    value: i,
    onPick: c,
    widthClass: p,
    proximity: y
  }) {
    let b = (0, o.useRef)(null),
      L = (0, o.useRef)(!1),
      M = (0, o.useRef)(0),
      $ = (0, o.useRef)(i);
    $.current = i;
    let f = (0, o.useRef)(c);
    f.current = c;
    let T = r.findIndex(v => v === i);
    (0, o.useEffect)(() => {
      L.current = !0;
      let v = T >= 0 ? T : 0;
      window.setTimeout(() => {
        b.current && v >= 0 && (b.current.scrollTop = v * P), window.setTimeout(() => {
          L.current = !1
        }, 60)
      }, 30)
    }, []), (0, o.useEffect)(() => {
      let v = b.current;
      if (!v) return;
      let x = r.findIndex(H => H === i),
        k = x >= 0 ? x : 0;
      if (Math.round(v.scrollTop / P) === k) return;
      L.current = !0, v.scrollTo({
        top: k * P,
        behavior: "smooth"
      });
      let N = window.setTimeout(() => {
        L.current = !1
      }, 380);
      return () => window.clearTimeout(N)
    }, [i, r]), (0, o.useEffect)(() => () => {
      M.current && window.clearTimeout(M.current)
    }, []);
    let m = a(() => {
        let v = b.current;
        if (!v) return;
        let x = Math.round(v.scrollTop / P),
          k = Math.max(0, Math.min(r.length - 1, x)),
          N = r[k];
        N != null && N !== $.current && f.current(N)
      }, "settleFromScroll"),
      C = a(() => {
        !b.current || L.current || m()
      }, "pickNearest"),
      S = a(v => {
        let x = b.current;
        x && (L.current = !0, M.current && window.clearTimeout(M.current), x.scrollTo({
          top: v * P,
          behavior: "smooth"
        }), M.current = window.setTimeout(() => {
          L.current = !1, m()
        }, 350))
      }, "scrollToIdx");
    return (0, t.jsxs)("div", {
      className: `relative ${p??"flex-1"}`,
      children: [(0, t.jsx)("div", {
        className: "pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-md bg-accent",
        style: {
          height: P
        }
      }), (0, t.jsxs)("div", {
        ref: b,
        onScroll: () => C(),
        className: "relative overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        style: y ? {
          height: P * 5,
          scrollSnapType: "y proximity",
          overscrollBehavior: "contain"
        } : {
          height: P * 5,
          scrollSnapType: "y mandatory",
          overscrollBehavior: "contain"
        },
        children: [(0, t.jsx)("div", {
          style: {
            height: P * 2
          }
        }), r.map((v, x) => (0, t.jsx)("div", {
          onClick: () => {
            v !== $.current && f.current(v), S(x)
          },
          className: `relative flex items-center justify-center tabular-nums ${v===i?"text-lg font-bold text-foreground":"text-sm text-muted-foreground"}`,
          style: y ? {
            height: P,
            scrollSnapAlign: "center"
          } : {
            height: P,
            scrollSnapAlign: "center",
            scrollSnapStop: "always"
          },
          children: e(v)
        }, v)), (0, t.jsx)("div", {
          style: {
            height: P * 2
          }
        })]
      })]
    })
  }
  a(Ae, "WheelColumn");

  function je({
    value: r,
    onChange: e,
    fallbackClock: i
  }) {
    let [c, p] = (0, o.useState)(!1), [y, b] = (0, o.useState)(8), [L, M] = (0, o.useState)(0), [$, f] = (0, o.useState)(!1), T = (0, o.useRef)(""), m = a(() => {
      let k = De(r) != null ? r : i ?? "08:00",
        N = De(k) ?? 480,
        H = Math.floor(N / 60) % 24,
        O = N % 60 >= 45 || N % 60 < 15 ? 0 : 30;
      return {
        h: H,
        m: O,
        clock: De(r) != null ? r : i ?? "08:00"
      }
    }, "anchorOf"), C = a(() => {
      let k = m();
      b(k.h), M(k.m), f(!1), T.current = k.clock, p(!0)
    }, "openMenu"), S = a(() => {
      $ ? e(Lt(y, L)) : De(r) == null && T.current && e(T.current), p(!1)
    }, "closeMenu"), v = a(k => {
      b(k), f(!0)
    }, "pickHour"), x = a(k => {
      M(k), f(!0)
    }, "pickMinute");
    return (0, t.jsxs)("div", {
      className: "relative min-w-0",
      children: [(0, t.jsx)(d.Button, {
        variant: "outline",
        onClick: () => c ? S() : C(),
        className: "w-full justify-center text-sm tabular-nums",
        children: Ie(r) || "\u9078\u64C7\u6642\u9593"
      }), c ? (0, t.jsxs)(t.Fragment, {
        children: [(0, t.jsx)("div", {
          className: "fixed inset-0 z-10",
          onClick: () => S()
        }), (0, t.jsx)("div", {
          className: "absolute left-0 right-0 top-0 z-20 rounded-md border border-border bg-card shadow-lg",
          children: (0, t.jsxs)("div", {
            className: "flex items-stretch px-2",
            children: [(0, t.jsx)(Ae, {
              options: Ot,
              labelOf: k => String(k),
              value: y,
              onPick: v,
              widthClass: "flex-[3]",
              proximity: !0
            }, `h-${c}`), (0, t.jsx)("div", {
              className: "flex items-center justify-center text-sm text-muted-foreground",
              style: {
                height: P * 5
              },
              children: ":"
            }), (0, t.jsx)(Ae, {
              options: Ct,
              labelOf: k => k === 0 ? "00" : "30",
              value: L,
              onPick: x,
              widthClass: "flex-[2]"
            }, `m-${c}`)]
          })
        })]
      }) : null]
    })
  }
  a(je, "TimeField");
  var Bt = ["\u65E5", "\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D"];

  function Mt(r) {
    let e = r.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return e ? {
      y: Number(e[1]),
      m: Number(e[2]),
      d: Number(e[3])
    } : null
  }
  a(Mt, "parseYMD");

  function Tt(r, e, i) {
    return `${r}-${String(e).padStart(2,"0")}-${String(i).padStart(2,"0")}`
  }
  a(Tt, "toYMD");

  function It(r) {
    let e = Mt(r);
    return e ? `\u661F\u671F${Bt[new Date(e.y,e.m-1,e.d).getDay()]}` : ""
  }
  a(It, "weekdayLabel");

  function ge(r) {
    return r.filter(e => e.start && e.end).map(e => `${e.start}~${e.end}`).join(",")
  }
  a(ge, "canonBreaks");

  function Dt({
    date: r,
    log: e,
    folderId: i,
    open: c,
    onToggle: p,
    onSaved: y,
    onDirtyChange: b
  }) {
    let L = e?.clockIn ?? "",
      M = e?.clockOut ?? "",
      $ = e && Array.isArray(e.breaks) && e.breaks.length > 0 ? e.breaks.map(u => ({
        start: u.start ?? "",
        end: u.end ?? ""
      })) : [{
        start: "",
        end: ""
      }],
      [f, T] = (0, o.useState)(L),
      [m, C] = (0, o.useState)(M),
      [S, v] = (0, o.useState)($),
      [x, k] = (0, o.useState)(e?.note ?? ""),
      [N, H] = (0, o.useState)(!!e?.isLeave),
      [O, oe] = (0, o.useState)(!!e?.isSpecialLeave),
      [I, j] = (0, o.useState)(!!e?.isOvertimePay),
      [V, F] = (0, o.useState)(""),
      [Z, ee] = (0, o.useState)(!1),
      [_e, z] = (0, o.useState)(!1),
      U = e?.id ?? null,
      R = (0, o.useRef)(null),
      _ = (0, o.useRef)(null),
      K = (0, o.useMemo)(() => ve(f, m, S.filter(u => u.start && u.end)), [f, m, S]),
      xe = !!e?.isLeave,
      he = !!e?.isSpecialLeave,
      q = !!e?.isOvertimePay,
      Ee = ge(e?.breaks ?? []),
      X = ge(S),
      ke = N !== xe || O !== he || I !== q,
      te = f !== (e?.clockIn ?? "") || m !== (e?.clockOut ?? "") || X !== Ee || x !== (e?.note ?? ""),
      G = !!(N || O || I || f || m || S.some(u => u.start || u.end) || x),
      Ke = `${N}|${O}|${I}|${f}|${m}|${X}|${x}`,
      ne = _.current != null && _.current === Ke,
      D = ne ? !1 : ke || G && te;
    (0, o.useEffect)(() => {
      ne || b?.(r, D)
    }, [D, ne, r]);
    let Ne = ge(e?.breaks ?? []);
    (0, o.useEffect)(() => {
      if (T(e?.clockIn ?? ""), C(e?.clockOut ?? ""), v(e && Array.isArray(e.breaks) && e.breaks.length > 0 ? e.breaks.map(u => ({
          start: u.start ?? "",
          end: u.end ?? ""
        })) : [{
          start: "",
          end: ""
        }]), k(e?.note ?? ""), H(!!e?.isLeave), oe(!!e?.isSpecialLeave), j(!!e?.isOvertimePay), _.current != null) {
        let u = `${!!e?.isLeave}|${!!e?.isSpecialLeave}|${!!e?.isOvertimePay}|${e?.clockIn??""}|${e?.clockOut??""}|${ge(e?.breaks??[])}|${e?.note??""}`;
        _.current === u && (_.current = null)
      }
      R.current = null, F("")
    }, [U, e?.clockIn, e?.clockOut, Ne, xe, he, q, e?.note]), (0, o.useEffect)(() => () => {
      b?.(r, !1)
    }, [r]);
    let Ve = a(async () => {
        if (!i || Z) return;
        if (O) {
          F(""), ee(!0);
          try {
            let s = Date.now(),
              l = U ?? R.current ?? (R.current = (0, d.generateObjectID)());
            await d.useItemStore.getState().upsertItem({
              id: l,
              itemType: "WORK_LOG",
              name: r,
              parents: {
                [i]: s
              },
              date: r,
              clockIn: "",
              clockOut: "",
              breaks: [],
              workMinutes: 0,
              isLeave: !1,
              isSpecialLeave: !0,
              isOvertimePay: !1,
              note: x,
              createdAt: e?.createdAt ?? s,
              updatedAt: s
            }, {
              needSync: !0
            }), _.current = `${N}|${O}|false|||,|${x}`, b?.(r, !1), (0, d.toast)(`\u7279\u4F11 ${r} \u5DF2\u5132\u5B58`), y?.()
          } finally {
            ee(!1)
          }
          return
        }
        if (N) {
          let s = S.filter(h => h.start && h.end);
          for (let h of S)
            if (h.start && !h.end || !h.start && h.end) {
              F("\u4F11\u606F\u6642\u9593\u8981\u9078\u5B8C\u6574");
              return
            } let l = !!(f && m);
          if (!l && (f || m)) {
            F("\u4E0A\u73ED\u4E0B\u73ED\u90FD\u8981\u9078\uFF0C\u5426\u5247\u7576\u7D14\u4F11\u4E0D\u586B\u6642\u9593");
            return
          }
          let g = l ? ve(f, m, s) : 0;
          if (l && (g == null || g <= 0)) {
            F("\u6642\u9593\u6709\u8AA4\uFF0C\u8ACB\u6AA2\u67E5");
            return
          }
          F(""), ee(!0);
          try {
            let h = Date.now(),
              B = U ?? R.current ?? (R.current = (0, d.generateObjectID)()),
              Y = "\u4F11";
            await d.useItemStore.getState().upsertItem({
              id: B,
              itemType: "WORK_LOG",
              name: r,
              parents: {
                [i]: h
              },
              date: r,
              clockIn: l ? f : "",
              clockOut: l ? m : "",
              breaks: l ? s : [],
              workMinutes: l ? g ?? 0 : 0,
              isLeave: N,
              isSpecialLeave: O,
              isOvertimePay: I,
              note: x,
              createdAt: e?.createdAt ?? h,
              updatedAt: h
            }, {
              needSync: !0
            }), _.current = `${N}|${O}|${I}|${l?f:""}|${l?m:""}|${l?ge(s):""}|${x}`, b?.(r, !1), (0, d.toast)(`${Y} ${r} \u5DF2\u5132\u5B58`), y?.()
          } finally {
            ee(!1)
          }
          return
        }
        if (!f || !m) {
          F("\u4E0A\u73ED\u4E0B\u73ED\u90FD\u8981\u9078");
          return
        }
        let u = S.filter(s => s.start && s.end);
        for (let s of S)
          if (s.start && !s.end || !s.start && s.end) {
            F("\u4F11\u606F\u6642\u9593\u8981\u9078\u5B8C\u6574");
            return
          } let n = ve(f, m, u);
        if (n == null || n < 0) {
          F("\u6642\u9593\u6709\u8AA4\uFF0C\u8ACB\u6AA2\u67E5");
          return
        }
        F(""), ee(!0);
        try {
          let s = Date.now(),
            l = U ?? R.current ?? (R.current = (0, d.generateObjectID)());
          await d.useItemStore.getState().upsertItem({
            id: l,
            itemType: "WORK_LOG",
            name: r,
            parents: {
              [i]: s
            },
            date: r,
            clockIn: f,
            clockOut: m,
            breaks: u,
            workMinutes: n,
            isLeave: !1,
            isSpecialLeave: !1,
            isOvertimePay: !1 /* PWA guard: 沒勾「休」不存加班費 */,
            note: x,
            createdAt: e?.createdAt ?? s,
            updatedAt: s
          }, {
            needSync: !0
          }), _.current = `false|false|false|${f}|${m}|${ge(u)}|${x}`, b?.(r, !1), (0, d.toast)(`\u5DE5\u6642 ${r} \u5DF2\u5132\u5B58`), y?.()
        } finally {
          ee(!1)
        }
      }, "handleSave"),
      Fe = a(() => {
        T(e?.clockIn ?? ""), C(e?.clockOut ?? ""), v(e && Array.isArray(e.breaks) && e.breaks.length > 0 ? e.breaks.map(u => ({
          start: u.start ?? "",
          end: u.end ?? ""
        })) : [{
          start: "",
          end: ""
        }]), k(e?.note ?? ""), H(!!e?.isLeave), oe(!!e?.isSpecialLeave), j(!!e?.isOvertimePay), F(""), b?.(r, !1), y?.()
      }, "resetToSaved"),
      Re = a((u, n) => {
        let s = S.map((l, g) => {
          if (g !== u) return l;
          let h = {
            ...l,
            ...n
          };
          if (n.start && !l.end) {
            let B = Te(n.start, 60);
            B && (h.end = B)
          }
          return h
        });
        v(s)
      }, "setBreak"),
      Ue = a(u => {
        if (T(u), !m) {
          let n = Te(u, 540);
          n && C(n)
        }
      }, "handleClockIn"),
      A = a(u => {
        C(u)
      }, "handleClockOut"),
      qe = a(() => v(u => [...u, {
        start: "",
        end: ""
      }]), "addBreak"),
      at = a(u => {
        let n = S.length <= 1 ? [{
          start: "",
          end: ""
        }] : S.filter((s, l) => l !== u);
        v(n)
      }, "removeBreakRow"),
      Xe = a(async () => {
        U && (R.current = null, await d.useItemStore.getState().removeItems([U], {
          needSync: !0
        }), (0, d.toast)("\u5DF2\u522A\u9664\u9019\u5929\u5DE5\u6642\u8A18\u9304"), y?.())
      }, "removeLog"),
      Je = It(r),
      ue = !!e,
      we = r === ht(),
      de = c ? N : xe,
      me = c ? O : he,
      Qe = c ? I : q,
      fe = me ? "\u7279\u4F11" : de ? "\u4F11" : "",
      $e = [fe, Qe && !me ? "\u52A0\u73ED\u8CBB" : ""].filter(Boolean).join(" \xB7 "),
      pe = me ? "text-chart-mintGreen" : de ? "text-chart-tangerineOrange" : "text-chart-sunsetOrange";
    return (0, t.jsxs)("div", {
      className: "border-b border-border px-3 py-1.5",
      children: [(0, t.jsxs)("div", {
        onClick: p,
        className: "flex w-full cursor-pointer items-center gap-2 text-left",
        children: [(0, t.jsxs)("span", {
          className: "min-w-0 flex-1",
          children: [(0, t.jsxs)("span", {
            className: `flex items-center gap-1.5 text-sm font-semibold tabular-nums ${$e?pe:""}`,
            children: [(0, t.jsxs)("span", {
              children: [r.slice(8, 10), " \u65E5 \xB7 ", Je, $e ? ` \xB7 ${$e}` : ue ? "" : " \xB7 \u672A\u586B"]
            }), we ? (0, t.jsx)("span", {
              className: "rounded-full bg-primary px-2 py-px text-xs font-semibold text-primary-foreground",
              children: "\u4ECA\u65E5"
            }) : null]
          }), ue && e?.clockIn && e?.clockOut ? (0, t.jsxs)("span", {
            className: "mt-0.5 block truncate text-xs text-muted-foreground tabular-nums",
            children: [Ie(e.clockIn), "-", Ie(e.clockOut), Array.isArray(e.breaks) && e.breaks.some(u => u.start && u.end) ? `\uFF0C\u4F11\u606F${e.breaks.filter(u=>u.start&&u.end).map(u=>`${Ie(u.start)}-${Ie(u.end)}`).join("\u3001")}` : "\uFF0C\u7121\u4F11\u606F"]
          }) : null, ue && e?.note ? (0, t.jsx)("span", {
            className: "mt-0.5 block truncate text-xs text-muted-foreground",
            children: e.note
          }) : null]
        }), (0, t.jsx)("span", {
          className: "shrink-0 text-right tabular-nums",
          children: (() => {
            let u = !D && e ? Q(e) : !1;
            if (fe && !D && !u) return (0, t.jsx)("span", {
              className: `text-sm font-semibold ${pe}`,
              children: fe
            });
            let n = e && e.clockIn && e.clockOut && Number.isFinite(Number(e.workMinutes)) ? Number(e.workMinutes) : null,
              s = K != null && K >= 0 && f && m,
              l = D ? K : n ?? K,
              g = D ? !!(N && !O && f && m) : u,
              h = D ? I : q,
              B = l != null ? Me(l, g, h) : "";
            return (s || n != null) && l != null ? (0, t.jsxs)("span", {
              className: "flex flex-col items-end text-sm leading-5",
              children: [(0, t.jsxs)("span", {
                className: "font-semibold",
                children: [w(l), " \u5C0F\u6642"]
              }), B ? (0, t.jsx)("span", {
                className: `text-xs ${Ye(l,g,h)}`,
                children: B
              }) : null, g && !D ? (0, t.jsxs)("span", {
                className: `text-xs ${pe}`,
                children: [fe, "\u51FA\u52E4"]
              }) : null, D ? (0, t.jsx)("span", {
                className: "text-xs text-muted-foreground",
                children: "\u672A\u5132\u5B58"
              }) : null]
            }) : (0, t.jsx)("span", {
              className: "text-xs text-muted-foreground",
              children: ue ? "\u6642\u9593\u672A\u586B\u5B8C" : ""
            })
          })()
        })]
      }), c ? (0, t.jsxs)("div", {
        className: "mt-2 flex flex-col gap-2",
        children: [(0, t.jsxs)("div", {
          className: "grid grid-cols-3 gap-2 min-w-0",
          children: [(0, t.jsxs)("div", {
            onClick: () => {
              oe(u => !u), O || (H(!1), j(!1))
            },
            role: "checkbox",
            "aria-checked": O,
            className: `flex w-full cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm ${O?"border-chart-mintGreen bg-chart-mintGreen/10 font-semibold text-chart-mintGreen":"border-border text-muted-foreground"}`,
            children: [(0, t.jsx)("span", {
              className: `flex h-5 w-5 shrink-0 items-center justify-center rounded border text-sm leading-none ${O?"border-chart-mintGreen bg-chart-mintGreen text-primary-foreground":"border-border bg-background"}`,
              children: O ? "\u2713" : ""
            }), (0, t.jsx)("span", {
              className: "flex-1",
              children: "\u7279\u4F11"
            })]
          }), (0, t.jsxs)("div", {
            onClick: () => {
              H(u => !u), N ? j(!1) : oe(!1) /* PWA guard: 取消「休」一併取消加班費 */
            },
            role: "checkbox",
            "aria-checked": N,
            className: `flex w-full cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm ${N?"border-chart-tangerineOrange bg-chart-tangerineOrange/10 font-semibold text-chart-tangerineOrange":"border-border text-muted-foreground"}`,
            children: [(0, t.jsx)("span", {
              className: `flex h-5 w-5 shrink-0 items-center justify-center rounded border text-sm leading-none ${N?"border-chart-tangerineOrange bg-chart-tangerineOrange text-primary-foreground":"border-border bg-background"}`,
              children: N ? "\u2713" : ""
            }), (0, t.jsx)("span", {
              className: "flex-1",
              children: "\u4F11"
            })]
          }), (0, t.jsxs)("div", {
            onClick: () => {
              if (!N || O) return; /* PWA guard: 加班費需先勾「休」 */
              j(u => !u), I || oe(!1)
            },
            role: "checkbox",
            "aria-checked": I,
            "aria-disabled": !N || O,
            "aria-describedby": !N || O ? `wl-pay-hint-${r}` : void 0,
            className: `flex w-full cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm ${I?"border-chart-sunsetOrange bg-chart-sunsetOrange/10 font-semibold text-chart-sunsetOrange":"border-border text-muted-foreground"}${!N||O?" wl-locked":""}`,
            children: [(0, t.jsx)("span", {
              className: `flex h-5 w-5 shrink-0 items-center justify-center rounded border text-sm leading-none ${I?"border-chart-sunsetOrange bg-chart-sunsetOrange text-primary-foreground":"border-border bg-background"}`,
              children: I ? "\u2713" : ""
            }), (0, t.jsx)("span", {
              className: "flex-1",
              children: "\u52A0\u73ED\u8CBB"
            })]
          })]
        }), !N || O ? (0, t.jsx)("div", {
          id: `wl-pay-hint-${r}`,
          className: "wl-pay-hint text-xs text-muted-foreground",
          children: I ? "\u9700\u5148\u52FE\u300C\u4F11\u300D\uFF0C\u5132\u5B58\u6642\u6703\u53D6\u6D88\u52A0\u73ED\u8CBB" : "\u9700\u5148\u52FE\u300C\u4F11\u300D"
        }) : null, O ? null : (0, t.jsxs)(t.Fragment, {
          children: [(0, t.jsxs)("div", {
            className: "grid grid-cols-2 gap-2 min-w-0",
            children: [(0, t.jsxs)("div", {
              className: "flex flex-col gap-1 min-w-0",
              children: [(0, t.jsx)("span", {
                className: "text-xs text-muted-foreground",
                children: "\u4E0A\u73ED"
              }), (0, t.jsx)(je, {
                value: f,
                onChange: Ue
              })]
            }), (0, t.jsxs)("div", {
              className: "flex flex-col gap-1 min-w-0",
              children: [(0, t.jsx)("span", {
                className: "text-xs text-muted-foreground",
                children: "\u4E0B\u73ED"
              }), (0, t.jsx)(je, {
                value: m,
                onChange: A,
                fallbackClock: Te(f, 540) ?? void 0
              })]
            })]
          }), S.map((u, n) => {
            let s = f || void 0;
            if (n > 0)
              for (let l = n - 1; l >= 0; l -= 1) {
                let g = S[l]?.end;
                if (g) {
                  s = Te(g, 30) ?? s;
                  break
                }
              }
            return (0, t.jsxs)("div", {
              className: "flex items-center gap-1 min-w-0",
              children: [(0, t.jsx)("span", {
                className: "text-xs text-muted-foreground w-5 shrink-0 tabular-nums",
                children: n + 1
              }), (0, t.jsx)("div", {
                className: "flex-1 min-w-0",
                children: (0, t.jsx)(je, {
                  value: u.start,
                  onChange: l => Re(n, {
                    start: l
                  }),
                  fallbackClock: s
                })
              }), (0, t.jsx)("span", {
                className: "text-xs text-muted-foreground shrink-0",
                children: "\u5230"
              }), (0, t.jsx)("div", {
                className: "flex-1 min-w-0",
                children: (0, t.jsx)(je, {
                  value: u.end,
                  onChange: l => Re(n, {
                    end: l
                  }),
                  fallbackClock: Te(u.start, 60) ?? void 0
                })
              }), (0, t.jsx)(d.Button, {
                variant: "ghost",
                size: "sm",
                onClick: () => at(n),
                title: "\u79FB\u9664\u9019\u6BB5\u4F11\u606F",
                className: "shrink-0 px-2",
                children: "\u79FB\u9664"
              })]
            }, n)
          }), (0, t.jsx)("div", {
            className: "flex items-center gap-2",
            children: (0, t.jsx)(d.Button, {
              variant: "outline",
              size: "sm",
              onClick: qe,
              children: "\u65B0\u589E\u4E00\u6BB5\u4F11\u606F"
            })
          })]
        }), (0, t.jsx)(d.Input, {
          value: x,
          onChange: u => k(u.target.value),
          placeholder: "\u5099\u8A3B\uFF08\u9078\u586B\uFF09",
          className: "w-full"
        }), (0, t.jsx)("div", {
          className: "rounded-md bg-accent px-3 py-2 text-sm tabular-nums",
          children: (() => {
            if (O) return "\u7279\u4F11";
            let u = N ? "\u4F11" : "",
              n = !!(u && f && m);
            if (u && !n) return u;
            if (K != null && K >= 0 && f && m) {
              let s = Me(K, n, I);
              return `${w(K)} \u5C0F\u6642${s?` \xB7 ${s}`:""}`
            }
            return "\u4E0A\u73ED\u4E0B\u73ED\u9078\u5B8C\u6309\u5132\u5B58"
          })()
        }), V ? (0, t.jsx)("div", {
          className: "text-sm text-destructive",
          children: V
        }) : null, _e ? (0, t.jsx)("div", {
          className: "fixed inset-0 z-10 flex items-center justify-center bg-background/60 px-4",
          onClick: () => z(!1),
          children: (0, t.jsxs)("div", {
            className: "w-full max-w-sm rounded-lg border border-border bg-card p-4",
            onClick: u => u.stopPropagation(),
            children: [(0, t.jsx)("div", {
              className: "text-sm font-semibold",
              children: "\u522A\u9664\u9019\u5929\u5DE5\u6642\u8A18\u9304\uFF1F"
            }), (0, t.jsxs)("p", {
              className: "mt-1 text-sm text-muted-foreground",
              children: [r, " \u7684\u5DE5\u6642\u8A18\u9304\u522A\u9664\u5F8C\u7121\u6CD5\u5FA9\u539F\uFF0C\u78BA\u5B9A\u8981\u522A\u9664\u55CE\uFF1F"]
            }), (0, t.jsxs)("div", {
              className: "mt-3 flex justify-end gap-2",
              children: [(0, t.jsx)(d.Button, {
                variant: "outline",
                size: "sm",
                onClick: () => z(!1),
                children: "\u53D6\u6D88"
              }), (0, t.jsx)(d.Button, {
                variant: "destructive",
                size: "sm",
                onClick: () => {
                  z(!1), Xe()
                },
                children: "\u78BA\u5B9A\u522A\u9664"
              })]
            })]
          })
        }) : null, (0, t.jsxs)("div", {
          className: "flex items-center gap-2",
          children: [U ? (0, t.jsx)(d.Button, {
            variant: "destructive",
            size: "sm",
            onClick: () => z(!0),
            disabled: Z,
            title: "\u522A\u9664\u9019\u5929\u8A18\u9304",
            children: "\u522A\u9664"
          }) : null, (0, t.jsx)("span", {
            className: "flex-1"
          }), D ? (0, t.jsx)("span", {
            className: "text-xs text-muted-foreground",
            children: "\u6709\u672A\u5132\u5B58\u8B8A\u66F4"
          }) : null, D ? (0, t.jsx)(d.Button, {
            variant: "ghost",
            size: "sm",
            onClick: Fe,
            disabled: Z,
            children: "\u6368\u68C4\u8B8A\u66F4"
          }) : null, (0, t.jsx)(d.Button, {
            onClick: () => {
              Ve()
            },
            disabled: Z || !D,
            children: Z ? "\u5132\u5B58\u4E2D\u2026" : "\u5132\u5B58"
          })]
        })]
      }) : null]
    })
  }
  a(Dt, "DayRow");

  function At() {
    let r = (0, d.useSelectedItemsStore)(n => n.lastFolderId),
      i = (0, d.useItemsByType)("WORK_LOG_FOLDER").find(n => n.id === r) ?? null,
      c = (0, d.useItemsByType)("WORK_LOG", r ?? void 0),
      [p, y] = (0, o.useState)(rt()),
      [b, L] = (0, o.useState)("all"),
      [M, $] = (0, o.useState)("month"),
      [f, T] = (0, o.useState)(st()),
      [m, C] = (0, o.useState)(null),
      [S, v] = (0, o.useState)(null),
      x = (0, o.useRef)(new Map),
      k = (0, o.useRef)(null),
      N = (0, o.useRef)(null),
      H = a(() => {
        k.current && (k.current.style.overflowY = ""), N.current && (N.current.style.maxHeight = "", N.current.style.overflowY = "", N.current = null)
      }, "unlockList");
    (0, o.useEffect)(() => {
      if (!S) return;
      H();
      let n = x.current.get(S),
        s = k.current;
      if (n && s) {
        let l = 56;
        for (let [Y, le] of x.current)
          if (Y !== S && le.offsetHeight > 0) {
            l = le.offsetHeight;
            break
          } let g = s.getBoundingClientRect(),
          h = n.getBoundingClientRect(),
          B = s.scrollTop + (h.top - g.top) - (s.clientHeight / 2 - h.height / 2) + l;
        s.scrollTo({
          top: B,
          behavior: "smooth"
        })
      } else n && n.scrollIntoView({
        block: "center",
        behavior: "smooth"
      });
      v(null)
    }, [S]), (0, o.useEffect)(() => {
      if (!m) {
        H();
        return
      }
      let n = m,
        s = window.setTimeout(() => {
          let l = k.current;
          if (!l) return;
          l.style.overflowY = "hidden";
          let g = x.current.get(n);
          g && (g.style.maxHeight = `${l.clientHeight}px`, g.style.overflowY = "auto", N.current = g)
        }, 500);
      return () => {
        window.clearTimeout(s), H()
      }
    }, [m]);
    let O = (0, o.useRef)(new Set),
      [oe, I] = (0, o.useState)(0),
      [j, V] = (0, o.useState)(null),
      F = (0, o.useRef)(null),
      Z = (0, o.useRef)(!1);
    (0, o.useEffect)(() => {
      Z.current = j != null
    }, [j]);
    let ee = a((n, s) => {
        s ? O.current.add(n) : O.current.delete(n), d.__onDirty?.(n, s)
      }, "handleDirtyChange"),
      _e = a(() => `\u4EE5\u4E0B\u65E5\u671F\u6709\u672A\u5132\u5B58\u8B8A\u66F4\uFF1A${[...O.current].sort().join("\u3001")}\u3002\u5207\u63DB\u6703\u6368\u68C4\u9019\u4E9B\u8B8A\u66F4\uFF0C\u78BA\u5B9A\u8981\u7E7C\u7E8C\u55CE\uFF1F`, "dirtyMessage"),
      z = a(() => {
        O.current.clear(), d.__onDirtyClear?.(), C(null), I(n => n + 1)
      }, "discardAllDirty"),
      U = a(() => `\u4EE5\u4E0B\u65E5\u671F\u6709\u672A\u5132\u5B58\u8B8A\u66F4\uFF1A${[...O.current].sort().join("\u3001")}\u3002\u96E2\u958B\u6703\u6368\u68C4\u9019\u4E9B\u8B8A\u66F4\uFF0C\u78BA\u5B9A\u8981\u96E2\u958B\u55CE\uFF1F`, "dirtyLeaveMessage");
    d.__discardAll = z;
    (0, o.useEffect)(() => {
      let n = a(l => {
          O.current.size > 0 && l.preventDefault()
        }, "onBeforeUnload"),
        s = a(l => {
          if (O.current.size === 0 || Z.current) return;
          let g = F.current,
            h = l.target;
          if (g && h && g.contains(h)) return;
          let B = document.activeElement ?? null;
          if (B && (B.tagName === "INPUT" || B.tagName === "TEXTAREA")) return;
          let Y = document.querySelector(".custom-dialog-overlay");
          Y && h && Y.contains(h) || (l.stopPropagation(), l.preventDefault(), V({
            title: "\u6709\u5C1A\u672A\u5132\u5B58\u7684\u8B8A\u66F4",
            message: U(),
            onConfirm: z
          }))
        }, "onDocClick");
      return window.addEventListener("beforeunload", n), document.addEventListener("click", s, !0), () => {
        window.removeEventListener("beforeunload", n), document.removeEventListener("click", s, !0)
      }
    }, []);
    let R = a((n, s) => {
        if (O.current.size > 0) {
          V({
            title: n,
            message: _e(),
            onConfirm: s
          });
          return
        }
        s()
      }, "guardDirty"),
      _ = a(n => {
        !n || n === p || R("\u6709\u5C1A\u672A\u5132\u5B58\u7684\u8B8A\u66F4", () => {
          z(), y(n)
        })
      }, "handleMonthChange"),
      K = a(n => {
        n && R("\u6709\u5C1A\u672A\u5132\u5B58\u7684\u8B8A\u66F4", () => {
          z(), L(n)
        })
      }, "handleFilterChange"),
      xe = a(n => {
        if (m == null) {
          v(n), C(n);
          return
        }
        if (O.current.has(m)) {
          let s = m;
          V({
            title: "\u6709\u5C1A\u672A\u5132\u5B58\u7684\u8B8A\u66F4",
            message: `${s} \u6709\u672A\u5132\u5B58\u8B8A\u66F4\uFF0C\u7E7C\u7E8C\u6703\u6368\u68C4\u9019\u4E9B\u8B8A\u66F4\u4E26\u6536\u8D77\u3002\u78BA\u5B9A\u8981\u7E7C\u7E8C\u55CE\uFF1F`,
            onConfirm: a(() => {
              O.current.delete(s), C(null), I(l => l + 1)
            }, "onConfirm")
          });
          return
        }
        C(null)
      }, "toggleDate"),
      he = (0, o.useMemo)(() => {
        let n = new Set,
          s = rt();
        n.add(s);
        let [l, g] = s.split("-").map(Number);
        for (let h = -12; h <= 2; h += 1) {
          let B = l * 12 + (g - 1) + h,
            Y = Math.floor(B / 12),
            le = B % 12 + 1;
          n.add(`${Y}-${String(le).padStart(2,"0")}`)
        }
        for (let h of c) {
          let B = tt(h.date ?? "");
          B && n.add(B)
        }
        return [...n].sort().reverse()
      }, [c]),
      q = (0, o.useMemo)(() => {
        let n = new Map;
        for (let s of c) {
          if (tt(s.date ?? "") !== p) continue;
          let l = n.get(s.date);
          (!l || Number(s?.updatedAt ?? 0) >= Number(l?.updatedAt ?? 0)) && n.set(s.date, s)
        }
        return n
      }, [c, p]),
      Ee = (0, o.useMemo)(() => {
        let n = p.match(/^(\d{4})-(\d{2})$/);
        if (!n) return [];
        let s = new Date(Number(n[1]), Number(n[2]), 0).getDate(),
          l = [];
        for (let g = 1; g <= s; g += 1) l.push(Tt(Number(n[1]), Number(n[2]), g));
        return l
      }, [p]),
      X = (0, o.useMemo)(() => [...[...q.values()]].sort((s, l) => (l.date ?? "").localeCompare(s.date ?? "")), [q]),
      ke = a(n => Ce(n), "isRestDay"),
      te = (0, o.useMemo)(() => Ee.map(n => ({
        date: n,
        log: q.get(n) ?? null
      })).filter(({
        log: n
      }) => {
        if (b === "all") return !0;
        if (!n) return !1;
        if (b === "special") return !!n?.isSpecialLeave;
        if (b === "overtimePay") return Le(n);
        if (ke(n)) return !1;
        let s = Q(n),
          l = He(Number(n.workMinutes), s),
          g = Ge(Number(n.workMinutes), s);
        return b === "overtime" ? l > 0 : b === "shortage" ? g > 0 : !0
      }), [Ee, q, b]),
      G = (0, o.useMemo)(() => X.filter(n => !ke(n)), [X]),
      Ke = (0, o.useMemo)(() => G.reduce((n, s) => n + (Number(s.workMinutes) || 0), 0), [G]),
      ne = (0, o.useMemo)(() => G.reduce((n, s) => n + He(Number(s.workMinutes), Q(s), Le(s)), 0), [G]),
      D = (0, o.useMemo)(() => G.reduce((n, s) => n + Ge(Number(s.workMinutes), Q(s)), 0), [G]),
      Ne = (0, o.useMemo)(() => G.reduce((n, s) => n + (Le(s) ? Be(Number(s.workMinutes), Q(s)) : 0), 0), [G]),
      Ve = (0, o.useMemo)(() => ne - D, [ne, D]),
      Fe = (0, o.useMemo)(() => X.filter(n => !!n?.isSpecialLeave).length, [X]),
      Re = (0, o.useMemo)(() => X.filter(n => Ce(n) && !!n?.isLeave).length, [X]),
      Ue = (0, o.useMemo)(() => G.length, [G]),
      A = (0, o.useMemo)(() => {
        let n = [];
        for (let s = 1; s <= 12; s += 1) {
          let l = `${f}-${String(s).padStart(2,"0")}`,
            g = new Map;
          for (let W of c) {
            if (tt(W.date ?? "") !== l) continue;
            let ie = g.get(W.date);
            (!ie || Number(W?.updatedAt ?? 0) >= Number(ie?.updatedAt ?? 0)) && g.set(W.date, W)
          }
          let h = 0,
            B = 0,
            Y = 0,
            le = 0,
            Ze = 0,
            et = 0;
          for (let W of g.values()) {
            let ie = Q(W);
            if (W?.isSpecialLeave) {
              et += 1;
              continue
            }
            if (W?.isLeave && !ie) {
              Ze += 1;
              continue
            }
            let Pe = Math.round(Number(W.workMinutes) || 0),
              ot = Le(W);
            h += Pe, B += He(Pe, ie, ot), Y += Ge(Pe, ie), ot && (le += Be(Pe, ie))
          }
          let pt = g.size - Ze - et;
          n.push({
            month: l,
            count: g.size,
            work: pt,
            leave: Ze,
            special: et,
            total: h,
            overtime: B,
            shortage: Y,
            overtimePay: le,
            net: B - Y
          })
        }
        return n
      }, [c, f]),
      qe = (0, o.useMemo)(() => {
        let n = new Map;
        for (let l of c) {
          if (dt(l.date ?? "") !== f) continue;
          let g = n.get(l.date);
          (!g || Number(l?.updatedAt ?? 0) >= Number(g?.updatedAt ?? 0)) && n.set(l.date, l)
        }
        let s = 0;
        for (let l of n.values()) ke(l) || (s += Math.round(Number(l.workMinutes) || 0));
        return s
      }, [c, f]),
      at = (0, o.useMemo)(() => A.reduce((n, s) => n + s.count, 0), [A]),
      Xe = (0, o.useMemo)(() => A.reduce((n, s) => n + s.work, 0), [A]),
      Je = (0, o.useMemo)(() => A.reduce((n, s) => n + s.leave, 0), [A]),
      ue = (0, o.useMemo)(() => A.reduce((n, s) => n + s.special, 0), [A]),
      we = (0, o.useMemo)(() => A.reduce((n, s) => n + s.overtime, 0), [A]),
      de = (0, o.useMemo)(() => A.reduce((n, s) => n + s.shortage, 0), [A]),
      me = (0, o.useMemo)(() => A.reduce((n, s) => n + s.overtimePay, 0), [A]),
      Qe = (0, o.useMemo)(() => we - de, [we, de]),
      fe = (0, o.useMemo)(() => {
        let n = new Set;
        n.add(st());
        for (let s of c) {
          let l = dt(s.date ?? "");
          l && n.add(l)
        }
        return [...n].sort().reverse()
      }, [c]),
      $e = a(n => {
        !n || n === f || R("\u6709\u5C1A\u672A\u5132\u5B58\u7684\u8B8A\u66F4", () => {
          z(), T(n)
        })
      }, "handleYearChange"),
      pe = a(n => {
        !n || n !== "month" && n !== "year" || R("\u6709\u5C1A\u672A\u5132\u5B58\u7684\u8B8A\u66F4", () => {
          z(), $(n), n === "month" && L("all")
        })
      }, "handleModeChange"),
      u = a(n => {
        R("\u6709\u5C1A\u672A\u5132\u5B58\u7684\u8B8A\u66F4", () => {
          z(), y(n), $("month"), L("all")
        })
      }, "jumpToMonth");
    return (0, t.jsxs)("div", {
      ref: F,
      className: "h-full flex flex-col min-h-0",
      children: [(0, t.jsx)(d.PluginTopbar, {
        title: i?.name ?? "\u5DE5\u6642\u8A18\u9304"
      }), (0, t.jsx)("div", {
        className: "flex-1 min-h-0 flex flex-col",
        children: M === "month" ? (0, t.jsxs)(t.Fragment, {
          children: [(0, t.jsxs)("div", {
            className: "flex items-center gap-3 px-3 py-2 border-b border-border",
            children: [(0, t.jsx)($t, {
              value: p,
              options: he,
              onChange: _
            }), (0, t.jsx)("div", {
              className: "min-w-0 flex-1 text-sm tabular-nums leading-6",
              children: b === "overtime" ? (0, t.jsxs)(t.Fragment, {
                children: [(0, t.jsxs)("span", {
                  className: "block text-chart-cherryRed",
                  children: ["\u52A0\u73ED ", (0, t.jsxs)("span", {
                    className: "font-semibold",
                    children: [w(ne), " \u5C0F\u6642"]
                  })]
                }), (0, t.jsxs)("span", {
                  className: "block text-muted-foreground",
                  children: ["\uFF08", te.length, " \u5929\uFF09"]
                })]
              }) : b === "shortage" ? (0, t.jsxs)(t.Fragment, {
                children: [(0, t.jsxs)("span", {
                  className: "block text-chart-tangerineOrange",
                  children: ["\u88DC\u4F11 ", (0, t.jsxs)("span", {
                    className: "font-semibold",
                    children: [w(D), " \u5C0F\u6642"]
                  })]
                }), (0, t.jsxs)("span", {
                  className: "block text-muted-foreground",
                  children: ["\uFF08", te.length, " \u5929\uFF09"]
                })]
              }) : b === "special" ? (0, t.jsxs)(t.Fragment, {
                children: [(0, t.jsxs)("span", {
                  className: "block text-chart-mintGreen",
                  children: ["\u7279\u4F11 ", (0, t.jsxs)("span", {
                    className: "font-semibold",
                    children: [w(Fe * 8 * 60), " \u5C0F\u6642"]
                  })]
                }), (0, t.jsxs)("span", {
                  className: "block text-muted-foreground",
                  children: ["\uFF08", te.length, " \u5929\uFF09"]
                })]
              }) : b === "overtimePay" ? (0, t.jsxs)(t.Fragment, {
                children: [(0, t.jsxs)("span", {
                  className: "block text-chart-sunsetOrange",
                  children: ["\u52A0\u73ED\u8CBB ", (0, t.jsxs)("span", {
                    className: "font-semibold",
                    children: [w(Ne), " \u5C0F\u6642"]
                  })]
                }), (0, t.jsxs)("span", {
                  className: "block text-muted-foreground",
                  children: ["\uFF08", te.length, " \u5929\uFF09"]
                })]
              }) : (0, t.jsxs)(t.Fragment, {
                children: [(0, t.jsxs)("span", {
                  className: "block",
                  children: [(0, t.jsxs)("span", {
                    className: "font-semibold",
                    children: [w(Ke), " \u5C0F\u6642"]
                  }), " \xB7 ", Ue, " \u5929"]
                }), (0, t.jsxs)("span", {
                  className: "block text-muted-foreground",
                  children: ["\u4F11\u5047 ", Re, " \u5929 \xB7 \u7279\u4F11 ", w(Fe * 8 * 60), " \u5C0F\u6642"]
                }), (0, t.jsxs)("span", {
                  className: "block text-muted-foreground",
                  children: ["\u52A0\u73ED ", w(ne), " \u5C0F\u6642 \xB7 \u88DC\u4F11 ", w(D), " \u5C0F\u6642"]
                }), Ne > 0 ? (0, t.jsxs)("span", {
                  className: "block text-chart-sunsetOrange",
                  children: ["\u52A0\u73ED\u8CBB ", w(Ne), " \u5C0F\u6642"]
                }) : null, (() => {
                  let n = nt(Ve);
                  return (0, t.jsx)("span", {
                    className: `block font-semibold ${n.color}`,
                    children: n.text
                  })
                })()]
              })
            })]
          }), (0, t.jsxs)("div", {
            className: "flex items-center gap-2 overflow-x-auto border-b border-border px-3 py-2",
            children: [(0, t.jsxs)(d.ToggleGroup, {
              type: "single",
              value: M,
              onValueChange: n => n && pe(n),
              children: [(0, t.jsx)(d.ToggleGroupItem, {
                value: "month",
                children: "\u6708"
              }), (0, t.jsx)(d.ToggleGroupItem, {
                value: "year",
                children: "\u5E74"
              })]
            }), (0, t.jsxs)(d.ToggleGroup, {
              type: "single",
              value: b,
              onValueChange: n => n && K(n),
              children: [(0, t.jsx)(d.ToggleGroupItem, {
                value: "all",
                children: "\u5168\u90E8"
              }), (0, t.jsx)(d.ToggleGroupItem, {
                value: "overtime",
                children: "\u52A0\u73ED"
              }), (0, t.jsx)(d.ToggleGroupItem, {
                value: "shortage",
                children: "\u88DC\u4F11"
              }), (0, t.jsx)(d.ToggleGroupItem, {
                value: "special",
                children: "\u7279\u4F11"
              }), (0, t.jsx)(d.ToggleGroupItem, {
                value: "overtimePay",
                children: "\u52A0\u73ED\u8CBB"
              })]
            })]
          }), (0, t.jsx)("div", {
            className: "flex-1 min-h-0",
            children: (0, t.jsx)(d.CustomScrollbar, {
              orientation: "vertical",
              ref: k,
              children: te.length === 0 ? (0, t.jsx)("div", {
                className: "px-3 py-8 text-center text-sm text-muted-foreground",
                children: "\u7121\u7D00\u9304"
              }) : (0, t.jsxs)(t.Fragment, {
                children: [te.map(({
                  date: n,
                  log: s
                }) => (0, t.jsx)("div", {
                  ref: l => {
                    l ? x.current.set(n, l) : x.current.delete(n)
                  },
                  children: (0, t.jsx)(Dt, {
                    date: n,
                    log: s,
                    folderId: r,
                    open: m === n,
                    onToggle: () => xe(n),
                    onSaved: () => {
                      v(n), C(null)
                    },
                    onDirtyChange: ee
                  })
                }, `${r}-${n}-${oe}`)), (0, t.jsx)("div", {
                  className: "h-40"
                })]
              })
            })
          })]
        }) : (0, t.jsxs)(t.Fragment, {
          children: [(0, t.jsxs)("div", {
            className: "flex items-center gap-3 px-3 py-2 border-b border-border",
            children: [(0, t.jsx)(kt, {
              value: f,
              options: fe,
              onChange: $e
            }), (0, t.jsxs)("div", {
              className: "min-w-0 flex-1 text-sm tabular-nums leading-6",
              children: [(0, t.jsxs)("span", {
                className: "block",
                children: [(0, t.jsxs)("span", {
                  className: "font-semibold",
                  children: [w(qe), " \u5C0F\u6642"]
                }), " \xB7 ", Xe, " \u5929"]
              }), (0, t.jsxs)("span", {
                className: "block text-muted-foreground",
                children: ["\u4F11\u5047 ", Je, " \u5929 \xB7 \u7279\u4F11 ", w(ue * 8 * 60), " \u5C0F\u6642"]
              }), (0, t.jsxs)("span", {
                className: "block text-muted-foreground",
                children: ["\u52A0\u73ED ", w(we), " \u5C0F\u6642 \xB7 \u88DC\u4F11 ", w(de), " \u5C0F\u6642"]
              }), me > 0 ? (0, t.jsxs)("span", {
                className: "block text-chart-sunsetOrange",
                children: ["\u52A0\u73ED\u8CBB ", w(me), " \u5C0F\u6642"]
              }) : null, (() => {
                let n = nt(Qe);
                return (0, t.jsx)("span", {
                  className: `block font-semibold ${n.color}`,
                  children: n.text
                })
              })()]
            })]
          }), (0, t.jsx)("div", {
            className: "flex items-center gap-2 overflow-x-auto border-b border-border px-3 py-2",
            children: (0, t.jsxs)(d.ToggleGroup, {
              type: "single",
              value: M,
              onValueChange: n => n && pe(n),
              children: [(0, t.jsx)(d.ToggleGroupItem, {
                value: "month",
                children: "\u6708"
              }), (0, t.jsx)(d.ToggleGroupItem, {
                value: "year",
                children: "\u5E74"
              })]
            })
          }), (0, t.jsx)("div", {
            className: "flex-1 min-h-0",
            children: (0, t.jsxs)(d.CustomScrollbar, {
              orientation: "vertical",
              children: [A.map(n => {
                let s = nt(n.net);
                return (0, t.jsxs)("div", {
                  onClick: () => u(n.month),
                  className: "flex w-full cursor-pointer items-center gap-2 border-b border-border px-3 py-1.5 text-left",
                  children: [(0, t.jsxs)("span", {
                    className: "min-w-0 flex-1",
                    children: [(0, t.jsxs)("span", {
                      className: "block text-sm font-semibold tabular-nums",
                      children: [n.month.slice(5, 7), " \u6708 \xB7 ", w(n.total), " \u5C0F\u6642 \xB7 ", n.work, " \u5929"]
                    }), (0, t.jsxs)("span", {
                      className: "mt-0.5 block truncate text-xs text-muted-foreground tabular-nums",
                      children: ["\u4F11\u5047 ", n.leave, " \u5929 \xB7 \u7279\u4F11 ", w(n.special * 8 * 60), " \u5C0F\u6642 \xB7 \u52A0\u73ED ", w(n.overtime), " \xB7 \u88DC\u4F11 ", w(n.shortage), n.overtimePay > 0 ? ` \xB7 \u52A0\u73ED\u8CBB ${w(n.overtimePay)}` : ""]
                    })]
                  }), (0, t.jsx)("span", {
                    className: "shrink-0 text-right tabular-nums",
                    children: Math.round(n.net) !== 0 ? (0, t.jsx)("span", {
                      className: `text-sm font-semibold ${s.color}`,
                      children: s.text
                    }) : null
                  })]
                }, n.month)
              }), (0, t.jsx)("div", {
                className: "h-24"
              })]
            })
          })]
        })
      }), j ? (0, t.jsx)("div", {
        className: "fixed inset-0 z-10 flex items-center justify-center bg-background/60 px-4",
        onClick: () => V(null),
        children: (0, t.jsxs)("div", {
          className: "w-full max-w-sm rounded-lg border border-border bg-card p-4",
          onClick: n => n.stopPropagation(),
          children: [(0, t.jsx)("div", {
            className: "text-sm font-semibold",
            children: j.title
          }), (0, t.jsx)("p", {
            className: "mt-1 text-sm text-muted-foreground",
            children: j.message
          }), (0, t.jsxs)("div", {
            className: "mt-3 flex justify-end gap-2",
            children: [(0, t.jsx)(d.Button, {
              variant: "outline",
              size: "sm",
              onClick: () => V(null),
              children: "\u7559\u5728\u672C\u9801"
            }), (0, t.jsx)(d.Button, {
              variant: "destructive",
              size: "sm",
              onClick: () => {
                let n = j.onConfirm;
                V(null), n()
              },
              children: "\u6368\u68C4\u4E26\u7E7C\u7E8C"
            })]
          })]
        })
      }) : null]
    })
  }
  a(At, "WorkLogView");
  var E = re("react/jsx-runtime");

  function We(r) {
    let e = String(r ?? "").match(/^(\d{1,2}):(\d{2})$/);
    return e ? `${String(Number(e[1])).padStart(2,"0")}:${e[2]}` : String(r ?? "")
  }
  a(We, "toClock");

  function mt({
    itemId: r,
    item: e
  }) {
    let i = !!e?.isSpecialLeave,
      c = !!e?.isLeave,
      p = !!e?.isOvertimePay,
      y = i ? "\u7279\u4F11" : c ? "\u4F11" : "",
      b = i ? "text-chart-mintGreen" : "text-chart-tangerineOrange",
      L = Array.isArray(e?.breaks) ? e.breaks : [],
      M = Number(e?.workMinutes),
      $ = Number.isFinite(M) ? M : ve(e?.clockIn ?? "", e?.clockOut ?? "", L),
      f = !!(e?.clockIn && e?.clockOut),
      T = Q(e),
      m = Ce(e),
      C = f ? `${We(e.clockIn)}-${We(e.clockOut)}` : y || "\u6642\u9593\u5C1A\u672A\u586B\u5B8C",
      S = L.length > 0 ? L.map(v => `${We(v.start)}-${We(v.end)}`).join("\u3001") : "\u7121\u4F11\u606F";
    return (0, E.jsxs)("div", {
      className: "flex items-center gap-3 px-3 py-2 border-b border-border",
      children: [(0, E.jsxs)("div", {
        className: "flex-1 min-w-0",
        children: [(0, E.jsx)("div", {
          className: `font-semibold tabular-nums ${y?b:""}`,
          children: e?.date || e?.name || "\u672A\u5B9A\u65E5\u671F"
        }), (0, E.jsx)("div", {
          className: "text-xs text-muted-foreground tabular-nums truncate",
          children: m ? y : (0, E.jsxs)(E.Fragment, {
            children: [y ? `${y} \xB7 ` : "", C, "\uFF0C\u4F11\u606F ", S, p ? " \xB7 \u52A0\u73ED\u8CBB" : ""]
          })
        }), e?.note ? (0, E.jsx)("div", {
          className: "text-xs text-muted-foreground truncate",
          children: e.note
        }) : null]
      }), (0, E.jsx)("div", {
        className: "shrink-0 text-right",
        children: m ? (0, E.jsx)("div", {
          className: `text-lg font-semibold tabular-nums ${b}`,
          children: y
        }) : (0, E.jsxs)(E.Fragment, {
          children: [(0, E.jsx)("div", {
            className: "text-lg font-semibold tabular-nums",
            children: $ != null ? `${w($)} \u5C0F\u6642` : "\u2014"
          }), (() => {
            let v = $ != null ? Me($, T, p) : "\u7121\u6CD5\u8A08\u7B97";
            return v ? (0, E.jsx)("div", {
              className: `text-xs tabular-nums ${Ye($,T,p)}`,
              children: v
            }) : null
          })(), T ? (0, E.jsxs)("div", {
            className: `text-xs tabular-nums ${b}`,
            children: [y, "\u51FA\u52E4"]
          }) : null]
        })
      })]
    })
  }
  a(mt, "WorkLogItem");
  var ft = {
    light: {
      base: "light",
      ramp: {
        base00: "#F6F8FB",
        base05: "#F1F4F8",
        base10: "#EBEFF5",
        base15: "#E3E8F0",
        base20: "#DAE0EA",
        base25: "#CDD5E1",
        base30: "#BCC6D4",
        base40: "#9AA6B8",
        base50: "#7A879B",
        base60: "#5E6B7F",
        base70: "#445064",
        base100: "#0F1B2D"
      },
      colors: {
        red: "#C0392B",
        orange: "#C77A2A",
        yellow: "#B8962E",
        green: "#2E8B57",
        cyan: "#1B8A9A",
        blue: "#2F6DB5",
        purple: "#6C5BB5",
        pink: "#B5527A"
      },
      accents: {
        navy: "#1E3A5F"
      },
      defaultAccent: "navy",
      semantic: {
        "--card": "#FFFFFF"
      }
    },
    dark: {
      base: "dark",
      ramp: {
        base00: "#0E1624",
        base05: "#121B2B",
        base10: "#162033",
        base15: "#1B263B",
        base20: "#212D44",
        base25: "#28354E",
        base30: "#314059",
        base40: "#435371",
        base50: "#5A6A89",
        base60: "#7C8BA6",
        base70: "#A3AFC4",
        base100: "#E6ECF5"
      },
      colors: {
        red: "#E0675A",
        orange: "#E39A4F",
        yellow: "#D8BC5A",
        green: "#5DBB88",
        cyan: "#4FB8C6",
        blue: "#6E9FDC",
        purple: "#9E8FE0",
        pink: "#DB84A6"
      },
      accents: {
        navy: "#7FA7D9"
      },
      defaultAccent: "navy"
    }
  };

  function Et() {
    return {
      items: (0, ye.useItemsByType)("WORK_LOG_FOLDER"),
      renderIcon: a(() => "clock", "renderIcon")
    }
  }
  a(Et, "useWorkLogSidebarData");
  var ce = class extends ye.Plugin {
    onload() {
      this.registerPluginRoot("worklog"), this.registerSection({
        id: "work-log",
        title: "\u5DE5\u6642\u8A18\u9304",
        orderAt: 760,
        useData: Et
      }), this.registerFolderType(se, {
        folderIcon: "clock",
        views: [{
          type: "work-log-list",
          creator: a(e => new ze(e), "creator")
        }],
        panes: {
          centerPane2: {
            leafId: "leaf-work-log",
            viewType: "work-log-list",
            flex: 1
          }
        },
        children: [{
          class: ae,
          icon: "clock",
          displayText: a(e => `${e.date||e.name||"\u5DE5\u6642\u8A18\u9304"}`, "displayText"),
          embedView: {
            card: {
              component: mt,
              description: "\u55AE\u7B46\u5DE5\u6642\u5361\uFF1A\u65E5\u671F\u3001\u4E0A\u4E0B\u73ED\u6642\u9593\u3001\u4F11\u606F\u6BB5\u6578\u8207\u672C\u65E5\u5DE5\u6642"
            }
          },
          sampleItems: [{
            name: "2026-09-12",
            date: "2026-09-12",
            clockIn: "09:00",
            clockOut: "18:00",
            breaks: [{
              start: "12:00",
              end: "13:00"
            }],
            workMinutes: 480,
            note: ""
          }, {
            name: "2026-09-11",
            date: "2026-09-11",
            clockIn: "09:00",
            clockOut: "19:00",
            breaks: [{
              start: "12:00",
              end: "13:00"
            }, {
              start: "15:30",
              end: "15:45"
            }],
            workMinutes: 525,
            note: "\u4E0B\u5348\u591A\u4F11\u4E00\u6BB5"
          }],
          aiUsageHint: "\u4F7F\u7528\u8005\u8981\u8A18\u9304\u6BCF\u5929\u7684\u4E0A\u73ED\u3001\u4F11\u606F\u8207\u4E0B\u73ED\u6642\u9593\u4E26\u8A08\u7B97\u5DE5\u6642\u6642\u7528"
        }]
      })
    }
  };
  a(ce, "WorkLogPlugin"), ce = Oe([(0, ye.plugin)("80e08c364bca39a2aaa856c3", {
    description: "\u6BCF\u65E5\u4E0A\u4E0B\u73ED\u8207\u591A\u6BB5\u4F11\u606F\u8A18\u9304\uFF0C\u81EA\u52D5\u8A08\u7B97\u5DE5\u6642",
    dependencies: ["Sidebar"],
    theme: ft
  })], ce);
  return xt(Ft);
})();
(() => {
  if (typeof document === 'undefined') return;
  const existing = document.querySelector('style[data-plugin-css=' + "\"80e08c364bca39a2aaa856c3:__tailwind__\"" + ']');
  if (existing) existing.remove();
  const s = document.createElement('style');
  s.setAttribute('data-plugin-css', "80e08c364bca39a2aaa856c3:__tailwind__");
  s.textContent = "@layer properties, theme, base, components, utilities, cubelv-plugin-variants;\n/*! tailwindcss v4.3.2 | MIT License | https://tailwindcss.com */\n@layer properties{@supports (((-webkit-hyphens:none)) and (not (margin-trim:inline))) or ((-moz-orient:inline) and (not (color:rgb(from red r g b)))){*,:before,:after,::backdrop{--tw-translate-x:0;--tw-translate-y:0;--tw-translate-z:0;--tw-border-style:solid;--tw-leading:initial;--tw-font-weight:initial;--tw-ordinal:initial;--tw-slashed-zero:initial;--tw-numeric-figure:initial;--tw-numeric-spacing:initial;--tw-numeric-fraction:initial;--tw-shadow:0 0 #0000;--tw-shadow-color:initial;--tw-shadow-alpha:100%;--tw-inset-shadow:0 0 #0000;--tw-inset-shadow-color:initial;--tw-inset-shadow-alpha:100%;--tw-ring-color:initial;--tw-ring-shadow:0 0 #0000;--tw-inset-ring-color:initial;--tw-inset-ring-shadow:0 0 #0000;--tw-ring-inset:initial;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-offset-shadow:0 0 #0000;--tw-outline-style:solid}}}@layer theme{:root,:host{--spacing:.25rem;--container-sm:24rem;--text-xs:.75rem;--text-xs--line-height:calc(1 / .75);--text-sm:.875rem;--text-sm--line-height:calc(1.25 / .875);--text-lg:1.125rem;--text-lg--line-height:calc(1.75 / 1.125);--font-weight-semibold:600;--font-weight-bold:700;--font-heading:var(--font-heading)}}@layer utilities{.pointer-events-none{pointer-events:none}.absolute{position:absolute}.fixed{position:fixed}.relative{position:relative}.inset-0{inset:0}.top-0{top:0}.top-1\\/2{top:50%}.right-0{right:0}.left-0{left:0}.z-10{z-index:10}.z-20{z-index:20}.mt-0\\.5{margin-top:calc(var(--spacing) * .5)}.mt-1{margin-top:var(--spacing)}.mt-2{margin-top:calc(var(--spacing) * 2)}.mt-3{margin-top:calc(var(--spacing) * 3)}.block{display:block}.flex{display:flex}.grid{display:grid}.hidden{display:none}.h-5{height:calc(var(--spacing) * 5)}.h-24{height:calc(var(--spacing) * 24)}.h-40{height:calc(var(--spacing) * 40)}.h-full{height:100%}.min-h-0{min-height:0}.w-5{width:calc(var(--spacing) * 5)}.w-36{width:calc(var(--spacing) * 36)}.w-64{width:calc(var(--spacing) * 64)}.w-full{width:100%}.max-w-sm{max-width:var(--container-sm)}.min-w-0{min-width:0}.flex-1{flex:1}.flex-\\[2\\]{flex:2}.flex-\\[3\\]{flex:3}.shrink-0{flex-shrink:0}.-translate-y-1\\/2{--tw-translate-y:calc(calc(1 / 2 * 100%) * -1);translate:var(--tw-translate-x) var(--tw-translate-y)}.cursor-pointer{cursor:pointer}.\\[scrollbar-width\\:none\\]{scrollbar-width:none}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.flex-col{flex-direction:column}.items-center{align-items:center}.items-end{align-items:flex-end}.items-stretch{align-items:stretch}.justify-center{justify-content:center}.justify-end{justify-content:flex-end}.gap-1{gap:var(--spacing)}.gap-1\\.5{gap:calc(var(--spacing) * 1.5)}.gap-2{gap:calc(var(--spacing) * 2)}.gap-3{gap:calc(var(--spacing) * 3)}.truncate{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.overflow-x-auto{overflow-x:auto}.overflow-y-auto{overflow-y:auto}.rounded{border-radius:.25rem}.rounded-full{border-radius:3.40282e38px}.rounded-lg{border-radius:var(--radius)}.rounded-md{border-radius:calc(var(--radius) - 2px)}.border{border-style:var(--tw-border-style);border-width:1px}.border-b{border-bottom-style:var(--tw-border-style);border-bottom-width:1px}.border-border{border-color:var(--border)}.border-chart-mintGreen{border-color:var(--chart-mintGreen)}.border-chart-sunsetOrange{border-color:var(--chart-sunsetOrange)}.border-chart-tangerineOrange{border-color:var(--chart-tangerineOrange)}.border-foreground\\/40{border-color:var(--foreground)}@supports (color:color-mix(in lab, red, red)){.border-foreground\\/40{border-color:color-mix(in oklab, var(--foreground) 40%, transparent)}}.bg-accent{background-color:var(--accent)}.bg-background,.bg-background\\/60{background-color:var(--background)}@supports (color:color-mix(in lab, red, red)){.bg-background\\/60{background-color:color-mix(in oklab, var(--background) 60%, transparent)}}.bg-card{background-color:var(--card)}.bg-chart-mintGreen,.bg-chart-mintGreen\\/10{background-color:var(--chart-mintGreen)}@supports (color:color-mix(in lab, red, red)){.bg-chart-mintGreen\\/10{background-color:color-mix(in oklab, var(--chart-mintGreen) 10%, transparent)}}.bg-chart-sunsetOrange,.bg-chart-sunsetOrange\\/10{background-color:var(--chart-sunsetOrange)}@supports (color:color-mix(in lab, red, red)){.bg-chart-sunsetOrange\\/10{background-color:color-mix(in oklab, var(--chart-sunsetOrange) 10%, transparent)}}.bg-chart-tangerineOrange,.bg-chart-tangerineOrange\\/10{background-color:var(--chart-tangerineOrange)}@supports (color:color-mix(in lab, red, red)){.bg-chart-tangerineOrange\\/10{background-color:color-mix(in oklab, var(--chart-tangerineOrange) 10%, transparent)}}.bg-primary{background-color:var(--primary)}.p-4{padding:calc(var(--spacing) * 4)}.px-2{padding-inline:calc(var(--spacing) * 2)}.px-3{padding-inline:calc(var(--spacing) * 3)}.px-4{padding-inline:calc(var(--spacing) * 4)}.py-1{padding-block:var(--spacing)}.py-1\\.5{padding-block:calc(var(--spacing) * 1.5)}.py-2{padding-block:calc(var(--spacing) * 2)}.py-2\\.5{padding-block:calc(var(--spacing) * 2.5)}.py-8{padding-block:calc(var(--spacing) * 8)}.py-px{padding-block:1px}.pt-2{padding-top:calc(var(--spacing) * 2)}.pt-6{padding-top:calc(var(--spacing) * 6)}.pb-3{padding-bottom:calc(var(--spacing) * 3)}.text-center{text-align:center}.text-left{text-align:left}.text-right{text-align:right}.text-lg{font-size:var(--text-lg);line-height:var(--tw-leading,var(--text-lg--line-height))}.text-sm{font-size:var(--text-sm);line-height:var(--tw-leading,var(--text-sm--line-height))}.text-xs{font-size:var(--text-xs);line-height:var(--tw-leading,var(--text-xs--line-height))}.leading-5{--tw-leading:calc(var(--spacing) * 5);line-height:calc(var(--spacing) * 5)}.leading-6{--tw-leading:calc(var(--spacing) * 6);line-height:calc(var(--spacing) * 6)}.leading-none{--tw-leading:1;line-height:1}.font-bold{--tw-font-weight:var(--font-weight-bold);font-weight:var(--font-weight-bold)}.font-semibold{--tw-font-weight:var(--font-weight-semibold);font-weight:var(--font-weight-semibold)}.text-chart-cherryRed{color:var(--chart-cherryRed)}.text-chart-mintGreen{color:var(--chart-mintGreen)}.text-chart-sunsetOrange{color:var(--chart-sunsetOrange)}.text-chart-tangerineOrange{color:var(--chart-tangerineOrange)}.text-destructive{color:var(--destructive)}.text-foreground{color:var(--foreground)}.text-muted-foreground{color:var(--muted-foreground)}.text-primary-foreground{color:var(--primary-foreground)}.tabular-nums{--tw-numeric-spacing:tabular-nums;font-variant-numeric:var(--tw-ordinal,) var(--tw-slashed-zero,) var(--tw-numeric-figure,) var(--tw-numeric-spacing,) var(--tw-numeric-fraction,)}.shadow-lg{--tw-shadow:0 10px 15px -3px var(--tw-shadow-color,#0000001a), 0 4px 6px -4px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.outline{outline-style:var(--tw-outline-style);outline-width:1px}}@layer cubelv-plugin-variants{.\\[\\&\\:\\:-webkit-scrollbar\\]\\:hidden::-webkit-scrollbar{display:none}}@property --tw-translate-x{syntax:\"*\";inherits:false;initial-value:0}@property --tw-translate-y{syntax:\"*\";inherits:false;initial-value:0}@property --tw-translate-z{syntax:\"*\";inherits:false;initial-value:0}@property --tw-border-style{syntax:\"*\";inherits:false;initial-value:solid}@property --tw-leading{syntax:\"*\";inherits:false}@property --tw-font-weight{syntax:\"*\";inherits:false}@property --tw-ordinal{syntax:\"*\";inherits:false}@property --tw-slashed-zero{syntax:\"*\";inherits:false}@property --tw-numeric-figure{syntax:\"*\";inherits:false}@property --tw-numeric-spacing{syntax:\"*\";inherits:false}@property --tw-numeric-fraction{syntax:\"*\";inherits:false}@property --tw-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-shadow-color{syntax:\"*\";inherits:false}@property --tw-shadow-alpha{syntax:\"<percentage>\";inherits:false;initial-value:100%}@property --tw-inset-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-inset-shadow-color{syntax:\"*\";inherits:false}@property --tw-inset-shadow-alpha{syntax:\"<percentage>\";inherits:false;initial-value:100%}@property --tw-ring-color{syntax:\"*\";inherits:false}@property --tw-ring-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-inset-ring-color{syntax:\"*\";inherits:false}@property --tw-inset-ring-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-ring-inset{syntax:\"*\";inherits:false}@property --tw-ring-offset-width{syntax:\"<length>\";inherits:false;initial-value:0}@property --tw-ring-offset-color{syntax:\"*\";inherits:false;initial-value:#fff}@property --tw-ring-offset-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-outline-style{syntax:\"*\";inherits:false;initial-value:solid}";
  document.head.appendChild(s);
})();
