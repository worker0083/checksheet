/**
 * パシフィックサプライ点検アプリ用 Gmail送信スクリプト
 * このスクリプトを作成した Gmail アカウントが「送信元」になります。
 *
 * 【設定】 プロジェクトの設定 → スクリプト プロパティ に以下を追加
 *   KEY      : 合言葉（任意の長い文字列。アプリの「合言葉」と同じものを入力）
 *   ALLOWED  : 送信を許可する宛先（任意。カンマ区切り）
 *              お客様ごとに宛先が変わる使い方では「設定しない」でください。
 *              （合言葉 KEY が一致しない送信はすべて拒否されます）
 */
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var props = PropertiesService.getScriptProperties();
    var key = props.getProperty('KEY');
    if (!key || d.k !== key) return out({ ok: false, e: 'auth' });
    var to = String(d.to || '').trim();
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to)) return out({ ok: false, e: 'to' });
    var allowed = props.getProperty('ALLOWED');
    if (allowed) {
      var list = allowed.split(',').map(function (s) { return s.trim().toLowerCase(); });
      if (list.indexOf(to.toLowerCase()) < 0) return out({ ok: false, e: 'notallowed' });
    }
    var bcc = String(d.bcc || '').trim();
    if (bcc && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(bcc)) bcc = '';
    var blob = Utilities.newBlob(Utilities.base64Decode(d.pdf), 'application/pdf', String(d.name || '点検結果.pdf'));
    MailApp.sendEmail(to, String(d.subject || '点検結果'), String(d.body || ''), {
      attachments: [blob],
      bcc: bcc,
      name: 'パシフィックサプライ'
    });
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, e: String(err) });
  }
}
function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
