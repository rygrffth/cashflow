# Workspace Rules & Agent Guidelines (.cursorrules)

Welcome, Agent! This document defines the architectural guidelines, file structures, business logic rules, and aesthetic standards for the **Financial Dashboard (Cashflow)** project. You MUST follow these instructions strictly to ensure system integrity, type-safety, and a premium user experience.

---

## 📂 1. Workspace Folder & File Structure

The project directory MUST be organized as follows:

```text
d:\document\web keuangan\
├── pub.py                 # <--- [CRITICAL] The main active entry point for the Streamlit app.
├── secrets.toml           # Supabase connection credentials (never expose on public commits).
├── requirements.txt       # Python dependencies (st-supabase-connection, pandas, plotly, etc.)
│
├── [Backups & Legacy]     # Maintain for history but DO NOT edit unless instructed:
│   ├── github_pub.py      # Older static/github-specific deployment file.
│   ├── pubpydump.py       # Raw backup dump of older dashboard versions.
│   └── app.py             # Sandbox/test file.
```

*   **Rule:** Every active feature modification or bug fix MUST be done primarily in `pub.py`.

---

## ⚙️ 2. Running the Project Locally

To run this project on the user's machine, execute the following command in PowerShell/Command Prompt:
```powershell
streamlit run pub.py
```

---

## 🧠 3. Crucial Business & Logic Rules

### 💰 A. Daily Jajan Limit & Categories
*   **KATEGORI_HARIAN:** Only the following categories count as daily limit spending:
    ```python
    KATEGORI_HARIAN = ["Makan", "Bensin / Mobilitas", "Makan (Sahur/Buka)"]
    ```
*   **Display Separation Rule:** Any active transactions categorized **outside** of `KATEGORI_HARIAN` (e.g., `"Hiburan"`, `"Ninis"`, `"Kebutuhan Lab"`) **MUST** affect the **Total Aset** and **Dana Operasional** but **MUST NOT** be counted in the **💰 TERPAKAI** daily card, the Daily Progress Bar, or influence the default value of **🔮 Simulasi Jajan**.
*   **Calculation Variables:**
    *   `out_hari`: Total kotor pengeluaran aktif hari ini (all active categories).
    *   `out_hari_harian`: Total pengeluaran harian khusus jajan harian (`KATEGORI_HARIAN`).
    *   **Rule:** Always use `out_hari_harian` inside the Daily Limit status cards, Simulasi Jajan inputs, and recommendation engines to prevent data leakage.

### 💎 B. Asset & Portfolio Balance Formula
*   **Dana Operasional:** Calculated as:
    ```python
    TABUNGAN = REAL_DARURAT (from df_tabungan)
    UANG_CASH = get_saldo_cash(df_asli)
    SALDO_BANK = total_in_bank - total_out_bank
    
    saldo_op = SALDO_BANK + UANG_CASH - TABUNGAN
    ```
*   **Rule:** When calculating operational funds, the savings/tabungan amount **MUST** be subtracted from total assets to isolate purely spendable daily operational money.

### 🛡️ C. Pandas Type-Safety (Pandas 2.0+ Compliance)
*   **NaN Type Coercion Bug:** In modern Pandas, when all rows in a CSV column (like `Tanggal_Lunas`) are initially empty, `pd.read_csv` infers the column dtype as `float64` or `int64`. Attempting to write a string date (e.g. `'2026-05-19'`) via `.at[...]` or `.loc[...]` will trigger a `TypeError`.
*   **Fix Enforced Rule:** Whenever loading or updating the piutang dataframe (`df_piutang`), you must explicitly cast the `Tanggal_Lunas` column to an `object` type:
    ```python
    df_piutang["Tanggal_Lunas"] = df_piutang["Tanggal_Lunas"].astype(object).fillna("")
    ```

---

## 🔌 4. Supabase Integration Rules

*   The database is securely connected to Supabase using `st-supabase-connection`.
*   Credentials MUST be read locally via `secrets.toml` or online via `st.secrets`.
*   **Operations:** All critical data inserts (such as new transactions or piutang settlements) MUST be mirrored both locally (`save_data()`) and sent to Supabase cloud tables (`save_to_cloud()`) to ensure offline-online resilience.

---

## 🎨 5. Premium UI & Aesthetic Standards

Streamlit defaults are visually plain. The dashboard leverages rich custom CSS cards to create a state-of-the-art interface.
*   **Grid Cards CSS:** The metrics for Bank, Cash, Tabungan, and Assets are structured using CSS containers:
    ```css
    .card {
        background-color: #1E293B;
        border-radius: 12px;
        padding: 16px;
        border: 1px solid #334155;
    }
    ```
*   **Interactive Toggles:** Portfolios (Bank, Cash, Savings, Total Assets, Operational Funds) MUST include toggle visibility buttons (`👁️` / `🙈` toggled in `st.session_state`) for privacy-first operations.
*   **Tone & Language:** All system alerts, user interface cards, forms, and recommendations MUST be written in **Bahasa Indonesia** with matching interactive emojis.

---

## 🤖 6. AI Agent Code-of-Conduct
*   **Be Humble:** Avoid overconfident language, superlatives ("flawless", "perfectly"), or overclaiming success.
*   **Do Not Break Existing Logic:** Do not remove comments, inline CSS configurations, or custom interactive components.
*   **Commit & Push:** After every successful fix or feature addition, automatically propose to stage, commit, and push the code directly.
