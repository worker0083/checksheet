/**
 * パシフィックサプライ点検アプリ用 Gmail送信スクリプト
 * このスクリプトを作成した Gmail アカウントが「送信元」になります。
 *
 * 【設定】 プロジェクトの設定 → スクリプト プロパティ に以下を追加
 *   KEY      : 合言葉（任意の長い文字列。アプリの「合言葉」と同じものを入力）
 *   ALLOWED  : 送信を許可する宛先（任意。カンマ区切り）
 *              お客様ごとに宛先が変わる使い方では「設定しない」でください。
 *              （合言葉 KEY が一致しない送信はすべて拒否されます）
 *   ADMIN    : 異常を知らせるメールの送り先（自分のメールアドレス）
 *
 * 【安全機能】 1日の送信数が上限（DAILY_LIMIT）を超えると送信を止め、ADMINにメールで知らせます。
 *              8割に達したときにも一度知らせます。
 */
var DAILY_LIMIT = 60;   // 1日に送れる通数（通常の業務より少し多めに設定）
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
    var cnt = countToday(props, to);
    if (cnt < 0) return out({ ok: false, e: 'limit' });
    var bcc = String(d.bcc || '').trim();
    if (bcc && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(bcc)) bcc = '';
    var blob = Utilities.newBlob(Utilities.base64Decode(d.pdf), 'application/pdf', String(d.name || '点検結果.pdf'));
    MailApp.sendEmail(to, String(d.subject || '点検結果'), String(d.body || ''), {
      attachments: [blob],
      bcc: bcc,
      name: 'パシフィックサプライメンテナンス'
    });
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, e: String(err) });
  }
}
function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function countToday(props, to) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd');
    var n = 0;
    if (props.getProperty('CNT_DAY') === today) n = Number(props.getProperty('CNT_N') || 0);
    else props.setProperties({ CNT_DAY: today, CNT_N: '0', CNT_WARN: '' });
    if (n >= DAILY_LIMIT) {
      if (props.getProperty('CNT_STOP') !== today) {
        props.setProperty('CNT_STOP', today);
        alertAdmin(props, '【点検アプリ】本日の送信上限に達したため送信を停止しました',
          '共通メールの本日の送信数が上限（' + DAILY_LIMIT + '通）に達しました。\n心当たりがない場合は、スクリプトプロパティの KEY（合言葉）を変更してください。');
      }
      return -1;
    }
    n++;
    props.setProperty('CNT_N', String(n));
    if (n >= Math.floor(DAILY_LIMIT * 0.8) && props.getProperty('CNT_WARN') !== today) {
      props.setProperty('CNT_WARN', today);
      alertAdmin(props, '【点検アプリ】本日の送信数が多くなっています',
        '共通メールの本日の送信数が ' + n + '通 になりました（上限 ' + DAILY_LIMIT + '通）。\n心当たりがない場合は、スクリプトプロパティの KEY（合言葉）を変更してください。');
    }
    return n;
  } finally {
    lock.releaseLock();
  }
}
function alertAdmin(props, subject, body) {
  var to = props.getProperty('ADMIN') || Session.getEffectiveUser().getEmail();
  try { MailApp.sendEmail(to, subject, body); } catch (e) {}
}
