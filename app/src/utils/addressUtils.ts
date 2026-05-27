type AddressType = 'word' | 'bit-in-word' | 'bool-only';

interface ParsedAddress {
  type: AddressType;
  prefix: string;
  word?: number;
  bit?: number;
  index?: number;
  max?: number;
  wordLen?: number; // Keep track of word segment length for padding
}

export function parseAddress(addr: string): ParsedAddress | null {
  if (!addr || typeof addr !== 'string') return null;
  const trimmed = addr.trim().toUpperCase();

  // R 類型 (KEYENCE 控制中繼器，格式如 R000 或 R1205，末尾兩位代表 00~15 位元)
  // 優先度高於一般 Word 匹配，將其當作 bit-in-word 以便與對應通道進行衝突檢測
  const rMatch = trimmed.match(/^(R)(\d+)(\d{2})$/);
  if (rMatch) {
    const wordNum = parseInt(rMatch[2]);
    const bitNum = parseInt(rMatch[3]);
    if (bitNum < 16) {
      return {
        type: 'bit-in-word',
        prefix: 'R',
        word: wordNum,
        bit: bitNum,
        wordLen: rMatch[2].length,
      };
    }
  }

  // M 類型（M0~M99），嚴格匹配 M 後面跟數字，排除 MR
  const mMatch = trimmed.match(/^(M)(\d+)$/);
  if (mMatch && !trimmed.startsWith('MR')) {
    return { type: 'bool-only', prefix: 'M', index: parseInt(mMatch[2]), max: 99 };
  }

  // MR 類型
  const mrMatch = trimmed.match(/^(MR)(\d+)$/);
  if (mrMatch) {
    return { type: 'bool-only', prefix: 'MR', index: parseInt(mrMatch[2]) };
  }

  // Bit-in-Word（含點記號）
  const bitMatch = trimmed.match(/^([A-Z]+)(\d+)\.(\d+)$/);
  if (bitMatch) {
    return {
      type: 'bit-in-word',
      prefix: bitMatch[1],
      word: parseInt(bitMatch[2]),
      bit: parseInt(bitMatch[3]),
    };
  }

  // Word 類型
  const wordMatch = trimmed.match(/^([A-Z]+)(\d+)$/);
  if (wordMatch) {
    return {
      type: 'word',
      prefix: wordMatch[1],
      word: parseInt(wordMatch[2]),
    };
  }

  return null;
}

export function incrementAddress(addr: string): string {
  const parsed = parseAddress(addr);
  if (!parsed) return addr;

  if (parsed.type === 'word') {
    return `${parsed.prefix}${(parsed.word! + 1)}`;
  }

  if (parsed.type === 'bit-in-word') {
    // 🌟 特殊處理 KEYENCE R 繼電器，避免前導零丟失並實現每 16 位元進位
    if (parsed.prefix === 'R' && parsed.wordLen !== undefined) {
      let newBit = parsed.bit! + 1;
      let newWord = parsed.word!;
      if (newBit >= 16) {
        newBit = 0;
        newWord += 1;
      }
      const wordStr = newWord.toString().padStart(parsed.wordLen, '0');
      const bitStr = newBit.toString().padStart(2, '0');
      return `${parsed.prefix}${wordStr}${bitStr}`;
    }

    const newBit = parsed.bit! + 1;
    if (newBit >= 16) {
      return `${parsed.prefix}${parsed.word! + 1}.0`;
    }
    return `${parsed.prefix}${parsed.word}.${newBit}`;
  }

  if (parsed.type === 'bool-only') {
    const next = parsed.index! + 1;
    if (parsed.max !== undefined && next > parsed.max) {
      return addr; // 到達上限，停止
    }
    return `${parsed.prefix}${next}`;
  }

  return addr;
}

export function fillAddresses(start: string, count: number): string[] {
  const result: string[] = [];
  let current = start;
  for (let i = 0; i < count; i++) {
    current = incrementAddress(current);
    result.push(current);
  }
  return result;
}

export function getAddressType(addr: string): AddressType | null {
  const parsed = parseAddress(addr);
  return parsed ? parsed.type : null;
}

export function shouldAutoBool(addr: string): boolean {
  const type = getAddressType(addr);
  return type === 'bit-in-word' || type === 'bool-only';
}

export function addressesOverlap(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = a.trim().toUpperCase();
  const nb = b.trim().toUpperCase();
  if (na === nb) return true;
  const pa = parseAddress(na);
  const pb = parseAddress(nb);
  if (!pa || !pb) return false;
  if (pa.prefix !== pb.prefix) return false;
  // word 與 bit-in-word 相同字號 → 重疊
  if (pa.type === 'word' && pb.type === 'bit-in-word') return pa.word === pb.word;
  if (pa.type === 'bit-in-word' && pb.type === 'word') return pa.word === pb.word;
  if (pa.type === 'word' && pb.type === 'word') return pa.word === pb.word;
  if (pa.type === 'bit-in-word' && pb.type === 'bit-in-word')
    return pa.word === pb.word && pa.bit === pb.bit;
  if (pa.type === 'bool-only' && pb.type === 'bool-only') return pa.index === pb.index;
  return false;
}

export function findConflictingAddresses(addresses: string[]): Set<string> {
  const valid = addresses.filter(Boolean);
  const conflicts = new Set<string>();
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      if (addressesOverlap(valid[i], valid[j])) {
        conflicts.add(valid[i].trim().toUpperCase());
        conflicts.add(valid[j].trim().toUpperCase());
      }
    }
  }
  return conflicts;
}

export function naturalSortAddress(a: string, b: string): number {
  // 自然數排序：比較前綴文字，再比較數字部分
  const parseForSort = (s: string) => {
    const m = s.match(/^([A-Za-z.]+)(\d+)(.*)$/);
    if (!m) return { prefix: s, num: 0, rest: '' };
    return { prefix: m[1], num: parseInt(m[2]), rest: m[3] };
  };
  const pa = parseForSort(a);
  const pb = parseForSort(b);
  if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix);
  if (pa.num !== pb.num) return pa.num - pb.num;
  return pa.rest.localeCompare(pb.rest);
}
