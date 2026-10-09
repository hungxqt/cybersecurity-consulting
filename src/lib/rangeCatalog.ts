export const RANGE_LABS = [
  {
    id: 'network-digital-twin',
    immersive: true,
    title: ['3D network digital twin', 'Bản sao mạng 3D'],
    description: [
      'Orbit a network, inspect its systems and interrupt a fictional attack path.',
      'Xoay mạng, kiểm tra hệ thống và ngắt một đường tấn công hư cấu.',
    ],
    action: ['Enter the network', 'Khám phá mạng'],
  },
  {
    id: 'ddos-defense',
    immersive: true,
    title: ['DDoS defense range', 'Thực hành phòng vệ DDoS'],
    description: [
      'Balance incoming traffic, queues and defenses while keeping legitimate visitors connected.',
      'Cân bằng lưu lượng, hàng đợi và phòng vệ để duy trì truy cập hợp lệ.',
    ],
    action: ['Take control of traffic', 'Điều khiển lưu lượng'],
  },
  {
    id: 'response-terminal',
    immersive: true,
    title: ['Incident-response terminal', 'Terminal ứng phó sự cố'],
    description: [
      'Investigate and contain an incident with commands that change the network beside you.',
      'Điều tra và cô lập sự cố bằng lệnh làm thay đổi mạng ngay bên cạnh.',
    ],
    action: ['Open the terminal', 'Mở terminal'],
  },
  {
    id: 'ransomware-race',
    immersive: true,
    title: ['Ransomware containment race', 'Cuộc đua cô lập mã độc tống tiền'],
    description: [
      'Contain a spreading infection, preserve a recovery source and restore affected systems.',
      'Cô lập lây nhiễm, giữ nguồn khôi phục và phục hồi các hệ thống bị ảnh hưởng.',
    ],
    action: ['Contain the spread', 'Ngăn lây lan'],
  },
  {
    id: 'packet-workbench',
    immersive: true,
    title: ['Packet inspection workbench', 'Bàn kiểm tra gói tin'],
    description: [
      'Open protocol layers and build rules that explain which packets pass and which stop.',
      'Mở từng lớp giao thức và đặt quy tắc giải thích gói tin được qua hay bị chặn.',
    ],
    action: ['Inspect the packets', 'Kiểm tra gói tin'],
  },
  {
    id: 'zero-trust-journey',
    immersive: true,
    title: ['Zero-trust checkpoints', 'Các chốt kiểm soát Zero Trust'],
    description: [
      'Change identity, device and resource context to see access decisions at each checkpoint.',
      'Thay đổi danh tính, thiết bị và tài nguyên để xem quyết định ở từng chốt.',
    ],
    action: ['Evaluate a request', 'Đánh giá yêu cầu'],
  },
  {
    id: 'soc-replay',
    immersive: true,
    title: ['SOC replay theater', 'Phòng phát lại SOC'],
    description: [
      'Rewind an incident with synchronized logs, network activity and analyst actions.',
      'Tua lại sự cố với nhật ký, hoạt động mạng và thao tác chuyên viên đồng bộ.',
    ],
    action: ['Replay the incident', 'Phát lại sự cố'],
  },
  {
    id: 'cloud-blast-radius',
    immersive: true,
    title: ['Cloud blast-radius explorer', 'Khám phá phạm vi ảnh hưởng đám mây'],
    description: [
      'Select a compromised identity and shrink the assets it can reach by removing permissions.',
      'Chọn danh tính bị xâm nhập và thu hẹp tài sản có thể tiếp cận bằng cách gỡ quyền.',
    ],
    action: ['Explore the permissions', 'Khám phá quyền truy cập'],
  },
] as const;
export type RangeId = (typeof RANGE_LABS)[number]['id'];
