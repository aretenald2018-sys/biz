// RFC 5987 호환 Content-Disposition 헤더 생성.
// 한글/유니코드 파일명을 다운로드해도 브라우저에서 깨지지 않음.
//
// disposition: 'attachment' | 'inline'
export function buildContentDisposition(
  fileName: string,
  disposition: 'attachment' | 'inline' = 'attachment',
): string {
  const safeAscii = fileName.replace(/[^\x20-\x7e]+/g, '_').replace(/"/g, "'");
  const encoded = encodeURIComponent(fileName);
  return `${disposition}; filename="${safeAscii}"; filename*=UTF-8''${encoded}`;
}
