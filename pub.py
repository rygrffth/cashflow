import streamlit as st
import pandas as pd
import datetime
import os
import streamlit.components.v1 as components
import plotly.express as px
import plotly.graph_objects as go
import imaplib
import email
from email.header import decode_header
import re
import tomllib


DATA_FILE      = "keuangan_ramadan.csv"
PIUTANG_FILE   = "piutang.csv"
BUDGET_FILE    = "budget_target.csv"
RECURRING_FILE = "recurring.csv"

st.set_page_config(page_title="Financial Dashboard", page_icon="💼", layout="wide")

st.markdown("""
<style>
.stApp { background-color: #0F172A; }
.main .block-container { padding-top: 1.2rem; }

[data-testid="metric-container"] {
    background: linear-gradient(135deg,#1E293B,#0F172A);
    border:1px solid #334155; border-radius:12px;
    padding:16px 20px; box-shadow:0 4px 15px rgba(0,0,0,.3);
    transition:transform .2s,box-shadow .2s;
}
[data-testid="metric-container"]:hover {
    transform:translateY(-2px);
    box-shadow:0 6px 20px rgba(16,185,129,.15);
    border-color:#10B981;
}
[data-testid="metric-container"] label { color:#94A3B8!important; font-size:.78rem!important; text-transform:uppercase; letter-spacing:.08em; }
[data-testid="metric-container"] [data-testid="stMetricValue"] { color:#F1F5F9!important; font-size:1.4rem!important; font-weight:700!important; }

[data-testid="stSidebar"] { background-color:#1E293B; border-right:1px solid #334155; }

.stButton>button {
    background:linear-gradient(135deg,#10B981,#059669);
    color:white; border:none; border-radius:8px;
    font-weight:600; padding:.5rem 1.2rem; transition:all .2s;
}
.stButton>button:hover {
    background:linear-gradient(135deg,#059669,#047857);
    box-shadow:0 4px 12px rgba(16,185,129,.4); transform:translateY(-1px);
}

hr { border-color:#334155!important; }
h1,h2,h3 { color:#F1F5F9!important; }
h1 { font-size:1.8rem!important; }

[data-testid="stForm"] { background-color:#1E293B; border:1px solid #334155; border-radius:12px; padding:20px; }

.stTabs [data-baseweb="tab-list"] { background-color:#1E293B; border-radius:10px; padding:4px; }
.stTabs [data-baseweb="tab"] { color:#94A3B8!important; border-radius:8px!important; }
.stTabs [aria-selected="true"] { background-color:#10B981!important; color:white!important; }

.stProgress>div>div { background:linear-gradient(90deg,#10B981,#34D399)!important; border-radius:99px!important; }
.stProgress>div { background-color:#334155!important; border-radius:99px!important; }

::-webkit-scrollbar { width:6px; height:6px; }
::-webkit-scrollbar-track { background:#0F172A; }
::-webkit-scrollbar-thumb { background:#334155; border-radius:3px; }
::-webkit-scrollbar-thumb:hover { background:#10B981; }

.card { background:linear-gradient(135deg,#1E293B,#0F172A); border:1px solid #334155; border-radius:12px; padding:18px 20px; margin-bottom:12px; }
.card-warn   { border-color:#F59E0B; background:linear-gradient(135deg,rgba(245,158,11,.08),#1E293B); }
.card-danger { border-color:#EF4444; background:linear-gradient(135deg,rgba(239,68,68,.08),#1E293B); }
.card-green  { border-color:#10B981; background:linear-gradient(135deg,rgba(16,185,129,.08),#1E293B); }
.card-label  { color:#64748B; font-size:.72rem; text-transform:uppercase; letter-spacing:.1em; margin:0 0 6px 0; }
.card-value  { font-size:1.7rem; font-weight:700; margin:0; }
.card-sub    { color:#64748B; font-size:.8rem; margin:4px 0 0 0; }
</style>
""", unsafe_allow_html=True)


from st_supabase_connection import SupabaseConnection

try:
    with open("secrets.toml", "rb") as f:
        secrets_data = tomllib.load(f)
    s_url = secrets_data["connections"]["supabase"]["SUPABASE_URL"]
    s_key = secrets_data["connections"]["supabase"]["SUPABASE_KEY"]
except FileNotFoundError:
   
    s_url = st.secrets["connections"]["supabase"]["SUPABASE_URL"]
    s_key = st.secrets["connections"]["supabase"]["SUPABASE_KEY"]

conn = st.connection(
    "supabase",
    type=SupabaseConnection,
    url=s_url,
    key=s_key
)


@st.cache_data(ttl=5)  # Cache hanya 10 detik, atau bisa 0 untuk no cache
def load_data_cloud():
    """Fungsi ambil data dari Supabase menggunakan .table().select()"""
    try:
        res = conn.table("transaksi").select("*").execute()
        
        if res.data:
            df = pd.DataFrame(res.data)
        
            nama_kolom_baru = {
                "tanggal": "Tanggal",
                "tipe": "Tipe",
                "kategori": "Kategori",
                "nominal": "Nominal",
                "catatan": "Catatan",
                "status": "Status",
                "tenggat_waktu": "Tenggat_Waktu",
                "tanggal_bayar": "Tanggal_Bayar",
                "sumber": "Sumber"
            }
            
            df = df.rename(columns=nama_kolom_baru)
            
            df["Nominal"] = pd.to_numeric(df["Nominal"], errors="coerce").fillna(0)
            
            # Debug: cek apakah kolom Sumber ada
            if "Sumber" not in df.columns:
                df["Sumber"] = "Bank"
                st.sidebar.warning("⚠️ Kolom Sumber tidak ditemukan, set default ke Bank")
            
            return df
            
    except Exception as e:
        st.sidebar.error(f"Koneksi Cloud Bermasalah: {e}")
        
    # Return dengan kolom Sumber
    return pd.DataFrame(columns=[
        "Tanggal","Tipe","Kategori","Nominal",
        "Catatan","Status","Tenggat_Waktu",
        "Tanggal_Bayar","Sumber"
    ])

def load_settings_cloud():
    """Load settings dari Supabase"""
    try:
        res = conn.table("settings").select("*").execute()
        if res.data:
            df = pd.DataFrame(res.data)
            settings_dict = {}
            for _, row in df.iterrows():
                key = row["key"]
                value = row["value"]
                tipe = row.get("tipe_data", "string")
                
                # Konversi tipe data
                if tipe == "date" and value:
                    try:
                        value = datetime.datetime.strptime(value, "%Y-%m-%d").date()
                    except:
                        pass
                elif tipe == "integer" and value:
                    try:
                        value = int(value)
                    except:
                        pass
                    
                settings_dict[key] = value
            return settings_dict
    except Exception as e:
        st.sidebar.error(f"Gagal load settings: {e}")
    
    # Default value
    return {
        "tanggal_gajian": datetime.date(2026, 3, 17)
    }

def save_setting_cloud(key, value, tipe_data="string"):
    """Simpan setting ke Supabase"""
    try:
        # Konversi value ke string untuk disimpan
        if isinstance(value, (datetime.date, datetime.datetime)):
            str_value = value.strftime("%Y-%m-%d")
        else:
            str_value = str(value)
        
        # Cek apakah sudah ada
        existing = conn.table("settings").select("*").eq("key", key).execute()
        
        if existing.data:
            # Update
            conn.table("settings").update({
                "value": str_value,
                "tipe_data": tipe_data
            }).eq("key", key).execute()
        else:
            # Insert
            conn.table("settings").insert({
                "key": key,
                "value": str_value,
                "tipe_data": tipe_data
            }).execute()
        
        st.cache_data.clear()
        return True
    except Exception as e:
        st.error(f"Gagal simpan setting: {e}")
        return False


def load_tabungan_cloud():
    """Load data tabungan dari Supabase"""
    try:
        res = conn.table("tabungan").select("*").execute()
        if res.data:
            df = pd.DataFrame(res.data)
            # Rename kolom ke format Indonesia
            df = df.rename(columns={
                "nama": "Nama",
                "target_nominal": "Target",
                "nominal_terkumpul": "Terkumpul",
                "tanggal_mulai": "Tanggal_Mulai",
                "tanggal_target": "Tanggal_Target",
                "kategori": "Kategori",
                "prioritas": "Prioritas",
                "catatan": "Catatan",
                "status": "Status"
            })
            return df
    except Exception as e:
        st.sidebar.error(f"Gagal load tabungan: {e}")
    return pd.DataFrame(columns=["Nama", "Target", "Terkumpul", "Tanggal_Mulai", 
                                 "Tanggal_Target", "Kategori", "Prioritas", "Catatan", "Status"])



def save_tabungan_to_cloud(data):
    """Simpan data tabungan ke Supabase"""
    try:
        clean_data = {k.lower(): v for k, v in data.items()}
        conn.table("tabungan").insert(clean_data).execute()
        st.cache_data.clear()
        return True
    except Exception as e:
        st.error(f"Gagal simpan tabungan: {e}")
        return False

def update_tabungan_cloud(tabungan_id, data):
    """Update data tabungan di Supabase"""
    try:
        clean_data = {k.lower(): v for k, v in data.items()}
        conn.table("tabungan").update(clean_data).eq("id", tabungan_id).execute()
        st.cache_data.clear()
        return True
    except Exception as e:
        st.error(f"Gagal update tabungan: {e}")
        return False

def delete_tabungan_cloud(tabungan_id):
    """Hapus tabungan dari Supabase"""
    try:
        conn.table("tabungan").delete().eq("id", tabungan_id).execute()
        st.cache_data.clear()
        return True
    except Exception as e:
        st.error(f"Gagal hapus tabungan: {e}")
        return False

def load_transaksi_tabungan_cloud(tabungan_id=None):
    """Load histori transaksi tabungan"""
    try:
        query = conn.table("transaksi_tabungan").select("*")
        if tabungan_id:
            query = query.eq("tabungan_id", tabungan_id)
        res = query.execute()
        if res.data:
            df = pd.DataFrame(res.data)
            df = df.rename(columns={
                "tabungan_id": "Tabungan_ID",
                "tanggal": "Tanggal",
                "nominal": "Nominal",
                "tipe": "Tipe",
                "catatan": "Catatan"
            })
            return df
    except Exception as e:
        st.sidebar.error(f"Gagal load transaksi tabungan: {e}")
    return pd.DataFrame(columns=["Tabungan_ID", "Tanggal", "Nominal", "Tipe", "Catatan"])

def save_to_cloud(row_dict): 
    """Fungsi khusus untuk insert ke tabel transaksi"""
    try:
        clean_dict = {k.lower(): v for k, v in row_dict.items()}
        conn.table("transaksi").insert(clean_dict).execute()
        st.cache_data.clear()
        return True
    except Exception as e:
        st.error(f"Gagal simpan ke Cloud: {e}")
        return False

def load_cash_cloud():
    """Load data cash dari Supabase"""
    try:
        res = conn.table("cash").select("*").order("created_at", desc=True).limit(1).execute()
        if res.data:
            return res.data[0]["nominal"]
    except Exception as e:
        st.sidebar.error(f"Gagal load cash: {e}")
    return 0

def update_cash_cloud(nominal_baru, catatan=""):
    """Update saldo cash"""
    try:
        data = {
            "nominal": nominal_baru,
            "tanggal_update": datetime.date.today().strftime("%Y-%m-%d"),
            "catatan": catatan
        }
        conn.table("cash").insert(data).execute()
        st.cache_data.clear()
        return True
    except Exception as e:
        st.error(f"Gagal update cash: {e}")
        return False

def load_transaksi_cash_cloud(limit=50):
    """Load history transaksi cash"""
    try:
        res = conn.table("transaksi_cash").select("*").order("tanggal", desc=True).limit(limit).execute()
        if res.data:
            df = pd.DataFrame(res.data)
            df = df.rename(columns={
                "tanggal": "Tanggal",
                "tipe": "Tipe",
                "nominal": "Nominal",
                "kategori": "Kategori",
                "catatan": "Catatan",
                "status": "Status"
            })
            return df
    except Exception as e:
        st.sidebar.error(f"Gagal load transaksi cash: {e}")
    return pd.DataFrame(columns=["Tanggal", "Tipe", "Nominal", "Kategori", "Catatan", "Status"])

def save_transaksi_cash_cloud(data):
    """Simpan transaksi cash"""
    try:
        clean_data = {k.lower(): v for k, v in data.items()}
        conn.table("transaksi_cash").insert(clean_data).execute()
        st.cache_data.clear()
        return True
    except Exception as e:
        st.error(f"Gagal simpan transaksi cash: {e}")
        return False

def update_status_cash_cloud(transaksi_id, status_baru):
    """Update status transaksi cash (untuk tarik)"""
    try:
        conn.table("transaksi_cash").update({"status": status_baru}).eq("id", transaksi_id).execute()
        st.cache_data.clear()
        return True
    except Exception as e:
        st.error(f"Gagal update status: {e}")
        return False


def load_data():
    if os.path.exists(DATA_FILE):
        df = pd.read_csv(DATA_FILE)
        df["Nominal"] = pd.to_numeric(df["Nominal"], errors="coerce").fillna(0)
        for col, default in [("Status","Cleared"),("Tenggat_Waktu",""),("Tanggal_Bayar","")]:
            if col not in df.columns: df[col] = default
        return df
    return pd.DataFrame(columns=["Tanggal","Tipe","Kategori","Nominal","Catatan","Status","Tenggat_Waktu","Tanggal_Bayar"])

def save_data(df):
    df.drop(columns=[c for c in ["Tanggal_dt","Cashflow_Date"] if c in df.columns]).to_csv(DATA_FILE, index=False)

def load_piutang():
    if os.path.exists(PIUTANG_FILE):
        df = pd.read_csv(PIUTANG_FILE)
        df["Nominal"] = pd.to_numeric(df["Nominal"], errors="coerce").fillna(0)
        return df
    return pd.DataFrame(columns=["Tanggal","Nama","Nominal","Catatan","Status","Tenggat","Tanggal_Lunas"])

def save_piutang(df): df.to_csv(PIUTANG_FILE, index=False)

def load_budget():
    if os.path.exists(BUDGET_FILE):
        df = pd.read_csv(BUDGET_FILE)
        df["Target"] = pd.to_numeric(df["Target"], errors="coerce").fillna(0)
        return df
    return pd.DataFrame(columns=["Kategori","Target"])

def save_budget(df): df.to_csv(BUDGET_FILE, index=False)

def load_recurring():
    if os.path.exists(RECURRING_FILE):
        df = pd.read_csv(RECURRING_FILE)
        df["Nominal"] = pd.to_numeric(df["Nominal"], errors="coerce").fillna(0)
        return df
    return pd.DataFrame(columns=["Nama","Kategori","Nominal","Tanggal_Mulai","Frekuensi","Aktif","Catatan"])

def save_recurring(df): df.to_csv(RECURRING_FILE, index=False)

def fetch_mandiri_emails(gmail_user, gmail_pass, limit=10):
    """Ambil email notifikasi Mandiri dari Gmail dan parse transaksinya."""
    results = []
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(gmail_user, gmail_pass)
        mail.select("inbox")

        _, data = mail.search(None, 'FROM "noreply.livin@bankmandiri.co.id"')
        email_ids = data[0].split()
        email_ids = email_ids[-limit:][::-1]

        for eid in email_ids:
            _, msg_data = mail.fetch(eid, "(RFC822)")
            msg = email.message_from_bytes(msg_data[0][1])
            subject_raw = decode_header(msg["Subject"])[0]
            subject = subject_raw[0].decode(subject_raw[1] or "utf-8") if isinstance(subject_raw[0], bytes) else subject_raw[0]
            if any(k in subject for k in ["Tidak Berhasil", "Gagal", "Failed", "Ditolak"]):
                continue
            body = ""
            body_html = ""
            if msg.is_multipart():
                for part in msg.walk():
                    ct = part.get_content_type()
                    if ct == "text/plain":
                        body = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                    elif ct == "text/html":
                        body_html = part.get_payload(decode=True).decode("utf-8", errors="ignore")
            else:
                body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")
            if not body.strip() and body_html:
                import html as html_parser
                body = re.sub(r'<[^>]+>', ' ', body_html)
                body = html_parser.unescape(body)
                body = re.sub(r'\s+', ' ', body).strip()
            if "debug_body" not in st.session_state:
                st.session_state["debug_body"] = body[:3000]
        
            nominal_match = re.search(r'Total\s*Transaksi\s*Rp\s*([\d.,]+)', body)
            if not nominal_match:
                nominal_match = re.search(r'Nominal\s*Transaksi\s*Rp\s*([\d.,]+)', body)
            if not nominal_match:
                nominal_match = re.search(r'Nominal\s*Top-?up\s*Rp\s*([\d.,]+)', body)
            if not nominal_match:
                nominal_match = re.search(r'Nominal\s*Transfer\s*Rp\s*([\d.,]+)', body)
            if not nominal_match:
                nominal_match = re.search(r'Rp\s*([\d.,]+)', body)
            nominal = 0
            if nominal_match:
                nominal_str = nominal_match.group(1).replace('.', '').replace(',', '.')
                try: nominal = int(float(nominal_str))
                except: pass

            tgl_match = re.search(r'Tanggal\s*(\d{1,2}\s+\w+\s+\d{4})', body)
            if not tgl_match:
                tgl_match = re.search(r'(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)\s+\d{4})', body)
            if not tgl_match:
                tgl_match = re.search(r'(\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4})', body)
            tanggal = str(datetime.date.today())
            if tgl_match:
                try:
                    raw_tgl = tgl_match.group(1)
                    bulan_map = {
                        "Januari":"Jan","Februari":"Feb","Maret":"Mar","April":"Apr",
                        "Mei":"May","Juni":"Jun","Juli":"Jul","Agustus":"Aug",
                        "September":"Sep","Oktober":"Oct","November":"Nov","Desember":"Dec",
                        "Agu":"Aug","Okt":"Oct","Des":"Dec"
                    }
                    for id_bln, en_bln in bulan_map.items():
                        raw_tgl = raw_tgl.replace(id_bln, en_bln)
                    tanggal = pd.to_datetime(raw_tgl, dayfirst=True).strftime("%Y-%m-%d")
                except:
                    tanggal = str(datetime.date.today())

      
            jam_match = re.search(r'(\d{2}:\d{2}:\d{2})\s*WIB', body)
            if not jam_match:
                jam_match = re.search(r'Jam\s*(\d{2}:\d{2}:\d{2})', body)
            jam = jam_match.group(1) if jam_match else ""

     
            penerima = "Mandiri Transaction"


            penerima_match = re.search(
                r'Penerima\s+"?(.*?)"?\s+[\w\s().,\-]*?\s*-\s*ID',
                body, re.IGNORECASE | re.DOTALL
            )
            if penerima_match:
                kandidat = penerima_match.group(1).strip()
               
                if 2 < len(kandidat) < 80 and not any(k in kandidat for k in ["Tanggal","Nominal","Jam","Halo","Berikut"]):
                    penerima = kandidat

            if penerima == "Mandiri Transaction":
                penyedia_match = re.search(r'Penyedia\s*Jasa\s+([\w\s]+?)(?:\s*\*{4}\d+)', body)
                if penyedia_match:
                    penerima = penyedia_match.group(1).strip()

            if penerima == "Mandiri Transaction":
                transfer_match = re.search(
                    r'(?:Tujuan|Kepada)\s+([A-Za-z0-9\s,.\-]{3,50}?)(?:\s{2,}|\d{10,})',
                    body
                )
                if transfer_match:
                    penerima = transfer_match.group(1).strip()

            if penerima == "Mandiri Transaction":
                fallback = re.search(
                    r'(?:Penerima|Penyedia\s*Jasa|Tujuan|Kepada)\s+"?([\w\s\',.\-&/()]{3,60}?)"?(?:\s*-\s*ID|\*{4}|\s{2,})',
                    body, re.IGNORECASE
                )
                if fallback:
                    penerima = fallback.group(1).strip()

            penerima = re.sub(r'["\']', '', penerima)
            penerima = re.sub(r'\s+', ' ', penerima).strip()

            if any(k in subject for k in ["Pembayaran", "Debit", "Transfer Keluar", "Tarik", "Top-up", "Top Up"]):
                tipe = "Pengeluaran"
            elif any(k in subject for k in ["Kredit", "Transfer Masuk", "Terima", "Masuk"]):
                tipe = "Pemasukan"
            else:
                tipe = "Pengeluaran"

            if nominal > 0:
                results.append({
                    "Tanggal": tanggal,
                    "Tipe": tipe,
                    "Kategori": "Lainnya",
                    "Nominal": nominal,
                    "Catatan": f"[{jam}] {penerima}" if jam else penerima,
                    "Status": "Cleared",
                    "Tanggal_Bayar": tanggal,
                    "subject": subject
                })

        mail.logout()

    except Exception as e:
        return [], str(e)

    return results, None

   

def generate_recurring_transactions(df_recurring, df_main):
    today = datetime.date.today()
    new_rows = []
    for _, r in df_recurring.iterrows():
        if str(r.get("Aktif","True")).lower() != "true": continue
        try: tgl_mulai = pd.to_datetime(r["Tanggal_Mulai"]).date()
        except: continue
        frek = r.get("Frekuensi","Bulanan")
        if frek == "Bulanan":
            try: target_date = today.replace(day=tgl_mulai.day)
            except: continue
            if target_date > today: continue
            mask = (
                (df_main["Kategori"] == r["Kategori"]) &
                (df_main["Catatan"].astype(str).str.contains(str(r["Nama"]), na=False)) &
                (pd.to_datetime(df_main["Tanggal"], errors='coerce').dt.month == today.month) &
                (pd.to_datetime(df_main["Tanggal"], errors='coerce').dt.year  == today.year)
            )
            if not df_main[mask].empty: continue
        elif frek == "Mingguan":
            target_date = today
        else:
            continue
        new_rows.append({
            "Tanggal": target_date.strftime("%Y-%m-%d"),
            "Tipe":"Pengeluaran","Kategori":r["Kategori"],
            "Nominal":r["Nominal"],"Catatan":f"[Auto] {r['Nama']}",
            "Status":"Cleared","Tenggat_Waktu":"",
            "Tanggal_Bayar":target_date.strftime("%Y-%m-%d")
        })
    return new_rows


df_cloud = load_data_cloud()

if not df_cloud.empty:
    df_asli = df_cloud
else:
    df_asli = load_data()  # Ini mungkin tidak perlu karena sudah cloud-only
    # Tapi kalau tetap dipakai, pastikan:
    if "Sumber" not in df_asli.columns:
        df_asli["Sumber"] = "Bank"
        


df_piutang   = load_piutang()
df_budget    = load_budget()
df_recurring = load_recurring()

if not df_recurring.empty:
    new_txn = generate_recurring_transactions(df_recurring, df_asli)
    if new_txn:
        df_asli = pd.concat([df_asli, pd.DataFrame(new_txn)], ignore_index=True)
        save_data(df_asli)
        st.toast(f"🔄 {len(new_txn)} recurring expense otomatis ditambahkan!")

df_tabungan = load_tabungan_cloud()
if not df_tabungan.empty:
    REAL_DARURAT = df_tabungan["Terkumpul"].sum()  # Ambil semua, tanpa filter status
else:
    REAL_DARURAT = 0

UANG_CASH = load_cash_cloud()

REAL_OPERASIONAL = 0
FIKTIF_BASE = 140000000
MULTIPLIER = 100

hari_ini_tgl = datetime.date.today()
settings = load_settings_cloud()
tanggal_gajian = settings.get("tanggal_gajian", datetime.date(2026, 3, 17))

if isinstance(tanggal_gajian, str):
    try:
        tanggal_gajian = datetime.datetime.strptime(tanggal_gajian, "%Y-%m-%d").date()
    except:
        tanggal_gajian = datetime.date(2026, 3, 17)

SISA_HARI = max((tanggal_gajian - hari_ini_tgl).days, 1)

with st.sidebar:
    st.markdown("### ⚙️ Settings")
    st.markdown("---")
     
    if st.button("🔄 Refresh Data", use_container_width=True):
        st.cache_data.clear()
        st.rerun()
    
    st.markdown("---")
    
    # ===== TAMBAHKAN INI =====
    # Setting tanggal gajian
    with st.expander("📅 Atur Tanggal Gajian", expanded=False):
        st.caption("Ubah tanggal gajian berikutnya")
        
        new_tanggal = st.date_input(
            "Tanggal Gajian", 
            value=tanggal_gajian,
            key="setting_tanggal_gajian",
            min_value=datetime.date.today()
        )
        
        if st.button("💾 Simpan Tanggal Gajian", use_container_width=True):
            if save_setting_cloud("tanggal_gajian", new_tanggal, "date"):
                st.success(f"✅ Tanggal gajian diubah ke {new_tanggal.strftime('%d %b %Y')}")
                st.rerun()
    
    st.markdown("---")
    # ===== SAMPAI SINI =====
    
    secret_code = st.text_input(" ", type="password", label_visibility="hidden", placeholder="Secret code...")
    
    st.markdown("---")
    st.markdown("### 📅 Info")
    st.metric("Sisa Hari ke Gajian", f"{SISA_HARI} hari")
    # ===== UBAH INI =====
    st.caption(f"Target: {tanggal_gajian.strftime('%d %b %Y')}")
    # ===== SAMPAI SINI =====
    
    st.markdown("---")
    st.markdown("### 🗂️ Export")
    
    if not df_asli.empty:      
        df_exp_final = df_asli.drop(columns=[c for c in ["Tanggal_dt", "Cashflow_Date"] if c in df_asli.columns], errors='ignore')
        csv_exp = df_exp_final.to_csv(index=False).encode("utf-8")
        st.download_button("📥 Download CSV", data=csv_exp, file_name="keuangan_export.csv", mime="text/csv", use_container_width=True)

is_real_mode = (secret_code == "naufal")

col_title, col_clock = st.columns([2.5, 1.5])
with col_title:
    st.title("💼 Financial Dashboard")
    st.caption("🔴" if is_real_mode else "🟢")
with col_clock:
    clock_html = """
    <div style="text-align:right;font-family:'Segoe UI',sans-serif;padding-top:8px;">
      <div id="clk" style="display:inline-block;font-size:13px;font-weight:600;color:#10B981;
        background:linear-gradient(135deg,rgba(16,185,129,.1),rgba(31,41,55,.9));
        padding:10px 16px;border-radius:10px;border:1px solid #10B981;
        box-shadow:0 0 15px rgba(16,185,129,.2);white-space:nowrap;"></div>
    </div>
    <script>
    function tick(){
        var n=new Date();
        var dy=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
        var mn=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
        var h=String(n.getHours()).padStart(2,'0'),m=String(n.getMinutes()).padStart(2,'0'),s=String(n.getSeconds()).padStart(2,'0');
        document.getElementById('clk').innerHTML='🕒 '+dy[n.getDay()]+', '+n.getDate()+' '+mn[n.getMonth()]+' '+n.getFullYear()+'&nbsp;|&nbsp;'+h+':'+m+':'+s;
        setTimeout(tick,1000);
    }
    tick();
    </script>"""
    components.html(clock_html, height=75)

def cashflow_date(row):
    if row["Kategori"]=="Scheduled Settlement" and row["Status"]=="Cleared":
        if pd.notna(row["Tanggal_Bayar"]) and str(row["Tanggal_Bayar"]).strip():
            return row["Tanggal_Bayar"]
    return row["Tanggal"]

df_asli["Cashflow_Date"] = df_asli.apply(cashflow_date, axis=1)
df_asli["Tanggal_dt"]    = pd.to_datetime(df_asli["Cashflow_Date"], errors='coerce')

now = datetime.datetime.now()

mask_aktif  = (df_asli["Tipe"]=="Pengeluaran") & ~((df_asli["Kategori"]=="Scheduled Settlement")&(df_asli["Status"]=="Pending"))
mask_income = (df_asli["Tipe"]=="Pemasukan")
mask_pend   = (df_asli["Tipe"]=="Pengeluaran")&(df_asli["Kategori"]=="Scheduled Settlement")&(df_asli["Status"]=="Pending")

total_out   = df_asli[mask_aktif]["Nominal"].sum()
total_in    = df_asli[mask_income]["Nominal"].sum()
total_pend  = df_asli[mask_pend]["Nominal"].sum()
piutang_blm = df_piutang[df_piutang["Status"]=="Belum Lunas"]["Nominal"].sum() if not df_piutang.empty else 0


penggunaan_cash_hari_ini = 0
penggunaan_cash_minggu = 0
penggunaan_cash_bulan = 0

try:
    res = conn.table("penggunaan_cash").select("*").execute()
    if res.data:
        df_cash = pd.DataFrame(res.data)
        df_cash["tanggal"] = pd.to_datetime(df_cash["tanggal"])
        today = now.date()
        df_hari = df_cash[df_cash["tanggal"].dt.date == today]
        penggunaan_cash_hari_ini = df_hari["nominal"].sum() if not df_hari.empty else 0
        
    
        df_minggu = df_cash[
            (df_cash["tanggal"].dt.isocalendar().week == now.isocalendar()[1]) &
            (df_cash["tanggal"].dt.year == now.year)
        ]
        penggunaan_cash_minggu = df_minggu["nominal"].sum() if not df_minggu.empty else 0
        
       
        df_bulan = df_cash[
            (df_cash["tanggal"].dt.month == now.month) &
            (df_cash["tanggal"].dt.year == now.year)
        ]
        penggunaan_cash_bulan = df_bulan["nominal"].sum() if not df_bulan.empty else 0
        
except Exception as e:
    st.sidebar.error(f"Gagal load penggunaan cash: {e}")



# ===== FILTER UNTUK TRANSAKSI =====
mask_aktif = (df_asli["Tipe"] == "Pengeluaran") & ~((df_asli["Kategori"] == "Scheduled Settlement") & (df_asli["Status"] == "Pending"))

# ===== FILTER BERDASARKAN SUMBER (AMAN) =====
if "Sumber" in df_asli.columns:
    mask_bank = (df_asli["Sumber"] == "Bank") | (df_asli["Sumber"].isna())
    mask_cash = df_asli["Sumber"] == "Cash"
else:
    # Fallback untuk data lama yang belum punya kolom Sumber
    mask_bank = pd.Series([True] * len(df_asli), index=df_asli.index)
    mask_cash = pd.Series([False] * len(df_asli), index=df_asli.index)



# Hari ini
out_hari_bank = df_asli[mask_aktif & mask_bank & (df_asli["Tanggal_dt"].dt.date == now.date())]["Nominal"].sum()
out_hari_cash = df_asli[mask_aktif & mask_cash & (df_asli["Tanggal_dt"].dt.date == now.date())]["Nominal"].sum()
out_hari = out_hari_bank + out_hari_cash

# Minggu ini
out_minggu_bank = df_asli[mask_aktif & mask_bank & 
                          (df_asli["Tanggal_dt"].dt.isocalendar().week == now.isocalendar()[1]) & 
                          (df_asli["Tanggal_dt"].dt.year == now.year)]["Nominal"].sum()
out_minggu_cash = df_asli[mask_aktif & mask_cash & 
                          (df_asli["Tanggal_dt"].dt.isocalendar().week == now.isocalendar()[1]) & 
                          (df_asli["Tanggal_dt"].dt.year == now.year)]["Nominal"].sum()
out_minggu = out_minggu_bank + out_minggu_cash

# Bulan ini
out_bulan_bank = df_asli[mask_aktif & mask_bank & 
                         (df_asli["Tanggal_dt"].dt.month == now.month) & 
                         (df_asli["Tanggal_dt"].dt.year == now.year)]["Nominal"].sum()
out_bulan_cash = df_asli[mask_aktif & mask_cash & 
                         (df_asli["Tanggal_dt"].dt.month == now.month) & 
                         (df_asli["Tanggal_dt"].dt.year == now.year)]["Nominal"].sum()
out_bulan = out_bulan_bank + out_bulan_cash


due_text = "No Pending"
if not df_asli[mask_pend].empty:
    vd = pd.to_datetime(df_asli[mask_pend]["Tenggat_Waktu"], errors='coerce').dropna()
    if not vd.empty: due_text = f"Due: {vd.min().strftime('%d %b %y')}"


SALDO_BANK = REAL_OPERASIONAL - total_out + total_in  
UANG_CASH = load_cash_cloud()                         
TABUNGAN = REAL_DARURAT                              
saldo_op = SALDO_BANK + UANG_CASH - TABUNGAN          
total_real = SALDO_BANK + UANG_CASH                    
batas_hr = saldo_op / SISA_HARI                        
mult = 1 if is_real_mode else MULTIPLIER
total_aset = total_real if is_real_mode else (FIKTIF_BASE + total_real)





if "show_aset" not in st.session_state:
    st.session_state.show_aset = True

aset_display = f"Rp {total_aset:,.0f}" if st.session_state.show_aset else "Rp ••••••••"
eye_icon = "👁️" if st.session_state.show_aset else "🙈"


st.subheader("💵 Portofolio Aset")

# Reset semua hide status setiap kali halaman dimuat
if "first_load" not in st.session_state:
    st.session_state.first_load = True
    st.session_state.show_bank = False
    st.session_state.show_cash = False
    st.session_state.show_tabungan = False
    st.session_state.show_aset = False

if is_real_mode:
    r1c1, r1c2, r1c3, r1c4 = st.columns(4)
    
    with r1c1:
        bank_display = f"Rp {SALDO_BANK:,.0f}" if st.session_state.show_bank else "Rp ••••••••"
        st.metric("🏦 Saldo Bank/ATM", bank_display)
        if st.button("👁️" if st.session_state.show_bank else "🙈", key="toggle_bank"):
            st.session_state.show_bank = not st.session_state.show_bank
            st.rerun()
    
    with r1c2:
        cash_display = f"Rp {UANG_CASH:,.0f}" if st.session_state.show_cash else "Rp ••••••••"
        st.metric("💵 Uang Cash", cash_display)
        if st.button("👁️" if st.session_state.show_cash else "🙈", key="toggle_cash"):
            st.session_state.show_cash = not st.session_state.show_cash
            st.rerun()
    
    with r1c3:
        tabungan_display = f"Rp {TABUNGAN:,.0f}" if st.session_state.show_tabungan else "Rp ••••••••"
        st.metric("💰 Tabungan", tabungan_display)
        if st.button("👁️" if st.session_state.show_tabungan else "🙈", key="toggle_tabungan"):
            st.session_state.show_tabungan = not st.session_state.show_tabungan
            st.rerun()
    
    with r1c4:
        aset_display = f"Rp {total_real:,.0f}" if st.session_state.show_aset else "Rp ••••••••"
        st.metric("💎 Total Aset", aset_display)
        if st.button("👁️" if st.session_state.show_aset else "🙈", key="toggle_aset_real"):
            st.session_state.show_aset = not st.session_state.show_aset
            st.rerun()
    
    r2c1, r2c2, r2c3 = st.columns(3)
    r2c1.metric("📊 Dana Operasional", f"Rp {saldo_op:,.0f}")
    r2c2.metric("⏳ Limit Harian", f"Rp {batas_hr:,.0f}")
    r2c3.metric("📅 Sisa Hari", f"{SISA_HARI} hari")

else:
    r1c1, r1c2 = st.columns(2)
    
    with r1c1:
        aset_display = f"Rp {total_aset:,.0f}" if st.session_state.show_aset else "Rp ••••••••"
        st.metric("💰 Total Aset", aset_display)
        if st.button("👁️" if st.session_state.show_aset else "🙈", key="toggle_aset_biasa"):
            st.session_state.show_aset = not st.session_state.show_aset
            st.rerun()
    
    with r1c2:
        cash_display = f"Rp {UANG_CASH:,.0f}" if st.session_state.show_cash else "Rp ••••••••"
        st.metric("💵 Uang Cash", cash_display)
        if st.button("👁️" if st.session_state.show_cash else "🙈", key="toggle_cash_biasa"):
            st.session_state.show_cash = not st.session_state.show_cash
            st.rerun()
    
    r2c1, r2c2 = st.columns(2)
    r2c1.metric("📊 Dana Operasional", f"Rp {saldo_op:,.0f}")
    r2c2.metric("⏳ Limit Harian", f"Rp {batas_hr:,.0f}")

st.markdown("##### 📈 Analitik Pengeluaran Aktif")
m1, m2, m3, m4 = st.columns(4)
m1.metric("Pengeluaran Hari Ini", f"Rp {out_hari:,.0f}")
m2.metric("Pengeluaran Minggu Ini", f"Rp {out_minggu:,.0f}")
m3.metric("Pengeluaran Bulan Ini", f"Rp {out_bulan:,.0f}")
m4.metric("⏳ Scheduled Settlement", f"Rp {total_pend:,.0f}", delta=due_text, delta_color="off")

# ===== DISPLAY LIMIT HARIAN YANG LEBIH INFORMATIF =====
st.markdown("---")
st.subheader("💰 Limit Harian")

# Hitung sisa budget
sisa_budget = saldo_op - out_hari
warna_sisa = "#10B981" if sisa_budget >= 0 else "#EF4444"
persentase = (out_hari / batas_hr * 100) if batas_hr > 0 else 0

# Tampilan utama limit harian
col_l1, col_l2, col_l3 = st.columns(3)

with col_l1:
    st.markdown(f"""
    <div class="card card-green">
        <p class="card-label">📊 BUDGET HARI INI</p>
        <p class="card-value" style="color:#10B981;">Rp {batas_hr:,.0f}</p>
        <p class="card-sub">Maksimal belanja hari ini</p>
    </div>
    """, unsafe_allow_html=True)

with col_l2:
    st.markdown(f"""
    <div class="card">
        <p class="card-label">💰 TERPAKAI</p>
        <p class="card-value" style="color:#F59E0B;">Rp {out_hari:,.0f}</p>
        <p class="card-sub">{persentase:.1f}% dari budget</p>
    </div>
    """, unsafe_allow_html=True)

with col_l3:
    st.markdown(f"""
    <div class="card">
        <p class="card-label">⏳ SISA</p>
        <p class="card-value" style="color:{warna_sisa};">Rp {sisa_budget:,.0f}</p>
        <p class="card-sub">Bisa belanja lagi</p>
    </div>
    """, unsafe_allow_html=True)

# Progress bar
st.progress(min(persentase / 100, 1.0))

# Status berdasarkan penggunaan
if persentase < 30:
    st.success(f"🟢 Aman Banget! Kamu masih bisa jajan Rp {sisa_budget:,.0f} hari ini")
elif persentase < 50:
    st.info(f"🔵 Hemat! Sisa budget Rp {sisa_budget:,.0f}")
elif persentase < 70:
    st.warning(f"🟡 Perhatian! Budget sudah {persentase:.1f}% terpakai")
elif persentase < 90:
    st.warning(f"🟠 Hampir Habis! Sisa Rp {sisa_budget:,.0f}")
else:
    st.error(f"🔴 KRITIS! Budget hampir habis! Sisa Rp {sisa_budget:,.0f}")

# ===== FITUR SIMULASI JAJAN =====
# ===== FITUR SIMULASI JAJAN =====
st.markdown("---")
st.subheader("🔮 Simulasi Jajan")

col_sim1, col_sim2 = st.columns(2)

with col_sim1:
    # Input untuk simulasi
    simulasi_jajan = st.number_input(
        "💰 Coba kalau jajan hari ini (Rp)",
        min_value=0,
        max_value=int(saldo_op + out_hari),  # Max total saldo
        value=int(out_hari),
        step=5000,
        key="simulasi_jajan"
    )
    
    # Hitung dampak simulasi
    if simulasi_jajan > out_hari:
        selisih = simulasi_jajan - out_hari
        sisa_setelah_jajan = sisa_budget - selisih
        persentase_setelah = (simulasi_jajan / batas_hr * 100) if batas_hr > 0 else 0
        dana_setelah_simulasi = saldo_op - selisih
    else:
        selisih = out_hari - simulasi_jajan
        sisa_setelah_jajan = sisa_budget + selisih
        persentase_setelah = (simulasi_jajan / batas_hr * 100) if batas_hr > 0 else 0
        dana_setelah_simulasi = saldo_op + selisih

with col_sim2:
    st.markdown(f"""
    <div class="card">
        <p class="card-label">📊 HASIL SIMULASI</p>
        <p class="card-value" style="color:#F59E0B;">Rp {simulasi_jajan:,.0f}</p>
        <p class="card-sub">Kalau jajan segini</p>
    </div>
    """, unsafe_allow_html=True)

# Tampilkan dampak simulasi
col_dampak1, col_dampak2, col_dampak3 = st.columns(3)

with col_dampak1:
    if sisa_setelah_jajan >= 0:
        st.success(f"✅ Sisa: Rp {sisa_setelah_jajan:,.0f}")
    else:
        st.error(f"❌ Defisit: Rp {abs(sisa_setelah_jajan):,.0f}")

with col_dampak2:
    warna_persen = "#10B981" if persentase_setelah <= 100 else "#EF4444"
    st.markdown(f"<span style='color:{warna_persen}; font-weight:bold;'>{persentase_setelah:.1f}%</span> dari budget", unsafe_allow_html=True)

with col_dampak3:
    if persentase_setelah <= 100:
        # Hitung limit besok (sisa hari dikurangi 1)
        if SISA_HARI > 1:
            limit_besok = dana_setelah_simulasi / (SISA_HARI - 1)
        else:
            limit_besok = dana_setelah_simulasi
        
        # Hitung selisih dengan limit hari ini
        selisih_limit = limit_besok - batas_hr
        
        if selisih_limit > 0:
            st.success(f"📈 Limit besok: Rp {limit_besok:,.0f} (+Rp {selisih_limit:,.0f})")
        elif selisih_limit < 0:
            st.warning(f"📉 Limit besok: Rp {limit_besok:,.0f} (Rp {abs(selisih_limit):,.0f})")
        else:
            st.info(f"📅 Limit besok: Rp {limit_besok:,.0f}")
    else:
        st.error("🚫 Melebihi budget!")
        # Set default values untuk menghindari NameError
        limit_besok = 0
        selisih_limit = 0

# Rekomendasi berdasarkan simulasi
st.markdown("---")
st.subheader("💡 Rekomendasi")

# Pastikan variabel ada sebelum dipakai
if 'selisih' not in locals():
    selisih = 0
if 'selisih_limit' not in locals():
    selisih_limit = 0
if 'sisa_setelah_jajan' not in locals():
    sisa_setelah_jajan = sisa_budget

if simulasi_jajan > out_hari:
    # Boros
    if sisa_setelah_jajan >= 0:
        st.warning(f"⚠️ Kalau jajan Rp {simulasi_jajan:,.0f}, kamu boros Rp {selisih:,.0f} dari budget")
        if selisih_limit < 0:
            st.info(f"📉 Limit besok turun Rp {abs(selisih_limit):,.0f}")
    else:
        st.error(f"🚨 JANGAN! Defisit Rp {abs(sisa_setelah_jajan):,.0f}! Ambil dari tabungan?")
elif simulasi_jajan < out_hari:
    # Hemat
    st.success(f"🎉 Hemat Rp {selisih:,.0f}! Sisa budget jadi Rp {sisa_setelah_jajan:,.0f}")
    if selisih_limit > 0:
        st.success(f"📈 Limit besok naik Rp {selisih_limit:,.0f}")
else:
    # Sama
    st.info(f"⚖️ Sama seperti biasanya (Rp {out_hari:,.0f})")

# ===== TIPS BERDASARKAN SISA HARI =====
st.markdown("---")
st.subheader("💡 Tips Hari Ini")

with st.expander("📈 Rata-rata & Proyeksi", expanded=False):
    avg_per_hari = out_bulan / 30 if out_bulan > 0 else 0
    proyeksi_akhir = avg_per_hari * SISA_HARI
    
    col_t1, col_t2 = st.columns(2)
    with col_t1:
        st.metric("Rata-rata per hari", f"Rp {avg_per_hari:,.0f}")
    with col_t2:
        st.metric("Proyeksi sampai gajian", f"Rp {proyeksi_akhir:,.0f}")
    
    if proyeksi_akhir > saldo_op:
        st.error(f"⚠️ Proyeksi defisit Rp {proyeksi_akhir - saldo_op:,.0f} jika terus begini")
    else:
        st.success(f"✅ Proyeksi surplus Rp {saldo_op - proyeksi_akhir:,.0f}")

# Rekomendasi jajan berdasarkan sisa budget
st.subheader("🛒 Rekomendasi Jajan Hari Ini")

if sisa_budget <= 0:
    st.error("🚫 STOP! Kamu sudah melebihi budget hari ini!")
elif sisa_budget < 10000:
    st.warning(f"💔 Budget sisa Rp {sisa_budget:,.0f} - Cukup untuk jajan kecil")
elif sisa_budget < 30000:
    st.info(f"🍜 Bisa buat makan siang + minum (Rp {sisa_budget:,.0f})")
elif sisa_budget < 50000:
    st.success(f"🍱 Bisa buat makan enak! (Rp {sisa_budget:,.0f})")
elif sisa_budget < 100000:
    st.success(f"🎉 Bisa buat nonton atau hangout! (Rp {sisa_budget:,.0f})")
else:
    st.success(f"💰 Sisa banyak! Bisa ditabung atau investasi")

if piutang_blm > 0:
    n_blm = len(df_piutang[df_piutang["Status"] == "Belum Lunas"])
    st.warning(f"💸 Ada **{n_blm} piutang aktif** senilai **Rp {piutang_blm:,.0f}** yang belum kembali.")

st.divider()


lc, rc = st.columns([1.2, 1])
with lc:
    st.subheader("📝 Catat Transaksi Baru")
    
    with st.form("form_transaksi_baru", clear_on_submit=True):
        st.write("### 👇 Isi Data Transaksi")
        
        # Baris 1: Tanggal dan Tipe
        col1, col2 = st.columns(2)
        with col1:
            tgl_i = st.date_input("📅 Tanggal", datetime.date.today())
        with col2:
            tipe_i = st.selectbox("📊 Tipe", ["Pengeluaran", "Pemasukan"])
        
        # Baris 2: Sumber Dana dan Kategori
        col3, col4 = st.columns(2)
        with col3:
            sumber_i = st.selectbox("💰 Sumber Dana", ["Bank", "Cash"])
        with col4:
            kategori_options = [
                "Makan (Sahur/Buka)", 
                "Bensin / Mobilitas", 
                "Bukber / Hiburan", 
                "Kebutuhan Lab / Magang", 
                "Scheduled Settlement",
                "Lainnya (Ketik Manual...)"
            ]
            kat_pilih = st.selectbox("🏷️ Kategori", kategori_options)
        
        # Kategori Manual
        kat_f = kat_pilih
        if kat_pilih == "Lainnya (Ketik Manual...)":
            kat_f = st.text_input("✏️ Nama Kategori Baru", placeholder="Contoh: Beli Buku, Hadiah")
        
        # Scheduled Settlement
        st_i, tg_i, tb_i = "Cleared", "", ""
        if kat_f == "Scheduled Settlement":
            st.info("📌 Dana Pending tidak memotong saldo sampai di-set 'Cleared'.")
            col_s1, col_s2 = st.columns(2)
            with col_s1:
                st_i = st.selectbox("⏳ Status", ["Pending", "Cleared"])
            with col_s2:
                min_date = datetime.date.today()
                tg_i = st.date_input("📅 Jatuh Tempo", min_value=min_date).strftime("%Y-%m-%d")
            if st_i == "Cleared":
                tb_i = tgl_i.strftime("%Y-%m-%d")
        
        # Nominal dan Catatan
        nom_i = st.number_input("💰 Nominal (Rp)", min_value=0, step=5000, format="%d")
        cat_i = st.text_input("📝 Catatan", placeholder="Contoh: Beli makan siang")
        
        # Tombol Submit
        submitted = st.form_submit_button("💾 Simpan Transaksi", use_container_width=True)
        
        if submitted:
            error = False
            
            # Validasi
            if nom_i <= 0:
                st.error("⚠️ Nominal harus lebih dari 0!")
                error = True
            elif kat_pilih == "Lainnya (Ketik Manual...)" and (not kat_f or kat_f.strip() == ""):
                st.error("⚠️ Silakan isi nama kategori baru!")
                error = True
            elif kat_f == "Scheduled Settlement" and st_i == "Pending" and not tg_i:
                st.error("⚠️ Isi tanggal jatuh tempo untuk pending settlement!")
                error = True
            elif sumber_i == "Bank" and tipe_i == "Pengeluaran" and nom_i > SALDO_BANK:
                st.error(f"❌ Saldo bank tidak cukup! (Sisa: Rp {SALDO_BANK:,.0f})")
                error = True
            elif sumber_i == "Cash" and tipe_i == "Pengeluaran":
                cash_skrg = load_cash_cloud()
                if nom_i > cash_skrg:
                    st.error(f"❌ Saldo cash tidak cukup! (Sisa: Rp {cash_skrg:,.0f})")
                    error = True
            
            if not error:
                # Data transaksi
                nr = {
                    "Tanggal": tgl_i.strftime("%Y-%m-%d"),
                    "Tipe": tipe_i,
                    "Kategori": kat_f,
                    "Nominal": nom_i,
                    "Catatan": cat_i,
                    "Status": st_i,
                    "Tenggat_Waktu": tg_i if tg_i else "",
                    "Tanggal_Bayar": tb_i if tb_i else "",
                    "Sumber": sumber_i
                }
                
                # Update cash
                if sumber_i == "Cash":
                    cash_skrg = load_cash_cloud()
                    if tipe_i == "Pengeluaran":
                        update_cash_cloud(cash_skrg - nom_i, f"Transaksi: {cat_i}")
                    else:
                        update_cash_cloud(cash_skrg + nom_i, f"Pemasukan cash: {cat_i}")
                
                # Simpan
                save_to_cloud(nr)
                df_asli = pd.concat([df_asli, pd.DataFrame([nr])], ignore_index=True)
                save_data(df_asli)
                
                st.success("✅ Transaksi berhasil disimpan!")
                st.rerun()




PLOT = dict(
    paper_bgcolor="#1E293B", plot_bgcolor="#0F172A", font_color="#94A3B8",
    font_size=12, margin=dict(l=20,r=20,t=40,b=20),
    xaxis=dict(gridcolor="#334155"), yaxis=dict(gridcolor="#334155"),
    legend=dict(bgcolor="#1E293B",bordercolor="#334155",borderwidth=1)
)

tab_grafik, tab_budget_t, tab_piutang_t, tab_recurring_t, tab_laporan_t, tab_mandiri, tab_tabungan,tab_cash = st.tabs([
    "📊 Grafik", "🎯 Budget Target", "💸 Piutang", "🔄 Recurring", "📋 Laporan", "📧 Mandiri", "🏦 Tabungan", "💵 Uang Cash"
])

with tab_grafik:
    g1, g2, g3 = st.tabs(["📈 Tren Harian", "🍩 Per Kategori", "⚖️ Arus Kas"])

    with g1:
        st.subheader("📈 Tren Pengeluaran Harian (Bank + Cash)")
        
        # Gabungkan data bank dan cash untuk grafik
        df_bank = df_asli[mask_aktif].copy()
        df_bank["Sumber"] = "Bank"
        df_bank["Tanggal"] = df_bank["Tanggal_dt"].dt.date
        df_bank = df_bank[["Tanggal", "Nominal", "Sumber"]]
        
        # Load data cash
        try:
            res_cash = conn.table("penggunaan_cash").select("*").execute()
            if res_cash.data and len(res_cash.data) > 0:
                df_cash_g = pd.DataFrame(res_cash.data)
                df_cash_g["Sumber"] = "Cash"
                df_cash_g["Tanggal"] = pd.to_datetime(df_cash_g["tanggal"]).dt.date
                df_cash_g["Nominal"] = df_cash_g["nominal"]
                df_cash_g = df_cash_g[["Tanggal", "Nominal", "Sumber"]]
                
                # Gabungkan
                df_gabungan = pd.concat([df_bank, df_cash_g], ignore_index=True)
            else:
                df_gabungan = df_bank
        except:
            df_gabungan = df_bank
        
        if not df_gabungan.empty:
            # Group by tanggal dan sumber
            dt = df_gabungan.groupby(["Tanggal", "Sumber"])["Nominal"].sum().reset_index()
            
            # Pivot untuk stacked bar
            dt_pivot = dt.pivot(index="Tanggal", columns="Sumber", values="Nominal").fillna(0)
            dt_pivot["Total"] = dt_pivot.sum(axis=1)
            dt_pivot = dt_pivot.reset_index().sort_values("Tanggal")
            
            # Buat figure
            fig = go.Figure()
            
            if "Bank" in dt_pivot.columns:
                fig.add_trace(go.Bar(
                    x=dt_pivot["Tanggal"],
                    y=dt_pivot["Bank"],
                    name="Bank",
                    marker_color="#3B82F6",
                    hovertemplate="Bank: Rp %{y:,.0f}<extra></extra>"
                ))
            
            if "Cash" in dt_pivot.columns:
                fig.add_trace(go.Bar(
                    x=dt_pivot["Tanggal"],
                    y=dt_pivot["Cash"],
                    name="Cash",
                    marker_color="#10B981",
                    hovertemplate="Cash: Rp %{y:,.0f}<extra></extra>"
                ))
            
            # Tambah line total
            fig.add_trace(go.Scatter(
                x=dt_pivot["Tanggal"],
                y=dt_pivot["Total"],
                mode="lines+markers",
                name="Total",
                line=dict(color="#F59E0B", width=2.5),
                marker=dict(size=8),
                hovertemplate="Total: Rp %{y:,.0f}<extra></extra>"
            ))
            
            # Tambah limit line
            fig.add_hline(
                y=batas_hr,
                line_dash="dot",
                line_color="#EF4444",
                annotation_text=f"Limit: Rp {batas_hr:,.0f}",
                annotation_position="top right",
                annotation_font_color="#EF4444"
            )
            
            fig.update_layout(
                title="Pengeluaran Harian (Bank vs Cash)",
                xaxis_title="Tanggal",
                yaxis_title="Nominal (Rp)",
                barmode="stack",
                hovermode="x unified",
                **PLOT
            )
            
            st.plotly_chart(fig, use_container_width=True)
            
            # Tampilkan statistik

        else:
            st.info("Belum ada data pengeluaran.")

    with g2:
        st.subheader("🍩 Distribusi Pengeluaran per Kategori")
        
        # Gabungkan bank dan cash untuk pie chart
        df_bank_kat = df_asli[mask_aktif].copy()
        df_bank_kat = df_bank_kat[["Kategori", "Nominal"]]
        
        try:
            res_cash = conn.table("penggunaan_cash").select("*").execute()
            if res_cash.data and len(res_cash.data) > 0:
                df_cash_kat = pd.DataFrame(res_cash.data)
                df_cash_kat["Kategori"] = df_cash_kat["kategori"] + " (Cash)"
                df_cash_kat["Nominal"] = df_cash_kat["nominal"]
                df_cash_kat = df_cash_kat[["Kategori", "Nominal"]]
                
                df_kat_gab = pd.concat([df_bank_kat, df_cash_kat], ignore_index=True)
            else:
                df_kat_gab = df_bank_kat
        except:
            df_kat_gab = df_bank_kat
        
        if not df_kat_gab.empty:
            cd = df_kat_gab.groupby("Kategori")["Nominal"].sum().reset_index()
            cd = cd.sort_values("Nominal", ascending=False)
            
            col_p1, col_p2 = st.columns([1, 1])
            
            with col_p1:
                # Pie chart
                fig_pie = px.pie(
                    cd,
                    values="Nominal",
                    names="Kategori",
                    hole=0.55,
                    color_discrete_sequence=px.colors.sequential.Viridis,
                    title="Distribusi Pengeluaran"
                )
                fig_pie.update_traces(
                    textposition='inside',
                    textinfo='percent+label',
                    hovertemplate="<b>%{label}</b><br>Rp %{value:,.0f}<br>%{percent}<extra></extra>"
                )
                fig_pie.update_layout(**PLOT)
                st.plotly_chart(fig_pie, use_container_width=True)
            
            with col_p2:
                # Bar chart
                fig_bar = px.bar(
                    cd.head(10),
                    x="Nominal",
                    y="Kategori",
                    orientation="h",
                    color="Nominal",
                    color_continuous_scale=["#10B981", "#F59E0B", "#EF4444"],
                    title="Top Kategori"
                )
                
                fig_bar.update_layout(
                    showlegend=False,
                    coloraxis_showscale=False,
                    yaxis={
                        'categoryorder':'total ascending',
                        'gridcolor': "#334155"
                    },
                    paper_bgcolor="#1E293B", 
                    plot_bgcolor="#0F172A", 
                    font_color="#94A3B8",
                    font_size=12,
                    margin=dict(l=20,r=20,t=40,b=20),
                    xaxis=dict(gridcolor="#334155")
                )
            
                fig_bar.update_traces(hovertemplate="Rp %{x:,.0f}<extra></extra>")
                st.plotly_chart(fig_bar, use_container_width=True)
        else:
            st.info("Belum ada data pengeluaran.")

    with g3:
        st.subheader("⚖️ Ringkasan Arus Kas")
        
        # Hitung ulang dengan cash
        total_pemasukan = df_asli[mask_income]["Nominal"].sum()
        
        total_pengeluaran_bank = df_asli[mask_aktif]["Nominal"].sum()
        try:
            res_cash = conn.table("penggunaan_cash").select("*").execute()
            if res_cash.data and len(res_cash.data) > 0:
                df_cash_all = pd.DataFrame(res_cash.data)
                total_pengeluaran_cash = df_cash_all["nominal"].sum()
            else:
                total_pengeluaran_cash = 0
        except:
            total_pengeluaran_cash = 0
        
        total_pengeluaran = total_pengeluaran_bank + total_pengeluaran_cash
        
        # Data untuk chart
        df_cf = pd.DataFrame({
            "Tipe": ["Pemasukan", "Pengeluaran Bank", "Pengeluaran Cash", "Pending"],
            "Nominal": [total_pemasukan, total_pengeluaran_bank, total_pengeluaran_cash, total_pend],
            "Warna": ["#10B981", "#3B82F6", "#10B981", "#F59E0B"]
        })
        
        # Bar chart
        fig_cf = px.bar(
            df_cf,
            x="Tipe",
            y="Nominal",
            color="Tipe",
            text_auto=".0f",
            color_discrete_map={
                "Pemasukan": "#10B981",
                "Pengeluaran Bank": "#3B82F6",
                "Pengeluaran Cash": "#10B981",
                "Pending": "#F59E0B"
            },
            title="Arus Kas (Bank vs Cash)"
        )
        fig_cf.update_traces(
            texttemplate="Rp %{y:,.0f}",
            textposition="outside",
            hovertemplate="%{x}<br>Rp %{y:,.0f}<extra></extra>"
        )
        fig_cf.update_layout(**PLOT)
        st.plotly_chart(fig_cf, use_container_width=True)
        
        # Gauge chart untuk saldo operasional
        col_g1, col_g2 = st.columns(2)
        
        with col_g1:
            fig_gauge = go.Figure(go.Indicator(
                mode="gauge+number+delta",
                value=saldo_op,
                delta={"reference": REAL_OPERASIONAL + UANG_CASH, "valueformat": ",.0f"},
                title={"text": "Saldo Operasional", "font": {"color": "#F1F5F9"}},
                number={"prefix": "Rp ", "valueformat": ",.0f", "font": {"color": "#F1F5F9"}},
                gauge={
                    "axis": {"range": [0, REAL_OPERASIONAL + UANG_CASH], "tickcolor": "#94A3B8"},
                    "bar": {"color": "#10B981"},
                    "bgcolor": "#0F172A",
                    "bordercolor": "#334155",
                    "steps": [
                        {"range": [0, (REAL_OPERASIONAL + UANG_CASH) * 0.3], "color": "rgba(239,68,68,0.2)"},
                        {"range": [(REAL_OPERASIONAL + UANG_CASH) * 0.3, (REAL_OPERASIONAL + UANG_CASH) * 0.7], "color": "rgba(245,158,11,0.2)"},
                        {"range": [(REAL_OPERASIONAL + UANG_CASH) * 0.7, REAL_OPERASIONAL + UANG_CASH], "color": "rgba(16,185,129,0.2)"}
                    ],
                    "threshold": {
                        "line": {"color": "#F59E0B", "width": 4},
                        "thickness": 0.75,
                        "value": (REAL_OPERASIONAL + UANG_CASH) * 0.3
                    }
                }
            ))
            fig_gauge.update_layout(
                paper_bgcolor="#1E293B",
                font_color="#94A3B8",
                height=300,
                margin=dict(l=30, r=30, t=50, b=10)
            )
            st.plotly_chart(fig_gauge, use_container_width=True)
        
        with col_g2:
            # Statistik tambahan
            st.markdown("### 💰 Rincian")
            st.markdown(f"""
            <div style="background:#1E293B; padding:20px; border-radius:10px; border:1px solid #334155;">
                <p style="color:#94A3B8; margin:0;">Total Aset</p>
                <p style="color:#F1F5F9; font-size:24px; font-weight:700;">Rp {total_real:,.0f}</p>
                <hr style="border-color:#334155;">
                <p style="color:#94A3B8; margin:0;">Bank</p>
                <p style="color:#3B82F6; font-size:20px;">Rp {SALDO_BANK:,.0f}</p>
                <p style="color:#94A3B8; margin:0;">Cash</p>
                <p style="color:#10B981; font-size:20px;">Rp {UANG_CASH:,.0f}</p>
                <hr style="border-color:#334155;">
                <p style="color:#94A3B8; margin:0;">Tabungan</p>
                <p style="color:#F59E0B; font-size:20px;">Rp {TABUNGAN:,.0f}</p>
            </div>
            """, unsafe_allow_html=True)

with tab_budget_t:
    st.subheader("🎯 Budget Target per Kategori")
    st.caption("Set batas pengeluaran per kategori. Progress otomatis dihitung dari transaksi bulan ini.")

    with st.expander("➕ Tambah / Edit Target"):
        with st.form("form_budget", clear_on_submit=True):
            kat_b = st.selectbox("Kategori", ["Makan (Sahur/Buka)","Bensin / Mobilitas","Bukber / Hiburan","Kebutuhan Lab / Magang","Piutang","Lainnya"])
            tgt_b = st.number_input("Target Bulanan (Rp)", min_value=0, step=10000)
            if st.form_submit_button("💾 Simpan Target"):
                if tgt_b > 0:
                    if not df_budget.empty and kat_b in df_budget["Kategori"].values:
                        df_budget.loc[df_budget["Kategori"]==kat_b,"Target"] = tgt_b
                    else:
                        df_budget = pd.concat([df_budget, pd.DataFrame([{"Kategori":kat_b,"Target":tgt_b}])], ignore_index=True)
                    save_budget(df_budget)
                    st.success(f"✅ Target Rp {tgt_b:,.0f} untuk {kat_b} disimpan!")
                    st.rerun()

    if not df_budget.empty:
        out_bln_kat = df_asli[mask_aktif&(df_asli["Tanggal_dt"].dt.month==now.month)&(df_asli["Tanggal_dt"].dt.year==now.year)].groupby("Kategori")["Nominal"].sum()
        for _,row in df_budget.iterrows():
            kat=row["Kategori"]; tgt=row["Target"]; spent=out_bln_kat.get(kat,0)
            pct_b=min(spent/tgt,1.0) if tgt>0 else 0; sisa=tgt-spent
            if pct_b>=1.0:   clr,badge="#EF4444","🔴 OVER BUDGET"
            elif pct_b>=0.8: clr,badge="#F59E0B","🟡 Hampir Habis"
            else:             clr,badge="#10B981","🟢 Aman"
            sisa_txt = f"Sisa Rp {sisa:,.0f}" if sisa>=0 else f"Lebih Rp {abs(sisa):,.0f}"
            st.markdown(f"""
            <div class="card">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="color:#F1F5F9;font-weight:600;">{kat}</span>
                    <span style="color:{clr};font-size:.8rem;font-weight:600;">{badge}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                    <span style="color:#94A3B8;font-size:.85rem;">Rp {spent:,.0f} / Rp {tgt:,.0f}</span>
                    <span style="color:{clr};font-size:.85rem;">{sisa_txt}</span>
                </div>
            </div>""", unsafe_allow_html=True)
            st.progress(pct_b)

        bc=df_budget.copy(); bc["Terpakai"]=bc["Kategori"].map(lambda k: out_bln_kat.get(k,0))
        fb2=go.Figure()
        fb2.add_trace(go.Bar(name="Target",  x=bc["Kategori"],y=bc["Target"],  marker_color="#334155"))
        fb2.add_trace(go.Bar(name="Terpakai",x=bc["Kategori"],y=bc["Terpakai"],marker_color="#10B981"))
        fb2.update_layout(title="Budget vs Aktual Bulan Ini",barmode="group",**PLOT)
        st.plotly_chart(fb2,use_container_width=True)
    else:
        st.info("Belum ada budget target. Tambahkan lewat form di atas.")

with tab_piutang_t:
    st.subheader("💸 Tracker Piutang")
    st.caption("Catat siapa yang pinjam uang ke kamu. Saldo otomatis kembali saat kamu klik ✅ Lunas.")

    pf1,pf2 = st.columns([1.2,1])
    with pf1:
        with st.form("form_piutang", clear_on_submit=True):
            st.markdown("**➕ Catat Piutang Baru**")
            nama_p    = st.text_input("Nama Peminjam")
            nominal_p = st.number_input("Nominal (Rp)", min_value=0, step=5000)
            tenggat_p = st.date_input("Tenggat Penagihan", datetime.date.today()+datetime.timedelta(days=7))
            catatan_p = st.text_input("Catatan (opsional)")
            if st.form_submit_button("💾 Simpan Piutang", use_container_width=True):
                if nama_p and nominal_p>0:
                    new_p=pd.DataFrame([{"Tanggal":datetime.date.today().strftime("%Y-%m-%d"),
                        "Nama":nama_p,"Nominal":nominal_p,"Catatan":catatan_p,
                        "Status":"Belum Lunas","Tenggat":tenggat_p.strftime("%Y-%m-%d"),"Tanggal_Lunas":""}])
                    new_t=pd.DataFrame([{"Tanggal":datetime.date.today().strftime("%Y-%m-%d"),
                        "Tipe":"Pengeluaran","Kategori":"Piutang","Nominal":nominal_p,
                        "Catatan":f"Piutang: {nama_p}","Status":"Cleared","Tenggat_Waktu":"",
                        "Tanggal_Bayar":datetime.date.today().strftime("%Y-%m-%d")}])
                    df_piutang=pd.concat([df_piutang,new_p],ignore_index=True)
                    df_asli=pd.concat([df_asli,new_t],ignore_index=True)
                    save_piutang(df_piutang); save_data(df_asli)
                    st.success(f"✅ Piutang {nama_p} Rp {nominal_p:,.0f} dicatat! Saldo berkurang.")
                    st.rerun()
                else: st.warning("Isi nama dan nominal.")

    with pf2:
        if not df_piutang.empty:
            blm=df_piutang[df_piutang["Status"]=="Belum Lunas"]
            lns=df_piutang[df_piutang["Status"]=="Lunas"]
            st.markdown(f"""
            <div class="card card-warn">
                <p class="card-label">💸 BELUM KEMBALI</p>
                <p class="card-value" style="color:#F59E0B;">Rp {blm['Nominal'].sum():,.0f}</p>
                <p class="card-sub">{len(blm)} orang</p>
            </div>
            <div class="card card-green">
                <p class="card-label">✅ SUDAH KEMBALI</p>
                <p class="card-value" style="color:#10B981;">Rp {lns['Nominal'].sum():,.0f}</p>
                <p class="card-sub">{len(lns)} transaksi lunas</p>
            </div>""", unsafe_allow_html=True)
            today_s=datetime.date.today().strftime("%Y-%m-%d")
            ov=blm[blm["Tenggat"]<today_s]
            if not ov.empty:
                st.error(f"🚨 {len(ov)} piutang melewati tenggat!")
                for _,od in ov.iterrows():
                    st.markdown(f"- **{od['Nama']}** — Rp {od['Nominal']:,.0f} (due: {od['Tenggat']})")

    if not df_piutang.empty:
        st.markdown("---")
        st.markdown("**📋 Daftar Piutang**")
        for idx,row in df_piutang.iterrows():
            if row["Status"]=="Belum Lunas":
                ca,cb,cc,cd,ce = st.columns([2,2,2,2,1.5])
                ca.markdown(f"**{row['Nama']}**")
                cb.markdown(f"Rp {row['Nominal']:,.0f}")
                cc.markdown(f"Due: {row['Tenggat']}")
                cd.markdown("🟡 Belum Lunas")
                if ce.button("✅ Lunas", key=f"lunas_{idx}"):
                    df_piutang.at[idx,"Status"]="Lunas"
                    df_piutang.at[idx,"Tanggal_Lunas"]=datetime.date.today().strftime("%Y-%m-%d")
                    new_inc=pd.DataFrame([{"Tanggal":datetime.date.today().strftime("%Y-%m-%d"),
                        "Tipe":"Pemasukan","Kategori":"Piutang Kembali","Nominal":row["Nominal"],
                        "Catatan":f"Lunas: {row['Nama']}","Status":"Cleared","Tenggat_Waktu":"",
                        "Tanggal_Bayar":datetime.date.today().strftime("%Y-%m-%d")}])
                    df_asli=pd.concat([df_asli,new_inc],ignore_index=True)
                    save_piutang(df_piutang); save_data(df_asli)
                    st.success(f"✅ {row['Nama']} lunas! Saldo +Rp {row['Nominal']:,.0f}")
                    st.rerun()
            else:
                ca,cb,cc,cd = st.columns([2,2,2,3])
                ca.markdown(f"~~{row['Nama']}~~")
                cb.markdown(f"Rp {row['Nominal']:,.0f}")
                cc.markdown(f"Lunas: {row.get('Tanggal_Lunas','')}")
                cd.markdown("🟢 Lunas")
    else:
        st.info("Belum ada piutang tercatat.")

with tab_recurring_t:
    st.subheader("🔄 Recurring Expense")
    st.caption("Pengeluaran rutin otomatis dicatat setiap bulan/minggu sesuai jadwal yang kamu set.")

    with st.form("form_recurring", clear_on_submit=True):
        r1,r2 = st.columns(2)
        with r1:
            nama_r   = st.text_input("Nama (misal: Kos, Netflix, Spotify)")
            kat_r    = st.selectbox("Kategori",["Makan (Sahur/Buka)","Bensin / Mobilitas","Kebutuhan Lab / Magang","Lainnya"])
            nominal_r= st.number_input("Nominal (Rp)",min_value=0,step=5000)
        with r2:
            frek_r   = st.selectbox("Frekuensi",["Bulanan","Mingguan"])
            tgl_r    = st.date_input("Tanggal Tagihan",datetime.date.today())
            catatan_r= st.text_input("Catatan")
        if st.form_submit_button("💾 Simpan Recurring", use_container_width=True):
            if nama_r and nominal_r>0:
                new_r=pd.DataFrame([{"Nama":nama_r,"Kategori":kat_r,"Nominal":nominal_r,
                    "Tanggal_Mulai":tgl_r.strftime("%Y-%m-%d"),"Frekuensi":frek_r,"Aktif":True,"Catatan":catatan_r}])
                df_recurring=pd.concat([df_recurring,new_r],ignore_index=True)
                save_recurring(df_recurring)
                st.success(f"✅ '{nama_r}' disimpan! Otomatis tercatat setiap {frek_r.lower()}.")
                st.rerun()

    if not df_recurring.empty:
        st.markdown("**📋 Daftar Recurring**")
        for i,row in df_recurring.iterrows():
            aktif=str(row.get("Aktif","True")).lower()=="true"
            ca,cb,cc,cd,ce=st.columns([2.5,2,1.5,1.5,1])
            ca.markdown(f"{'🟢' if aktif else '⚫'} **{row['Nama']}**")
            cb.markdown(f"Rp {row['Nominal']:,.0f} / {row['Frekuensi']}")
            cc.markdown(str(row['Kategori'])[:18])
            cd.markdown(f"Tgl {pd.to_datetime(row['Tanggal_Mulai']).day}")
            if ce.button("⏸" if aktif else "▶", key=f"tog_{i}"):
                df_recurring.at[i,"Aktif"]=not aktif; save_recurring(df_recurring); st.rerun()
    else:
        st.info("Belum ada recurring expense.")

with tab_laporan_t:
    st.subheader("📋 Laporan Mingguan Otomatis")

    minggu_opts={}
    for i in range(4):
        s=hari_ini_tgl-datetime.timedelta(days=hari_ini_tgl.weekday()+7*i)
        e=s+datetime.timedelta(days=6)
        lbl=f"{'Minggu ini' if i==0 else f'{i} minggu lalu'} ({s.strftime('%d %b')} - {e.strftime('%d %b')})"
        minggu_opts[lbl]=(s,e)

    sel=st.selectbox("Pilih Periode",list(minggu_opts.keys()))
    s_dt,e_dt=minggu_opts[sel]

    df_lap=df_asli[mask_aktif].copy()
    df_lap=df_lap[(df_lap["Tanggal_dt"].dt.date>=s_dt)&(df_lap["Tanggal_dt"].dt.date<=e_dt)]
    df_inc_lap=df_asli[mask_income].copy()
    df_inc_lap=df_inc_lap[(df_inc_lap["Tanggal_dt"].dt.date>=s_dt)&(df_inc_lap["Tanggal_dt"].dt.date<=e_dt)]

    tot_lo=df_lap["Nominal"].sum(); tot_li=df_inc_lap["Nominal"].sum()
    net_l=tot_li-tot_lo; avg_l=tot_lo/7

    la1,la2,la3,la4=st.columns(4)
    la1.metric("Total Pengeluaran",f"Rp {tot_lo:,.0f}")
    la2.metric("Total Pemasukan",  f"Rp {tot_li:,.0f}")
    la3.metric("Net Cash Flow",    f"Rp {net_l:,.0f}", delta="Surplus" if net_l>=0 else "Defisit", delta_color="normal" if net_l>=0 else "inverse")
    la4.metric("Rata-rata Harian", f"Rp {avg_l:,.0f}", delta=f"{'✅ Aman' if avg_l<=batas_hr else '⚠️ Melebihi limit'}", delta_color="off")

    if not df_lap.empty:
        dd=df_lap.groupby(df_lap["Tanggal_dt"].dt.date)["Nominal"].sum().reset_index()
        dd.columns=["Tanggal","Total"]
        fl=px.bar(dd,x="Tanggal",y="Total",color_discrete_sequence=["#10B981"],title="Pengeluaran Harian")
        fl.add_hline(y=batas_hr,line_dash="dot",line_color="#EF4444",annotation_text="Limit Harian",annotation_font_color="#EF4444")
        fl.update_layout(**PLOT); st.plotly_chart(fl,use_container_width=True)

        top_k=df_lap.groupby("Kategori")["Nominal"].sum().sort_values(ascending=False).reset_index()
        st.markdown("**🏆 Top Kategori**")
        for _,r in top_k.iterrows():
            p=r["Nominal"]/tot_lo if tot_lo>0 else 0
            st.markdown(f"`{r['Kategori'][:25]}` — Rp {r['Nominal']:,.0f} ({p*100:.1f}%)")
            st.progress(p)

        st.markdown("**📄 Detail Transaksi**")
        ds=df_lap[["Tanggal","Kategori","Nominal","Catatan"]].copy()
        ds["Nominal"]=ds["Nominal"].apply(lambda x:f"Rp {x:,.0f}")
        st.dataframe(ds,use_container_width=True,hide_index=True)

        st.markdown("**💡 Insight Otomatis**")
        if avg_l>batas_hr:
            st.error(f"⚠️ Rata-rata harian Rp {avg_l:,.0f} melebihi limit Rp {batas_hr:,.0f}. Kurangi pengeluaran!")
        else:
            st.success(f"✅ Kamu hemat Rp {(batas_hr-avg_l)*7:,.0f} minggu ini dibanding limit!")
        if not top_k.empty:
            t1=top_k.iloc[0]
            st.info(f"📌 Terbesar: **{t1['Kategori']}** — Rp {t1['Nominal']:,.0f} ({t1['Nominal']/tot_lo*100:.1f}%)")
    else:
        st.info("Tidak ada transaksi di periode ini.")

st.divider()

with tab_mandiri:
    st.subheader("📧 Import Transaksi dari Email Mandiri")
    st.caption("Otomatis baca email notifikasi Livin' Mandiri dari Gmail kamu.")

    col_m1, col_m2 = st.columns(2)
    with col_m1:
        m_email = st.text_input("Gmail", placeholder="kamu@gmail.com", key="m_email")
        m_pass  = st.text_input("App Password Gmail", type="password",
                     placeholder="xxxx xxxx xxxx xxxx", key="m_pass")
        m_limit = st.slider("Ambil berapa email terakhir?", 1, 50, 10)

        if "debug_body" in st.session_state:
            with st.expander("🔍 Debug Body Email"):
                st.text_area("Raw body:", st.session_state["debug_body"], height=300)
        else:
            st.caption("Fetch email dulu untuk melihat debug.")

    with col_m2:
        st.info("""**Cara setup:**
1. Aktifkan IMAP di Gmail
   → Settings → See all settings → Forwarding and POP/IMAP → Enable IMAP
2. Buat App Password
   → myaccount.google.com → Security → App Passwords
3. Masukkan Gmail + App Password di sini""")

    if st.button("📥 Fetch Email Mandiri", use_container_width=True):
        if m_email and m_pass:
            with st.spinner("📧 Membaca email dari Gmail..."):
                rows, err = fetch_mandiri_emails(m_email, m_pass, m_limit)
            if err:
                st.error(f"❌ Error: {err}")
            elif not rows:
                st.warning("Tidak ada email transaksi Mandiri ditemukan.")
            else:
                st.session_state["mandiri_rows"] = rows
                st.success(f"✅ Ditemukan {len(rows)} transaksi!")
        else:
            st.warning("Isi Gmail dan App Password dulu.")\
            
    if "mandiri_rows" in st.session_state:
        rows = st.session_state["mandiri_rows"]
        st.markdown("**📋 Preview Transaksi — edit sebelum disimpan:**")

        df_prev = pd.DataFrame(rows).drop(columns=["subject"], errors="ignore")
        df_prev["Tanggal"] = pd.to_datetime(df_prev["Tanggal"], errors="coerce").dt.date

        edited = st.data_editor(df_prev, use_container_width=True,
            column_config={
                "Tipe":     st.column_config.SelectboxColumn("Tipe", options=["Pengeluaran","Pemasukan"]),
                "Kategori": st.column_config.SelectboxColumn("Kategori", options=[
                    "Makan (Sahur/Buka)","Bensin / Mobilitas","Bukber / Hiburan",
                    "Kebutuhan Lab / Magang","Scheduled Settlement","Lainnya"]),
                "Nominal":  st.column_config.NumberColumn("Nominal (Rp)", format="Rp %d"),
            })

        col_imp1, col_imp2 = st.columns(2)
        with col_imp1:
            if st.button("💾 Import Semua ke Database", use_container_width=True):
                imported = 0
                new_rows_for_cloud = []
                
                for _, row in edited.iterrows():
                    dup = df_asli[
                        (df_asli["Nominal"] == row["Nominal"]) &
                        (df_asli["Tanggal"].astype(str) == str(row["Tanggal"])) &
                        (df_asli["Catatan"].astype(str).str.contains(str(row["Catatan"])[:20], na=False))
                    ]
                    
                    if dup.empty:
                        new_entry = {
                            "Tanggal": str(row["Tanggal"]),
                            "Tipe": row["Tipe"], 
                            "Kategori": row["Kategori"],
                            "Nominal": row["Nominal"], 
                            "Catatan": row["Catatan"],
                            "Status": "Cleared", 
                            "Tenggat_Waktu": "",
                            "Tanggal_Bayar": str(row["Tanggal"])
                        }
                        
                        new_row_df = pd.DataFrame([new_entry])
                        df_asli = pd.concat([df_asli, new_row_df], ignore_index=True)
                    
                        cloud_entry = {k.lower(): v for k, v in new_entry.items()}
                        new_rows_for_cloud.append(cloud_entry)
                        
                        imported += 1
                
                # Bagian simpan ini masih di dalam blok 'if st.button'
                save_data(df_asli)
                
                if new_rows_for_cloud:
                    try:
                        conn.table("transaksi").insert(new_rows_for_cloud).execute()
                        st.cache_data.clear() 
                    except Exception as e:
                        st.sidebar.error(f"Gagal kirim ke Cloud: {e}")

                del st.session_state["mandiri_rows"]
                st.success(f"✅ {imported} transaksi berhasil diimport ke Cloud & Lokal!")
                st.rerun()

        with col_imp2:
            if st.button("🗑️ Batal", use_container_width=True):
                del st.session_state["mandiri_rows"]
                st.rerun()
                
                
                
with tab_cash:
    st.subheader("💵 Uang Cash")
    st.caption("Kelola uang fisik di dompetmu")
    
    # ===== INISIALISASI HIDE/SHOW =====
    if "show_cash_amount" not in st.session_state:
        st.session_state.show_cash_amount = False
    
    # Load data cash
    UANG_CASH = load_cash_cloud()
    
    # ===== HEADER DENGAN HIDE/SHOW =====
    col_hide1, col_hide2 = st.columns([3, 1])
    with col_hide1:
        if st.session_state.show_cash_amount:
            st.markdown(f"""
            <div class="card card-green">
                <p class="card-label">💰 UANG CASH DI DOMPET</p>
                <p class="card-value" style="color:#10B981;">Rp {UANG_CASH:,.0f}</p>
                <p class="card-sub">Sisa uang fisik yang belum dipakai</p>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown(f"""
            <div class="card card-green">
                <p class="card-label">💰 UANG CASH DI DOMPET</p>
                <p class="card-value" style="color:#10B981;">Rp ••••••••</p>
                <p class="card-sub">Klik tombol 👁️ untuk melihat</p>
            </div>
            """, unsafe_allow_html=True)
    
    with col_hide2:
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button("👁️" if not st.session_state.show_cash_amount else "🙈", key="toggle_cash_tab", use_container_width=True):
            st.session_state.show_cash_amount = not st.session_state.show_cash_amount
            st.rerun()
    
    st.markdown("---")
    
    # ===== AMBIL TRANSAKSI CASH =====
    # Pastikan kolom Sumber ada
    if "Sumber" in df_asli.columns:
        df_cash_transactions = df_asli[df_asli["Sumber"] == "Cash"].copy()
    else:
        df_cash_transactions = pd.DataFrame()
        st.warning("Kolom 'Sumber' belum ada di database. Transaksi cash tidak bisa ditampilkan.")
    
    # ===== TAMPILKAN DATA CASH =====
    if not df_cash_transactions.empty:
        st.success(f"✅ Ditemukan {len(df_cash_transactions)} transaksi cash")
        
        # Statistik
        total_masuk = df_cash_transactions[df_cash_transactions["Tipe"] == "Pemasukan"]["Nominal"].sum()
        total_keluar = df_cash_transactions[df_cash_transactions["Tipe"] == "Pengeluaran"]["Nominal"].sum()
        
        col_r1, col_r2, col_r3 = st.columns(3)
        
        with col_r1:
            st.markdown(f"""
            <div class="card">
                <p class="card-label">📥 TOTAL MASUK</p>
                <p class="card-value" style="color:#10B981;">Rp {total_masuk:,.0f}</p>
                <p class="card-sub">Uang cash masuk</p>
            </div>
            """, unsafe_allow_html=True)
        
        with col_r2:
            st.markdown(f"""
            <div class="card">
                <p class="card-label">📤 TOTAL KELUAR</p>
                <p class="card-value" style="color:#EF4444;">Rp {total_keluar:,.0f}</p>
                <p class="card-sub">Uang cash terpakai</p>
            </div>
            """, unsafe_allow_html=True)
        
        with col_r3:
            selisih = total_masuk - total_keluar
            warna = "#10B981" if selisih >= 0 else "#EF4444"
            st.markdown(f"""
            <div class="card">
                <p class="card-label">⚖️ SELISIH</p>
                <p class="card-value" style="color:{warna};">Rp {selisih:,.0f}</p>
                <p class="card-sub">Masuk - Keluar</p>
            </div>
            """, unsafe_allow_html=True)
        
        # ===== GRAFIK PENGGUNAAN CASH =====
        with st.expander("📈 Grafik Penggunaan Cash", expanded=False):
            df_cash_daily = df_cash_transactions.copy()
            df_cash_daily["Tanggal"] = pd.to_datetime(df_cash_daily["Tanggal"])
            df_cash_daily = df_cash_daily[df_cash_daily["Tipe"] == "Pengeluaran"]
            
            if not df_cash_daily.empty:
                daily_sum = df_cash_daily.groupby(df_cash_daily["Tanggal"].dt.date)["Nominal"].sum().reset_index()
                daily_sum.columns = ["Tanggal", "Total"]
                daily_sum = daily_sum.sort_values("Tanggal")
                
                fig_cash = px.line(daily_sum, x="Tanggal", y="Total", 
                                   title="Tren Pengeluaran Cash",
                                   markers=True,
                                   color_discrete_sequence=["#10B981"])
                fig_cash.update_layout(**PLOT)
                st.plotly_chart(fig_cash, use_container_width=True)
                
                avg_cash = daily_sum["Total"].mean()
                st.info(f"📊 Rata-rata pengeluaran cash: Rp {avg_cash:,.0f} per hari")
                
                if avg_cash > 0 and UANG_CASH > 0:
                    hari_habis = int(UANG_CASH / avg_cash)
                    if hari_habis > 0:
                        tgl_habis = datetime.date.today() + datetime.timedelta(days=hari_habis)
                        st.warning(f"⏳ Prediksi cash habis dalam **{hari_habis} hari** ({tgl_habis.strftime('%d %b %Y')})")
            else:
                st.info("Belum ada pengeluaran cash")
        
        # ===== RIWAYAT TRANSAKSI CASH =====
        with st.expander("📋 Riwayat Transaksi Cash", expanded=True):
            # Filter
            col_filter1, col_filter2 = st.columns(2)
            with col_filter1:
                filter_tipe_cash = st.selectbox("Filter Tipe", ["Semua", "Pemasukan", "Pengeluaran"], key="filter_cash_tipe")
            with col_filter2:
                filter_bulan_cash = st.selectbox("Filter Bulan", ["Semua", "Bulan Ini", "Bulan Lalu"], key="filter_cash_bulan")
            
            df_display_cash = df_cash_transactions.copy()
            
            # Apply filter tipe
            if filter_tipe_cash != "Semua":
                df_display_cash = df_display_cash[df_display_cash["Tipe"] == filter_tipe_cash]
            
            # Apply filter bulan
            today = datetime.date.today()
            if filter_bulan_cash == "Bulan Ini":
                df_display_cash = df_display_cash[
                    (pd.to_datetime(df_display_cash["Tanggal"]).dt.month == today.month) &
                    (pd.to_datetime(df_display_cash["Tanggal"]).dt.year == today.year)
                ]
            elif filter_bulan_cash == "Bulan Lalu":
                last_month = today.month - 1 if today.month > 1 else 12
                last_month_year = today.year if today.month > 1 else today.year - 1
                df_display_cash = df_display_cash[
                    (pd.to_datetime(df_display_cash["Tanggal"]).dt.month == last_month) &
                    (pd.to_datetime(df_display_cash["Tanggal"]).dt.year == last_month_year)
                ]
            
            if not df_display_cash.empty:
                # Format untuk tampilan
                df_show = df_display_cash[["Tanggal", "Tipe", "Kategori", "Nominal", "Catatan"]].copy()
                df_show["Nominal"] = df_show["Nominal"].apply(lambda x: f"Rp {x:,.0f}")
                df_show = df_show.sort_values("Tanggal", ascending=False)
                st.dataframe(df_show, use_container_width=True, hide_index=True)
                st.caption(f"Menampilkan {len(df_show)} transaksi")
            else:
                st.info("Tidak ada transaksi cash dengan filter ini")
    
    else:
        # ===== TIDAK ADA TRANSAKSI CASH =====
        st.warning("⚠️ Belum ada transaksi cash")
        
        # Debug info (bisa dihapus nanti)
        with st.expander("🔍 Debug Info", expanded=False):
            st.write("**Kolom di df_asli:**", df_asli.columns.tolist())
            if "Sumber" in df_asli.columns:
                st.write("**Nilai unik Sumber:**", df_asli["Sumber"].unique())
                st.write("**Contoh 5 data terakhir:**")
                st.dataframe(df_asli[["Tanggal", "Tipe", "Kategori", "Nominal", "Sumber"]].tail(5))
            else:
                st.error("❌ Kolom 'Sumber' tidak ditemukan di dataframe!")
        
        st.info("💡 Gunakan form di halaman utama untuk mencatat transaksi cash dengan memilih sumber **'Cash'**")
    
    st.markdown("---")
    
    # ===== TRANSAKSI CEPAT CASH =====
    st.subheader("⚡ Transaksi Cepat Cash")
    col_quick1, col_quick2, col_quick3, col_quick4 = st.columns(4)
    
    with col_quick1:
        if st.button("💰 Tarik Tunai", use_container_width=True):
            st.session_state["quick_cash"] = "tarik"
    
    with col_quick2:
        if st.button("🍜 Makan", use_container_width=True):
            st.session_state["quick_cash"] = "makan"
    
    with col_quick3:
        if st.button("🚗 Transport", use_container_width=True):
            st.session_state["quick_cash"] = "transport"
    
    with col_quick4:
        if st.button("🛒 Belanja", use_container_width=True):
            st.session_state["quick_cash"] = "belanja"
    
    # ===== FORM QUICK CASH =====
    if "quick_cash" in st.session_state:
        st.markdown("---")
        with st.form("quick_cash_form"):
            st.markdown(f"**📝 Transaksi Cepat: {st.session_state['quick_cash'].title()}**")
            
            if st.session_state["quick_cash"] == "tarik":
                st.caption("Tarik tunai dari ATM (akan dicatat sebagai pengeluaran bank dan pemasukan cash)")
                nominal_quick = st.number_input("Nominal Tarik (Rp)", min_value=0, step=50000)
                catatan_quick = st.text_input("Catatan", placeholder="Misal: Tarik BCA")
                
                if st.form_submit_button("✅ Konfirmasi Tarik Tunai"):
                    if nominal_quick > 0:
                        # Transaksi Bank (pengeluaran)
                        transaksi_bank = {
                            "Tanggal": datetime.date.today().strftime("%Y-%m-%d"),
                            "Tipe": "Pengeluaran",
                            "Kategori": "Tarik Tunai",
                            "Nominal": nominal_quick,
                            "Catatan": f"Tarik tunai - {catatan_quick}",
                            "Status": "Cleared",
                            "Tenggat_Waktu": "",
                            "Tanggal_Bayar": datetime.date.today().strftime("%Y-%m-%d"),
                            "Sumber": "Bank"
                        }
                        save_to_cloud(transaksi_bank)
                        
                        # Transaksi Cash (pemasukan)
                        transaksi_cash = {
                            "Tanggal": datetime.date.today().strftime("%Y-%m-%d"),
                            "Tipe": "Pemasukan",
                            "Kategori": "Tarik Tunai",
                            "Nominal": nominal_quick,
                            "Catatan": f"Dari ATM - {catatan_quick}",
                            "Status": "Cleared",
                            "Tenggat_Waktu": "",
                            "Tanggal_Bayar": datetime.date.today().strftime("%Y-%m-%d"),
                            "Sumber": "Cash"
                        }
                        save_to_cloud(transaksi_cash)
                        
                        # Update saldo cash
                        baru_cash = UANG_CASH + nominal_quick
                        update_cash_cloud(baru_cash, f"Tarik tunai: {catatan_quick}")
                        
                        st.success(f"✅ Berhasil tarik Rp {nominal_quick:,.0f}")
                        del st.session_state["quick_cash"]
                        st.rerun()
            
            else:
                # Transaksi pengeluaran cash biasa
                preset_nominal = {
                    "makan": 25000,
                    "transport": 20000,
                    "belanja": 100000
                }.get(st.session_state["quick_cash"], 0)
                
                nominal_quick = st.number_input("Nominal (Rp)", min_value=0, step=10000, value=preset_nominal)
                catatan_quick = st.text_input("Catatan", placeholder=f"Misal: {st.session_state['quick_cash'].title()}...")
                
                if st.form_submit_button("✅ Konfirmasi"):
                    if nominal_quick > 0:
                        if nominal_quick <= UANG_CASH:
                            # Catat transaksi cash
                            transaksi = {
                                "Tanggal": datetime.date.today().strftime("%Y-%m-%d"),
                                "Tipe": "Pengeluaran",
                                "Kategori": st.session_state["quick_cash"].title(),
                                "Nominal": nominal_quick,
                                "Catatan": catatan_quick,
                                "Status": "Cleared",
                                "Tenggat_Waktu": "",
                                "Tanggal_Bayar": datetime.date.today().strftime("%Y-%m-%d"),
                                "Sumber": "Cash"
                            }
                            save_to_cloud(transaksi)
                            
                            # Update saldo cash
                            baru_cash = UANG_CASH - nominal_quick
                            update_cash_cloud(baru_cash, f"{st.session_state['quick_cash']}: {catatan_quick}")
                            
                            st.success(f"✅ Berhasil mencatat pengeluaran Rp {nominal_quick:,.0f}")
                            del st.session_state["quick_cash"]
                            st.rerun()
                        else:
                            st.error(f"❌ Saldo cash tidak cukup! (Sisa: Rp {UANG_CASH:,.0f})")
            
            # Tombol batal
            if st.form_submit_button("❌ Batal"):
                del st.session_state["quick_cash"]
                st.rerun()
                



with tab_tabungan:
    st.subheader("🏦 Tabungan & Goals")
    st.caption("Kelola target tabungan kamu dan lacak progresnya")
    
    total_tabungan = df_tabungan[df_tabungan["Status"] == "Aktif"]["Terkumpul"].sum() if not df_tabungan.empty else 0
    
    
    col1, col2 = st.columns([1, 1])
    
    with col1:
        with st.form("form_tabungan", clear_on_submit=True):
            st.markdown("**➕ Buat Target Tabungan Baru**")
            
            nama_t = st.text_input("Nama Target (misal: Beli Laptop, Umroh, etc)")
            target_t = st.number_input("Target Nominal (Rp)", min_value=0, step=100000)
            
            col_date1, col_date2 = st.columns(2)
            with col_date1:
                tgl_mulai = st.date_input("Tanggal Mulai", datetime.date.today())
            with col_date2:
                tgl_target = st.date_input("Target Tercapai", 
                                          datetime.date.today() + datetime.timedelta(days=365))
            
            kategori_t = st.selectbox("Kategori", ["Umum", "Kendaraan", "Pendidikan", 
                                                   "Properti", "Investasi", "Liburan", "Darurat"])
            prioritas_t = st.slider("Prioritas (1=Paling Penting)", 1, 5, 3)
            catatan_t = st.text_area("Catatan (opsional)")
            
            if st.form_submit_button("💾 Simpan Target", use_container_width=True):
                if nama_t and target_t > 0:
                    new_data = {
                        "nama": nama_t,
                        "target_nominal": target_t,
                        "nominal_terkumpul": 0,
                        "tanggal_mulai": tgl_mulai.strftime("%Y-%m-%d"),
                        "tanggal_target": tgl_target.strftime("%Y-%m-%d"),
                        "kategori": kategori_t,
                        "prioritas": prioritas_t,
                        "catatan": catatan_t,
                        "status": "Aktif"
                    }
                    
                    if save_tabungan_to_cloud(new_data):
                        st.success(f"✅ Target '{nama_t}' berhasil dibuat!")
                        st.rerun()
                else:
                    st.warning("Isi nama target dan nominal minimal > 0")
    

    with col2:
        if not df_tabungan.empty:
            total_target = df_tabungan[df_tabungan["Status"] == "Aktif"]["Target"].sum()
            total_terkumpul = df_tabungan[df_tabungan["Status"] == "Aktif"]["Terkumpul"].sum()
            progress_total = (total_terkumpul / total_target * 100) if total_target > 0 else 0
            
            total_semua_tabungan = df_tabungan["Terkumpul"].sum()
            
            st.markdown(f"""
            <div class="card card-green">
                <p class="card-label">💰 TOTAL TABUNGAN (AKTIF + SELESAI)</p>
                <p class="card-value" style="color:#10B981;">Rp {total_semua_tabungan:,.0f}</p>
                <p class="card-sub">dari target aktif Rp {total_target:,.0f}</p>
            </div>
            """, unsafe_allow_html=True)

            st.progress(progress_total / 100)
            st.caption(f"Progress target aktif: {progress_total:.1f}%")
            
            # Statistik cepat
            aktif_count = len(df_tabungan[df_tabungan["Status"] == "Aktif"])
            selesai_count = len(df_tabungan[df_tabungan["Status"] == "Selesai"])
            
            st.markdown(f"""
            <div style="display:flex; gap:10px; margin-top:10px;">
                <div style="flex:1; text-align:center; background:#1E293B; padding:10px; border-radius:8px;">
                    <span style="color:#10B981; font-size:1.2rem;">{aktif_count}</span><br>
                    <span style="color:#94A3B8;">Aktif</span>
                </div>
                <div style="flex:1; text-align:center; background:#1E293B; padding:10px; border-radius:8px;">
                    <span style="color:#F59E0B; font-size:1.2rem;">{selesai_count}</span><br>
                    <span style="color:#94A3B8;">Selesai</span>
                </div>
            </div>
            """, unsafe_allow_html=True)
    
    # Daftar Tabungan
    if not df_tabungan.empty:
        st.markdown("---")
        st.markdown("**📋 Daftar Target Tabungan**")
        
        for idx, row in df_tabungan.iterrows():
            if row["Status"] == "Aktif":
                with st.expander(f"🎯 {row['Nama']} - Rp {row['Target']:,.0f}"):
                    col_a, col_b, col_c = st.columns([2, 1, 1])
                    
                    with col_a:
                        progress = (row["Terkumpul"] / row["Target"] * 100) if row["Target"] > 0 else 0
                        st.progress(progress / 100)
                        st.caption(f"Progress: {progress:.1f}%")
                        
                        # Hitung sisa hari
                        if pd.notna(row["Tanggal_Target"]):
                            tgl_target = pd.to_datetime(row["Tanggal_Target"]).date()
                            sisa_hari = (tgl_target - datetime.date.today()).days
                            if sisa_hari > 0:
                                st.caption(f"⏳ Sisa {sisa_hari} hari")
                            elif sisa_hari == 0:
                                st.caption("📅 Hari ini target!")
                            else:
                                st.caption("⚠️ Melewati target")
                    
                    with col_b:
                        st.markdown(f"**Terkumpul:** Rp {row['Terkumpul']:,.0f}")
                        st.markdown(f"**Sisa:** Rp {row['Target'] - row['Terkumpul']:,.0f}")
                        st.markdown(f"**Kategori:** {row['Kategori']}")
                        if pd.notna(row["Tanggal_Mulai"]):
                            st.markdown(f"**Mulai:** {row['Tanggal_Mulai']}")
                    
                    with col_c:
                        # Tombol aksi
                        if st.button("💰 Setor", key=f"setor_{idx}"):
                            st.session_state[f"setor_tabungan_{idx}"] = True
                        
                        if st.button("💸 Tarik", key=f"tarik_{idx}"):
                            st.session_state[f"tarik_tabungan_{idx}"] = True
                        
                        if st.button("🗑️ Hapus", key=f"hapus_{idx}"):
                            if delete_tabungan_cloud(row.get("id")):
                                st.success(f"✅ Tabungan '{row['Nama']}' dihapus!")
                                st.rerun()
                    
                    # Form setor/tarik
                    if st.session_state.get(f"setor_tabungan_{idx}", False):
                        with st.form(key=f"form_setor_{idx}"):
                            nominal_setor = st.number_input("Nominal Setor (Rp)", min_value=0, step=10000)
                            catatan_setor = st.text_input("Catatan")
                            
                            col_btn1, col_btn2 = st.columns(2)
                            with col_btn1:
                                if st.form_submit_button("✅ Setor"):
                                    if nominal_setor > 0:
                                        # Update nominal terkumpul
                                        new_terkumpul = row["Terkumpul"] + nominal_setor
                                        update_data = {
                                            "nominal_terkumpul": new_terkumpul,
                                            "status": "Selesai" if new_terkumpul >= row["Target"] else "Aktif"
                                        }
                                        if update_tabungan_cloud(row.get("id"), update_data):
                                            # Catat transaksi
                                            transaksi_data = {
                                                "tabungan_id": row.get("id"),
                                                "tanggal": datetime.date.today().strftime("%Y-%m-%d"),
                                                "nominal": nominal_setor,
                                                "tipe": "Setor",
                                                "catatan": catatan_setor
                                            }
                                            conn.table("transaksi_tabungan").insert(transaksi_data).execute()
                                            
                                            st.success(f"✅ Berhasil setor Rp {nominal_setor:,.0f}!")
                                            st.session_state[f"setor_tabungan_{idx}"] = False
                                            st.rerun()
                            
                            with col_btn2:
                                if st.form_submit_button("❌ Batal"):
                                    st.session_state[f"setor_tabungan_{idx}"] = False
                                    st.rerun()
                    
                    if st.session_state.get(f"tarik_tabungan_{idx}", False):
                        with st.form(key=f"form_tarik_{idx}"):
                            nominal_tarik = st.number_input("Nominal Tarik (Rp)", 
                                                           min_value=0, 
                                                           max_value=int(row["Terkumpul"]),
                                                           step=10000)
                            catatan_tarik = st.text_input("Catatan")
                            
                            col_btn1, col_btn2 = st.columns(2)
                            with col_btn1:
                                if st.form_submit_button("✅ Tarik"):
                                    if nominal_tarik > 0:
                                        new_terkumpul = row["Terkumpul"] - nominal_tarik
                                        update_data = {
                                            "nominal_terkumpul": new_terkumpul
                                        }
                                        if update_tabungan_cloud(row.get("id"), update_data):
                                            # Catat transaksi
                                            transaksi_data = {
                                                "tabungan_id": row.get("id"),
                                                "tanggal": datetime.date.today().strftime("%Y-%m-%d"),
                                                "nominal": nominal_tarik,
                                                "tipe": "Tarik",
                                                "catatan": catatan_tarik
                                            }
                                            conn.table("transaksi_tabungan").insert(transaksi_data).execute()
                                            
                                            st.success(f"✅ Berhasil tarik Rp {nominal_tarik:,.0f}!")
                                            st.session_state[f"tarik_tabungan_{idx}"] = False
                                            st.rerun()
                            
                            with col_btn2:
                                if st.form_submit_button("❌ Batal"):
                                    st.session_state[f"tarik_tabungan_{idx}"] = False
                                    st.rerun()
            
            elif row["Status"] == "Selesai":
                # Tampilkan tabungan yang sudah selesai dengan style berbeda
                with st.expander(f"✅ {row['Nama']} - SELESAI"):
                    st.markdown(f"""
                    **Target:** Rp {row['Target']:,.0f}  
                    **Terkumpul:** Rp {row['Terkumpul']:,.0f}  
                    **Selesai pada:** {row.get('Tanggal_Target', '-')}
                    """)
                    
                    if st.button("🗑️ Hapus dari History", key=f"hapus_selesai_{idx}"):
                        if delete_tabungan_cloud(row.get("id")):
                            st.success("✅ Dihapus!")
                            st.rerun()
    else:
        st.info("Belum ada target tabungan. Buat yang baru di form sebelah kiri!")
                
                
with rc:
    st.subheader("📋 Ringkasan Cepat")
    sisa=batas_hr-out_hari; wc="#10B981" if sisa>=0 else "#EF4444"
    st.markdown(f"""
    <div class="card">
        <p class="card-label">SISA BUDGET HARI INI</p>
        <p class="card-value" style="color:{wc};">Rp {sisa:,.0f}</p>
        <p class="card-sub">dari limit Rp {batas_hr:,.0f}</p>
    </div>
    <div class="card">
        <p class="card-label">SISA HARI KE GAJIAN</p>
        <p class="card-value" style="color:#F59E0B;">{SISA_HARI} Hari</p>
        <p class="card-sub">Target: 17 Maret 2026</p>
    </div>""", unsafe_allow_html=True)
    if total_pend>0:
        st.markdown(f"""<div class="card card-warn">
            <p class="card-label">⏳ PENDING SETTLEMENT</p>
            <p class="card-value" style="color:#F59E0B;">Rp {total_pend:,.0f}</p>
            <p class="card-sub">{due_text}</p>
        </div>""", unsafe_allow_html=True)
    if piutang_blm>0:
        np_blm=len(df_piutang[df_piutang["Status"]=="Belum Lunas"])
        st.markdown(f"""<div class="card card-danger">
            <p class="card-label">💸 PIUTANG BELUM KEMBALI</p>
            <p class="card-value" style="color:#EF4444;">Rp {piutang_blm:,.0f}</p>
            <p class="card-sub">{np_blm} orang</p>
        </div>""", unsafe_allow_html=True)

st.divider()



st.subheader("📜 Log Transaksi")

# ===== AMBIL DATA DARI TABEL TRANSAKSI =====
try:
    res = conn.table("transaksi").select("*").order("tanggal", desc=True).execute()
    if res.data:
        df_tampil = pd.DataFrame(res.data)
        
        # Rename kolom
        df_tampil = df_tampil.rename(columns={
            "tanggal": "Tanggal",
            "tipe": "Tipe",
            "kategori": "Kategori",
            "nominal": "Nominal",
            "catatan": "Catatan",
            "status": "Status",
            "tenggat_waktu": "Tenggat_Waktu",
            "tanggal_bayar": "Tanggal_Bayar",
            "sumber": "Sumber"
        })
        df_tampil["Nominal"] = pd.to_numeric(df_tampil["Nominal"], errors="coerce").fillna(0)
        
        # Pastikan kolom ID ada
        if "id" not in df_tampil.columns:
            df_tampil["id"] = range(1, len(df_tampil) + 1)
    else:
        df_tampil = pd.DataFrame()
except Exception as e:
    st.error(f"Error: {e}")
    df_tampil = pd.DataFrame()

# ===== AMBIL SEMUA KATEGORI UNIK UNTUK DROPDOWN =====
semua_kategori = []
if not df_tampil.empty:
    semua_kategori = sorted(df_tampil["Kategori"].dropna().unique().tolist())
    # Tambah opsi untuk kategori baru
    semua_kategori.append("➕ Tambah Kategori Baru...")

# ===== TAMPILKAN DATA =====
if not df_tampil.empty:
    # Filter
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        filter_tipe = st.selectbox("Filter Tipe", ["Semua", "Pengeluaran", "Pemasukan"], key="filter_tipe_log")
    with col2:
        filter_sumber = st.selectbox("Filter Sumber", ["Semua", "Bank", "Cash"], key="filter_sumber_log")
    with col3:
        filter_status = st.selectbox("Filter Status", ["Semua", "Cleared", "Pending"], key="filter_status_log")
    with col4:
        rows_per_page = st.selectbox("Baris per halaman", [10, 25, 50, 100], index=0, key="rows_per_page")
    
    # Apply filter
    df_filter = df_tampil.copy()
    if filter_tipe != "Semua":
        df_filter = df_filter[df_filter["Tipe"] == filter_tipe]
    if filter_sumber != "Semua":
        df_filter = df_filter[df_filter["Sumber"] == filter_sumber]
    if filter_status != "Semua":
        df_filter = df_filter[df_filter["Status"] == filter_status]
    
    # Format tanggal
    for col in ["Tanggal", "Tenggat_Waktu", "Tanggal_Bayar"]:
        if col in df_filter.columns:
            df_filter[col] = pd.to_datetime(df_filter[col], errors="coerce").dt.date
    
    # ===== DATA EDITOR DENGAN EDITABLE SEMUA KOLOM =====
    st.caption(f"Total: {len(df_filter)} transaksi")
    
    # Konfigurasi kolom untuk data editor
    column_config = {
        "Tanggal": st.column_config.DateColumn(
            "Tanggal", 
            format="YYYY-MM-DD",
            help="Klik untuk memilih tanggal"
        ),
        "Tipe": st.column_config.SelectboxColumn(
            "Tipe", 
            options=["Pengeluaran", "Pemasukan"], 
            required=True,
            help="Pilih tipe transaksi"
        ),
        "Kategori": st.column_config.TextColumn(  # <-- UBAH JADI TEXT (BIASA)
            "Kategori",
            help="Ketik kategori baru atau pilih dari dropdown",
            default=""
        ),
        "Nominal": st.column_config.NumberColumn(
            "Nominal (Rp)", 
            format="Rp %d", 
            step=1000,
            min_value=0
        ),
        "Catatan": st.column_config.TextColumn(
            "Catatan",
            help="Ketik catatan transaksi"
        ),
        "Sumber": st.column_config.SelectboxColumn(
            "Sumber", 
            options=["Bank", "Cash"], 
            required=True,
            help="Pilih sumber dana"
        ),
        "Status": st.column_config.SelectboxColumn(
            "Status", 
            options=["Pending", "Cleared"], 
            required=True,
            help="Pilih status"
        ),
        "Tenggat_Waktu": st.column_config.DateColumn(
            "Tenggat", 
            format="YYYY-MM-DD",
            help="Klik untuk memilih tanggal jatuh tempo"
        ),
        "Tanggal_Bayar": st.column_config.DateColumn(
            "Tgl Bayar", 
            format="YYYY-MM-DD",
            help="Klik untuk memilih tanggal bayar"
        ),
    }
    
    # Tampilkan data editor
    edited_df = st.data_editor(
        df_filter,
        use_container_width=True,
        num_rows="dynamic",
        column_config=column_config,
        hide_index=True,
        key="log_data_editor"
    )
    
    # ===== TOMBOL SIMPAN PERUBAHAN =====
    col_simpan1, col_simpan2, col_simpan3 = st.columns([1, 1, 2])
    
    with col_simpan1:
        if st.button("💾 Simpan Perubahan", use_container_width=True):
            with st.spinner("Menyimpan ke database..."):
                try:
                    # Validasi nominal tidak boleh 0
                    if (edited_df["Nominal"] <= 0).any():
                        st.error("❌ Ada nominal yang 0 atau kurang!")
                    else:
                        # Konversi kembali ke format database
                        data_to_save = edited_df.copy()
                        
                        # Format tanggal ke string
                        for col in ["Tanggal", "Tenggat_Waktu", "Tanggal_Bayar"]:
                            if col in data_to_save.columns:
                                data_to_save[col] = data_to_save[col].apply(
                                    lambda x: x.strftime("%Y-%m-%d") if pd.notnull(x) and hasattr(x, 'strftime') else ""
                                )
                        
                        # Rename ke lowercase untuk Supabase
                        data_to_save = data_to_save.rename(columns={
                            "Tanggal": "tanggal",
                            "Tipe": "tipe",
                            "Kategori": "kategori",
                            "Nominal": "nominal",
                            "Catatan": "catatan",
                            "Status": "status",
                            "Tenggat_Waktu": "tenggat_waktu",
                            "Tanggal_Bayar": "tanggal_bayar",
                            "Sumber": "sumber"
                        })
                        
                        # Hapus kolom yang tidak ada di database
                        cols_to_keep = ["tanggal", "tipe", "kategori", "nominal", 
                                       "catatan", "status", "tenggat_waktu", "tanggal_bayar", "sumber"]
                        data_to_save = data_to_save[[c for c in cols_to_keep if c in data_to_save.columns]]
                        
                        records = data_to_save.to_dict(orient="records")
                        
                        # Hapus semua data lama
                        conn.table("transaksi").delete().neq("id", -1).execute()
                        
                        # Insert data baru
                        if records:
                            conn.table("transaksi").insert(records).execute()
                        
                        st.success(f"✅ {len(records)} transaksi berhasil disimpan!")
                        st.cache_data.clear()
                        st.rerun()
                        
                except Exception as e:
                    st.error(f"Error: {e}")
    
    with col_simpan2:
        if st.button("🔄 Refresh", use_container_width=True):
            st.cache_data.clear()
            st.rerun()
    
    # ===== TOMBOL HAPUS MASAL =====
    with st.expander("🗑️ Hapus Data Massal", expanded=False):
        st.warning("⚠️ Hati-hati! Aksi ini tidak bisa dibatalkan.")
        
        col_hapus1, col_hapus2, col_hapus3, col_hapus4 = st.columns(4)
        
        with col_hapus1:
            if st.button("Hapus Semua Data Bank", use_container_width=True):
                conn.table("transaksi").delete().eq("sumber", "Bank").execute()
                st.success("Data bank dihapus!")
                st.rerun()
        
        with col_hapus2:
            if st.button("Hapus Semua Data Cash", use_container_width=True):
                conn.table("transaksi").delete().eq("sumber", "Cash").execute()
                st.success("Data cash dihapus!")
                st.rerun()
        
        with col_hapus3:
            if st.button("Hapus SEMUA Data", use_container_width=True):
                conn.table("transaksi").delete().neq("id", -1).execute()
                st.success("Semua data dihapus!")
                st.rerun()
        
        with col_hapus4:
            # Hapus berdasarkan ID
            id_hapus = st.number_input("ID yang dihapus", min_value=1, step=1, key="id_hapus")
            if st.button("Hapus ID", use_container_width=True):
                conn.table("transaksi").delete().eq("id", id_hapus).execute()
                st.success(f"ID {id_hapus} dihapus!")
                st.rerun()

else:
    st.info("Belum ada data transaksi")
    
    # Tombol untuk insert contoh data
    if st.button("➕ Insert Contoh Data"):
        contoh = [
            {
                "tanggal": datetime.date.today().strftime("%Y-%m-%d"),
                "tipe": "Pengeluaran",
                "kategori": "Makan",
                "nominal": 50000,
                "catatan": "Makan siang",
                "status": "Cleared",
                "sumber": "Bank"
            },
            {
                "tanggal": datetime.date.today().strftime("%Y-%m-%d"),
                "tipe": "Pengeluaran",
                "kategori": "Transport",
                "nominal": 20000,
                "catatan": "Gojek",
                "status": "Cleared",
                "sumber": "Cash"
            }
        ]
        for data in contoh:
            conn.table("transaksi").insert(data).execute()
        st.success("Contoh data ditambahkan!")
        st.rerun()


with st.sidebar.expander("🔍 DEBUG FILTER TANGGAL", expanded=True):
    st.write("### Informasi Sistem")
    st.write(f"🕒 `datetime.datetime.now()`: {datetime.datetime.now()}")
    st.write(f"📅 `datetime.date.today()`: {datetime.date.today()}")
    st.write(f"📅 `now.date()`: {now.date() if 'now' in locals() else 'now not defined'}")
    
    # Cek timezone
    try:
        st.write(f"🕒 Timezone: {datetime.datetime.now().astimezone().tzinfo}")
    except:
        pass
    
    st.write("### Data di DataFrame")
    if not df_asli.empty:
        # Tampilkan 5 transaksi terakhir
        st.write("**5 Transaksi Terakhir:**")
        st.dataframe(df_asli[["Tanggal", "Tipe", "Nominal", "Sumber"]].head(5))
        
        # Tampilkan unique dates
        unique_dates = sorted(df_asli["Tanggal"].unique(), reverse=True)
        st.write(f"**Semua tanggal di database:** {unique_dates}")
        
        # Cek tanggal hari ini di database
        today_str = datetime.date.today().strftime("%Y-%m-%d")
        st.write(f"**Tanggal hari ini (menurut sistem):** {today_str}")
        
        if today_str in df_asli["Tanggal"].values:
            st.success(f"✅ Tanggal {today_str} ADA di database")
            df_today = df_asli[df_asli["Tanggal"] == today_str]
            st.dataframe(df_today[["Tipe", "Nominal", "Kategori"]])
        else:
            st.error(f"❌ Tanggal {today_str} TIDAK ADA di database")
            st.write("Data terakhir di database:", unique_dates[0] if unique_dates else "Tidak ada data")
    
    st.write("### Hasil Filter `out_hari`")
    if 'out_hari' in locals():
        st.write(f"📊 `out_hari`: Rp {out_hari:,.0f}")
        st.write(f"📊 `out_hari_bank`: Rp {out_hari_bank:,.0f}")
        st.write(f"📊 `out_hari_cash`: Rp {out_hari_cash:,.0f}")
    else:
        st.error("❌ Variabel `out_hari` belum didefinisikan!")
    
    st.write("### Query Langsung ke Supabase")
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    try:
        res = conn.table("transaksi").select("*").eq("tanggal", today_str).execute()
        st.write(f"**Data dari Supabase untuk {today_str}:**")
        st.write(f"Jumlah: {len(res.data)} transaksi")
        if res.data:
            for d in res.data:
                st.write(f"- {d['tanggal']} | {d['tipe']} | {d['kategori']} | Rp {d['nominal']:,.0f}")
    except Exception as e:
        st.error(f"Error query: {e}")

st.markdown("---")
st.markdown("""<div style="text-align:center;color:#334155;font-size:.75rem;padding:10px 0;">
💼 Financial Dashboard</div>""", unsafe_allow_html=True)
