/**
 * 公共工具：统一日志格式、orderId 生成、ISO 时间戳。
 */

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * 生成 orderId，格式 ORDER-YYYYMMDD-NNN（NNN 为 3 位随机）。
 * 与 docs/并发理论大作业命名规则.pdf 约定一致。
 */
export function generateOrderId(): string {
  const d = new Date();
  const yyyymmdd =
    `${d.getUTCFullYear()}` +
    `${String(d.getUTCMonth() + 1).padStart(2, '0')}` +
    `${String(d.getUTCDate()).padStart(2, '0')}`;
  const nnn = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `ORDER-${yyyymmdd}-${nnn}`;
}

/**
 * 统一日志：[org/taskType] orderId=... extra...
 */
export function log(org: string, taskType: string, orderId: unknown, extra: Record<string, unknown> = {}) {
  const id = typeof orderId === 'string' && orderId.length > 0 ? orderId : 'NO_ORDER_ID';
  const stamped = `[${new Date().toISOString()}] [${org}/${taskType}] orderId=${id}`;
  if (Object.keys(extra).length === 0) {
    console.log(stamped);
  } else {
    console.log(stamped, extra);
  }
}

/**
 * 构造组织 senderId（如 FFW-COLLAB）。
 */
export function senderId(org: string): string {
  const prefix = process.env.SENDER_PREFIX ?? 'CAMUNDA-COLLAB';
  return `${org}-${prefix}`;
}
