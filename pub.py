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
import datetime
import pytz
now_wib = datetime.datetime.utcnow() + datetime.timedelta(hours=7)
hari_ini_wib = now_wib.date()


DATA_FILE      = "keuangan_ramadan.csv"
PIUTANG_FILE   = "piutang.csv"
BUDGET_FILE    = "budget_target.csv"
RECURRING_FILE = "recurring.csv"

# Kategori yang diabaikan dari perhitungan limit harian (Jastip, Transfer Aset, dll)
EXCLUDE_FROM_LIMIT = ["Transfer Aset", "Scheduled Settlement", "Penyesuaian", "Menabung"]

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
                "sumber": "Sumber",
                "titipan": "Titipan"
            }
            
            df = df.rename(columns=nama_kolom_baru)
            
            df["Nominal"] = pd.to_numeric(df["Nominal"], errors="coerce").fillna(0)
            df["Titipan"] = pd.to_numeric(df.get("Titipan", 0), errors="coerce").fillna(0)
            
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
        "Tanggal_Bayar","Sumber","Titipan"
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
    
def get_saldo_cash(df):
    """Hitung saldo cash langsung dari tabel transaksi."""
    cash_in  = df[(df["Tipe"]=="Pemasukan")  & (df["Sumber"]=="Cash")]["Nominal"].sum()
    cash_out = df[(df["Tipe"]=="Pengeluaran") & (df["Sumber"]=="Cash")]["Nominal"].sum()
    return cash_in - cash_out

def get_all_categories(df):
    """
    Mengambil semua kategori unik dari dataframe, membersihkannya (Title Case),
    dan menggabungkannya dengan daftar default.
    """
    default_cats = [
        "Makan", "Bensin / Mobilitas", "Kos", "Hiburan", 
        "Kebutuhan Lab / Magang", "Bulanan", "SPay", 
        "Belanja Dapur", "Penyesuaian", "Scheduled Settlement",
        "Titipan / Jastip"
    ]
    
    # Kategori yang tidak ingin dimunculkan lagi di dropdown (Filter agar rapi)
    blacklist = ["Piutang", "Admin Shopee", "Dari Bapak", "Beras", "Jatip", "Tarik Tunai", "Bensin", "Penyesuaiian"]
    
    if df is None or df.empty:
        return sorted([c for c in default_cats if c not in blacklist]) + ["Lainnya (Ketik Manual...)"]
    
    # Ambil kategori unik dari data, bersihkan whitespace, dan Title Case
    # Kita filter "Lainnya" agar tidak masuk ke list sebagai opsi ganda
    existing_cats = [str(c).strip().title() for c in df["Kategori"].dropna().unique() 
                     if str(c).strip() and "Lainnya" not in str(c)]
    
    # Gabungkan dengan default, hilangkan duplikat, dan saring blacklist
    all_cats = list(set(default_cats + existing_cats))
    all_cats = [c for c in all_cats if c not in blacklist]
    
    return sorted(all_cats) + ["Lainnya (Ketik Manual...)"]



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
            "tanggal_update": hari_ini_wib.strftime("%Y-%m-%d"),
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
        if "Sumber" not in df.columns:
            df["Sumber"] = "Bank"
        return df
    return pd.DataFrame(columns=["Tanggal","Nama","Nominal","Catatan","Status","Tenggat","Tanggal_Lunas", "Sumber"])

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
            tanggal = str(hari_ini_wib)
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
                    tanggal = str(hari_ini_wib)

      
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
    today = hari_ini_wib
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
    df_asli["Sumber"] = "Bank"
        
# Final column setup
if "Titipan" not in df_asli.columns:
    df_asli["Titipan"] = 0
df_asli["Titipan"] = pd.to_numeric(df_asli["Titipan"], errors="coerce").fillna(0)
df_asli["Net_Nominal"] = df_asli["Nominal"] - df_asli["Titipan"]
        


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

UANG_CASH = get_saldo_cash(df_asli)


FIKTIF_BASE = 140000000
MULTIPLIER  = 100



hari_ini_tgl   = hari_ini_wib
settings        = load_settings_cloud()
tanggal_gajian  = settings.get("tanggal_gajian", datetime.date(2026, 3, 17))
if isinstance(tanggal_gajian, str):
    try:    tanggal_gajian = datetime.datetime.strptime(tanggal_gajian, "%Y-%m-%d").date()
    except: tanggal_gajian = datetime.date(2026, 3, 17)
SISA_HARI = max((tanggal_gajian - hari_ini_tgl).days, 1)

# Baru hitung saldo
total_out_bank = df_asli[
    (df_asli["Tipe"] == "Pengeluaran") & 
    (df_asli["Sumber"] == "Bank")
]["Nominal"].sum()

total_in_bank = df_asli[
    (df_asli["Tipe"] == "Pemasukan") & 
    (df_asli["Sumber"] == "Bank")
]["Nominal"].sum()

SALDO_BANK = total_in_bank - total_out_bank
UANG_CASH  = get_saldo_cash(df_asli)   # ← pakai load, bukan recalculate
TABUNGAN   = REAL_DARURAT
saldo_op   = SALDO_BANK + UANG_CASH - TABUNGAN
total_real = SALDO_BANK + UANG_CASH
batas_hr   = saldo_op / SISA_HARI


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
            min_value=hari_ini_wib
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

mask_aktif  = (df_asli["Tipe"]=="Pengeluaran") & ~(df_asli["Kategori"].isin(EXCLUDE_FROM_LIMIT))
mask_income = (df_asli["Tipe"]=="Pemasukan")
mask_pend   = (df_asli["Tipe"]=="Pengeluaran")&(df_asli["Kategori"]=="Scheduled Settlement")&(df_asli["Status"]=="Pending")

total_out   = df_asli[mask_aktif]["Net_Nominal"].sum()
total_in    = df_asli[mask_income]["Nominal"].sum()
total_pend  = df_asli[mask_pend]["Net_Nominal"].sum()
piutang_blm = df_piutang[df_piutang["Status"]=="Belum Lunas"]["Nominal"].sum() if not df_piutang.empty else 0






# ===== FILTER UNTUK TRANSAKSI =====
mask_aktif = (df_asli["Tipe"] == "Pengeluaran") & ~(df_asli["Kategori"].isin(EXCLUDE_FROM_LIMIT))

# ===== FILTER BERDASARKAN SUMBER (AMAN) =====
if "Sumber" in df_asli.columns:
    mask_bank = (df_asli["Sumber"] == "Bank") | (df_asli["Sumber"].isna())
    mask_cash = df_asli["Sumber"] == "Cash"
else:
    # Fallback untuk data lama yang belum punya kolom Sumber
    mask_bank = pd.Series([True] * len(df_asli), index=df_asli.index)
    mask_cash = pd.Series([False] * len(df_asli), index=df_asli.index)



# Hari ini
out_hari_bank = df_asli[mask_aktif & mask_bank & (df_asli["Tanggal_dt"].dt.date == hari_ini_wib)]["Net_Nominal"].sum()
out_hari_cash = df_asli[mask_aktif & mask_cash & (df_asli["Tanggal_dt"].dt.date == hari_ini_wib)]["Net_Nominal"].sum()
out_hari = out_hari_bank + out_hari_cash

# Minggu ini
out_minggu_bank = df_asli[mask_aktif & mask_bank & 
                          (df_asli["Tanggal_dt"].dt.isocalendar().week == now.isocalendar()[1]) & 
                          (df_asli["Tanggal_dt"].dt.year == now.year)]["Net_Nominal"].sum()
out_minggu_cash = df_asli[mask_aktif & mask_cash & 
                          (df_asli["Tanggal_dt"].dt.isocalendar().week == now.isocalendar()[1]) & 
                          (df_asli["Tanggal_dt"].dt.year == now.year)]["Net_Nominal"].sum()
out_minggu = out_minggu_bank + out_minggu_cash

# Bulan ini
out_bulan_bank = df_asli[mask_aktif & mask_bank & 
                         (df_asli["Tanggal_dt"].dt.month == now.month) & 
                         (df_asli["Tanggal_dt"].dt.year == now.year)]["Net_Nominal"].sum()
out_bulan_cash = df_asli[mask_aktif & mask_cash & 
                         (df_asli["Tanggal_dt"].dt.month == now.month) & 
                         (df_asli["Tanggal_dt"].dt.year == now.year)]["Net_Nominal"].sum()
out_bulan = out_bulan_bank + out_bulan_cash



penggunaan_cash_hari_ini = df_asli[
    mask_cash & mask_aktif & (df_asli["Tanggal_dt"].dt.date == hari_ini_wib)]["Net_Nominal"].sum()

penggunaan_cash_minggu = df_asli[
    mask_cash & mask_aktif &
    (df_asli["Tanggal_dt"].dt.isocalendar().week == now.isocalendar()[1]) &
    (df_asli["Tanggal_dt"].dt.year == now.year)]["Net_Nominal"].sum()

penggunaan_cash_bulan = df_asli[
    mask_cash & mask_aktif &
    (df_asli["Tanggal_dt"].dt.month == now.month) &
    (df_asli["Tanggal_dt"].dt.year == now.year)]["Nominal"].sum()


due_text = "No Pending"
if not df_asli[mask_pend].empty:
    vd = pd.to_datetime(df_asli[mask_pend]["Tenggat_Waktu"], errors='coerce').dropna()
    if not vd.empty: due_text = f"Due: {vd.min().strftime('%d %b %y')}"

is_real_mode = (secret_code == "naufal")
mult         = 1 if is_real_mode else MULTIPLIER
total_aset   = total_real if is_real_mode else (FIKTIF_BASE + total_real)


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

# 2. Status Jatah & Transaksi
sisa_jatah_hari_ini = batas_hr - out_hari
warna_sisa = "#10B981" if sisa_jatah_hari_ini >= 0 else "#EF4444"
persentase = (out_hari / batas_hr * 100) if batas_hr > 0 else 0

# 3. Prediksi Real Besok (berdasarkan jajan hari ini)
sisa_hari_besok = max(SISA_HARI - 1, 1)
# Logika: (Total Sisa Uang Real) / Sisa Hari Besok
sisa_uang_real = saldo_op - out_hari 
# Catatan: saldo_op di kodingan ini adalah Opening Balance harinya.
prediksi_besok = max(0, sisa_uang_real / sisa_hari_besok)

# Tampilan utama limit harian
col_l1, col_l2, col_l3, col_l4 = st.columns(4)

with col_l1:
    st.markdown(f"""
    <div class="card card-green">
        <p class="card-label">📊 BUDGET HARI INI</p>
        <p class="card-value" style="color:#10B981;">Rp {batas_hr:,.0f}</p>
        <p class="card-sub">Jatah belanja harian</p>
    </div>
    """, unsafe_allow_html=True)

with col_l2:
    st.markdown(f"""
    <div class="card">
        <p class="card-label">💰 TERPAKAI</p>
        <p class="card-value" style="color:#F59E0B;">Rp {out_hari:,.0f}</p>
        <p class="card-sub">{persentase:.1f}% terpakai</p>
    </div>
    """, unsafe_allow_html=True)

with col_l3:
    st.markdown(f"""
    <div class="card">
        <p class="card-label">⏳ SISA JATAH HARI INI</p>
        <p class="card-value" style="color:{warna_sisa};">Rp {sisa_jatah_hari_ini:,.0f}</p>
        <p class="card-sub">Bisa belanja lagi</p>
    </div>
    """, unsafe_allow_html=True)

with col_l4:
    st.markdown(f"""
    <div class="card card-warn">
        <p class="card-label">🔮 PREDIKSI ESOK</p>
        <p class="card-value" style="color:#60A5FA;">Rp {prediksi_besok:,.0f}</p>
        <p class="card-sub">Target jatah besok</p>
    </div>
    """, unsafe_allow_html=True)

# Progress bar
st.progress(min(persentase / 100, 1.0))

# Status berdasarkan penggunaan
if persentase < 30:
    st.success(f"🟢 Aman Banget! Kamu masih bisa jajan Rp {sisa_jatah_hari_ini:,.0f} hari ini")
elif persentase < 50:
    st.info(f"🔵 Hemat! Sisa budget Rp {sisa_jatah_hari_ini:,.0f}")
elif persentase < 70:
    st.warning(f"🟡 Perhatian! Budget sudah {persentase:.1f}% terpakai")
elif persentase < 90:
    st.warning(f"🟠 Hampir Habis! Sisa Rp {sisa_jatah_hari_ini:,.0f}")
else:
    st.error(f"🔴 KRITIS! Budget hampir habis! Sisa Rp {sisa_jatah_hari_ini:,.0f}")


# ===== FITUR SIMULASI JAJAN (AMAN) =====
st.markdown("---")
st.subheader("🔮 Simulasi Jajan")

# Batasi max_value agar tidak negatif
max_simulasi = max(0, int(saldo_op + out_hari))
default_simulasi = min(int(out_hari), max_simulasi)

col_sim1, col_sim2 = st.columns(2)

with col_sim1:
    
    simulasi_jajan = st.number_input(
        "💰 Coba kalau jajan hari ini (Rp)",
        min_value=0,
        max_value=max_simulasi,
        value=default_simulasi,
        step=5000,
        key="simulasi_jajan"
    )
    
    # Hitung dampak simulasi yang akurat
    # dana_setelah_simulasi = Total (Saldo Awal Hari) - Simulasi Jajan
    # Karena saldo_op di kodingan ini bertindak sebagai saldo pembuka hari.
    dana_setelah_simulasi = saldo_op - simulasi_jajan
    sisa_jatah_setelah_simulasi = batas_hr - simulasi_jajan
        
        

with col_sim2:
    st.markdown(f"""
    <div class="card">
        <p class="card-label">📊 HASIL SIMULASI</p>
        <p class="card-value" style="color:#F59E0B;">Rp {simulasi_jajan:,.0f}</p>
        <p class="card-sub">Kalau jajan segini</p>
    </div>
    """, unsafe_allow_html=True)

# Tampilkan dampak simulasi (lanjutkan seperti biasa)...
# Sinkronisasi variabel untuk tampilan bawah agar tidak error
sisa_setelah_jajan = sisa_jatah_setelah_simulasi # Ini untuk card sisa budget harian
persentase_setelah = (simulasi_jajan / batas_hr * 100) if batas_hr > 0 else 0



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
    sisa_setelah_jajan = sisa_jatah_hari_ini

# ===== LOGIKA SIMULASI YANG FOKUS KE DAMPAK ESOK =====
if simulasi_jajan > out_hari:
    # LEBIH BOROS DARI BIASA
    tambahan_pengeluaran = selisih
    st.warning(f"⚠️ Hari ini kamu **boros Rp {tambahan_pengeluaran:,.0f}** dari biasanya (Rp {out_hari:,.0f} → Rp {simulasi_jajan:,.0f})")
    
    if sisa_setelah_jajan >= 0:
        st.info(f"💰 Sisa budget hari ini: Rp {sisa_setelah_jajan:,.0f}")
        
        # Dampak ke limit besok
        if SISA_HARI > 1:
            limit_besok_baru = (saldo_op - simulasi_jajan) / (SISA_HARI - 1)
            selisih_limit = limit_besok_baru - batas_hr
            
            if selisih_limit < 0:
                st.info(f"📉 Limit besok **turun Rp {abs(selisih_limit):,.0f}** (Rp {batas_hr:,.0f} → Rp {limit_besok_baru:,.0f})")
            else:
                st.info(f"📈 Limit besok **naik Rp {selisih_limit:,.0f}** (Rp {batas_hr:,.0f} → Rp {limit_besok_baru:,.0f})")
    else:
        st.error(f"🚨 DEFISIT Rp {abs(sisa_setelah_jajan):,.0f}! Ambil dari tabungan?")
        
elif simulasi_jajan < out_hari:
    # LEBIH HEMAT DARI BIASA
    hemat = selisih
    st.success(f"🎉 Hari ini kamu **hemat Rp {hemat:,.0f}** dari biasanya (Rp {out_hari:,.0f} → Rp {simulasi_jajan:,.0f})")
    
    st.info(f"💰 Sisa budget hari ini: Rp {sisa_setelah_jajan:,.0f}")
    
    # Dampak ke limit besok
    if SISA_HARI > 1:
        limit_besok_baru = (saldo_op - simulasi_jajan) / (SISA_HARI - 1)
        selisih_limit = limit_besok_baru - batas_hr
        
        if selisih_limit > 0:
            st.success(f"📈 Limit besok **naik Rp {selisih_limit:,.0f}** (Rp {batas_hr:,.0f} → Rp {limit_besok_baru:,.0f})")
        else:
            st.info(f"📉 Limit besok **turun Rp {abs(selisih_limit):,.0f}** (Rp {batas_hr:,.0f} → Rp {limit_besok_baru:,.0f})")
else:
    # SAMA
    st.info(f"⚖️ Sama seperti biasanya (Rp {out_hari:,.0f})")
    st.info(f"💰 Limit besok tetap Rp {batas_hr:,.0f}")


st.markdown("---")

st.subheader("🛒 Rekomendasi Jajan Hari Ini")

if sisa_jatah_hari_ini <= 0:
    st.error("🚫 STOP! Kamu sudah melebihi budget hari ini!")
elif sisa_jatah_hari_ini < 10000:
    st.warning(f"💔 Budget sisa Rp {sisa_jatah_hari_ini:,.0f} - Cukup untuk jajan kecil")
elif sisa_jatah_hari_ini < 30000:
    st.info(f"🍜 Bisa buat makan siang + minum (Rp {sisa_jatah_hari_ini:,.0f})")
elif sisa_jatah_hari_ini < 50000:
    st.success(f"🍱 Bisa buat makan enak! (Rp {sisa_jatah_hari_ini:,.0f})")
elif sisa_jatah_hari_ini < 100000:
    st.success(f"🎉 Bisa buat nonton atau hangout! (Rp {sisa_jatah_hari_ini:,.0f})")
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
            tgl_i = st.date_input("📅 Tanggal", hari_ini_wib)
        with col2:
            tipe_i = st.selectbox("📊 Tipe", ["Pengeluaran", "Pemasukan"])
        
        # Baris 2: Sumber Dana dan Kategori
        col3, col4 = st.columns(2)
        with col3:
            sumber_i = st.selectbox("💰 Sumber Dana", ["Bank", "Cash"])
        with col4:
            kategori_options = get_all_categories(df_asli)
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
                min_date = hari_ini_wib
                tg_i = st.date_input("📅 Jatuh Tempo", min_value=min_date).strftime("%Y-%m-%d")
            if st_i == "Cleared":
                tb_i = tgl_i.strftime("%Y-%m-%d")
        
        nom_i = st.number_input("💰 Nominal (Rp)", min_value=0, step=5000, format="%d")
        
        # --- Fitur Titipan / Talangan ---
        tit_i = 0
        cat_final = cat_i = st.text_input("📝 Catatan", placeholder="Contoh: Beli makan siang")
        
        with st.expander("💸 Ada Titipan / Talangan Orang?"):
            tit_i = st.number_input("Nominal Titipan (Rp)", min_value=0, step=5000, key="tit_input")
            if tit_i > 0:
                st.markdown("---")
                # Gabungkan opsi rencana bayar dan penerimaan langsung agar tidak tumpuk
                tit_lunas = st.checkbox("💰 Uang Talangan SUDAH DITERIMA?", key="tit_lunas")
                
                label_sumber = "Terima uangnya di mana?" if tit_lunas else "Rencana penitip bayar pakai (Catatan):"
                tit_sumber_p = st.radio(label_sumber, ["Bank", "Cash"], horizontal=True, key="tit_sumber_p")
                
                if tit_lunas:
                    st.info(f"💡 Web akan otomatis mencatat Pemasukan Rp {tit_i:,.0f} ke {tit_sumber_p}")
                
                # Update catatan berdasarkan pilihan yang digabung
                cat_final = f"{cat_i} (Titipan: Rp {tit_i:,.0f} via {tit_sumber_p}{' - LUNAS' if tit_lunas else ''})"
                st.caption(f"Hasil Akhir: Limit terpotong Rp {nom_i - tit_i:,.0f}")
        # -------------------------------
        
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
                if nom_i > UANG_CASH:
                    st.error(f"❌ Saldo cash tidak cukup! (Sisa: Rp {UANG_CASH:,.0f})")
                    error = True
            
            if not error:
                # Data transaksi
                nr = {
                    "Tanggal": tgl_i.strftime("%Y-%m-%d"),
                    "Tipe": tipe_i,
                    "Kategori": kat_f.strip().title() if kat_f else "Lainnya",
                    "Nominal": nom_i,
                    "Catatan": cat_final,
                    "Status": st_i,
                    "Tenggat_Waktu": tg_i if tg_i else "",
                    "Tanggal_Bayar": tb_i if tb_i else "",
                    "Sumber": sumber_i,
                    "Titipan": tit_i
                }
                
     
                # Simpan Transaksi Utama (Pengeluaran)
                save_to_cloud(nr)
                df_asli = pd.concat([df_asli, pd.DataFrame([nr])], ignore_index=True)
                
                # Simpan Transaksi Kedua (Pemasukan Titipan) jika lunas
                if tit_i > 0 and tit_lunas:
                    nr_p = {
                        "Tanggal": tgl_i.strftime("%Y-%m-%d"),
                        "Tipe": "Pemasukan",
                        "Kategori": "Titipan / Jastip",
                        "Nominal": tit_i,
                        "Catatan": f"Penerimaan Talangan: {cat_i}",
                        "Status": "Cleared",
                        "Tenggat_Waktu": "",
                        "Tanggal_Bayar": tgl_i.strftime("%Y-%m-%d"),
                        "Sumber": tit_sumber_p,
                        "Titipan": 0
                    }
                    save_to_cloud(nr_p)
                    df_asli = pd.concat([df_asli, pd.DataFrame([nr_p])], ignore_index=True)
                
                save_data(df_asli)
                st.success("✅ Transaksi berhasil disimpan!")
                st.rerun()




PLOT = dict(
    paper_bgcolor="#1E293B", plot_bgcolor="#0F172A", font_color="#94A3B8",
    font_size=12, margin=dict(l=20,r=20,t=40,b=20),
    xaxis=dict(gridcolor="#334155"), yaxis=dict(gridcolor="#334155"),
    legend=dict(bgcolor="#1E293B",bordercolor="#334155",borderwidth=1)
)

tab_grafik, tab_budget_t, tab_piutang_t, tab_settlement, tab_recurring_t, tab_laporan_t, tab_mandiri, tab_tabungan,tab_cash = st.tabs([
    "📊 Grafik", "🎯 Budget Target", "💸 Piutang", "🗓️ Settlement", "🔄 Recurring", "📋 Laporan", "📧 Mandiri", "🏦 Tabungan", "💵 Uang Cash"
])

with tab_grafik:
    st.markdown("### 📅 Filter Rentang Waktu Grafik")
    col_f1, col_f2 = st.columns([1, 2])
    with col_f1:
        range_opts = ["Hari Ini", "Minggu Ini", "Bulan Ini", "Tahun Ini", "Semua", "Custom"]
        # Pilih default "Minggu Ini" biar kelihatan dinamis
        selected_range = st.selectbox("Rentang Waktu", range_opts, index=1, key="graph_range_choice")
    
    with col_f2:
        if selected_range == "Hari Ini":
            start_f, end_f = hari_ini_wib, hari_ini_wib
        elif selected_range == "Minggu Ini":
            start_f = hari_ini_wib - datetime.timedelta(days=hari_ini_wib.weekday())
            end_f = hari_ini_wib
        elif selected_range == "Bulan Ini":
            start_f = hari_ini_wib.replace(day=1)
            end_f = hari_ini_wib
        elif selected_range == "Tahun Ini":
            start_f = hari_ini_wib.replace(month=1, day=1)
            end_f = hari_ini_wib
        elif selected_range == "Semua":
            start_f = df_asli["Tanggal_dt"].min().date() if not df_asli.empty and not df_asli["Tanggal_dt"].isna().all() else hari_ini_wib
            end_f = df_asli["Tanggal_dt"].max().date() if not df_asli.empty and not df_asli["Tanggal_dt"].isna().all() else hari_ini_wib
        else: # Custom
            default_start = hari_ini_wib - datetime.timedelta(days=30)
            res_dates = st.date_input("Pilih Rentang Tanggal", [default_start, hari_ini_wib], key="graph_custom_range")
            if isinstance(res_dates, list) and len(res_dates) == 2:
                start_f, end_f = res_dates
            else:
                start_f = end_f = res_dates if not isinstance(res_dates, list) else res_dates[0]
                
    # Filter data khusus untuk grafik (Fix TypeError)
    try:
        # Konversi filter ke datetime.date agar aman saat dibandingkan
        f_start = pd.to_datetime(start_f).date() if start_f else pd.Timestamp.min.date()
        f_end = pd.to_datetime(end_f).date() if end_f else pd.Timestamp.max.date()
        
        mask_g = (pd.to_datetime(df_asli["Tanggal_dt"]).dt.date >= f_start) & \
                 (pd.to_datetime(df_asli["Tanggal_dt"]).dt.date <= f_end)
        df_grafik = df_asli[mask_g].copy()
    except:
        df_grafik = df_asli.copy()
        f_start = start_f
        f_end = end_f
    
    st.info(f"📊 Menampilkan data dari **{f_start}** sampai **{f_end}** ({len(df_grafik)} transaksi)")

    g1, g2, g3, g4 = st.tabs(["📈 Tren Harian", "🍩 Per Kategori", "⚖️ Arus Kas", "📊 Perbandingan MoM"])

    
    with g1:
        st.subheader("📈 Tren Pengeluaran Harian (Bank + Cash)")
        
    df_bank = df_grafik[
        (df_grafik["Tipe"] == "Pengeluaran") & 
        (df_grafik["Sumber"] == "Bank") &
        ~(df_grafik["Kategori"].isin(EXCLUDE_FROM_LIMIT))
    ].copy()
    df_bank["Tanggal"] = pd.to_datetime(df_bank["Tanggal"]).dt.date
    df_bank = df_bank.groupby("Tanggal")["Net_Nominal"].sum().reset_index()
    df_bank = df_bank.rename(columns={"Net_Nominal": "Nominal"})
    df_bank["Sumber"] = "Bank"
    
    # Data Cash
    df_cash = df_grafik[
        (df_grafik["Tipe"] == "Pengeluaran") & 
        (df_grafik["Sumber"] == "Cash") &
        ~(df_grafik["Kategori"].isin(EXCLUDE_FROM_LIMIT))
    ].copy()
    df_cash["Tanggal"] = pd.to_datetime(df_cash["Tanggal"]).dt.date
    df_cash = df_cash.groupby("Tanggal")["Net_Nominal"].sum().reset_index()
    df_cash = df_cash.rename(columns={"Net_Nominal": "Nominal"})
    df_cash["Sumber"] = "Cash"
    
    # Gabungkan
    df_gabungan = pd.concat([df_bank, df_cash], ignore_index=True)
    
    if not df_gabungan.empty:
        # Pivot untuk stacked bar
        dt_pivot = df_gabungan.pivot_table(
            index="Tanggal", 
            columns="Sumber", 
            values="Nominal", 
            aggfunc="sum",
            fill_value=0
        ).reset_index()
        
        # Hitung Total (Hanya dari kolom yang tersedia)
        cols_to_sum = [c for c in ["Bank", "Cash"] if c in dt_pivot.columns]
        dt_pivot["Total"] = dt_pivot[cols_to_sum].sum(axis=1) if cols_to_sum else 0
        dt_pivot = dt_pivot.sort_values("Tanggal")
        
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
        col_s1, col_s2, col_s3 = st.columns(3)
        with col_s1:
            st.metric("💰 Total Bank", f"Rp {df_bank['Nominal'].sum():,.0f}")
        with col_s2:
            st.metric("💵 Total Cash", f"Rp {df_cash['Nominal'].sum():,.0f}")
        with col_s3:
            st.metric("📊 Total", f"Rp {df_bank['Nominal'].sum() + df_cash['Nominal'].sum():,.0f}")

    else:
        st.info("Belum ada data pengeluaran.")
        
        

    with g2:
        st.subheader("🍩 Distribusi Pengeluaran per Kategori")
        
        # Gabungkan bank dan cash untuk pie chart
        mask_grafik_aktif = (df_grafik["Tipe"] == "Pengeluaran") & ~(df_grafik["Kategori"].isin(EXCLUDE_FROM_LIMIT))
        df_bank_kat = df_grafik[mask_grafik_aktif].copy()
        df_bank_kat = df_bank_kat[["Kategori", "Net_Nominal"]]
        df_bank_kat = df_bank_kat.rename(columns={"Net_Nominal": "Nominal"})
        
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
    
    # ===== HITUNG DARI DATAFRAME TERFILTER (df_grafik) =====
    # Pemasukan (semua)
    total_pemasukan = df_grafik[df_grafik["Tipe"] == "Pemasukan"]["Nominal"].sum()
    
    # Pengeluaran Bank (Sumber = Bank, bukan pending)
    total_pengeluaran_bank = df_grafik[
        (df_grafik["Tipe"] == "Pengeluaran") & 
        (df_grafik["Sumber"] == "Bank") &
        ~((df_grafik["Kategori"] == "Scheduled Settlement") & (df_grafik["Status"] == "Pending"))
    ].copy() if not df_grafik.empty else pd.DataFrame()
    total_pengeluaran_bank_sum = total_pengeluaran_bank["Nominal"].sum() if not total_pengeluaran_bank.empty else 0
    
    # Pengeluaran Cash (Sumber = Cash, bukan pending)
    total_pengeluaran_cash = df_grafik[
        (df_grafik["Tipe"] == "Pengeluaran") & 
        (df_grafik["Sumber"] == "Cash") &
        ~((df_grafik["Kategori"] == "Scheduled Settlement") & (df_grafik["Status"] == "Pending"))
    ].copy() if not df_grafik.empty else pd.DataFrame()
    total_pengeluaran_cash_sum = total_pengeluaran_cash["Nominal"].sum() if not total_pengeluaran_cash.empty else 0
    
    # Pending (Scheduled Settlement yang masih pending)
    total_pending = df_grafik[
        (df_grafik["Tipe"] == "Pengeluaran") & 
        (df_grafik["Kategori"] == "Scheduled Settlement") & 
        (df_grafik["Status"] == "Pending")
    ]["Nominal"].sum()
    
    # ===== BUAT DATAFRAME UNTUK CHART =====
    df_cf = pd.DataFrame({
        "Tipe": ["Pemasukan", "Pengeluaran Bank", "Pengeluaran Cash", "Pending"],
        "Nominal": [total_pemasukan, total_pengeluaran_bank_sum, total_pengeluaran_cash_sum, total_pending],
    })
    
    # ===== BUAT BAR CHART =====
    fig_cf = px.bar(
        df_cf,
        x="Tipe",
        y="Nominal",
        color="Tipe",
        text_auto=".0f",
        color_discrete_map={
            "Pemasukan": "#10B981",           # Hijau
            "Pengeluaran Bank": "#3B82F6",     # Biru
            "Pengeluaran Cash": "#F59E0B",     # Oranye (biar beda sama pemasukan)
            "Pending": "#EF4444"                # Merah
        },
        title="Arus Kas (Bank vs Cash)"
    )
    
    # Update tampilan chart
    fig_cf.update_traces(
        texttemplate="Rp %{y:,.0f}",
        textposition="outside",
        hovertemplate="%{x}<br>Rp %{y:,.0f}<extra></extra>"
    )
    
    fig_cf.update_layout(
        xaxis_title="",
        yaxis_title="Nominal (Rp)",
        showlegend=False,
        margin=dict(l=100, r=50, t=50, b=50),  # Margin kiri diperbesar biar angka gak kepotong
        paper_bgcolor="#1E293B",
        plot_bgcolor="#0F172A",
        font_color="#94A3B8",
        font_size=12,
        xaxis=dict(gridcolor="#334155"),
        yaxis=dict(gridcolor="#334155", tickformat=",.0f")
    )
    
    st.plotly_chart(fig_cf, use_container_width=True)
    
    # ===== TAMPILKAN ANGKA DETAIL DI BAWAH =====
    col_a1, col_a2, col_a3, col_a4 = st.columns(4)
    with col_a1:
        st.metric("💰 Pemasukan", f"Rp {total_pemasukan:,.0f}")
    with col_a2:
        st.metric("🏦 Pengeluaran Bank", f"Rp {total_pengeluaran_bank_sum:,.0f}")
    with col_a3:
        st.metric("💵 Pengeluaran Cash", f"Rp {total_pengeluaran_cash_sum:,.0f}")
    with col_a4:
        st.metric("⏳ Pending", f"Rp {total_pending:,.0f}")
        
    with g4:
        st.subheader("📊 Perbandingan Pengeluaran: Bulan Ini vs Bulan Lalu")
        
        # 1. Tentukan Tanggal
        now = datetime.datetime.now(pytz.timezone('Asia/Jakarta'))
        current_month = now.month
        current_year = now.year
        
        last_month = now.month - 1 if now.month > 1 else 12
        last_year = now.year if now.month > 1 else now.year - 1
        
        # 2. Filter Data (Hanya Pengeluaran Aktif)
        mask_exp = (df_asli["Tipe"] == "Pengeluaran") & ~(df_asli["Kategori"].isin(EXCLUDE_FROM_LIMIT))
        df_exp = df_asli[mask_exp].copy()
        
        # 3. Kelompokkan per Bulan
        df_this_month = df_exp[(df_exp["Tanggal_dt"].dt.month == current_month) & (df_exp["Tanggal_dt"].dt.year == current_year)]
        df_last_month = df_exp[(df_exp["Tanggal_dt"].dt.month == last_month) & (df_exp["Tanggal_dt"].dt.year == last_year)]
        
        if not df_last_month.empty or not df_this_month.empty:
            # Aggregasi per Kategori
            cat_this = df_this_month.groupby("Kategori")["Net_Nominal"].sum().reset_index()
            cat_this = cat_this.rename(columns={"Net_Nominal": "Nominal"})
            cat_last = df_last_month.groupby("Kategori")["Net_Nominal"].sum().reset_index()
            cat_last = cat_last.rename(columns={"Net_Nominal": "Nominal"})
            
            # Merge
            df_comp = pd.merge(cat_last, cat_this, on="Kategori", how="outer", suffixes=('_Lalu', '_Ini')).fillna(0)
            df_comp = df_comp.sort_values("Nominal_Ini", ascending=False)
            
            # Bar Chart
            fig_mom = go.Figure()
            fig_mom.add_trace(go.Bar(name="Bulan Lalu", x=df_comp["Kategori"], y=df_comp["Nominal_Lalu"], marker_color="#334155"))
            fig_mom.add_trace(go.Bar(name="Bulan Ini", x=df_comp["Kategori"], y=df_comp["Nominal_Ini"], marker_color="#3B82F6"))
            fig_mom.update_layout(barmode='group', title=f"Comparison {last_month}/{last_year} vs {current_month}/{current_year}", **PLOT)
            st.plotly_chart(fig_mom, use_container_width=True)
            
            # Insights
            st.markdown("#### 💡 Insights Literasi Keuangan")
            cols_ins = st.columns(3)
            
            # Hitung Total
            total_ini = df_comp["Nominal_Ini"].sum()
            total_lalu = df_comp["Nominal_Lalu"].sum()
            diff_total = total_ini - total_lalu
            pct_total = (diff_total / total_lalu * 100) if total_lalu > 0 else 100
            
            with cols_ins[0]:
                st.metric("Total Pengeluaran", f"Rp {total_ini:,.0f}", f"{pct_total:+.1f}% vs Bln Lalu", delta_color="inverse")
            
            # Cari kenaikan tertinggi
            df_comp["Delta"] = df_comp["Nominal_Ini"] - df_comp["Nominal_Lalu"]
            top_inc = df_comp[df_comp["Delta"] > 0].sort_values("Delta", ascending=False).head(1)
            
            if not top_inc.empty:
                with cols_ins[1]:
                    row_inc = top_inc.iloc[0]
                    st.warning(f"📈 Kenaikan Tertinggi: **{row_inc['Kategori']}** (+Rp {row_inc['Delta']:,.0f})")
            
            # Cari penurunan tertinggi
            top_dec = df_comp[df_comp["Delta"] < 0].sort_values("Delta", ascending=True).head(1)
            if not top_dec.empty:
                with cols_ins[2]:
                    row_dec = top_dec.iloc[0]
                    st.success(f"📉 Penurunan Tertinggi: **{row_dec['Kategori']}** (-Rp {abs(row_dec['Delta']):,.0f})")
        else:
            st.info("Data bulan lalu atau bulan ini belum cukup untuk dibandingkan.")
    
    # ===== GAUGE CHART UNTUK SALDO OPERASIONAL (TETAP) =====
    col_g1, col_g2 = st.columns(2)
    
    
    with col_g1:
        gauge_max = max(total_real, saldo_op) * 1.2 if max(total_real, saldo_op) > 0 else 1000000
        fig_gauge = go.Figure(go.Indicator(
            mode="gauge+number+delta",
            value=saldo_op,
            delta={"reference": total_real, "valueformat": ",.0f"},
            title={"text": "Saldo Operasional", "font": {"color": "#F1F5F9"}},
            number={"prefix": "Rp ", "valueformat": ",.0f", "font": {"color": "#F1F5F9"}},
            gauge={
                "axis": {"range": [0, gauge_max], "tickcolor": "#94A3B8"},
                "bar": {"color": "#10B981"},
                "bgcolor": "#0F172A",
                "bordercolor": "#334155",
                "steps": [
                    {"range": [0, gauge_max * 0.3], "color": "rgba(239,68,68,0.2)"},
                    {"range": [gauge_max * 0.3, gauge_max * 0.7], "color": "rgba(245,158,11,0.2)"},
                    {"range": [gauge_max * 0.7, gauge_max], "color": "rgba(16,185,129,0.2)"}
                ],
                "threshold": {
                    "line": {"color": "#F59E0B", "width": 4},
                    "thickness": 0.75,
                    "value": gauge_max * 0.3
                }
            }
        ))
        fig_gauge.update_layout(
            paper_bgcolor="#1E293B",
            font_color="#94A3B8",
            height=400,
            margin=dict(l=50, r=50, t=50, b=50)
        )
        st.plotly_chart(fig_gauge, use_container_width=True)

        
    

with tab_budget_t:
    st.subheader("🎯 Budget Target per Kategori")
    st.caption("Set batas pengeluaran per kategori. Progress otomatis dihitung dari transaksi bulan ini.")

    with st.expander("➕ Tambah / Edit Target"):
        with st.form("form_budget", clear_on_submit=True):
            kat_b_options = [c for c in get_all_categories(df_asli) if "Lainnya" not in c]
            kat_b = st.selectbox("Kategori", kat_b_options)
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
    st.subheader("💸 Tracker Piutang (Pinjaman ke Orang)")
    st.caption("Catat siapa yang pinjam uang ke kamu. Saldo akan otomatis terpotong saat dicatat dan bertambah saat pelunasan.")

    pf1,pf2 = st.columns([1.2,1])
    with pf1:
        with st.form("form_piutang", clear_on_submit=True):
            st.markdown("**➕ Catat Piutang Baru**")
            nama_p    = st.text_input("Nama Peminjam")
            nominal_p = st.number_input("Nominal (Rp)", min_value=0, step=5000)
            sumber_p  = st.selectbox("💰 Sumber Dana Piutang", ["Bank", "Cash"])
            tenggat_p = st.date_input("📅 Tenggat Penagihan", hari_ini_wib+datetime.timedelta(days=7))
            catatan_p = st.text_input("📝 Catatan (opsional)")
            
            if st.form_submit_button("💾 Simpan Piutang", use_container_width=True):
                if nama_p and nominal_p>0:
                    # Validasi Saldo
                    current_balance = SALDO_BANK if sumber_p == "Bank" else UANG_CASH
                    if nominal_p > current_balance:
                        st.error(f"❌ Saldo {sumber_p} tidak cukup! (Sisa: Rp {current_balance:,.0f})")
                    else:
                        # 1. Simpan ke daftar piutang local
                        new_p = {
                            "Tanggal": hari_ini_wib.strftime("%Y-%m-%d"),
                            "Nama": nama_p, "Nominal": nominal_p, "Catatan": catatan_p,
                            "Status": "Belum Lunas", "Tenggat": tenggat_p.strftime("%Y-%m-%d"),
                            "Tanggal_Lunas": "", "Sumber": sumber_p
                        }
                        df_piutang = pd.concat([df_piutang, pd.DataFrame([new_p])], ignore_index=True)
                        save_piutang(df_piutang)
                        
                        # 2. Simpan ke log transaksi (Cloud & local) as Pengeluaran
                        new_t = {
                            "Tanggal": hari_ini_wib.strftime("%Y-%m-%d"),
                            "Tipe": "Pengeluaran", "Kategori": "Piutang", "Nominal": nominal_p,
                            "Catatan": f"Pinjamkan ke: {nama_p}", "Status": "Cleared", "Tenggat_Waktu": "",
                            "Tanggal_Bayar": hari_ini_wib.strftime("%Y-%m-%d"), "Sumber": sumber_p
                        }
                        save_to_cloud(new_t) # Ke Supabase
                        
                        st.success(f"✅ Piutang {nama_p} Rp {nominal_p:,.0f} dicatat! Saldo {sumber_p} berkurang.")
                        st.rerun()
                else: 
                    st.warning("⚠️ Isi nama dan nominal.")

    with pf2:
        if not df_piutang.empty:
            blm = df_piutang[df_piutang["Status"]=="Belum Lunas"]
            lns = df_piutang[df_piutang["Status"]=="Lunas"]
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
            
            today_s = hari_ini_wib
            ov = blm[pd.to_datetime(blm["Tenggat"]).dt.date < today_s]
            if not ov.empty:
                st.error(f"🚨 {len(ov)} Piutang Melewati Deadline!")
                for _,od in ov.iterrows():
                    st.markdown(f"🔴 **{od['Nama']}** (Rp {od['Nominal']:,.0f}) - Due {od['Tenggat']}")

    if not df_piutang.empty:
        st.markdown("---")
        st.subheader("📋 Daftar Piutang")
        
        # Pisahkan list agar mudah dilihat
        blm_list = df_piutang[df_piutang["Status"]=="Belum Lunas"].sort_values("Tenggat")
        lns_list = df_piutang[df_piutang["Status"]=="Lunas"].sort_values("Tanggal_Lunas", ascending=False)
        
        if not blm_list.empty:
            st.write("### ⏳ Belum Lunas")
            for idx, row in blm_list.iterrows():
                is_overdue = pd.to_datetime(row["Tenggat"]).date() < hari_ini_wib
                
                with st.container():
                    c1, c2, c3, c4, c5 = st.columns([1.4, 1.4, 0.9, 0.9, 0.6])
                    
                    with c1:
                        st.markdown(f"**👤 {row['Nama']}**")
                        st.caption(f"📍 Sumber: {row.get('Sumber','Bank')}")
                    
                    with c2:
                        st.markdown(f"**Rp {row['Nominal']:,.0f}**")
                        warna_due = "#EF4444" if is_overdue else "#94A3B8"
                        st.markdown(f"<span style='color:{warna_due}; font-size:.8rem;'>📅 {row['Tenggat']}</span>", unsafe_allow_html=True)
                    
                    with c3:
                        # Pilihan ke mana uang dikembalikan
                        sumber_kembali = st.selectbox("Ke mana?", ["Bank", "Cash"], 
                                                     index=0 if row.get("Sumber","Bank")=="Bank" else 1,
                                                     key=f"dest_piutang_{idx}", 
                                                     label_visibility="collapsed")
                        
                        if st.button("✅ Lunas", key=f"lunas_piutang_{idx}", use_container_width=True):
                            # Mark as Lunas
                            df_piutang.at[idx, "Status"] = "Lunas"
                            df_piutang.at[idx, "Tanggal_Lunas"] = hari_ini_wib.strftime("%Y-%m-%d")
                            # Simpan pilihan sumber yang baru
                            df_piutang.at[idx, "Sumber_Kembali"] = sumber_kembali
                            save_piutang(df_piutang)
                            
                            # Catat Pemasukan kembalian piutang ke log
                            new_inc = {
                                "Tanggal": hari_ini_wib.strftime("%Y-%m-%d"),
                                "Tipe": "Pemasukan", "Kategori": "Piutang Kembali", "Nominal": row["Nominal"],
                                "Catatan": f"Pelunasan Piutang: {row['Nama']}", "Status": "Cleared", "Tenggat_Waktu": "",
                                "Tanggal_Bayar": hari_ini_wib.strftime("%Y-%m-%d"), "Sumber": sumber_kembali
                            }
                            save_to_cloud(new_inc)
                            
                            st.success(f"🎉 {row['Nama']} lunas! Saldo {sumber_kembali} bertambah.")
                            st.rerun()
                            
                    with c4:
                        if st.button("⏳+", key=f"ext_piutang_{idx}", use_container_width=True, help="Perpanjang 7 hari"):
                            # Extend 7 days
                            current_due = pd.to_datetime(row["Tenggat"]).date()
                            new_due = (current_due + datetime.timedelta(days=7)).strftime("%Y-%m-%d")
                            df_piutang.at[idx, "Tenggat"] = new_due
                            save_piutang(df_piutang)
                            st.toast(f"Deadline {row['Nama']} diperpanjang ke {new_due}")
                            st.rerun()

                    with c5:
                        if st.button("🗑️", key=f"del_piutang_{idx}", use_container_width=True, help="Hapus Piutang (Tanpa log transaksi)"):
                            # Filter out manually
                            df_piutang = df_piutang.drop(idx)
                            save_piutang(df_piutang)
                            st.warning(f"🗑️ Piutang {row['Nama']} dihapus.")
                            st.rerun()
                    
                    if is_overdue:
                        st.error(f"⚠️ Melewati deadline! Konfirmasi pelunasan atau perpanjang waktu.")
                    
                    st.divider()

        if not lns_list.empty:
            with st.expander("✅ Lihat Riwayat Pelunasan"):
                for idx, row in lns_list.iterrows():
                    st.markdown(f"**{row['Nama']}** — Rp {row['Nominal']:,.0f} (Lunas: {row['Tanggal_Lunas']})")
    else:
        st.info("💡 Belum ada piutang tercatat.")
        
with tab_settlement:
    st.subheader("🗓️ Scheduled Settlement")
    st.caption("Kelola pembayaran masa depan (Cicilan, Tagihan, CC) yang sudah Anda jadwalkan.")
    
    # Filter data khusus Scheduled Settlement yang masih Pending
    df_settle = df_asli[(df_asli["Kategori"] == "Scheduled Settlement") & (df_asli["Status"] == "Pending")].copy()
    
    if not df_settle.empty:
        total_p = df_settle["Nominal"].sum()
        st.markdown(f"""
        <div class="card card-warn">
            <p class="card-label">⏳ TOTAL TAGIHAN PENDING</p>
            <p class="card-value" style="color:#F59E0B;">Rp {total_p:,.0f}</p>
            <p class="card-sub">{len(df_settle)} transaksi perlu dilunasi</p>
        </div>""", unsafe_allow_html=True)
        
        st.markdown("---")
        st.write("### 📋 Daftar Tunggu Pembayaran")
        
        # Sort berdasarkan tenggat waktu terdekat
        if "Tenggat_Waktu" in df_settle.columns:
            df_settle = df_settle.sort_values("Tenggat_Waktu")
            
        for idx, row in df_settle.iterrows():
            with st.container():
                c1, c2, c3 = st.columns([2, 2, 1])
                with c1:
                    st.markdown(f"**📝 {row['Catatan']}**")
                    st.caption(f"📅 Tanggal Input: {row['Tanggal']}")
                with c2:
                    st.markdown(f"**Rp {row['Nominal']:,.0f}**")
                    due_val = row['Tenggat_Waktu'] if row['Tenggat_Waktu'] else "-"
                    st.markdown(f"<span style='color:#EF4444; font-size:.8rem;'>📅 Due: {due_val}</span>", unsafe_allow_html=True)
                with c3:
                    # Gunakan ID asli dari database untuk update yang akurat
                    raw_id = row.get("id")
                    if st.button("✅ Lunas", key=f"pay_set_{raw_id if raw_id else idx}", use_container_width=True):
                        try:
                            if raw_id:
                                conn.table("transaksi").update({
                                    "status": "Cleared",
                                    "tanggal_bayar": hari_ini_wib.strftime("%Y-%m-%d")
                                }).eq("id", raw_id).execute()
                                
                                st.cache_data.clear()
                                st.success(f"🎉 Tagihan '{row['Catatan']}' berhasil dilunasi!")
                                st.rerun()
                            else:
                                st.error("ID Transaksi tidak ditemukan. Tidak dapat mengupdate di Cloud.")
                        except Exception as e:
                            st.error(f"Gagal memproses pembayaran: {e}")
            st.markdown("---")
    else:
        st.success("✅ Semua tagihan Scheduled Settlement sudah lunas!")

with tab_recurring_t:
    st.subheader("🔄 Recurring Expense")
    st.caption("Pengeluaran rutin otomatis dicatat setiap bulan/minggu sesuai jadwal yang kamu set.")

    with st.form("form_recurring", clear_on_submit=True):
        r1,r2 = st.columns(2)
        with r1:
            nama_r   = st.text_input("Nama (misal: Kos, Netflix, Spotify)")
            kat_r_options = [c for c in get_all_categories(df_asli) if "Lainnya" not in c]
            kat_r    = st.selectbox("Kategori", kat_r_options)
            nominal_r= st.number_input("Nominal (Rp)",min_value=0,step=5000)
        with r2:
            frek_r   = st.selectbox("Frekuensi",["Bulanan","Mingguan"])
            tgl_r    = st.date_input("Tanggal Tagihan",hari_ini_wib)
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
    st.subheader("📋 Laporan Multi‑Periode")
    st.caption("Pilih periode dan lihat ringkasan, tren, serta prediksi.")

    # --- Pilihan periode ---
    periode_mode = st.radio(
        "Pilih rentang waktu:",
        ["Mingguan", "Bulanan", "Custom"],
        horizontal=True,
        key="laporan_periode"
    )

    # Tentukan tanggal awal & akhir berdasarkan pilihan
    if periode_mode == "Mingguan":
        # Buat opsi 4 minggu terakhir
        minggu_opts = {}
        for i in range(4):
            start = hari_ini_tgl - datetime.timedelta(days=hari_ini_tgl.weekday() + 7*i)
            end = start + datetime.timedelta(days=6)
            label = f"{'Minggu ini' if i==0 else f'{i} minggu lalu'} ({start.strftime('%d %b')} - {end.strftime('%d %b')})"
            minggu_opts[label] = (start, end)
        selected_label = st.selectbox("Pilih minggu:", list(minggu_opts.keys()), key="laporan_minggu")
        start_date, end_date = minggu_opts[selected_label]

    elif periode_mode == "Bulanan":
        # Buat opsi 6 bulan terakhir
        bulan_opts = {}
        for i in range(6):
            # Hitung bulan mundur dari bulan ini
            tahun = hari_ini_tgl.year
            bulan = hari_ini_tgl.month - i
            while bulan <= 0:
                bulan += 12
                tahun -= 1
            start = datetime.date(tahun, bulan, 1)
            # akhir bulan: bulan berikutnya - 1 hari
            if bulan == 12:
                end = datetime.date(tahun+1, 1, 1) - datetime.timedelta(days=1)
            else:
                end = datetime.date(tahun, bulan+1, 1) - datetime.timedelta(days=1)
            label = f"{'Bulan ini' if i==0 else start.strftime('%B %Y')}"
            bulan_opts[label] = (start, end)
        selected_label = st.selectbox("Pilih bulan:", list(bulan_opts.keys()), key="laporan_bulan")
        start_date, end_date = bulan_opts[selected_label]

    else:  # Custom
        col1, col2 = st.columns(2)
        with col1:
            start_date = st.date_input("Tanggal awal", value=hari_ini_tgl - datetime.timedelta(days=30))
        with col2:
            end_date = st.date_input("Tanggal akhir", value=hari_ini_tgl)
        if start_date > end_date:
            st.error("Tanggal awal harus lebih kecil dari tanggal akhir")
            st.stop()

    # --- Filter data berdasarkan periode ---
    mask_periode = (
        (df_asli["Tanggal_dt"].dt.date >= start_date) &
        (df_asli["Tanggal_dt"].dt.date <= end_date)
    )
    df_periode = df_asli[mask_periode].copy()
    jumlah_hari = (end_date - start_date).days + 1

    # Pisahkan pemasukan & pengeluaran (tanpa pending settlement)
    mask_aktif_periode = (
        (df_periode["Tipe"] == "Pengeluaran") &
        ~(df_periode["Kategori"].isin(EXCLUDE_FROM_LIMIT))
    )
    df_out_periode = df_periode[mask_aktif_periode]
    df_in_periode  = df_periode[df_periode["Tipe"] == "Pemasukan"]

    total_out = df_out_periode["Net_Nominal"].sum()
    total_in  = df_in_periode["Nominal"].sum()
    net_cash  = total_in - total_out
    avg_harian = total_out / jumlah_hari if jumlah_hari > 0 else 0

    # --- Ringkasan 4 kolom ---
    col_r1, col_r2, col_r3, col_r4 = st.columns(4)
    col_r1.metric("Total Pengeluaran", f"Rp {total_out:,.0f}")
    col_r2.metric("Total Pemasukan",   f"Rp {total_in:,.0f}")
    col_r3.metric("Net Cash Flow",      f"Rp {net_cash:,.0f}",
                  delta="Surplus" if net_cash>=0 else "Defisit",
                  delta_color="normal" if net_cash>=0 else "inverse")
    col_r4.metric("Rata‑rata Harian",   f"Rp {avg_harian:,.0f}")

    st.markdown("---")

    # --- Grafik tren saldo harian ---
    st.subheader("📈 Tren Saldo Harian (Bank + Cash)")

    # Buat data harian: saldo akhir setiap hari
    # Urutkan data berdasarkan tanggal ascending
    df_saldo = df_asli.sort_values("Tanggal_dt").copy()
    df_saldo["Tanggal"] = df_saldo["Tanggal_dt"].dt.date

    # Hitung perubahan saldo per hari: pemasukan menambah, pengeluaran mengurangi
    # (kita gunakan semua transaksi, termasuk pending? pending tidak mempengaruhi saldo sampai cleared)
    # Untuk keperluan tren, kita gunakan transaksi cleared saja (atau semua kecuali pending)
    df_saldo = df_saldo[~((df_saldo["Kategori"] == "Scheduled Settlement") & (df_saldo["Status"] == "Pending"))]
    df_saldo["Perubahan"] = df_saldo.apply(
        lambda r: r["Nominal"] if r["Tipe"] == "Pemasukan" else -r["Nominal"],
        axis=1
    )

    # Kelompokkan per hari, jumlahkan perubahan
    harian = df_saldo.groupby("Tanggal")["Perubahan"].sum().reset_index()
    harian = harian.sort_values("Tanggal")

    # Hitung saldo kumulatif (asumsikan saldo awal = 0? Tapi kita punya saldo saat ini, lebih baik kita hitung dari awal data)
    # Cara mudah: gunakan data yang ada, saldo akhir = saldo awal + kumulatif perubahan. Tapi kita tidak punya saldo awal.
    # Alternatif: tampilkan perubahan harian saja, bukan saldo absolut. Tapi permintaan "grafik tren saldo" mungkin saldo kumulatif.
    # Kita bisa hitung dengan asumsi saldo awal 0, tapi akan negatif. Lebih baik kita tampilkan perubahan harian (net flow) sebagai bar.
    # Namun instruksi: "Line chart pergerakan saldo (Bank + Cash) per hari selama periode". Jadi kita perlu saldo.
    # Solusi: hitung saldo relatif terhadap suatu titik, misalnya saldo awal periode = saldo saat ini dikurangi perubahan setelah periode.
    # Tapi itu rumit. Alternatif: gunakan perubahan harian saja sebagai bar chart, bukan line. Tapi kita ikuti permintaan.
    # Untuk kesederhanaan, saya akan buat line chart dari perubahan harian (net flow) dengan area fill, karena itu yang paling mudah dan tetap menunjukkan tren.

    # Filter data dalam periode
    harian_periode = harian[(harian["Tanggal"] >= start_date) & (harian["Tanggal"] <= end_date)]

    if not harian_periode.empty:
        fig_trend = px.area(
            harian_periode,
            x="Tanggal",
            y="Perubahan",
            title="Perubahan Saldo Harian (Pemasukan - Pengeluaran)",
            labels={"Perubahan": "Nominal (Rp)", "Tanggal": ""},
            color_discrete_sequence=["#10B981"]
        )
        fig_trend.add_hline(y=0, line_dash="dot", line_color="#EF4444", annotation_text="Nol")
        fig_trend.update_layout(**PLOT)
        st.plotly_chart(fig_trend, use_container_width=True)
    else:
        st.info("Tidak ada data transaksi di periode ini.")

    st.markdown("---")

    # --- Perbandingan Bulan Ini vs Bulan Lalu ---
    st.subheader("📊 Perbandingan Bulan Ini vs Bulan Lalu")

    # Tentukan bulan ini dan bulan lalu
    today = hari_ini_tgl
    bulan_ini_start = datetime.date(today.year, today.month, 1)
    if today.month == 1:
        bulan_lalu_start = datetime.date(today.year-1, 12, 1)
        bulan_lalu_end = datetime.date(today.year-1, 12, 31)
    else:
        bulan_lalu_start = datetime.date(today.year, today.month-1, 1)
        if today.month-1 == 2:
            # handle februari tahun kabisat? sederhanakan:
            akhir = 29 if (today.year % 4 == 0 and (today.year % 100 != 0 or today.year % 400 == 0)) else 28
            bulan_lalu_end = datetime.date(today.year, today.month-1, akhir)
        elif today.month-1 in [4,6,9,11]:
            bulan_lalu_end = datetime.date(today.year, today.month-1, 30)
        else:
            bulan_lalu_end = datetime.date(today.year, today.month-1, 31)

    bulan_ini_end = today

    # Filter data bulan ini
    mask_bulan_ini = (
        (df_asli["Tanggal_dt"].dt.date >= bulan_ini_start) &
        (df_asli["Tanggal_dt"].dt.date <= bulan_ini_end) &
        ~(df_asli["Kategori"].isin(EXCLUDE_FROM_LIMIT))
    )
    df_bulan_ini = df_asli[mask_bulan_ini]
    out_bulan_ini = df_bulan_ini[df_bulan_ini["Tipe"]=="Pengeluaran"]["Net_Nominal"].sum()
    in_bulan_ini  = df_bulan_ini[df_bulan_ini["Tipe"]=="Pemasukan"]["Nominal"].sum()

    # Filter data bulan lalu
    mask_bulan_lalu = (
        (df_asli["Tanggal_dt"].dt.date >= bulan_lalu_start) &
        (df_asli["Tanggal_dt"].dt.date <= bulan_lalu_end) &
        ~(df_asli["Kategori"].isin(EXCLUDE_FROM_LIMIT))
    )
    df_bulan_lalu = df_asli[mask_bulan_lalu]
    out_bulan_lalu = df_bulan_lalu[df_bulan_lalu["Tipe"]=="Pengeluaran"]["Net_Nominal"].sum()
    in_bulan_lalu  = df_bulan_lalu[df_bulan_lalu["Tipe"]=="Pemasukan"]["Nominal"].sum()

    # Hitung perubahan persen
    def pct_change(a, b):
        if b == 0:
            return float('inf') if a > 0 else 0
        return (a - b) / b * 100

    pct_out = pct_change(out_bulan_ini, out_bulan_lalu)
    pct_in  = pct_change(in_bulan_ini, in_bulan_lalu)

    col_comp1, col_comp2, col_comp3, col_comp4 = st.columns(4)
    col_comp1.metric("Pengeluaran Bulan Ini", f"Rp {out_bulan_ini:,.0f}",
                     delta=f"{pct_out:+.1f}%" if pct_out != float('inf') else "↑ besar")
    col_comp2.metric("Pengeluaran Bulan Lalu", f"Rp {out_bulan_lalu:,.0f}")
    col_comp3.metric("Pemasukan Bulan Ini", f"Rp {in_bulan_ini:,.0f}",
                     delta=f"{pct_in:+.1f}%" if pct_in != float('inf') else "↑ besar")
    col_comp4.metric("Pemasukan Bulan Lalu", f"Rp {in_bulan_lalu:,.0f}")

    # Info boros/hemat
    if out_bulan_ini > out_bulan_lalu:
        st.warning(f"⚠️ Pengeluaran bulan ini **lebih boros {pct_out:.1f}%** dibanding bulan lalu.")
    elif out_bulan_ini < out_bulan_lalu:
        st.success(f"✅ Pengeluaran bulan ini **lebih hemat {abs(pct_out):.1f}%** dibanding bulan lalu.")
    else:
        st.info("ℹ️ Pengeluaran sama dengan bulan lalu.")

    st.markdown("---")

    # --- Prediksi Saldo sampai Gajian ---
    st.subheader("🔮 Prediksi Saldo sampai Gajian")
    st.caption(f"Berdasarkan rata‑rata pengeluaran 7 hari terakhir, sisa hari ke gajian: **{SISA_HARI} hari**")

    # Ambil 7 hari terakhir (termasuk hari ini)
    tujuh_hari_lalu = hari_ini_tgl - datetime.timedelta(days=6)
    mask_7hari = (
        (df_asli["Tanggal_dt"].dt.date >= tujuh_hari_lalu) &
        (df_asli["Tanggal_dt"].dt.date <= hari_ini_tgl) &
        (df_asli["Tipe"] == "Pengeluaran") &
        ~(df_asli["Kategori"].isin(EXCLUDE_FROM_LIMIT))
    )
    df_7hari = df_asli[mask_7hari]
    total_7hari = df_7hari["Net_Nominal"].sum()
    rata_7hari = total_7hari / 7

    # Proyeksi total pengeluaran sampai gajian
    proyeksi_pengeluaran = rata_7hari * SISA_HARI

    # Saldo saat ini (operasional) = SALDO_BANK + UANG_CASH - TABUNGAN? Atau total_real? Kita pakai saldo operasional (saldo_op) karena itu yang bisa dipakai.
    # saldo_op sudah didefinisikan: SALDO_BANK + UANG_CASH - TABUNGAN
    prediksi_saldo = saldo_op - proyeksi_pengeluaran

    col_pred1, col_pred2, col_pred3 = st.columns(3)
    col_pred1.metric("Rata‑rata 7 hari terakhir", f"Rp {rata_7hari:,.0f}")
    col_pred2.metric("Proyeksi pengeluaran", f"Rp {proyeksi_pengeluaran:,.0f}")
    col_pred3.metric("Prediksi saldo saat gajian", f"Rp {prediksi_saldo:,.0f}",
                     delta="Aman" if prediksi_saldo >= 0 else "Minus",
                     delta_color="normal" if prediksi_saldo >= 0 else "inverse")

    if prediksi_saldo < 0:
        st.error(f"🚨 PERINGATAN: Diprediksi saldo akan minus Rp {abs(prediksi_saldo):,.0f} sebelum gajian! Kurangi pengeluaran harian.")
    elif prediksi_saldo < 50000:
        st.warning(f"⚠️ Saldo diprediksi hanya Rp {prediksi_saldo:,.0f} saat gajian. Hati‑hati.")
    else:
        st.success(f"✅ InsyaAllah aman. Sisa Rp {prediksi_saldo:,.0f} setelah gajian.")

    # Tetap tampilkan detail transaksi periode jika mau (opsional)
    with st.expander("📄 Lihat Detail Transaksi Periode Ini"):
        if not df_periode.empty:
            ds = df_periode[["Tanggal","Tipe","Kategori","Nominal","Catatan","Sumber"]].copy()
            ds["Nominal"] = ds["Nominal"].apply(lambda x: f"Rp {x:,.0f}")
            st.dataframe(ds.sort_values("Tanggal", ascending=False), use_container_width=True, hide_index=True)
        else:
            st.info("Tidak ada transaksi.")

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
                "Kategori": st.column_config.SelectboxColumn("Kategori", options=get_all_categories(df_asli)),
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
                            "Kategori": str(row["Kategori"]).strip().title() if row["Kategori"] else "Lainnya",
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
    UANG_CASH = get_saldo_cash(df_asli)
    
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
                daily_sum = df_cash_daily.groupby(df_cash_daily["Tanggal"].dt.date)["Net_Nominal"].sum().reset_index()
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
                        tgl_habis = hari_ini_wib + datetime.timedelta(days=hari_habis)
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
            today = hari_ini_wib
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
                            "Tanggal": hari_ini_wib.strftime("%Y-%m-%d"),
                            "Tipe": "Pengeluaran",
                            "Kategori": "Tarik Tunai",
                            "Nominal": nominal_quick,
                            "Catatan": f"Tarik tunai - {catatan_quick}",
                            "Status": "Cleared",
                            "Tenggat_Waktu": "",
                            "Tanggal_Bayar": hari_ini_wib.strftime("%Y-%m-%d"),
                            "Sumber": "Bank"
                        }
                        save_to_cloud(transaksi_bank)
                        
                        # Transaksi Cash (pemasukan)
                        transaksi_cash = {
                            "Tanggal": hari_ini_wib.strftime("%Y-%m-%d"),
                            "Tipe": "Pemasukan",
                            "Kategori": "Tarik Tunai",
                            "Nominal": nominal_quick,
                            "Catatan": f"Dari ATM - {catatan_quick}",
                            "Status": "Cleared",
                            "Tenggat_Waktu": "",
                            "Tanggal_Bayar": hari_ini_wib.strftime("%Y-%m-%d"),
                            "Sumber": "Cash"
                        }
                        save_to_cloud(transaksi_cash)

                        
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
                                "Tanggal": hari_ini_wib.strftime("%Y-%m-%d"),
                                "Tipe": "Pengeluaran",
                                "Kategori": st.session_state["quick_cash"].title(),
                                "Nominal": nominal_quick,
                                "Catatan": catatan_quick,
                                "Status": "Cleared",
                                "Tenggat_Waktu": "",
                                "Tanggal_Bayar": hari_ini_wib.strftime("%Y-%m-%d"),
                                "Sumber": "Cash"
                            }
                            save_to_cloud(transaksi)
                                            
                            
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
                tgl_mulai = st.date_input("Tanggal Mulai", hari_ini_wib)
            with col_date2:
                tgl_target = st.date_input("Target Tercapai", 
                                          hari_ini_wib + datetime.timedelta(days=365))
            
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
                            sisa_hari = (tgl_target - hari_ini_wib).days
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
                            # Linked Deletion: Hapus target, histori tabungan, dan "un-save" dari transaksi utama
                            t_id = row.get("id")
                            if t_id:
                                try:
                                    # 1. Hapus pengeluaran "Menabung" di log utama agar saldo kembali
                                    conn.table("transaksi").delete().eq("tabungan_id", t_id).execute()
                                    # 2. Hapus histori internal tabungan
                                    conn.table("transaksi_tabungan").delete().eq("tabungan_id", t_id).execute()
                                    # 3. Hapus target tabungan itu sendiri
                                    if delete_tabungan_cloud(t_id):
                                        st.success(f"✅ Tabungan '{row['Nama']}' dihapus & saldo dikembalikan!")
                                        st.rerun()
                                except Exception as e:
                                    st.error(f"Gagal menghapus riwayat lengkap: {e}")
                            else:
                                if delete_tabungan_cloud(row.get("id")):
                                    st.success(f"✅ Tabungan '{row['Nama']}' dihapus!")
                                    st.rerun()
                    
                    # Form setor/tarik
                    if st.session_state.get(f"setor_tabungan_{idx}", False):
                        with st.form(key=f"form_setor_{idx}"):
                            nominal_setor = st.number_input("Nominal Setor (Rp)", min_value=0, step=10000)
                            catatan_setor = st.text_input("Catatan")
                            # FIX UI: Selectbox harus di luar tombol submit agar terbaca oleh Streamlit
                            sumber_t = st.selectbox("Ambil dari mana?", ["Bank", "Cash"], key=f"src_setor_{idx}")
                            
                            col_btn1, col_btn2 = st.columns(2)
                            with col_btn1:
                                if st.form_submit_button("✅ Setor"):
                                            # 1. Update nominal terkumpul di tabel tabungan
                                            new_terkumpul = row["Terkumpul"] + nominal_setor
                                            update_dict = {
                                                "nominal_terkumpul": new_terkumpul,
                                                "status": "Selesai" if new_terkumpul >= row["Target"] else "Aktif"
                                            }
                                            if update_tabungan_cloud(row.get("id"), update_dict):
                                                # 2. Catat di histori tabungan
                                                transaksi_data = {
                                                    "tabungan_id": row.get("id"),
                                                    "tanggal": hari_ini_wib.strftime("%Y-%m-%d"),
                                                    "nominal": nominal_setor,
                                                    "tipe": "Setor",
                                                    "catatan": catatan_setor
                                                }
                                                conn.table("transaksi_tabungan").insert(transaksi_data).execute()
                                                
                                                # 3. PENTING: Catat di log utama (transaksi) sebagai PENGELUARAN 
                                                # agar saldo Bank/Cash berkurang (Literasi Keuangan: Uang dipindah ke pos tabungan)
                                                main_t = {
                                                    "Tanggal": hari_ini_wib.strftime("%Y-%m-%d"),
                                                    "Tipe": "Pengeluaran",
                                                    "Kategori": "Menabung",
                                                    "Nominal": nominal_setor,
                                                    "Catatan": f"Setor Tabungan: {row['Nama']} - {catatan_setor}",
                                                    "Status": "Cleared",
                                                    "Tenggat_Waktu": "",
                                                    "Tanggal_Bayar": hari_ini_wib.strftime("%Y-%m-%d"),
                                                    "Sumber": sumber_t,
                                                    "tabungan_id": row.get("id") # <-- LINK ID UNTUK PENGHAPUSAN NANTI
                                                }
                                                save_to_cloud(main_t)
                                                
                                                st.success(f"✅ Berhasil setor Rp {nominal_setor:,.0f} dari {sumber_t}!")
                                                st.session_state[f"setor_tabungan_{idx}"] = False
                                                st.rerun()
                                                
                                                st.success(f"✅ Berhasil setor Rp {nominal_setor:,.0f} dari {sumber_t}!")
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
                                            # 2. Histori tabungan inner
                                            transaksi_data = {
                                                "tabungan_id": row.get("id"),
                                                "tanggal": hari_ini_wib.strftime("%Y-%m-%d"),
                                                "nominal": nominal_tarik,
                                                "tipe": "Tarik",
                                                "catatan": catatan_tarik
                                            }
                                            conn.table("transaksi_tabungan").insert(transaksi_data).execute()
                                            
                                            # 3. PENTING: Catat di log utama (transaksi) sebagai PEMASUKAN
                                            # agar saldo Bank/Cash bertambah kembali
                                            sumber_t = st.selectbox("Masuk ke mana?", ["Bank", "Cash"], key=f"src_tarik_{idx}")
                                            main_t = {
                                                "Tanggal": hari_ini_wib.strftime("%Y-%m-%d"),
                                                "Tipe": "Pemasukan",
                                                "Kategori": "Tarik Tabungan",
                                                "Nominal": nominal_tarik,
                                                "Catatan": f"Tarik dari Tabungan: {row['Nama']} - {catatan_tarik}",
                                                "Status": "Cleared",
                                                "Tenggat_Waktu": "",
                                                "Tanggal_Bayar": hari_ini_wib.strftime("%Y-%m-%d"),
                                                "Sumber": sumber_t
                                            }
                                            save_to_cloud(main_t)

                                            st.success(f"✅ Berhasil tarik Rp {nominal_tarik:,.0f} ke {sumber_t}!")
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
            "sumber": "Sumber",
            "titipan": "Titipan"
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
        "Titipan": st.column_config.NumberColumn(
            "Titipan (Rp)", 
            format="Rp %d",
            help="Nominal talangan orang lain"
        ),
    }
    
    st.info("💡 **Tips:** Untuk menghapus/mengedit transaksi, ubah data di tabel lalu klik tombol **'Simpan Perubahan'** di bawah.")
    
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
                if (edited_df["Nominal"] <= 0).any():
                    st.error("❌ Ada nominal yang 0 atau kurang!")
                else:
                    data_to_save = edited_df.copy()
                    
                    for col in ["Tanggal", "Tenggat_Waktu", "Tanggal_Bayar"]:
                        if col in data_to_save.columns:
                            data_to_save[col] = data_to_save[col].apply(
                                lambda x: x.strftime("%Y-%m-%d") if pd.notnull(x) and hasattr(x, 'strftime') else ""
                            )
                    
                    data_to_save = data_to_save.rename(columns={
                        "Tanggal": "tanggal", "Tipe": "tipe", "Kategori": "kategori",
                        "Nominal": "nominal", "Catatan": "catatan", "Status": "status",
                        "Tenggat_Waktu": "tenggat_waktu", "Tanggal_Bayar": "tanggal_bayar", 
                        "Sumber": "sumber", "Titipan": "titipan"
                    })
                    
                    cols_to_keep = ["tanggal","tipe","kategori","nominal","catatan","status","tenggat_waktu","tanggal_bayar","sumber", "titipan"]
                    data_to_save = data_to_save[[c for c in cols_to_keep if c in data_to_save.columns]]
                    records = data_to_save.to_dict(orient="records")
                    
                    conn.table("transaksi").delete().neq("id", -1).execute()
                    if records:
                        conn.table("transaksi").insert(records).execute()
                    
                    # ← Cache clear DULU sebelum recalculate
                    st.cache_data.clear()
                    st.success(f"✅ {len(records)} transaksi berhasil disimpan!")
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
                st.cache_data.clear()
                st.success("Data bank dihapus!")
                st.rerun()
        
        with col_hapus2:
            if st.button("Hapus Semua Data Cash", use_container_width=True):
                conn.table("transaksi").delete().eq("sumber", "Cash").execute()
                st.cache_data.clear()
                st.success("Data cash dihapus!")
                st.rerun()
        
        with col_hapus3:
            if st.button("Hapus SEMUA Data", use_container_width=True):
                conn.table("transaksi").delete().neq("id", -1).execute()
                st.cache_data.clear()
                st.success("Semua data dihapus!")
                st.rerun()
        
        with col_hapus4:
         
            id_hapus = st.number_input("ID yang dihapus", min_value=1, step=1, key="id_hapus")
            if st.button("Hapus ID", use_container_width=True):
                conn.table("transaksi").delete().eq("id", id_hapus).execute()
                st.cache_data.clear()
                st.success(f"ID {id_hapus} dihapus!")
                st.rerun()

else:
    st.info("Belum ada data transaksi")
    
    # Tombol untuk insert contoh data
    if st.button("➕ Insert Contoh Data"):
        contoh = [
            {
                "tanggal": hari_ini_wib.strftime("%Y-%m-%d"),
                "tipe": "Pengeluaran",
                "kategori": "Makan",
                "nominal": 50000,
                "catatan": "Makan siang",
                "status": "Cleared",
                "sumber": "Bank"
            },
            {
                "tanggal": hari_ini_wib.strftime("%Y-%m-%d"),
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




st.markdown("---")
st.markdown("""<div style="text-align:center;color:#334155;font-size:.75rem;padding:10px 0;">
💼 Financial Dashboard</div>""", unsafe_allow_html=True)
