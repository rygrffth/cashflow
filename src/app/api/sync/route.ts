import { ImapFlow } from 'imapflow';

// Helper to decode quoted-printable encoding
function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, '') // Join line wraps
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
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

function parseMimeEmail(rawSource: string): { body: string; subject: string } {
  const separatorIndex = rawSource.indexOf('\r\n\r\n');
  const headersPart = separatorIndex !== -1 ? rawSource.slice(0, separatorIndex) : '';
  const bodyPart = separatorIndex !== -1 ? rawSource.slice(separatorIndex + 4) : rawSource;

  const subjectMatch = headersPart.match(/^Subject:\s*(.*)$/im);
  let subject = '';
  if (subjectMatch) {
    subject = decodeMimeWords(subjectMatch[1].trim());
  }

  const contentTypeMatch = headersPart.match(/^Content-Type:\s*([^;]+)/im);
  const contentType = contentTypeMatch ? contentTypeMatch[1].trim().toLowerCase() : 'text/plain';

  const encodingMatch = headersPart.match(/^Content-Transfer-Encoding:\s*([^\s;]+)/im);
  const encoding = encodingMatch ? encodingMatch[1].trim().toLowerCase() : '7bit';

  let body = bodyPart;

  if (contentType.startsWith('multipart/')) {
    const boundaryMatch = headersPart.match(/boundary="?([^"\n\r;]+)"?/i);
    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const parts = bodyPart.split('--' + boundary);
      for (const part of parts) {
        if (part.trim() === '' || part.trim() === '--') continue;
        const partSep = part.indexOf('\r\n\r\n');
        if (partSep === -1) continue;
        const partHeaders = part.slice(0, partSep);
        const partBody = part.slice(partSep + 4);

        const partContentTypeMatch = partHeaders.match(/^Content-Type:\s*([^;]+)/im);
        const partContentType = partContentTypeMatch ? partContentTypeMatch[1].trim().toLowerCase() : '';

        if (partContentType.includes('text/html') || partContentType.includes('text/plain')) {
          const partEncodingMatch = partHeaders.match(/^Content-Transfer-Encoding:\s*([^\s;]+)/im);
          const partEncoding = partEncodingMatch ? partEncodingMatch[1].trim().toLowerCase() : '7bit';

          let decodedPart = partBody;
          if (partEncoding === 'quoted-printable') {
            decodedPart = decodeQuotedPrintable(partBody);
          } else if (partEncoding === 'base64') {
            decodedPart = Buffer.from(partBody.replace(/\s+/g, ''), 'base64').toString('utf-8');
          }
          body = decodedPart;
          break;
        }
      }
    }
  } else {
    if (encoding === 'quoted-printable') {
      body = decodeQuotedPrintable(bodyPart);
    } else if (encoding === 'base64') {
      body = Buffer.from(bodyPart.replace(/\s+/g, ''), 'base64').toString('utf-8');
    }
  }

  // Strip HTML tags and clean up whitespace
  const cleanedBody = body
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
  let nominalMatch = body.match(/Total\s*Transaksi\s*Rp\s*([\d.,]+)/i);
  if (!nominalMatch) nominalMatch = body.match(/Nominal\s*Transaksi\s*Rp\s*([\d.,]+)/i);
  if (!nominalMatch) nominalMatch = body.match(/Nominal\s*Top-?up\s*Rp\s*([\d.,]+)/i);
  if (!nominalMatch) nominalMatch = body.match(/Nominal\s*Transfer\s*Rp\s*([\d.,]+)/i);
  if (!nominalMatch) nominalMatch = body.match(/Rp\s*([\d.,]+)/i);

  if (nominalMatch) {
    const nominalStr = nominalMatch[1].replace(/\./g, '').replace(/,/g, '.');
    nominal = Math.floor(parseFloat(nominalStr));
  }

  if (nominal <= 0) return null;

  // 2. Extract Date
  let tanggal = new Date().toISOString().split('T')[0];
  let tglMatch = body.match(/Tanggal\s*(\d{1,2}\s+\w+\s+\d{4})/i);
  if (!tglMatch) tglMatch = body.match(/(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)\s+\d{4})/i);
  if (!tglMatch) tglMatch = body.match(/(\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4})/i);

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

      Object.keys(bulanMap).forEach(idBln => {
        const regex = new RegExp(idBln, 'gi');
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
  if (!jamMatch) jamMatch = body.match(/Jam\s*(\d{2}:\d{2}:\d{2})/i);
  const jam = jamMatch ? jamMatch[1] : '';

  // 4. Extract Recipient (Penerima)
  let penerima = 'Mandiri Transaction';
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

  penerima = penerima.replace(/['"]/g, '').replace(/\s+/g, ' ').trim();

  // 5. Determine Transaction Type (Tipe)
  let tipe = 'Pengeluaran';
  const outKeywords = ["Pembayaran", "Debit", "Transfer Keluar", "Tarik", "Top-up", "Top Up"];
  const inKeywords = ["Kredit", "Transfer Masuk", "Terima", "Masuk"];

  if (outKeywords.some(k => subject.includes(k))) {
    tipe = 'Pengeluaran';
  } else if (inKeywords.some(k => subject.includes(k))) {
    tipe = 'Pemasukan';
  }

  return {
    tanggal,
    tipe,
    kategori: 'Lainnya',
    nominal,
    catatan: jam ? `[${jam}] ${penerima}` : penerima,
    status: 'Cleared',
    tanggal_bayar: tanggal
  };
}

export async function POST(req: Request) {
  try {
    const { email, pass, limit } = await req.json();
    if (!email || !pass) {
      return Response.json({ success: false, error: 'Email dan password dibutuhkan' }, { status: 400 });
    }

    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: email,
        pass: pass
      },
      logger: false
    });

    await client.connect();

    const lock = await client.getMailboxLock('INBOX');
    const results: any[] = [];

    try {
      // Search for emails from noreply.livin@bankmandiri.co.id
      const searchResult = await client.search({
        from: 'noreply.livin@bankmandiri.co.id'
      });

      const limitVal = limit ? parseInt(limit, 10) : 10;
      const sortedIds = searchResult.slice(-limitVal).reverse();

      for (const uid of sortedIds) {
        const message = await client.fetchOne(uid, {
          envelope: true,
          source: true
        });

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
    } finally {
      lock.release();
    }

    await client.logout();
    return Response.json({ success: true, data: results });
  } catch (error: any) {
    console.error('IMAP API Error:', error);
    return Response.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
