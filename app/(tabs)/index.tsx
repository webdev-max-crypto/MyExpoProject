import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from "react-native";
import * as SQLite from "expo-sqlite";

/* ================= SAFE MATH ENGINE WITH STEPS ================= */
const calculateExpressionWithSteps = (expr: string): { result: number; steps: string[] } => {
  if (!/^[0-9+\-*/.() ]+$/.test(expr)) throw new Error("Invalid expression");

  const ops: any = { "+": 1, "-": 1, "*": 2, "/": 2 };
  const stack: any[] = [];
  const output: any[] = [];
  const steps: string[] = [];

  const tokens = expr.match(/\d+(\.\d+)?|[()+\-*/]/g);
  if (!tokens) throw new Error("Invalid");

  tokens.forEach((t) => {
    if (!isNaN(Number(t))) output.push(Number(t));
    else if (t in ops) {
      while (stack.length && ops[stack[stack.length - 1]] >= ops[t]) {
        output.push(stack.pop());
      }
      stack.push(t);
    } else if (t === "(") stack.push(t);
    else if (t === ")") {
      while (stack.length && stack[stack.length - 1] !== "(")
        output.push(stack.pop());
      stack.pop();
    }
  });

  while (stack.length) output.push(stack.pop());

  const calc: number[] = [];
  output.forEach((t) => {
    if (typeof t === "number") calc.push(t);
    else {
      const b = calc.pop()!;
      const a = calc.pop()!;
      let res = 0;
      switch (t) {
        case "+": res = a + b; break;
        case "-": res = a - b; break;
        case "*": res = a * b; break;
        case "/": res = a / b; break;
      }
      steps.push(`${a} ${t} ${b} = ${res}`);
      calc.push(res);
    }
  });

  return { result: calc[0], steps };
};

export default function App() {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isScientific, setIsScientific] = useState(false);

  /* ================= DB INIT ================= */
  useEffect(() => {
    const initDB = async () => {
      const database = await SQLite.openDatabaseAsync("calculator.db");
      setDb(database);

      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS calculations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          input TEXT,
          result TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const rows = await database.getAllAsync(
        "SELECT * FROM calculations ORDER BY id DESC LIMIT 20"
      );
      setHistory(rows as any[]);
    };
    initDB();
  }, []);

  /* ================= BASIC FUNCTIONS ================= */
  const handlePress = (v: string) => {
    if (v === "=") calculateResult();
    else if (v === "C") {
      setInput("");
      setResult("");
      setSteps([]);
    } else setInput((p) => p + v);
  };

  const calculateResult = async () => {
    try {
      const { result: res, steps } = calculateExpressionWithSteps(input);
      setResult(res.toString());
      setSteps(steps);

      const entry = { input, result: res.toString() };
      setHistory((p) => [entry, ...p]);

      if (db)
        await db.runAsync(
          "INSERT INTO calculations (input, result) VALUES (?,?)",
          [input, res.toString()]
        );
    } catch {
      setResult("Error");
      setSteps([]);
    }
  };

  /* ================= SCIENTIFIC FUNCTIONS ================= */
  const factorial = (n: number) => {
    if (n < 0) return NaN;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  };

  const calculateScientific = async (func: string) => {
    try {
      const v = Number(input);
      let r: number;

      switch (func) {
        case "sin": r = Math.sin(v); break;
        case "cos": r = Math.cos(v); break;
        case "tan": r = Math.tan(v); break;
        case "log": r = Math.log10(v); break;
        case "ln": r = Math.log(v); break;
        case "√": r = Math.sqrt(v); break;
        case "^": r = Math.pow(v, 2); break;
        case "!": r = factorial(v); break;
        case "π": r = Math.PI; break;
        case "e": r = Math.E; break;
        default: return;
      }

      const res = r.toString();
      setResult(res);
      setSteps([`${func}(${v}) = ${res}`]); // Show as a single step

      const entry = { input: `${func}(${input})`, result: res };
      setHistory((p) => [entry, ...p]);
      if (db)
        await db.runAsync(
          "INSERT INTO calculations (input, result) VALUES (?,?)",
          [entry.input, res]
        );
    } catch {
      setResult("Error");
      setSteps([]);
    }
  };

  const clearHistory = async () => {
    if (!db) return;
    await db.execAsync("DELETE FROM calculations");
    setHistory([]);
  };

  /* ================= BUTTONS ================= */
  const basicButtons = [
    ["7", "8", "9", "/"],
    ["4", "5", "6", "*"],
    ["1", "2", "3", "-"],
    ["0", ".", "=", "+"],
    ["C"],
  ];

  const scientificButtons = [
    ["sin", "cos", "tan", "log", "ln", "√", "^", "!"],
    ["π", "e"],
  ];

  /* ================= UI ================= */
  return (
    <View style={styles.screen}>
      <View style={styles.calculatorWrapper}>

        {/* ====== DISPLAY ====== */}
        <View style={styles.display}>
          <Text style={styles.input}>{input || "0"}</Text>
          <Text style={styles.result}>{result}</Text>
        </View>

        {/* ====== STEP-BY-STEP DISPLAY ====== */}
        {steps.length > 0 && (
          <View style={{ backgroundColor: "#1e1e1e", padding: 8, borderRadius: 8, marginBottom: 5 }}>
            {steps.map((s, i) => (
              <Text key={i} style={{ color: "#FFD700", fontSize: 14 }}>{s}</Text>
            ))}
          </View>
        )}

        {/* ====== TOGGLE BUTTON ====== */}
        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 5 }}>
          <TouchableOpacity
            style={{
              padding: 8,
              backgroundColor: "#FF9800",
              borderRadius: 6,
            }}
            onPress={() => setIsScientific(prev => !prev)}
          >
            <Text style={{ color: "#fff", fontWeight: "bold" }}>
              {isScientific ? "Basic Mode" : "Scientific Mode"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ====== HISTORY ====== */}
        <View style={styles.historyWrapper}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>History</Text>
            <TouchableOpacity onPress={clearHistory}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.historyBox}>
            {history.length === 0 ? (
              <Text style={styles.noHistory}>No history yet</Text>
            ) : (
              history.map((h, i) => (
                <View key={i} style={styles.historyItem}>
                  <Text style={styles.historyInput}>{h.input}</Text>
                  <Text style={styles.historyResult}>= {h.result}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>

        {/* ====== SCIENTIFIC BUTTONS ====== */}
        {isScientific &&
          scientificButtons.map((row, i) => (
            <View key={i} style={styles.row}>
              {row.map((b) => (
                <TouchableOpacity
                  key={b}
                  style={[styles.button, styles.scientific]}
                  onPress={() => calculateScientific(b)}
                >
                  <Text style={styles.btnText}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}

        {/* ====== BASIC BUTTONS ====== */}
        {basicButtons.map((row, i) => (
          <View key={i} style={styles.row}>
            {row.map((b) => (
              <TouchableOpacity
                key={b}
                style={styles.button}
                onPress={() => handlePress(b)}
              >
                <Text style={styles.btnText}>{b}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

      </View>
    </View>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
  },
  calculatorWrapper: {
    width: "90%",
    maxWidth: 420,
  },
  display: {
    backgroundColor: "#222",
    padding: 15,
    borderRadius: 10,
    alignItems: "flex-end",
    marginBottom: 8,
  },
  input: { fontSize: 28, color: "#fff" },
  result: { fontSize: 20, color: "#aaa" },

  historyWrapper: { maxHeight: 200, marginBottom: 10 },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  historyTitle: { color: "#fff", fontWeight: "bold" },
  clearText: { color: "red", fontWeight: "bold" },
  historyBox: {
    backgroundColor: "#1e1e1e",
    borderRadius: 8,
    padding: 6,
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  historyInput: { color: "#ccc", fontSize: 14 },
  historyResult: { color: "#fff", fontSize: 14 },
  noHistory: { color: "#777", textAlign: "center" },

  row: { flexDirection: "row", marginBottom: 5 },
  button: {
    flex: 1,
    margin: 3,
    padding: 12,
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    alignItems: "center",
  },
  scientific: { backgroundColor: "#FF5722" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
