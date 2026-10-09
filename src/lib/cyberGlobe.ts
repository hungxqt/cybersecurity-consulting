/** Curated coverage geometry. Never interpret these records as observed telemetry. */
export const cities = [
  { name: 'San Francisco', lat: 37.77, lon: -122.42 },
  { name: 'São Paulo', lat: -23.55, lon: -46.63 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'Frankfurt', lat: 50.11, lon: 8.68 },
  { name: 'Johannesburg', lat: -26.2, lon: 28.04 },
  { name: 'Mumbai', lat: 19.08, lon: 72.88 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Ho Chi Minh City', lat: 10.82, lon: 106.63 },
  { name: 'Tokyo', lat: 35.68, lon: 139.69 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
] as const;

export const taxonomy = {
  ddos: {
    en: 'DDoS',
    vi: 'DDoS',
    group: 'attack',
    priority: 'high',
    enDetail: 'Traffic floods can exhaust network and application capacity.',
    viDetail: 'Lưu lượng lớn có thể làm cạn năng lực mạng và ứng dụng.',
    enAction: 'Review rate limits, upstream filtering and capacity protection.',
    viAction: 'Kiểm tra giới hạn tốc độ, lọc lưu lượng và bảo vệ năng lực.',
  },
  malware: {
    en: 'Malware',
    vi: 'Mã độc',
    group: 'attack',
    priority: 'high',
    enDetail: 'Malicious code can compromise endpoints and workloads.',
    viDetail: 'Mã độc có thể xâm nhập thiết bị và hệ thống.',
    enAction: 'Isolate affected endpoints and preserve execution evidence.',
    viAction: 'Cô lập thiết bị bị ảnh hưởng và lưu bằng chứng thực thi.',
  },
  phishing: {
    en: 'Phishing',
    vi: 'Lừa đảo',
    group: 'attack',
    priority: 'medium',
    enDetail: 'Deceptive messages can expose credentials or trigger unsafe actions.',
    viDetail: 'Thông điệp lừa đảo có thể làm lộ thông tin đăng nhập.',
    enAction: 'Review message provenance, identity activity and session revocation.',
    viAction: 'Kiểm tra nguồn thông điệp, hoạt động danh tính và thu hồi phiên.',
  },
  ransomware: {
    en: 'Ransomware',
    vi: 'Mã độc tống tiền',
    group: 'attack',
    priority: 'critical',
    enDetail: 'Encryption and extortion threaten recovery and business continuity.',
    viDetail: 'Mã hóa và tống tiền đe dọa khả năng phục hồi và hoạt động.',
    enAction: 'Contain spread, preserve evidence and validate isolated backups.',
    viAction: 'Ngăn lan rộng, lưu bằng chứng và xác thực bản sao lưu độc lập.',
  },
  credential: {
    en: 'Credential abuse',
    vi: 'Lạm dụng thông tin đăng nhập',
    group: 'attack',
    priority: 'high',
    enDetail: 'Stolen credentials can provide access that appears legitimate.',
    viDetail: 'Thông tin đăng nhập bị đánh cắp có thể tạo quyền truy cập có vẻ hợp lệ.',
    enAction: 'Inspect sign-in context, revoke sessions and reset compromised credentials.',
    viAction: 'Kiểm tra ngữ cảnh đăng nhập, thu hồi phiên và thay thông tin bị lộ.',
  },
  exploitation: {
    en: 'Vulnerability exploitation',
    vi: 'Khai thác lỗ hổng',
    group: 'attack',
    priority: 'critical',
    enDetail: 'Exposed software flaws can enable unauthorized execution or access.',
    viDetail: 'Lỗ hổng phần mềm có thể cho phép thực thi hoặc truy cập trái phép.',
    enAction: 'Identify affected versions, reduce exposure and apply verified fixes.',
    viAction: 'Xác định phiên bản bị ảnh hưởng, giảm phơi nhiễm và áp dụng bản sửa.',
  },
  exfiltration: {
    en: 'Data exfiltration',
    vi: 'Đánh cắp dữ liệu',
    group: 'attack',
    priority: 'critical',
    enDetail: 'Unauthorized transfers can remove sensitive data across trust boundaries.',
    viDetail: 'Truyền trái phép có thể đưa dữ liệu nhạy cảm ra ngoài ranh giới tin cậy.',
    enAction: 'Review egress activity, access scope and data-loss controls.',
    viAction: 'Kiểm tra lưu lượng ra, phạm vi truy cập và kiểm soát mất dữ liệu.',
  },
  command: {
    en: 'Command & control',
    vi: 'Điều khiển từ xa',
    group: 'attack',
    priority: 'high',
    enDetail: 'Compromised systems may communicate with remote control infrastructure.',
    viDetail: 'Hệ thống bị xâm nhập có thể liên lạc với hạ tầng điều khiển từ xa.',
    enAction: 'Correlate DNS, proxy and endpoint evidence before blocking destinations.',
    viAction: 'Đối chiếu bằng chứng DNS, proxy và thiết bị trước khi chặn đích.',
  },
  supplyChain: {
    en: 'Supply-chain compromise',
    vi: 'Xâm nhập chuỗi cung ứng',
    group: 'attack',
    priority: 'critical',
    enDetail: 'Trusted software or vendor access can introduce compromise downstream.',
    viDetail: 'Phần mềm hoặc quyền truy cập nhà cung cấp có thể lan truyền xâm nhập.',
    enAction: 'Validate provenance, restrict vendor access and scope affected dependencies.',
    viAction: 'Xác thực nguồn gốc, giới hạn nhà cung cấp và xác định thành phần bị ảnh hưởng.',
  },
  cloudExposure: {
    en: 'Cloud exposure',
    vi: 'Phơi nhiễm đám mây',
    group: 'incident',
    priority: 'high',
    enDetail: 'Public resources and excessive permissions can expose protected assets.',
    viDetail: 'Tài nguyên công khai và quyền quá rộng có thể làm lộ tài sản.',
    enAction: 'Review resource visibility, access policies and audit history.',
    viAction: 'Kiểm tra khả năng truy cập, chính sách quyền và lịch sử kiểm toán.',
  },
  serviceDisruption: {
    en: 'Service disruption',
    vi: 'Gián đoạn dịch vụ',
    group: 'incident',
    priority: 'high',
    enDetail: 'Availability failures can affect users without evidence of an attack.',
    viDetail: 'Lỗi khả dụng có thể ảnh hưởng người dùng mà chưa có bằng chứng tấn công.',
    enAction: 'Check service health, dependencies and recovery procedures.',
    viAction: 'Kiểm tra sức khỏe dịch vụ, thành phần phụ thuộc và quy trình phục hồi.',
  },
  identityAnomaly: {
    en: 'Identity anomaly',
    vi: 'Bất thường danh tính',
    group: 'incident',
    priority: 'medium',
    enDetail: 'Unusual sign-in patterns need investigation before incident attribution.',
    viDetail: 'Đăng nhập bất thường cần được điều tra trước khi quy kết sự cố.',
    enAction: 'Correlate device, location and session context with the account owner.',
    viAction: 'Đối chiếu thiết bị, vị trí và ngữ cảnh phiên với chủ tài khoản.',
  },
} as const;
export const attackTypes = Object.keys(taxonomy) as (keyof typeof taxonomy)[];
export type AttackType = (typeof attackTypes)[number];
export const routes: { from: number; to: number; type: AttackType }[] = [
  { from: 0, to: 7, type: 'ddos' },
  { from: 3, to: 6, type: 'malware' },
  { from: 8, to: 5, type: 'phishing' },
  { from: 6, to: 9, type: 'ddos' },
  { from: 5, to: 2, type: 'malware' },
  { from: 1, to: 3, type: 'phishing' },
  { from: 4, to: 7, type: 'malware' },
  { from: 2, to: 0, type: 'ddos' },
  { from: 7, to: 8, type: 'phishing' },
  { from: 3, to: 0, type: 'ransomware' },
  { from: 8, to: 6, type: 'credential' },
  { from: 0, to: 5, type: 'exploitation' },
  { from: 7, to: 2, type: 'exfiltration' },
  { from: 9, to: 3, type: 'command' },
  { from: 2, to: 7, type: 'supplyChain' },
  { from: 6, to: 0, type: 'cloudExposure' },
  { from: 5, to: 9, type: 'serviceDisruption' },
  { from: 1, to: 2, type: 'identityAnomaly' },
];

export type Vec3 = [number, number, number];
export function spherePoint(lat: number, lon: number): Vec3 {
  const a = (lat * Math.PI) / 180;
  const b = (lon * Math.PI) / 180;
  return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)];
}

/** Raised great-circle path, with endpoints anchored to the sphere. */
export function arcPoint(a: Vec3, b: Vec3, t: number): Vec3 {
  const angle = Math.acos(
    Math.max(
      -1,
      Math.min(
        1,
        a.reduce((sum, v, i) => sum + v * b[i]!, 0),
      ),
    ),
  );
  const sine = Math.sin(angle);
  const u = sine > 0.0001 ? Math.sin((1 - t) * angle) / sine : 1 - t;
  const v = sine > 0.0001 ? Math.sin(t * angle) / sine : t;
  const height = 1 + Math.sin(t * Math.PI) * 0.22;
  return a.map((n, i) => (n * u + b[i]! * v) * height) as Vec3;
}

// Deliberately simplified continental silhouettes, not geopolitical boundaries.
const land: [number, number][][] = [
  [
    [-168, 72],
    [-140, 70],
    [-125, 60],
    [-105, 72],
    [-82, 69],
    [-58, 48],
    [-78, 42],
    [-81, 25],
    [-98, 16],
    [-111, 30],
    [-125, 48],
    [-155, 58],
  ],
  [
    [-81, 12],
    [-66, 10],
    [-50, 0],
    [-35, -7],
    [-40, -23],
    [-53, -35],
    [-68, -55],
    [-75, -40],
    [-80, -10],
  ],
  [
    [-17, 36],
    [9, 37],
    [33, 31],
    [43, 12],
    [51, 11],
    [42, -12],
    [32, -29],
    [18, -35],
    [10, -17],
    [-2, 5],
    [-17, 15],
  ],
  [
    [-10, 36],
    [-10, 58],
    [6, 71],
    [30, 70],
    [42, 60],
    [65, 70],
    [100, 77],
    [145, 70],
    [179, 65],
    [163, 50],
    [140, 42],
    [130, 31],
    [121, 20],
    [107, 5],
    [99, 9],
    [88, 22],
    [78, 8],
    [67, 24],
    [46, 30],
    [35, 42],
    [22, 35],
    [10, 44],
  ],
  [
    [113, -22],
    [124, -14],
    [136, -12],
    [145, -16],
    [154, -28],
    [146, -39],
    [131, -33],
    [115, -35],
  ],
  [
    [-54, 59],
    [-43, 60],
    [-22, 76],
    [-40, 83],
    [-60, 76],
  ],
  [
    [47, -13],
    [50, -17],
    [46, -26],
    [43, -22],
  ],
  [
    [130, 32],
    [141, 42],
    [145, 44],
    [142, 34],
  ],
  [
    [95, 5],
    [106, -6],
    [115, -8],
    [119, -5],
    [108, 0],
  ],
  [
    [166, -34],
    [179, -39],
    [172, -47],
    [165, -44],
  ],
];

export const landPoints: Vec3[] = [];
for (let lat = -55; lat <= 83; lat += 2) {
  for (let lon = -178; lon <= 178; lon += 2) {
    const inside = land.some((polygon) => {
      let hit = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [x, y] = polygon[i]!;
        const [px, py] = polygon[j]!;
        if (y > lat !== py > lat && lon < ((px - x) * (lat - y)) / (py - y) + x) hit = !hit;
      }
      return hit;
    });
    if (inside) landPoints.push(spherePoint(lat, lon));
  }
}
