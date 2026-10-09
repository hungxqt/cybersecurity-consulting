import type { Lang } from './i18n';
import { RANGE_LABS } from './rangeCatalog';

export const LABS = [
  {
    id: 'attack-defense',
    title: ['Attack vs. defense', 'Tấn công và phòng thủ'],
    description: [
      'Enable defenses and watch a credential attack lose its path through a network.',
      'Bật các biện pháp bảo vệ và quan sát đường tấn công bằng thông tin đăng nhập bị chặn.',
    ],
    action: ['Change the defenses', 'Thay đổi biện pháp bảo vệ'],
  },
  {
    id: 'soc-console',
    title: ['Inside the SOC', 'Bên trong SOC'],
    description: [
      'Investigate three alerts, connect the evidence and choose a response.',
      'Điều tra ba cảnh báo, kết nối bằng chứng và chọn cách ứng phó.',
    ],
    action: ['Open an investigation', 'Mở cuộc điều tra'],
  },
  {
    id: 'architecture-builder',
    title: ['Build a security architecture', 'Xây dựng kiến trúc bảo mật'],
    description: [
      'Assemble an environment and see how its boundaries affect exposure.',
      'Lắp ghép môi trường và xem các ranh giới ảnh hưởng đến mức độ phơi nhiễm.',
    ],
    action: ['Build an environment', 'Xây dựng môi trường'],
  },
  {
    id: 'incident-timeline',
    title: ['A breach, frame by frame', 'Từng bước của một sự cố'],
    description: [
      'Scrub through an incident to see access, spread, containment and recovery.',
      'Di chuyển qua các mốc để xem truy cập, lan rộng, cô lập và khôi phục.',
    ],
    action: ['Explore the timeline', 'Khám phá dòng thời gian'],
  },
  {
    id: 'traffic-anomalies',
    title: ['Find the signal', 'Tìm tín hiệu bất thường'],
    description: [
      'Shape network traffic and tune a threshold to expose spikes or quieter patterns.',
      'Điều chỉnh lưu lượng và ngưỡng để tìm đột biến hoặc các mẫu kín đáo hơn.',
    ],
    action: ['Explore the traffic', 'Khám phá lưu lượng'],
  },
  {
    id: 'packet-journey',
    title: ['Follow a packet', 'Theo dõi một gói tin'],
    description: [
      'Trace a request through DNS, firewall, application and database controls.',
      'Theo dõi yêu cầu qua DNS, tường lửa, ứng dụng và các biện pháp bảo vệ cơ sở dữ liệu.',
    ],
    action: ['Trace a request', 'Theo dõi yêu cầu'],
  },
] as const;
export type LabId = (typeof LABS)[number]['id'];
export const ALL_LABS = [...RANGE_LABS, ...LABS] as const;
export const local = (text: readonly [string, string], lang: Lang) => text[lang === 'vi' ? 1 : 0];

const en = {
  index: 'Interactive security labs',
  intro: 'Change a control. Follow the consequence.',
  indexBody:
    'Eight immersive exercises and six guided labs. Explore how security decisions change a system.',
  note: 'Educational scenarios with fictional systems and generated traffic. These exercises do not measure the security of your organization.',
  back: 'All Experience labs',
  open: 'Explore lab',
  controls: 'Your controls',
  view: 'System view',
  findings: 'What changes',
  reset: 'Reset lab',
  nojs: 'Enable JavaScript to operate this lab. The instructions remain available below.',
  play: 'Play',
  pause: 'Pause',
  next: 'Next step',
  previous: 'Previous step',
  step: 'Step',
  of: 'of',
  selected: 'Selected',
  active: 'Active',
  blocked: 'Blocked',
  waiting: 'Waiting',
  safe: 'Protected',
  exposed: 'Exposed',
  restored: 'Restored',
  contained: 'Contained',
  connected: 'Connected',
  absent: 'Not added',
  internet: 'Internet',
  identity: 'Identity',
  endpoint: 'Endpoint',
  app: 'Application',
  database: 'Database',
  backup: 'Backup',
  cloud: 'Cloud',
  firewall: 'Firewall',
  dns: 'DNS',
  client: 'Client',
  scenario: 'Attack route',
  credential: 'Stolen password',
  malware: 'Malicious attachment',
  mfa: 'Multi-factor authentication',
  edr: 'Endpoint detection',
  segment: 'Network segmentation',
  backups: 'Isolated backups',
  attackHint:
    'Choose an entry route, then switch controls on or off. Each control interrupts a different stage of this simplified attack.',
  passwordOpen:
    'The stolen password opens a session. Identity, application and database remain reachable.',
  passwordStop:
    'MFA interrupts this password-only entry. Session theft and MFA bypass are outside this exercise.',
  malwareOpen:
    'The attachment establishes endpoint access. The application and database are reachable from that endpoint.',
  malwareStop:
    'Endpoint detection isolates the affected device in this scenario. Real detection depends on coverage and response.',
  segmentStop:
    'Segmentation blocks the database hop in this modeled route; the application is still exposed.',
  backupSafe:
    'The isolated backup remains available for recovery. It does not prevent initial access.',
  backupOpen: 'The connected backup is reachable from the compromised data tier.',
  alerts: 'Alert queue',
  suspiciousLogin: 'Unusual administrator login',
  scriptAlert: 'Unexpected endpoint script',
  transferAlert: 'Large outbound transfer',
  severity: 'Priority',
  high: 'High',
  medium: 'Medium',
  evidence: 'Evidence timeline',
  respond: 'Choose a response',
  revoke: 'Revoke sessions',
  isolate: 'Isolate endpoint',
  blockTransfer: 'Block transfer',
  monitor: 'Continue monitoring',
  socHint:
    'Select an alert to inspect its evidence. A response stays attached to that investigation until you reset the lab.',
  loginEvidence:
    '09:12 — Administrator sign-in from an unfamiliar network|09:14 — New privileged session issued|09:17 — Restricted application opened',
  scriptEvidence:
    '10:03 — Attachment opened on workstation WS-17|10:04 — Script launched by the mail client|10:06 — Connection to an unfamiliar destination',
  transferEvidence:
    '11:21 — Service account reads a large archive|11:24 — Outbound upload begins|11:27 — Transfer exceeds the expected volume',
  loginAdvice:
    'Validate the administrator activity, then revoke the suspicious session and review privileges.',
  scriptAdvice:
    'Isolate the endpoint to interrupt its connection while retaining evidence for investigation.',
  transferAdvice: 'Block the outbound transfer and investigate the account and data involved.',
  responseRight:
    'This response interrupts the observed activity. The investigation still needs validation and a root-cause review.',
  responseOther:
    'This action does not directly interrupt the activity shown. Compare the evidence with the recommended response.',
  responseMonitor: 'Monitoring preserves visibility but leaves the observed activity running.',
  components: 'Environment components',
  boundaries: 'Trust boundaries',
  privateData: 'Private database boundary',
  identityGate: 'Identity gate for cloud and application',
  architectureHint:
    'Add components with the controls below. Connections and exposure findings update as you build; no dragging is required.',
  emptyArchitecture: 'Add a component to start building your environment.',
  missingApp:
    'The database has no application connection. Add the application to complete the data path.',
  publicData:
    'The database sits on a public boundary. Restrict its access to the application tier.',
  privateDataGood: 'The private database boundary restricts the data path to the application.',
  missingIdentity:
    'Cloud or application access has no identity gate. Add Identity and enable the gate.',
  identityGood: 'The identity gate controls the modeled cloud and application entry paths.',
  backupDependency: 'Add Database to connect the backup to a recovery source.',
  architectureGood:
    'The modeled entry and data paths have explicit boundaries. This is a design exercise, not a security certification.',
  time: 'Incident position',
  timelineHint:
    'Move the slider or use the step buttons. Playback advances through the same five stages and stops at recovery.',
  stages: 'Initial access|Lateral movement|Data access|Containment|Recovery',
  stageNotes:
    '00:00 — A stolen session reaches the identity tier. Validate and revoke the session.|00:08 — The attacker reaches the application. Scope access and examine related activity.|00:18 — The database is accessed. Identify affected data and preserve evidence.|00:32 — Sessions are revoked and affected systems isolated. Access paths are interrupted.|04:00 — A verified backup restores the data tier. Rotate credentials and review the entry path before reconnecting.',
  trafficHint:
    'The chart shows 24 generated one-minute buckets. A volume threshold flags crossings; low-volume beaconing can remain below it.',
  baseline: 'Normal traffic',
  intensity: 'Pattern intensity',
  threshold: 'Detection threshold',
  pattern: 'Traffic pattern',
  spike: 'Burst',
  beacon: 'Periodic beacon',
  exfil: 'Sustained transfer',
  requests: 'Requests / minute',
  minute: 'Minute',
  volume: 'Volume',
  classification: 'Threshold result',
  crossings: 'Buckets above threshold',
  peak: 'Peak volume',
  detected: 'Above threshold',
  below: 'Below threshold',
  trafficNote:
    'A threshold crossing is a signal to investigate, not proof of malicious activity. Higher thresholds reduce noise but can miss quieter patterns.',
  packetHint:
    'Choose a request and set the controls before tracing it. Step through each hop to see what is resolved, inspected or blocked.',
  requestType: 'Request type',
  normalRequest: 'Authorized read',
  injectionRequest: 'Injection attempt',
  unauthorizedRequest: 'Unapproved source',
  tls: 'Transport encryption (TLS)',
  waf: 'Application inspection',
  sourceFilter: 'Source allowlist',
  leastPrivilege: 'Read-only database role',
  packetDns:
    'DNS resolves the application hostname to an address. Resolution alone does not establish trust.',
  packetFirewall: 'The firewall evaluates the source. This request is allowed to continue.',
  packetSourceStop: 'The source allowlist rejects this unapproved source at the firewall.',
  packetApp: 'The application evaluates the request before it reaches data.',
  packetWafStop:
    'Application inspection recognizes this exercise’s injection pattern and blocks the request.',
  packetDb: 'The authorized read completes using the database role.',
  packetPrivilegeStop:
    'The read-only database role rejects the attempted write. The application still needs its injection flaw fixed.',
  packetWrite:
    'The injected write reaches the database because inspection and read-only permissions are disabled.',
  encrypted: 'Transport is encrypted in this exercise. Encryption does not validate the request.',
  unencrypted:
    'Transport encryption is off. Data in transit is exposed to observation on the path.',
  complete: 'Trace complete',
};
type Copy = Record<keyof typeof en, string>;
const vi: Copy = {
  index: 'Phòng thực hành bảo mật tương tác',
  intro: 'Thay đổi biện pháp. Theo dõi kết quả.',
  indexBody:
    'Tám bài tập nhập vai và sáu phòng thực hành có hướng dẫn. Khám phá tác động của các quyết định bảo mật.',
  note: 'Các tình huống học tập dùng hệ thống hư cấu và lưu lượng được tạo sẵn. Bài tập không đo lường mức độ bảo mật của tổ chức bạn.',
  back: 'Tất cả phòng thực hành',
  open: 'Khám phá',
  controls: 'Bảng điều khiển',
  view: 'Sơ đồ hệ thống',
  findings: 'Điều gì thay đổi',
  reset: 'Đặt lại',
  nojs: 'Bật JavaScript để sử dụng các điều khiển. Hướng dẫn vẫn có sẵn bên dưới.',
  play: 'Phát',
  pause: 'Tạm dừng',
  next: 'Bước tiếp theo',
  previous: 'Bước trước',
  step: 'Bước',
  of: 'trên',
  selected: 'Đã chọn',
  active: 'Đang hoạt động',
  blocked: 'Bị chặn',
  waiting: 'Đang chờ',
  safe: 'Được bảo vệ',
  exposed: 'Phơi nhiễm',
  restored: 'Đã khôi phục',
  contained: 'Đã cô lập',
  connected: 'Đã kết nối',
  absent: 'Chưa thêm',
  internet: 'Internet',
  identity: 'Danh tính',
  endpoint: 'Thiết bị đầu cuối',
  app: 'Ứng dụng',
  database: 'Cơ sở dữ liệu',
  backup: 'Bản sao lưu',
  cloud: 'Đám mây',
  firewall: 'Tường lửa',
  dns: 'DNS',
  client: 'Máy khách',
  scenario: 'Đường tấn công',
  credential: 'Mật khẩu bị đánh cắp',
  malware: 'Tệp đính kèm độc hại',
  mfa: 'Xác thực đa yếu tố',
  edr: 'Phát hiện trên thiết bị',
  segment: 'Phân đoạn mạng',
  backups: 'Sao lưu tách biệt',
  attackHint:
    'Chọn điểm xâm nhập rồi bật hoặc tắt các biện pháp. Mỗi biện pháp ngắt một giai đoạn khác nhau trong đường tấn công đơn giản hóa này.',
  passwordOpen:
    'Mật khẩu bị đánh cắp mở một phiên truy cập. Danh tính, ứng dụng và cơ sở dữ liệu vẫn có thể bị tiếp cận.',
  passwordStop:
    'MFA chặn bước xâm nhập chỉ bằng mật khẩu này. Bài tập không bao gồm đánh cắp phiên hoặc vượt qua MFA.',
  malwareOpen:
    'Tệp đính kèm tạo quyền truy cập thiết bị. Từ đó có thể tiếp cận ứng dụng và cơ sở dữ liệu.',
  malwareStop:
    'Biện pháp phát hiện cô lập thiết bị bị ảnh hưởng trong tình huống này. Hiệu quả thực tế phụ thuộc phạm vi giám sát và ứng phó.',
  segmentStop:
    'Phân đoạn mạng chặn bước tới cơ sở dữ liệu trong đường tấn công này; ứng dụng vẫn bị phơi nhiễm.',
  backupSafe: 'Bản sao lưu tách biệt vẫn sẵn sàng để khôi phục. Nó không ngăn xâm nhập ban đầu.',
  backupOpen: 'Có thể tiếp cận bản sao lưu kết nối từ tầng dữ liệu đã bị xâm nhập.',
  alerts: 'Hàng đợi cảnh báo',
  suspiciousLogin: 'Đăng nhập quản trị bất thường',
  scriptAlert: 'Mã lệnh bất thường trên thiết bị',
  transferAlert: 'Truyền dữ liệu ra ngoài với dung lượng lớn',
  severity: 'Ưu tiên',
  high: 'Cao',
  medium: 'Trung bình',
  evidence: 'Dòng thời gian bằng chứng',
  respond: 'Chọn cách ứng phó',
  revoke: 'Thu hồi phiên',
  isolate: 'Cô lập thiết bị',
  blockTransfer: 'Chặn truyền dữ liệu',
  monitor: 'Tiếp tục theo dõi',
  socHint:
    'Chọn cảnh báo để xem bằng chứng. Cách ứng phó được giữ cho từng cuộc điều tra đến khi đặt lại.',
  loginEvidence:
    '09:12 — Quản trị viên đăng nhập từ mạng lạ|09:14 — Cấp phiên đặc quyền mới|09:17 — Mở ứng dụng bị hạn chế',
  scriptEvidence:
    '10:03 — Mở tệp đính kèm trên máy WS-17|10:04 — Ứng dụng thư chạy mã lệnh|10:06 — Kết nối tới địa chỉ lạ',
  transferEvidence:
    '11:21 — Tài khoản dịch vụ đọc kho dữ liệu lớn|11:24 — Bắt đầu tải dữ liệu ra ngoài|11:27 — Lượng truyền vượt mức dự kiến',
  loginAdvice: 'Xác minh hoạt động quản trị, thu hồi phiên đáng ngờ và kiểm tra đặc quyền.',
  scriptAdvice: 'Cô lập thiết bị để ngắt kết nối, đồng thời giữ bằng chứng điều tra.',
  transferAdvice: 'Chặn truyền dữ liệu ra ngoài và điều tra tài khoản cùng dữ liệu liên quan.',
  responseRight:
    'Biện pháp này ngắt hoạt động quan sát được. Vẫn cần xác minh và điều tra nguyên nhân gốc.',
  responseOther:
    'Biện pháp này không trực tiếp ngắt hoạt động đang hiển thị. Hãy đối chiếu bằng chứng với cách ứng phó đề xuất.',
  responseMonitor: 'Theo dõi duy trì khả năng quan sát nhưng hoạt động vẫn tiếp tục.',
  components: 'Thành phần môi trường',
  boundaries: 'Ranh giới tin cậy',
  privateData: 'Ranh giới cơ sở dữ liệu riêng tư',
  identityGate: 'Kiểm soát danh tính cho đám mây và ứng dụng',
  architectureHint:
    'Thêm thành phần bằng các điều khiển. Kết nối và các điểm phơi nhiễm cập nhật ngay; không cần kéo thả.',
  emptyArchitecture: 'Thêm một thành phần để bắt đầu xây dựng môi trường.',
  missingApp: 'Cơ sở dữ liệu chưa kết nối với ứng dụng. Thêm ứng dụng để hoàn thành đường dữ liệu.',
  publicData: 'Cơ sở dữ liệu nằm trên ranh giới công khai. Chỉ cho phép truy cập từ tầng ứng dụng.',
  privateDataGood: 'Ranh giới riêng tư giới hạn đường truy cập dữ liệu qua ứng dụng.',
  missingIdentity:
    'Đám mây hoặc ứng dụng chưa có kiểm soát danh tính. Thêm Danh tính và bật kiểm soát.',
  identityGood: 'Kiểm soát danh tính bảo vệ các đường vào đám mây và ứng dụng trong mô hình.',
  backupDependency: 'Thêm Cơ sở dữ liệu để kết nối bản sao lưu với nguồn khôi phục.',
  architectureGood:
    'Các đường vào và truy cập dữ liệu có ranh giới rõ ràng. Đây là bài tập thiết kế, không phải chứng nhận bảo mật.',
  time: 'Vị trí trong sự cố',
  timelineHint:
    'Di chuyển thanh trượt hoặc dùng nút từng bước. Chế độ phát chạy qua năm giai đoạn và dừng khi khôi phục.',
  stages: 'Xâm nhập ban đầu|Di chuyển ngang|Truy cập dữ liệu|Cô lập|Khôi phục',
  stageNotes:
    '00:00 — Phiên bị đánh cắp tiếp cận tầng danh tính. Xác minh và thu hồi phiên.|00:08 — Kẻ tấn công tiếp cận ứng dụng. Xác định phạm vi và kiểm tra hoạt động liên quan.|00:18 — Cơ sở dữ liệu bị truy cập. Xác định dữ liệu bị ảnh hưởng và giữ bằng chứng.|00:32 — Thu hồi phiên và cô lập hệ thống bị ảnh hưởng. Các đường truy cập bị ngắt.|04:00 — Bản sao lưu đã xác minh khôi phục tầng dữ liệu. Đổi thông tin đăng nhập và kiểm tra đường xâm nhập trước khi kết nối lại.',
  trafficHint:
    'Biểu đồ có 24 khoảng một phút được tạo sẵn. Ngưỡng dung lượng đánh dấu các điểm vượt ngưỡng; kết nối định kỳ ít dữ liệu có thể không vượt ngưỡng.',
  baseline: 'Lưu lượng bình thường',
  intensity: 'Cường độ mẫu',
  threshold: 'Ngưỡng phát hiện',
  pattern: 'Mẫu lưu lượng',
  spike: 'Đột biến',
  beacon: 'Kết nối định kỳ',
  exfil: 'Truyền liên tục',
  requests: 'Yêu cầu / phút',
  minute: 'Phút',
  volume: 'Lưu lượng',
  classification: 'Kết quả so với ngưỡng',
  crossings: 'Số khoảng vượt ngưỡng',
  peak: 'Lưu lượng cao nhất',
  detected: 'Vượt ngưỡng',
  below: 'Dưới ngưỡng',
  trafficNote:
    'Vượt ngưỡng là tín hiệu cần điều tra, không phải bằng chứng hoạt động độc hại. Ngưỡng cao giảm nhiễu nhưng có thể bỏ sót các mẫu ít dữ liệu.',
  packetHint:
    'Chọn yêu cầu và thiết lập biện pháp trước khi theo dõi. Đi từng bước để xem phân giải, kiểm tra hoặc chặn.',
  requestType: 'Loại yêu cầu',
  normalRequest: 'Đọc được cấp phép',
  injectionRequest: 'Thử chèn lệnh',
  unauthorizedRequest: 'Nguồn chưa được phép',
  tls: 'Mã hóa đường truyền (TLS)',
  waf: 'Kiểm tra ứng dụng',
  sourceFilter: 'Danh sách nguồn được phép',
  leastPrivilege: 'Vai trò cơ sở dữ liệu chỉ đọc',
  packetDns: 'DNS phân giải tên ứng dụng thành địa chỉ. Phân giải không tự thiết lập sự tin cậy.',
  packetFirewall: 'Tường lửa kiểm tra nguồn. Yêu cầu này được phép tiếp tục.',
  packetSourceStop: 'Danh sách cho phép từ chối nguồn chưa được cấp phép tại tường lửa.',
  packetApp: 'Ứng dụng kiểm tra yêu cầu trước khi truy cập dữ liệu.',
  packetWafStop: 'Kiểm tra ứng dụng nhận diện mẫu chèn lệnh trong bài tập và chặn yêu cầu.',
  packetDb: 'Yêu cầu đọc được cấp phép hoàn tất với vai trò cơ sở dữ liệu.',
  packetPrivilegeStop: 'Vai trò chỉ đọc từ chối thao tác ghi. Ứng dụng vẫn cần sửa lỗi chèn lệnh.',
  packetWrite: 'Lệnh ghi được chèn tới cơ sở dữ liệu vì kiểm tra và quyền chỉ đọc đều bị tắt.',
  encrypted: 'Đường truyền được mã hóa trong bài tập. Mã hóa không xác thực yêu cầu.',
  unencrypted: 'Mã hóa đường truyền đang tắt. Dữ liệu có thể bị quan sát trên đường đi.',
  complete: 'Hoàn tất theo dõi',
};
export type CopyKey = keyof typeof en;
export const labCopy = (lang: Lang): Copy => (lang === 'vi' ? vi : en);
