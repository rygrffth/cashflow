import { ImapFlow } from 'imapflow';
import { NextResponse } from 'next/server';

// Helper to decode quoted-printable encoding
function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, '') // Join line wraps
    .replace(/(?:=[0-9A-Fa-f]{2})+/g, (match) => {
      const bytes = match
        .split('=')
        .slice(1)
        .map(hex => parseInt(hex, 16));
      return Buffer.from(bytes).toString('utf-8');
    });
}

// Decode MIME encoded-words (like =?UTF-8?B?...?= or =?UTF-8?Q?...?=)
function decodeMimeWords(str: string): string {
  return str.replace(/=\?([^?]+)\?([QB])\?([^?]+)\?=/gi, (_, charset, encoding, text) => {
    if (encoding.toUpperCase() === 'B') {
      return Buffer.from(text, 'base64').toString('utf-8');
    } else {
      return decodeQuotedPrintable(text.replace(/_/g, ' '));
    }
  });
}

function getAllMimeParts(rawSource: string): Array<{ contentType: string; content: string }> {
  const partsList: Array<{ contentType: string; content: string }> = [];
  const MAX_DEPTH = 10; // Guard against malformed/adversarial MIME with infinite nesting

  function walk(source: string, depth = 0) {
    if (depth > MAX_DEPTH) return; // Bug fix #2: prevent stack overflow on malformed MIME

    const sepMatch = source.match(/\r?\n\r?\n/);
    const sepIndex = sepMatch?.index ?? -1; // Bug fix #1: null-safe index access
    const sepLen = sepMatch ? sepMatch[0].length : 0;

    const headers = sepIndex !== -1 ? source.slice(0, sepIndex) : '';
    const body = sepIndex !== -1 ? source.slice(sepIndex + sepLen) : source;

    const contentTypeMatch = headers.match(/^Content-Type:\s*([^;]+)/im);
    const contentType = contentTypeMatch ? contentTypeMatch[1].trim().toLowerCase() : 'text/plain';

    const encodingMatch = headers.match(/^Content-Transfer-Encoding:\s*([^\s;]+)/im);
    const encoding = encodingMatch ? encodingMatch[1].trim().toLowerCase() : '7bit';

    if (contentType.startsWith('multipart/')) {
      const boundaryMatch = headers.match(/boundary="?([^"\n\r;]+)"?/i);
      if (boundaryMatch) {
        const boundary = boundaryMatch[1];
        const subParts = body.split('--' + boundary);
        for (const sp of subParts) {
          if (!sp.trim() || sp.trim() === '--') continue;
          walk(sp, depth + 1); // Bug fix #2: pass depth counter
        }
      }
    } else {
      let decoded = body;
      if (encoding === 'quoted-printable') {
        decoded = decodeQuotedPrintable(body);
      } else if (encoding === 'base64') {
        decoded = Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf-8');
      }
      partsList.push({ contentType, content: decoded });
    }
  }

  walk(rawSource);
  return partsList;
}

function parseMimeEmail(rawSource: string): { body: string; subject: string } {
  const sepMatch = rawSource.match(/\r?\n\r?\n/);
  const sepIndex = sepMatch?.index ?? -1; // Bug fix #1: null-safe index access
  const headersPart = sepIndex !== -1 ? rawSource.slice(0, sepIndex) : '';

  const subjectMatch = headersPart.match(/^Subject:\s*(.*)$/im);
  let subject = '';
  if (subjectMatch) {
    subject = decodeMimeWords(subjectMatch[1].trim());
  }

  const parts = getAllMimeParts(rawSource);
  const htmlPart = parts.find(p => p.contentType.includes('text/html'));
  const textPart = parts.find(p => p.contentType.includes('text/plain'));
  const bestBody = htmlPart ? htmlPart.content : (textPart ? textPart.content : rawSource);

  // Strip HTML tags and clean up whitespace
  const cleanedBody = bestBody
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { body: cleanedBody, subject };
}

function parseTransaction(body: string, subject: string) {
  // 1. Extract Nominal
  let nominal = 0;
  let nominalMatch = body.match(/Total\s*Transaksi\s*Rp\s*([\d.,]+)/i)
    || body.match(/Nominal\s*Transaksi\s*Rp\s*([\d.,]+)/i)
    || body.match(/Nominal\s*Top-?up\s*Rp\s*([\d.,]+)/i)
    || body.match(/Nominal\s*Transfer\s*Rp\s*([\d.,]+)/i)
    || body.match(/Detail\s*pembayaran[\s\S]*?Nominal\s*Rp\s*([\d.,]+)/i)
    || body.match(/Detail\s*pembayaran[\s\S]*?Total\s*Rp\s*([\d.,]+)/i)
    || body.match(/Total\s*Rp\s*([\d.,]+)/i)
    || body.match(/Nominal\s*Rp\s*([\d.,]+)/i)
    || body.match(/Rp\s*([\d.,]+)/i);

  if (nominalMatch) {
    const nominalStr = nominalMatch[1].replace(/\./g, '').replace(/,/g, '.');
    nominal = Math.floor(parseFloat(nominalStr));
  }

  if (nominal <= 0) return null;

  // 2. Extract Date
  let tanggal = new Date().toISOString().split('T')[0];
  let tglMatch = body.match(/Tanggal\s*(\d{1,2}\s+\w+\s+\d{4})/i)
    || body.match(/(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)\s+\d{4})/i)
    || body.match(/(\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4})/i);

  if (tglMatch) {
    try {
      let rawTgl = tglMatch[1];
      const bulanMap: { [key: string]: string } = {
        januari: 'Jan', februari: 'Feb', maret: 'Mar', april: 'Apr',
        mei: 'May', juni: 'Jun', juli: 'Jul', agustus: 'Aug',
        september: 'Sep', oktober: 'Oct', november: 'Nov', desember: 'Dec',
        jan: 'Jan', feb: 'Feb', mar: 'Mar', apr: 'Apr', jun: 'Jun', jul: 'Jul',
        agu: 'Aug', sep: 'Sep', okt: 'Oct', nov: 'Nov', des: 'Dec'
      };

      const sortedKeys = Object.keys(bulanMap).sort((a, b) => b.length - a.length);
      sortedKeys.forEach(idBln => {
        const regex = new RegExp(`\\b${idBln}\\b`, 'gi');
        rawTgl = rawTgl.replace(regex, bulanMap[idBln]);
      });

      const parsedDate = new Date(rawTgl);
      if (!isNaN(parsedDate.getTime())) {
        const offset = parsedDate.getTimezoneOffset() * 60000;
        tanggal = new Date(parsedDate.getTime() - offset).toISOString().split('T')[0];
      }
    } catch (e) {
      // Use fallback
    }
  }

  // 3. Extract Time (Jam)
  let jamMatch = body.match(/(\d{2}:\d{2}:\d{2})\s*WIB/i);
  if (!jamMatch) jamMatch = body.match(/Waktu\s*(\d{2}:\d{2}:\d{2})/i);
  if (!jamMatch) jamMatch = body.match(/Jam\s*(\d{2}:\d{2}:\d{2})/i);
  const jam = jamMatch ? jamMatch[1] : '';

  // 4. Extract Recipient & Bank Platform (Livin' Mandiri vs wondr by BNI)
  // Bug fix #3: use \b word boundaries to prevent false positives on words like
  // "kombinasi", "turbin", etc. from Mandiri emails matching the BNI pattern.
  const isBNI = /\bwondr\b|\bbni\b/i.test(body) || /\bbni\b/i.test(subject);
  let penerima = isBNI ? 'BNI Transaction' : 'Mandiri Transaction';

  if (isBNI) {
    const isLifeGoals = /Life\s*Goals/i.test(body) || /Life\s*Goals/i.test(subject);
    const isQRIS = /bayar\s*pakai\s*QRIS|Jenis\s*transaksi\s*QRIS/i.test(body);

    if (isLifeGoals) {
      const lifeGoalsMatch = body.match(/Rekening\s*Life\s*Goals\s+([A-Za-z0-9\s,.\-&'/()]+?)(?:\s+\d{8,}|\s+Sumber\s*dana)/i);
      if (lifeGoalsMatch) {
        penerima = `Setoran Life Goals: ${lifeGoalsMatch[1].trim()}`;
      } else {
        penerima = 'Setoran Life Goals (BNI)';
      }
    } else {
      const bniPenerimaMatch = body.match(/Penerima\s+([\w\s,.\-&'/()]+?)(?:\s+\w+,\s*\d{5},\s*ID|\s+Sumber\s*dana)/i)
        || body.match(/Penerima\s+([\w\s,.\-&'/()]{2,60}?)(?:\s+Sumber|\s+Tanggal|\s+Detail)/i);

      if (bniPenerimaMatch) {
        const namaMerchant = bniPenerimaMatch[1].trim();
        penerima = isQRIS ? `QRIS: ${namaMerchant}` : namaMerchant;
      } else if (isQRIS) {
        penerima = 'QRIS wondr BNI';
      }
    }
  } else {
    // Livin' Mandiri regexes
    const penerimaMatch = body.match(/Penerima\s+"?([\s\S]*?)"?\s+[\w\s().,\-]*?\s*-\s*ID/i);
    if (penerimaMatch) {
      const kandidat = penerimaMatch[1].trim();
      const blacklist = ["Tanggal", "Nominal", "Jam", "Halo", "Berikut"];
      if (kandidat.length > 2 && kandidat.length < 80 && !blacklist.some(k => kandidat.includes(k))) {
        penerima = kandidat;
      }
    }

    if (penerima === 'Mandiri Transaction') {
      const penyediaMatch = body.match(/Penyedia\s*Jasa\s+([\w\s]+?)(?:\s*\*{4}\d+)/i);
      if (penyediaMatch) {
        penerima = penyediaMatch[1].trim();
      }
    }

    if (penerima === 'Mandiri Transaction') {
      const transferMatch = body.match(/(?:Tujuan|Kepada)\s+([A-Za-z0-9\s,.\-]{3,50}?)(?:\s{2,}|\d{10,})/i);
      if (transferMatch) {
        penerima = transferMatch[1].trim();
      }
    }

    if (penerima === 'Mandiri Transaction') {
      const fallback = body.match(/(?:Penerima|Penyedia\s*Jasa|Tujuan|Kepada)\s+"?([\w\s',.\-&/()]{3,60}?)"?(?:\s*-\s*ID|\*{4}|\s{2,})/i);
      if (fallback) {
        penerima = fallback[1].trim();
      }
    }
  }

  penerima = penerima.replace(/['"]/g, '').replace(/\s+/g, ' ').trim();

  // 5. Determine Transaction Type (Tipe)
  let tipe = 'Pengeluaran';
  const isLifeGoalsTx = /Life\s*Goals/i.test(body) || /Life\s*Goals/i.test(subject);
  const outKeywords = ["Pembayaran", "Debit", "Transfer Keluar", "Tarik", "Top-up", "Top Up", "Bayar", "QRIS", "Setoran", "Life Goals"];
  const inKeywords = ["Kredit", "Transfer Masuk", "Terima Transfer", "Dana Masuk", "Uang Masuk", "Setoran Masuk"];

  if (isLifeGoalsTx) {
    tipe = 'Pengeluaran';
  } else if (outKeywords.some(k => subject.includes(k) || body.includes(k))) {
    tipe = 'Pengeluaran';
  } else if (inKeywords.some(k => subject.includes(k) || body.includes(k))) {
    tipe = 'Pemasukan';
  }

  // 6. Smart Category Detection
  let kategori = 'Lainnya';
  const lowerDesc = (penerima + ' ' + body).toLowerCase();

  if (isLifeGoalsTx || /life\s*goals|menabung|nabung/i.test(lowerDesc)) {
    kategori = 'Menabung';
  } else if (/pisang|mie|ayam|nasi|resto|warung|cafe|kopi|coffee|food|bakso|sate|makan|dapur|burger|pizza|martabak|roti|kuliner|snack/i.test(lowerDesc)) {
    kategori = 'Makan';
  } else if (/spbu|pertamina|shell|bp-akr|bensin|parkir|toll|tol\b|transport|grab|gojek|maxim/i.test(lowerDesc)) {
    kategori = 'Bensin / Mobilitas';
  } else if (/shopee|spay|tokopedia|lazada|tiktok|blibli/i.test(lowerDesc)) {
    kategori = 'SPay';
  } else if (/kos\b|kost\b|kontrakan/i.test(lowerDesc)) {
    kategori = 'Kos';
  } else if (/pln|listrik|pdam|wifi|indihome|pulsa|telkomsel|indosat|xl|tri|smartfren/i.test(lowerDesc)) {
    kategori = 'Bulanan';
  } else if (/netflix|spotify|bioskop|cinema|xxi|cgv|steam|playstation|game/i.test(lowerDesc)) {
    kategori = 'Hiburan';
  }

  return {
    tanggal,
    tipe,
    kategori,
    nominal,
    catatan: jam ? `[${jam}] ${penerima}` : penerima,
    status: 'Cleared',
    sumber: 'Bank',
    tanggal_bayar: tanggal
  };
}

export async function POST(req: Request) {
  try {
    const { email, pass, limit } = await req.json();
    if (!email || !pass) {
      return NextResponse.json({ success: false, error: 'Email dan password dibutuhkan' }, { status: 400 });
    }

    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: email,
        pass: pass
      },
      logger: false,
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000,
      socketTimeout: 20000,
      greetTimeout: 8000
    });

    // Prevent unhandled 'error' events from crashing the process
    client.on('error', err => {
      console.error('ImapFlow Client Error Event:', err);
    });

    await client.connect();

    const results: any[] = [];

    try {
      const lock = await client.getMailboxLock('INBOX');
      try {
        // Search for emails from both Mandiri (Livin') and BNI (wondr)
        let searchResult: number[] = [];
        try {
          const mandiriIds = (await client.search({ from: 'bankmandiri.co.id' })) || [];
          const bniIds = (await client.search({ from: 'bni.co.id' })) || [];
          searchResult = Array.from(new Set([...mandiriIds, ...bniIds])).sort((a, b) => a - b);
        } catch (searchErr) {
          console.warn('Fallback search query:', searchErr);
          const fallbackIds = (await client.search({ from: 'noreply.livin@bankmandiri.co.id' })) || [];
          searchResult = fallbackIds;
        }

        if (searchResult && searchResult.length > 0) {
          const limitVal = Math.min(Math.max(parseInt(String(limit), 10) || 10, 1), 100);
          const sortedIds = searchResult.slice(-limitVal).reverse();

          for (const uid of sortedIds) {
            const message = await client.fetchOne(uid, {
              envelope: true,
              source: true
            });

            if (!message) continue;

            const rawSubject = message.envelope?.subject || '';
            const subject = decodeMimeWords(rawSubject);

            // Skip failed transactions
            if (/Tidak Berhasil|Gagal|Failed|Ditolak/i.test(subject)) {
              continue;
            }

            const sourceBuffer = message.source;
            if (!sourceBuffer) continue;
            
            const sourceStr = sourceBuffer.toString('utf-8');
            const parsedMime = parseMimeEmail(sourceStr);
            
            const transaction = parseTransaction(parsedMime.body, parsedMime.subject);
            if (transaction) {
              results.push(transaction);
            }
          }
        }
      } finally {
        if (lock) {
          try {
            lock.release();
          } catch (lockErr) {
            console.warn('Error releasing lock:', lockErr);
          }
        }
      }
    } finally {
      try {
        await client.logout();
      } catch (logoutErr) {
        console.warn('Error during IMAP logout:', logoutErr);
      }
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    console.error('IMAP API Error:', error);
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
