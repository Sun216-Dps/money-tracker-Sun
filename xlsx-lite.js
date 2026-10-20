/**
 * xlsx-lite.js — 极简 Excel(.xlsx) 读写工具（无任何依赖）
 *
 * 生成：用 ZIP(store 无压缩) + OOXML 最小部件，Excel / WPS / Office Online 均可打开
 * 读取：解析 ZIP 中央目录，用 DecompressionStream('deflate-raw') 解压 DEFLATE 条目
 *
 * 暴露到 window.XlsxLite（node 环境下挂到 globalThis，便于测试）
 */
(function (global) {
  'use strict';

  /* ---------------- CRC32 ---------------- */
  var CRC_TABLE = (function () {
    var t = new Int32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })();

  function crc32(bytes) {
    var crc = -1;
    for (var i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
    return (crc ^ -1) >>> 0;
  }

  function concatBytes(list) {
    var len = 0, i;
    for (i = 0; i < list.length; i++) len += list[i].length;
    var out = new Uint8Array(len);
    var off = 0;
    for (i = 0; i < list.length; i++) { out.set(list[i], off); off += list[i].length; }
    return out;
  }

  function u16(v) { return new Uint8Array([v & 255, (v >>> 8) & 255]); }
  function u32(v) { return new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]); }

  /* ---------------- ZIP 写入（store，无压缩） ---------------- */
  function buildZip(files) {
    var enc = new TextEncoder();
    var now = new Date();
    var dosTime = (((now.getHours() & 31) << 11) | ((now.getMinutes() & 63) << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
    var dosDate = ((((now.getFullYear() - 1980) & 127) << 9) | (((now.getMonth() + 1) & 15) << 5) | (now.getDate() & 31)) & 0xFFFF;

    var locals = [];
    var centrals = [];
    var offset = 0;

    files.forEach(function (f) {
      var nameBytes = enc.encode(f.name);
      var data = f.data;
      var crc = crc32(data);
      var localHead = concatBytes([
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(dosTime), u16(dosDate),
        u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes
      ]);
      locals.push(localHead, data);
      centrals.push(concatBytes([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(dosTime), u16(dosDate),
        u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length),
        u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes
      ]));
      offset += localHead.length + data.length;
    });

    var cd = concatBytes(centrals);
    var eocd = concatBytes([
      u32(0x06054b50), u16(0), u16(0), u16(centrals.length), u16(centrals.length),
      u32(cd.length), u32(offset), u16(0)
    ]);
    return concatBytes(locals.concat([cd, eocd]));
  }

  /* ---------------- 通用小工具 ---------------- */
  function colLetter(i) {
    var s = '';
    i += 1;
    while (i > 0) {
      var m = (i - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  }

  function colIndex(ref) {
    var letters = String(ref == null ? '' : ref).replace(/[^A-Za-z]/g, '').toUpperCase();
    var n = 0;
    for (var i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
    return n - 1;
  }

  function xmlEscape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  var HEADER = ['日期时间', '类型', '金额', '分类', '资金来源', '记账人', '备注'];

  /* ---------------- 生成 xlsx 字节 ---------------- */
  function buildXlsxBytes(rows, header) {
    var hdr = header || HEADER;
    var all = [hdr].concat(rows || []);

    var sheetRows = all.map(function (row, r) {
      var cells = (row || []).map(function (val, c) {
        var ref = colLetter(c) + (r + 1);
        if (typeof val === 'number' && isFinite(val)) {
          return '<c r="' + ref + '"><v>' + val + '</v></c>';
        }
        return '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEscape(val) + '</t></is></c>';
      }).join('');
      return '<row r="' + (r + 1) + '">' + cells + '</row>';
    }).join('');

    var sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<cols>' +
      '<col min="1" max="1" width="20"/><col min="2" max="2" width="8"/><col min="3" max="3" width="12"/>' +
      '<col min="4" max="4" width="12"/><col min="5" max="5" width="14"/><col min="6" max="6" width="10"/>' +
      '<col min="7" max="7" width="28"/>' +
      '</cols>' +
      '<sheetData>' + sheetRows + '</sheetData></worksheet>';

    var workbookXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="账目" sheetId="1" r:id="rId1"/></sheets></workbook>';

    var workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '</Relationships>';

    var rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';

    var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '</Types>';

    var enc = new TextEncoder();
    return buildZip([
      { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
      { name: '_rels/.rels', data: enc.encode(rootRels) },
      { name: 'xl/workbook.xml', data: enc.encode(workbookXml) },
      { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(workbookRels) },
      { name: 'xl/worksheets/sheet1.xml', data: enc.encode(sheetXml) }
    ]);
  }

  /* ---------------- 读取 xlsx ---------------- */
  var textDecoder = new TextDecoder('utf-8');

  function unzipEntries(buffer) {
    var bytes = new Uint8Array(buffer);
    var view = new DataView(buffer);
    var eocd = -1;
    for (var i = bytes.length - 22; i >= 0; i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('不是有效的 xlsx 文件（ZIP 结构缺失）');

    var total = view.getUint16(eocd + 10, true);
    var cdOffset = view.getUint32(eocd + 16, true);
    var entries = {};
    var p = cdOffset;

    for (var n = 0; n < total; n++) {
      if (view.getUint32(p, true) !== 0x02014b50) throw new Error('xlsx 目录结构损坏');
      var method = view.getUint16(p + 10, true);
      var compSize = view.getUint32(p + 20, true);
      var nameLen = view.getUint16(p + 28, true);
      var extraLen = view.getUint16(p + 30, true);
      var commentLen = view.getUint16(p + 32, true);
      var localOffset = view.getUint32(p + 42, true);
      var name = textDecoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));

      var lNameLen = view.getUint16(localOffset + 26, true);
      var lExtraLen = view.getUint16(localOffset + 28, true);
      var dataStart = localOffset + 30 + lNameLen + lExtraLen;
      entries[name] = { method: method, data: bytes.subarray(dataStart, dataStart + compSize) };

      p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  function inflateRaw(data) {
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error('当前环境不支持解压 xlsx，请使用新版浏览器，或改用 CSV 导入'));
    }
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([data]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
  }

  function entryBytes(entries, name) {
    var e = entries[name];
    if (!e) return Promise.resolve(null);
    if (e.method === 0) return Promise.resolve(e.data);
    if (e.method === 8) return inflateRaw(e.data);
    return Promise.reject(new Error('不支持的压缩方式（method=' + e.method + '）'));
  }

  global.XlsxLite = {
    buildZip: buildZip,
    buildXlsxBytes: buildXlsxBytes,
    unzipEntries: unzipEntries,
    entryBytes: entryBytes,
    crc32: crc32,
    colLetter: colLetter,
    colIndex: colIndex,
    xmlEscape: xmlEscape,
    decodeText: function (bytes) { return textDecoder.decode(bytes); },
    HEADER: HEADER
  };
})(typeof window !== 'undefined' ? window : globalThis);
